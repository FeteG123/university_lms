"""Live lecture chat: PostgreSQL persistence + Redis pub/sub for real-time fan-out."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import roles
from app.models.chat_message import ChatMessage
from app.models.chat_room import ChatRoom
from app.models.course import Course
from app.models.enrollment import Enrollment
MAX_MESSAGES = 500


def channel_key(course_id: int) -> str:
    return f"lms:lecture:{course_id}"


def can_access_lecture(db: Session, user_id: int, role: str, course_id: int) -> bool:
    if db.get(Course, course_id) is None:
        return False
    if role == roles.ADMIN:
        return True
    course = db.get(Course, course_id)
    if course is not None and course.instructor_id == user_id:
        return True
    en = db.execute(
        select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
    ).scalar_one_or_none()
    return en is not None


def get_or_create_room(db: Session, course_id: int) -> ChatRoom:
    room = db.scalar(select(ChatRoom).where(ChatRoom.course_id == course_id))
    if room is not None:
        return room
    room = ChatRoom(course_id=course_id)
    db.add(room)
    db.flush()
    return room


def ensure_room_for_course(db: Session, course_id: int) -> None:
    get_or_create_room(db, course_id)


def message_to_wire(msg: ChatMessage, sender_name: str) -> dict[str, object]:
    return {
        "id": msg.id,
        "user": sender_name,
        "text": msg.content,
        "sent_at": msg.sent_at.isoformat(),
        "is_pinned": msg.is_pinned,
    }


def encode_wire_payload(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False)


def persist_message(
    db: Session,
    *,
    course_id: int,
    sender_id: int,
    sender_name: str,
    text: str,
) -> str:
    content = text.strip()
    if not content:
        raise ValueError("empty message")
    room = get_or_create_room(db, course_id)
    msg = ChatMessage(room_id=room.id, sender_id=sender_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return encode_wire_payload(message_to_wire(msg, sender_name))


def list_messages_db(db: Session, course_id: int, *, limit: int = MAX_MESSAGES) -> list[dict[str, object]]:
    room = db.scalar(select(ChatRoom).where(ChatRoom.course_id == course_id))
    if room is None:
        return []
    stmt = (
        select(ChatMessage)
        .options(joinedload(ChatMessage.sender))
        .where(ChatMessage.room_id == room.id)
        .order_by(ChatMessage.sent_at.asc())
        .limit(limit)
    )
    rows = list(db.scalars(stmt))
    out: list[dict[str, object]] = []
    for msg in rows:
        name = msg.sender.full_name if msg.sender else "?"
        out.append(message_to_wire(msg, name))
    return out
