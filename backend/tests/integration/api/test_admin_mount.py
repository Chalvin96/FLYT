import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette_admin.exceptions import FormValidationError
from starlette_admin.helpers import RequestAction

from flyt.apps.admin.setup import ColumnAdminView
from flyt.apps.admin.setup import RelatedAdminView
from flyt.apps.admin.setup import StoryAdminView
from flyt.apps.flashcards.models import CardPool
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LessonFactory
from tests.factories import LessonReleaseFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserLessonProgressFactory


pytestmark = pytest.mark.anyio


async def test_admin_index_without_cookie_redirects_to_login(
    client: AsyncClient,
) -> None:
    response = await client.get("/admin/", follow_redirects=False)
    # starlette-admin redirects unauthenticated requests to its login route.
    assert response.status_code in (302, 303, 307)
    assert "/admin/login" in response.headers["location"]


async def test_admin_login_redirects_to_oauth(client: AsyncClient) -> None:
    response = await client.get("/admin/login", follow_redirects=False)
    assert response.status_code in (302, 303, 307)
    assert "/users/oauth/google/start" in response.headers["location"]


async def test_story_admin_given_unpaginated_story_expect_readiness_rejected(
    db: AsyncSession,
) -> None:
    story = await StoryFactory.create(is_ready=False)
    story_id = story.id
    db.expunge_all()
    request = Request({"type": "http"})
    request.state.session = db
    request.state.action = RequestAction.EDIT

    with pytest.raises(FormValidationError) as error:
        await StoryAdminView(Story).edit(
            request,
            story_id,
            {"is_ready": True, "visibility": StoryVisibility.PUBLIC},
        )

    assert error.value.has("is_ready")
    assert await db.scalar(select(Story.is_ready).where(Story.id == story_id)) is False


async def test_story_admin_given_paginated_story_expect_readiness_editable(
    db: AsyncSession,
) -> None:
    story = await StoryFactory.create(is_ready=False)
    await StoryPageFactory.create(story=story)
    story_id = story.id
    db.expunge_all()
    request = Request({"type": "http"})
    request.state.session = db
    request.state.action = RequestAction.EDIT
    view = StoryAdminView(Story)

    await view.edit(
        request, story_id, {"is_ready": True, "visibility": StoryVisibility.PUBLIC}
    )
    assert await db.scalar(select(Story.is_ready).where(Story.id == story_id)) is True

    await view.edit(
        request, story_id, {"is_ready": False, "visibility": StoryVisibility.PUBLIC}
    )
    assert await db.scalar(select(Story.is_ready).where(Story.id == story_id)) is False


def test_story_page_admin_given_generated_page_expect_story_binding_immutable() -> None:
    from flyt.apps.admin.setup import StoryPageAdminView

    view = StoryPageAdminView(StoryPage)

    assert "story_id" in view.exclude_fields_from_edit
    assert view.can_delete(Request({"type": "http"})) is False


def test_user_admin_view_is_locked_down() -> None:
    from starlette.requests import Request

    from flyt.apps.admin.setup import UserAdminView
    from flyt.apps.users.models import User

    view = UserAdminView(User)
    request = Request({"type": "http"})
    assert view.can_create(request) is False
    assert view.can_delete(request) is False
    # Identity fields must not be editable.
    for field in ("id", "uuid", "email", "display_name", "avatar_url", "last_login"):
        assert field in UserAdminView.exclude_fields_from_edit


def test_story_admin_view_is_ingestion_only() -> None:
    from starlette.requests import Request

    from flyt.apps.admin.setup import StoryAdminView
    from flyt.apps.reading.models import Story

    view = StoryAdminView(Story)
    request = Request({"type": "http"})
    assert view.can_create(request) is False
    assert view.can_delete(request) is True


def test_story_admin_view_excludes_immutable_fields() -> None:
    from flyt.apps.admin.setup import StoryAdminView
    from flyt.apps.reading.models import Story

    view = StoryAdminView(Story)
    for field in (
        "slug",
        "title",
        "cefr_level",
        "reading_group_id",
    ):
        assert field in view.exclude_fields_from_edit


def test_story_admin_view_given_story_model_expect_content_and_relationships_excluded() -> (
    None
):
    from flyt.apps.admin.setup import StoryAdminView
    from flyt.apps.reading.models import Story

    view = StoryAdminView(Story)

    assert {"content", "reading_group", "pages", "user_stories"}.isdisjoint(
        field.name for field in view.fields
    )


async def test_card_pool_admin_view_given_reloaded_pool_expect_column_listing(
    db: AsyncSession,
) -> None:
    from starlette.requests import Request

    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool)
    pool_id = pool.id
    db.expunge_all()

    view = RelatedAdminView(CardPool)
    request = Request({"type": "http"})
    listed_pool = await db.scalar(
        view.get_list_query(request).where(CardPool.id == pool_id)
    )

    assert listed_pool is not None
    assert {field.name for field in view.fields}.isdisjoint(
        {"lesson", "lemma", "cards"}
    )
    assert {field.name: getattr(listed_pool, field.name) for field in view.fields}[
        "id"
    ] == pool_id


async def test_lesson_admin_views_given_reloaded_rows_expect_column_list_and_detail(
    db: AsyncSession,
) -> None:
    from starlette.requests import Request

    release = await LessonReleaseFactory.create()
    lesson = await LessonFactory.create(release=release)
    row_ids = ((LessonRelease, release.id), (Lesson, lesson.id))
    db.expunge_all()

    request = Request({"type": "http"})
    for model, row_id in row_ids:
        view = ColumnAdminView(model)
        field_names = {field.name for field in view.fields}
        assert field_names.isdisjoint({"lessons", "release", "pools", "user_progress"})

        for query in (view.get_list_query(request), view.get_detail_query(request)):
            row = await db.scalar(query.where(model.id == row_id))
            assert row is not None
            assert {name: getattr(row, name) for name in field_names}["id"] == row_id
            db.expunge_all()


async def test_lesson_progress_admin_view_given_reloaded_row_expect_column_listing(
    db: AsyncSession,
) -> None:
    from starlette.requests import Request

    progress = await UserLessonProgressFactory.create()
    progress_id = progress.id
    db.expunge_all()

    view = RelatedAdminView(UserLessonProgress)
    request = Request({"type": "http"})
    listed_progress = await db.scalar(
        view.get_list_query(request).where(UserLessonProgress.id == progress_id)
    )

    assert listed_progress is not None
    assert {field.name for field in view.fields}.isdisjoint({"lesson", "user"})
    assert {field.name: getattr(listed_progress, field.name) for field in view.fields}[
        "id"
    ] == progress_id
