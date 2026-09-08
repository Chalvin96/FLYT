from http import HTTPStatus
from unittest.mock import AsyncMock
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_translate_selection_given_authenticated_user_expect_translation_and_usage_debit(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    with patch(
        "flyt.apps.extension.services.OpenRouterProvider.generate",
        new=AsyncMock(return_value=GenerationResult(text=" I am learning Norwegian. ")),
    ) as generate:
        response = await client.post(
            "/extension/translate",
            json={"text": "  Jeg lærer norsk.  "},
        )

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "source_text": "Jeg lærer norsk.",
        "translated_text": "I am learning Norwegian.",
        "source_language": "no",
        "target_language": "en",
    }
    generate.assert_awaited_once()
    usage = await db.scalar(
        select(FlytAiUsage).where(
            FlytAiUsage.user_id == user.id,
            FlytAiUsage.period_start == calculate_utc_week_start(),
        )
    )
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_translate_selection_given_no_authentication_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/extension/translate",
        json={"text": "Jeg lærer norsk."},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_translate_selection_given_exhausted_budget_expect_quota_error_without_provider_call(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=calculate_utc_week_start(),
            remaining_tokens=0,
            budget_tokens=100_000,
        )
    )
    await db.flush()

    with patch(
        "flyt.apps.extension.services.OpenRouterProvider.generate",
        new=AsyncMock(),
    ) as generate:
        response = await client.post(
            "/extension/translate",
            json={"text": "Jeg lærer norsk."},
        )

    assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert response.json()["detail"]["code"] == "EXTENSION_TRANSLATION_QUOTA_EXCEEDED"
    generate.assert_not_awaited()


async def test_translate_selection_given_provider_timeout_expect_error_after_committed_admission(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    with patch(
        "flyt.apps.extension.services.OpenRouterProvider.generate",
        new=AsyncMock(side_effect=ProviderFailure(ProviderFailureClass.TIMEOUT)),
    ):
        response = await client.post(
            "/extension/translate",
            json={"text": "Jeg lærer norsk."},
        )

    assert response.status_code == HTTPStatus.GATEWAY_TIMEOUT
    assert response.json()["detail"]["code"] == "EXTENSION_TRANSLATION_PROVIDER_TIMEOUT"
    usage = await db.scalar(
        select(FlytAiUsage).where(
            FlytAiUsage.user_id == user.id,
            FlytAiUsage.period_start == calculate_utc_week_start(),
        )
    )
    assert usage is not None
