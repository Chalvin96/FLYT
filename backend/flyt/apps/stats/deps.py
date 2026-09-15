from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.stats.queries import StatsQueryService
from flyt.core.db import get_async_db


def get_stats_query_service(
    db: AsyncSession = Depends(get_async_db),
) -> StatsQueryService:
    return StatsQueryService(db)
