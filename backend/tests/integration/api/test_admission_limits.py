from http import HTTPStatus
from uuid import uuid4

import pytest
from httpx import ASGITransport
from httpx import AsyncClient
from limits.aio.storage import MemoryStorage

from flyt.core.rate_limit import MovingWindowRateLimiter
from flyt.main import app
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize(
    ("path", "body", "limiter_name", "error_code"),
    [
        ("/imports", {"text": " "}, "import_rate_limiter", "IMPORT_RATE_LIMITED"),
        (
            "/imports/extension",
            {"text": " ", "source_url": "https://example.com"},
            "import_rate_limiter",
            "IMPORT_RATE_LIMITED",
        ),
        (
            f"/imports/{uuid4()}/retry",
            None,
            "import_rate_limiter",
            "IMPORT_RATE_LIMITED",
        ),
        (
            "/story-generation/generations",
            {"provider": "openrouter", "anchor": "frequency", "length": 250},
            "generation_rate_limiter",
            "GENERATION_RATE_LIMITED",
        ),
        (
            "/story-generation/generations/current/import",
            {},
            "import_rate_limiter",
            "IMPORT_RATE_LIMITED",
        ),
    ],
)
async def test_work_admission_given_exhausted_user_window_expect_429_and_independent_users(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    body: dict | None,
    limiter_name: str,
    error_code: str,
) -> None:
    monkeypatch.setattr(
        app.state,
        limiter_name,
        MovingWindowRateLimiter(MemoryStorage(), 1, 60),
        raising=False,
    )
    user = await UserFactory.create()
    other = await UserFactory.create()
    await authenticate(client, user)

    first = await client.post(path, json=body)
    second = await client.post(path, json=body)
    await authenticate(client, other)
    independent = await client.post(path, json=body)

    assert first.status_code in {
        HTTPStatus.NOT_FOUND,
        HTTPStatus.UNPROCESSABLE_ENTITY,
        HTTPStatus.CONFLICT,
    }
    assert second.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert second.json()["detail"]["code"] == error_code
    assert int(second.headers["Retry-After"]) >= 1
    assert independent.status_code == first.status_code


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/lexicons/resolve", {"word": "ukjent"}),
        ("/lexicons/suggestions", {"query": "ukjent"}),
        ("/lexicons/search", {"query": "ukjent"}),
        ("/lexicons/browse", {"q": "ukjent"}),
        (f"/lexicons/lemmas/{uuid4()}/definitions", {}),
    ],
)
async def test_lexicon_admission_given_exhausted_ip_window_expect_429_and_independent_ips(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    params: dict[str, str],
) -> None:
    monkeypatch.setattr(
        app.state,
        "lexicon_rate_limiter",
        MovingWindowRateLimiter(MemoryStorage(), 1, 60),
        raising=False,
    )

    first = await client.get(path, params=params)
    second = await client.get(
        path, params=params, headers={"X-Forwarded-For": "192.0.2.5"}
    )
    async with AsyncClient(
        transport=ASGITransport(app=app, client=("192.0.2.6", 1234)),
        base_url="http://test",
    ) as other:
        independent = await other.get(path, params=params)

    assert first.status_code in {HTTPStatus.OK, HTTPStatus.NOT_FOUND}
    assert second.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert second.json()["detail"]["code"] == "LEXICON_RATE_LIMITED"
    assert int(second.headers["Retry-After"]) >= 1
    assert independent.status_code == first.status_code


async def test_lexicon_admission_given_signed_in_users_behind_one_ip_expect_independent_windows(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app.state,
        "lexicon_rate_limiter",
        MovingWindowRateLimiter(MemoryStorage(), 1, 60),
        raising=False,
    )
    user = await UserFactory.create()
    other = await UserFactory.create()
    params = {"word": "ukjent"}

    await authenticate(client, user)
    first = await client.get("/lexicons/resolve", params=params)
    second = await client.get("/lexicons/resolve", params=params)
    await authenticate(client, other)
    other_user = await client.get("/lexicons/resolve", params=params)

    assert second.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert other_user.status_code == first.status_code
