"""Live lecture room: PostgreSQL messages + Redis pub/sub (R5/R7)."""

from __future__ import annotations

import asyncio
import contextlib

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.auth.security import decode_access_token
from app.config import get_settings
from app.db import SessionLocal
from app.models.user import User
from app.services.lecture_chat import can_access_lecture, channel_key, persist_message

router = APIRouter(tags=["websocket"])


def _user_from_token(token: str) -> tuple[int, str, str] | None:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        return None
    db: Session = SessionLocal()
    try:
        user = db.get(User, user_id)
        if user is None or not user.is_active:
            return None
        return user.id, user.full_name, user.role
    finally:
        db.close()


def _can_join_lecture(user_id: int, role: str, course_id: int) -> bool:
    db: Session = SessionLocal()
    try:
        return can_access_lecture(db, user_id, role, course_id)
    finally:
        db.close()


def _persist_and_publish(course_id: int, user_id: int, display_name: str, text: str) -> str:
    db: Session = SessionLocal()
    try:
        return persist_message(
            db,
            course_id=course_id,
            sender_id=user_id,
            sender_name=display_name,
            text=text,
        )
    finally:
        db.close()


@router.websocket("/ws/lectures/{course_id}")
async def lecture_room(
    websocket: WebSocket,
    course_id: int,
    token: str = Query(..., description="JWT access token from POST /api/auth/login"),
) -> None:
    identity = await run_in_threadpool(_user_from_token, token)
    if identity is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id, display_name, role = identity
    allowed = await run_in_threadpool(_can_join_lecture, user_id, role, course_id)
    if not allowed:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    settings = get_settings()
    channel = channel_key(course_id)
    sub_redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pub_redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = sub_redis.pubsub()
    await pubsub.subscribe(channel)

    async def pump() -> None:
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                data = msg.get("data")
                if isinstance(data, str):
                    await websocket.send_text(data)

    forward = asyncio.create_task(pump())
    try:
        while True:
            text_in = await websocket.receive_text()
            try:
                payload = await run_in_threadpool(
                    _persist_and_publish,
                    course_id,
                    user_id,
                    display_name,
                    text_in,
                )
            except ValueError:
                continue
            await pub_redis.publish(channel, payload)
    except WebSocketDisconnect:
        pass
    finally:
        forward.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await forward
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await sub_redis.aclose()
        await pub_redis.aclose()
