"""Worker execution for one story generation run."""

import asyncio
import logging
import time
from collections.abc import Awaitable
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.types import AggregateUsageScope
from flyt.apps.ai_usage.types import AiUsageAdmission
from flyt.apps.ai_usage.types import AiUsageRefusalReason
from flyt.apps.ai_usage.window import calculate_utc_window_start
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.constants import provider_failure_code
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.prompt import build_prompt
from flyt.apps.story_generation.prompt import build_provider_request
from flyt.apps.story_generation.prompt import strip_markup
from flyt.apps.story_generation.prompt import validate_topic
from flyt.apps.story_generation.quality import measure
from flyt.apps.story_generation.quality import resolve_lemma_ids
from flyt.apps.story_generation.retention import retention_cutoff
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import VocabularySelection
from flyt.apps.story_generation.vocabulary import VocabularyService
from flyt.apps.story_generation.vocabulary import has_unknown_targets
from flyt.apps.reading.annotation import build_pages
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.reading.import_text import word_count
from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.exceptions import TopicTooLongRefused
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderFailure
from flyt.clients.registry import ProviderRegistry
from flyt.clients.registry import ProviderSelection
from flyt.core.config import settings

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
    selection: VocabularySelection
    provider_name: str
    request: GenerationRequest


class GenerationExecution:
    """One pipeline run against one generation; fully initialized."""

    def __init__(
        self,
        db: AsyncSession,
        generation: Generation,
    ) -> None:
        self._db = db
        self._generation = generation
        self._generation_id = generation.id
        self._user_id = generation.user_id

    async def prepare_generation(
        self,
    ) -> tuple[PreparedGeneration, ModelProvider] | None:
        prepared = await self._prepare_generation()
        if prepared is None:
            return None

        provider_selection = await self._resolve_provider(prepared.provider_name)
        if provider_selection is None:
            return None

        if await self._claim_generation() is None:
            return None

        if provider_selection.funded_by_flyt:
            admission = await self._consume_story_budget(prepared)
            if not admission.admitted:
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
        cannot interrupt it or let a superseded result overwrite a newer
        request's row state.
        """
        started_at = time.monotonic()
        try:
            result = await provider.generate(self._user_id, prepared.request)
        except ProviderFailure as exc:
            await self._run_finalization(
                asyncio.create_task(
                    self._finalize_provider_failure(
                        provider,
                        prepared.provider_name,
                        exc,
                        started_at,
                        commit,
                    )
                )
            )
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
        await self._run_finalization(finalization_task)

    async def record_failure(
        self,
        code: str,
        message: str,
        *,
        claimed: bool | None = None,
    ) -> None:
        outcome = (
            GenerationOutcome.REFUSED
            if code in _REFUSAL_CODES
            else GenerationOutcome.FAILED
        )
        statement = update(Generation).where(
            Generation.id == self._generation_id,
            Generation.outcome == GenerationOutcome.PROCESSING,
        )
        if claimed is not None:
            statement = statement.where(Generation.worker_claim == claimed)
        await self._db.execute(
            statement.values(
                outcome=outcome,
                failure_code=code,
                failure_message=message,
            ).execution_options(synchronize_session=False)
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
                self._generation_id,
                prepared.provider_name,
                await provider.model_for(self._user_id),
                result,
                started_at,
            )

            await self._persist_generation_result(prepared.selection, result)
            await commit()
        except Exception:
            await self._db.rollback()
            try:
                await self.record_failure(
                    StoryGenerationErrorCode.GENERATION_FAILED,
                    "Generation failed.",
                    claimed=True,
                )
                await commit()
            except Exception:
                logger.exception(
                    "Could not record failed generation %s after finalization error",
                    self._generation_id,
                )
            raise

    async def _run_finalization(self, finalization_task: asyncio.Task[None]) -> None:
        """Await a finalization so cancellation cannot interrupt it.

        A cancelled caller waits for the finalization to finish before the
        cancellation propagates, so the durable outcome, the provider
        request row, and the debit land together.
        """
        try:
            await asyncio.shield(finalization_task)
        except asyncio.CancelledError:
            await self._wait_for_finalization_after_cancellation(finalization_task)
            raise

    async def _finalize_provider_failure(
        self,
        provider: ModelProvider,
        provider_name: str,
        exc: ProviderFailure,
        started_at: float,
        commit: Callable[[], Awaitable[None]],
    ) -> None:
        await self._record_provider_failure(
            provider,
            provider_name,
            exc,
            started_at,
        )
        await commit()

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

    async def _claim_generation(self) -> int | None:
        result = await self._db.execute(
            update(Generation)
            .where(
                Generation.id == self._generation_id,
                Generation.outcome == GenerationOutcome.PROCESSING,
                Generation.worker_claim.is_(False),
                Generation.created_at >= retention_cutoff(),
            )
            .values(worker_claim=True)
            .returning(Generation.id)
            .execution_options(synchronize_session=False)
        )
        return result.scalar_one_or_none()

    async def _prepare_generation(self) -> PreparedGeneration | None:
        generation = self._generation
        anchor = AnchorType(generation.anchor) if generation.anchor else None
        length = generation.requested_length or 0
        try:
            topic = validate_topic(generation.topic)
        except TopicTooLongRefused:
            await self.record_failure(
                StoryGenerationErrorCode.TOPIC_TOO_LONG,
                "Topic exceeds the maximum length.",
                claimed=False,
            )
            return None

        selection = await VocabularyService(self._db).select(
            self._user_id, anchor, length
        )
        if not has_unknown_targets(selection):
            await self.record_failure(
                StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH,
                "Anchor has nothing left to teach.",
                claimed=False,
            )
            return None

        prompt = build_prompt(
            base_words=selection.base_words,
            target_words=selection.target_words,
            length=length,
            topic=topic,
            base_truncated=selection.base_truncated,
        )
        return PreparedGeneration(
            selection=selection,
            provider_name=generation.provider,
            request=build_provider_request(prompt, length),
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
                claimed=False,
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
            prepared.request,
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
                claimed=True,
            )
            return admission

        return admission

    async def _record_provider_failure(
        self,
        provider: ModelProvider,
        provider_name: str,
        exc: ProviderFailure,
        started_at: float,
    ) -> None:
        self._record_provider_request(
            self._generation_id,
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
    ) -> None:
        normalized = normalize_text(strip_markup(result.text))
        pages = await build_pages(self._db, normalized)
        uuid_to_id = await resolve_lemma_ids(self._db, pages)
        quality = measure(
            pages, selection.classifier, uuid_to_id, selection.target_lemma_ids
        )

        update_result = await self._db.execute(
            update(Generation)
            .where(
                Generation.id == self._generation_id,
                Generation.outcome == GenerationOutcome.PROCESSING,
                Generation.worker_claim.is_(True),
            )
            .values(
                outcome=GenerationOutcome.READY,
                text=normalized,
                pages=_serialize_pages(pages),
                mastered_lemma_count=quality.mastered_lemma_count,
                in_progress_lemma_count=quality.in_progress_lemma_count,
                unknown_lemma_count=quality.unknown_lemma_count,
                mastered_token_count=quality.mastered_token_count,
                in_progress_token_count=quality.in_progress_token_count,
                unknown_token_count=quality.unknown_token_count,
                lexical_token_count=quality.lexical_token_count,
                target_occurrences=quality.target_occurrences,
                produced_length=word_count(normalized),
                unresolved_token_rate=quality.unresolved_token_rate,
            )
            .returning(Generation.id)
            .execution_options(synchronize_session=False)
        )
        if update_result.scalar_one_or_none() is None:
            logger.info(
                "Generation %s result discarded: superseded", self._generation_id
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


def _serialize_pages(pages: list[PageData]) -> list[dict]:
    return [
        {
            "index": page.index,
            "content": page.content,
            "tokens": page.tokens,
            "word_count": page.word_count,
        }
        for page in pages
    ]
