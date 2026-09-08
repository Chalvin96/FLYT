from datetime import timedelta

import pytest

from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link.types import PendingAuthorization
from flyt.libs.utils.date import now

pytestmark = pytest.mark.anyio

MIN_PENDING_TTL_SECONDS = 590
MAX_PENDING_TTL_SECONDS = 600
EXPECTED_REDIS_POOL_MAX_SIZE = 4


class FakeCache:
    def __init__(self) -> None:
        self.entries: dict[str, tuple[dict, int]] = {}

    async def set(self, key: str, value: dict, ttl: int) -> None:
        self.entries[key] = (value, ttl)

    async def get(self, key: str) -> dict | None:
        entry = self.entries.get(key)
        return entry[0] if entry else None

    async def delete(self, key: str) -> None:
        self.entries.pop(key, None)


@pytest.fixture
def cache(monkeypatch: pytest.MonkeyPatch) -> FakeCache:
    fake = FakeCache()
    monkeypatch.setattr(pending_store, "_pending_cache", lambda: fake)
    return fake


def _pending(minutes: float = 10, model_key: str | None = None) -> PendingAuthorization:
    return PendingAuthorization(
        device_auth_id="deviceauth_1",
        user_code="QYTZ-WD1Q4",
        expires_at=now() + timedelta(minutes=minutes),
        model_key=model_key,
    )


async def test_pending_store_given_written_authorization_expect_round_trip(
    cache: FakeCache,
) -> None:
    written = _pending(model_key="gpt-5.6-luna")

    await pending_store.write(42, written)

    assert await pending_store.read(42) == written


async def test_pending_store_given_ten_minute_code_expect_matching_ttl(
    cache: FakeCache,
) -> None:
    await pending_store.write(42, _pending(minutes=10))

    _, ttl = cache.entries["42"]
    assert MIN_PENDING_TTL_SECONDS <= ttl <= MAX_PENDING_TTL_SECONDS


async def test_pending_store_given_lapsed_code_expect_positive_ttl(
    cache: FakeCache,
) -> None:
    await pending_store.write(42, _pending(minutes=-5))

    _, ttl = cache.entries["42"]
    assert ttl == 1


async def test_pending_store_given_cleared_user_expect_none(cache: FakeCache) -> None:
    await pending_store.write(42, _pending())

    await pending_store.clear(42)

    assert await pending_store.read(42) is None


async def test_pending_store_given_unknown_user_expect_none(cache: FakeCache) -> None:
    assert await pending_store.read(999) is None


def test_pending_store_given_redis_url_with_query_expect_namespace_preserved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        pending_store.settings, "REDIS_URL", "redis://localhost:6379/0?pool_max_size=4"
    )

    built = pending_store._pending_cache()

    assert built.namespace == pending_store.NAMESPACE
    assert built.pool_max_size == EXPECTED_REDIS_POOL_MAX_SIZE
