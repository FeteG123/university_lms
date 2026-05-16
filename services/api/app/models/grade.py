from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    score: Mapped[float] = mapped_column(Numeric(5, 2))
    letter_grade: Mapped[str | None] = mapped_column(String(4), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text(), nullable=True)
    graded_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    graded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    submission = relationship("Submission", back_populates="grade")
    grader = relationship("User", foreign_keys=[graded_by])
