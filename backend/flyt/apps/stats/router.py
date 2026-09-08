import logging
from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends

from flyt.apps.stats.deps import get_stats_service
from flyt.apps.stats.schemas import StatsRead
from flyt.apps.stats.services import StatsService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me/dashboard", tags=["stats"])


@router.get("/stats")
async def get_dashboard_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[StatsService, Depends(get_stats_service)],
) -> StatsRead:
    logger.info(
        "[stats.get_dashboard_stats] entering with params user_id=%s",
        current_user.id,
    )
    stats = await service.get_stats(user_id=current_user.id)
    logger.info(
        "[stats.get_dashboard_stats] exiting with params user_id=%s",
        current_user.id,
    )
    return stats
