from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import roles
from app.auth.deps import CurrentUser, require_roles
from app.auth.security import hash_password
from app.db import get_db
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreateIn(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern="^(student|lecturer|admin)$")


class UserPatchIn(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=200)
    role: str | None = Field(None, pattern="^(student|lecturer|admin)$")
    is_active: bool | None = None


def _count_active_admins(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == roles.ADMIN, User.is_active.is_(True))
        )
        or 0
    )


def _ensure_not_last_admin(db: Session, target: User, new_role: str | None, new_active: bool | None) -> None:
    """Block changes that would leave zero active admins."""
    if target.role != roles.ADMIN or not target.is_active:
        return
    becomes_non_admin = new_role is not None and new_role != roles.ADMIN
    becomes_inactive = new_active is False
    if not becomes_non_admin and not becomes_inactive:
        return
    if _count_active_admins(db) <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "cannot remove or demote the last active administrator",
        )


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles(roles.ADMIN)),
    q: str | None = Query(None, min_length=1, max_length=100, description="Search email or full name."),
    role: str | None = Query(None, pattern="^(student|lecturer|admin)$"),
) -> list[User]:
    stmt = select(User)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(term), User.full_name.ilike(term)))
    if role:
        stmt = stmt.where(User.role == role)
    stmt = stmt.order_by(User.id.asc()).limit(500)
    return list(db.scalars(stmt))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateIn,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_roles(roles.ADMIN)),
) -> User:
    email = body.email.lower().strip()
    dup = db.scalar(select(User).where(func.lower(User.email) == email))
    if dup is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    u = User(
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserPatchIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles(roles.ADMIN)),
) -> User:
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    if body.full_name is not None:
        u.full_name = body.full_name.strip()
    if body.role is not None:
        _ensure_not_last_admin(db, u, body.role, None)
        u.role = body.role
    if body.is_active is not None:
        if not body.is_active and u.id == admin.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot deactivate your own account")
        _ensure_not_last_admin(db, u, None, body.is_active)
        u.is_active = body.is_active
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles(roles.ADMIN)),
) -> None:
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    if u.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot deactivate your own account")
    if not u.is_active:
        return
    _ensure_not_last_admin(db, u, None, False)
    u.is_active = False
    db.add(u)
    db.commit()
