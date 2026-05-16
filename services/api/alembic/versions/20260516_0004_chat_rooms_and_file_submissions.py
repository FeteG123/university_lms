"""chat_rooms, chat_messages, submission file attachments

Revision ID: 20260516_0004
Revises: 20260515_0003
Create Date: 2026-05-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0004"
down_revision: Union[str, Sequence[str], None] = "20260515_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_rooms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", name="uq_chat_rooms_course_id"),
    )
    op.create_index("ix_chat_rooms_course_id", "chat_rooms", ["course_id"], unique=True)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["room_id"], ["chat_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_room_id", "chat_messages", ["room_id"], unique=False)
    op.create_index("ix_chat_messages_sender_id", "chat_messages", ["sender_id"], unique=False)
    op.create_index("ix_chat_messages_sent_at", "chat_messages", ["sent_at"], unique=False)
    op.create_index(
        "ix_chat_messages_room_sent_at",
        "chat_messages",
        ["room_id", "sent_at"],
        unique=False,
    )

    op.add_column("submissions", sa.Column("file_name", sa.String(length=255), nullable=True))
    op.add_column("submissions", sa.Column("file_path", sa.String(length=512), nullable=True))
    op.add_column("submissions", sa.Column("file_content_type", sa.String(length=128), nullable=True))
    op.add_column("submissions", sa.Column("file_size_bytes", sa.BigInteger(), nullable=True))
    op.add_column("submissions", sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("submissions", "body_text", existing_type=sa.Text(), nullable=True)

    # One chat room per existing course
    op.execute(
        sa.text(
            """
            INSERT INTO chat_rooms (course_id)
            SELECT c.id FROM courses c
            WHERE NOT EXISTS (
                SELECT 1 FROM chat_rooms r WHERE r.course_id = c.id
            )
            """
        )
    )


def downgrade() -> None:
    op.alter_column("submissions", "body_text", existing_type=sa.Text(), nullable=False)
    op.drop_column("submissions", "scanned_at")
    op.drop_column("submissions", "file_size_bytes")
    op.drop_column("submissions", "file_content_type")
    op.drop_column("submissions", "file_path")
    op.drop_column("submissions", "file_name")
    op.drop_index("ix_chat_messages_room_sent_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_sent_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_sender_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_room_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_rooms_course_id", table_name="chat_rooms")
    op.drop_table("chat_rooms")
