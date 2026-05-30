from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.routers import questions, evaluate, simulate, reports, integrity
from app.routers import mlim, stream
from app.auth.router import router as auth_router
from app.config import settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await close_db()
    await close_redis()


app = FastAPI(title="RoleReady API", version="3.2.0", lifespan=lifespan)

origins = [o.strip() for o in settings.allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

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