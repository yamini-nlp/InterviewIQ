from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel
from app.database import get_db
from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.rate_limiter import check_rate_limit
from app.config import settings
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(
        key=f"register:{client_ip}",
        limit=10,
        window_seconds=3600,
    )
    if len(req.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    existing = await db.users.find_one({"email": req.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one(
        {
            "id": user_id,
            "email": req.email.lower().strip(),
            "name": req.name.strip(),
            "password_hash": hash_password(req.password),
            "created_at": now,
            "last_login": None,
            "failed_attempts": 0,
            "locked_until": None,
        }
    )
    access = create_access_token(user_id)
    refresh, jti = create_refresh_token(user_id)
    expire_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    await db.refresh_tokens.insert_one(
        {"jti": jti, "user_id": user_id, "expires_at": expire_at}
    )
    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": {
            "id": user_id,
            "email": req.email.lower().strip(),
            "name": req.name.strip(),
        },
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(
        key=f"login:{client_ip}",
        limit=settings.rate_limit_login,
        window_seconds=settings.rate_limit_window_seconds,
    )
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user = await db.users.find_one({"email": req.email.lower().strip()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": now, "failed_attempts": 0}},
    )
    access = create_access_token(user["id"])
    refresh, jti = create_refresh_token(user["id"])
    expire_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    await db.refresh_tokens.insert_one(
        {"jti": jti, "user_id": user["id"], "expires_at": expire_at}
    )
    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
        },
    }


@router.post("/refresh")
async def refresh(req: RefreshRequest):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    jti = payload.get("jti")
    stored = await db.refresh_tokens.find_one({"jti": jti})
    if not stored:
        raise HTTPException(
            status_code=401, detail="Refresh token revoked or not found"
        )
    await db.refresh_tokens.delete_one({"jti": jti})
    new_access = create_access_token(payload["sub"])
    new_refresh, new_jti = create_refresh_token(payload["sub"])
    expire_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    await db.refresh_tokens.insert_one(
        {
            "jti": new_jti,
            "user_id": payload["sub"],
            "expires_at": expire_at,
        }
    )
    return {"access_token": new_access, "refresh_token": new_refresh}


@router.post("/logout")
async def logout(req: RefreshRequest):
    payload = decode_token(req.refresh_token)
    if payload:
        jti = payload.get("jti")
        db = get_db()
        if db is not None and jti:
            await db.refresh_tokens.delete_one({"jti": jti})
    return {"message": "Logged out"}