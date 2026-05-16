from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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
from app.services.file_storage import save_submission_file
from app.snowflake_gen import get_snowflake

router = APIRouter(prefix="/assignments", tags=["assignments"])


class SubmissionOut(BaseModel):
    id: int
    public_id: int
    assignment_id: int
    student_id: int
    body_text: str | None = None
    file_name: str | None = None
    file_size_bytes: int | None = None
    plagiarism_status: str
    plagiarism_score: float | None
    grade_score: float | None = None
    grade_feedback: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer("public_id")
    def serialize_public_id(self, value: int) -> str:
        return str(value)


def _submission_to_out(sub: Submission, grade: Grade | None) -> SubmissionOut:
    return SubmissionOut(
        id=sub.id,
        public_id=sub.public_id,
        assignment_id=sub.assignment_id,
        student_id=sub.student_id,
        body_text=sub.body_text,
        file_name=sub.file_name,
        file_size_bytes=sub.file_size_bytes,
        plagiarism_status=sub.plagiarism_status,
        plagiarism_score=sub.plagiarism_score,
        grade_score=float(grade.score) if grade is not None else None,
        grade_feedback=grade.feedback if grade is not None else None,
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


@router.post(
    "/{assignment_id}/submissions",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_submission(
    assignment_id: int,
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
    return _submission_to_out(sub, None)


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
        select(Submission, Grade)
        .outerjoin(Grade, Grade.submission_id == Submission.id)
        .where(Submission.assignment_id == assignment_id)
    )
    if not user.is_admin and course.instructor_id != user.id:
        stmt = stmt.where(Submission.student_id == user.id)
    stmt = stmt.order_by(Submission.id.desc())
    rows = db.execute(stmt).all()
    return [_submission_to_out(sub, grade) for sub, grade in rows]
