from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Response
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.health.checks import check_database
from flyt.apps.health.schemas import HealthRead
from flyt.apps.health.schemas import ReadinessRead
from flyt.core.db import get_async_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def live() -> HealthRead:
    return HealthRead(status="ok")


@router.get(
    "/ready",
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ReadinessRead,
            "description": "Database is unreachable",
        }
    },
)
async def ready(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ReadinessRead:
    ok = await check_database(db)
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessRead(
        status="ok" if ok else "error",
        checks={"database": "ok" if ok else "error"},
    )
