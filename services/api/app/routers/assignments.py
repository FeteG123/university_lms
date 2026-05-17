from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field, field_serializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import roles
from app.auth.deps import CurrentUser, get_current_user, require_roles
from app.celery_worker import analyze_submission_task
from app.db import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.submission import Submission
from app.models.user import User
from app.services.file_storage import delete_submission_file, save_submission_file
from app.snowflake_gen import get_snowflake

router = APIRouter(prefix="/assignments", tags=["assignments"])


class AssignmentOut(BaseModel):
    id: int
    course_id: int
    title: str
    instructor_id: int

    model_config = {"from_attributes": True}


class SubmissionOut(BaseModel):
    id: int
    public_id: int
    assignment_id: int
    student_id: int
    student_name: str | None = None
    student_email: str | None = None
    submitted_at: datetime
    body_text: str | None = None
    file_name: str | None = None
    file_size_bytes: int | None = None
    plagiarism_status: str
    plagiarism_score: float | None
    grade_score: float | None = None
    grade_feedback: str | None = None
    replaced: bool = False

    model_config = {"from_attributes": True}

    @field_serializer("public_id")
    def serialize_public_id(self, value: int) -> str:
        return str(value)


def _submission_to_out(
    sub: Submission,
    grade: Grade | None,
    student: User | None = None,
    *,
    replaced: bool = False,
) -> SubmissionOut:
    return SubmissionOut(
        id=sub.id,
        public_id=sub.public_id,
        assignment_id=sub.assignment_id,
        student_id=sub.student_id,
        student_name=student.full_name if student is not None else None,
        student_email=student.email if student is not None else None,
        submitted_at=sub.created_at,
        body_text=sub.body_text,
        file_name=sub.file_name,
        file_size_bytes=sub.file_size_bytes,
        plagiarism_status=sub.plagiarism_status,
        plagiarism_score=sub.plagiarism_score,
        grade_score=float(grade.score) if grade is not None else None,
        grade_feedback=grade.feedback if grade is not None else None,
        replaced=replaced,
    )


def _assert_enrolled(db: Session, student_id: int, course_id: int) -> None:
    row = db.execute(
        select(Enrollment).where(
            Enrollment.user_id == student_id,
            Enrollment.course_id == course_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "student is not enrolled in this course",
        )


def _can_view_assignment(db: Session, a: Assignment, user: CurrentUser) -> Course:
    course = db.get(Course, a.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if user.is_admin or course.instructor_id == user.id:
        return course
    _assert_enrolled(db, user.id, course.id)
    return course


def _apply_submission_content(
    sub: Submission,
    *,
    text: str,
    has_file: bool,
    file: UploadFile | None,
    assignment_id: int,
    student_id: int,
) -> None:
    sub.body_text = text or None
    sub.plagiarism_status = "pending"
    sub.plagiarism_score = None
    sub.scanned_at = None
    sub.created_at = datetime.now(UTC)
    sub.updated_at = datetime.now(UTC)

    if has_file and file is not None:
        delete_submission_file(sub.file_path)
        fname, rel, ctype, size = save_submission_file(
            assignment_id=assignment_id,
            student_id=student_id,
            public_id=sub.public_id,
            upload=file,
        )
        sub.file_name = fname
        sub.file_path = rel
        sub.file_content_type = ctype
        sub.file_size_bytes = size
    else:
        delete_submission_file(sub.file_path)
        sub.file_name = None
        sub.file_path = None
        sub.file_content_type = None
        sub.file_size_bytes = None


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> AssignmentOut:
    a = db.get(Assignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment not found")
    course = _can_view_assignment(db, a, user)
    return AssignmentOut(
        id=a.id,
        course_id=a.course_id,
        title=a.title,
        instructor_id=course.instructor_id,
    )


@router.post(
    "/{assignment_id}/submissions",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_submission(
    assignment_id: int,
    response: Response,
    body_text: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(roles.STUDENT)),
) -> SubmissionOut:
    text = (body_text or "").strip()
    has_file = file is not None and file.filename
    if not text and not has_file:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provide body_text and/or a file")

    a = db.get(Assignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment not found")
    _assert_enrolled(db, user.id, a.course_id)
    if a.due_at is not None and datetime.now(UTC) > a.due_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "assignment deadline has passed")

    existing = db.scalar(
        select(Submission).where(
            Submission.assignment_id == assignment_id,
            Submission.student_id == user.id,
        )
    )
    replaced = existing is not None

    if existing is not None:
        sub = existing
        _apply_submission_content(
            sub,
            text=text,
            has_file=has_file,
            file=file,
            assignment_id=assignment_id,
            student_id=user.id,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        grade = db.scalar(select(Grade).where(Grade.submission_id == sub.id))
        analyze_submission_task.delay(sub.id)
        response.status_code = status.HTTP_200_OK
        return _submission_to_out(sub, grade, replaced=True)
    else:
        public_id = get_snowflake().next_id()
        sub = Submission(
            public_id=public_id,
            assignment_id=assignment_id,
            student_id=user.id,
            body_text=text or None,
            plagiarism_status="pending",
        )
        if has_file and file is not None:
            fname, rel, ctype, size = save_submission_file(
                assignment_id=assignment_id,
                student_id=user.id,
                public_id=public_id,
                upload=file,
            )
            sub.file_name = fname
            sub.file_path = rel
            sub.file_content_type = ctype
            sub.file_size_bytes = size

        db.add(sub)
        db.commit()
        db.refresh(sub)
        analyze_submission_task.delay(sub.id)
        return _submission_to_out(sub, None, replaced=False)


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[SubmissionOut]:
    a = db.get(Assignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment not found")
    course = _can_view_assignment(db, a, user)
    stmt = (
        select(Submission, Grade, User)
        .join(User, Submission.student_id == User.id)
        .outerjoin(Grade, Grade.submission_id == Submission.id)
        .where(Submission.assignment_id == assignment_id)
    )
    if not user.is_admin and course.instructor_id != user.id:
        stmt = stmt.where(Submission.student_id == user.id)
    stmt = stmt.order_by(Submission.created_at.desc())
    rows = db.execute(stmt).all()
    return [
        _submission_to_out(sub, grade, student)
        for sub, grade, student in rows
    ]
