import pytest
from limits.aio.storage import MemoryStorage
from limits.aio.storage import RedisStorage

from flyt.core.rate_limit import MovingWindowRateLimiter
from flyt.core.rate_limit import REDIS_TIMEOUT_SECONDS

pytestmark = pytest.mark.anyio


async def test_moving_window_rate_limiter_given_capacity_expect_admission_then_retry() -> (
    None
):
    limiter = MovingWindowRateLimiter(
        MemoryStorage(), max_requests=2, window_seconds=60
    )

    assert await limiter.check("user-1") is None
    assert await limiter.check("user-1") is None

    retry_after = await limiter.check("user-1")

    assert retry_after is not None
    assert retry_after >= 1


async def test_moving_window_rate_limiter_given_independent_keys_expect_separate_windows() -> (
    None
):
    limiter = MovingWindowRateLimiter(
        MemoryStorage(), max_requests=1, window_seconds=60
    )

    assert await limiter.check("user-a") is None
    assert await limiter.check("user-b") is None
    assert await limiter.check("user-a") is not None


async def test_moving_window_rate_limiter_given_storage_error_expect_fail_open() -> (
    None
):
    class BoomStorage(MemoryStorage):
        async def acquire_entry(self, *args: object, **kwargs: object) -> bool:
            raise RuntimeError("redis down")

    limiter = MovingWindowRateLimiter(BoomStorage(), max_requests=1, window_seconds=60)

    assert await limiter.check("user-1") is None


async def test_moving_window_rate_limiter_given_retry_stats_error_expect_one_second_hint() -> (
    None
):
    class StatsBoomStorage(MemoryStorage):
        async def get_moving_window(
            self, *args: object, **kwargs: object
        ) -> tuple[float, int]:
            raise RuntimeError("redis down")

    limiter = MovingWindowRateLimiter(
        StatsBoomStorage(), max_requests=1, window_seconds=60
    )

    assert await limiter.check("user-1") is None
    assert await limiter.check("user-1") == 1


async def test_moving_window_rate_limiter_given_redis_url_expect_configured_storage() -> (
    None
):
    limiter = MovingWindowRateLimiter.from_redis_url(
        "rediss://localhost:6379/2",
        max_requests=1,
        window_seconds=60,
        namespace="flyt:test",
    )

    storage = limiter._storage
    assert isinstance(storage, RedisStorage)
    assert storage.bridge.key_prefix == "flyt:test"
    assert storage.bridge.uri == "rediss://localhost:6379/2"
    assert storage.options == {
        "socket_connect_timeout": REDIS_TIMEOUT_SECONDS,
        "socket_timeout": REDIS_TIMEOUT_SECONDS,
    }
