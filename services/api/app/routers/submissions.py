from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.grade import Grade
from app.models.submission import Submission
from app.routers.assignments import SubmissionOut, _submission_to_out
from app.services.file_storage import absolute_path, submission_has_file

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _authorize_submission_view(sub: Submission, user: CurrentUser, db: Session) -> None:
    a = db.get(Assignment, sub.assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment not found")
    course = db.get(Course, a.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if user.is_admin or course.instructor_id == user.id or sub.student_id == user.id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")


@router.get("/by-public/{public_id}", response_model=SubmissionOut)
def get_by_public_id(
    public_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SubmissionOut:
    try:
        pid = int(public_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "submission not found") from exc
    sub = db.scalar(select(Submission).where(Submission.public_id == pid))
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "submission not found")
    _authorize_submission_view(sub, user, db)
    grade = db.scalar(select(Grade).where(Grade.submission_id == sub.id))
    return _submission_to_out(sub, grade)


@router.get("/{submission_id}/file")
def download_submission_file(
    submission_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "submission not found")
    _authorize_submission_view(sub, user, db)
    if not submission_has_file(sub) or not sub.file_path or not sub.file_name:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no file on this submission")
    path = absolute_path(sub.file_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file missing on storage")
    return FileResponse(
        path,
        media_type=sub.file_content_type or "application/octet-stream",
        filename=sub.file_name,
    )


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SubmissionOut:
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "submission not found")
    _authorize_submission_view(sub, user, db)
    grade = db.scalar(select(Grade).where(Grade.submission_id == sub.id))
    return _submission_to_out(sub, grade)
