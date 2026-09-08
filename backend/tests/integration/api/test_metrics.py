"""Integration tests for the Prometheus ``/metrics`` endpoint.

Covers token-gated access (valid token -> exposition, missing/wrong token ->
401), the ``METRICS_ENABLED=False`` gate (route absent -> 404), and the
access-log exclusion for ``/metrics`` and ``/health/*`` paths.
"""

import logging
from http import HTTPStatus

import pytest
from fastapi import FastAPI
from httpx import ASGITransport
from httpx import AsyncClient

from flyt.core.config import settings
from flyt.main import configure_metrics

pytestmark = pytest.mark.anyio


async def test_metrics_given_valid_token_expect_prometheus_exposition(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "METRICS_TOKEN", "test-metrics-token")

    # Make at least one request so the instrumentator records samples.
    await client.get("/")

    response = await client.get(
        "/metrics",
        headers={"Authorization": "Bearer test-metrics-token"},
    )

    assert response.status_code == HTTPStatus.OK
    assert "# HELP" in response.text or "http_" in response.text


async def test_metrics_given_missing_token_expect_unauthorized(
    client: AsyncClient,
) -> None:
    # In the test environment METRICS_TOKEN is None, so /metrics is 401.
    response = await client.get("/metrics")

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_metrics_given_wrong_token_expect_unauthorized(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "METRICS_TOKEN", "real-token")

    response = await client.get(
        "/metrics",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_metrics_given_disabled_expect_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "METRICS_ENABLED", False)
    app = FastAPI()
    configure_metrics(app)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        response = await ac.get("/metrics")

    assert response.status_code == HTTPStatus.NOT_FOUND


async def test_access_log_given_metrics_path_expect_skipped(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.INFO, logger="flyt.access"):
        await client.get("/metrics")

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 0


async def test_access_log_given_health_path_expect_skipped(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.INFO, logger="flyt.access"):
        await client.get("/health/live")

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 0


async def test_access_log_given_normal_path_expect_logged(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Smoke test: non-excluded paths still produce an access log record."""
    with caplog.at_level(logging.INFO, logger="flyt.access"):
        await client.get("/")

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 1
    assert access_records[0].route_path == "/"
