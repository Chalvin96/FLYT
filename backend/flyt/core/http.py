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
