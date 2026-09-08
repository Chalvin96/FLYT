import asyncio
import logging
import time
from collections.abc import Awaitable
from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.types import AggregateUsageScope
from flyt.apps.ai_usage.types import AiUsageAdmission
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.ai_usage.types import AiUsageRefusalReason
from flyt.apps.ai_usage.window import calculate_utc_window_start
from flyt.apps.story_generation.constants import K_ESTIMATED_OUTPUT_TOKENS_PER_WORD
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.constants import provider_failure_code
from flyt.apps.story_generation.exceptions import WeeklyBudgetExhaustedRefused
from flyt.apps.story_generation.exceptions import AnchorExhaustedRefused
from flyt.apps.story_generation.exceptions import LengthOutOfRangeRefused
from flyt.apps.story_generation.exceptions import ProviderUnavailableRefused
from flyt.apps.story_generation.exceptions import TopicTooLongRefused
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.prompt import GenerationPrompt
from flyt.apps.story_generation.prompt import build_prompt
from flyt.apps.story_generation.prompt import strip_markup
from flyt.apps.story_generation.prompt import topic_suggestions
from flyt.apps.story_generation.prompt import validate_topic
from flyt.apps.story_generation.quality import measure
from flyt.apps.story_generation.quality import resolve_lemma_ids
from flyt.apps.story_generation.schemas import AnchorChoiceRead
from flyt.apps.story_generation.schemas import GenerationCreateResponse
from flyt.apps.story_generation.schemas import GenerationCurrentRead
from flyt.apps.story_generation.schemas import GenerationPageRead
from flyt.apps.story_generation.schemas import GenerationPageTokenRead
from flyt.apps.story_generation.schemas import GenerationSurfaceRead
from flyt.apps.story_generation.schemas import ProviderChoiceRead
from flyt.apps.story_generation.slot import GenerationSlotStore
from flyt.apps.story_generation.slot import SlotData
from flyt.apps.story_generation.slot import SlotRequest
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import VocabularySelection
from flyt.apps.story_generation.vocabulary import VocabularyService
from flyt.apps.story_generation.vocabulary import has_unknown_targets
from flyt.apps.reading.schemas import ImportItemRead
from flyt.apps.reading.import_service import ImportDraft
from flyt.apps.reading.import_service import ImportService
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.reading.import_text import word_count
from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.reading.tokenization import PageData
from flyt.apps.reading.annotation import build_pages
from flyt.apps.reading.vocabulary import resolve_user_states_for_tokens
from flyt.apps.users.services import UserVocabularyQueries
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderFailure
from flyt.clients.registry import ProviderRegistry
from flyt.clients.registry import ProviderSelection
from flyt.core.config import settings
from flyt.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

_REFUSAL_CODES = frozenset(
    {
        StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED,
        StoryGenerationErrorCode.AGGREGATE_CEILING_REACHED,
        StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH,
        StoryGenerationErrorCode.TOPIC_TOO_LONG,
    }
)


@dataclass(frozen=True)
class PreparedGeneration:
    anchor: AnchorType | None
    length: int
    selection: VocabularySelection
    prompt: GenerationPrompt
    provider_name: str


class GenerationService:
    _slot_store: GenerationSlotStore
    _generation: Generation
    _generation_id: int
    _user_id: int

    def __init__(
        self,
        db: AsyncSession,
        user_vocabulary_queries: UserVocabularyQueries | None = None,
    ) -> None:
        self._db = db
        self._user_vocabulary_queries = (
            user_vocabulary_queries or UserVocabularyQueries(db)
        )

    @classmethod
    def for_generation(
        cls,
        db: AsyncSession,
        slot_store: GenerationSlotStore,
        generation: Generation,
    ) -> "GenerationService":
        """Worker-facing constructor: one pipeline run against one generation."""
        service = cls(db)
        service._slot_store = slot_store
        service._generation = generation
        # A rollback expires the ORM instance; this plain id must survive it.
        service._generation_id = generation.id
        service._user_id = generation.user_id
        return service

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
                AiUsageRequest(
                    instructions=prompt.instructions,
                    prompt=prompt.prompt,
                    max_tokens=length * K_ESTIMATED_OUTPUT_TOKENS_PER_WORD,
                ),
            ):
                raise WeeklyBudgetExhaustedRefused()

        generation = Generation(
            user_id=user_id,
            anchor=anchor.value if anchor else None,
            requested_length=length,
            requested_targets=len(selection.target_lemma_ids),
            outcome=GenerationOutcome.PROCESSING,
        )
        self._db.add(generation)
        await self._db.flush()

        slot_store = GenerationSlotStore()
        await slot_store.mint(
            user_id,
            generation.id,
            SlotRequest(
                provider=provider_name,
                anchor=anchor.value if anchor else None,
                length=length,
                topic=cleaned_topic,
            ),
        )

        return GenerationCreateResponse(
            generationId=generation.id,
            status="processing",
        )

    async def current(self, user_id: int) -> GenerationCurrentRead | None:
        slot_store = GenerationSlotStore()
        slot = await slot_store.read(user_id)
        if slot is None:
            return None
        return await self._slot_to_current(slot, user_id)

    async def prepare_import(
        self,
        user_id: int,
        title: str | None,
    ) -> ImportDraft:
        """Hand the ready slot's text to the import pipeline; flushes only."""
        slot_store = GenerationSlotStore()
        slot = await slot_store.read(user_id)
        if slot is None or slot.status != "ready" or slot.text is None:
            raise NotFoundError(
                "No ready generated story to import.",
                code="STORY_GENERATION_NOT_FOUND",
            )

        import_service = ImportService(self._db)
        return await import_service.create_from_generation(
            user_id=user_id,
            text=slot.text,
            pages=slot.pages,
            title=title,
        )

    async def finalize_import(self, draft: ImportDraft) -> ImportItemRead:
        """Publish the import's post-commit effects after the route's commit."""
        return await ImportService(self._db).finalize_import(draft)

    async def prepare_generation(
        self, slot: SlotData
    ) -> tuple[PreparedGeneration, ModelProvider] | None:
        """Admit one worker run through the durable-spend seam; None ends it.

        The arq entrypoint commits at this seam so the debit and the claimed
        generation parameters are durable before dispatch_generation calls
        the provider.
        """
        prepared = await self._prepare_generation(slot)
        if prepared is None:
            return None

        provider_selection = await self._resolve_provider(prepared.provider_name)
        if provider_selection is None:
            return None

        # Re-check the fence before claiming the worker slot, so a superseded job
        # stops before spending or dispatching.
        current_slot = await self._slot_store.read(self._user_id)
        if (
            current_slot is None
            or current_slot.status != "processing"
            or current_slot.generation_id != self._generation.id
        ):
            return None
        if not await self._slot_store.claim_worker_slot(
            self._user_id, self._generation.id
        ):
            return None

        self._generation.anchor = prepared.anchor.value if prepared.anchor else None
        self._generation.requested_length = prepared.length
        self._generation.requested_targets = len(prepared.selection.target_lemma_ids)

        admitted = await self._is_story_dispatch_admitted(
            prepared,
            provider_selection.funded_by_flyt,
        )
        if not admitted:
            return None

        return prepared, provider_selection.provider

    async def dispatch_generation(
        self,
        prepared: PreparedGeneration,
        provider: ModelProvider,
        commit: Callable[[], Awaitable[None]],
    ) -> None:
        """Call the provider and finalize; runs after the entrypoint's commit.

        The provider call stays open to cancellation. The shielded
        finalization owns the composition-root ``commit`` so a cancellation
        cannot interrupt it or publish the ready slot ahead of durable
        database state.
        """
        started_at = time.monotonic()
        try:
            result = await self._generate_text(
                provider,
                prepared.prompt,
                prepared.length,
            )
        except ProviderFailure as exc:
            await self._record_provider_failure(
                provider,
                prepared.provider_name,
                exc,
                started_at,
            )
            await commit()
            return

        finalization_task = asyncio.create_task(
            self._finalize_generation(
                prepared,
                provider,
                result,
                started_at,
                commit,
            )
        )
        try:
            await asyncio.shield(finalization_task)
        except asyncio.CancelledError:
            await self._wait_for_finalization_after_cancellation(finalization_task)
            raise

    async def record_failure(self, code: str, message: str) -> None:
        is_refusal = code in _REFUSAL_CODES
        self._generation.outcome = (
            GenerationOutcome.REFUSED if is_refusal else GenerationOutcome.FAILED
        )
        self._generation.failure_code = code
        self._generation.failure_message = message
        if is_refusal:
            await self._slot_store.write_refused(
                self._user_id, self._generation_id, code, message
            )
        else:
            await self._slot_store.write_failed(
                self._user_id, self._generation_id, code, message
            )

    async def _slot_to_current(
        self, slot: SlotData, user_id: int
    ) -> GenerationCurrentRead:
        pages: list[GenerationPageRead] | None = None
        user_states: dict[str, UserLemmaState] = {}

        if slot.status == "ready" and slot.pages is not None:
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
                for p in slot.pages
            ]

            all_tokens: list[dict] = []
            for p in slot.pages:
                all_tokens.extend(p.tokens)
            user_states = await resolve_user_states_for_tokens(
                all_tokens, user_id, self._user_vocabulary_queries
            )

        return GenerationCurrentRead(
            generationId=slot.generation_id,
            status=slot.status,
            provider=slot.provider,
            anchor=slot.anchor,
            length=slot.length,
            topic=slot.topic,
            pages=pages,
            userStates=user_states,
            failureCode=slot.failure_code,
            failureMessage=slot.failure_message,
        )

    async def _finalize_generation(
        self,
        prepared: PreparedGeneration,
        provider: ModelProvider,
        result: GenerationResult,
        started_at: float,
        commit: Callable[[], Awaitable[None]],
    ) -> None:
        try:
            self._record_provider_request_success(
                self._generation.id,
                prepared.provider_name,
                await provider.model_for(self._user_id),
                result,
                started_at,
            )

            normalized, pages = await self._persist_generation_result(
                prepared.selection,
                result,
            )
            await commit()
            await self._publish_ready_slot(normalized, pages)
        except Exception:
            await self._db.rollback()
            try:
                await self.record_failure(
                    StoryGenerationErrorCode.GENERATION_FAILED,
                    "Generation failed.",
                )
                await commit()
            except Exception:
                logger.exception(
                    "Could not record failed generation %s after finalization error",
                    self._generation_id,
                )
            raise

    async def _wait_for_finalization_after_cancellation(
        self, finalization_task: asyncio.Task[None]
    ) -> None:
        while True:
            try:
                await asyncio.shield(finalization_task)
                return
            except asyncio.CancelledError:
                continue
            except Exception:
                logger.exception(
                    "Story generation finalization failed after cancellation"
                )
                return

    async def _prepare_generation(self, slot: SlotData) -> PreparedGeneration | None:
        anchor = AnchorType(slot.anchor) if slot.anchor else None
        try:
            topic = validate_topic(slot.topic)
        except TopicTooLongRefused:
            await self.record_failure(
                StoryGenerationErrorCode.TOPIC_TOO_LONG,
                "Topic exceeds the maximum length.",
            )
            return None

        selection = await VocabularyService(self._db).select(
            self._user_id, anchor, slot.length
        )
        if not has_unknown_targets(selection):
            await self.record_failure(
                StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH,
                "Anchor has nothing left to teach.",
            )
            return None

        return PreparedGeneration(
            anchor=anchor,
            length=slot.length,
            selection=selection,
            prompt=build_prompt(
                base_words=selection.base_words,
                target_words=selection.target_words,
                length=slot.length,
                topic=topic,
                base_truncated=selection.base_truncated,
            ),
            provider_name=slot.provider,
        )

    async def _resolve_provider(self, provider_name: str) -> ProviderSelection | None:
        try:
            return await ProviderRegistry(self._db).resolve(
                provider_name, self._user_id
            )
        except ProviderFailure:
            await self.record_failure(
                StoryGenerationErrorCode.PROVIDER_UNAVAILABLE,
                f"Provider {provider_name} is unavailable.",
            )
            return None

    async def _consume_story_budget(
        self,
        prepared: PreparedGeneration,
    ) -> AiUsageAdmission:
        """Consume learner and provider aggregate token budgets atomically."""
        usage_service = AiUsageService(self._db)
        admission = await usage_service.admit_request(
            self._user_id,
            AiUsageRequest(
                instructions=prepared.prompt.instructions,
                prompt=prepared.prompt.prompt,
                max_tokens=prepared.length * K_ESTIMATED_OUTPUT_TOKENS_PER_WORD,
            ),
            aggregate=AggregateUsageScope(
                provider=prepared.provider_name,
                window_start=calculate_utc_window_start(
                    window_hours=settings.STORY_GENERATION_AGGREGATE_WINDOW_HOURS
                ),
                budget_tokens=settings.STORY_GENERATION_AGGREGATE_TOKEN_BUDGET,
            ),
        )
        if not admission.admitted:
            failure_code = (
                StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED
                if admission.refusal_reason is AiUsageRefusalReason.WEEKLY_BUDGET
                else StoryGenerationErrorCode.AGGREGATE_CEILING_REACHED
            )
            await self.record_failure(
                failure_code,
                "This story could not be started right now.",
            )
            return admission

        return admission

    async def _is_story_dispatch_admitted(
        self,
        prepared: PreparedGeneration,
        funded_by_flyt: bool,
    ) -> bool:
        if await self._slot_store.has_current_worker_slot_claim(
            self._user_id, self._generation.id
        ):
            if not funded_by_flyt:
                return True
            admission = await self._consume_story_budget(prepared)
            return admission.admitted
        return False

    async def _generate_text(
        self,
        provider: ModelProvider,
        prompt: GenerationPrompt,
        length: int,
    ) -> GenerationResult:
        return await provider.generate(
            self._user_id,
            GenerationRequest(
                instructions=prompt.instructions,
                prompt=prompt.prompt,
                max_tokens=length * K_ESTIMATED_OUTPUT_TOKENS_PER_WORD,
            ),
        )

    async def _record_provider_failure(
        self,
        provider: ModelProvider,
        provider_name: str,
        exc: ProviderFailure,
        started_at: float,
    ) -> None:
        self._record_provider_request(
            self._generation.id,
            provider_name,
            await provider.model_for(self._user_id),
            exc,
            started_at,
        )
        await self.record_failure(
            provider_failure_code(exc.failure_class),
            str(exc),
        )

    async def _persist_generation_result(
        self,
        selection: VocabularySelection,
        result: GenerationResult,
    ) -> tuple[str, list[PageData]]:
        generation = self._generation

        normalized = normalize_text(strip_markup(result.text))
        pages = await build_pages(self._db, normalized)
        uuid_to_id = await resolve_lemma_ids(self._db, pages)
        quality = measure(
            pages, selection.classifier, uuid_to_id, selection.target_lemma_ids
        )

        generation.outcome = GenerationOutcome.READY
        generation.mastered_lemma_count = quality.mastered_lemma_count
        generation.in_progress_lemma_count = quality.in_progress_lemma_count
        generation.unknown_lemma_count = quality.unknown_lemma_count
        generation.mastered_token_count = quality.mastered_token_count
        generation.in_progress_token_count = quality.in_progress_token_count
        generation.unknown_token_count = quality.unknown_token_count
        generation.lexical_token_count = quality.lexical_token_count
        generation.target_occurrences = quality.target_occurrences
        generation.produced_length = word_count(normalized)
        generation.unresolved_token_rate = quality.unresolved_token_rate

        return normalized, pages

    async def _publish_ready_slot(self, normalized: str, pages: list[PageData]) -> None:
        written = await self._slot_store.write_ready(
            self._user_id, self._generation_id, normalized, pages
        )
        if not written:
            logger.info(
                "Generation %s result discarded: slot superseded", self._generation_id
            )

    def _record_provider_request(
        self,
        generation_id: int,
        provider_name: str,
        model: str,
        exc: ProviderFailure,
        start: float,
    ) -> None:
        self._db.add(
            ProviderRequest(
                generation_id=generation_id,
                provider=provider_name,
                model=model,
                outcome=ProviderRequestOutcome.FAILURE,
                latency_ms=int((time.monotonic() - start) * 1000),
                failure_class=exc.failure_class.value,
                upstream_identifier=exc.upstream_identifier,
            )
        )

    def _record_provider_request_success(
        self,
        generation_id: int,
        provider_name: str,
        model: str,
        result: GenerationResult,
        start: float,
    ) -> None:
        self._db.add(
            ProviderRequest(
                generation_id=generation_id,
                provider=provider_name,
                model=model,
                outcome=ProviderRequestOutcome.SUCCESS,
                latency_ms=int((time.monotonic() - start) * 1000),
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
            )
        )


def _validate_length(length: int) -> None:
    # The ceiling is deliberately independent of the offered options: it bounds
    # max_tokens, and so per-request spend, even if the options are widened.
    if length < 1 or length > settings.STORY_GENERATION_MAX_LENGTH:
        raise LengthOutOfRangeRefused()


def _parse_uuid(value: str | None) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(value)
    except (ValueError, AttributeError):
        return None
