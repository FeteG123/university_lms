"""courses, enrollments, assignments, submissions

Revision ID: 20260511_0002
Revises: 20260511_0001
Create Date: 2026-05-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260511_0002"
down_revision: Union[str, Sequence[str], None] = "20260511_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("instructor_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["instructor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_courses_code"),
    )
    op.create_index("ix_courses_code", "courses", ["code"], unique=False)
    op.create_index("ix_courses_instructor_id", "courses", ["instructor_id"], unique=False)

    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),
    )
    op.create_index("ix_enrollments_user_id", "enrollments", ["user_id"], unique=False)
    op.create_index("ix_enrollments_course_id", "enrollments", ["course_id"], unique=False)

    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assignments_course_id", "assignments", ["course_id"], unique=False)

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=False),
        sa.Column(
            "plagiarism_status",
            sa.String(length=32),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("plagiarism_score", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_submissions_public_id"),
    )
    op.create_index("ix_submissions_assignment_id", "submissions", ["assignment_id"], unique=False)
    op.create_index("ix_submissions_student_id", "submissions", ["student_id"], unique=False)
    op.create_index("ix_submissions_plagiarism_status", "submissions", ["plagiarism_status"], unique=False)
    op.create_index(
        "ix_submissions_assignment_student",
        "submissions",
        ["assignment_id", "student_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_submissions_assignment_student", table_name="submissions")
    op.drop_index("ix_submissions_plagiarism_status", table_name="submissions")
    op.drop_index("ix_submissions_student_id", table_name="submissions")
    op.drop_index("ix_submissions_assignment_id", table_name="submissions")
    op.drop_table("submissions")
    op.drop_index("ix_assignments_course_id", table_name="assignments")
    op.drop_table("assignments")
    op.drop_index("ix_enrollments_course_id", table_name="enrollments")
    op.drop_index("ix_enrollments_user_id", table_name="enrollments")
    op.drop_table("enrollments")
    op.drop_index("ix_courses_instructor_id", table_name="courses")
    op.drop_index("ix_courses_code", table_name="courses")
    op.drop_table("courses")
