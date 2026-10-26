from datetime import datetime
from datetime import timedelta
from datetime import UTC

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.schemas import LemmaContextCreate
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemmaContext
from flyt.apps.users.services import UserLemmaService
from flyt.libs.utils import date
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory


@pytest.mark.anyio
async def test_timestamp_writes_given_frozen_application_clock_expect_clock_values_stored(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    await FlashCardFactory.create(pool=pool)

    current_time = datetime(2024, 1, 15, 12, 34, 56)
    monkeypatch.setattr(date, "now_aware", lambda: current_time.replace(tzinfo=UTC))

    user = User(email="clock@example.test", display_name="Before")
    db.add(user)
    await db.flush()
    await db.refresh(user)
    assert (user.created_at, user.updated_at) == (current_time, current_time)

    service = FlashcardCardService(db, UserLemmaService(db))
    await service.add_lemma_to_deck(
        user.id,
        lemma.uuid,
        LemmaContextCreate(source_sentence="A sentence", source_title="Before"),
    )
    context_times = select(
        UserLemmaContext.created_at,
        UserLemmaContext.updated_at,
        UserLemmaContext.source_title,
    ).where(UserLemmaContext.user_id == user.id)
    assert (await db.execute(context_times)).one() == (
        current_time,
        current_time,
        "Before",
    )

    current_time += timedelta(minutes=1)
    user.display_name = "After"
    await db.flush()
    await db.refresh(user)
    assert (user.created_at, user.updated_at) == (
        current_time - timedelta(minutes=1),
        current_time,
    )

    await service.add_lemma_to_deck(
        user.id,
        lemma.uuid,
        LemmaContextCreate(source_sentence="A sentence", source_title="After"),
    )
    assert (await db.execute(context_times)).one() == (
        current_time - timedelta(minutes=1),
        current_time,
        "After",
    )
