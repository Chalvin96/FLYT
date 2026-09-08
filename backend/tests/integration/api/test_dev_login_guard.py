"""Guards the dev-login backdoor against production exposure.

Entry point: `require_dev_login_enabled` (the router-level gate) plus the
registration gate in `flyt.main`. Both must keep `/users/dev/login` unreachable
outside `ENV == "development"`.
"""

from http import HTTPStatus

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from flyt.apps.users.router import require_dev_login_enabled
from flyt.core.config import settings


@pytest.mark.anyio
async def test_dev_login_given_test_env_expect_route_not_mounted(
    client: AsyncClient,
) -> None:
    # The app under test runs with ENV=test, so the dev router is never mounted
    # and the backdoor responds as if it does not exist.
    response = await client.get("/users/dev/login")

    assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize("env", ["production", "staging", "e2e", "test", ""])
def test_require_dev_login_enabled_given_non_development_env_expect_404(
    env: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # setup
    monkeypatch.setattr(settings, "ENV", env)

    # execute / assert
    with pytest.raises(HTTPException) as exc_info:
        require_dev_login_enabled()

    assert exc_info.value.status_code == HTTPStatus.NOT_FOUND


def test_require_dev_login_enabled_given_development_env_expect_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # setup
    monkeypatch.setattr(settings, "ENV", "development")

    # execute / assert — no exception raised
    require_dev_login_enabled()
