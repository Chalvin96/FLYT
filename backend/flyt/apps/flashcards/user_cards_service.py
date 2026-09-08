"""Learner card catalog, mastery buckets, and filtered pagination."""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Select
from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import exists
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Load

from flyt.apps.flashcards.constants import K_MASTERY_FAMILIAR_MAX
from flyt.apps.flashcards.constants import K_MASTERY_KNOWN_MAX
from flyt.apps.flashcards.constants import K_MY_CARDS_DEFAULT_PAGE_SIZE
from flyt.apps.flashcards.constants import K_MY_CARDS_MAX_PAGE_SIZE
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lessons.models import Lesson
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import WordForm

K_MASTERY_BUCKET_NOT_STARTED = "not_started"


K_MASTERY_BUCKET_LEARNING = "learning"


K_MASTERY_BUCKET_FAMILIAR = "familiar"


K_MASTERY_BUCKET_KNOWN = "known"


K_MASTERY_BUCKET_MASTERED = "mastered"


K_ALL_MASTERY_BUCKETS = (
    K_MASTERY_BUCKET_NOT_STARTED,
    K_MASTERY_BUCKET_LEARNING,
    K_MASTERY_BUCKET_FAMILIAR,
    K_MASTERY_BUCKET_KNOWN,
    K_MASTERY_BUCKET_MASTERED,
)


def derive_mastery_bucket(state: CardState, stability: float | None) -> str:
    """Map a UserCard's FSRS state + stability to a named mastery bucket.

    Stability is in days. Null stability is treated defensively (NEW cards have
    no stability yet; REVIEW cards without stability fall into the lowest
    REVIEW bucket).
    """
    if state == CardState.NEW:
        return K_MASTERY_BUCKET_NOT_STARTED
    if state in (CardState.LEARNING, CardState.RELEARNING):
        return K_MASTERY_BUCKET_LEARNING
    # state == REVIEW from here on.
    if stability is None:
        return K_MASTERY_BUCKET_FAMILIAR
    if stability < K_MASTERY_FAMILIAR_MAX:
        return K_MASTERY_BUCKET_FAMILIAR
    if stability < K_MASTERY_KNOWN_MAX:
        return K_MASTERY_BUCKET_KNOWN
    return K_MASTERY_BUCKET_MASTERED


def mastery_bucket_sql_case(state_col: Any, stability_col: Any) -> Any:
    """SQL CASE expression mirroring derive_mastery_bucket() for use in
    GROUP BY / WHERE / ORDER BY without loading rows into Python.
    """
    return case(
        (state_col == CardState.NEW, K_MASTERY_BUCKET_NOT_STARTED),
        (
            state_col.in_((CardState.LEARNING, CardState.RELEARNING)),
            K_MASTERY_BUCKET_LEARNING,
        ),
        (stability_col.is_(None), K_MASTERY_BUCKET_FAMILIAR),
        (stability_col < K_MASTERY_FAMILIAR_MAX, K_MASTERY_BUCKET_FAMILIAR),
        (stability_col < K_MASTERY_KNOWN_MAX, K_MASTERY_BUCKET_KNOWN),
        else_=K_MASTERY_BUCKET_MASTERED,
    )


def _first_gloss(primary_translation: str | None) -> str | None:
    """Return the first gloss from a primary_translation, splitting on ' / '."""
    if primary_translation is None:
        return None
    first = primary_translation.split(" / ", 1)[0].strip()
    return first or None


def _humanize_pool_key(key: str) -> str:
    """Convert a snake_case pool key to a readable label, stripping obj_ prefix."""
    slug = key.removeprefix("obj_")
    return slug.replace("_", " ").capitalize()


def _my_cards_q_predicate(normalized_q: str) -> Any:
    """SQL My Cards search predicate.

    Vocab rows match lemma word, any word form, or primary_translation;
    grammar rows match the pool label (description, else humanized key) or
    lesson title. ``autoescape`` keeps LIKE metacharacters in the query
    literal.
    """
    vocab_match = or_(
        func.lower(Lemma.word).contains(normalized_q, autoescape=True),
        exists()
        .where(WordForm.lemma_id == Lemma.id)
        .where(func.lower(WordForm.form).contains(normalized_q, autoescape=True)),
        func.lower(Lemma.primary_translation).contains(normalized_q, autoescape=True),
    )
    grammar_label = func.lower(
        func.coalesce(
            func.nullif(CardPool.description, ""),
            func.replace(func.regexp_replace(CardPool.key, "^obj_", ""), "_", " "),
        )
    )
    grammar_match = or_(
        grammar_label.contains(normalized_q, autoescape=True),
        func.lower(Lesson.title).contains(normalized_q, autoescape=True),
    )
    return or_(
        and_(Lemma.id.is_not(None), vocab_match),
        and_(Lemma.id.is_(None), Lesson.id.is_not(None), grammar_match),
    )


def _my_cards_base_stmt(
    user_id: int,
    *,
    facet: str,
    bucket: str | None,
    started_only: bool,
    q: str | None,
) -> Select[tuple[UserCard, CardPool, Lemma, Lesson]]:
    bucket_expr = mastery_bucket_sql_case(UserCard.state, UserCard.fsrs_stability)
    stmt = (
        select(UserCard, CardPool, Lemma, Lesson)
        .join(CardPool, CardPool.id == UserCard.pool_id)
        .outerjoin(Lemma, Lemma.id == CardPool.lemma_id)
        .outerjoin(Lesson, Lesson.id == CardPool.lesson_id)
        .where(UserCard.user_id == user_id)
        .where(UserCard.enrollment_state == Enrollment.ACTIVE)
        .where(Lemma.id.is_not(None) | Lesson.id.is_not(None))
    )
    if facet == "vocab":
        stmt = stmt.where(Lemma.id.is_not(None))
    elif facet == "grammar":
        stmt = stmt.where(Lesson.id.is_not(None))
    if bucket is not None:
        stmt = stmt.where(bucket_expr == bucket)
    if started_only:
        stmt = stmt.where(bucket_expr != K_MASTERY_BUCKET_NOT_STARTED)
    if q:
        normalized_q = q.strip().lower()
        if normalized_q:
            stmt = stmt.where(_my_cards_q_predicate(normalized_q))
    return stmt


@dataclass(frozen=True)
class MyCardEntry:
    user_card_id: int
    facet: str
    label: str
    subtitle: str | None
    bucket: str
    lemma_uuid: uuid.UUID | None
    lesson_id: int | None
    lesson_title: str | None = None
    last_review_at: Any = None
    fsrs_stability: float | None = None


@dataclass(frozen=True)
class MyCardsResult:
    cards: list[MyCardEntry]
    total: int
    counts_by_bucket: dict[str, int]
    page: int
    limit: int
    has_more: bool


class MyCardsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_user_cards(
        self,
        user_id: int,
        *,
        facet: str = "all",
        bucket: str | None = None,
        started_only: bool = True,
        q: str | None = None,
        sort: str = "weakest",
        page: int = 1,
        limit: int = K_MY_CARDS_DEFAULT_PAGE_SIZE,
    ) -> MyCardsResult:
        """Return the user's cards for the My Cards gallery.

        Joins UserCard -> CardPool -> (Lemma for vocab | Lesson for grammar),
        derives a mastery bucket per card, and returns paginated rows plus a
        summary of bucket counts across *all* the user's cards (independent of
        filters/pagination).

        Bucket counts are always computed in SQL over every ACTIVE card for the
        user, regardless of facet/bucket/started_only/q, matching the summary
        semantics the My Cards gallery relies on.

        When ``q`` is absent, facet/bucket/started_only filtering, sorting, and
        pagination are pushed into SQL so a 28k-entry deck doesn't get loaded
        into memory per request. ``q`` is also matched in SQL: lemma word,
        word forms, and primary_translation for vocab cards; pool label
        (description, else humanized key) and lesson title for grammar cards.
        """
        page = max(1, page)
        limit = max(1, min(limit, K_MY_CARDS_MAX_PAGE_SIZE))

        counts = await self._count_buckets(user_id)

        return await self._list_user_cards_sql(
            user_id,
            counts=counts,
            facet=facet,
            bucket=bucket,
            started_only=started_only,
            q=q,
            sort=sort,
            page=page,
            limit=limit,
        )

    async def _count_buckets(self, user_id: int) -> dict[str, int]:
        """Compute counts_by_bucket in SQL over all of a user's ACTIVE cards.

        Excludes pools that own neither a lemma nor a lesson, mirroring
        _build_my_card_entry() returning None for those rows so the summary
        total matches the visible rows.
        """
        bucket_expr = mastery_bucket_sql_case(UserCard.state, UserCard.fsrs_stability)
        rows = (
            await self.db.execute(
                select(bucket_expr.label("bucket"), func.count())
                .join(CardPool, CardPool.id == UserCard.pool_id)
                .outerjoin(Lemma, Lemma.id == CardPool.lemma_id)
                .outerjoin(Lesson, Lesson.id == CardPool.lesson_id)
                .where(UserCard.user_id == user_id)
                .where(UserCard.enrollment_state == Enrollment.ACTIVE)
                .where(Lemma.id.is_not(None) | Lesson.id.is_not(None))
                .group_by(bucket_expr)
            )
        ).all()
        counts: dict[str, int] = {name: 0 for name in K_ALL_MASTERY_BUCKETS}
        counts.update({bucket_name: count for bucket_name, count in rows})
        return counts

    async def _list_user_cards_sql(
        self,
        user_id: int,
        *,
        counts: dict[str, int],
        facet: str,
        bucket: str | None,
        started_only: bool,
        q: str | None,
        sort: str,
        page: int,
        limit: int,
    ) -> MyCardsResult:
        base = _my_cards_base_stmt(
            user_id,
            facet=facet,
            bucket=bucket,
            started_only=started_only,
            q=q,
        )
        label_expr = func.lower(
            case(
                (Lemma.id.is_not(None), Lemma.word),
                else_=func.coalesce(CardPool.description, CardPool.key),
            )
        )

        count_stmt = select(func.count()).select_from(
            base.with_only_columns(UserCard.id).subquery()
        )
        total_matching = (await self.db.scalar(count_stmt)) or 0

        order_by: tuple[Any, ...]
        if sort == "alpha":
            order_by = (label_expr.asc(),)
        elif sort == "recent":
            order_by = (
                UserCard.last_review_at.is_(None).asc(),
                UserCard.last_review_at.desc(),
                UserCard.id.desc(),
            )
        else:  # weakest
            order_by = (
                UserCard.fsrs_stability.is_(None).desc(),
                UserCard.fsrs_stability.asc(),
                label_expr.asc(),
            )

        offset = (page - 1) * limit
        # The relationship's model-level lazy="selectin" must be overridden
        # explicitly; entries never read word forms (search matches in SQL).
        page_stmt = (
            base.options(
                Load(UserCard).lazyload("*"),
                Load(CardPool).lazyload("*"),
                Load(Lemma).lazyload("*"),
                Load(Lesson).lazyload("*"),
            )
            .order_by(*order_by)
            .offset(offset)
            .limit(limit)
        )
        rows = (await self.db.execute(page_stmt)).all()

        page_rows: list[MyCardEntry] = []
        for user_card, pool, lemma, lesson in rows:
            entry = self._build_my_card_entry(user_card, pool, lemma, lesson)
            if entry is not None:
                page_rows.append(entry)

        has_more = offset + limit < total_matching

        return MyCardsResult(
            cards=page_rows,
            total=sum(counts.values()),
            counts_by_bucket=counts,
            page=page,
            limit=limit,
            has_more=has_more,
        )

    def _build_my_card_entry(
        self,
        user_card: UserCard,
        pool: CardPool,
        lemma: Lemma | None,
        lesson: Lesson | None,
    ) -> MyCardEntry | None:
        bucket = derive_mastery_bucket(user_card.state, user_card.fsrs_stability)
        if lemma is not None:
            return MyCardEntry(
                user_card_id=user_card.id,
                facet="vocab",
                label=lemma.word,
                subtitle=_first_gloss(lemma.primary_translation),
                bucket=bucket,
                lemma_uuid=lemma.uuid,
                lesson_id=None,
                last_review_at=user_card.last_review_at,
                fsrs_stability=user_card.fsrs_stability,
            )
        if lesson is not None:
            return MyCardEntry(
                user_card_id=user_card.id,
                facet="grammar",
                label=pool.description or _humanize_pool_key(pool.key),
                subtitle=None,
                bucket=bucket,
                lemma_uuid=None,
                lesson_id=lesson.id,
                lesson_title=lesson.title,
                last_review_at=user_card.last_review_at,
                fsrs_stability=user_card.fsrs_stability,
            )
        return None
