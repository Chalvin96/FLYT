"""Shared per-user moving-window admission over Redis.

The write-judge endpoint and the speech proxy use the same admission
contract: a bounded rolling window per authenticated user, ``None`` while
admitted, and a whole-second ``Retry-After`` hint once exhausted. Storage
errors fail open so a Redis outage never takes a learner-facing endpoint
down.
"""

from __future__ import annotations

import logging
from math import ceil
from time import time

from limits import RateLimitItemPerSecond
from limits.aio.storage import RedisStorage
from limits.aio.storage import Storage
from limits.aio.strategies import (
    MovingWindowRateLimiter as LimitsMovingWindowRateLimiter,
)

logger = logging.getLogger(__name__)

REDIS_TIMEOUT_SECONDS = 1.0


def ensure_async_redis_scheme(redis_url: str) -> str:
    if redis_url.startswith(("redis://", "rediss://")):
        return f"async+{redis_url}"
    return redis_url


class MovingWindowRateLimiter:
    def __init__(
        self,
        storage: Storage,
        max_requests: int,
        window_seconds: float,
    ) -> None:
        self.max_requests = max(1, max_requests)
        self.window_seconds = max(1.0, window_seconds)
        self._storage = storage
        self._limiter = LimitsMovingWindowRateLimiter(storage)
        self._item = RateLimitItemPerSecond(
            self.max_requests, max(1, ceil(self.window_seconds))
        )

    @classmethod
    def from_redis_url(
        cls,
        redis_url: str,
        max_requests: int,
        window_seconds: float,
        *,
        namespace: str,
    ) -> MovingWindowRateLimiter:
        storage = RedisStorage(
            ensure_async_redis_scheme(redis_url),
            implementation="redispy",
            key_prefix=namespace,
            socket_connect_timeout=REDIS_TIMEOUT_SECONDS,
            socket_timeout=REDIS_TIMEOUT_SECONDS,
        )
        return cls(storage, max_requests, window_seconds)

    async def check(self, user_key: str) -> int | None:
        try:
            allowed = await self._limiter.hit(self._item, user_key)
        except Exception:
            logger.exception("rate limiter storage error; failing open")
            return None
        if allowed:
            return None
        return await self._retry_after_seconds(user_key)

    async def _retry_after_seconds(self, user_key: str) -> int:
        try:
            stats = await self._limiter.get_window_stats(self._item, user_key)
        except Exception:
            logger.exception("rate limiter storage error; retry hint clamped")
            return 1
        return max(1, ceil(stats.reset_time - time()))
