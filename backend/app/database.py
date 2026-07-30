from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import certifi
import logging

logger = logging.getLogger(__name__)

client = None
db = None


async def connect_db():
    global client, db
    try:
        client = AsyncIOMotorClient(
            settings.mongodb_url,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=30000,
            maxPoolSize=50,
            minPoolSize=5,
        )
        await client.admin.command("ping")
        db = client[settings.db_name]
        await _ensure_indexes()
        logger.info("MongoDB connected and indexes ensured")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        client = None
        db = None


async def _ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sessions.create_index([("user_id", 1), ("created_at", -1)])
    await db.sessions.create_index("id", unique=True)
    await db.reports.create_index([("session_id", 1), ("user_id", 1)], unique=True)
    await db.mlim_analyses.create_index([("session_id", 1), ("user_id", 1)])
    await db.mlim_analyses.create_index("timestamp")
    await db.integrity_events.create_index([("session_id", 1), ("user_id", 1)])
    await db.mlim_escalations.create_index([("user_id", 1), ("status", 1)])
    await db.mlim_escalations.create_index([("session_id", 1)])
    await db.mlim_escalations.create_index("created_at")
    await db.mlim_fairness_probes.create_index([("run_at", -1)])
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.sessions.create_index("created_at", expireAfterSeconds=60 * 60 * 24 * 90)


async def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_db():
    return db