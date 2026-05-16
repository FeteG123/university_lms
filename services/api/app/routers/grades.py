from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import roles
from app.auth.deps import CurrentUser, get_current_user, require_roles
from app.db import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.submission import Submission
from app.models.user import User

router = APIRouter(tags=["grades"])


class GradeCreateIn(BaseModel):
    submission_id: int = Field(..., ge=1)
    score: float = Field(..., ge=0, le=100)
    letter_grade: str | None = Field(default=None, max_length=4)
    feedback: str | None = None


class GradeOut(BaseModel):
    id: int
    submission_id: int
    score: float
    letter_grade: str | None
    feedback: str | None
    graded_by: int
    student_id: int
    student_name: str
    assignment_id: int
    assignment_title: str
    plagiarism_score: float | None
    plagiarism_status: str

    model_config = {"from_attributes": True}


def _course_access(db: Session, course_id: int, user: CurrentUser) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if user.is_admin:
        return course
    if course.instructor_id == user.id:
        return course
    en = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == user.id,
        )
    )
    if en is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not enrolled in this course")
    return course


def _grade_rows_for_course(db: Session, course_id: int, student_id: int | None) -> list[GradeOut]:
    stmt = (
        select(Grade, Submission, Assignment, User)
        .join(Submission, Grade.submission_id == Submission.id)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(User, Submission.student_id == User.id)
        .where(Assignment.course_id == course_id)
        .order_by(Assignment.id.asc(), User.full_name.asc())
    )
    if student_id is not None:
        stmt = stmt.where(Submission.student_id == student_id)
    rows = db.execute(stmt).all()
    out: list[GradeOut] = []
    for grade, sub, asn, student in rows:
        out.append(
            GradeOut(
                id=grade.id,
                submission_id=grade.submission_id,
                score=float(grade.score),
                letter_grade=grade.letter_grade,
                feedback=grade.feedback,
                graded_by=grade.graded_by,
                student_id=student.id,
                student_name=student.full_name,
                assignment_id=asn.id,
                assignment_title=asn.title,
                plagiarism_score=sub.plagiarism_score,
                plagiarism_status=sub.plagiarism_status,
            )
        )
    return out


@router.post("/grades", response_model=GradeOut, status_code=status.HTTP_201_CREATED)
def grade_submission(
    body: GradeCreateIn,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(roles.LECTURER, roles.ADMIN)),
) -> GradeOut:
    submission_id = body.submission_id
    sub = db.scalar(
        select(Submission)
        .options(joinedload(Submission.assignment))
        .where(Submission.id == submission_id)
    )
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "submission not found")
    course = db.get(Course, sub.assignment.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if not user.is_admin and course.instructor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not course instructor")

    existing = db.scalar(select(Grade).where(Grade.submission_id == submission_id))
    if existing is not None:
        existing.score = body.score
        existing.letter_grade = body.letter_grade
        existing.feedback = body.feedback
        existing.graded_by = user.id
        db.add(existing)
        grade = existing
    else:
        grade = Grade(
            submission_id=submission_id,
            score=body.score,
            letter_grade=body.letter_grade,
            feedback=body.feedback,
            graded_by=user.id,
        )
        db.add(grade)
    db.commit()
    db.refresh(grade)
    student = db.get(User, sub.student_id)
    if student is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "student missing")
    return GradeOut(
        id=grade.id,
        submission_id=grade.submission_id,
        score=float(grade.score),
        letter_grade=grade.letter_grade,
        feedback=grade.feedback,
        graded_by=grade.graded_by,
        student_id=student.id,
        student_name=student.full_name,
        assignment_id=sub.assignment_id,
        assignment_title=sub.assignment.title,
        plagiarism_score=sub.plagiarism_score,
        plagiarism_status=sub.plagiarism_status,
    )


@router.get("/courses/{course_id}/grades", response_model=list[GradeOut])
def list_course_grades(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[GradeOut]:
    _course_access(db, course_id, user)
    student_filter = user.id if user.is_student else None
    return _grade_rows_for_course(db, course_id, student_filter)


@router.get("/courses/{course_id}/grades/export")
def export_course_grades_csv(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(roles.LECTURER, roles.ADMIN)),
) -> Response:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if not user.is_admin and course.instructor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not course instructor")

    rows = _grade_rows_for_course(db, course_id, None)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "course_code",
            "assignment_title",
            "student_name",
            "student_id",
            "score",
            "letter_grade",
            "plagiarism_score",
            "plagiarism_status",
            "feedback",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                course.code,
                r.assignment_title,
                r.student_name,
                r.student_id,
                r.score,
                r.letter_grade or "",
                r.plagiarism_score if r.plagiarism_score is not None else "",
                r.plagiarism_status,
                r.feedback or "",
            ]
        )
    content = buf.getvalue()
    filename = f"grades_{course.code}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
