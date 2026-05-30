import time
import logging
from fastapi import HTTPException
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_memory_attempts: dict[str, list[float]] = {}


async def check_rate_limit(
    key: str,
    limit: int = 5,
    window_seconds: int = 60,
) -> None:
    redis = get_redis()

    if redis is not None:
        try:
            redis_key = f"rate_limit:{key}"
            count = await redis.incr(redis_key)
            if count == 1:
                await redis.expire(redis_key, window_seconds)
            if count > limit:
                ttl = await redis.ttl(redis_key)
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many attempts. Try again in {ttl} seconds.",
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis rate limit check failed, falling back to memory: {e}")

    now = time.time()
    attempts = [t for t in _memory_attempts.get(key, []) if now - t < window_seconds]
    if len(attempts) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again later.",
        )
    attempts.append(now)
    _memory_attempts[key] = attempts