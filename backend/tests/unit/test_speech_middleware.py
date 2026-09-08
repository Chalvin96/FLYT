import json
from collections.abc import Awaitable
from collections.abc import Callable
from http import HTTPStatus

import pytest

from flyt.apps.speech.middleware import SpeechProxyAdmission
from flyt.apps.speech.middleware import SpeechRequestBodyLimitMiddleware

pytestmark = pytest.mark.anyio


def _scope(headers: list[tuple[bytes, bytes]] | None = None) -> dict[str, object]:
    return {
        "type": "http",
        "method": "POST",
        "path": "/speech/transcribe",
        "headers": headers or [],
        "query_string": b"",
        "scheme": "http",
        "server": ("test", 80),
        "client": ("test", 1234),
        "root_path": "",
        "http_version": "1.1",
    }


async def _run(
    middleware: Callable[..., Awaitable[None]],
    messages: list[dict[str, object]],
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
) -> tuple[list[dict[str, object]], bool]:
    sent: list[dict[str, object]] = []
    called = False
    remaining = iter(messages)

    async def receive() -> dict[str, object]:
        try:
            return next(remaining)
        except StopIteration:
            return {"type": "http.disconnect"}

    async def send(message: dict[str, object]) -> None:
        sent.append(message)

    async def app(scope: object, receive: object, send: object) -> None:
        nonlocal called
        called = True
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    await middleware(_scope(headers), receive, send)
    return sent, called


def _response_status(messages: list[dict[str, object]]) -> int:
    return int(messages[0]["status"])


def _response_body(messages: list[dict[str, object]]) -> dict[str, object]:
    return json.loads(messages[-1]["body"])


async def test_request_body_limit_given_content_length_above_limit_expect_413() -> None:
    middleware = SpeechRequestBodyLimitMiddleware(
        lambda scope, receive, send: None,
        max_body_bytes=5,
    )

    sent, called = await _run(
        middleware,
        [],
        headers=[(b"content-length", b"6")],
    )

    assert _response_status(sent) == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert _response_body(sent)["detail"]["code"] == "SPEECH_AUDIO_TOO_LARGE"
    assert called is False


async def test_request_body_limit_given_chunked_body_above_limit_expect_413() -> None:
    called = False

    async def app(scope: object, receive: object, send: object) -> None:
        nonlocal called
        called = True
        while True:
            message = await receive()
            if message["type"] != "http.request" or not message.get("more_body", False):
                break

    middleware = SpeechRequestBodyLimitMiddleware(app, max_body_bytes=5)
    sent, _ = await _run(
        middleware,
        [
            {"type": "http.request", "body": b"123", "more_body": True},
            {"type": "http.request", "body": b"456", "more_body": False},
        ],
    )

    assert _response_status(sent) == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert _response_body(sent)["detail"]["code"] == "SPEECH_AUDIO_TOO_LARGE"
    assert called is True


async def test_speech_admission_given_full_capacity_expect_rejection() -> None:
    admission = SpeechProxyAdmission(capacity=1)
    assert admission.try_acquire() is True
    assert admission.try_acquire() is False
    admission.release()
