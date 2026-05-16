from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import roles
from app.auth.deps import CurrentUser, get_current_user, require_roles
from app.db import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.services.courses_cache import (
    get_cached_course_list,
    invalidate_course_list_cache,
    set_cached_course_list,
)
from app.services.lecture_chat import can_access_lecture, ensure_room_for_course, list_messages_db

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=32)
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class CourseOut(BaseModel):
    id: int
    code: str
    title: str
    description: str | None
    instructor_id: int

    model_config = {"from_attributes": True}


class CourseDetailOut(CourseOut):
    """Course row plus enrollment flag (for course page / student self-enroll flow)."""

    is_enrolled: bool


class AssignmentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    due_at: datetime | None = None


class AssignmentOut(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None
    due_at: datetime | None

    model_config = {"from_attributes": True}


class EnrollIn(BaseModel):
    user_id: int | None = Field(None, ge=1, description="Lecturer/admin only; students enroll self.")


class EnrollmentResultOut(BaseModel):
    enrollment_id: int
    status: str


class LectureMessageOut(BaseModel):
    id: int
    user: str
    text: str
    sent_at: str
    is_pinned: bool = False


def _courses_query(db: Session, user: CurrentUser):
    if user.is_admin:
        return select(Course).order_by(Course.id.asc())
    if user.is_lecturer:
        return select(Course).where(Course.instructor_id == user.id).order_by(Course.id.asc())
    # Students: full catalog so they can open a course and self-enroll (see get_course).
    return select(Course).order_by(Course.id.asc())


@router.get("", response_model=list[CourseOut])
def list_courses(
    response: Response,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    skip_cache: bool = Query(False, description="Bypass Redis cache (R6 benchmarks)."),
) -> list[CourseOut]:
    if user.is_admin and not skip_cache:
        cached = get_cached_course_list()
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            return [CourseOut.model_validate(row) for row in cached]

    rows = list(db.scalars(_courses_query(db, user)))
    out = [CourseOut.model_validate(r) for r in rows]
    if user.is_admin:
        payload: list[dict[str, Any]] = [o.model_dump(mode="json") for o in out]
        set_cached_course_list(payload)
        response.headers["X-Cache"] = "MISS"
    return out


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    body: CourseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(roles.LECTURER, roles.ADMIN)),
) -> Course:
    exists = db.execute(select(Course).where(Course.code == body.code)).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "course code already exists")
    instructor_id = user.id if user.is_lecturer else user.id
    if user.is_admin:
        instructor_id = user.id
    c = Course(
        code=body.code.strip(),
        title=body.title.strip(),
        description=body.description,
        instructor_id=instructor_id,
    )
    db.add(c)
    db.flush()
    ensure_room_for_course(db, c.id)
    db.commit()
    db.refresh(c)
    invalidate_course_list_cache()
    return c


@router.get("/{course_id}", response_model=CourseDetailOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> CourseDetailOut:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")

    if user.is_admin:
        return CourseDetailOut(**CourseOut.model_validate(c).model_dump(), is_enrolled=True)

    if c.instructor_id == user.id:
        return CourseDetailOut(**CourseOut.model_validate(c).model_dump(), is_enrolled=True)

    if user.is_student:
        en = db.scalar(
            select(Enrollment).where(
                Enrollment.user_id == user.id,
                Enrollment.course_id == course_id,
            )
        )
        return CourseDetailOut(**CourseOut.model_validate(c).model_dump(), is_enrolled=en is not None)

    en = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user.id,
            Enrollment.course_id == course_id,
        )
    )
    if en is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not enrolled")
    return CourseDetailOut(**CourseOut.model_validate(c).model_dump(), is_enrolled=True)


@router.post(
    "/{course_id}/enrollments",
    response_model=EnrollmentResultOut,
    status_code=status.HTTP_201_CREATED,
)
def enroll(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    body: EnrollIn | None = None,
) -> EnrollmentResultOut:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")

    if user.is_student:
        target_id = user.id
    elif body and body.user_id is not None:
        if not ((user.is_lecturer and c.instructor_id == user.id) or user.is_admin):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot enroll other users")
        target_id = body.user_id
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user_id required for staff enrollment")

    u = db.get(User, target_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    dup = db.execute(
        select(Enrollment).where(
            Enrollment.user_id == target_id,
            Enrollment.course_id == course_id,
        )
    ).scalar_one_or_none()
    if dup is not None:
        return EnrollmentResultOut(enrollment_id=dup.id, status="already_enrolled")
    e = Enrollment(user_id=target_id, course_id=course_id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return EnrollmentResultOut(enrollment_id=e.id, status="enrolled")


@router.get("/{course_id}/lecture/messages", response_model=list[LectureMessageOut])
def list_lecture_messages(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[LectureMessageOut]:
    if not can_access_lecture(db, user.id, user.role, course_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot access lecture for this course")
    rows = list_messages_db(db, course_id)
    return [LectureMessageOut.model_validate(m) for m in rows]


@router.get("/{course_id}/assignments", response_model=list[AssignmentOut])
def list_assignments(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[Assignment]:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if not user.is_admin and c.instructor_id != user.id:
        en = db.scalar(
            select(Enrollment).where(
                Enrollment.user_id == user.id,
                Enrollment.course_id == course_id,
            )
        )
        if en is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not enrolled")
    stmt = select(Assignment).where(Assignment.course_id == course_id).order_by(Assignment.id.asc())
    return list(db.scalars(stmt))


@router.post(
    "/{course_id}/assignments",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_assignment(
    course_id: int,
    body: AssignmentCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(roles.LECTURER, roles.ADMIN)),
) -> Assignment:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if not user.is_admin and c.instructor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not course instructor")
    a = Assignment(
        course_id=course_id,
        title=body.title.strip(),
        description=body.description,
        due_at=body.due_at,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
