import time
import logging
from fastapi import HTTPException
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_memory_attempts: dict[str, list[float]] = {}
_last_sweep: float = time.time()
_SWEEP_INTERVAL_SECONDS = 300


def _sweep_memory_attempts(window_seconds: int) -> None:
    global _last_sweep
    now = time.time()
    if now - _last_sweep < _SWEEP_INTERVAL_SECONDS:
        return
    _last_sweep = now
    stale_keys = [
        k for k, attempts in _memory_attempts.items()
        if not any(now - t < window_seconds for t in attempts)
    ]
    for k in stale_keys:
        _memory_attempts.pop(k, None)


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
                retry_after = ttl if ttl and ttl > 0 else window_seconds
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many attempts. Try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis rate limit check failed, degrading to in-memory enforcement: {e}")

    _sweep_memory_attempts(window_seconds)
    now = time.time()
    attempts = [t for t in _memory_attempts.get(key, []) if now - t < window_seconds]
    if len(attempts) >= limit:
        _memory_attempts[key] = attempts
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again later.",
            headers={"Retry-After": str(window_seconds)},
        )
    attempts.append(now)
    _memory_attempts[key] = attempts