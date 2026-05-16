"""Redis-backed course list cache (R5/R6 read optimisation)."""

from __future__ import annotations

import json
from typing import Any

from app.redis_client import get_redis

COURSES_CACHE_KEY = "lms:v1:courses:list"
COURSES_CACHE_TTL_SEC = 120


def get_cached_course_list() -> list[dict[str, Any]] | None:
    raw = get_redis().get(COURSES_CACHE_KEY)
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        return None
    return None


def set_cached_course_list(rows: list[dict[str, Any]]) -> None:
    get_redis().setex(COURSES_CACHE_KEY, COURSES_CACHE_TTL_SEC, json.dumps(rows))


def invalidate_course_list_cache() -> None:
    get_redis().delete(COURSES_CACHE_KEY)
