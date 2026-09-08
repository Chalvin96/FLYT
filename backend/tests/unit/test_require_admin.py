from http import HTTPStatus

import pytest
from fastapi import HTTPException

from flyt.apps.users.deps import require_admin
from flyt.apps.users.types import UserRole
from tests.factories import UserFactory


@pytest.mark.anyio
async def test_require_admin_given_admin_returns_user(async_session) -> None:
    admin = await UserFactory.create(role=UserRole.ADMIN)
    result = await require_admin(user=admin)
    assert result is admin


@pytest.mark.anyio
async def test_require_admin_given_regular_user_raises_403(async_session) -> None:
    user = await UserFactory.create(role=UserRole.USER)
    with pytest.raises(HTTPException) as exc:
        await require_admin(user=user)
    assert exc.value.status_code == HTTPStatus.FORBIDDEN
    assert exc.value.detail["code"] == "FORBIDDEN"
