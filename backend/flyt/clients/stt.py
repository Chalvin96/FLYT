from http import HTTPStatus

import httpx
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator

from flyt.clients.exceptions import SttServiceNotConfiguredError
from flyt.clients.exceptions import SttServicePayloadError
from flyt.clients.exceptions import SttServiceResponseError
from flyt.clients.exceptions import SttServiceTransportError
from flyt.core.config import settings


class SttSegment(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str

    @model_validator(mode="after")
    def _end_not_before_start(self) -> "SttSegment":
        if self.end < self.start:
            raise ValueError("segment end precedes start")
        return self


class SttTranscription(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    text: str
    language: str
    language_probability: float = Field(ge=0, le=1)
    duration_seconds: float = Field(ge=0)
    segments: list[SttSegment]


def _service_url() -> str:
    if not settings.STT_SVC_URL or not settings.STT_SVC_URL.strip():
        raise SttServiceNotConfiguredError("STT_SVC_URL is not configured")
    return settings.STT_SVC_URL.rstrip("/")


async def transcribe(
    audio: bytes,
    *,
    filename: str = "recording.wav",
    content_type: str = "application/octet-stream",
) -> SttTranscription:
    """Transcribe audio through the configured internal STT service."""

    url = _service_url()
    files = {"file": (filename, audio, content_type)}

    try:
        async with httpx.AsyncClient(
            timeout=settings.STT_SVC_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(f"{url}/transcribe", files=files)
    except httpx.HTTPError as exc:
        raise SttServiceTransportError("STT service request failed") from exc

    if not HTTPStatus.OK <= response.status_code < HTTPStatus.MULTIPLE_CHOICES:
        raise SttServiceResponseError(
            response.status_code,
            retry_after=response.headers.get("Retry-After"),
        )

    try:
        return SttTranscription.model_validate(response.json())
    except ValueError as exc:
        raise SttServicePayloadError("STT response payload is invalid") from exc
