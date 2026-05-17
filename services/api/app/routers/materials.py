from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.course import Course
from app.models.course_material import CourseMaterial
from app.models.enrollment import Enrollment
from app.services.material_storage import (
    delete_material_file,
    material_absolute_path,
    save_material_file,
)

router = APIRouter(prefix="/courses", tags=["course-materials"])


class MaterialOut(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None
    kind: str
    body_text: str | None
    external_url: str | None
    file_name: str | None
    file_size_bytes: int | None
    created_by_id: int
    created_by_name: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


def _material_out(m: CourseMaterial) -> MaterialOut:
    author = m.created_by.full_name if m.created_by is not None else "—"
    return MaterialOut(
        id=m.id,
        course_id=m.course_id,
        title=m.title,
        description=m.description,
        kind=m.kind,
        body_text=m.body_text,
        external_url=m.external_url,
        file_name=m.file_name,
        file_size_bytes=m.file_size_bytes,
        created_by_id=m.created_by_id,
        created_by_name=author,
        sort_order=m.sort_order,
        created_at=m.created_at,
    )


def _get_course(db: Session, course_id: int) -> Course:
    c = db.get(Course, course_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course not found")
    return c


def _assert_can_view_materials(db: Session, course: Course, user: CurrentUser) -> None:
    if user.is_admin or course.instructor_id == user.id:
        return
    en = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user.id,
            Enrollment.course_id == course.id,
        )
    )
    if en is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not enrolled in this course")


def _assert_can_manage_materials(course: Course, user: CurrentUser) -> None:
    if user.is_admin or course.instructor_id == user.id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "only the course professor or admin can manage materials")


@router.get("/{course_id}/materials", response_model=list[MaterialOut])
def list_materials(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[MaterialOut]:
    course = _get_course(db, course_id)
    _assert_can_view_materials(db, course, user)
    stmt = (
        select(CourseMaterial)
        .options(joinedload(CourseMaterial.created_by))
        .where(CourseMaterial.course_id == course_id)
        .order_by(CourseMaterial.sort_order.asc(), CourseMaterial.id.asc())
    )
    rows = list(db.scalars(stmt))
    return [_material_out(m) for m in rows]


@router.post(
    "/{course_id}/materials",
    response_model=MaterialOut,
    status_code=status.HTTP_201_CREATED,
)
def create_material(
    course_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    kind: str = Form(..., pattern="^(file|link|note)$"),
    title: str = Form(..., min_length=1, max_length=200),
    description: str | None = Form(None),
    body_text: str | None = Form(None),
    external_url: str | None = Form(None),
    file: UploadFile | None = File(None),
) -> MaterialOut:
    course = _get_course(db, course_id)
    _assert_can_manage_materials(course, user)

    title = title.strip()
    desc = (description or "").strip() or None
    if kind == "note":
        text = (body_text or "").strip()
        if not text:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "body_text required for note materials")
        m = CourseMaterial(
            course_id=course_id,
            title=title,
            description=desc,
            kind="note",
            body_text=text,
            created_by_id=user.id,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
    elif kind == "link":
        url = (external_url or "").strip()
        if not url:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "external_url required for link materials")
        m = CourseMaterial(
            course_id=course_id,
            title=title,
            description=desc,
            kind="link",
            external_url=url,
            created_by_id=user.id,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
    else:
        if file is None or not file.filename:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "file required for file materials")
        m = CourseMaterial(
            course_id=course_id,
            title=title,
            description=desc,
            kind="file",
            created_by_id=user.id,
        )
        db.add(m)
        db.flush()
        fname, rel, ctype, size = save_material_file(
            course_id=course_id,
            material_id=m.id,
            upload=file,
        )
        m.file_name = fname
        m.file_path = rel
        m.file_content_type = ctype
        m.file_size_bytes = size
        db.commit()
        db.refresh(m)

    m = db.scalar(
        select(CourseMaterial)
        .options(joinedload(CourseMaterial.created_by))
        .where(CourseMaterial.id == m.id)
    )
    return _material_out(m)


@router.delete("/{course_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    course_id: int,
    material_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    course = _get_course(db, course_id)
    _assert_can_manage_materials(course, user)
    m = db.get(CourseMaterial, material_id)
    if m is None or m.course_id != course_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "material not found")
    delete_material_file(m.file_path)
    db.delete(m)
    db.commit()


@router.get("/{course_id}/materials/{material_id}/file")
def download_material_file(
    course_id: int,
    material_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    course = _get_course(db, course_id)
    _assert_can_view_materials(db, course, user)
    m = db.get(CourseMaterial, material_id)
    if m is None or m.course_id != course_id or m.kind != "file" or not m.file_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    path = material_absolute_path(m.file_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file missing on storage volume")
    return FileResponse(
        path,
        media_type=m.file_content_type or "application/octet-stream",
        filename=m.file_name or "download",
    )
