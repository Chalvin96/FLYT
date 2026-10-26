from http import HTTPStatus
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel

from flyt.core.exceptions import DomainException


def error_response(code: str, message: str, error: str | None = None) -> dict:
    return {"code": code, "message": message, "error": error}


def http_error(error: DomainException) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail=error_response(error.code, error.message),
    )


class EmptyResponse(BaseModel):
    pass


class ErrorDetail(BaseModel):
    code: str
    message: str
    error: str | None


class ErrorResponse(BaseModel):
    detail: ErrorDetail


class RequestValidationIssue(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class RequestValidationErrorResponse(BaseModel):
    detail: list[RequestValidationIssue]


# Python's HTTPStatus phrases differ between versions (3.12 says "Request
# Entity Too Large"); the OpenAPI schema must not depend on the interpreter.
K_ERROR_DESCRIPTIONS: dict[int, str] = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    413: "Content Too Large",
    422: "Unprocessable Content",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
}


def build_error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    return {
        status_code: {
            "model": (
                ErrorResponse | RequestValidationErrorResponse
                if status_code == HTTPStatus.UNPROCESSABLE_ENTITY
                else ErrorResponse
            ),
            "description": K_ERROR_DESCRIPTIONS[status_code],
        }
        for status_code in status_codes
    }
