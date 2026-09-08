"""Background job queue (arq / Redis).

Minimal arq wrapper: a single pool, an ``enqueue_job`` helper, and a
``close_arq_pool`` for graceful shutdown.
"""

from __future__ import annotations

import asyncio
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis
from arq.connections import RedisSettings

from flyt.core.config import settings

_pool: ArqRedis | None = None
_lock = asyncio.Lock()


def redis_settings() -> RedisSettings:
    """Single source of truth for Redis connection settings.

    Both the enqueue pool (API side) and the arq worker must derive their
    connection from this, or they will silently talk to different Redis
    instances (API enqueues to ``REDIS_URL``, worker listens on localhost).
    """
    return RedisSettings.from_dsn(settings.REDIS_URL)


async def _get_pool() -> ArqRedis:
    global _pool
    async with _lock:
        if _pool is None:
            _pool = await create_pool(redis_settings())
    return _pool


async def enqueue_job(name: str, *args: Any) -> None:
    pool = await _get_pool()
    await pool.enqueue_job(name, *args)


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
