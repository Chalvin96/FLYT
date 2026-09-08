import asyncio

import pytest
import redis.asyncio as aioredis

from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.slot import GenerationSlotStore
from flyt.apps.story_generation.slot import SlotRequest
from flyt.core.config import settings
from tests.helpers.redis import validate_local_redis_url

pytestmark = pytest.mark.anyio

_NAMESPACE = "story_generation"
K_FIRST_GENERATION_ID = 100
K_SECOND_GENERATION_ID = 200
K_EXPECTED_PAGE_COUNT = 2
K_EXPECTED_SECOND_PAGE_WORD_COUNT = 2


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


@pytest.fixture
def slot_store(redis_client):
    return GenerationSlotStore(redis=redis_client)


def build_slot_request(**overrides) -> SlotRequest:
    defaults = {
        "provider": "openrouter",
        "anchor": "frequency",
        "length": 250,
        "topic": None,
    }
    defaults.update(overrides)
    return SlotRequest(**defaults)


def build_pages() -> list[PageData]:
    return [
        PageData(
            index=0,
            content="Det var en gang.",
            tokens=[{"word": "Det", "start": 0, "end": 3, "lemmaUuid": None}],
            word_count=4,
        )
    ]


async def test_slot_given_mint_then_read_expect_processing(slot_store) -> None:
    """R-001/R-014: a requested generation is pollable while in flight."""
    await slot_store.mint(1, 100, build_slot_request())

    slot = await slot_store.read(1)

    assert slot is not None
    assert slot.generation_id == K_FIRST_GENERATION_ID
    assert slot.status == "processing"
    assert slot.provider == "openrouter"


async def test_slot_given_mint_expect_positive_ttl(slot_store, redis_client) -> None:
    await slot_store.mint(1, 100, build_slot_request())

    ttl = await redis_client.ttl(f"{_NAMESPACE}:slot:1")

    assert 0 < ttl <= settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS * 3600


async def test_slot_given_write_ready_expect_text_and_pages_stored(slot_store) -> None:
    """R-001: a completed generation reports ready with its text and pages."""
    await slot_store.mint(1, 100, build_slot_request())
    pages = build_pages()

    written = await slot_store.write_ready(1, 100, "Det var en gang.", pages)

    assert written is True
    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.status == "ready"
    assert slot.text == "Det var en gang."
    assert slot.pages is not None
    assert len(slot.pages) == 1
    assert slot.pages[0].content == "Det var en gang."


async def test_slot_given_concurrent_claims_expect_one_owner(slot_store) -> None:
    """Only one overlapping worker may own a processing generation."""
    await slot_store.mint(1, K_FIRST_GENERATION_ID, build_slot_request())

    claims = await asyncio.gather(
        slot_store.claim_worker_slot(1, K_FIRST_GENERATION_ID),
        slot_store.claim_worker_slot(1, K_FIRST_GENERATION_ID),
    )

    assert sorted(claims) == [0, 1]


async def test_slot_given_claim_expect_read_check_does_not_mutate(slot_store) -> None:
    await slot_store.mint(1, K_FIRST_GENERATION_ID, build_slot_request())

    assert (
        await slot_store.has_current_worker_slot_claim(1, K_FIRST_GENERATION_ID)
    ) is False
    assert await slot_store.claim_worker_slot(1, K_FIRST_GENERATION_ID) == 1
    assert (
        await slot_store.has_current_worker_slot_claim(1, K_FIRST_GENERATION_ID)
    ) is True
    assert await slot_store.claim_worker_slot(1, K_FIRST_GENERATION_ID) == 0


async def test_slot_given_late_result_after_supersession_expect_discarded(
    slot_store,
) -> None:
    """R-014: a result from a superseded generation is discarded and the newer
    generation keeps the slot."""
    await slot_store.mint(1, 100, build_slot_request())
    await slot_store.mint(1, 200, build_slot_request())

    pages = build_pages()
    first_late = await slot_store.write_ready(1, 100, "First job result.", pages)
    second = await slot_store.write_ready(1, 200, "Second job result.", pages)

    assert first_late is False
    assert second is True

    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.text == "Second job result."


async def test_slot_given_ttl_expiry_expect_slot_absent(
    slot_store, redis_client
) -> None:
    """R-005: an un-imported generated story expires and leaves nothing behind."""
    await slot_store.mint(1, 100, build_slot_request())

    await redis_client.delete(f"{_NAMESPACE}:slot:1")

    slot = await slot_store.read(1)
    assert slot is None

    pages = build_pages()
    written = await slot_store.write_ready(1, 100, "Late result.", pages)
    assert written is False


async def test_slot_given_write_failed_expect_failure_stored(slot_store) -> None:
    """R-001: a generation that fails reports a classified failure."""
    await slot_store.mint(1, 100, build_slot_request())

    written = await slot_store.write_failed(
        1, 100, "STORY_GENERATION_FAILED", "Timeout"
    )

    assert written is True
    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.status == "failed"
    assert slot.failure_code == "STORY_GENERATION_FAILED"
    assert slot.failure_message == "Timeout"


async def test_slot_given_failed_after_supersession_expect_discarded(
    slot_store,
) -> None:
    """R-014: a late failure from a superseded generation is discarded."""
    await slot_store.mint(1, 100, build_slot_request())
    await slot_store.mint(1, 200, build_slot_request())

    written = await slot_store.write_failed(1, 100, "STORY_GENERATION_FAILED", "Old")

    assert written is False
    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.generation_id == K_SECOND_GENERATION_ID
    assert slot.status == "processing"


async def test_slot_given_concurrent_mints_expect_last_wins(slot_store) -> None:
    """R-014: a learner holds one slot; concurrent mints resolve to one owner."""
    await asyncio.gather(
        slot_store.mint(1, 100, build_slot_request()),
        slot_store.mint(1, 200, build_slot_request()),
        slot_store.mint(1, 300, build_slot_request()),
    )

    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.generation_id in (100, 200, 300)


async def test_slot_given_pages_roundtrip_expect_data_preserved(slot_store) -> None:
    """R-004/R-014: the slot preserves annotated pages so lookup works without
    re-importing."""
    await slot_store.mint(1, 100, build_slot_request())
    pages = [
        PageData(
            index=0,
            content="Første side.\n\nAndre avsnitt.",
            tokens=[
                {"word": "Første", "start": 0, "end": 6, "lemmaUuid": "abc-123"},
                {"word": "side", "start": 7, "end": 11, "lemmaUuid": None},
            ],
            word_count=4,
        ),
        PageData(
            index=1,
            content="Andre side.",
            tokens=[],
            word_count=2,
        ),
    ]

    await slot_store.write_ready(
        1, 100, "Første side.\n\nAndre avsnitt.\n\nAndre side.", pages
    )

    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.pages is not None
    assert len(slot.pages) == K_EXPECTED_PAGE_COUNT
    assert slot.pages[0].tokens[0]["lemmaUuid"] == "abc-123"
    assert slot.pages[1].word_count == K_EXPECTED_SECOND_PAGE_WORD_COUNT


async def test_slot_given_mint_after_ready_expect_previous_story_cleared(
    slot_store,
) -> None:
    await slot_store.mint(1, 100, build_slot_request())
    pages = build_pages()
    await slot_store.write_ready(1, 100, "First story.", pages)
    await slot_store.write_failed(1, 100, "STORY_GENERATION_FAILED", "Boom")

    await slot_store.mint(1, 200, build_slot_request())

    slot = await slot_store.read(1)
    assert slot is not None
    assert slot.generation_id == K_SECOND_GENERATION_ID
    assert slot.status == "processing"
    assert slot.text is None
    assert slot.pages is None
    assert slot.failure_code is None
    assert slot.failure_message is None
