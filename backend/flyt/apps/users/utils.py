from fastapi import Response

from flyt.core.config import settings


def set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.ACCESS_COOKIE_SECURE,
        samesite=settings.ACCESS_COOKIE_SAMESITE,
        domain=settings.ACCESS_COOKIE_DOMAIN,
        path=settings.ACCESS_COOKIE_PATH,
        max_age=settings.ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )


def clear_access_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        path=settings.ACCESS_COOKIE_PATH,
        domain=settings.ACCESS_COOKIE_DOMAIN,
    )
