"""one submission per student per assignment

Revision ID: 20260516_0005
Revises: 20260516_0004
Create Date: 2026-05-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0005"
down_revision: Union[str, Sequence[str], None] = "20260516_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep the newest row when duplicates exist (e.g. from earlier policy).
    op.execute(
        sa.text(
            """
            DELETE FROM submissions older
            USING submissions newer
            WHERE older.assignment_id = newer.assignment_id
              AND older.student_id = newer.student_id
              AND older.id < newer.id
            """
        )
    )
    op.drop_index("ix_submissions_assignment_student", table_name="submissions")
    op.create_unique_constraint(
        "uq_submissions_assignment_student",
        "submissions",
        ["assignment_id", "student_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_submissions_assignment_student", "submissions", type_="unique")
    op.create_index(
        "ix_submissions_assignment_student",
        "submissions",
        ["assignment_id", "student_id"],
        unique=False,
    )
