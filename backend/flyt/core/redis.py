"""Shared async Redis client for ephemeral story-generation slots.

One client per process, derived from ``REDIS_URL`` like the arq pool in
``core.queue``, with a ``close_redis`` for graceful shutdown.
"""

from collections.abc import Awaitable
from typing import cast

import redis.asyncio as aioredis

from flyt.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL)
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


def as_awaitable[T](value: Awaitable[T] | T) -> Awaitable[T]:
    return cast(Awaitable[T], value)
