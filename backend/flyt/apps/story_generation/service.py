import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.exceptions import AnchorExhaustedRefused
from flyt.apps.story_generation.exceptions import LengthOutOfRangeRefused
from flyt.apps.story_generation.exceptions import ProviderUnavailableRefused
from flyt.apps.story_generation.exceptions import WeeklyBudgetExhaustedRefused
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.prompt import build_prompt
from flyt.apps.story_generation.prompt import build_provider_request
from flyt.apps.story_generation.prompt import topic_suggestions
from flyt.apps.story_generation.prompt import validate_topic
from flyt.apps.story_generation.retention import retention_cutoff
from flyt.apps.story_generation.schemas import AnchorChoiceRead
from flyt.apps.story_generation.schemas import GenerationCreateResponse
from flyt.apps.story_generation.schemas import GenerationCurrentRead
from flyt.apps.story_generation.schemas import GenerationPageRead
from flyt.apps.story_generation.schemas import GenerationPageTokenRead
from flyt.apps.story_generation.schemas import GenerationSurfaceRead
from flyt.apps.story_generation.schemas import ProviderChoiceRead
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import VocabularyService
from flyt.apps.story_generation.vocabulary import has_unknown_targets
from flyt.apps.reading.schemas import ImportItemRead
from flyt.apps.reading.import_service import ImportDraft
from flyt.apps.reading.import_service import ImportService
from flyt.apps.reading.tokenization import PageData
from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.reading.vocabulary import resolve_user_states_for_tokens
from flyt.apps.users.models import User
from flyt.apps.users.services import UserVocabularyQueries
from flyt.clients.provider import ProviderFailure
from flyt.clients.registry import ProviderRegistry
from flyt.core.config import settings
from flyt.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

_SUPERSEDED_MESSAGE = "Superseded by a new request."


class GenerationService:
    """Request-facing story generation operations.

    Worker execution (admission, debit, provider dispatch, finalization)
    lives on ``GenerationExecution``.
    """

    def __init__(
        self,
        db: AsyncSession,
        user_vocabulary_queries: UserVocabularyQueries | None = None,
    ) -> None:
        self._db = db
        self._user_vocabulary_queries = (
            user_vocabulary_queries or UserVocabularyQueries(db)
        )

    async def load_surface(self, user_id: int) -> GenerationSurfaceRead:
        registry = ProviderRegistry(self._db)
        provider_choices = await registry.load_choices(user_id)
        usage_service = AiUsageService(self._db)

        providers: list[ProviderChoiceRead] = []
        for choice in provider_choices:
            remaining_percent = await usage_service.find_remaining_percent(
                user_id, choice.limited_by_flyt and choice.available
            )
            providers.append(
                ProviderChoiceRead(
                    name=choice.name,
                    model=choice.model,
                    available=choice.available,
                    limitedByFlyt=choice.limited_by_flyt,
                    reason=choice.reason,
                    action=choice.action,
                    remainingPercent=remaining_percent,
                )
            )

        vocab_service = VocabularyService(self._db)
        anchor_choices = await vocab_service.anchor_choices(user_id)

        anchors = [
            AnchorChoiceRead(
                type=c.type.value,
                available=c.available,
                reason=c.reason,
            )
            for c in anchor_choices.choices
        ]

        return GenerationSurfaceRead(
            providers=providers,
            anchors=anchors,
            deckCollapsesWithFrequency=anchor_choices.deck_collapses_with_frequency,
            minDeckSize=settings.STORY_GENERATION_MIN_DECK_SIZE,
            lengthOptions=list(settings.STORY_GENERATION_LENGTH_OPTIONS),
            topicSuggestions=topic_suggestions(),
        )

    async def request_generation(
        self,
        user_id: int,
        provider_name: str,
        anchor: AnchorType | None,
        length: int,
        topic: str | None,
    ) -> GenerationCreateResponse:
        cleaned_topic = validate_topic(topic)
        _validate_length(length)

        registry = ProviderRegistry(self._db)
        try:
            provider_selection = await registry.resolve(provider_name, user_id)
        except ProviderFailure as error:
            raise ProviderUnavailableRefused(
                f"Provider '{provider_name}' is unavailable."
            ) from error
        vocab_service = VocabularyService(self._db)
        selection = await vocab_service.select(user_id, anchor, length)
        if not has_unknown_targets(selection):
            raise AnchorExhaustedRefused()

        if provider_selection.funded_by_flyt:
            prompt = build_prompt(
                base_words=selection.base_words,
                target_words=selection.target_words,
                length=length,
                topic=cleaned_topic,
                base_truncated=selection.base_truncated,
            )
            usage_service = AiUsageService(self._db)
            if not await usage_service.is_request_admitted(
                user_id,
                build_provider_request(prompt, length),
            ):
                raise WeeklyBudgetExhaustedRefused()

        await self._supersede_processing(user_id)
        generation = Generation(
            user_id=user_id,
            provider=provider_name,
            anchor=anchor.value if anchor else None,
            requested_length=length,
            requested_targets=len(selection.target_lemma_ids),
            topic=cleaned_topic,
            outcome=GenerationOutcome.PROCESSING,
        )
        self._db.add(generation)
        await self._db.flush()

        return GenerationCreateResponse(
            generationId=generation.id,
            status="processing",
        )

    async def current(self, user_id: int) -> GenerationCurrentRead | None:
        generation = await self._latest_generation(user_id)
        if generation is None:
            return None
        return await self._generation_to_current(generation, user_id)

    async def prepare_import(
        self,
        user_id: int,
        title: str | None,
    ) -> ImportDraft:
        """Hand the ready generation's text to the import pipeline; flushes only."""
        generation = await self._latest_generation(user_id)
        if (
            generation is None
            or generation.outcome is not GenerationOutcome.READY
            or generation.text is None
        ):
            raise NotFoundError(
                "No ready generated story to import.",
                code="STORY_GENERATION_NOT_FOUND",
            )

        import_service = ImportService(self._db)
        return await import_service.create_from_generation(
            user_id=user_id,
            text=generation.text,
            pages=_deserialize_pages(generation.pages),
            title=title,
        )

    async def finalize_import(self, draft: ImportDraft) -> ImportItemRead:
        """Publish the import's post-commit effects after the route's commit."""
        return await ImportService(self._db).finalize_import(draft)

    async def _supersede_processing(self, user_id: int) -> None:
        await self._db.execute(
            select(User.id).where(User.id == user_id).with_for_update()
        )
        await self._db.execute(
            update(Generation)
            .where(
                Generation.user_id == user_id,
                Generation.outcome == GenerationOutcome.PROCESSING,
            )
            .values(
                outcome=GenerationOutcome.FAILED,
                failure_code=StoryGenerationErrorCode.GENERATION_ABANDONED,
                failure_message=_SUPERSEDED_MESSAGE,
            )
            .execution_options(synchronize_session=False)
        )

    async def _latest_generation(self, user_id: int) -> Generation | None:
        generation = (
            (
                await self._db.execute(
                    select(Generation)
                    .where(Generation.user_id == user_id)
                    .order_by(Generation.created_at.desc(), Generation.id.desc())
                    .limit(1)
                )
            )
            .scalars()
            .first()
        )
        if generation is None:
            return None
        if generation.created_at < retention_cutoff():
            return None
        return generation

    async def _generation_to_current(
        self, generation: Generation, user_id: int
    ) -> GenerationCurrentRead:
        pages: list[GenerationPageRead] | None = None
        user_states: dict[str, UserLemmaState] = {}

        page_data = _deserialize_pages(generation.pages)
        if generation.outcome is GenerationOutcome.READY and page_data is not None:
            pages = [
                GenerationPageRead(
                    index=p.index,
                    content=p.content,
                    tokens=[
                        GenerationPageTokenRead(
                            word=t["word"],
                            start=t["start"],
                            end=t["end"],
                            lemmaUuid=_parse_uuid(t.get("lemmaUuid")),
                        )
                        for t in p.tokens
                    ],
                    wordCount=p.word_count,
                )
                for p in page_data
            ]

            all_tokens: list[dict] = []
            for p in page_data:
                all_tokens.extend(p.tokens)
            user_states = await resolve_user_states_for_tokens(
                all_tokens, user_id, self._user_vocabulary_queries
            )

        return GenerationCurrentRead(
            generationId=generation.id,
            status=generation.outcome.value,
            provider=generation.provider,
            anchor=generation.anchor,
            length=generation.requested_length or 0,
            topic=generation.topic,
            pages=pages,
            userStates=user_states,
            failureCode=generation.failure_code,
            failureMessage=generation.failure_message,
        )


def _validate_length(length: int) -> None:
    if length < 1 or length > settings.STORY_GENERATION_MAX_LENGTH:
        raise LengthOutOfRangeRefused()


def _parse_uuid(value: str | None) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(value)
    except (ValueError, AttributeError):
        return None


def _deserialize_pages(raw: list | None) -> list[PageData] | None:
    if raw is None:
        return None
    return [
        PageData(
            index=item["index"],
            content=item["content"],
            tokens=item["tokens"],
            word_count=item["word_count"],
        )
        for item in raw
    ]
