from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

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
    instructor_id: int = Field(..., ge=1, description="Assigned professor (lecturer user id)")
    max_enrollment: int = Field(30, ge=1, le=500, description="Maximum number of enrolled students.")


class CoursePatchIn(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    instructor_id: int | None = Field(None, ge=1, description="Reassign professor (admin only)")
    max_enrollment: int | None = Field(None, ge=1, le=500, description="Maximum enrolled students.")


class CourseOut(BaseModel):
    id: int
    code: str
    title: str
    description: str | None
    instructor_id: int
    instructor_name: str
    max_enrollment: int
    enrollment_count: int

    model_config = {"from_attributes": True}


class CourseListOut(CourseOut):
    """List row; is_enrolled set for students browsing the full catalog."""

    is_enrolled: bool | None = None


class CourseDetailOut(CourseOut):
    """Course row plus enrollment flag (for course page / student self-enroll flow)."""

    is_enrolled: bool
    is_full: bool


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


class EnrolledStudentOut(BaseModel):
    enrollment_id: int
    user_id: int
    email: str
    full_name: str
    enrolled_at: datetime


class LectureMessageOut(BaseModel):
    id: int
    user: str
    text: str
    sent_at: str
    is_pinned: bool = False


def _enrollment_counts(db: Session, course_ids: list[int]) -> dict[int, int]:
    if not course_ids:
        return {}
    stmt = (
        select(Enrollment.course_id, func.count())
        .join(User, Enrollment.user_id == User.id)
        .where(Enrollment.course_id.in_(course_ids), User.role == roles.STUDENT)
        .group_by(Enrollment.course_id)
    )
    return {int(cid): int(cnt) for cid, cnt in db.execute(stmt).all()}


def _enrollment_count(db: Session, course_id: int) -> int:
    return _enrollment_counts(db, [course_id]).get(course_id, 0)


def _course_out(course: Course, enrollment_count: int) -> CourseOut:
    name = course.instructor.full_name if course.instructor is not None else "\u2014"
    return CourseOut(
        id=course.id,
        code=course.code,
        title=course.title,
        description=course.description,
        instructor_id=course.instructor_id,
        instructor_name=name,
        max_enrollment=course.max_enrollment,
        enrollment_count=enrollment_count,
    )


def _course_detail_out(course: Course, enrollment_count: int, *, is_enrolled: bool) -> CourseDetailOut:
    base = _course_out(course, enrollment_count)
    return CourseDetailOut(
        **base.model_dump(),
        is_enrolled=is_enrolled,
        is_full=enrollment_count >= course.max_enrollment,
    )


def _assert_capacity_available(course: Course, enrollment_count: int) -> None:
    if enrollment_count >= course.max_enrollment:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"course is full ({enrollment_count}/{course.max_enrollment} students)",
        )


def _courses_query(db: Session, user: CurrentUser, *, catalog: bool = False):
    base = select(Course).options(joinedload(Course.instructor)).order_by(Course.id.asc())
    if user.is_admin:
        return base
    if user.is_lecturer:
        return base.where(Course.instructor_id == user.id)
    if catalog:
        return base
    return base.join(Enrollment).where(Enrollment.user_id == user.id)


def _student_enrolled_ids(db: Session, user_id: int) -> set[int]:
    rows = db.scalars(select(Enrollment.course_id).where(Enrollment.user_id == user_id))
    return set(rows)


def _apply_course_search(stmt, q: str | None):
    if not q or not q.strip():
        return stmt
    term = f"%{q.strip()}%"
    return stmt.where(or_(Course.code.ilike(term), Course.title.ilike(term)))


def _resolve_instructor(db: Session, instructor_id: int) -> User:
    instructor = db.get(User, instructor_id)
    if instructor is None or not instructor.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "instructor not found")
    if instructor.role != roles.LECTURER:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "instructor_id must reference an active user with role lecturer",
        )
    return instructor


def _assert_course_staff(course: Course, user: CurrentUser) -> None:
    if user.is_admin or course.instructor_id == user.id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "not allowed to manage this course")


@router.get("", response_model=list[CourseListOut])
def list_courses(
    response: Response,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    skip_cache: bool = Query(False, description="Bypass Redis cache (R6 benchmarks)."),
    catalog: bool = Query(
        False,
        description="Students only: list all courses with is_enrolled. Default lists enrolled courses only.",
    ),
    q: str | None = Query(None, min_length=1, max_length=100, description="Search course code or title."),
) -> list[CourseListOut]:
    if user.is_student and catalog:
        enrolled_ids = _student_enrolled_ids(db, user.id)
        stmt = _apply_course_search(_courses_query(db, user, catalog=True), q)
        rows = list(db.scalars(stmt))
        counts = _enrollment_counts(db, [r.id for r in rows])
        return [
            CourseListOut(
                **_course_out(r, counts.get(r.id, 0)).model_dump(),
                is_enrolled=r.id in enrolled_ids,
            )
            for r in rows
        ]

    use_cache = user.is_admin and not skip_cache and not catalog and not q
    if use_cache:
        cached = get_cached_course_list()
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            return [CourseListOut.model_validate(row) for row in cached]

    stmt = _apply_course_search(_courses_query(db, user, catalog=catalog), q)
    rows = list(db.scalars(stmt))
    counts = _enrollment_counts(db, [r.id for r in rows])
    out = [_course_out(r, counts.get(r.id, 0)) for r in rows]
    if user.is_admin:
        payload: list[dict[str, Any]] = [o.model_dump(mode="json") for o in out]
        set_cached_course_list(payload)
        response.headers["X-Cache"] = "MISS"
    if user.is_student:
        return [CourseListOut(**o.model_dump(), is_enrolled=True) for o in out]
    return [CourseListOut(**o.model_dump()) for o in out]


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    body: CourseCreate,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_roles(roles.ADMIN)),
) -> CourseOut:
    exists = db.execute(select(Course).where(Course.code == body.code)).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "course code already exists")
    instructor = _resolve_instructor(db, body.instructor_id)
    c = Course(
        code=body.code.strip(),
        title=body.title.strip(),
        description=body.description,
        instructor_id=instructor.id,
        max_enrollment=body.max_enrollment,
    )
    db.add(c)
    db.flush()
    ensure_room_for_course(db, c.id)
    db.commit()
    db.refresh(c)
    c.instructor = instructor
    invalidate_course_list_cache()
    return _course_out(c, 0)


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    body: CoursePatchIn,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_roles(roles.ADMIN)),
) -> CourseOut:
    c = db.scalar(select(Course).options(joinedload(Course.instructor)).where(Course.id == course_id))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if body.title is not None:
        c.title = body.title.strip()
    if body.description is not None:
        c.description = body.description
    if body.instructor_id is not None:
        instructor = _resolve_instructor(db, body.instructor_id)
        c.instructor_id = instructor.id
        c.instructor = instructor
    if body.max_enrollment is not None:
        enrolled = _enrollment_count(db, course_id)
        if body.max_enrollment < enrolled:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"max_enrollment cannot be below current enrollment ({enrolled})",
            )
        c.max_enrollment = body.max_enrollment
    db.add(c)
    db.commit()
    db.refresh(c)
    if c.instructor is None:
        c = db.scalar(select(Course).options(joinedload(Course.instructor)).where(Course.id == course_id))
    invalidate_course_list_cache()
    enrolled = _enrollment_count(db, course_id)
    return _course_out(c, enrolled)


@router.get("/{course_id}", response_model=CourseDetailOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> CourseDetailOut:
    c = db.scalar(select(Course).options(joinedload(Course.instructor)).where(Course.id == course_id))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")

    enrolled_count = _enrollment_count(db, course_id)

    if user.is_admin or c.instructor_id == user.id:
        return _course_detail_out(c, enrolled_count, is_enrolled=True)

    if user.is_student:
        en = db.scalar(
            select(Enrollment).where(
                Enrollment.user_id == user.id,
                Enrollment.course_id == course_id,
            )
        )
        return _course_detail_out(c, enrolled_count, is_enrolled=en is not None)

    en = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user.id,
            Enrollment.course_id == course_id,
        )
    )
    if en is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not enrolled")
    return _course_detail_out(c, enrolled_count, is_enrolled=True)


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
    if not user.is_student and u.role != roles.STUDENT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "only students can be enrolled in a course")
    dup = db.execute(
        select(Enrollment).where(
            Enrollment.user_id == target_id,
            Enrollment.course_id == course_id,
        )
    ).scalar_one_or_none()
    if dup is not None:
        return EnrollmentResultOut(enrollment_id=dup.id, status="already_enrolled")
    enrolled_count = _enrollment_count(db, course_id)
    _assert_capacity_available(c, enrolled_count)
    e = Enrollment(user_id=target_id, course_id=course_id)
    db.add(e)
    db.commit()
    db.refresh(e)
    invalidate_course_list_cache()
    return EnrollmentResultOut(enrollment_id=e.id, status="enrolled")


@router.get("/{course_id}/enrollments", response_model=list[EnrolledStudentOut])
def list_course_enrollments(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[EnrolledStudentOut]:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    _assert_course_staff(c, user)
    stmt = (
        select(Enrollment, User)
        .join(User, Enrollment.user_id == User.id)
        .where(Enrollment.course_id == course_id, User.role == roles.STUDENT)
        .order_by(User.full_name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        EnrolledStudentOut(
            enrollment_id=enrollment.id,
            user_id=student.id,
            email=student.email,
            full_name=student.full_name,
            enrolled_at=enrollment.created_at,
        )
        for enrollment, student in rows
    ]


@router.delete(
    "/{course_id}/enrollments/{student_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unenroll(
    course_id: int,
    student_user_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    _assert_course_staff(c, user)
    row = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == student_user_id,
        )
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "enrollment not found")
    db.delete(row)
    db.commit()
    invalidate_course_list_cache()


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
    user: CurrentUser = Depends(require_roles(roles.LECTURER)),
) -> Assignment:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    if c.instructor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the assigned professor can manage assignments")
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
