import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.constants import K_LEXICON_BROWSE_NOT_FOUND_MESSAGE
from flyt.apps.lexicons.constants import K_LEXICON_BROWSE_QUERY_MIN_LENGTH
from flyt.apps.lexicons.constants import K_LEXICON_QUERY_MAX_LENGTH
from flyt.apps.lexicons.constants import K_LEXICON_SEARCH_QUERY_MIN_LENGTH
from flyt.apps.lexicons.constants import K_LEXICON_SUGGEST_QUERY_MIN_LENGTH
from flyt.apps.lexicons.deps import get_lexicon_service
from flyt.apps.lexicons.exceptions import LexiconNotFoundError
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.schemas import BrowseEntry
from flyt.apps.lexicons.schemas import BrowseHeadwordEntryResponse
from flyt.apps.lexicons.schemas import BrowseSuggestion
from flyt.apps.lexicons.schemas import BrowseSuggestionsResponse
from flyt.apps.lexicons.schemas import LemmaDefinitionRead
from flyt.apps.lexicons.schemas import LemmaDefinitionsResponse
from flyt.apps.lexicons.schemas import LemmaRead
from flyt.apps.lexicons.schemas import LemmaSummaryRead
from flyt.apps.lexicons.schemas import ResolveCandidate
from flyt.apps.lexicons.schemas import ResolveDefinition
from flyt.apps.lexicons.schemas import ResolveResponse
from flyt.apps.lexicons.schemas import SeeAlsoRead
from flyt.apps.lexicons.schemas import UserLemmaRead
from flyt.apps.lexicons.schemas import UserLemmasResponse
from flyt.apps.lexicons.services import LexiconService
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_MASTERED
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_NEW
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.deps import get_optional_user
from flyt.apps.users.deps import get_user_lemma_service
from flyt.apps.users.models import User
from flyt.apps.users.services import UserLemmaService
from flyt.core.db import get_async_db
from flyt.core.exceptions import ValidationError
from flyt.core.http import EmptyResponse
from flyt.core.http import error_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lexicons", tags=["lexicons"])
me_router = APIRouter(prefix="/me", tags=["lexicons"])


@me_router.get("/lemmas")
async def list_my_lemmas(
    current_user: Annotated[User, Depends(get_current_user)],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> UserLemmasResponse:
    """The signed-in user's vocabulary notebook: saved + mastered lemmas."""
    entries = await lexicon_service.list_user_lemmas(current_user.id)
    lemmas = [
        UserLemmaRead(
            uuid=entry.lemma.uuid,
            word=entry.lemma.word,
            pos=entry.lemma.pos,
            primary_translation=entry.lemma.primary_translation,
            state=entry.state,
        )
        for entry in entries
    ]
    mastered_count = sum(
        1 for entry in entries if entry.state == K_USER_LEMMA_STATE_MASTERED
    )
    return UserLemmasResponse(
        lemmas=lemmas,
        learning_count=len(lemmas) - mastered_count,
        mastered_count=mastered_count,
    )


@router.get("/search", response_model=list[LemmaRead])
async def search(
    query: Annotated[
        str,
        Query(
            min_length=K_LEXICON_SEARCH_QUERY_MIN_LENGTH,
            max_length=K_LEXICON_QUERY_MAX_LENGTH,
        ),
    ],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> list[Lemma]:
    logger.info(
        "[lexicons.search] entering with params query_length=%s",
        len(query),
    )
    try:
        lemmas = await lexicon_service.search_lemmas(query)
        logger.info(
            "[lexicons.search] exiting with params result_count=%s",
            len(lemmas),
        )
        return list(lemmas)
    except ValidationError as e:
        logger.info(
            "[lexicons.search] exiting with params error_code=%s status_code=%s",
            e.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(e.code, e.message),
        ) from e


@router.get("/resolve")
async def resolve(
    word: Annotated[
        str,
        Query(
            min_length=K_LEXICON_SEARCH_QUERY_MIN_LENGTH,
            max_length=K_LEXICON_QUERY_MAX_LENGTH,
        ),
    ],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> ResolveResponse:
    logger.info(
        "[lexicons.resolve] entering with params word_length=%s",
        len(word),
    )
    try:
        resolution = await lexicon_service.resolve_word(word)
        logger.info(
            "[lexicons.resolve] exiting with params result_count=%s",
            len(resolution.lemmas),
        )
        # Collect all see-also entries across candidates for a single batch
        # resolution query.
        all_see_also: list = []
        for lemma in resolution.lemmas:
            all_see_also.extend(lemma.see_also)
        resolved_map = await lexicon_service.resolve_see_also_targets(all_see_also)
        candidates = [
            ResolveCandidate(
                lemma_uuid=lemma.uuid,
                word=lemma.word,
                pos=lemma.pos,
                hgno=lemma.hgno,
                is_compound=resolution.is_compound,
                definitions=[
                    ResolveDefinition(
                        definition=d.definition,
                        translation=d.translation,
                    )
                    for d in lemma.definitions
                ],
                see_also=[
                    SeeAlsoRead(
                        article_id=entry.target_article_id,
                        word=entry.target_word,
                        relation=entry.relation,
                        target_lemma_uuid=(
                            resolved_map[entry.target_article_id].uuid
                            if entry.target_article_id in resolved_map
                            else None
                        ),
                    )
                    for entry in lemma.see_also
                ],
                ipa=lemma.ipa,
                intonation=lemma.intonation,
                ipa_approximate=lemma.ipa_approximate,
                audio_url=lemma.audio_url,
            )
            for lemma in resolution.lemmas
        ]
        return ResolveResponse(query=word, candidates=candidates)
    except ValidationError as e:
        logger.info(
            "[lexicons.resolve] exiting with params error_code=%s status_code=%s",
            e.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(e.code, e.message),
        ) from e


@router.get("/suggestions")
async def suggestions(
    query: Annotated[
        str,
        Query(
            min_length=K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
            max_length=K_LEXICON_QUERY_MAX_LENGTH,
        ),
    ],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> BrowseSuggestionsResponse:
    logger.info(
        "[lexicons.suggestions] entering with params query_length=%s",
        len(query),
    )
    try:
        suggestions = await lexicon_service.get_suggestions(query)
        logger.info(
            "[lexicons.suggestions] exiting with params result_count=%s",
            len(suggestions),
        )
        return BrowseSuggestionsResponse(
            suggestions=[BrowseSuggestion(label=headword) for headword in suggestions]
        )
    except ValidationError as e:
        logger.info(
            "[lexicons.suggestions] exiting with params error_code=%s status_code=%s",
            e.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(e.code, e.message),
        ) from e


@router.get("/browse")
async def browse(
    q: Annotated[
        str,
        Query(
            min_length=K_LEXICON_BROWSE_QUERY_MIN_LENGTH,
            max_length=K_LEXICON_QUERY_MAX_LENGTH,
        ),
    ],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> BrowseHeadwordEntryResponse:
    logger.info(
        "[lexicons.browse] entering with params query_length=%s",
        len(q),
    )
    try:
        result = await lexicon_service.resolve_headword(q)
        if result is None:
            raise LexiconNotFoundError(K_LEXICON_BROWSE_NOT_FOUND_MESSAGE)
        logger.info(
            "[lexicons.browse] exiting with params headword=%s entries=%s",
            result.headword,
            len(result.entries),
        )
        return BrowseHeadwordEntryResponse(
            headword=result.headword,
            entries=[
                BrowseEntry(
                    uuid=entry.uuid,
                    hgno=entry.hgno,
                    label=entry.label,
                )
                for entry in result.entries
            ],
            selected_lemma_uuid=result.selected_lemma_uuid,
            is_fallback=result.is_fallback,
        )
    except LexiconNotFoundError as error:
        logger.info(
            "[lexicons.browse] exiting with params error_code=%s status_code=%s",
            error.code,
            status.HTTP_404_NOT_FOUND,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ValidationError as e:
        logger.info(
            "[lexicons.browse] exiting with params error_code=%s status_code=%s",
            e.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(e.code, e.message),
        ) from e


@router.get("/lemmas/{lemma_uuid}/definitions")
async def get_lemma_definitions(
    lemma_uuid: UUID,
    current_user: Annotated[User | None, Depends(get_optional_user)],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
) -> LemmaDefinitionsResponse:
    try:
        lemma = await lexicon_service.load_lemma_with_relations(lemma_uuid)
        definitions = list(lemma.definitions)
        user_state = (
            await lexicon_service.get_lemma_state(lemma.id, current_user.id)
            if current_user is not None
            else K_USER_LEMMA_STATE_NEW
        )

        # Batch-resolve see-also target_article_id -> Lemma (single query).
        see_also_entries = list(lemma.see_also)
        resolved_targets = await lexicon_service.resolve_see_also_targets(
            see_also_entries
        )
        see_also_payload = [
            SeeAlsoRead(
                article_id=entry.target_article_id,
                word=entry.target_word,
                relation=entry.relation,
                target_lemma_uuid=(
                    resolved_targets[entry.target_article_id].uuid
                    if entry.target_article_id in resolved_targets
                    else None
                ),
            )
            for entry in see_also_entries
        ]

        return LemmaDefinitionsResponse(
            lemma=LemmaSummaryRead(
                uuid=lemma.uuid,
                word=lemma.word,
                pos=lemma.pos,
                primary_translation=lemma.primary_translation,
                source_article_id=lemma.source_article_id,
                source_lemma_id=lemma.source_lemma_id,
                hgno=lemma.hgno,
                is_sub_article=lemma.is_sub_article,
                cross_reference_article_id=lemma.cross_reference_article_id,
                see_also=see_also_payload,
                ipa=lemma.ipa,
                intonation=lemma.intonation,
                ipa_approximate=lemma.ipa_approximate,
                audio_url=lemma.audio_url,
            ),
            definitions=[
                LemmaDefinitionRead(
                    uuid=d.uuid,
                    definition=d.definition,
                    translation=d.translation,
                    translation_source=d.translation_source,
                    examples=d.examples_json,
                    userState=user_state,
                )
                for d in definitions
            ],
        )
    except LexiconNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error


@router.post(
    "/lemmas/{lemma_uuid}/mark-known",
)
async def mark_known(
    lemma_uuid: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    lexicon_service: Annotated[LexiconService, Depends(get_lexicon_service)],
    user_lemma_service: Annotated[UserLemmaService, Depends(get_user_lemma_service)],
) -> EmptyResponse:
    try:
        lemma = await lexicon_service.get_lemma_by_uuid(lemma_uuid)
        if lemma is None:
            raise LexiconNotFoundError("Lemma not found")

        await user_lemma_service.set_lemma_mastery_state(
            current_user.id, lemma.id, True
        )
        await db.commit()
        return EmptyResponse()
    except LexiconNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
