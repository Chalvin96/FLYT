"""Shared contracts and failure handling for text-generation providers."""

from abc import ABC
from abc import abstractmethod
from dataclasses import dataclass
from enum import StrEnum

import httpx


class ProviderFailureClass(StrEnum):
    AUTHENTICATION = "authentication"
    TIMEOUT = "timeout"
    UPSTREAM_REFUSAL = "upstream_refusal"
    REQUEST_REJECTED = "request_rejected"
    MODEL_UNAVAILABLE = "model_unavailable"
    TRANSIENT = "transient"


class ProviderFailure(Exception):
    failure_class: ProviderFailureClass

    def __init__(
        self,
        failure_class: ProviderFailureClass,
        message: str = "",
        *,
        upstream_identifier: str | None = None,
    ) -> None:
        self.failure_class = failure_class
        self.upstream_identifier = upstream_identifier
        super().__init__(message or failure_class.value)


@dataclass(frozen=True)
class GenerationRequest:
    instructions: str
    prompt: str
    max_tokens: int | None = None


@dataclass(frozen=True)
class GenerationResult:
    text: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cost: float | None = None
    reasoning_tokens: int | None = None


@dataclass(frozen=True)
class ProviderAvailability:
    available: bool
    reason: str | None = None
    action: str | None = None


@dataclass(frozen=True)
class ProviderChoice:
    name: str
    model: str
    available: bool
    limited_by_flyt: bool
    reason: str | None = None
    action: str | None = None


class ModelProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def model(self) -> str: ...

    async def model_for(self, user_id: int) -> str:
        """Model actually used for a learner, if the provider varies by learner."""
        return self.model

    @abstractmethod
    async def is_available(self, user_id: int) -> ProviderAvailability: ...

    @abstractmethod
    async def generate(
        self,
        user_id: int,
        request: GenerationRequest,
    ) -> GenerationResult: ...


_STATUS_FAILURE_CLASS: dict[int, ProviderFailureClass] = {
    401: ProviderFailureClass.AUTHENTICATION,
    403: ProviderFailureClass.UPSTREAM_REFUSAL,
    404: ProviderFailureClass.MODEL_UNAVAILABLE,
    408: ProviderFailureClass.TIMEOUT,
    413: ProviderFailureClass.REQUEST_REJECTED,
    429: ProviderFailureClass.TRANSIENT,
    500: ProviderFailureClass.TRANSIENT,
    502: ProviderFailureClass.TRANSIENT,
    503: ProviderFailureClass.TRANSIENT,
    504: ProviderFailureClass.TIMEOUT,
}


def _raise_provider_failure(response: httpx.Response, provider: str) -> None:
    status = response.status_code
    upstream_id = _extract_upstream_identifier(response)
    failure_class = _STATUS_FAILURE_CLASS.get(status)
    if failure_class is None:
        raise ProviderFailure(
            ProviderFailureClass.TRANSIENT,
            f"{provider} returned unmapped status {status}",
            upstream_identifier=upstream_id or str(status),
        )
    raise ProviderFailure(
        failure_class,
        f"{provider} returned status {status}",
        upstream_identifier=upstream_id,
    )


def _extract_upstream_identifier(response: httpx.Response) -> str | None:
    try:
        body = response.json()
    except ValueError:
        return None
    return _extract_upstream_identifier_from_body(body)


def _extract_upstream_identifier_from_body(body: object) -> str | None:
    if not isinstance(body, dict):
        return None
    error = body.get("error")
    if isinstance(error, dict):
        for key in ("code", "type", "message"):
            val = error.get(key)
            if isinstance(val, str) and val:
                return val
            if key == "code" and isinstance(val, int) and not isinstance(val, bool):
                return str(val)
    return None


def _safe_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    return None


def _safe_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None
