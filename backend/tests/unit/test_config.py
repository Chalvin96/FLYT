import pytest

from flyt.core.config import DEFAULT_OAUTH_SESSION_SECRET
from flyt.core.config import Settings


def make_settings(**overrides) -> Settings:
    values = {
        "SECRET_KEY": "test-secret-key-for-unit-tests-only-not-for-production",
        "ADMIN_SESSION_SECRET": "test-admin-session-secret-not-for-production",
        "GOOGLE_CLIENT_ID": "google-client",
        "GOOGLE_CLIENT_SECRET": "google-secret",
        "OAUTH_SESSION_SECRET": "test-oauth-session-secret",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_settings_given_production_without_secure_cookie_expect_validation_error() -> (
    None
):
    with pytest.raises(ValueError, match="ACCESS_COOKIE_SECURE must be true"):
        make_settings(ENV="production", ACCESS_COOKIE_SECURE=False)


def test_settings_given_production_with_secure_cookie_expect_valid() -> None:
    settings = make_settings(
        ENV="production",
        ACCESS_COOKIE_SECURE=True,
        METRICS_TOKEN="prod-metrics-token",
    )

    assert settings.ACCESS_COOKIE_SECURE is True


def test_settings_given_production_without_metrics_token_expect_validation_error() -> (
    None
):
    with pytest.raises(
        ValueError,
        match="METRICS_TOKEN must be set when METRICS_ENABLED is true in production",
    ):
        make_settings(ENV="production", ACCESS_COOKIE_SECURE=True)


def test_settings_given_e2e_env_expect_guard_flag_supported() -> None:
    settings = make_settings(ENV="e2e", ENABLE_E2E_TEST_AUTH=True)

    assert settings.ENV == "e2e"
    assert settings.ENABLE_E2E_TEST_AUTH is True


def test_settings_given_samesite_none_without_secure_cookie_expect_validation_error() -> (
    None
):
    with pytest.raises(ValueError, match="SameSite=None requires ACCESS_COOKIE_SECURE"):
        make_settings(ACCESS_COOKIE_SAMESITE="none", ACCESS_COOKIE_SECURE=False)


def test_settings_given_missing_oauth_session_secret_expect_default_in_non_production() -> (
    None
):
    settings = make_settings(OAUTH_SESSION_SECRET="")

    assert settings.OAUTH_SESSION_SECRET == DEFAULT_OAUTH_SESSION_SECRET


def test_settings_given_default_oauth_session_secret_in_production_expect_validation_error() -> (
    None
):
    with pytest.raises(
        ValueError,
        match="OAUTH_SESSION_SECRET must be set explicitly in production",
    ):
        make_settings(
            ENV="production",
            ACCESS_COOKIE_SECURE=True,
            OAUTH_SESSION_SECRET=DEFAULT_OAUTH_SESSION_SECRET,
            METRICS_TOKEN="prod-metrics-token",
        )


def test_settings_given_missing_admin_session_secret_expect_validation_error() -> None:
    with pytest.raises(ValueError, match="ADMIN_SESSION_SECRET must be set"):
        make_settings(ADMIN_SESSION_SECRET="")


def test_settings_given_short_admin_session_secret_expect_validation_error() -> None:
    with pytest.raises(
        ValueError, match="ADMIN_SESSION_SECRET must be at least 32 characters"
    ):
        make_settings(ADMIN_SESSION_SECRET="a" * 31)


def test_settings_given_valid_admin_session_secret_expect_stored() -> None:
    settings = make_settings(ADMIN_SESSION_SECRET="a" * 32)

    assert settings.ADMIN_SESSION_SECRET == "a" * 32


def test_settings_given_default_model_outside_offered_set_expect_error() -> None:
    with pytest.raises(ValueError, match="CHATGPT_DEFAULT_MODEL"):
        make_settings(
            CHATGPT_DEFAULT_MODEL="gpt-not-offered",
            CHATGPT_MODELS=["gpt-5.6-luna"],
        )
