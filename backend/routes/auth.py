"""Per-tenant users + roles for the backoffice (no global identity).

Credentials accepted on protected endpoints, in order:
1. The instance's ADMIN_TOKEN env (break-glass / bootstrap) → acts as 'admin'.
2. A JWT issued by POST /auth/login for a user in this tenant's users table.

Roles: 'admin' — KPIs, errors, config, user management.
       'manager' — KPIs only.
"""
import hmac
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from database import get_session
from models import User
from security import hash_password, verify_password, make_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])

ROLES = ("admin", "manager")


# ── Actor resolution ─────────────────────────────────────────────────────────

def get_actor(
    authorization: Optional[str] = Header(None),
    x_admin_token: Optional[str] = Header(None),
    session: Session = Depends(get_session),
) -> dict:
    supplied = x_admin_token
    if not supplied and authorization and authorization.startswith("Bearer "):
        supplied = authorization[len("Bearer "):]
    if not supplied:
        raise HTTPException(status_code=401, detail="Missing credentials")

    expected = os.getenv("ADMIN_TOKEN")
    if expected and hmac.compare_digest(supplied, expected):
        return {"kind": "token", "email": "root@instance", "name": "Instance token", "role": "admin"}

    claims = decode_token(supplied)
    if claims:
        user = session.exec(select(User).where(User.email == claims.get("sub"))).first()
        # role must still match — demoted/deleted users lose access immediately
        if user and user.role == claims.get("role"):
            return {"kind": "user", "email": user.email, "name": user.name, "role": user.role}

    raise HTTPException(status_code=401, detail="Invalid credentials")


def require_role(*roles: str):
    def dep(actor: dict = Depends(get_actor)) -> dict:
        if actor["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {' or '.join(roles)}")
        return actor
    return dep


# ── Schemas ──────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email: str
    password: str


class UserIn(BaseModel):
    email: str
    password: str
    name: str = ""
    role: str = "manager"

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return v


def _user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_token(user.email, user.role), "user": _user_out(user)}


@router.get("/me")
def me(actor: dict = Depends(get_actor)):
    return actor


@router.get("/users", dependencies=[Depends(require_role("admin"))])
def list_users(session: Session = Depends(get_session)):
    return [_user_out(u) for u in session.exec(select(User)).all()]


@router.post("/users", status_code=201, dependencies=[Depends(require_role("admin"))])
def create_user(body: UserIn, session: Session = Depends(get_session)):
    user = User(email=body.email, name=body.name, role=body.role,
                password_hash=hash_password(body.password))
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    session.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=204, dependencies=[Depends(require_role("admin"))])
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
