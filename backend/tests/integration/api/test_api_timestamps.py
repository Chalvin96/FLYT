from datetime import datetime
from datetime import timedelta
from http import HTTPStatus
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.types import DeviceAuthorization
from flyt.apps.flashcards.models import CardState
from flyt.core.config import settings
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import ChatGPTLinkFactory
from tests.factories import FlashCardFactory
from tests.factories import LessonFactory
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLessonProgressFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_due_and_review_timestamps_given_naive_utc_expect_rfc3339(
    client: AsyncClient, db: AsyncSession
) -> None:
    timestamp = datetime(2026, 10, 24, 12, 30, 45, 123456)
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        due_at=timestamp,
        last_review_at=timestamp,
        fsrs_stability=5.0,
        fsrs_difficulty=5.0,
    )
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get("/me/cards/due")

    assert response.status_code == HTTPStatus.OK
    issued = response.json()[0]
    assert issued["due_at"] == "2026-10-24T12:30:45.123456Z"
    assert issued["last_review_at"] == "2026-10-24T12:30:45.123456Z"
    review = await client.post(
        f"/me/cards/{card.id}/review",
        json={"card_id": issued["card"]["id"], "rating": 3, "review_version": 0},
    )
    assert review.status_code == HTTPStatus.OK
    assert review.json()["due_at"].endswith("Z")


async def test_lesson_timestamps_given_reloaded_progress_expect_rfc3339(
    client: AsyncClient, db: AsyncSession
) -> None:
    timestamp = datetime(2026, 10, 24, 12, 30, 45)
    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    await UserLessonProgressFactory.create(
        user_id=user.id,
        lesson_id=lesson.id,
        completed_at=timestamp,
        updated_at=timestamp,
    )
    await authenticate(client, user)
    db.expunge_all()

    listing = await client.get("/lessons")
    detail = await client.get(f"/lessons/{lesson.id}")

    assert listing.status_code == HTTPStatus.OK
    assert listing.json()[0]["last_activity_at"] == "2026-10-24T12:30:45Z"
    assert detail.status_code == HTTPStatus.OK
    assert detail.json()["progress"]["completed_at"] == "2026-10-24T12:30:45Z"


async def test_user_timestamp_given_naive_last_login_expect_rfc3339(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create(last_login=datetime(2026, 10, 24, 12, 30, 45))
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get("/users/me")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["last_login"] == "2026-10-24T12:30:45Z"


async def test_reading_timestamp_given_naive_creation_time_expect_rfc3339(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(
        reading_group=group, created_at=datetime(2026, 10, 24, 12, 30, 45)
    )
    await StoryPageFactory.create(story=story, index=0)
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get("/reading/stories", params={"group_key": group.key})

    assert response.status_code == HTTPStatus.OK
    assert response.json()["stories"][0]["createdAt"] == "2026-10-24T12:30:45Z"


async def test_chatgpt_link_timestamps_given_pending_and_connected_expect_rfc3339(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await UserFactory.create()
    await ChatGPTLinkFactory.create(
        user_id=user.id, created_at=datetime(2026, 10, 24, 12, 30, 45)
    )
    expires_at = now() + timedelta(minutes=10)
    monkeypatch.setattr(settings, "CHATGPT_LINK_ENABLED", True)
    monkeypatch.setattr(
        auth,
        "request_device_authorization",
        AsyncMock(
            return_value=DeviceAuthorization(
                device_auth_id="timestamp-device",
                user_code="TIMESTAMP-CODE",
                expires_at=expires_at,
            )
        ),
    )
    await authenticate(client, user)
    db.expunge_all()

    try:
        started = await client.post("/chatgpt/link/start")
        linked = await client.get("/chatgpt/link")

        assert started.status_code == HTTPStatus.OK
        assert started.json()["expires_at"] == f"{expires_at.isoformat()}Z"
        assert linked.status_code == HTTPStatus.OK
        assert linked.json()["connected_at"] == "2026-10-24T12:30:45Z"
        assert linked.json()["pending"]["expires_at"] == f"{expires_at.isoformat()}Z"
    finally:
        await pending_store.clear(user.id)
