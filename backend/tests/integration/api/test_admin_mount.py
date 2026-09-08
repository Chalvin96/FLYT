import pytest
from httpx import AsyncClient


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
    for field in ("content", "slug", "title", "cefr_level", "reading_group_id"):
        assert field in view.exclude_fields_from_edit
