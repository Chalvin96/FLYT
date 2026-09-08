from fastapi import Response

from flyt.apps.users.utils import clear_access_cookie
from flyt.apps.users.utils import set_access_cookie
from flyt.core.config import settings


def test_set_access_cookie_given_token_expect_cookie_configured() -> None:
    response = Response()

    set_access_cookie(response, "token-value")

    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert f"{settings.ACCESS_COOKIE_NAME}=token-value" in set_cookie_header
    assert "HttpOnly" in set_cookie_header
    assert f"Path={settings.ACCESS_COOKIE_PATH}" in set_cookie_header
    assert f"Max-Age={settings.ACCESS_TOKEN_EXPIRE_HOURS * 3600}" in set_cookie_header
    assert f"samesite={settings.ACCESS_COOKIE_SAMESITE}" in set_cookie_header.lower()

    if settings.ACCESS_COOKIE_SECURE:
        assert "Secure" in set_cookie_header
    else:
        assert "Secure" not in set_cookie_header

    if settings.ACCESS_COOKIE_DOMAIN:
        assert f"Domain={settings.ACCESS_COOKIE_DOMAIN}" in set_cookie_header
    else:
        assert "Domain=" not in set_cookie_header


def test_clear_access_cookie_expect_cookie_cleared() -> None:
    response = Response()

    clear_access_cookie(response)

    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert f"{settings.ACCESS_COOKIE_NAME}=" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header
    assert "expires=" in set_cookie_header.lower()
    assert f"Path={settings.ACCESS_COOKIE_PATH}" in set_cookie_header

    if settings.ACCESS_COOKIE_DOMAIN:
        assert f"Domain={settings.ACCESS_COOKIE_DOMAIN}" in set_cookie_header
    else:
        assert "Domain=" not in set_cookie_header
