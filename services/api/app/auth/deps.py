from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import roles
from app.auth.security import decode_access_token
from app.db import get_db
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    email: str
    full_name: str
    role: str

    @property
    def is_student(self) -> bool:
        return self.role == roles.STUDENT

    @property
    def is_lecturer(self) -> bool:
        return self.role == roles.LECTURER

    @property
    def is_admin(self) -> bool:
        return self.role == roles.ADMIN


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found or inactive")
    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


def require_roles(*allowed: str) -> Callable[..., CurrentUser]:
    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed and user.role != roles.ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient permissions")
        return user

    return _dep
