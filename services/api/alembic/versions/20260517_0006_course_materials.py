"""course_materials table

Revision ID: 20260517_0006
Revises: 20260516_0005
Create Date: 2026-05-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260517_0006"
down_revision: Union[str, Sequence[str], None] = "20260516_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_materials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("external_url", sa.String(length=2048), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=512), nullable=True),
        sa.Column("file_content_type", sa.String(length=128), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
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
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_course_materials_course_id", "course_materials", ["course_id"], unique=False)
    op.create_index(
        "ix_course_materials_course_sort",
        "course_materials",
        ["course_id", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_course_materials_course_sort", table_name="course_materials")
    op.drop_index("ix_course_materials_course_id", table_name="course_materials")
    op.drop_table("course_materials")
