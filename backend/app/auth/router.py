from fastapi import APIRouter, HTTPException, status, Request, Response, Depends
from pydantic import BaseModel
from app.database import get_db
from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.auth.dependencies import get_current_user
from app.core.rate_limiter import check_rate_limit
from app.core.logging_config import set_user_id
from app.config import settings
from datetime import datetime, timezone, timedelta
from pymongo import ReturnDocument
import logging
import uuid
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

ACCESS_COOKIE = "rr_access_token"
REFRESH_COOKIE = "rr_refresh_token"

GENERIC_INVALID_CREDENTIALS_MESSAGE = "Invalid credentials"


def _cookie_settings() -> tuple[bool, str]:
    if settings.environment == "development":
        return False, "lax"
    return True, "none"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure, samesite = _cookie_settings()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def clear_auth_cookies(response: Response) -> None:
    secure, samesite = _cookie_settings()
    response.delete_cookie(key=ACCESS_COOKIE, path="/", secure=secure, samesite=samesite)
    response.delete_cookie(key=REFRESH_COOKIE, path="/", secure=secure, samesite=samesite)


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")


def _parse_locked_until(locked_until) -> "datetime | None":
    if not locked_until:
        return None
    if isinstance(locked_until, datetime):
        dt = locked_until
    else:
        try:
            dt = datetime.fromisoformat(str(locked_until))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, request: Request, response: Response):
    client_ip = get_client_ip(request)
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
    client_ip = get_client_ip(request)
    await check_rate_limit(
        key=f"login:{client_ip}",
        limit=settings.rate_limit_login,
        window_seconds=settings.rate_limit_window_seconds,
    )
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user = await db.users.find_one({"email": req.email.lower().strip()})

    if user:
        locked_until_dt = _parse_locked_until(user.get("locked_until"))
        if locked_until_dt and locked_until_dt > datetime.now(timezone.utc):
            remaining_seconds = int((locked_until_dt - datetime.now(timezone.utc)).total_seconds())
            remaining_minutes = max(1, (remaining_seconds + 59) // 60)
            logger.warning(
                "Login blocked: account temporarily locked",
                extra={"locked_user_id": user["id"]},
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account temporarily locked due to too many failed login attempts. Try again in {remaining_minutes} minute(s).",
            )

    if not user or not verify_password(req.password, user["password_hash"]):
        if user:
            updated_user = await db.users.find_one_and_update(
                {"id": user["id"]},
                {"$inc": {"failed_attempts": 1}},
                return_document=ReturnDocument.AFTER,
            )
            new_failed_attempts = int((updated_user or {}).get("failed_attempts") or 0)
            if new_failed_attempts >= settings.account_lockout_threshold:
                lockout_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.account_lockout_duration_minutes
                )
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"locked_until": lockout_until.isoformat()}},
                )
                logger.warning(
                    "Account locked after repeated failed login attempts",
                    extra={"locked_user_id": user["id"]},
                )
        raise HTTPException(status_code=401, detail=GENERIC_INVALID_CREDENTIALS_MESSAGE)

    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": now, "failed_attempts": 0, "locked_until": None}},
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
        user_id = payload.get("sub")
        if user_id:
            logger.warning(
                "Refresh token reuse detected; revoking all sessions for user",
                extra={"reused_token_user_id": user_id},
            )
            await db.refresh_tokens.delete_many({"user_id": user_id})
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

@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": current_user["name"],
        }
    }

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


@router.post("/logout-all")
async def logout_all(
    request: Request, response: Response, current_user: dict = Depends(get_current_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    set_user_id(current_user["id"])
    result = await db.refresh_tokens.delete_many({"user_id": current_user["id"]})
    logger.info(
        "User revoked all sessions",
        extra={"revoked_sessions_user_id": current_user["id"], "revoked_count": result.deleted_count},
    )
    clear_auth_cookies(response)
    return {"message": "Signed out of all devices", "revoked_count": result.deleted_count}