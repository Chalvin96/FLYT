import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.exceptions import AuthenticationError
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import UserSettings
from flyt.apps.users.services import OAuthClaims
from flyt.apps.users.services import OAuthService
from flyt.core.config import settings
from tests.factories import AuthIdentityFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _match_google_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin GOOGLE_CLIENT_ID to the audience these claims use, so the success
    paths don't depend on the ambient env (CI sets it; local shells may not)."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-google-client-id")


def _claims(
    sub: str = "google-123",
    iss: str = "https://accounts.google.com",
    aud: str | list[str] = "test-google-client-id",
    email: str = "test@example.com",
    email_verified: bool = True,
    name: str | None = "Test User",
    picture: str | None = "https://img.example.com/photo.jpg",
) -> OAuthClaims:
    return OAuthClaims(
        sub=sub,
        iss=iss,
        aud=aud,
        email=email,
        email_verified=email_verified,
        name=name,
        picture=picture,
    )


@pytest.mark.anyio
async def test_login_or_register_given_new_user_expect_created(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims()

    user = await service.login_or_register_google(claims)
    await async_session.flush()

    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.display_name == "Test User"
    assert user.avatar_url == "https://img.example.com/photo.jpg"
    assert user.last_login is not None

    identity = await async_session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == "google-123",
        )
    )
    assert identity is not None
    assert identity.user_id == user.id
    assert identity.email_at_link == "test@example.com"

    settings_row = await async_session.scalar(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    assert settings_row is not None


@pytest.mark.anyio
async def test_login_or_register_given_returning_user_expect_updated(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create(
        email="old@example.com",
        display_name="Old Name",
        avatar_url="https://old.example.com/photo.jpg",
    )
    await AuthIdentityFactory.create(
        user=user,
        provider="google",
        provider_subject="google-123",
        email_at_link="old@example.com",
    )
    await async_session.flush()

    service = OAuthService(async_session)
    claims = _claims(
        email="new@example.com",
        name="New Name",
        picture="https://new.example.com/photo.jpg",
    )

    result = await service.login_or_register_google(claims)
    await async_session.flush()

    assert result.id == user.id
    assert result.email == "new@example.com"
    assert result.display_name == "New Name"
    assert result.avatar_url == "https://new.example.com/photo.jpg"
    assert result.last_login is not None

    identity = await async_session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == "google-123",
        )
    )
    assert identity is not None
    assert identity.email_at_link == "old@example.com"


@pytest.mark.anyio
async def test_login_or_register_given_missing_picture_expect_existing_avatar_preserved(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create(
        email="old@example.com",
        display_name="Old Name",
        avatar_url="https://old.example.com/photo.jpg",
    )
    await AuthIdentityFactory.create(
        user=user,
        provider="google",
        provider_subject="google-123",
        email_at_link="old@example.com",
    )
    await async_session.flush()

    service = OAuthService(async_session)
    claims = _claims(email="new@example.com", name="New Name", picture=None)

    result = await service.login_or_register_google(claims)
    await async_session.flush()

    assert result.avatar_url == "https://old.example.com/photo.jpg"


@pytest.mark.anyio
async def test_login_or_register_given_invalid_issuer_expect_error(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(iss="https://evil.example.com")

    with pytest.raises(AuthenticationError, match="Invalid Google issuer"):
        await service.login_or_register_google(claims)


@pytest.mark.anyio
async def test_login_or_register_given_invalid_audience_expect_error(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(aud="wrong-client-id")

    with pytest.raises(AuthenticationError, match="Invalid Google audience"):
        await service.login_or_register_google(claims)


@pytest.mark.anyio
async def test_login_or_register_given_unverified_email_expect_error(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(email_verified=False)

    with pytest.raises(AuthenticationError, match="not verified"):
        await service.login_or_register_google(claims)


@pytest.mark.anyio
async def test_login_or_register_given_no_name_expect_email_fallback(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(name=None, email="jane@example.com")

    user = await service.login_or_register_google(claims)
    await async_session.flush()

    assert user.display_name == "jane"


async def test_login_or_register_given_audience_list_expect_accepted(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(aud=["other-client", "test-google-client-id"])

    user = await service.login_or_register_google(claims)
    await async_session.flush()

    assert user.id is not None


async def test_login_or_register_given_bare_accounts_issuer_expect_accepted(
    async_session: AsyncSession,
) -> None:
    service = OAuthService(async_session)
    claims = _claims(iss="accounts.google.com")

    user = await service.login_or_register_google(claims)
    await async_session.flush()

    assert user.id is not None
