from typing import Literal

from cryptography.fernet import Fernet
from pydantic import field_validator
from pydantic import model_validator
from pydantic import ValidationInfo
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict

DEFAULT_OAUTH_SESSION_SECRET = "dev-oauth-session-secret-not-for-production"
K_MIN_SIGNING_SECRET_LENGTH = 32
K_CHATBOT_OUTPUT_TOKEN_CEILING = 3_000


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/change-me"
    )
    TEST_DATABASE_URL: str | None = None
    DISABLE_DB_POOLING: bool = False
    ENV: Literal["development", "test", "e2e", "production"] = "development"
    ENABLE_E2E_TEST_AUTH: bool = False
    FRONTEND_ORIGINS: list[str] = ["http://localhost:5173"]
    SECRET_KEY: str = ""
    ADMIN_SESSION_SECRET: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    ACCESS_COOKIE_NAME: str = "access_token"
    ACCESS_COOKIE_SECURE: bool = False
    ACCESS_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    ACCESS_COOKIE_DOMAIN: str | None = None
    ACCESS_COOKIE_PATH: str = "/"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/users/oauth/google/callback"
    FRONTEND_LOGIN_SUCCESS_URL: str = "http://localhost:5173/home"
    FRONTEND_LOGIN_FAILURE_URL: str = "http://localhost:5173/login"
    OAUTH_SESSION_SECRET: str = DEFAULT_OAUTH_SESSION_SECRET

    REDIS_URL: str = "redis://localhost:6379"
    READING_PAGE_TARGET_WORDS: int = 300
    READING_INGEST_MAX_BYTES: int = 5_000_000
    READING_INGEST_TIMEOUT_SECONDS: int = 10

    TAGGER_SVC_URL: str | None = None
    TAGGER_SVC_TIMEOUT_SECONDS: float = 2.5
    TAGGER_MAX_CONCURRENCY: int = 4
    STT_SVC_URL: str | None = None
    STT_SVC_TIMEOUT_SECONDS: float = 30.0
    STT_MAX_AUDIO_BYTES: int = 10 * 1024 * 1024
    STT_PROXY_MAX_CONCURRENCY: int = 4
    STT_PROXY_MAX_REQUESTS_PER_USER: int = 6
    STT_PROXY_RATE_WINDOW_SECONDS: float = 60.0

    PROVIDER_CREDENTIAL_ENCRYPTION_KEYS: list[str] = []
    CHATGPT_LINK_ENABLED: bool = True
    CHATGPT_DEFAULT_MODEL: str = "gpt-5.6-luna"
    CHATGPT_MODELS: list[str] = [
        "gpt-5.6-luna",
        "gpt-5.6-terra",
        "gpt-5.6-sol",
    ]
    CHATGPT_AUTH_TIMEOUT_SECONDS: float = 10.0
    CHATGPT_MODEL_TIMEOUT_SECONDS: float = 60.0

    FLYT_AI_WEEKLY_TOKEN_BUDGET: int = 100_000
    CHATBOT_ENABLED_MODELS: list[str] = [
        "flyt",
        "chatgpt",
        "deepseek",
        "glm",
    ]
    CHATBOT_FLYT_MODEL: str = "z-ai/glm-5.3-flash"
    CHATBOT_GLM_MODEL: str = "z-ai/glm-5.3-flash"
    CHATBOT_DEEPSEEK_MODEL: str = "deepseek/deepseek-v4-flash-0731"
    CHATBOT_OPENROUTER_REASONING_EFFORT: Literal["max", "high", "low"] = "low"
    CHATBOT_OPENROUTER_TIMEOUT_SECONDS: float = 60.0
    CHATBOT_CHATGPT_TIMEOUT_SECONDS: float = 60.0
    CHATBOT_MAX_OUTPUT_TOKENS: int = 2_000

    STORY_GENERATION_ENABLED_PROVIDERS: list[str] = ["openrouter"]
    STORY_GENERATION_OPENROUTER_MODEL: str = "deepseek/deepseek-v4-flash-0731"
    STORY_GENERATION_OPENROUTER_REASONING_ENABLED: bool = False
    STORY_GENERATION_OPENROUTER_TIMEOUT_SECONDS: float = 60.0
    STORY_GENERATION_CHATGPT_TIMEOUT_SECONDS: float = 60.0
    STORY_GENERATION_AGGREGATE_TOKEN_BUDGET: int = 10_000_000
    STORY_GENERATION_AGGREGATE_WINDOW_HOURS: int = 24
    STORY_GENERATION_EPHEMERAL_TTL_HOURS: int = 1
    STORY_GENERATION_PROMPT_VOCABULARY_BOUND: int = 500
    STORY_GENERATION_MIN_DECK_SIZE: int = 100
    STORY_GENERATION_FREQUENCY_DECK_SIZE: int = 5989
    STORY_GENERATION_LENGTH_OPTIONS: list[int] = [150, 250, 400]
    STORY_GENERATION_MAX_LENGTH: int = 600
    STORY_GENERATION_DENSITY_MIN: float = 0.03
    STORY_GENERATION_DENSITY_MAX: float = 0.05
    STORY_GENERATION_TOPIC_MAX_LENGTH: int = 200
    OPENROUTER_API_KEY: str | None = None

    LESSON_WRITE_JUDGE_OPENROUTER_MODEL: str = "openai/gpt-5.6-luna"
    LESSON_WRITE_JUDGE_OPENROUTER_REASONING_ENABLED: bool = False
    LESSON_WRITE_JUDGE_OPENROUTER_TIMEOUT_SECONDS: float = 60.0
    LESSON_WRITE_JUDGE_MAX_REQUESTS_PER_USER: int = 6
    LESSON_WRITE_JUDGE_RATE_WINDOW_SECONDS: float = 60.0

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "console"] | None = None

    METRICS_ENABLED: bool = True
    METRICS_TOKEN: str | None = None
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0
    RELEASE: str | None = None

    @field_validator("SECRET_KEY", "ADMIN_SESSION_SECRET")
    @classmethod
    def validate_signing_secret(cls, value: str, info: ValidationInfo) -> str:
        field_name = info.field_name
        if not value:
            msg = f"{field_name} must be set"
            raise ValueError(msg)
        if len(value) < K_MIN_SIGNING_SECRET_LENGTH:
            msg = f"{field_name} must be at least {K_MIN_SIGNING_SECRET_LENGTH} characters"
            raise ValueError(msg)
        return value

    @field_validator("GOOGLE_CLIENT_ID")
    @classmethod
    def validate_google_client_id(cls, value: str) -> str:
        if not value:
            msg = "GOOGLE_CLIENT_ID must be set"
            raise ValueError(msg)
        return value

    @field_validator("GOOGLE_CLIENT_SECRET")
    @classmethod
    def validate_google_client_secret(cls, value: str) -> str:
        if not value:
            msg = "GOOGLE_CLIENT_SECRET must be set"
            raise ValueError(msg)
        return value

    @field_validator("OAUTH_SESSION_SECRET")
    @classmethod
    def validate_oauth_session_secret(cls, value: str) -> str:
        if not value:
            return DEFAULT_OAUTH_SESSION_SECRET
        return value

    @field_validator("PROVIDER_CREDENTIAL_ENCRYPTION_KEYS")
    @classmethod
    def validate_provider_credential_encryption_keys(
        cls, value: list[str]
    ) -> list[str]:
        if not value:
            msg = "PROVIDER_CREDENTIAL_ENCRYPTION_KEYS must contain at least one key"
            raise ValueError(msg)
        for entry in value:
            try:
                Fernet(entry.encode("ascii"))
            except (UnicodeError, ValueError, TypeError) as exc:
                msg = (
                    "PROVIDER_CREDENTIAL_ENCRYPTION_KEYS entries must be valid "
                    "Fernet keys"
                )
                raise ValueError(msg) from exc
        return value

    @field_validator("METRICS_TOKEN")
    @classmethod
    def validate_metrics_token(cls, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        return value.strip()

    @field_validator("SENTRY_DSN")
    @classmethod
    def validate_sentry_dsn(cls, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        return value.strip()

    @model_validator(mode="after")
    def validate_chatgpt_default_model(self) -> "Settings":
        if self.CHATGPT_DEFAULT_MODEL not in self.CHATGPT_MODELS:
            msg = (
                "CHATGPT_DEFAULT_MODEL must be one of CHATGPT_MODELS; "
                f"{self.CHATGPT_DEFAULT_MODEL!r} is not in {self.CHATGPT_MODELS}"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_openrouter_api_key(self) -> "Settings":
        if (
            "openrouter" in self.STORY_GENERATION_ENABLED_PROVIDERS
            and not self.OPENROUTER_API_KEY
        ):
            msg = (
                "OPENROUTER_API_KEY must be set when the openrouter provider is enabled"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_flyt_ai_weekly_token_budget(self) -> "Settings":
        if self.FLYT_AI_WEEKLY_TOKEN_BUDGET < 1:
            msg = "FLYT_AI_WEEKLY_TOKEN_BUDGET must be at least 1"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_story_generation_aggregate_budget(self) -> "Settings":
        if self.STORY_GENERATION_AGGREGATE_TOKEN_BUDGET < 1:
            msg = "STORY_GENERATION_AGGREGATE_TOKEN_BUDGET must be at least 1"
            raise ValueError(msg)
        if self.STORY_GENERATION_AGGREGATE_WINDOW_HOURS < 1:
            msg = "STORY_GENERATION_AGGREGATE_WINDOW_HOURS must be at least 1"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_chatbot_models(self) -> "Settings":
        supported = {"flyt", "chatgpt", "deepseek", "glm"}
        unknown = set(self.CHATBOT_ENABLED_MODELS) - supported
        if unknown:
            msg = (
                f"CHATBOT_ENABLED_MODELS contains unsupported models: {sorted(unknown)}"
            )
            raise ValueError(msg)
        if self.CHATBOT_MAX_OUTPUT_TOKENS < 1:
            msg = "CHATBOT_MAX_OUTPUT_TOKENS must be at least 1"
            raise ValueError(msg)
        if self.CHATBOT_MAX_OUTPUT_TOKENS > K_CHATBOT_OUTPUT_TOKEN_CEILING:
            msg = (
                "CHATBOT_MAX_OUTPUT_TOKENS must not exceed "
                f"{K_CHATBOT_OUTPUT_TOKEN_CEILING}"
            )
            raise ValueError(msg)
        if (
            self.ENV == "production"
            and "flyt" in self.CHATBOT_ENABLED_MODELS
            and not self.OPENROUTER_API_KEY
        ):
            msg = (
                "OPENROUTER_API_KEY must be set when the Flyt chatbot model "
                "is enabled in production"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_story_generation_length(self) -> "Settings":
        over = [
            option
            for option in self.STORY_GENERATION_LENGTH_OPTIONS
            if option > self.STORY_GENERATION_MAX_LENGTH
        ]
        if over:
            msg = (
                "STORY_GENERATION_LENGTH_OPTIONS must stay within "
                f"STORY_GENERATION_MAX_LENGTH ({self.STORY_GENERATION_MAX_LENGTH}); "
                f"{over} exceed it"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENV == "production" and not self.ACCESS_COOKIE_SECURE:
            msg = "ACCESS_COOKIE_SECURE must be true in production"
            raise ValueError(msg)
        if self.ACCESS_COOKIE_SAMESITE == "none" and not self.ACCESS_COOKIE_SECURE:
            msg = "SameSite=None requires ACCESS_COOKIE_SECURE=true"
            raise ValueError(msg)
        if (
            self.ENV == "production"
            and self.OAUTH_SESSION_SECRET == DEFAULT_OAUTH_SESSION_SECRET
        ):
            msg = "OAUTH_SESSION_SECRET must be set explicitly in production"
            raise ValueError(msg)
        if self.ENV == "production" and self.METRICS_ENABLED and not self.METRICS_TOKEN:
            msg = "METRICS_TOKEN must be set when METRICS_ENABLED is true in production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_stub_provider_not_in_production(self) -> "Settings":
        if (
            self.ENV == "production"
            and "stub" in self.STORY_GENERATION_ENABLED_PROVIDERS
        ):
            msg = (
                "STORY_GENERATION_ENABLED_PROVIDERS must not include 'stub' "
                "in production"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def validate_log_format(self) -> "Settings":
        if self.LOG_FORMAT is None:
            self.LOG_FORMAT = "console" if self.ENV == "development" else "json"
        return self


settings = Settings()
