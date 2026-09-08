from datetime import timedelta
from http import HTTPStatus

import pytest
from httpx import AsyncClient

from flyt.apps.flashcards.models import CardState
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LessonFactory
from tests.factories import StatsReviewLogFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLessonProgressFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_get_dashboard_stats_given_authenticated_user_expect_frontend_contract(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    review_time = now()

    await authenticate(client, user)

    available_lesson = await LessonFactory.create(source_id="available")
    completed_lesson = await LessonFactory.create(source_id="completed")
    await LessonFactory.create(source_id="other")

    new_pool = await CardPoolFactory.create(
        lesson=available_lesson, key="available-new"
    )
    learning_pool = await CardPoolFactory.create(
        lesson=available_lesson,
        key="available-learning",
    )
    relearning_pool = await CardPoolFactory.create(
        lesson=available_lesson,
        key="available-relearning",
    )
    await FlashCardFactory.create(pool=new_pool, is_addable=True)
    await FlashCardFactory.create(pool=learning_pool, is_addable=True)
    await FlashCardFactory.create(pool=relearning_pool, is_addable=True)

    await UserCardFactory.create(
        user=user,
        pool=new_pool,
        state=CardState.NEW,
    )
    learning_card = await UserCardFactory.create(
        user=user,
        pool=learning_pool,
        state=CardState.LEARNING,
        due_at=now() + timedelta(days=2),
    )
    await UserCardFactory.create(
        user=user,
        pool=relearning_pool,
        state=CardState.RELEARNING,
        due_at=now() + timedelta(days=2),
    )

    await UserLessonProgressFactory.create(
        user=user,
        lesson=completed_lesson,
        completed_at=now(),
    )

    await StatsReviewLogFactory.create(
        user_card=learning_card,
        reviewed_at=review_time,
        rating=4,
    )

    response = await client.get("/me/dashboard/stats")

    expected_snapshot = {
        "this_week": [0, 0, 0, 0, 0, 0, 0],
        "last_week": [0, 0, 0, 0, 0, 0, 0],
        "two_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
        "three_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
    }
    start_of_week = review_time.date() - timedelta(days=review_time.weekday())
    window_start = start_of_week - timedelta(weeks=3)
    week_fields = [
        "three_weeks_ago",
        "two_weeks_ago",
        "last_week",
        "this_week",
    ]
    delta_days = (review_time.date() - window_start).days
    expected_snapshot[week_fields[delta_days // 7]][delta_days % 7] = 1

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "dueCount": 1,
        "dueNew": 1,
        "lessonCount": 1,
        "new": 1,
        "learning": 1,
        "relearning": 1,
        "accuracy7d": 1.0,
        "wordsPracticed": 1,
        "streak": 1,
        "snapshot": expected_snapshot,
    }


async def test_get_dashboard_stats_given_authenticated_user_without_activity_expect_empty_state(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()

    await authenticate(client, user)

    response = await client.get("/me/dashboard/stats")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "dueCount": 0,
        "dueNew": 0,
        "lessonCount": 0,
        "new": 0,
        "learning": 0,
        "relearning": 0,
        "accuracy7d": None,
        "wordsPracticed": 0,
        "streak": 0,
        "snapshot": {
            "this_week": [0, 0, 0, 0, 0, 0, 0],
            "last_week": [0, 0, 0, 0, 0, 0, 0],
            "two_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
            "three_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
        },
    }


async def test_get_dashboard_stats_without_auth_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.get("/me/dashboard/stats")

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    detail = response.json()["detail"]
    assert detail["code"] == "AUTHENTICATION_FAILED"
    assert detail["message"] == "Could not validate credentials, try login again."
