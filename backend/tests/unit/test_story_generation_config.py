import pytest
from pydantic import ValidationError

from flyt.core.config import Settings


def test_settings_given_flyt_chatbot_enabled_without_key_expect_validation_error() -> (
    None
):
    with pytest.raises(ValueError, match="Flyt chatbot model is enabled"):
        _make_settings(
            ENV="production",
            ACCESS_COOKIE_SECURE=True,
            METRICS_TOKEN="metrics-token",
            STORY_GENERATION_ENABLED_PROVIDERS=[],
            CHATBOT_ENABLED_MODELS=["flyt"],
            OPENROUTER_API_KEY=None,
        )


def test_settings_given_chatbot_output_above_ceiling_expect_validation_error() -> None:
    with pytest.raises(ValueError, match="CHATBOT_MAX_OUTPUT_TOKENS"):
        _make_settings(CHATBOT_MAX_OUTPUT_TOKENS=3_001)


@pytest.mark.parametrize(
    "field",
    [
        "STORY_GENERATION_AGGREGATE_TOKEN_BUDGET",
        "STORY_GENERATION_AGGREGATE_WINDOW_HOURS",
    ],
)
def test_settings_given_non_positive_aggregate_limit_expect_validation_error(
    field: str,
) -> None:
    with pytest.raises(ValueError, match=field):
        _make_settings(**{field: 0})


def _make_settings(**overrides) -> Settings:
    values = {
        "SECRET_KEY": "test-secret-key-for-unit-tests-only-not-for-production",
        "ADMIN_SESSION_SECRET": "test-admin-session-secret-not-for-production",
        "GOOGLE_CLIENT_ID": "google-client",
        "GOOGLE_CLIENT_SECRET": "google-secret",
        "OAUTH_SESSION_SECRET": "test-oauth-session-secret",
        "PROVIDER_CREDENTIAL_ENCRYPTION_KEYS": [
            "kkx-ZViSkteSQGh9z5FDskkiQGFImdcA1ceQt2DnwAk="
        ],
        "OPENROUTER_API_KEY": "test-key",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_settings_given_openrouter_enabled_without_key_expect_validation_error() -> (
    None
):
    """R-105: enabling the openrouter provider requires its key, so the
    configuration cannot silently ship a broken provider."""
    with pytest.raises(ValueError, match="OPENROUTER_API_KEY must be set"):
        _make_settings(
            STORY_GENERATION_ENABLED_PROVIDERS=["openrouter"],
            OPENROUTER_API_KEY=None,
        )


def test_settings_given_openrouter_disabled_without_key_expect_no_error() -> None:
    """R-105: a provider can be disabled in configuration without removing the
    features that use it, and without requiring its key."""
    settings = _make_settings(
        STORY_GENERATION_ENABLED_PROVIDERS=[],
        OPENROUTER_API_KEY=None,
    )

    assert settings.STORY_GENERATION_ENABLED_PROVIDERS == []


def test_settings_given_option_above_ceiling_expect_error() -> None:
    """The ceiling bounds max_tokens independently of the offered options, so a
    configuration that offers a length the server would refuse is incoherent."""
    with pytest.raises(ValidationError):
        _make_settings(
            STORY_GENERATION_LENGTH_OPTIONS=[150, 250, 5000],
            STORY_GENERATION_MAX_LENGTH=600,
        )


def test_settings_given_stub_provider_in_production_expect_validation_error() -> None:
    """A stub provider serving fabricated stories must be unrepresentable in
    production, not prevented by deployment discipline."""
    with pytest.raises(ValueError, match="must not include 'stub' in production"):
        _make_settings(
            ENV="production",
            ACCESS_COOKIE_SECURE=True,
            METRICS_TOKEN="metrics-token",
            STORY_GENERATION_ENABLED_PROVIDERS=["stub"],
        )


def test_settings_given_stub_provider_in_e2e_expect_enabled() -> None:
    """Outside production the stub stays configurable so the E2E stack can
    exercise the generation pipeline without a paid model call."""
    settings = _make_settings(
        ENV="e2e",
        STORY_GENERATION_ENABLED_PROVIDERS=["stub", "chatgpt"],
        OPENROUTER_API_KEY=None,
    )

    assert settings.STORY_GENERATION_ENABLED_PROVIDERS == ["stub", "chatgpt"]
