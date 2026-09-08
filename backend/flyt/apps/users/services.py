import logging
from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

import jwt
from pydantic import BaseModel
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.constants import K_DEFAULT_STUDY_LIMIT
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_LEARNING
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_MASTERED
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_NEW
from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.users.exceptions import AuthenticationError
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserSettings
from flyt.core.config import settings
from flyt.libs.utils.date import now
from flyt.libs.utils.date import now_aware

logger = logging.getLogger(__name__)


class OAuthClaims(BaseModel):
    sub: str
    iss: str
    aud: str | list[str]
    email: EmailStr
    email_verified: bool
    name: str | None = None
    picture: str | None = None


class AuthService:
    def create_access_token(
        self, data: dict, expires_delta: timedelta | None = None
    ) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = now_aware() + expires_delta
        else:
            expire = now_aware() + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"exp": expire})
        logger.debug(
            "[AuthService.create_access_token] Token created with expiry: %s",
            expire,
        )
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


class OAuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login_or_register_google(self, claims: OAuthClaims) -> User:
        if not claims.email_verified:
            raise AuthenticationError("Google email is not verified")
        self._validate_google_claims(claims)

        identity = await self.db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.provider == "google",
                AuthIdentity.provider_subject == claims.sub,
            )
        )

        if identity is not None:
            user = await self.db.get(User, identity.user_id)
            if user is None:
                msg = "User referenced by auth identity does not exist"
                raise AuthenticationError(msg)
            self._refresh_from_claims(user, claims)
            user.last_login = now()
            return user

        user = User(
            email=claims.email,
            display_name=claims.name or claims.email.split("@")[0],
            avatar_url=claims.picture,
            last_login=now(),
        )
        self.db.add(user)
        await self.db.flush()
        self.db.add(
            AuthIdentity(
                user_id=user.id,
                provider="google",
                provider_subject=claims.sub,
                email_at_link=claims.email,
            )
        )
        self.db.add(UserSettings(user_id=user.id))
        await self.db.flush()
        return user

    def _refresh_from_claims(self, user: User, claims: OAuthClaims) -> None:
        user.email = claims.email
        if claims.name:
            user.display_name = claims.name
        if claims.picture:
            user.avatar_url = claims.picture

    def _validate_google_claims(self, claims: OAuthClaims) -> None:
        valid_issuers = {"https://accounts.google.com", "accounts.google.com"}
        if claims.iss not in valid_issuers:
            raise AuthenticationError("Invalid Google issuer")

        audiences = [claims.aud] if isinstance(claims.aud, str) else claims.aud
        if settings.GOOGLE_CLIENT_ID not in audiences:
            raise AuthenticationError("Invalid Google audience")


K_MASTERED_STABILITY_DAYS = 90


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_display_name(self, user: User, display_name: str) -> User:
        user.display_name = display_name
        await self.db.flush()
        return user


class UserSettingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_settings(self, user_id: int) -> UserSettings | None:
        return await self.db.scalar(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )

    async def get_new_limit(self, user_id: int) -> int:
        user_settings = await self.db.scalar(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        if user_settings:
            return user_settings.daily_new_limit

        return K_DEFAULT_STUDY_LIMIT


class UserLemmaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_lemma_for_user(self, user_id: int, lemma_id: int) -> None:
        """Idempotently ensure a UserLemma row exists using ON CONFLICT DO NOTHING.

        Database-native idempotent insert so concurrent activation paths cannot
        violate the (user_id, lemma_id) unique constraint. An existing row is
        left untouched, including is_mastered=True.
        """
        stmt = pg_insert(UserLemma).values(
            user_id=user_id,
            lemma_id=lemma_id,
            is_mastered=False,
        )
        stmt = stmt.on_conflict_do_nothing(
            index_elements=[UserLemma.user_id, UserLemma.lemma_id],
        )
        await self.db.execute(stmt)

    async def set_lemma_mastery_state(
        self,
        user_id: int,
        lemma_id: int,
        is_mastered: bool,
    ) -> None:
        stmt = pg_insert(UserLemma).values(
            user_id=user_id,
            lemma_id=lemma_id,
            is_mastered=is_mastered,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[UserLemma.user_id, UserLemma.lemma_id],
            set_={"is_mastered": is_mastered},
        )
        await self.db.execute(stmt)

    async def sync_lemma_mastery_from_user_card(self, user_card: UserCard) -> None:
        pool = user_card.pool
        if pool.lemma_id is None:
            return
        if user_card.state is not CardState.REVIEW:
            return
        if user_card.fsrs_stability is None:
            return
        if user_card.fsrs_stability < K_MASTERED_STABILITY_DAYS:
            return

        await self.set_lemma_mastery_state(
            user_card.user_id,
            pool.lemma_id,
            True,
        )


class UserVocabularyQueries:
    """Read-side vocabulary state projection over UserLemma.

    Vocabulary state is derived solely from UserLemma membership:
    - no row -> "new"
    - row exists, is_mastered=False -> "learning"
    - row exists, is_mastered=True -> "mastered"

    The write-side invariant (activation ensures UserLemma exists) makes a
    card-aware projection unnecessary. Dictionary lookup, reading word
    annotations, and the user's vocabulary list all consume this projection.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_lemma_state(self, user_id: int, lemma_id: int) -> UserLemmaState:
        row = await self.db.scalar(
            select(UserLemma.is_mastered)
            .where(UserLemma.user_id == user_id)
            .where(UserLemma.lemma_id == lemma_id)
        )
        if row is None:
            return K_USER_LEMMA_STATE_NEW
        if row:
            return K_USER_LEMMA_STATE_MASTERED
        return K_USER_LEMMA_STATE_LEARNING

    async def get_states_for_lemma_uuids(
        self,
        user_id: int,
        lemma_uuids: Sequence[UUID],
    ) -> dict[str, UserLemmaState]:
        """Batch vocabulary state lookup keyed by lemma UUID string.

        UUIDs that do not correspond to a Lemma row are omitted from the
        result. Callers that need a complete key set should default absent
        keys to ``"new"`` at the token-mapping boundary.
        """
        if not lemma_uuids:
            return {}
        rows = (
            await self.db.execute(
                select(Lemma.uuid, UserLemma.is_mastered)
                .outerjoin(
                    UserLemma,
                    (UserLemma.lemma_id == Lemma.id) & (UserLemma.user_id == user_id),
                )
                .where(Lemma.uuid.in_(lemma_uuids))
            )
        ).all()
        states: dict[str, UserLemmaState] = {}
        for lemma_uuid, is_mastered in rows:
            key = str(lemma_uuid)
            if is_mastered is True:
                states[key] = K_USER_LEMMA_STATE_MASTERED
            elif is_mastered is False:
                states[key] = K_USER_LEMMA_STATE_LEARNING
            else:
                states[key] = K_USER_LEMMA_STATE_NEW
        return states

    async def list_user_lemmas(
        self, user_id: int
    ) -> list[tuple[Lemma, UserLemmaState]]:
        """Return lemmas with their projected vocabulary state for this user."""
        rows = (
            await self.db.execute(
                select(Lemma, UserLemma.is_mastered)
                .join(UserLemma, UserLemma.lemma_id == Lemma.id)
                .where(UserLemma.user_id == user_id)
            )
        ).all()
        return [
            (
                lemma,
                K_USER_LEMMA_STATE_MASTERED
                if is_mastered
                else K_USER_LEMMA_STATE_LEARNING,
            )
            for lemma, is_mastered in rows
        ]
