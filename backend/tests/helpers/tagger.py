"""Shared fakes for flyt-tagger tests (unit + integration)."""

import pytest

from flyt.clients import tagger as tagger_mod


class FakeTaggerResponse:
    """Minimal fake of an httpx Response for flyt-tagger tests."""

    def __init__(self, status_code: int = 200, payload: object | None = None) -> None:
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self) -> object:
        return self._payload


class FakeTaggerClient:
    """Minimal fake of httpx.AsyncClient for flyt-tagger tests."""

    def __init__(
        self,
        response: FakeTaggerResponse | None = None,
        exc: Exception | None = None,
    ) -> None:
        self._response = response
        self._exc = exc

    async def __aenter__(self) -> "FakeTaggerClient":
        return self

    async def __aexit__(self, *_args: object) -> bool:
        return False

    async def post(self, url: str, **kwargs: object) -> FakeTaggerResponse:
        if self._exc is not None:
            raise self._exc
        return self._response or FakeTaggerResponse()


def install_fake_tagger(
    monkeypatch: pytest.MonkeyPatch,
    response: FakeTaggerResponse | None = None,
    exc: Exception | None = None,
) -> FakeTaggerClient:
    """Monkeypatch httpx.AsyncClient in the tagger client and return the fake."""
    fake = FakeTaggerClient(response=response, exc=exc)
    monkeypatch.setattr(tagger_mod.httpx, "AsyncClient", lambda **_: fake)
    return fake
