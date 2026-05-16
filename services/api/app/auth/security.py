from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed or not hashed.startswith("$2"):
        return False
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(*, user_id: int, role: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=settings.jwt_expire_hours)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        get_settings().jwt_secret,
        algorithms=["HS256"],
    )
