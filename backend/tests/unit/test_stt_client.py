from collections.abc import Callable
from http import HTTPStatus

import httpx
import pytest

from flyt.clients import stt
from flyt.clients.exceptions import SttServiceNotConfiguredError
from flyt.clients.exceptions import SttServicePayloadError
from flyt.clients.exceptions import SttServiceResponseError
from flyt.clients.exceptions import SttServiceTransportError
from flyt.core.config import settings

pytestmark = pytest.mark.anyio

EXPECTED_SEGMENT_END_SECONDS = 1.25


def _transcription_payload() -> dict:
    return {
        "text": "Dette er en test.",
        "language": "no",
        "language_probability": 0.99,
        "duration_seconds": 1.25,
        "segments": [{"start": 0, "end": 1.25, "text": "Dette er en test."}],
    }


def _mock_async_client(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> None:
    class _TransportClient(httpx.AsyncClient):
        def __init__(self, **kwargs: object) -> None:
            super().__init__(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(stt.httpx, "AsyncClient", _TransportClient)


async def test_transcribe_given_service_url_expect_multipart_request_and_typed_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal///")
    recorded: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        recorded["url"] = str(request.url)
        recorded["content_type"] = request.headers["content-type"]
        recorded["body"] = request.content
        return httpx.Response(200, json=_transcription_payload())

    _mock_async_client(monkeypatch, handler)
    result = await stt.transcribe(
        b"audio",
        filename="learner.webm",
        content_type="audio/webm",
    )

    assert recorded["url"] == "http://stt.internal/transcribe"
    assert str(recorded["content_type"]).startswith("multipart/form-data;")
    assert b'name="file"' in recorded["body"]
    assert b'filename="learner.webm"' in recorded["body"]
    assert b"audio/webm" in recorded["body"]
    assert result.text == "Dette er en test."
    assert result.segments[0].text == "Dette er en test."
    assert result.segments[0].end == EXPECTED_SEGMENT_END_SECONDS


async def test_transcribe_given_missing_service_url_expect_configuration_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", None)

    with pytest.raises(SttServiceNotConfiguredError):
        await stt.transcribe(b"audio")


async def test_transcribe_given_transport_failure_expect_transport_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    _mock_async_client(monkeypatch, handler)
    with pytest.raises(SttServiceTransportError):
        await stt.transcribe(b"audio")


@pytest.mark.parametrize("status_code", [413, 422, 503])
async def test_transcribe_given_upstream_error_expect_response_error(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"detail": "error"})

    _mock_async_client(monkeypatch, handler)
    with pytest.raises(SttServiceResponseError) as error:
        await stt.transcribe(b"audio")

    assert error.value.status_code == status_code


async def test_transcribe_given_upstream_retry_hint_expect_response_error_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            503,
            headers={"Retry-After": "4"},
            json={"detail": "busy"},
        )

    _mock_async_client(monkeypatch, handler)
    with pytest.raises(SttServiceResponseError) as error:
        await stt.transcribe(b"audio")

    assert error.value.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert error.value.retry_after == "4"


async def test_transcribe_given_invalid_success_payload_expect_payload_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"text": "missing the rest"})

    _mock_async_client(monkeypatch, handler)
    with pytest.raises(SttServicePayloadError):
        await stt.transcribe(b"audio")


async def test_transcribe_given_non_finite_payload_expect_payload_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "STT_SVC_URL", "http://stt.internal")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text=(
                '{"text": "Dette er en test.", "language": "no", '
                '"language_probability": 0.99, "duration_seconds": Infinity, '
                '"segments": [{"start": 0, "end": 1.25, "text": "Dette er en test."}]}'
            ),
        )

    _mock_async_client(monkeypatch, handler)
    with pytest.raises(SttServicePayloadError):
        await stt.transcribe(b"audio")
