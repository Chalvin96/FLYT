from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from flyt.core.config import settings
from flyt.core.database_url import to_async_database_url


engine_kwargs: dict[str, object] = {}
if settings.DISABLE_DB_POOLING:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True

async_engine = create_async_engine(
    to_async_database_url(settings.DATABASE_URL),
    **engine_kwargs,
)
AsyncSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=async_engine,
    expire_on_commit=False,
)

# Ensure every DB entrypoint registers the full ORM model graph before mapper
# configuration starts. Script and worker boot paths are much narrower than the
# web app and otherwise miss cross-app relationships like Definition -> CardPool.
from flyt.core import model_registry  # noqa: F401,E402


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        try:
            yield db
        except Exception:
            await db.rollback()
            raise
