"""Submission file attachments on a shared volume (metadata in PostgreSQL)."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings
from app.models.submission import Submission

MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_SUFFIXES = {".txt", ".md", ".csv", ".json", ".log"}


def storage_root() -> Path:
    root = Path(get_settings().submission_storage_path)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_submission_file(
    *,
    assignment_id: int,
    student_id: int,
    public_id: int,
    upload: UploadFile,
) -> tuple[str, str, str, int]:
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
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file too large (max 10 MB)")
    rel = f"assignment_{assignment_id}/student_{student_id}/{public_id}_{safe_name}"
    dest = storage_root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    content_type = upload.content_type or "application/octet-stream"
    return safe_name, rel, content_type, len(data)


def absolute_path(relative: str) -> Path:
    return storage_root() / relative


def submission_has_file(sub: Submission) -> bool:
    return bool(sub.file_path and sub.file_name)


def submission_text_content(sub: Submission) -> str:
    if sub.body_text and sub.body_text.strip():
        return sub.body_text
    if sub.file_path:
        path = absolute_path(sub.file_path)
        if path.is_file():
            return path.read_text(encoding="utf-8", errors="replace")
    return ""


def read_submission_text(sub: Submission) -> str:
    try:
        return submission_text_content(sub)
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "cannot read file") from exc
