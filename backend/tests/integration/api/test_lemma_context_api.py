from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import UserCard
from flyt.apps.users.models import UserLemmaContext
from tests.factories import DefinitionFactory
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_add_lemma_to_deck_given_sentence_context_expect_atomic_private_context_and_review_read(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    other_user = await UserFactory.create()
    lemma = await LemmaFactory.create(word="lære")
    await DefinitionFactory.create(
        lemma=lemma,
        definition="to learn",
        translation="lære",
    )
    context = {
        "source_sentence": "Jeg lærer norsk hver dag.",
        "source_title": "A lesson",
    }

    await authenticate(client, user)
    response = await client.post(
        f"/me/cards/lemmas/{lemma.uuid}/add-to-deck",
        json=context,
    )

    assert response.status_code == HTTPStatus.OK
    saved = await db.scalar(
        select(UserLemmaContext).where(
            UserLemmaContext.user_id == user.id,
            UserLemmaContext.lemma_id == lemma.id,
        )
    )
    assert saved is not None
    assert saved.source_sentence == context["source_sentence"]
    assert saved.source_title == context["source_title"]

    # The same source sentence is an update, so repeated saves remain one row.
    updated_context = {**context, "source_title": "Updated lesson"}
    response = await client.post(
        f"/me/cards/lemmas/{lemma.uuid}/add-to-deck",
        json=updated_context,
    )
    assert response.status_code == HTTPStatus.OK
    rows = (
        await db.scalars(
            select(UserLemmaContext).where(
                UserLemmaContext.user_id == user.id,
                UserLemmaContext.lemma_id == lemma.id,
            )
        )
    ).all()
    assert len(rows) == 1
    await db.refresh(rows[0])
    assert rows[0].source_title == "Updated lesson"

    due_response = await client.get("/me/cards/due")
    assert due_response.status_code == HTTPStatus.OK
    assert due_response.json()[0]["context"] == {
        "source_sentence": context["source_sentence"],
        "source_title": "Updated lesson",
    }

    # Context belongs to the authenticated learner and is not visible to another one.
    await authenticate(client, other_user)
    other_due_response = await client.get("/me/cards/due")
    assert other_due_response.status_code == HTTPStatus.OK
    assert other_due_response.json() == []

    # There is one learner card for the lemma even after the idempotent update.
    user_cards = (
        await db.scalars(select(UserCard).where(UserCard.user_id == user.id))
    ).all()
    assert len(user_cards) == 1
