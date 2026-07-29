from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import uuid
import logging

from app.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.core.logging_config import configure_logging, set_request_id, set_user_id
from app.core.exceptions import register_exception_handlers
from app.routers import questions, evaluate, simulate, reports, integrity
from app.routers import mlim, stream
from app.auth.router import router as auth_router
from app.config import settings

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await close_db()
    await close_redis()


app = FastAPI(title="PrepVision API", version="3.2.0", lifespan=lifespan)

register_exception_handlers(app)

origins = [o.strip() for o in settings.allowed_origins.split(",")]

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "prepvision.ai", "api.prepvision.ai", "*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    set_request_id(request_id)
    set_user_id(None)
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.include_router(auth_router)
app.include_router(questions.router)
app.include_router(evaluate.router)
app.include_router(simulate.router)
app.include_router(reports.router)
app.include_router(mlim.router)
app.include_router(integrity.router)
app.include_router(stream.router)


@app.get("/health")
async def health():
    from app.database import get_db
    from app.core.redis_client import get_redis
    db_ok = get_db() is not None
    redis_ok = get_redis() is not None
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "redis": redis_ok,
        "version": "3.2.0",
    }