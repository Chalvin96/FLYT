from typing import Annotated

from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.services import LexiconService
from flyt.apps.users.deps import get_optional_user
from flyt.apps.users.deps import get_user_lemma_service
from flyt.apps.users.models import User
from flyt.apps.users.services import UserLemmaService
from flyt.apps.users.services import UserVocabularyQueries
from flyt.core.db import get_async_db
from flyt.core.http import error_response


def get_lexicon_service(
    db: AsyncSession = Depends(get_async_db),
    user_lemma_service: UserLemmaService = Depends(get_user_lemma_service),
) -> LexiconService:
    return LexiconService(
        db,
        user_lemma_service=user_lemma_service,
        user_vocabulary_queries=UserVocabularyQueries(db),
    )


async def admit_lexicon_request(
    request: Request,
    current_user: Annotated[User | None, Depends(get_optional_user)],
) -> None:
    key = _admission_key(request, current_user)
    if key is None:
        return
    retry_after = await request.app.state.lexicon_rate_limiter.check(key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                "LEXICON_RATE_LIMITED", "Too many dictionary requests. Try again later."
            ),
            headers={"Retry-After": str(retry_after)},
        )


def _admission_key(request: Request, current_user: User | None) -> str | None:
    if current_user is not None:
        return f"user:{current_user.id}"
    if request.client is None:
        return None
    return f"ip:{request.client.host}"
