from fastapi import APIRouter, HTTPException, status, Request, Response
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
import re

router = APIRouter(prefix="/api/auth", tags=["auth"])

ACCESS_COOKIE = "rr_access_token"
REFRESH_COOKIE = "rr_refresh_token"


def _cookie_secure() -> bool:
    return settings.environment != "development"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = _cookie_secure()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        httponly=True,
        secure=secure,
        samesite="strict",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=secure,
        samesite="strict",
    )


def clear_auth_cookies(response: Response) -> None:
    secure = _cookie_secure()
    response.delete_cookie(key=ACCESS_COOKIE, path="/", secure=secure, samesite="strict")
    response.delete_cookie(key=REFRESH_COOKIE, path="/", secure=secure, samesite="strict")


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(
        key=f"register:{client_ip}",
        limit=10,
        window_seconds=3600,
    )
    validate_password(req.password)
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
    expire_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    await db.refresh_tokens.insert_one(
        {"jti": jti, "user_id": user_id, "expires_at": expire_at}
    )
    set_auth_cookies(response, access, refresh)
    return {
        "access_token": access,
        "user": {
            "id": user_id,
            "email": req.email.lower().strip(),
            "name": req.name.strip(),
        },
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
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
    expire_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    await db.refresh_tokens.insert_one(
        {"jti": jti, "user_id": user["id"], "expires_at": expire_at}
    )
    set_auth_cookies(response, access, refresh)
    return {
        "access_token": access,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
        },
    }


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    jti = payload.get("jti")
    stored = await db.refresh_tokens.find_one({"jti": jti})
    if not stored:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh token revoked or not found")
    await db.refresh_tokens.delete_one({"jti": jti})
    new_access = create_access_token(payload["sub"])
    new_refresh, new_jti = create_refresh_token(payload["sub"])
    expire_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    await db.refresh_tokens.insert_one(
        {"jti": new_jti, "user_id": payload["sub"], "expires_at": expire_at}
    )
    set_auth_cookies(response, new_access, new_refresh)
    return {"access_token": new_access}


@router.post("/logout")
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        payload = decode_token(refresh_token)
        if payload:
            jti = payload.get("jti")
            db = get_db()
            if db is not None and jti:
                await db.refresh_tokens.delete_one({"jti": jti})
    clear_auth_cookies(response)
    return {"message": "Logged out"}