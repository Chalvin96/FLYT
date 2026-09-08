from unittest.mock import AsyncMock

import pytest

from flyt.core.base import Base
from flyt import main


@pytest.mark.anyio
async def test_application_lifespan_given_runtime_dependencies_expect_no_schema_creation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("application startup must not create database tables")

    def fake_rate_limiter(
        _cls: type[object],
        *_args: object,
        **_kwargs: object,
    ) -> object:
        return object()

    monkeypatch.setattr(Base.metadata, "create_all", fail_if_called)
    monkeypatch.setattr(
        main.MovingWindowRateLimiter,
        "from_redis_url",
        classmethod(fake_rate_limiter),
    )
    monkeypatch.setattr(main, "close_redis", AsyncMock())

    async with main.lifespan(main.app):
        pass
