import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy import update

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.service import GenerationService
from flyt.apps.story_generation.tasks import generate_story
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.types import UserRole
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.registry import ProviderSelection
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal
from flyt.libs.utils.date import now
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory

pytestmark = pytest.mark.anyio

K_POST_DISPATCH_COMMIT = 2
K_EXPECTED_COMMIT_CALLS = 3


class FakeSessionLocal:
    def __init__(self, db):
        self._db = db

    def __call__(self):
        return FakeSession(self._db)


class FakeSession:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *args):
        pass


async def create_generation(db, user_id: int, **overrides) -> Generation:
    values = {
        "user_id": user_id,
        "provider": "openrouter",
        "anchor": "frequency",
        "requested_length": 250,
        "requested_targets": 3,
        "topic": None,
        "outcome": GenerationOutcome.PROCESSING,
    }
    values.update(overrides)
    gen = Generation(**values)
    db.add(gen)
    await db.flush()
    return gen


async def seed_teachable_frequency_anchor(db, user_id: int) -> None:
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user_id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()


async def get_usage_row(db, user_id: int) -> FlytAiUsage | None:
    return await db.scalar(select(FlytAiUsage).where(FlytAiUsage.user_id == user_id))


async def refresh_generation(db, generation: Generation) -> Generation:
    await db.refresh(generation)
    return generation


async def test_generate_story_given_anchor_exhausted_expect_refused_before_provider(
    db, monkeypatch
) -> None:
    """R-001/R-010: an anchor with nothing left to teach refuses before any
    provider is called and before any budget is consumed."""
    user = await UserFactory.create_async()

    for rank in range(1, 6):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    gen = await create_generation(db, user.id)

    provider_called = False

    async def _never_called(*args, **kwargs):
        nonlocal provider_called
        provider_called = True

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    with patch(
        "flyt.clients.openrouter.OpenRouterProvider.generate",
        new=AsyncMock(side_effect=_never_called),
    ):
        await generate_story({}, gen.id)

    assert provider_called is False

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.REFUSED
    assert gen.failure_code == StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH
    assert await get_usage_row(db, user.id) is None


async def test_generate_story_given_overlong_topic_expect_refused_before_provider(
    db, monkeypatch
) -> None:
    """R-015: an overlong topic is refused before any provider is called and
    consumes no budget. The request boundary keeps stored topics within the
    column bound, so the worker guard is exercised by tightening the setting
    below an already-stored topic."""
    user = await UserFactory.create_async()
    lemma = await LemmaFactory.create(frequency_rank=1)
    await LemmaFactory.create(frequency_rank=2)
    await LemmaFactory.create(frequency_rank=3)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=lemma.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id, topic="x" * 11)
    monkeypatch.setattr(settings, "STORY_GENERATION_TOPIC_MAX_LENGTH", 10)

    provider_called = False

    async def _never_called(*args, **kwargs):
        nonlocal provider_called
        provider_called = True

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    with patch(
        "flyt.clients.openrouter.OpenRouterProvider.generate",
        new=AsyncMock(side_effect=_never_called),
    ):
        await generate_story({}, gen.id)

    assert provider_called is False

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.REFUSED
    assert gen.failure_code == StoryGenerationErrorCode.TOPIC_TOO_LONG
    assert await get_usage_row(db, user.id) is None


class FakeRegistry:
    async def resolve(self, name, user_id):
        return ProviderSelection(provider=FakeProvider(), funded_by_flyt=True)


class FakeProvider:
    model = "test-model"
    limited_by_flyt = True

    async def generate(self, user_id, request):
        raise ProviderFailure(
            ProviderFailureClass.TIMEOUT,
            "boom",
            upstream_identifier="gateway_timeout",
        )

    async def model_for(self, user_id):
        return "test-model"


async def test_generate_story_given_provider_failure_expect_quality_fields_null(
    db, monkeypatch
) -> None:
    """R-001/R-007: a failed generation records no fabricated quality numbers
    and keeps its admitted token debit."""
    user = await UserFactory.create_async()

    lemma = await LemmaFactory.create(frequency_rank=1)
    for rank in range(2, 6):
        await LemmaFactory.create(frequency_rank=rank)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=lemma.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: FakeRegistry(),
    )

    await generate_story({}, gen.id)

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.FAILED
    assert gen.failure_code == StoryGenerationErrorCode.PROVIDER_TIMEOUT
    assert gen.mastered_lemma_count is None
    assert gen.in_progress_lemma_count is None
    assert gen.unknown_lemma_count is None
    assert gen.mastered_token_count is None
    assert gen.in_progress_token_count is None
    assert gen.unknown_token_count is None
    assert gen.lexical_token_count is None
    assert gen.target_occurrences is None
    assert gen.unresolved_token_rate is None
    assert gen.produced_length is None
    assert gen.text is None
    assert gen.pages is None

    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


class CrashingProvider:
    model = "test-model"
    limited_by_flyt = True

    async def generate(self, user_id, request):
        raise RuntimeError("boom")


async def test_generate_story_given_unexpected_exception_expect_failed_recorded_without_reraise(
    db, monkeypatch
) -> None:
    """R-007: a crash outside the provider taxonomy records FAILED instead of
    leaving a row that claims success. The terminal outcome is recorded and the
    job returns normally so arq does not retry (and re-spend) on a dead
    generation."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class CrashingRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=CrashingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: CrashingRegistry(),
    )

    await generate_story({}, gen.id)

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.FAILED
    assert gen.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    assert gen.produced_length is None

    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_post_dispatch_commit_failure_expect_failed_recovery_committed(
    db, monkeypatch
) -> None:
    user = await UserFactory.create_async()
    user_id = user.id
    await seed_teachable_frequency_anchor(db, user_id)

    generation = await create_generation(db, user_id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class ReadyRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: ReadyRegistry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.build_pages",
        AsyncMock(return_value=[]),
    )

    from sqlalchemy import text

    original_commit = db.commit
    commit_calls = 0

    async def fail_post_dispatch_commit() -> None:
        nonlocal commit_calls
        commit_calls += 1
        if commit_calls == K_POST_DISPATCH_COMMIT:
            await db.execute(text("SELECT 1 / 0"))
        await original_commit()

    monkeypatch.setattr(db, "commit", fail_post_dispatch_commit)

    await generate_story({}, generation.id)

    assert commit_calls == K_EXPECTED_COMMIT_CALLS
    generation = await refresh_generation(db, generation)
    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_FAILED


async def test_generate_story_given_cancellation_expect_tokens_debited(
    db, monkeypatch
) -> None:
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    generation = await create_generation(db, user.id)
    started = asyncio.Event()
    blocked = asyncio.Event()

    class BlockingProvider:
        model = "test-model"

        async def generate(self, user_id, request):
            started.set()
            await blocked.wait()

        async def model_for(self, user_id):
            return "test-model"

    class BlockingRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=BlockingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: BlockingRegistry(),
    )

    task = asyncio.create_task(generate_story({}, generation.id))
    await started.wait()
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_supersession_before_claim_expect_no_usage(
    db, monkeypatch
) -> None:
    """A generation superseded before the worker's conditional claim debits
    nothing and dispatches nothing."""
    user = await UserFactory.create_async()
    await seed_teachable_frequency_anchor(db, user.id)

    generation = await create_generation(db, user.id)
    await db.execute(
        update(Generation)
        .where(Generation.id == generation.id)
        .values(
            outcome=GenerationOutcome.FAILED,
            failure_code=StoryGenerationErrorCode.GENERATION_ABANDONED,
        )
        .execution_options(synchronize_session=False)
    )
    await db.flush()

    provider_called = False

    class NeverCalledProvider:
        async def generate(self, user_id, request):
            nonlocal provider_called
            provider_called = True

        async def model_for(self, user_id):
            return "test-model"

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(
                provider=NeverCalledProvider(), funded_by_flyt=True
            )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )

    await generate_story({}, generation.id)

    assert provider_called is False
    assert await get_usage_row(db, user.id) is None
    generation = await refresh_generation(db, generation)
    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_ABANDONED


async def test_generate_story_given_post_provider_cancellation_expect_finalized(
    db, monkeypatch
) -> None:
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    generation = await create_generation(db, user.id)
    started = asyncio.Event()
    release = asyncio.Event()

    class ReadyProvider:
        async def generate(self, user_id, request):
            return GenerationResult(
                text="Det var en gang en katt.",
                prompt_tokens=120,
                completion_tokens=80,
            )

        async def model_for(self, user_id):
            return "test-model"

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyProvider(), funded_by_flyt=True)

    async def block_page_building(db, content):
        started.set()
        await release.wait()
        return []

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.build_pages",
        block_page_building,
    )

    task = asyncio.create_task(generate_story({}, generation.id))
    await started.wait()
    task.cancel()
    await asyncio.sleep(0)
    assert task.done() is False
    release.set()

    with pytest.raises(asyncio.CancelledError):
        await task

    generation = await refresh_generation(db, generation)
    assert generation.outcome is GenerationOutcome.READY
    assert generation.text == "Det var en gang en katt."
    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_finalization_failure_after_cancellation_expect_failed_outcome_and_debit_kept(
    db, monkeypatch
) -> None:
    """A finalization failure after cancellation must still record the terminal
    failed outcome, not leave the generation processing."""
    user = await UserFactory.create_async()
    user_id = user.id
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user_id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    generation = await create_generation(db, user_id)
    started = asyncio.Event()
    release = asyncio.Event()

    class ReadyProvider:
        async def generate(self, user_id, request):
            return GenerationResult(
                text="Det var en gang en katt.",
                prompt_tokens=120,
                completion_tokens=80,
            )

        async def model_for(self, user_id):
            return "test-model"

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyProvider(), funded_by_flyt=True)

    async def page_building_that_fails_once_released(db, content):
        started.set()
        await release.wait()
        raise RuntimeError("page processing failed")

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.build_pages",
        page_building_that_fails_once_released,
    )

    generation_id = generation.id
    task = asyncio.create_task(generate_story({}, generation_id))
    await started.wait()
    task.cancel()
    await asyncio.sleep(0)
    assert task.done() is False
    release.set()

    with pytest.raises(asyncio.CancelledError):
        await task

    persisted_outcome = await db.scalar(
        select(Generation.outcome).where(Generation.id == generation_id)
    )
    assert persisted_outcome is GenerationOutcome.FAILED
    persisted_failure = await db.scalar(
        select(Generation.failure_code).where(Generation.id == generation_id)
    )
    assert persisted_failure == StoryGenerationErrorCode.GENERATION_FAILED
    usage = await get_usage_row(db, user_id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_cancellation_during_finalization_commit_expect_ready_durable(
    db, monkeypatch
) -> None:
    """A cancellation landing on the finalization commit must let that commit
    finish inside the protected finalization, so the ready outcome and provider
    request row are durable before the cancellation propagates."""
    user = await UserFactory.create_async()
    user_id = user.id
    await seed_teachable_frequency_anchor(db, user_id)

    generation = await create_generation(db, user_id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.build_pages",
        AsyncMock(return_value=[]),
    )

    commit_started, release_commit, commit_finished = (
        asyncio.Event(),
        asyncio.Event(),
        asyncio.Event(),
    )
    commit_calls = 0
    original_commit = db.commit

    async def commit_that_cancels_during_finalization() -> None:
        nonlocal commit_calls
        commit_calls += 1
        if commit_calls == K_POST_DISPATCH_COMMIT:
            commit_started.set()
            await release_commit.wait()
            await original_commit()
            commit_finished.set()
            return
        await original_commit()

    monkeypatch.setattr(db, "commit", commit_that_cancels_during_finalization)

    generation_id = generation.id
    task = asyncio.create_task(generate_story({}, generation_id))
    await commit_started.wait()
    task.cancel()
    release_commit.set()
    await asyncio.wait_for(commit_finished.wait(), timeout=5)

    with pytest.raises(asyncio.CancelledError):
        await task

    assert commit_calls == K_POST_DISPATCH_COMMIT
    persisted_outcome = await db.scalar(
        select(Generation.outcome).where(Generation.id == generation_id)
    )
    assert persisted_outcome is GenerationOutcome.READY
    provider_request = await db.scalar(
        select(ProviderRequest).where(ProviderRequest.generation_id == generation_id)
    )
    assert provider_request is not None
    assert provider_request.outcome is ProviderRequestOutcome.SUCCESS
    usage = await get_usage_row(db, user_id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_cancellation_during_provider_failure_commit_expect_failure_durable(
    db, monkeypatch
) -> None:
    """A cancellation landing on the provider-failure finalization commit must
    let that commit finish inside the shielded finalization, so the failed
    outcome, the provider request row, and the spent debit are all durable
    before the cancellation propagates."""
    user = await UserFactory.create_async()
    user_id = user.id
    lemma = await LemmaFactory.create(frequency_rank=1)
    for rank in range(2, 6):
        await LemmaFactory.create(frequency_rank=rank)
    await UserLemmaFactory.create_async(
        user_id=user_id, lemma_id=lemma.id, is_mastered=True
    )
    await db.flush()

    generation = await create_generation(db, user_id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: FakeRegistry(),
    )

    commit_started, release_commit, commit_finished = (
        asyncio.Event(),
        asyncio.Event(),
        asyncio.Event(),
    )
    commit_calls = 0
    original_commit = db.commit

    async def commit_that_blocks_on_failure_finalization() -> None:
        nonlocal commit_calls
        commit_calls += 1
        if commit_calls == K_POST_DISPATCH_COMMIT:
            commit_started.set()
            await release_commit.wait()
            await original_commit()
            commit_finished.set()
            return
        await original_commit()

    monkeypatch.setattr(db, "commit", commit_that_blocks_on_failure_finalization)

    generation_id = generation.id
    task = asyncio.create_task(generate_story({}, generation_id))
    await commit_started.wait()
    task.cancel()
    release_commit.set()
    await asyncio.wait_for(commit_finished.wait(), timeout=5)

    with pytest.raises(asyncio.CancelledError):
        await task

    assert commit_calls == K_POST_DISPATCH_COMMIT
    persisted_outcome = await db.scalar(
        select(Generation.outcome).where(Generation.id == generation_id)
    )
    assert persisted_outcome is GenerationOutcome.FAILED
    provider_request = await db.scalar(
        select(ProviderRequest).where(ProviderRequest.generation_id == generation_id)
    )
    assert provider_request is not None
    assert provider_request.outcome is ProviderRequestOutcome.FAILURE
    assert provider_request.failure_class == "timeout"
    persisted_failure = await db.scalar(
        select(Generation.failure_code).where(Generation.id == generation_id)
    )
    assert persisted_failure == StoryGenerationErrorCode.PROVIDER_TIMEOUT
    usage = await get_usage_row(db, user_id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_second_invocation_after_terminal_outcome_expect_no_second_debit(
    db, monkeypatch
) -> None:
    """R-007: a re-issued job (the failure mode arq retries caused) debits
    exactly once. After the terminal outcome is recorded the claim update
    rejects a second invocation with the same generation id, so spend cannot
    multiply."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class CrashingRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=CrashingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: CrashingRegistry(),
    )

    consume_calls = []
    original_consume = AiUsageService.consume_tokens

    async def _counting_consume(self, user_id, tokens, aggregate=None):
        consume_calls.append(tokens)
        return await original_consume(self, user_id, tokens, aggregate)

    with patch.object(AiUsageService, "consume_tokens", _counting_consume):
        await generate_story({}, gen.id)
        await generate_story({}, gen.id)

    assert len(consume_calls) == 1
    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens == usage.budget_tokens - consume_calls[0]
    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.FAILED


class ReadyFlytProvider:
    name = "openrouter"
    model = "test-model"

    async def generate(self, user_id, request):
        return GenerationResult(
            text="Det var en gang en katt.",
            prompt_tokens=120,
            completion_tokens=80,
        )

    async def model_for(self, user_id):
        return "test-model"


async def test_generate_story_given_flyt_success_expect_usage_debited(
    db, monkeypatch
) -> None:
    """A funded generation consumes its conservative request estimate."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class ReadyRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: ReadyRegistry(),
    )

    with patch(
        "flyt.apps.story_generation.execution.build_pages",
        new=AsyncMock(return_value=[]),
    ):
        await generate_story({}, gen.id)

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.READY
    assert gen.text == "Det var en gang en katt."
    assert gen.pages == []
    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_exhausted_weekly_budget_expect_refused_before_provider(
    db, monkeypatch
) -> None:
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", 10)

    provider_called = False

    async def _never_called(*args, **kwargs):
        nonlocal provider_called
        provider_called = True

    with patch(
        "flyt.clients.openrouter.OpenRouterProvider.generate",
        new=AsyncMock(side_effect=_never_called),
    ):
        await generate_story({}, gen.id)

    assert provider_called is False
    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.REFUSED
    assert gen.failure_code == StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED


async def test_generate_story_given_aggregate_budget_refusal_expect_no_charge(
    db, monkeypatch
) -> None:
    """The aggregate token budget refuses before dispatch without a learner charge."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(settings, "STORY_GENERATION_AGGREGATE_TOKEN_BUDGET", 1)

    provider_called = False

    async def _never_called(*args, **kwargs):
        nonlocal provider_called
        provider_called = True

    with patch(
        "flyt.clients.openrouter.OpenRouterProvider.generate",
        new=AsyncMock(side_effect=_never_called),
    ):
        await generate_story({}, gen.id)

    assert provider_called is False
    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.REFUSED
    assert gen.failure_code == StoryGenerationErrorCode.AGGREGATE_CEILING_REACHED
    assert await get_usage_row(db, user.id) is None


class ReadyChatGPTProvider:
    name = "chatgpt"
    model = "gpt-default"

    async def generate(self, user_id, request):
        return GenerationResult(
            text="Det var en gang en katt.",
            prompt_tokens=10,
            completion_tokens=20,
        )

    async def model_for(self, user_id):
        return "gpt-linked"


async def test_generate_story_given_unfunded_provider_expect_no_usage_debit(
    db, monkeypatch
) -> None:
    """R-103: a linked-account provider is never limited by Flyt usage."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id, provider="chatgpt")

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class ChatGPTRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(
                provider=ReadyChatGPTProvider(), funded_by_flyt=False
            )

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: ChatGPTRegistry(),
    )

    with patch(
        "flyt.apps.story_generation.execution.build_pages",
        new=AsyncMock(return_value=[]),
    ):
        await generate_story({}, gen.id)

    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.READY
    assert await get_usage_row(db, user.id) is None


async def test_generate_story_given_stale_queued_generation_expect_no_debit_and_no_provider(
    db, monkeypatch
) -> None:
    """A job delayed past the retention cutoff can no longer produce a result
    the learner can poll: the worker claim refuses the stale row, so nothing
    is debited and no provider is called; the settlement command keeps owning
    the row."""
    user = await UserFactory.create_async()
    await seed_teachable_frequency_anchor(db, user.id)

    gen = await create_generation(
        db,
        user.id,
        created_at=now()
        - timedelta(hours=settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS + 1),
    )

    provider_called = False

    class NeverCalledProvider:
        model = "test-model"

        async def generate(self, user_id, request):
            nonlocal provider_called
            provider_called = True

        async def model_for(self, user_id):
            return "test-model"

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(
                provider=NeverCalledProvider(), funded_by_flyt=True
            )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )

    await generate_story({}, gen.id)

    assert provider_called is False
    assert await get_usage_row(db, user.id) is None
    gen = await refresh_generation(db, gen)
    assert gen.outcome is GenerationOutcome.PROCESSING
    assert gen.worker_claim is False


async def test_generate_story_given_supersession_before_claim_expect_no_debit_and_no_dispatch(
    setup_database, monkeypatch
) -> None:
    """A replacement request committed by an independent session before the
    worker's conditional claim: the superseded worker dispatches no provider
    call, commits no debit, and the replacement stays processing."""
    user_id, generation_id = await _create_committed_generation_for_sync_test()
    worker_waiting = asyncio.Event()
    release_worker = asyncio.Event()
    interleaving: list[str] = []

    class NeverCalledProvider:
        model = "test-model"

        async def generate(self, user_id, request):
            raise AssertionError("provider must not be called")

        async def model_for(self, user_id):
            return "test-model"

    class PausingRegistry:
        async def resolve(self, name, user_id):
            interleaving.append("worker_waiting")
            worker_waiting.set()
            await release_worker.wait()
            return ProviderSelection(
                provider=NeverCalledProvider(), funded_by_flyt=True
            )

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: PausingRegistry(),
    )

    try:
        worker = asyncio.create_task(generate_story({}, generation_id))
        await asyncio.wait_for(worker_waiting.wait(), timeout=5)

        async with AsyncSessionLocal() as request_db:
            replacement = await GenerationService(request_db).request_generation(
                user_id=user_id,
                provider_name="openrouter",
                anchor=AnchorType.FREQUENCY,
                length=250,
                topic=None,
            )
            await request_db.commit()
        interleaving.append("replacement_committed")
        release_worker.set()
        await asyncio.wait_for(worker, timeout=5)

        async with AsyncSessionLocal() as verify_db:
            usage = await verify_db.scalar(
                select(FlytAiUsage).where(FlytAiUsage.user_id == user_id)
            )
            assert usage is None
            superseded = await verify_db.get(Generation, generation_id)
            assert superseded is not None
            assert superseded.outcome is GenerationOutcome.FAILED
            assert (
                superseded.failure_code == StoryGenerationErrorCode.GENERATION_ABANDONED
            )
            assert superseded.worker_claim is False
            replacement_row = await verify_db.get(Generation, replacement.generationId)
            assert replacement_row is not None
            assert replacement_row.outcome is GenerationOutcome.PROCESSING
        assert interleaving == ["worker_waiting", "replacement_committed"]
    finally:
        await _cleanup_committed_sync_test(user_id)


async def test_generate_story_given_claim_and_debit_before_supersession_expect_debit_kept_and_result_discarded(
    setup_database, monkeypatch
) -> None:
    """A replacement request committed by an independent session after the
    worker's claim/debit transaction: the provider call happened and its debit
    stays spent, but the superseded row keeps the abandonment failure and the
    late result is discarded."""
    user_id, generation_id = await _create_committed_generation_for_sync_test()
    dispatched = asyncio.Event()
    release_provider = asyncio.Event()
    provider_calls = 0

    class SucceedingProvider:
        model = "test-model"

        async def generate(self, user_id, request):
            nonlocal provider_calls
            provider_calls += 1
            dispatched.set()
            await release_provider.wait()
            return GenerationResult(
                text="Det var en gang en katt.",
                prompt_tokens=120,
                completion_tokens=80,
            )

        async def model_for(self, user_id):
            return "test-model"

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=SucceedingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.execution.build_pages",
        AsyncMock(return_value=[]),
    )

    try:
        worker = asyncio.create_task(generate_story({}, generation_id))
        await asyncio.wait_for(dispatched.wait(), timeout=5)

        async with AsyncSessionLocal() as request_db:
            replacement = await GenerationService(request_db).request_generation(
                user_id=user_id,
                provider_name="openrouter",
                anchor=AnchorType.FREQUENCY,
                length=250,
                topic=None,
            )
            await request_db.commit()
        release_provider.set()
        await asyncio.wait_for(worker, timeout=5)

        async with AsyncSessionLocal() as verify_db:
            usage = await verify_db.scalar(
                select(FlytAiUsage).where(FlytAiUsage.user_id == user_id)
            )
            assert usage is not None
            assert usage.remaining_tokens < usage.budget_tokens
            superseded = await verify_db.get(Generation, generation_id)
            assert superseded is not None
            assert superseded.outcome is GenerationOutcome.FAILED
            assert (
                superseded.failure_code == StoryGenerationErrorCode.GENERATION_ABANDONED
            )
            assert superseded.worker_claim is True
            assert superseded.text is None
            provider_request = await verify_db.scalar(
                select(ProviderRequest).where(
                    ProviderRequest.generation_id == generation_id
                )
            )
            assert provider_request is not None
            assert provider_request.outcome is ProviderRequestOutcome.SUCCESS
            replacement_row = await verify_db.get(Generation, replacement.generationId)
            assert replacement_row is not None
            assert replacement_row.outcome is GenerationOutcome.PROCESSING
        assert provider_calls == 1
    finally:
        await _cleanup_committed_sync_test(user_id)


async def _create_committed_generation_for_sync_test() -> tuple[int, int]:
    async with AsyncSessionLocal() as seed_db:
        user = User(
            uuid=uuid4(),
            email=f"gen-sync-{uuid4()}@example.com",
            display_name="Generation sync test",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        seed_db.add(user)
        await seed_db.flush()
        lemmas = [
            Lemma(
                word=f"gen-sync-{rank}-{uuid4()}",
                pos=LemmaPos.NOUN,
                hgno=1,
                frequency_rank=rank,
            )
            for rank in range(1, 7)
        ]
        seed_db.add_all(lemmas)
        await seed_db.flush()
        seed_db.add(
            UserLemma(user_id=user.id, lemma_id=lemmas[-1].id, is_mastered=True)
        )
        generation = Generation(
            user_id=user.id,
            provider="openrouter",
            anchor="frequency",
            requested_length=250,
            requested_targets=3,
            topic=None,
            outcome=GenerationOutcome.PROCESSING,
        )
        seed_db.add(generation)
        await seed_db.commit()
        return user.id, generation.id


async def _cleanup_committed_sync_test(user_id: int) -> None:
    async with AsyncSessionLocal() as cleanup_db:
        await cleanup_db.execute(delete(User).where(User.id == user_id))
        await cleanup_db.execute(delete(Lemma).where(Lemma.word.like("gen-sync-%")))
        await cleanup_db.commit()
