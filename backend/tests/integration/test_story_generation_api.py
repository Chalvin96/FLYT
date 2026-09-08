"""Integration tests for the story generation API surface.

Tests cover: surface endpoint, request generation (with/without topic, refusals),
poll status (processing/ready/failed/refused), provider choices with usage signals,
and the topic-escape security fix.
"""

from http import HTTPStatus

import pytest
import redis.asyncio as aioredis
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.slot import GenerationSlotStore
from flyt.apps.story_generation.slot import SlotRequest
from flyt.core.config import settings
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.helpers.auth import authenticate
from tests.helpers.redis import validate_local_redis_url

pytestmark = pytest.mark.anyio

_NAMESPACE = "story_generation"
K_EXPECTED_ANCHOR_COUNT = 3
K_TEST_GENERATION_ID = 42
K_EXPECTED_REMAINING_PERCENT = 76
K_FULL_REMAINING_PERCENT = 100
K_TEST_SNAPSHOT_BUDGET = 100_000


@pytest.fixture
async def redis_client():
    validate_local_redis_url(settings.REDIS_URL)
    client = aioredis.from_url(settings.REDIS_URL)
    try:
        await client.ping()
    except Exception:
        pytest.skip("Redis not available")

    keys = await client.keys(f"{_NAMESPACE}:*")
    if keys:
        await client.delete(*keys)

    yield client

    keys = await client.keys(f"{_NAMESPACE}:*")
    if keys:
        await client.delete(*keys)
    await client.aclose()


@pytest.fixture(autouse=True)
def disable_enqueue(monkeypatch):
    async def _noop(name: str, *args):
        return None

    monkeypatch.setattr("flyt.apps.story_generation.router.enqueue_job", _noop)


def build_pages() -> list[PageData]:
    return [
        PageData(
            index=0,
            content="Det var en gang en katt.",
            tokens=[
                {"word": "Det", "start": 0, "end": 3, "lemmaUuid": None},
                {"word": "var", "start": 4, "end": 7, "lemmaUuid": None},
            ],
            word_count=7,
        )
    ]


async def seed_frequency_lemmas(
    db: AsyncSession, user_id: int, count: int, known: bool = True
) -> None:
    for rank in range(1, count + 1):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user_id, lemma_id=lemma.id, is_mastered=known
        )
    await db.flush()


async def test_surface_given_authenticated_expect_providers_and_anchors(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-012/R-103/R-013: the surface presents provider choices with the
    Flyt-only weekly percentage and the anchor choices with length options and
    topic suggestions."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 5)
    await authenticate(client, user)

    resp = await client.get("/story-generation")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert len(body["providers"]) >= 1
    or_choice = next(p for p in body["providers"] if p["name"] == "openrouter")
    assert or_choice["available"] is True
    assert or_choice["limitedByFlyt"] is True
    assert or_choice["remainingPercent"] == K_FULL_REMAINING_PERCENT
    assert "allowance" not in or_choice
    assert '"remaining":' not in resp.text
    assert "unlimited" not in resp.text
    assert len(body["anchors"]) == K_EXPECTED_ANCHOR_COUNT
    assert body["minDeckSize"] == settings.STORY_GENERATION_MIN_DECK_SIZE
    assert body["lengthOptions"] == settings.STORY_GENERATION_LENGTH_OPTIONS
    assert len(body["topicSuggestions"]) > 0


async def test_create_generation_given_no_topic_expect_accepted(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001/R-013: a story requested without a topic is accepted and pollable."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency", "length": 250},
    )

    assert resp.status_code == HTTPStatus.ACCEPTED, resp.text
    body = resp.json()
    assert body["status"] == "processing"
    assert body["generationId"] > 0

    slot_store = GenerationSlotStore(redis=redis_client)
    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.status == "processing"
    assert slot.topic is None


async def test_create_generation_given_topic_expect_topic_in_slot(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: a supplied topic is carried with the request."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={
            "provider": "openrouter",
            "anchor": "frequency",
            "length": 250,
            "topic": "En dag på skolen",
        },
    )

    assert resp.status_code == HTTPStatus.ACCEPTED, resp.text
    slot_store = GenerationSlotStore(redis=redis_client)
    slot = await slot_store.read(user.id)
    assert slot is not None
    assert slot.topic == "En dag på skolen"


async def test_create_generation_given_overlong_topic_expect_refused(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-015: an overlong topic is refused before any provider is called."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    long_topic = "x" * (settings.STORY_GENERATION_TOPIC_MAX_LENGTH + 1)

    resp = await client.post(
        "/story-generation/generations",
        json={
            "provider": "openrouter",
            "anchor": "frequency",
            "length": 250,
            "topic": long_topic,
        },
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    detail = resp.json()["detail"]
    assert detail["code"] == "STORY_GENERATION_TOPIC_TOO_LONG"

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_create_generation_given_unsupported_length_expect_refused(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-108: a length outside the configured options is refused before any
    provider call, so no token spend is recorded."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency", "length": 999},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "STORY_GENERATION_LENGTH_OUT_OF_RANGE"

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_create_generation_given_exhausted_weekly_budget_expect_refused(
    client: AsyncClient, db: AsyncSession, redis_client, monkeypatch
) -> None:
    """R-001: an exhausted weekly budget is refused at request time, with no
    pollable generation."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", 10)

    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency", "length": 250},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "STORY_GENERATION_ALLOWANCE_EXHAUSTED"

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_refusal_given_refused_request_expect_no_pollable_generation(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: a refused request creates no generation to poll."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    long_topic = "x" * (settings.STORY_GENERATION_TOPIC_MAX_LENGTH + 1)
    resp = await client.post(
        "/story-generation/generations",
        json={
            "provider": "openrouter",
            "anchor": "frequency",
            "length": 250,
            "topic": long_topic,
        },
    )
    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    poll = await client.get("/story-generation/generations/current")
    assert poll.status_code == HTTPStatus.OK
    assert poll.json() is None


async def test_create_generation_given_unavailable_provider_expect_refused(
    client: AsyncClient, db: AsyncSession, redis_client, monkeypatch
) -> None:
    """R-001/R-012: an unavailable provider refuses the request at request time."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    monkeypatch.setattr(settings, "STORY_GENERATION_ENABLED_PROVIDERS", ["openrouter"])

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "chatgpt", "anchor": "frequency", "length": 250},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "STORY_GENERATION_PROVIDER_UNAVAILABLE"

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_create_generation_given_unknown_anchor_expect_rejected(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: an anchor that is not one of the offered types is rejected at the
    boundary, so no story is built on an anchor the learner never chose."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "bogus", "length": 250},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    errors = resp.json()["detail"]
    assert [error["loc"] for error in errors] == [["body", "anchor"]]

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_create_generation_given_missing_length_expect_rejected(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """A length is always picked from the offered options, so a request without
    one is rejected at the boundary."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency"},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    errors = resp.json()["detail"]
    assert [error["loc"] for error in errors] == [["body", "length"]]

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_create_generation_given_anchor_all_known_expect_refused(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-010: an anchor with nothing left to teach refuses instead of producing
    an all-known story."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency", "length": 250},
    )

    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "STORY_GENERATION_ANCHOR_NOTHING_TO_TEACH"

    slot_store = GenerationSlotStore(redis=redis_client)
    assert await slot_store.read(user.id) is None


async def test_current_given_ready_slot_expect_pages(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001/R-004: a ready generation is readable with annotated pages."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id,
        K_TEST_GENERATION_ID,
        SlotRequest("openrouter", "frequency", 250, None),
    )
    pages = build_pages()
    await slot_store.write_ready(
        user.id, K_TEST_GENERATION_ID, "Det var en gang en katt.", pages
    )

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    assert body["generationId"] == K_TEST_GENERATION_ID
    assert body["pages"] is not None
    assert len(body["pages"]) == 1
    assert body["pages"][0]["tokens"][0]["word"] == "Det"


async def test_current_given_failed_slot_expect_failure_code(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: a failed generation reports a classified reason, not partial text."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id, 10, SlotRequest("openrouter", "frequency", 250, None)
    )
    await slot_store.write_failed(
        user.id, 10, "STORY_GENERATION_FAILED", "Provider timed out"
    )

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["status"] == "failed"
    assert body["failureCode"] == "STORY_GENERATION_FAILED"
    assert body["pages"] is None


async def test_current_given_refused_slot_expect_refused_status(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: a refusal reports a status distinct from failure."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id, 10, SlotRequest("openrouter", "frequency", 250, None)
    )
    await slot_store.write_refused(
        user.id,
        10,
        "STORY_GENERATION_ALLOWANCE_EXHAUSTED",
        "This story could not be started right now.",
    )

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["status"] == "refused"
    assert body["failureCode"] == "STORY_GENERATION_ALLOWANCE_EXHAUSTED"


async def test_surface_given_partial_budget_use_expect_remaining_percentage(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-103: the weekly percentage is reported before a request is made."""
    user = await UserFactory.create_async()
    await authenticate(client, user)
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=calculate_utc_week_start(),
            remaining_tokens=K_TEST_SNAPSHOT_BUDGET - 23_001,
            budget_tokens=K_TEST_SNAPSHOT_BUDGET,
        )
    )
    await db.flush()

    resp = await client.get("/story-generation")

    assert resp.status_code == HTTPStatus.OK
    or_choice = next(p for p in resp.json()["providers"] if p["name"] == "openrouter")
    assert or_choice["remainingPercent"] == K_EXPECTED_REMAINING_PERCENT
    assert "allowance" not in or_choice


async def test_surface_given_learner_funded_provider_expect_no_usage_field(
    client: AsyncClient, db: AsyncSession, monkeypatch
) -> None:
    """R-103/R-012: a learner-funded provider reports no Flyt usage at all."""
    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await db.flush()
    await authenticate(client, user)

    from flyt.apps.chatgpt_link.models import ChatGPTLinkState
    from tests.factories import ChatGPTLinkFactory

    await ChatGPTLinkFactory.create_async(
        user_id=user.id, state=ChatGPTLinkState.WORKING
    )
    await db.flush()

    monkeypatch.setattr(
        settings, "STORY_GENERATION_ENABLED_PROVIDERS", ["openrouter", "chatgpt"]
    )

    resp = await client.get("/story-generation")

    assert resp.status_code == HTTPStatus.OK
    chatgpt = next(p for p in resp.json()["providers"] if p["name"] == "chatgpt")
    assert chatgpt["available"] is True
    assert chatgpt["limitedByFlyt"] is False
    assert "remainingPercent" not in chatgpt
    assert "allowance" not in chatgpt
    assert "unlimited" not in resp.text


async def test_surface_given_unlinked_chatgpt_expect_locked_with_action(
    client: AsyncClient, db: AsyncSession, monkeypatch
) -> None:
    """R-012: an unavailable provider is shown with the step that enables it and
    is not offered as a selectable choice."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    monkeypatch.setattr(
        settings, "STORY_GENERATION_ENABLED_PROVIDERS", ["openrouter", "chatgpt"]
    )

    resp = await client.get("/story-generation")

    assert resp.status_code == HTTPStatus.OK
    chatgpt = next(p for p in resp.json()["providers"] if p["name"] == "chatgpt")
    assert chatgpt["available"] is False
    assert chatgpt["reason"] == "not_linked"
    assert chatgpt["action"] == "link_account"


async def test_generating_given_no_import_expect_quota_unchanged(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-005: a generated story never counts as an import."""
    from sqlalchemy import select

    from flyt.apps.reading.models import ImportQuota

    user = await UserFactory.create_async()
    await seed_frequency_lemmas(db, user.id, 3, known=True)
    await LemmaFactory.create(frequency_rank=10)
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/story-generation/generations",
        json={"provider": "openrouter", "anchor": "frequency", "length": 250},
    )
    assert resp.status_code == HTTPStatus.ACCEPTED

    quota = await db.scalar(
        select(ImportQuota.used).where(ImportQuota.user_id == user.id)
    )
    assert quota is None


async def test_current_given_no_slot_expect_null(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-001: with no generation, polling reports no current generation."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK
    assert resp.json() is None


async def test_current_given_processing_slot_expect_processing(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    """R-001: an in-flight generation reports processing."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id, 99, SlotRequest("openrouter", "frequency", 250, "katter")
    )

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK
    body = resp.json()
    assert body["status"] == "processing"
    assert body["topic"] == "katter"
    assert body["pages"] is None


async def test_current_given_ready_slot_with_known_and_unknown_lemmas_expect_resolved_user_states(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    user = await UserFactory.create_async()
    known_lemma = await LemmaFactory.create()
    unknown_lemma = await LemmaFactory.create()
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known_lemma.id, is_mastered=True
    )
    await db.flush()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id, 42, SlotRequest("openrouter", "frequency", 250, None)
    )
    pages = [
        PageData(
            index=0,
            content="Katt hund.",
            tokens=[
                {
                    "word": "Katt",
                    "start": 0,
                    "end": 4,
                    "lemmaUuid": str(known_lemma.uuid),
                },
                {
                    "word": "hund",
                    "start": 5,
                    "end": 9,
                    "lemmaUuid": str(unknown_lemma.uuid),
                },
            ],
            word_count=2,
        )
    ]
    await slot_store.write_ready(user.id, 42, "Katt hund.", pages)

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    user_states = body["userStates"]
    assert user_states[str(known_lemma.uuid)] == "mastered"
    assert user_states[str(unknown_lemma.uuid)] == "new"


async def test_current_given_processing_slot_expect_empty_user_states(
    client: AsyncClient, db: AsyncSession, redis_client
) -> None:
    user = await UserFactory.create_async()
    known_lemma = await LemmaFactory.create()
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known_lemma.id, is_mastered=True
    )
    await db.flush()
    await authenticate(client, user)

    slot_store = GenerationSlotStore(redis=redis_client)
    await slot_store.mint(
        user.id, 77, SlotRequest("openrouter", "frequency", 250, None)
    )

    resp = await client.get("/story-generation/generations/current")

    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["status"] == "processing"
    assert body["userStates"] == {}
