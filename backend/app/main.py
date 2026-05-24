from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_db, close_db
from app.routers import questions, evaluate, simulate, reports
from app.routers import mlim
from app.auth.router import router as auth_router
from app.config import settings

app = FastAPI(title="RoleReady API", version="3.0.0")

origins = [o.strip() for o in settings.allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(questions.router)
app.include_router(evaluate.router)
app.include_router(simulate.router)
app.include_router(reports.router)
app.include_router(mlim.router)


@app.on_event("startup")
async def startup():
    await connect_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}