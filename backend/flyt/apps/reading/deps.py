from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import status

from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.http import error_response


async def admit_import_request(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> None:
    retry_after = await request.app.state.import_rate_limiter.check(
        str(current_user.uuid)
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                "IMPORT_RATE_LIMITED", "Too many import requests. Try again later."
            ),
            headers={"Retry-After": str(retry_after)},
        )
