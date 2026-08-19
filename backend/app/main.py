 from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import PlainTextResponse
from contextlib import asynccontextmanager
import time
import uuid
import logging

from app.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.core.logging_config import configure_logging, set_request_id, set_user_id
from app.core.exceptions import register_exception_handlers
from app.core import metrics
from app.routers import questions, evaluate, simulate, reports, integrity
from app.routers import mlim, stream, privacy
from app.auth.router import router as auth_router
from app.config import settings

configure_logging()
logger = logging.getLogger(__name__)

_PROCESS_START_TIME = time.time()
_APP_VERSION = "3.2.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await close_db()
    await close_redis()


app = FastAPI(title="InterviewIQ API", version=_APP_VERSION, lifespan=lifespan)

register_exception_handlers(app)

origins = [o.strip() for o in settings.allowed_origins.split(",")]
hosts = [h.strip() for h in settings.allowed_hosts.split(",")]

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=hosts,
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
    start_time = time.perf_counter()
    response: Response = None
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration = time.perf_counter() - start_time
        route = request.scope.get("route")
        route_path = route.path if route is not None else request.url.path
        try:
            metrics.record_request(request.method, route_path, status_code, duration)
        except Exception:
            logger.warning("Failed to record request metrics", exc_info=True)
        if response is not None:
            response.headers["X-Request-ID"] = request_id


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
app.include_router(privacy.router)


if settings.metrics_enabled:
    @app.get("/metrics")
    async def get_metrics():
        return PlainTextResponse(
            metrics.render_prometheus_text(),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )


@app.get("/health")
async def health():
    from app.database import get_db
    from app.core.redis_client import get_redis
    db_ok = get_db() is not None
    redis_ok = get_redis() is not None
    groq_configured = bool(settings.groq_api_key)
    uptime_seconds = time.time() - _PROCESS_START_TIME
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "redis": redis_ok,
        "version": _APP_VERSION,
        "groq_configured": groq_configured,
        "uptime_seconds": round(uptime_seconds, 3),
    }