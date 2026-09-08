import pytest
from sqlalchemy import select

from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from tests.factories import GenerationFactory
from tests.factories import ProviderRequestFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

K_EXPECTED_PROVIDER_REQUEST_COUNT = 2
K_EXPECTED_COMPLETION_TOKENS = 300
K_EXPECTED_MASTERED_LEMMA_COUNT = 100
K_EXPECTED_IN_PROGRESS_LEMMA_COUNT = 20
K_EXPECTED_UNKNOWN_LEMMA_COUNT = 5
K_EXPECTED_MASTERED_TOKEN_COUNT = 200
K_EXPECTED_IN_PROGRESS_TOKEN_COUNT = 40
K_EXPECTED_UNKNOWN_TOKEN_COUNT = 10
K_EXPECTED_LEXICAL_TOKEN_COUNT = 250


async def test_generation_given_multiple_provider_requests_expect_each_recorded_separately(
    db,
) -> None:
    """R-106: one generation issuing several provider requests records each
    request separately and attributed to that generation."""
    user = await UserFactory.create_async()
    generation = await GenerationFactory.create_async(
        user_id=user.id, outcome=GenerationOutcome.READY
    )
    await db.flush()

    first = await ProviderRequestFactory.create_async(
        generation_id=generation.id,
        outcome=ProviderRequestOutcome.FAILURE,
        provider="openrouter",
        model="deepseek-v4-flash",
        latency_ms=1500,
        failure_class="timeout",
        prompt_tokens=None,
        completion_tokens=None,
    )
    second = await ProviderRequestFactory.create_async(
        generation_id=generation.id,
        outcome=ProviderRequestOutcome.SUCCESS,
        provider="openrouter",
        model="deepseek-v4-flash",
        latency_ms=2000,
        prompt_tokens=120,
        completion_tokens=300,
    )
    await db.flush()

    requests = (
        (
            await db.execute(
                select(ProviderRequest)
                .where(ProviderRequest.generation_id == generation.id)
                .order_by(ProviderRequest.id)
            )
        )
        .scalars()
        .all()
    )

    assert len(requests) == K_EXPECTED_PROVIDER_REQUEST_COUNT
    assert {r.id for r in requests} == {first.id, second.id}
    assert requests[0].outcome is ProviderRequestOutcome.FAILURE
    assert requests[0].failure_class == "timeout"
    assert requests[1].outcome is ProviderRequestOutcome.SUCCESS
    assert requests[1].completion_tokens == K_EXPECTED_COMPLETION_TOKENS


async def test_generation_given_outcome_persisted_expect_readable(db) -> None:
    """R-007: a generation persists its quality signals so they survive the
    session."""
    user = await UserFactory.create_async()
    generation = await GenerationFactory.create_async(
        user_id=user.id,
        outcome=GenerationOutcome.FAILED,
        failure_code="STORY_GENERATION_PROVIDER_TIMEOUT",
        mastered_lemma_count=100,
        in_progress_lemma_count=20,
        unknown_lemma_count=5,
        mastered_token_count=200,
        in_progress_token_count=40,
        unknown_token_count=10,
        lexical_token_count=250,
        target_occurrences={11: 2, 12: 0},
    )
    await db.flush()

    refreshed = await db.get(Generation, generation.id)

    assert refreshed is not None
    assert refreshed.outcome is GenerationOutcome.FAILED
    assert refreshed.failure_code == "STORY_GENERATION_PROVIDER_TIMEOUT"
    assert refreshed.mastered_lemma_count == K_EXPECTED_MASTERED_LEMMA_COUNT
    assert refreshed.in_progress_lemma_count == K_EXPECTED_IN_PROGRESS_LEMMA_COUNT
    assert refreshed.unknown_lemma_count == K_EXPECTED_UNKNOWN_LEMMA_COUNT
    assert refreshed.mastered_token_count == K_EXPECTED_MASTERED_TOKEN_COUNT
    assert refreshed.in_progress_token_count == K_EXPECTED_IN_PROGRESS_TOKEN_COUNT
    assert refreshed.unknown_token_count == K_EXPECTED_UNKNOWN_TOKEN_COUNT
    assert refreshed.lexical_token_count == K_EXPECTED_LEXICAL_TOKEN_COUNT
    assert refreshed.target_occurrences == {11: 2, 12: 0}


async def test_provider_request_given_failed_outcome_expect_failure_fields_set(
    db,
) -> None:
    """R-104/R-106: a failed provider request records its classified failure and
    upstream identifier."""
    user = await UserFactory.create_async()
    generation = await GenerationFactory.create_async(user_id=user.id)
    await db.flush()

    request = await ProviderRequestFactory.create_async(
        generation_id=generation.id,
        outcome=ProviderRequestOutcome.FAILURE,
        failure_class="authentication",
        upstream_identifier="invalid_api_key",
        latency_ms=200,
        prompt_tokens=None,
        completion_tokens=None,
    )
    await db.flush()

    refreshed = await db.get(ProviderRequest, request.id)

    assert refreshed is not None
    assert refreshed.outcome is ProviderRequestOutcome.FAILURE
    assert refreshed.failure_class == "authentication"
    assert refreshed.upstream_identifier == "invalid_api_key"
