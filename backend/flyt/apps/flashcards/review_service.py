"""Due-card selection, review outcomes, and FSRS scheduling."""

import secrets
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from fsrs import Card
from fsrs import Rating
from fsrs import State
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload
from sqlalchemy.orm import selectinload

from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.constants import DB_STATE_TO_FSRS_STATE
from flyt.apps.flashcards.constants import FSRS_STATE_TO_DB_STATE
from flyt.apps.flashcards.constants import K_ADD_MORE_NEW_CARD_COUNT_MAX
from flyt.apps.flashcards.constants import K_QUICK_REVIEW_CARD_COUNT
from flyt.apps.flashcards.constants import K_REVIEW_MODE_FULL
from flyt.apps.flashcards.constants import K_REVIEW_MODE_QUICK
from flyt.apps.flashcards.constants import SCHEDULER
from flyt.apps.flashcards.constants import ReviewMode
from flyt.apps.flashcards.constants import ReviewOutcome
from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.exceptions import InvalidReviewOutcomeError
from flyt.apps.flashcards.exceptions import InvalidReviewRatingError
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.queries import active_new_cards
from flyt.apps.flashcards.queries import addable_variant_exists
from flyt.apps.flashcards.queries import cards_due_for_review
from flyt.apps.flashcards.queries import query_count_due_states
from flyt.apps.flashcards.queries import query_daily_new_allowance
from flyt.apps.flashcards.types import DueCard
from flyt.apps.flashcards.types import QueueStateCounts
from flyt.apps.lexicons.models import Lemma
from flyt.apps.stats.services import StatsService
from flyt.apps.users.models import UserLemmaContext
from flyt.apps.users.services import UserLemmaService
from flyt.libs.utils.date import now
from flyt.libs.utils.date import now_aware
from flyt.libs.utils.date import start_of_next_utc_day
from flyt.libs.utils.date import to_utc_aware
from flyt.libs.utils.date import to_utc_naive

K_SECONDS_PER_MINUTE = 60


K_MINUTES_PER_HOUR = 60


K_HOURS_PER_DAY = 24


K_DAYS_PER_MONTH = 30


K_MONTHS_PER_YEAR = 12


K_DAYS_PER_YEAR = 365


def format_interval(delta: timedelta) -> str:
    """Anki-style compact interval label from a timedelta (min '1m')."""
    seconds = max(int(delta.total_seconds()), K_SECONDS_PER_MINUTE)
    minutes = seconds // K_SECONDS_PER_MINUTE
    if minutes < K_MINUTES_PER_HOUR:
        return f"{minutes}m"
    hours = minutes // K_MINUTES_PER_HOUR
    if hours < K_HOURS_PER_DAY:
        return f"{hours}h"
    days = hours // K_HOURS_PER_DAY
    if days < K_DAYS_PER_MONTH:
        return f"{days}d"
    months = days // K_DAYS_PER_MONTH
    if months < K_MONTHS_PER_YEAR:
        return f"{months}mo"
    return f"{days // K_DAYS_PER_YEAR}y"


class FlashcardReviewService:
    def __init__(
        self,
        db: AsyncSession,
        stats_service: StatsService,
        user_lemma_service: UserLemmaService,
        card_service: FlashcardCardService,
    ):
        self.db = db
        self.stats_service = stats_service
        self.user_lemma_service = user_lemma_service
        self.card_service = card_service

    def rating_previews(self, user_card: UserCard) -> dict[str, str]:
        """Human interval each rating would schedule, e.g. {"again":"1m", ...}.

        Lets the UI show "press Again -> 1m, Good -> 10m" so the learner knows
        whether a card repeats. Computed without persisting (preview only).
        """
        fsrs_card = self._build_fsrs_card(user_card)
        now_dt = now_aware()
        labels: dict[str, str] = {}
        for rating, key in (
            (Rating.Again, "again"),
            (Rating.Hard, "hard"),
            (Rating.Good, "good"),
            (Rating.Easy, "easy"),
        ):
            try:
                reviewed, _ = SCHEDULER.review_card(fsrs_card, rating)
            except (ValueError, AssertionError):
                return {}
            labels[key] = format_interval(reviewed.due - now_dt)
        return labels

    async def submit_review(
        self,
        user_id: int,
        user_card_id: int,
        card_id: int,
        outcome: ReviewOutcome,
        rating: int | None,
    ) -> tuple[UserCard, bool]:
        """Dispatch one review outcome; returns (user_card, scheduled).

        Ungraded outcomes (``skipped`` / ``service_unavailable``) resolve the
        issued variant without changing FSRS state or review logs.
        """
        if outcome == ReviewOutcome.GRADED:
            if rating is None:
                raise InvalidReviewRatingError()
            user_card = await self.review_card(user_id, user_card_id, rating, card_id)
            return user_card, True

        user_card, shown = await self._load_reviewable_user_card_or_raise(
            user_id, user_card_id, card_id
        )
        if shown.type not in {CardType.SPEAK, CardType.WRITE}:
            raise InvalidReviewOutcomeError()
        user_card.last_shown_card_id = card_id
        user_card.active_card_id = None
        return user_card, False

    async def review_card(
        self, user_id: int, user_card_id: int, rating: int, card_id: int
    ) -> UserCard:
        if rating not in {Rating.Again, Rating.Hard, Rating.Good, Rating.Easy}:
            raise InvalidReviewRatingError()

        user_card, _shown = await self._load_reviewable_user_card_or_raise(
            user_id, user_card_id, card_id
        )

        review_payload = self._build_fsrs_review_result(
            user_card=user_card,
            rating=rating,
        )
        last_review_at = to_utc_naive(review_payload.last_review)
        due_at = to_utc_naive(review_payload.due)
        if due_at is None:
            raise ValueError("FSRS review result requires a due date")

        was_new = user_card.state == CardState.NEW
        user_card.fsrs_stability = review_payload.stability
        user_card.fsrs_difficulty = review_payload.difficulty
        user_card.fsrs_step = review_payload.step
        user_card.last_review_at = last_review_at
        user_card.due_at = due_at
        user_card.state = FSRS_STATE_TO_DB_STATE[review_payload.state]
        user_card.last_shown_card_id = card_id
        user_card.active_card_id = None
        # Reviewing a card means it is in the active pool. Guards against a card
        # that was surfaced via the read-path UPCOMING drip being reviewed before
        # the drip's promotion committed (would otherwise orphan it as UPCOMING).
        user_card.enrollment_state = Enrollment.ACTIVE
        if (
            was_new
            and user_card.state != CardState.NEW
            and user_card.introduced_at is None
        ):
            user_card.introduced_at = now()

        self.stats_service.create_review_log(
            user_id=user_id,
            user_card_id=user_card.id,
            rating=rating,
            reviewed_at=review_payload.last_review,
        )
        await self.db.flush()
        await self.user_lemma_service.sync_lemma_mastery_from_user_card(user_card)
        return user_card

    async def count_due_states(self, user_id: int) -> QueueStateCounts:
        return await query_count_due_states(self.db, user_id)

    async def issue_due_cards(
        self, user_id: int, mode: ReviewMode = K_REVIEW_MODE_FULL
    ) -> Sequence[DueCard]:
        """Select and issue the due set from ``UserCard`` (no queue table).

        This is a command, not a read: it records each unresolved issued
        variant via ``active_card_id`` (submitting a sibling variant must
        fail) while retaining ``last_shown_card_id`` as rotation history, and
        promotes UPCOMING cards to ACTIVE via ``promote_upcoming_to_fill`` to
        fill the remaining daily-new quota.

        Eligibility (``enrollment_state == ACTIVE``):
        - LEARNING / RELEARNING with ``due_at < start_of_next_utc_day(now())``
          (the whole calendar day is eligible; the frontend gates display).
        - REVIEW with ``due_at <= now()``.

        Cards whose pool owns no addable variant are excluded everywhere; the
        shared predicates live in ``flashcards/queries.py``.

        Ordered by ``due_at asc, id asc``. Already-introduced ACTIVE NEW cards
        are always visible; the daily-new limit only controls how many
        unintroduced ACTIVE NEW cards and UPCOMING cards can be introduced.
        UPCOMING cards are promoted via ``promote_upcoming_to_fill`` for the
        remaining quota. A variant is picked per UserCard via ``_pick_variant``.
        """
        now_dt = now()
        day_end = start_of_next_utc_day(now_dt)

        due_stmt = (
            select(UserCard)
            .options(raiseload(UserCard.pool))
            .where(UserCard.user_id == user_id)
            .where(UserCard.enrollment_state == Enrollment.ACTIVE)
            .where(cards_due_for_review(now_dt, day_end))
            .order_by(UserCard.due_at.asc(), UserCard.id.asc())
            .with_for_update()
        )
        due_cards = list((await self.db.scalars(due_stmt)).all())

        introduced_new_cards = await self._select_introduced_new_cards(user_id)
        due_cards += introduced_new_cards

        new_remaining = await query_daily_new_allowance(self.db, user_id, now_dt)
        if new_remaining > 0:
            new_cards = await self._select_unintroduced_new_cards(
                user_id,
                limit=new_remaining,
                exclude_pool_ids={c.pool_id for c in introduced_new_cards},
            )
            if len(new_cards) < new_remaining:
                new_cards += await self.promote_upcoming_to_fill(
                    user_id,
                    want=new_remaining - len(new_cards),
                    exclude_pool_ids={
                        c.pool_id for c in [*introduced_new_cards, *new_cards]
                    },
                )
            due_cards += new_cards

        result = await self._to_due_cards(due_cards)
        if mode == K_REVIEW_MODE_QUICK:
            result = result[:K_QUICK_REVIEW_CARD_COUNT]
        for due_card in result:
            due_card.user_card.active_card_id = due_card.card.id
        return result

    async def promote_upcoming_to_fill(
        self,
        user_id: int,
        want: int,
        exclude_pool_ids: set[int],
    ) -> list[UserCard]:
        """Activate up to ``want`` UPCOMING cards via ``activate_pool_for_user``.

        Selects UPCOMING UserCards joined to ``CardPool`` (ordered by
        ``_upcoming_order``), excluding ``exclude_pool_ids`` and pools that own
        no addable FlashCard. Each selected row is routed through the shared
        activation command so the UserLemma invariant is maintained for
        lemma-owned pools. Returns the promoted rows so the caller can include
        them in the due set.
        """
        if want <= 0:
            return []

        promote_stmt = (
            select(UserCard)
            .options(raiseload(UserCard.pool))
            .join(CardPool, CardPool.id == UserCard.pool_id)
            .where(UserCard.user_id == user_id)
            .where(UserCard.enrollment_state == Enrollment.UPCOMING)
            .where(UserCard.state == CardState.NEW)
            .where(addable_variant_exists())
            .order_by(*self._upcoming_order())
            .limit(want)
            .with_for_update()
        )
        if exclude_pool_ids:
            promote_stmt = promote_stmt.where(UserCard.pool_id.not_in(exclude_pool_ids))

        upcoming_cards = list((await self.db.scalars(promote_stmt)).all())
        promoted: list[UserCard] = []
        for card in upcoming_cards:
            activated = await self.card_service.activate_pool_for_user(
                user_id, card.pool_id
            )
            promoted.append(activated)
        return promoted

    async def add_more_new(self, user_id: int) -> int:
        """Promote a capped batch of UPCOMING cards to ACTIVE/NEW.

        Explicit learner action ("add more new words") that promotes up to the
        endpoint maximum via ``promote_upcoming_to_fill`` and returns the number
        promoted. This is separate from the automatic daily-new drip allowance;
        promoted cards still count toward later drip calculations through
        ``introduced_at``.
        """
        promoted = await self.promote_upcoming_to_fill(
            user_id=user_id,
            want=K_ADD_MORE_NEW_CARD_COUNT_MAX,
            exclude_pool_ids=set(),
        )
        return len(promoted)

    async def _load_reviewable_user_card_or_raise(
        self, user_id: int, user_card_id: int, card_id: int
    ) -> tuple[UserCard, FlashCard]:
        user_card = await self.db.scalar(
            select(UserCard)
            .options(selectinload(UserCard.pool))
            .where(UserCard.user_id == user_id)
            .where(UserCard.id == user_card_id)
            .with_for_update()
        )
        if not user_card:
            raise CardNotFoundError()

        if user_card.active_card_id != card_id:
            raise CardNotFoundError()

        shown = await self.db.scalar(
            select(FlashCard)
            .where(FlashCard.id == card_id)
            .where(FlashCard.pool_id == user_card.pool_id)
        )
        if shown is None:
            raise CardNotFoundError()
        return user_card, shown

    def _pick_variant(
        self, user_card: UserCard, pool_cards: list[FlashCard]
    ) -> FlashCard:
        if len(pool_cards) == 1:
            return pool_cards[0]

        if user_card.active_card_id is not None:
            active = next(
                (card for card in pool_cards if card.id == user_card.active_card_id),
                None,
            )
            if active is not None:
                return active

        candidates = [
            card for card in pool_cards if card.id != user_card.last_shown_card_id
        ]
        return secrets.choice(candidates or pool_cards)

    async def _select_introduced_new_cards(self, user_id: int) -> list[UserCard]:
        """Select ACTIVE NEW cards that were already introduced to the user."""
        stmt = (
            self._active_new_cards_stmt(user_id)
            .where(UserCard.introduced_at.is_not(None))
            .order_by(
                CardPool.frequency_rank.is_(None).asc(),
                CardPool.frequency_rank.asc(),
                UserCard.id.asc(),
            )
        )
        return list((await self.db.scalars(stmt)).all())

    async def _select_unintroduced_new_cards(
        self,
        user_id: int,
        *,
        limit: int,
        exclude_pool_ids: set[int],
    ) -> list[UserCard]:
        """Select unintroduced ACTIVE NEW cards for today's remaining quota."""
        stmt = (
            self._active_new_cards_stmt(user_id)
            .where(UserCard.introduced_at.is_(None))
            .order_by(
                CardPool.frequency_rank.is_(None).asc(),
                CardPool.frequency_rank.asc(),
                UserCard.id.asc(),
            )
            .limit(limit)
        )
        if exclude_pool_ids:
            stmt = stmt.where(UserCard.pool_id.not_in(exclude_pool_ids))
        return list((await self.db.scalars(stmt)).all())

    def _active_new_cards_stmt(self, user_id: int):
        return (
            select(UserCard)
            .options(raiseload(UserCard.pool))
            .join(CardPool, CardPool.id == UserCard.pool_id)
            .where(active_new_cards(user_id))
            .with_for_update()
        )

    async def _to_due_cards(self, user_cards: list[UserCard]) -> list[DueCard]:
        """Pick a variant per UserCard and assemble ``DueCard`` objects.

        Loads addable FlashCards for the relevant pools in one query, groups by
        ``pool_id``, calls ``_pick_variant`` per card, and builds ``DueCard``
        with ``word_forms`` resolved via ``CardPool.lemma.word_forms``. The
        eligibility predicates already exclude pools without an addable
        variant; the skip below is a defensive guard, not a filter.
        """
        if not user_cards:
            return []

        pool_ids = {uc.pool_id for uc in user_cards}

        pool_cards_rows = (
            await self.db.scalars(
                select(FlashCard)
                .options(selectinload(FlashCard.pool).raiseload(CardPool.lesson))
                .where(FlashCard.pool_id.in_(pool_ids))
                .where(FlashCard.is_addable.is_(True))
                .order_by(FlashCard.id.asc())
            )
        ).all()
        cards_by_pool: dict[int, list[FlashCard]] = {}
        for card in pool_cards_rows:
            if card.pool_id is None:
                continue
            cards_by_pool.setdefault(card.pool_id, []).append(card)

        pools = (
            await self.db.scalars(
                select(CardPool)
                .options(
                    selectinload(CardPool.lemma).selectinload(Lemma.word_forms),
                    raiseload(CardPool.lesson),
                )
                .where(CardPool.id.in_(pool_ids))
            )
        ).all()
        pool_by_id = {p.id: p for p in pools}

        lemma_ids = {pool.lemma_id for pool in pools if pool.lemma_id is not None}
        contexts_by_lemma: dict[int, UserLemmaContext] = {}
        if lemma_ids:
            context_rows = (
                await self.db.scalars(
                    select(UserLemmaContext)
                    .where(UserLemmaContext.user_id == user_cards[0].user_id)
                    .where(UserLemmaContext.lemma_id.in_(lemma_ids))
                    .order_by(
                        UserLemmaContext.updated_at.desc(),
                        UserLemmaContext.id.desc(),
                    )
                )
            ).all()
            for context in context_rows:
                contexts_by_lemma.setdefault(context.lemma_id, context)

        result: list[DueCard] = []
        for uc in user_cards:
            pool_cards = cards_by_pool.get(uc.pool_id, [])
            if not pool_cards:
                continue
            picked = self._pick_variant(uc, pool_cards)
            pool = pool_by_id.get(uc.pool_id)
            word_forms = list(pool.lemma.word_forms) if pool and pool.lemma else []
            result.append(
                DueCard(
                    user_card=uc,
                    card=picked,
                    word_forms=word_forms,
                    rating_previews=self.rating_previews(uc),
                    context=(
                        contexts_by_lemma.get(pool.lemma_id)
                        if pool is not None and pool.lemma_id is not None
                        else None
                    ),
                )
            )
        return result

    def _upcoming_order(self) -> tuple[Any, ...]:
        """ORDER BY tuple for the UPCOMING promoter (frequency_rank nulls-last, id).

        Isolated so future decks can swap the ordering strategy.
        """
        return (
            CardPool.frequency_rank.is_(None).asc(),
            CardPool.frequency_rank.asc(),
            UserCard.id.asc(),
        )

    def _build_fsrs_card(self, user_card: UserCard) -> Card:
        fsrs_state = DB_STATE_TO_FSRS_STATE[user_card.state]
        step = user_card.fsrs_step
        if fsrs_state in (State.Learning, State.Relearning) and step is None:
            step = 0
        if fsrs_state is State.Review:
            step = None

        return Card(
            card_id=user_card.id,
            state=fsrs_state,
            step=step,
            stability=user_card.fsrs_stability,
            difficulty=user_card.fsrs_difficulty,
            due=to_utc_aware(user_card.due_at),
            last_review=to_utc_aware(user_card.last_review_at),
        )

    def _build_fsrs_review_result(self, user_card: UserCard, rating: int) -> Card:
        reviewed, _ = SCHEDULER.review_card(
            self._build_fsrs_card(user_card), Rating(rating)
        )
        return reviewed
