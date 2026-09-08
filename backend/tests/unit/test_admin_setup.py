import pytest

from flyt.apps.admin.setup import create_admin
from flyt.core.config import settings


def test_create_admin_rejects_samesite_none(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ACCESS_COOKIE_SAMESITE", "none")

    with pytest.raises(RuntimeError, match="CSRF"):
        create_admin()


def test_create_admin_given_default_config_expect_dedicated_admin_session_secret() -> (
    None
):
    admin = create_admin()

    assert admin.secret_key == settings.ADMIN_SESSION_SECRET
    assert admin.secret_key != settings.SECRET_KEY
