from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.services import LexiconService
from flyt.apps.users.deps import get_user_lemma_service
from flyt.apps.users.services import UserLemmaService
from flyt.apps.users.services import UserVocabularyQueries
from flyt.core.db import get_async_db


def get_lexicon_service(
    db: AsyncSession = Depends(get_async_db),
    user_lemma_service: UserLemmaService = Depends(get_user_lemma_service),
) -> LexiconService:
    return LexiconService(
        db,
        user_lemma_service=user_lemma_service,
        user_vocabulary_queries=UserVocabularyQueries(db),
    )
