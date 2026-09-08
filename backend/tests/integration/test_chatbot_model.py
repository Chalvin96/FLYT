from datetime import date

import pytest
from pydantic import SecretStr
from sqlalchemy import delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.chatbot.models import OpenRouterCredential
from flyt.apps.users.models import User
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


async def test_chatbot_credentials_given_user_deleted_expect_rows_cascaded(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    db.add(
        OpenRouterCredential(
            user_id=user.id,
            api_key=SecretStr("sk-or-user-secret-1234"),
        )
    )
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=date(2026, 8, 1),
            remaining_tokens=1,
            budget_tokens=100_000,
        )
    )
    await db.flush()

    await db.execute(delete(User).where(User.id == user.id))
    await db.flush()

    credential_count = await db.scalar(
        select(func.count())
        .select_from(OpenRouterCredential)
        .where(OpenRouterCredential.user_id == user.id)
    )
    usage_count = await db.scalar(
        select(func.count())
        .select_from(FlytAiUsage)
        .where(FlytAiUsage.user_id == user.id)
    )
    assert credential_count == 0
    assert usage_count == 0
