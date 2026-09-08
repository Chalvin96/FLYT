"""Integration tests for the import ingress + listing API."""

from datetime import timedelta
from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.reading import import_service as service_module
from flyt.apps.reading import import_router as router_module
from flyt.apps.reading.constants import IMPORT_LIMIT
from flyt.apps.reading.constants import MAX_PAGE_LIMIT
from flyt.apps.reading.constants import STALE_AFTER
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportQuota
from flyt.apps.reading.models import ImportStatus
from flyt.libs.utils.date import now
from tests.factories import ReadingGroupFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def no_enqueue(monkeypatch) -> None:
    """Ingress enqueues the worker; stub it so tests need no Redis."""

    async def _noop(name: str, *args) -> None:
        return None

    monkeypatch.setattr(service_module, "enqueue_job", _noop)
    monkeypatch.setattr(router_module, "enqueue_job", _noop)


async def import_meta(db: AsyncSession, import_id: str) -> ImportMeta:
    user_story = (
        await db.execute(select(UserStory).where(UserStory.uuid == import_id))
    ).scalar_one()
    return (
        await db.execute(
            select(ImportMeta).where(ImportMeta.story_id == user_story.story_id)
        )
    ).scalar_one()


async def test_create_paste_given_authenticated_expect_pending_item(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.post("/imports", json={"text": "Hei på deg. En norsk tekst."})

    # Assert
    assert resp.status_code == HTTPStatus.CREATED, resp.text
    body = resp.json()
    assert body["status"] == ImportStatus.PENDING.value
    assert body["title"]  # non-null (content-derived or provided)
    assert body["wordCount"] > 0
    assert body["pageCount"] is None  # not ready yet
    user_story = await db.scalar(select(UserStory).where(UserStory.uuid == body["id"]))
    assert user_story is not None
    assert user_story.uuid is not None
    assert user_story.last_page_index == 0
    assert user_story.completed is False
    story = await db.get(Story, user_story.story_id)
    assert story is not None
    assert story.visibility is StoryVisibility.PRIVATE
    assert story.is_ready is False


async def test_create_paste_given_unauthenticated_expect_401(
    client: AsyncClient,
) -> None:
    resp = await client.post("/imports", json={"text": "noe tekst"})
    assert resp.status_code == HTTPStatus.UNAUTHORIZED


async def test_create_paste_given_missing_text_field_expect_422_not_500(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: body is valid JSON but missing the required `text` field. Pydantic
    # binding rejects it with FastAPI's standard 422 validation response.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    resp = await client.post("/imports", json={"title": "no text here"})
    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_create_paste_given_empty_text_expect_422_empty(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    resp = await client.post("/imports", json={"text": "   \n  "})
    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    detail = resp.json()["detail"]
    assert detail["code"] == "IMPORT_EMPTY"
    assert set(detail.keys()) == {"code", "message", "error"}


async def test_create_paste_given_oversized_text_expect_413(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    big = "ord " * 30_000
    resp = await client.post("/imports", json={"text": big})
    assert resp.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert resp.json()["detail"]["code"] == "IMPORT_TOO_LARGE"


async def test_create_extension_given_bad_source_url_expect_422(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/imports/extension",
        json={"text": "tekst", "source_url": "javascript:alert(1)"},
    )
    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "IMPORT_INVALID_SOURCE_URL"


async def test_create_extension_given_credentialed_url_expect_422(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    resp = await client.post(
        "/imports/extension",
        json={"text": "tekst", "source_url": "*****************************/x"},
    )
    assert resp.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert resp.json()["detail"]["code"] == "IMPORT_INVALID_SOURCE_URL"


async def test_create_given_quota_exhausted_expect_429(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: seed the lifetime counter directly so the cap is reached without
    # looping IMPORT_LIMIT imports.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    await client.post("/imports", json={"text": "første tekst"})
    await db.execute(
        pg_insert(ImportQuota)
        .values(user_id=user.id, used=IMPORT_LIMIT)
        .on_conflict_do_update(
            index_elements=[ImportQuota.user_id],
            set_={"used": IMPORT_LIMIT},
        )
    )
    await db.flush()

    # Act: a new distinct import is rejected because the lifetime cap is hit.
    resp = await client.post("/imports", json={"text": "en helt ny tekst"})

    # Assert
    assert resp.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert resp.json()["detail"]["code"] == "IMPORT_QUOTA_EXCEEDED"


async def test_create_given_deleted_import_expect_quota_not_restored(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: create one import (counter -> 1), then delete it.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    created = await client.post("/imports", json={"text": "tekst som slettes"})
    assert created.status_code == HTTPStatus.CREATED
    import_id = created.json()["id"]

    # Act
    del_resp = await client.delete(f"/imports/{import_id}")
    assert del_resp.status_code == HTTPStatus.NO_CONTENT

    # Assert: the lifetime counter did not decrement on delete.
    quota = (
        await db.execute(select(ImportQuota.used).where(ImportQuota.user_id == user.id))
    ).scalar_one()
    assert quota == 1


async def test_create_given_repaste_of_owned_content_at_quota_expect_201(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: create one import, then seed the counter to the cap.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    owned_text = "allerede eid tekst"
    created = await client.post("/imports", json={"text": owned_text})
    assert created.status_code == HTTPStatus.CREATED
    await db.execute(
        pg_insert(ImportQuota)
        .values(user_id=user.id, used=IMPORT_LIMIT)
        .on_conflict_do_update(
            index_elements=[ImportQuota.user_id],
            set_={"used": IMPORT_LIMIT},
        )
    )
    await db.flush()

    # Act: re-paste content the user already owns while sitting at the cap.
    resp = await client.post("/imports", json={"text": owned_text})

    # Assert: a re-paste consumes no slot, so it must not be rejected by quota.
    assert resp.status_code == HTTPStatus.CREATED, resp.text


async def test_create_given_same_content_repaste_expect_no_second_save_no_extra_quota(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    text = "nøyaktig samme tekst"

    # Act: import the same content twice.
    first = await client.post("/imports", json={"text": text})
    second = await client.post("/imports", json={"text": text})

    # Assert: both 201, same UserStory (dedup), and the lifetime count is 1
    # (same-content re-paste does not consume a new slot).
    assert (
        first.status_code == HTTPStatus.CREATED
        and second.status_code == HTTPStatus.CREATED
    )
    assert first.json()["id"] == second.json()["id"]
    saves = (
        (
            await db.execute(
                select(UserStory)
                .where(
                    UserStory.user_id == user.id,
                    Story.visibility == StoryVisibility.PRIVATE,
                )
                .join(Story, Story.id == UserStory.story_id)
            )
        )
        .scalars()
        .all()
    )
    assert len(saves) == 1


async def test_create_given_two_users_same_content_expect_shared_story(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    first_user = await UserFactory.create()
    second_user = await UserFactory.create()
    await db.flush()
    text = "delt innhold mellom to brukere"

    # Act
    await authenticate(client, first_user)
    a = await client.post("/imports", json={"text": text})
    client.cookies.clear()
    await authenticate(client, second_user)
    b = await client.post("/imports", json={"text": text})

    # Assert: distinct per-user references, one shared story.
    assert a.status_code == HTTPStatus.CREATED and b.status_code == HTTPStatus.CREATED
    assert a.json()["id"] != b.json()["id"]
    assert a.json()["storyUuid"] == b.json()["storyUuid"]


async def test_list_imports_given_saves_expect_owner_scoped_with_quota(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    await client.post("/imports", json={"text": "første tekst", "title": "Min tittel"})

    # Act
    resp = await client.get("/imports")

    # Assert
    assert resp.status_code == HTTPStatus.OK
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "Min tittel"
    assert body["quota"] == {"used": 1, "limit": IMPORT_LIMIT}


async def test_list_imports_given_more_than_one_old_page_expect_all_returned(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    count = 25
    for index in range(count):
        created = await client.post("/imports", json={"text": f"tekst nummer {index}"})
        assert created.status_code == HTTPStatus.CREATED

    resp = await client.get("/imports")

    assert resp.status_code == HTTPStatus.OK
    body = resp.json()
    assert len(body["items"]) == count
    assert body["nextCursor"] is None


@pytest.mark.parametrize(
    ("limit", "expected_status"),
    [
        (1, 200),
        (MAX_PAGE_LIMIT, 200),
        (MAX_PAGE_LIMIT + 1, 422),
        (0, 422),
    ],
)
async def test_list_imports_given_limit_at_bounds_expect_accepted_or_422(
    client: AsyncClient, db: AsyncSession, limit: int, expected_status: int
) -> None:
    # A client sending a limit above MAX_PAGE_LIMIT 422s before reaching the
    # service — the failure mode that broke /reading/imports when the frontend
    # defaulted to the IMPORT_LIMIT quota (200) instead of a page size.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)

    resp = await client.get("/imports", params={"limit": limit})

    assert resp.status_code == expected_status


async def test_get_import_given_non_owner_expect_404(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: owner creates an import.
    owner = await UserFactory.create()
    stranger = await UserFactory.create()
    await db.flush()
    await authenticate(client, owner)
    created = await client.post("/imports", json={"text": "privat tekst"})
    import_id = created.json()["id"]

    # Act: a different user requests it.
    client.cookies.clear()
    await authenticate(client, stranger)
    resp = await client.get(f"/imports/{import_id}")

    # Assert: 404, not 403 — existence is not confirmed.
    assert resp.status_code == HTTPStatus.NOT_FOUND
    assert resp.json()["detail"]["code"] == "IMPORT_NOT_FOUND"


async def test_retry_given_non_owner_expect_404(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: owner creates an import.
    owner = await UserFactory.create()
    stranger = await UserFactory.create()
    await db.flush()
    await authenticate(client, owner)
    created = await client.post("/imports", json={"text": "privat tekst"})
    import_id = created.json()["id"]

    # Act: a different user tries to retry it.
    client.cookies.clear()
    await authenticate(client, stranger)
    resp = await client.post(f"/imports/{import_id}/retry")

    # Assert: 404, not 403 — existence is not confirmed.
    assert resp.status_code == HTTPStatus.NOT_FOUND
    assert resp.json()["detail"]["code"] == "IMPORT_NOT_FOUND"


async def test_curated_lists_given_unread_ready_import_expect_import_excluded(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="daily_life")
    await db.flush()
    await authenticate(client, user)
    created = await client.post("/imports", json={"text": "privat men ferdig tekst"})
    assert created.status_code == HTTPStatus.CREATED

    user_story = await db.scalar(
        select(UserStory).where(UserStory.uuid == created.json()["id"])
    )
    assert user_story is not None
    story = await db.get(Story, user_story.story_id)
    assert story is not None
    story.reading_group_id = group.id
    story.is_ready = True
    meta = await db.scalar(select(ImportMeta).where(ImportMeta.story_id == story.id))
    assert meta is not None
    meta.status = ImportStatus.READY
    await StoryPageFactory.create(story=story)
    await db.flush()

    stories = await client.get("/reading/stories", params={"group_key": group.key})
    home = await client.get("/reading/home")

    assert stories.status_code == HTTPStatus.OK
    assert home.status_code == HTTPStatus.OK
    assert all(item["uuid"] != str(story.uuid) for item in stories.json()["stories"])
    home_story_ids = {
        item["uuid"]
        for section in home.json()["sections"]
        for item in section["stories"]
    }
    assert str(story.uuid) not in home_story_ids


async def test_retry_given_ready_import_expect_409(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: create an import and force it ready.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    created = await client.post("/imports", json={"text": "ferdig tekst"})
    import_id = created.json()["id"]
    user_story = (
        await db.execute(select(UserStory).where(UserStory.uuid == import_id))
    ).scalar_one()
    meta = (
        await db.execute(
            select(ImportMeta).where(ImportMeta.story_id == user_story.story_id)
        )
    ).scalar_one()
    meta.status = ImportStatus.READY
    story = await db.get(Story, user_story.story_id)
    assert story is not None
    story.is_ready = True
    await db.flush()

    # Act
    resp = await client.post(f"/imports/{import_id}/retry")

    # Assert
    assert resp.status_code == HTTPStatus.CONFLICT
    assert resp.json()["detail"]["code"] == "IMPORT_NOT_RETRYABLE"


async def test_retry_given_fresh_processing_expect_409(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: an import actively processing within the stale window.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    import_id = (await client.post("/imports", json={"text": "under arbeid"})).json()[
        "id"
    ]
    meta = await import_meta(db, import_id)
    await db.execute(
        update(ImportMeta)
        .where(ImportMeta.id == meta.id)
        .values(status=ImportStatus.PROCESSING, updated_at=now())
    )
    await db.flush()

    # Act: a retry must not disturb a healthy in-flight worker.
    resp = await client.post(f"/imports/{import_id}/retry")

    # Assert
    assert resp.status_code == HTTPStatus.CONFLICT
    assert resp.json()["detail"]["code"] == "IMPORT_NOT_RETRYABLE"


async def test_retry_given_failed_expect_reset_to_pending(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: a failed import.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    import_id = (await client.post("/imports", json={"text": "feilet tekst"})).json()[
        "id"
    ]
    meta = await import_meta(db, import_id)
    await db.execute(
        update(ImportMeta)
        .where(ImportMeta.id == meta.id)
        .values(status=ImportStatus.FAILED, error_code="X", error_message="boom")
    )
    await db.flush()

    # Act
    resp = await client.post(f"/imports/{import_id}/retry")

    # Assert: accepted and reset to pending with the error cleared.
    assert resp.status_code == HTTPStatus.ACCEPTED
    refreshed = await import_meta(db, import_id)
    assert refreshed.status is ImportStatus.PENDING
    assert refreshed.error_code is None


async def test_retry_given_stale_processing_expect_reset_to_pending(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: an import stuck in PROCESSING past the stale window.
    user = await UserFactory.create()
    await db.flush()
    await authenticate(client, user)
    import_id = (await client.post("/imports", json={"text": "sitter fast"})).json()[
        "id"
    ]
    meta = await import_meta(db, import_id)
    await db.execute(
        update(ImportMeta)
        .where(ImportMeta.id == meta.id)
        .values(
            status=ImportStatus.PROCESSING,
            updated_at=now() - STALE_AFTER - timedelta(minutes=1),
        )
    )
    await db.flush()

    # Act
    resp = await client.post(f"/imports/{import_id}/retry")

    # Assert
    assert resp.status_code == HTTPStatus.ACCEPTED
    refreshed = await import_meta(db, import_id)
    assert refreshed.status is ImportStatus.PENDING


async def test_create_given_route_composition_expect_import_and_pages_durable(  # noqa: PLR0915
    monkeypatch,
    setup_database: None,
) -> None:
    """R-004: the ingress write is durable only after the route's first
    commit, and published handover pages after the second."""
    from flyt.apps.reading.tokenization import PageData
    from flyt.apps.reading.models import StoryPage
    from flyt.apps.reading.import_service import ImportService
    from flyt.apps.users.models import User
    from flyt.apps.users.types import UserRole
    from flyt.core.db import AsyncSessionLocal
    from uuid import uuid4

    from sqlalchemy import delete
    from sqlalchemy import func

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="ingress-durability@example.com",
            display_name="Ingress Durability",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    enqueued: list[tuple] = []

    async def capture_enqueue(name: str, *args) -> None:
        enqueued.append((name, args))

    monkeypatch.setattr(service_module, "enqueue_job", capture_enqueue)

    story_ids: list[int] = []
    try:
        async with AsyncSessionLocal() as caller:
            service = ImportService(caller)
            draft = await service.create(
                user_id=user_id,
                text_value="en tekst som blir importert",
                title=None,
                source_url=None,
            )
            story_ids.append(draft.story_id)

            async with AsyncSessionLocal() as verify:
                story = await verify.get(Story, draft.story_id)
                assert story is None

            await caller.commit()

        async with AsyncSessionLocal() as verify:
            story = await verify.get(Story, draft.story_id)
            assert story is not None
            meta = await verify.scalar(
                select(ImportMeta).where(ImportMeta.story_id == draft.story_id)
            )
            assert meta is not None
            assert meta.status is ImportStatus.PENDING

        handover_text = "en generert tekst med egne sider"
        handover_pages = [
            PageData(index=0, content=handover_text, tokens=[], word_count=5)
        ]
        async with AsyncSessionLocal() as caller:
            service = ImportService(caller)
            draft = await service.create_from_generation(
                user_id=user_id,
                text=handover_text,
                pages=handover_pages,
                title=None,
            )
            story_ids.append(draft.story_id)
            assert draft.pages_to_publish is not None
            await caller.commit()
            item = await service.finalize_import(draft)
            assert item.pageCount == 1

            async with AsyncSessionLocal() as verify:
                page_count = await verify.scalar(
                    select(func.count())
                    .select_from(StoryPage)
                    .where(StoryPage.story_id == draft.story_id)
                )
                assert page_count == 0

            await caller.commit()

        async with AsyncSessionLocal() as verify:
            page_count = await verify.scalar(
                select(func.count())
                .select_from(StoryPage)
                .where(StoryPage.story_id == draft.story_id)
            )
            assert page_count == 1
            meta = await verify.scalar(
                select(ImportMeta).where(ImportMeta.story_id == draft.story_id)
            )
            assert meta is not None
            assert meta.status is ImportStatus.READY
        assert enqueued == []
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(delete(UserStory).where(UserStory.user_id == user_id))
            await cleanup.execute(
                delete(StoryPage).where(StoryPage.story_id.in_(story_ids))
            )
            await cleanup.execute(delete(Story).where(Story.id.in_(story_ids)))
            await cleanup.execute(
                delete(ImportQuota).where(ImportQuota.user_id == user_id)
            )
            await cleanup.execute(delete(User).where(User.id == user_id))
            await cleanup.commit()
