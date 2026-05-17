"""Course material files on the shared submission volume (metadata in PostgreSQL)."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.services.file_storage import storage_root

MAX_MATERIAL_BYTES = 25 * 1024 * 1024
ALLOWED_SUFFIXES = {
    ".pdf",
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".log",
    ".zip",
    ".ppt",
    ".pptx",
    ".doc",
    ".docx",
}


def save_material_file(*, course_id: int, material_id: int, upload: UploadFile) -> tuple[str, str, str, int]:
    if not upload.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "file has no name")
    safe_name = Path(upload.filename).name
    suffix = Path(safe_name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"unsupported file type; allowed: {', '.join(sorted(ALLOWED_SUFFIXES))}",
        )
    data = upload.file.read()
    if len(data) > MAX_MATERIAL_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file too large (max 25 MB)")
    rel = f"materials/course_{course_id}/material_{material_id}_{safe_name}"
    dest = storage_root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    content_type = upload.content_type or "application/octet-stream"
    return safe_name, rel, content_type, len(data)


def delete_material_file(relative: str | None) -> None:
    if not relative:
        return
    path = storage_root() / relative
    if path.is_file():
        path.unlink(missing_ok=True)


def material_absolute_path(relative: str) -> Path:
    return storage_root() / relative
