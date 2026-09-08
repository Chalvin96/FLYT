from collections.abc import AsyncGenerator
import os
from typing import Any

import pytest
from httpx import ASGITransport
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import URL
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("OAUTH_SESSION_SECRET", "test-oauth-session-secret")
os.environ.setdefault(
    "ADMIN_SESSION_SECRET", "test-admin-session-secret-not-for-production"
)
os.environ.setdefault(
    "PROVIDER_CREDENTIAL_ENCRYPTION_KEYS",
    '["kkx-ZViSkteSQGh9z5FDskkiQGFImdcA1ceQt2DnwAk="]',
)
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key-not-real")

from flyt.core.config import settings
from flyt.core.database_url import to_async_database_url


def _parse_postgres_url(url: str, context: str) -> URL:
    try:
        parsed = make_url(url)
    except Exception as exc:
        msg = f"Invalid {context}: {url}"
        raise RuntimeError(msg) from exc

    if parsed.get_backend_name() != "postgresql":
        msg = "Tests require a PostgreSQL URL"
        raise RuntimeError(msg)

    return parsed


def validate_test_database_url(url: str) -> None:
    parsed = _parse_postgres_url(url, context="test database URL")

    database_name = (parsed.database or "").lower()
    if not (
        database_name == "test"
        or database_name.startswith("test_")
        or database_name.endswith("_test")
    ):
        msg = f"Refusing to run tests against non-test database URL: {url}"
        raise RuntimeError(msg)

    host = (parsed.host or "").lower()
    if host not in {"", "localhost", "127.0.0.1"}:
        msg = f"Refusing to run tests against non-local database host '{parsed.host}'."
        raise RuntimeError(msg)


RAW_TEST_DATABASE_URL = settings.TEST_DATABASE_URL
if not RAW_TEST_DATABASE_URL:
    msg = "TEST_DATABASE_URL must be set for tests"
    raise RuntimeError(msg)
validate_test_database_url(RAW_TEST_DATABASE_URL)

ASYNC_TEST_DATABASE_URL = to_async_database_url(RAW_TEST_DATABASE_URL)

settings.DATABASE_URL = ASYNC_TEST_DATABASE_URL

from flyt.core.base import Base  # noqa: E402
from flyt.core.db import get_async_db  # noqa: E402
from flyt.main import app  # noqa: E402

async_engine = create_async_engine(
    ASYNC_TEST_DATABASE_URL,
    poolclass=NullPool,
)


@pytest.fixture(scope="session")
async def setup_database() -> AsyncGenerator[None, None]:
    # Session-level advisory lock held on this connection until it closes,
    # serializing concurrent pytest runs against the shared test database.
    async with async_engine.connect() as lock_connection:
        await lock_connection.execute(
            text("SELECT pg_advisory_lock(hashtext(:key))"),
            {"key": "test-session"},
        )
        async with async_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        yield
        async with async_engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
    await async_engine.dispose()


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="function")
async def db(setup_database: None) -> AsyncGenerator[AsyncSession, None]:
    from tests.factories import AuthIdentityFactory
    from tests.factories import ChatGPTLinkFactory
    from tests.factories import DeckFactory
    from tests.factories import StatsReviewLogFactory
    from tests.factories import LessonReleaseFactory
    from tests.factories import StoryPageFactory
    from tests.factories import CardPoolFactory
    from tests.factories import DefinitionFactory
    from tests.factories import FlashCardFactory
    from tests.factories import LessonFactory
    from tests.factories import ReadingGroupFactory
    from tests.factories import UserLessonProgressFactory
    from tests.factories import LemmaFactory
    from tests.factories import SeeAlsoFactory
    from tests.factories import StoryFactory
    from tests.factories import UserCardFactory
    from tests.factories import UserLemmaFactory
    from tests.factories import UserFactory
    from tests.factories import UserSettingsFactory
    from tests.factories import ImportMetaFactory
    from tests.factories import UserStoryFactory
    from tests.factories import WordFormFactory
    from tests.factories import GenerationFactory
    from tests.factories import ProviderRequestFactory

    factories: tuple[Any, ...] = (
        AuthIdentityFactory,
        ChatGPTLinkFactory,
        UserFactory,
        LemmaFactory,
        DefinitionFactory,
        WordFormFactory,
        SeeAlsoFactory,
        UserLemmaFactory,
        DeckFactory,
        ReadingGroupFactory,
        StoryPageFactory,
        LessonReleaseFactory,
        CardPoolFactory,
        StatsReviewLogFactory,
        FlashCardFactory,
        LessonFactory,
        StoryFactory,
        UserLessonProgressFactory,
        UserCardFactory,
        UserSettingsFactory,
        UserStoryFactory,
        ImportMetaFactory,
        GenerationFactory,
        ProviderRequestFactory,
    )

    async with async_engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        for factory in factories:
            factory.__async_session__ = session

        try:
            yield session
        finally:
            for factory in factories:
                factory.__async_session__ = None
            await session.close()
            if transaction.is_active:
                await transaction.rollback()


@pytest.fixture(scope="function")
async def async_session(db: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    yield db


@pytest.fixture(scope="function")
async def override_async_db_dependency(
    db: AsyncSession,
) -> AsyncGenerator[None, None]:
    async def _override_async_db() -> AsyncGenerator[AsyncSession, None]:
        yield db

    app.dependency_overrides[get_async_db] = _override_async_db
    yield
    app.dependency_overrides.pop(get_async_db, None)


@pytest.fixture(scope="function")
async def speech_rate_limiter() -> AsyncGenerator[None, None]:
    from limits.aio.storage import MemoryStorage

    from flyt.core.rate_limit import MovingWindowRateLimiter

    limiter = MovingWindowRateLimiter(
        MemoryStorage(),
        settings.STT_PROXY_MAX_REQUESTS_PER_USER,
        settings.STT_PROXY_RATE_WINDOW_SECONDS,
    )
    previous = getattr(app.state, "speech_rate_limiter", None)
    app.state.speech_rate_limiter = limiter
    try:
        yield
    finally:
        app.state.speech_rate_limiter = previous


@pytest.fixture(scope="function")
async def exercise_evaluation_rate_limiter() -> AsyncGenerator[None, None]:
    from limits.aio.storage import MemoryStorage

    from flyt.core.rate_limit import MovingWindowRateLimiter

    limiter = MovingWindowRateLimiter(
        MemoryStorage(),
        settings.LESSON_WRITE_JUDGE_MAX_REQUESTS_PER_USER,
        settings.LESSON_WRITE_JUDGE_RATE_WINDOW_SECONDS,
    )
    previous = getattr(app.state, "exercise_evaluation_rate_limiter", None)
    app.state.exercise_evaluation_rate_limiter = limiter
    try:
        yield
    finally:
        app.state.exercise_evaluation_rate_limiter = previous


@pytest.fixture(scope="function")
async def client(
    override_async_db_dependency: None,
    speech_rate_limiter: None,
    exercise_evaluation_rate_limiter: None,
) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as async_client:
        yield async_client
