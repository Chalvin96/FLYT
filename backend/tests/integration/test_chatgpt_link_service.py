from datetime import timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import pytest
from pydantic import SecretStr
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import OperationalError

from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link import services
from flyt.apps.chatgpt_link.clients import config as chatgpt_config
from flyt.apps.chatgpt_link.clients.exceptions import RenewalFailedError
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.clients.manager import responses
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkDisabledError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkIneligibleError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkModelUnavailableError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkPendingError
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.chatgpt_link.models import ChatGPTLinkState
from flyt.apps.chatgpt_link.rotation import complete_link_poll
from flyt.apps.chatgpt_link.rotation import renew_if_needed
from flyt.apps.chatgpt_link.services import ChatGPTLinkService
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.apps.chatgpt_link.types import DeviceAuthorization
from flyt.apps.chatgpt_link.types import DevicePollApproved
from flyt.apps.chatgpt_link.types import DevicePollPending
from flyt.apps.chatgpt_link.types import PendingAuthorization
from flyt.apps.chatgpt_link.types import ProofVerdict
from flyt.apps.chatgpt_link.types import RenewalFailureClass
from flyt.apps.chatgpt_link.types import RenewedCredential
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.core.config import settings
from flyt.libs.utils.date import now
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

K_TEST_USER_ID = 42


def bearer(user: User) -> dict[str, str]:
    token = jwt.encode(
        {"sub": str(user.uuid)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


def credential() -> ChatGPTCredential:
    return ChatGPTCredential(
        access_token=SecretStr("access-token"),
        refresh_token=SecretStr("refresh-token"),
        chatgpt_account_id="acct-1",
        access_token_expires_at=now() + timedelta(hours=1),
    )


@pytest.fixture
def mock_pending(monkeypatch: pytest.MonkeyPatch) -> dict[int, dict[str, str]]:
    store: dict[int, dict[str, str]] = {}

    async def _store(user_id: int, pending: PendingAuthorization) -> None:
        store[user_id] = pending

    async def _read(user_id: int) -> PendingAuthorization | None:
        return store.get(user_id)

    async def _delete(user_id: int) -> None:
        store.pop(user_id, None)

    monkeypatch.setattr(pending_store, "write", _store)
    monkeypatch.setattr(pending_store, "read", _read)
    monkeypatch.setattr(pending_store, "clear", _delete)
    return store


async def test_start_link_given_disabled_expect_refused(
    monkeypatch: pytest.MonkeyPatch,
    db,
) -> None:
    monkeypatch.setattr(services.settings, "CHATGPT_LINK_ENABLED", False)
    svc = ChatGPTLinkService(db)
    with pytest.raises(ChatGPTLinkDisabledError):
        await svc.start_link(user_id=1)


async def test_start_link_given_upstream_ok_expect_pending_stored(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    device = DeviceAuthorization(
        device_auth_id="da-1",
        user_code="CODE-1234",
        expires_at=now() + timedelta(minutes=10),
    )
    monkeypatch.setattr(
        auth, "request_device_authorization", AsyncMock(return_value=device)
    )
    svc = ChatGPTLinkService(db)
    result = await svc.start_link(user_id=K_TEST_USER_ID)
    assert result.user_code == "CODE-1234"
    assert result.verification_url == chatgpt_config.VERIFICATION_URL
    assert K_TEST_USER_ID in mock_pending


async def test_poll_link_given_no_pending_expect_pending_error(
    mock_pending: dict, db
) -> None:
    svc = ChatGPTLinkService(db)
    with pytest.raises(ChatGPTLinkPendingError):
        await svc.poll_link(user_id=99)


async def test_poll_link_given_still_pending_expect_pending_response(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    user = await UserFactory.create_async()
    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(return_value=DevicePollPending()),
    )
    svc = ChatGPTLinkService(db)
    result = await svc.poll_link(user.id)
    assert result.response.status == "pending"


async def test_poll_link_given_approved_and_proof_ok_expect_link_recorded(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    user = await UserFactory.create_async()
    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )
    svc = ChatGPTLinkService(db)
    result = await svc.poll_link(user.id)
    assert result.response.status == "linked"

    link = await db.scalar(select(ChatGPTLink).where(ChatGPTLink.user_id == user.id))
    assert link is not None
    assert link.state is ChatGPTLinkState.WORKING
    assert link.access_token.get_secret_value() == "access-token"


async def test_poll_link_given_proof_ineligible_expect_no_link_recorded(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    user = await UserFactory.create_async()
    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.TERMINAL_INELIGIBLE),
    )
    svc = ChatGPTLinkService(db)
    with pytest.raises(ChatGPTLinkIneligibleError):
        await svc.poll_link(user.id)

    link = await db.scalar(select(ChatGPTLink).where(ChatGPTLink.user_id == user.id))
    assert link is None


async def test_poll_link_given_relink_expect_updated_in_place(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    user = await UserFactory.create_async()
    from tests.factories import ChatGPTLinkFactory

    existing = await ChatGPTLinkFactory.create_async(
        user_id=user.id,
        access_token=SecretStr("old-access"),
        refresh_token=SecretStr("old-refresh"),
    )
    await db.flush()
    existing_id = existing.id

    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(auth, "revoke_refresh_token", AsyncMock())
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )
    svc = ChatGPTLinkService(db)
    await svc.poll_link(user.id)

    from sqlalchemy import func

    count = await db.scalar(
        select(func.count())
        .select_from(ChatGPTLink)
        .where(ChatGPTLink.user_id == user.id)
    )
    assert count == 1
    refreshed = await db.get(ChatGPTLink, existing_id)
    assert refreshed.access_token.get_secret_value() == "access-token"


async def test_get_link_given_absent_expect_absent(mock_pending: dict, db) -> None:
    user = await UserFactory.create_async()
    svc = ChatGPTLinkService(db)
    result = await svc.get_link(user.id)
    assert result.state == "absent"
    assert result.broken_reason is None
    assert result.connected_at is None
    assert "access_token" not in result.model_dump()
    assert "refresh_token" not in result.model_dump()


async def test_get_link_given_working_expect_working(mock_pending: dict, db) -> None:
    user = await UserFactory.create_async()
    from tests.factories import ChatGPTLinkFactory

    await ChatGPTLinkFactory.create_async(
        user_id=user.id, state=ChatGPTLinkState.WORKING
    )
    svc = ChatGPTLinkService(db)
    result = await svc.get_link(user.id)
    assert result.state == "working"
    assert result.connected_at is not None


async def test_get_link_given_broken_expect_broken_reason(
    mock_pending: dict, db
) -> None:
    user = await UserFactory.create_async()
    from tests.factories import ChatGPTLinkFactory

    await ChatGPTLinkFactory.create_async(
        user_id=user.id,
        state=ChatGPTLinkState.BROKEN,
        broken_reason="refresh_token_reused",
    )
    svc = ChatGPTLinkService(db)
    result = await svc.get_link(user.id)
    assert result.state == "broken"
    assert result.broken_reason == "refresh_token_reused"


async def test_delete_link_given_existing_row_expect_row_removed(
    monkeypatch: pytest.MonkeyPatch, mock_pending: dict, db
) -> None:
    user = await UserFactory.create_async()
    from tests.factories import ChatGPTLinkFactory

    await ChatGPTLinkFactory.create_async(user_id=user.id)
    monkeypatch.setattr(auth, "revoke_refresh_token", AsyncMock())
    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    svc = ChatGPTLinkService(db)
    await svc.delete_link(user.id)
    await svc.complete_link_unlink(user.id)
    link = await db.scalar(select(ChatGPTLink).where(ChatGPTLink.user_id == user.id))
    assert link is None
    assert user.id not in mock_pending


async def test_unlink_given_pending_clear_failure_expect_link_row_deleted(
    monkeypatch: pytest.MonkeyPatch,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="unlink-clear-fails@example.com",
            display_name="Unlink Clear Fails",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("access"),
            refresh_token=SecretStr("refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(hours=1),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    async def failing_clear(user_id: int) -> None:
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(pending_store, "clear", failing_clear)
    monkeypatch.setattr(auth, "revoke_refresh_token", AsyncMock())

    try:
        async with AsyncSessionLocal() as request_session:
            service = ChatGPTLinkService(request_session)
            await service.delete_link(user_id)
            await request_session.commit()
            await service.complete_link_unlink(user_id)

        async with AsyncSessionLocal() as verify:
            remaining = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert remaining is None
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_poll_link_given_kill_switch_off_expect_refused(
    monkeypatch: pytest.MonkeyPatch, mock_pending: dict, db
) -> None:
    user = await UserFactory.create_async()
    mock_pending[user.id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(services.settings, "CHATGPT_LINK_ENABLED", False)
    svc = ChatGPTLinkService(db)
    with pytest.raises(ChatGPTLinkDisabledError):
        await svc.poll_link(user.id)


async def test_renewal_given_outer_request_rolls_back_expect_renewed_pair_committed(
    monkeypatch: pytest.MonkeyPatch,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="renewal-cross-tx@example.com",
            display_name="Renewal Test",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("old-access"),
            refresh_token=SecretStr("old-refresh"),
            chatgpt_account_id="acct-renewal",
            access_token_expires_at=now() + timedelta(seconds=30),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now() - timedelta(hours=1),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    try:

        async def mock_renew(refresh_token: SecretStr) -> RenewedCredential:
            assert refresh_token.get_secret_value() == "old-refresh"
            return RenewedCredential(
                access_token=SecretStr("new-access"),
                refresh_token_or_keep_stored=SecretStr("new-refresh"),
                access_token_expires_at=now() + timedelta(hours=1),
            )

        monkeypatch.setattr(auth, "renew_credential", mock_renew)

        async with AsyncSessionLocal() as request_session:
            await renew_if_needed(user_id)
            await request_session.rollback()

        async with AsyncSessionLocal() as verify:
            refreshed = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert refreshed is not None
            assert refreshed.access_token.get_secret_value() == "new-access"
            assert refreshed.refresh_token.get_secret_value() == "new-refresh"
            assert refreshed.state is ChatGPTLinkState.WORKING
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_renewal_given_permanent_failure_expect_link_broken(
    monkeypatch: pytest.MonkeyPatch,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="renewal-perm@example.com",
            display_name="Perm Test",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("access"),
            refresh_token=SecretStr("refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(seconds=30),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    try:

        async def mock_renew(refresh_token: SecretStr) -> RenewedCredential:
            raise RenewalFailedError(
                RenewalFailureClass.PERMANENT,
                "refresh_token_reused",
                400,
            )

        monkeypatch.setattr(auth, "renew_credential", mock_renew)

        async with AsyncSessionLocal():
            result = await renew_if_needed(user_id)
            assert result is None

        async with AsyncSessionLocal() as verify:
            refreshed = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert refreshed is not None
            assert refreshed.state is ChatGPTLinkState.BROKEN
            assert refreshed.broken_reason == "refresh_token_reused"
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_renewal_given_omitted_refresh_token_expect_stored_one_preserved(
    monkeypatch: pytest.MonkeyPatch,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="renewal-omit@example.com",
            display_name="Omit Test",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("access"),
            refresh_token=SecretStr("original-refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(seconds=30),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    try:

        async def mock_renew(refresh_token: SecretStr) -> RenewedCredential:
            return RenewedCredential(
                access_token=SecretStr("new-access"),
                refresh_token_or_keep_stored=None,
                access_token_expires_at=now() + timedelta(hours=1),
            )

        monkeypatch.setattr(auth, "renew_credential", mock_renew)

        async with AsyncSessionLocal():
            await renew_if_needed(user_id)

        async with AsyncSessionLocal() as verify:
            refreshed = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert refreshed is not None
            assert refreshed.refresh_token.get_secret_value() == "original-refresh"
            assert refreshed.access_token.get_secret_value() == "new-access"
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_complete_link_poll_given_relink_expect_replacement_committed_before_revocation(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="poll-relink@example.com",
            display_name="Poll Relink",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("old-access"),
            refresh_token=SecretStr("old-refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(hours=12),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    mock_pending[user_id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )

    replacement_durable_at_revoke: list[bool] = []

    async def revoke_only_durable_replacement(refresh_token: SecretStr) -> None:
        assert refresh_token.get_secret_value() == "old-refresh"
        async with AsyncSessionLocal() as verify:
            link = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
        assert link is not None
        replacement_durable_at_revoke.append(
            link.refresh_token.get_secret_value() == "refresh-token"
        )

    monkeypatch.setattr(auth, "revoke_refresh_token", revoke_only_durable_replacement)

    try:
        async with AsyncSessionLocal() as request_session:
            response = await complete_link_poll(request_session, user_id)
            await request_session.rollback()

        assert response.status == "linked"
        assert replacement_durable_at_revoke == [True]
        async with AsyncSessionLocal() as verify:
            link = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert link is not None
            assert link.access_token.get_secret_value() == "access-token"
            assert link.refresh_token.get_secret_value() == "refresh-token"
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_complete_link_poll_given_definite_commit_failure_expect_new_token_revoked_and_link_preserved(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="poll-commit-definite@example.com",
            display_name="Poll Commit Definite",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("old-access"),
            refresh_token=SecretStr("old-refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(hours=12),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    mock_pending[user_id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )

    revoked: list[str] = []

    async def record_revoke(refresh_token: SecretStr) -> None:
        revoked.append(refresh_token.get_secret_value())

    monkeypatch.setattr(auth, "revoke_refresh_token", record_revoke)

    try:
        async with AsyncSessionLocal() as request_session:

            async def fail_commit_definitely() -> None:
                raise IntegrityError(
                    "COMMIT",
                    None,
                    RuntimeError("foreign-key constraint failed"),
                )

            monkeypatch.setattr(request_session, "commit", fail_commit_definitely)

            with pytest.raises(IntegrityError) as exc_info:
                await complete_link_poll(request_session, user_id)

            assert exc_info.value.connection_invalidated is False

        assert revoked == ["refresh-token"]

        async with AsyncSessionLocal() as verify:
            link = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert link is not None
            assert link.refresh_token.get_secret_value() == "old-refresh"
            assert link.state is ChatGPTLinkState.WORKING
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_complete_link_poll_given_ambiguous_commit_failure_expect_propagated_without_cleanup(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="poll-commit-ambiguous@example.com",
            display_name="Poll Commit Ambiguous",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("old-access"),
            refresh_token=SecretStr("old-refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(hours=12),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    mock_pending[user_id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )

    revoked: list[str] = []

    async def record_revoke(refresh_token: SecretStr) -> None:
        revoked.append(refresh_token.get_secret_value())

    monkeypatch.setattr(auth, "revoke_refresh_token", record_revoke)

    try:
        async with AsyncSessionLocal() as request_session:

            async def fail_commit_ambiguously() -> None:
                raise OperationalError(
                    "COMMIT",
                    None,
                    RuntimeError("connection lost during commit"),
                    connection_invalidated=False,
                )

            monkeypatch.setattr(request_session, "commit", fail_commit_ambiguously)

            with pytest.raises(OperationalError):
                await complete_link_poll(request_session, user_id)

        assert revoked == []

        async with AsyncSessionLocal() as verify:
            link = await verify.scalar(
                select(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            assert link is not None
            assert link.refresh_token.get_secret_value() == "old-refresh"
            assert link.state is ChatGPTLinkState.WORKING
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_poll_link_given_flush_only_expect_replacement_not_durable(
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    setup_database: None,
) -> None:
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="poll-flush-only@example.com",
            display_name="Poll Flush Only",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        link = ChatGPTLink(
            user_id=user_id,
            access_token=SecretStr("old-access"),
            refresh_token=SecretStr("old-refresh"),
            chatgpt_account_id="acct",
            access_token_expires_at=now() + timedelta(hours=12),
            state=ChatGPTLinkState.WORKING,
            last_refresh_at=now(),
        )
        session.add(link)
        await session.flush()
        link_id = link.id
        await session.commit()

    mock_pending[user_id] = PendingAuthorization(
        device_auth_id="da-1",
        user_code="CODE",
        expires_at=now() + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        auth,
        "poll_device_authorization",
        AsyncMock(
            return_value=DevicePollApproved(
                authorization_code="ac-1", code_verifier="cv-1"
            )
        ),
    )
    monkeypatch.setattr(
        auth,
        "exchange_authorization_code",
        AsyncMock(return_value=credential()),
    )
    monkeypatch.setattr(
        responses,
        "prove_link",
        AsyncMock(return_value=ProofVerdict.LINKED),
    )

    try:
        async with AsyncSessionLocal() as caller:
            outcome = await ChatGPTLinkService(caller).poll_link(user_id)
            assert outcome.response.status == "linked"

            async with AsyncSessionLocal() as verify:
                link = await verify.scalar(
                    select(ChatGPTLink).where(ChatGPTLink.id == link_id)
                )
                assert link is not None
                assert link.refresh_token.get_secret_value() == "old-refresh"
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(ChatGPTLink).where(ChatGPTLink.id == link_id)
            )
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()


async def test_set_model_given_alternate_model_expect_rejected_for_luna_only_link(  # ume-ignore: UME-PY003
    monkeypatch: pytest.MonkeyPatch,
    mock_pending: dict,
    db,
) -> None:
    device = DeviceAuthorization(
        device_auth_id="da-9",
        user_code="CODE-9999",
        expires_at=now() + timedelta(minutes=10),
    )
    monkeypatch.setattr(
        auth, "request_device_authorization", AsyncMock(return_value=device)
    )
    service = ChatGPTLinkService(db)
    await service.start_link(user_id=77, model_key="gpt-5.6-luna")

    with pytest.raises(ChatGPTLinkModelUnavailableError):
        await service.set_model(user_id=77, model_key="gpt-5.6-terra")
