import json
from typing import Any
from collections.abc import Container
from typing import Self


class ErrorResponse:
    """Error codes a provider error response carries, most specific first."""

    def __init__(self, codes: list[str]) -> None:
        self._codes = codes

    @classmethod
    def parse(cls, body: str) -> Self:
        try:
            payload = json.loads(body)
        except ValueError:
            return cls([])
        if not isinstance(payload, dict):
            return cls([])
        codes = []
        error = payload.get("error")
        if isinstance(error, dict):
            codes.extend(_string_values(error, ("code", "type")))
        codes.extend(_string_values(payload, ("code", "error")))
        return cls(codes)

    def __bool__(self) -> bool:
        return bool(self._codes)

    @property
    def first(self) -> str | None:
        return self._codes[0] if self._codes else None

    def first_in(self, known: Container[str]) -> str | None:
        return next((code for code in self._codes if code in known), None)


def _string_values(source: dict[str, Any], keys: tuple[str, ...]) -> list[str]:
    return [
        value for key in keys if isinstance(value := source.get(key), str) and value
    ]
