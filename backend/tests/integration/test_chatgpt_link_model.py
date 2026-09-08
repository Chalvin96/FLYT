import pytest
from pydantic import SecretStr
from sqlalchemy import delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.users.models import User
from tests.factories import ChatGPTLinkFactory

pytestmark = pytest.mark.anyio


async def test_chatgpt_link_given_user_deleted_expect_row_cascaded(
    db: AsyncSession,
) -> None:
    link = await ChatGPTLinkFactory.create_async()
    user = await db.scalar(select(User).where(User.id == link.user_id))
    assert user is not None

    await db.execute(delete(User).where(User.id == user.id))
    await db.flush()

    remaining = await db.scalar(
        select(func.count()).select_from(ChatGPTLink).where(ChatGPTLink.id == link.id)
    )
    assert remaining == 0


async def test_chatgpt_link_given_second_row_for_user_expect_unique_violation(
    db: AsyncSession,
) -> None:
    first = await ChatGPTLinkFactory.create_async()
    with pytest.raises(IntegrityError):
        await ChatGPTLinkFactory.create_async(user_id=first.user_id)


async def test_chatgpt_link_credential_given_type_stripped_read_expect_no_token(
    db: AsyncSession,
) -> None:
    plaintext = "tok-live-plaintext-marker"
    link = await ChatGPTLinkFactory.create_async(access_token=plaintext)
    await db.flush()

    rows = (
        await db.execute(
            text("SELECT access_token, refresh_token FROM chatgpt_link WHERE id = :id"),
            {"id": link.id},
        )
    ).one()
    for stored in rows:
        assert isinstance(stored, str)
        assert plaintext not in stored
        assert stored.startswith("gAAAA")


async def test_chatgpt_link_factory_given_no_credential_fields_expect_round_trip(
    db: AsyncSession,
) -> None:
    link = await ChatGPTLinkFactory.create_async()
    await db.flush()

    await db.refresh(link)
    assert isinstance(link.access_token, SecretStr)
    assert isinstance(link.refresh_token, SecretStr)
    assert link.access_token.get_secret_value()
    assert link.refresh_token.get_secret_value()
