from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser, get_current_user
from app.auth.security import create_access_token, verify_password
from app.db import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    model_config = {"from_attributes": True}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    email = body.email.lower().strip()
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not user.password_hash:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    try:
        password_ok = verify_password(body.password, user.password_hash)
    except Exception:
        password_ok = False
    if not password_ok:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "invalid email or password (re-run scripts/seed.sql if demo accounts fail)",
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "account inactive")
    token = create_access_token(user_id=user.id, role=user.role, email=user.email)
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserMeOut)
def me(user: CurrentUser = Depends(get_current_user)) -> UserMeOut:
    return UserMeOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )
