from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.auth.service import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
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
async def register(req: RegisterRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": req.email,
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    })
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    return {"access_token": access, "refresh_token": refresh, "user": {"id": user_id, "email": req.email, "name": req.name}}


@router.post("/login")
async def login(req: LoginRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user = await db.users.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": __import__("datetime").datetime.utcnow().isoformat()}})
    access = create_access_token(user["id"])
    refresh = create_refresh_token(user["id"])
    return {"access_token": access, "refresh_token": refresh, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@router.post("/refresh")
async def refresh(req: RefreshRequest):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access = create_access_token(payload["sub"])
    return {"access_token": access}


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}