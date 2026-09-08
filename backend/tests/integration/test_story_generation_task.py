import asyncio
from unittest.mock import AsyncMock
from unittest.mock import patch

import pytest
import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy import text

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.slot import GenerationSlotStore
from flyt.apps.story_generation.slot import SlotRequest
from flyt.apps.story_generation.tasks import generate_story
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.registry import ProviderSelection
from flyt.core.config import settings
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.helpers.redis import validate_local_redis_url

pytestmark = pytest.mark.anyio

_NAMESPACE = "story_generation"
K_POST_DISPATCH_COMMIT = 2
K_EXPECTED_COMMIT_CALLS = 3


@pytest.fixture
async def redis_client():
    validate_local_redis_url(settings.REDIS_URL)
    client = aioredis.from_url(settings.REDIS_URL)
    try:
        await client.ping()
    except Exception:
        pytest.skip("Redis not available")

    keys = await client.keys(f"{_NAMESPACE}:slot:*")
    if keys:
        await client.delete(*keys)

    yield client

    keys = await client.keys(f"{_NAMESPACE}:slot:*")
    if keys:
        await client.delete(*keys)
    await client.aclose()


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


async def create_generation(db, user_id: int) -> Generation:
    gen = Generation(
        user_id=user_id,
        anchor="frequency",
        requested_length=250,
        requested_targets=3,
        outcome=GenerationOutcome.PROCESSING,
    )
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


async def test_generate_story_given_anchor_exhausted_expect_refused_before_provider(
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

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

    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.status == "refused"
    assert slot.failure_code == StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH
    assert await get_usage_row(db, user.id) is None


async def test_generate_story_given_overlong_topic_expect_refused_before_provider(
    db, redis_client, monkeypatch
) -> None:
    """R-015: an overlong topic is refused before any provider is called and
    consumes no budget."""
    user = await UserFactory.create_async()
    lemma = await LemmaFactory.create(frequency_rank=1)
    await LemmaFactory.create(frequency_rank=2)
    await LemmaFactory.create(frequency_rank=3)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=lemma.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    long_topic = "x" * (settings.STORY_GENERATION_TOPIC_MAX_LENGTH + 1)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=long_topic,
        ),
    )

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

    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.status == "refused"
    assert slot.failure_code == StoryGenerationErrorCode.TOPIC_TOO_LONG
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
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: FakeRegistry(),
    )

    await generate_story({}, gen.id)

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

    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


class CrashingProvider:
    model = "test-model"
    limited_by_flyt = True

    async def generate(self, user_id, request):
        raise RuntimeError("boom")


async def test_generate_story_given_unexpected_exception_expect_failed_recorded_without_reraise(
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class CrashingRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=CrashingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: CrashingRegistry(),
    )

    await generate_story({}, gen.id)

    assert gen.outcome is GenerationOutcome.FAILED
    assert gen.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    assert gen.produced_length is None

    slot = await slot_store.read(user.id)
    assert slot.status == "failed"

    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_post_dispatch_commit_failure_expect_failed_recovery_committed(
    db, redis_client, monkeypatch
) -> None:
    user = await UserFactory.create_async()
    user_id = user.id
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    generation = await create_generation(db, user_id)
    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user_id,
        generation.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class ReadyRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: ReadyRegistry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.service.build_pages",
        AsyncMock(return_value=[]),
    )

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
    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    slot = await slot_store.read(user_id)
    assert slot is not None
    assert slot.status == "failed"


async def test_generate_story_given_cancellation_expect_tokens_debited(
    db, redis_client, monkeypatch
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
    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        generation.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )
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
        "flyt.apps.story_generation.service.ProviderRegistry",
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


async def test_generate_story_given_supersession_before_debit_expect_no_usage(
    db, redis_client, monkeypatch
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
    slot_store = GenerationSlotStore(redis=redis_client)
    request = SlotRequest(
        provider="openrouter",
        anchor="frequency",
        length=250,
        topic=None,
    )
    await slot_store.mint(user.id, generation.id, request)

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
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: Registry(),
    )

    async def supersede_before_debit(self, user_id, generation_id):
        await slot_store.mint(user.id, generation.id + 1, request)
        return False

    monkeypatch.setattr(
        GenerationSlotStore,
        "has_current_worker_slot_claim",
        supersede_before_debit,
    )

    await generate_story({}, generation.id)

    assert provider_called is False
    assert await get_usage_row(db, user.id) is None
    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.generation_id == generation.id + 1


async def test_generate_story_given_post_provider_cancellation_expect_finalized(
    db, redis_client, monkeypatch
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
    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        generation.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )
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
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.service.build_pages",
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

    assert generation.outcome is GenerationOutcome.READY
    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.status == "ready"
    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_finalization_failure_after_cancellation_expect_failed_slot_and_debit_kept(
    db, redis_client, monkeypatch
) -> None:
    """A finalization failure after cancellation must still record the terminal
    failed outcome in the slot, not leave Redis processing behind."""
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
    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user_id,
        generation.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )
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
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.service.build_pages",
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

    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    persisted_outcome = await db.scalar(
        select(Generation.outcome).where(Generation.id == generation_id)
    )
    assert persisted_outcome is GenerationOutcome.FAILED
    slot = await slot_store.read(user_id)
    assert slot is not None
    assert slot.status == "failed"
    assert slot.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    usage = await get_usage_row(db, user_id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_cancellation_during_finalization_commit_expect_ready_published_only_after_commit(
    db, redis_client, monkeypatch
) -> None:
    """A cancellation landing on the finalization commit must let that commit
    finish inside the protected finalization, so the ready slot is never
    published ahead of the committed Generation and provider-request rows."""
    user = await UserFactory.create_async()
    user_id = user.id
    await seed_teachable_frequency_anchor(db, user_id)

    generation = await create_generation(db, user_id)
    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user_id,
        generation.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class Registry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: Registry(),
    )
    monkeypatch.setattr(
        "flyt.apps.story_generation.service.build_pages",
        AsyncMock(return_value=[]),
    )

    commit_started, release_commit, commit_finished = (
        asyncio.Event(),
        asyncio.Event(),
        asyncio.Event(),
    )
    ready_published_before_commit_finished = False
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

    original_write_ready = GenerationSlotStore.write_ready

    async def probing_write_ready(self, user_id, generation_id, text, pages):
        nonlocal ready_published_before_commit_finished
        ready_published_before_commit_finished = not commit_finished.is_set()
        return await original_write_ready(self, user_id, generation_id, text, pages)

    monkeypatch.setattr(GenerationSlotStore, "write_ready", probing_write_ready)

    generation_id = generation.id
    task = asyncio.create_task(generate_story({}, generation_id))
    await commit_started.wait()
    task.cancel()
    release_commit.set()
    await asyncio.wait_for(commit_finished.wait(), timeout=5)

    with pytest.raises(asyncio.CancelledError):
        await task

    assert (
        ready_published_before_commit_finished is False
        and commit_calls == K_POST_DISPATCH_COMMIT
    )
    persisted_outcome = await db.scalar(
        select(Generation.outcome).where(Generation.id == generation_id)
    )
    assert persisted_outcome is GenerationOutcome.READY
    provider_request = await db.scalar(
        select(ProviderRequest).where(ProviderRequest.generation_id == generation_id)
    )
    assert provider_request is not None
    assert provider_request.outcome is ProviderRequestOutcome.SUCCESS
    slot = await slot_store.read(user_id)
    assert slot is not None
    assert slot.status == "ready"
    usage = await get_usage_row(db, user_id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_second_invocation_after_terminal_outcome_expect_no_second_debit(
    db, redis_client, monkeypatch
) -> None:
    """R-007: a re-issued job (the failure mode arq retries caused) debits
    exactly once. After the terminal outcome is recorded the fence rejects a
    second invocation with the same generation id, so spend cannot multiply."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        await LemmaFactory.create(frequency_rank=rank)
    known = await LemmaFactory.create(frequency_rank=6)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    gen = await create_generation(db, user.id)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class CrashingRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=CrashingProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
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
    slot = await slot_store.read(user.id)
    assert slot.status == "failed"


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
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

    monkeypatch.setattr(
        "flyt.apps.story_generation.tasks.AsyncSessionLocal",
        FakeSessionLocal(db),
    )

    class ReadyRegistry:
        async def resolve(self, name, user_id):
            return ProviderSelection(provider=ReadyFlytProvider(), funded_by_flyt=True)

    monkeypatch.setattr(
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: ReadyRegistry(),
    )

    with patch(
        "flyt.apps.story_generation.service.build_pages",
        new=AsyncMock(return_value=[]),
    ):
        await generate_story({}, gen.id)

    assert gen.outcome is GenerationOutcome.READY
    usage = await get_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_generate_story_given_exhausted_weekly_budget_expect_refused_before_provider(
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

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
    slot = await slot_store.read(user.id)
    assert slot.status == "refused"
    assert slot.failure_code == StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED
    assert gen.outcome is GenerationOutcome.REFUSED


async def test_generate_story_given_aggregate_budget_refusal_expect_no_charge(
    db, redis_client, monkeypatch
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

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="openrouter",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

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
    slot = await slot_store.read(user.id)
    assert slot.status == "refused"
    assert slot.failure_code == StoryGenerationErrorCode.AGGREGATE_CEILING_REACHED
    usage = await get_usage_row(db, user.id)
    assert usage is None


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
    db, redis_client, monkeypatch
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

    gen = await create_generation(db, user.id)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        gen.id,
        SlotRequest(
            provider="chatgpt",
            anchor="frequency",
            length=250,
            topic=None,
        ),
    )

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
        "flyt.apps.story_generation.service.ProviderRegistry",
        lambda _db: ChatGPTRegistry(),
    )

    with patch(
        "flyt.apps.story_generation.service.build_pages",
        new=AsyncMock(return_value=[]),
    ):
        await generate_story({}, gen.id)

    assert gen.outcome is GenerationOutcome.READY
    assert await get_usage_row(db, user.id) is None

    slot = await slot_store.read(user.id)
    assert slot.status == "ready"
