"""course max_enrollment capacity

Revision ID: 20260518_0007
Revises: 20260517_0006
Create Date: 2026-05-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260518_0007"
down_revision: Union[str, None] = "20260517_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column("max_enrollment", sa.Integer(), nullable=False, server_default="30"),
    )
    op.alter_column("courses", "max_enrollment", server_default=None)
    op.create_check_constraint(
        "ck_courses_max_enrollment_positive",
        "courses",
        "max_enrollment >= 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_courses_max_enrollment_positive", "courses", type_="check")
    op.drop_column("courses", "max_enrollment")
