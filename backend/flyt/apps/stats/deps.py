from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.core.db import get_async_db


def get_stats_query_service(
    db: AsyncSession = Depends(get_async_db),
) -> StatsQueryService:
    return StatsQueryService(db)


def get_stats_service(
    db: AsyncSession = Depends(get_async_db),
    query_service: StatsQueryService = Depends(get_stats_query_service),
) -> StatsService:
    return StatsService(db, query_service=query_service)
