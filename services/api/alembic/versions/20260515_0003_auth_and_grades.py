"""auth fields on users and grades table

Revision ID: 20260515_0003
Revises: 20260511_0002
Create Date: 2026-05-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260515_0003"
down_revision: Union[str, Sequence[str], None] = "20260511_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# bcrypt hash for password "demo1234" — matches scripts/seed.sql
_DEMO_HASH = "$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=32), server_default=sa.text("'student'"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    # Placeholder hash until seed runs; existing rows get demo password
    op.execute(
        sa.text(
            "UPDATE users SET password_hash = :h, role = 'lecturer' "
            "WHERE email = 'instructor@example.edu'"
        ).bindparams(h=_DEMO_HASH)
    )
    op.execute(
        sa.text(
            "UPDATE users SET password_hash = :h, role = 'student' "
            "WHERE email = 'student@example.edu'"
        ).bindparams(h=_DEMO_HASH)
    )
    op.execute(
        sa.text("UPDATE users SET password_hash = :h, role = 'student' WHERE password_hash IS NULL").bindparams(
            h=_DEMO_HASH
        )
    )
    op.alter_column("users", "password_hash", nullable=False)

    op.create_table(
        "grades",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("letter_grade", sa.String(length=4), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("graded_by", sa.Integer(), nullable=False),
        sa.Column(
            "graded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["graded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id", name="uq_grades_submission_id"),
    )
    op.create_index("ix_grades_submission_id", "grades", ["submission_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_grades_submission_id", table_name="grades")
    op.drop_table("grades")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "is_active")
    op.drop_column("users", "role")
    op.drop_column("users", "password_hash")
