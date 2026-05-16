from __future__ import annotations

from datetime import UTC, datetime

from celery import Celery
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models.submission import Submission
from app.services.file_storage import submission_text_content

_settings = get_settings()
celery_app = Celery(
    "lms",
    broker=_settings.celery_broker_url,
    backend=_settings.celery_result_backend,
)
celery_app.conf.update(
    task_track_started=True,
    result_expires=3600,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)

from app.telemetry import configure_celery_observability

configure_celery_observability(celery_app)


def _word_set(text: str) -> set[str]:
    return {w for w in text.lower().split() if w}


@celery_app.task(name="lms.analyze_submission")
def analyze_submission_task(submission_id: int) -> str:
    """Batch plagiarism heuristic: max Jaccard similarity of word sets vs peers."""
    db: Session = SessionLocal()
    try:
        sub = db.get(Submission, submission_id)
        if sub is None:
            return "missing"

        text = submission_text_content(sub)
        words = _word_set(text)
        stmt = (
            select(Submission)
            .where(Submission.assignment_id == sub.assignment_id)
            .where(Submission.id != sub.id)
        )
        others = list(db.scalars(stmt))
        best = 0.0
        for other in others:
            ow = _word_set(submission_text_content(other))
            if not words or not ow:
                continue
            inter = len(words & ow)
            uni = len(words | ow)
            best = max(best, inter / uni if uni else 0.0)

        sub.plagiarism_score = round(best, 4)
        sub.plagiarism_status = "completed"
        sub.scanned_at = datetime.now(UTC)
        db.add(sub)
        db.commit()
        return "ok"
    except Exception:
        db.rollback()
        sub = db.get(Submission, submission_id)
        if sub is not None:
            sub.plagiarism_status = "failed"
            sub.plagiarism_score = None
            db.add(sub)
            db.commit()
        raise
    finally:
        db.close()
