import redis.asyncio as aioredis
from app.config import settings
import logging

logger = logging.getLogger(__name__)

_redis_client = None


async def connect_redis() -> None:
    global _redis_client
    try:
        client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        await client.ping()
        _redis_client = client
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.warning(f"Redis unavailable, falling back to in-memory rate limiting: {e}")
        _redis_client = None


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")


def get_redis():
    return _redis_client