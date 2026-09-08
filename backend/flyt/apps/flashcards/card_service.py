"""Vocabulary card snapshots and learner pool enrollment."""

import logging
import uuid
from collections import Counter
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload
from sqlalchemy.orm import selectinload

from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.exceptions import LemmaNotDeckableError
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.schemas import DefinitionEntry
from flyt.apps.flashcards.schemas import DefinitionPayload
from flyt.apps.flashcards.schemas import LemmaContextCreate
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.users.models import UserLemmaContext
from flyt.apps.users.services import UserLemmaService
from flyt.core.exceptions import ConflictError
from flyt.libs.utils.date import now

logger = logging.getLogger(__name__)


def lemma_pool_key(lemma: Lemma) -> str:
    # source_lemma_id ALONE is not unique — Ordbøkene reuses a lemma id across
    # homograph articles (e.g. "pose" bag and "pose" stance share source_lemma_id
    # 52694 in different articles), so keying on it alone collapses two senses
    # into one pool and drops a card.
    if lemma.source_article_id is not None and lemma.source_lemma_id is not None:
        return f"vocab_source_{lemma.source_article_id}_{lemma.source_lemma_id}"
    if lemma.source_article_id is not None:
        return (
            "vocab_source_article_"
            f"{lemma.source_article_id}_{lemma.pos.value}_{lemma.hgno}"
        )
    return f"vocab_{lemma.uuid}"


_SENSE_CUE_MAXLEN = 42


def sense_cue_text(lemma: Lemma) -> str | None:
    """Short Norwegian cue from the lemma's first definition (disambiguates the
    sense without leaking the English answer)."""
    text = _first_definition(lemma)
    return _truncate_cue(text) if text else None


def _first_definition(lemma: Lemma) -> str | None:
    """The lemma's first non-blank Norwegian definition text (untruncated)."""
    for definition in lemma.definitions:
        text = (definition.definition or "").strip()
        if text:
            return text
    return None


def _truncate_cue(text: str) -> str:
    if len(text) > _SENSE_CUE_MAXLEN:
        return text[: _SENSE_CUE_MAXLEN - 1].rstrip() + "…"
    return text


class EnrollmentShape(StrEnum):
    """Named UserCard enrollment semantics for the bulk primitive.

    ACTIVATE_NOW: ACTIVE with ``introduced_at`` set — an explicit learner
    action; the cards are served immediately and are exempt from the daily
    new-card allowance. ENQUEUE_UPCOMING: UPCOMING with ``introduced_at``
    unset — the cards wait to be introduced within a later daily allowance.
    """

    ACTIVATE_NOW = "activate_now"
    ENQUEUE_UPCOMING = "enqueue_upcoming"


class FlashcardCardService:
    def __init__(
        self,
        db: AsyncSession,
        user_lemma_service: UserLemmaService,
    ):
        self.db = db
        self.user_lemma_service = user_lemma_service

    # --- Shared activation commands ---

    async def enroll_pools(
        self,
        user_id: int,
        pool_ids: Sequence[int],
        *,
        shape: EnrollmentShape,
        require_addable_variant: bool = False,
    ) -> None:
        """Bulk-enroll UserCard rows for pools the user does not already own.

        One conflict-safe insert (``uq_user_card_pool``) whose scheduling
        consequence is named by ``shape`` rather than implied by column
        assignments. ``require_addable_variant`` skips pools the due set could
        never serve. Pools the user already owns are left untouched, so the
        call is idempotent and never resets scheduling.
        """
        candidates = set(pool_ids)
        if not candidates:
            return
        if require_addable_variant:
            addable_pool_ids = set(
                (
                    await self.db.scalars(
                        select(FlashCard.pool_id)
                        .where(FlashCard.pool_id.in_(candidates))
                        .where(FlashCard.is_addable.is_(True))
                        .distinct()
                    )
                ).all()
            )
            candidates &= addable_pool_ids
            if not candidates:
                return

        existing_pool_ids = set(
            (
                await self.db.scalars(
                    select(UserCard.pool_id)
                    .where(UserCard.user_id == user_id)
                    .where(UserCard.pool_id.in_(candidates))
                )
            ).all()
        )
        missing = candidates - existing_pool_ids
        if not missing:
            return

        enrolled_at = now()
        enrollment_state, introduced_at = (
            (Enrollment.ACTIVE, enrolled_at)
            if shape is EnrollmentShape.ACTIVATE_NOW
            else (Enrollment.UPCOMING, None)
        )
        stmt = pg_insert(UserCard).values(
            [
                {
                    "user_id": user_id,
                    "pool_id": pool_id,
                    "due_at": enrolled_at,
                    "state": CardState.NEW,
                    "enrollment_state": enrollment_state,
                    "introduced_at": introduced_at,
                }
                for pool_id in sorted(missing)
            ]
        )
        await self.db.execute(
            stmt.on_conflict_do_nothing(constraint="uq_user_card_pool")
        )

    # --- Shared vocabulary pool/card builder ---

    async def find_or_create_lemma_pool_with_definition_card(
        self,
        lemma: Lemma,
        *,
        log_repair: bool = False,
    ) -> CardPool:
        """Find or create the vocabulary CardPool and one DEFINITION card.

        Reloads the lemma with ``selectinload(Lemma.definitions)`` internally
        so the caller does not need to preload the relationship. If the pool
        or card already exist they are returned as-is (existing snapshots are
        never refreshed by this builder).
        """
        loaded_lemma = await self.db.scalar(
            select(Lemma)
            .options(selectinload(Lemma.definitions))
            .where(Lemma.id == lemma.id)
        )
        if loaded_lemma is None:
            raise LemmaNotDeckableError()
        lemma = loaded_lemma

        insert_pool_stmt = (
            pg_insert(CardPool)
            .values(
                lemma_id=lemma.id,
                lesson_id=None,
                key=lemma_pool_key(lemma),
            )
            .on_conflict_do_nothing(
                index_elements=[CardPool.lemma_id],
            )
            .returning(CardPool.id)
        )
        inserted_pool_id = await self.db.scalar(insert_pool_stmt)

        pool = await self.db.scalar(
            select(CardPool).where(CardPool.lemma_id == lemma.id).with_for_update()
        )
        if pool is None:
            raise RuntimeError(f"Failed to create vocabulary pool for lemma {lemma.id}")
        if log_repair and inserted_pool_id is not None:
            logger.warning("Created missing vocabulary pool for lemma %s", lemma.uuid)

        existing_card_id = await self.db.scalar(
            select(FlashCard.id)
            .where(FlashCard.pool_id == pool.id)
            .where(FlashCard.type == CardType.DEFINITION)
            .limit(1)
        )
        if existing_card_id is None:
            payload = self._definition_payload_for_lemma(lemma)
            await self.create_card(
                card_type=CardType.DEFINITION,
                pool_id=pool.id,
                is_addable=True,
                payload=payload.model_dump(mode="json"),
            )
            if log_repair:
                logger.warning(
                    "Created missing vocabulary definition card for lemma %s",
                    lemma.uuid,
                )

        # Always sync — a rebuild where both homograph cards already exist must
        # still back-fill their cues, not just the first-creation case.
        await self._sync_sense_cues(lemma.word, lemma.pos)
        return pool

    async def activate_pool_for_user(self, user_id: int, pool_id: int) -> UserCard:
        """Create or promote the user's UserCard for a pool to ACTIVE.

        - Missing UserCard: created as ACTIVE, NEW, due_at=now(), introduced_at=now().
        - Existing UPCOMING UserCard: promoted in place to the same active-new shape.
        - Existing ACTIVE UserCard: idempotent success without resetting scheduling.

        For lemma-owned pools, ensures the matching UserLemma row exists. The
        daily new-card limit is not enforced here; callers (drip) check the
        allowance before calling.
        """
        pool = await self.db.get(
            CardPool,
            pool_id,
            options=[raiseload(CardPool.lesson)],
        )
        if pool is None:
            raise CardNotFoundError()

        activated_at = now()
        insert_stmt = pg_insert(UserCard).values(
            user_id=user_id,
            pool_id=pool_id,
            due_at=activated_at,
            introduced_at=activated_at,
            state=CardState.NEW,
            enrollment_state=Enrollment.ACTIVE,
        )
        insert_stmt = insert_stmt.on_conflict_do_nothing(
            constraint="uq_user_card_pool",
        )
        await self.db.execute(insert_stmt)

        user_card = await self.db.scalar(
            select(UserCard)
            .options(raiseload(UserCard.pool))
            .where(UserCard.user_id == user_id)
            .where(UserCard.pool_id == pool_id)
            .with_for_update()
        )
        if user_card is None:
            raise RuntimeError("Failed to activate user card")

        if user_card.enrollment_state == Enrollment.UPCOMING:
            user_card.enrollment_state = Enrollment.ACTIVE
            user_card.state = CardState.NEW
            user_card.due_at = activated_at
            user_card.introduced_at = activated_at
            await self.db.flush()
        elif user_card.enrollment_state == Enrollment.ACTIVE:
            pass
        else:
            raise ConflictError("Card cannot be activated", "CARD_NOT_ACTIVATABLE")

        if pool.lemma_id is not None:
            await self.user_lemma_service.ensure_lemma_for_user(user_id, pool.lemma_id)

        return user_card

    async def add_lemma_to_deck(
        self,
        user_id: int,
        lemma_uuid: uuid.UUID,
        context: LemmaContextCreate | None = None,
    ) -> None:
        lemma = await self.db.scalar(
            select(Lemma)
            .options(selectinload(Lemma.definitions))
            .where(Lemma.uuid == lemma_uuid)
        )
        if lemma is None:
            raise LemmaNotDeckableError()

        pool = await self.find_or_create_lemma_pool_with_definition_card(
            lemma,
            log_repair=True,
        )
        await self.activate_pool_for_user(user_id, pool.id)
        if context is not None:
            context_insert = pg_insert(UserLemmaContext).values(
                user_id=user_id,
                lemma_id=lemma.id,
                source_sentence=context.source_sentence,
                source_title=context.source_title,
            )
            await self.db.execute(
                context_insert.on_conflict_do_update(
                    index_elements=[
                        UserLemmaContext.user_id,
                        UserLemmaContext.lemma_id,
                        UserLemmaContext.source_sentence,
                    ],
                    set_={
                        "source_title": context_insert.excluded.source_title,
                        "updated_at": func.now(),
                    },
                )
            )

    async def create_card(
        self,
        card_type: CardType,
        payload: dict[str, Any],
        is_addable: bool,
        pool_id: int | None = None,
        card_uuid: uuid.UUID | None = None,
        schema_version: str | None = None,
    ) -> FlashCard:
        card = FlashCard(
            type=card_type,
            payload_json=payload,
            schema_version=schema_version,
            is_addable=is_addable,
            pool_id=pool_id,
            uuid=card_uuid,
        )
        self.db.add(card)
        await self.db.flush()
        return card

    async def update_card(
        self,
        card_id: int,
        card_type: CardType,
        payload: dict[str, Any],
        is_addable: bool,
        schema_version: str | None = None,
    ) -> FlashCard:
        card = await self.db.scalar(
            update(FlashCard)
            .where(FlashCard.id == card_id)
            .values(
                type=card_type,
                payload_json=payload,
                schema_version=schema_version,
                is_addable=is_addable,
            )
            .returning(FlashCard)
        )
        if card is None:
            raise RuntimeError(f"Failed to update card {card_id}")
        return card

    async def delete_cards_by_ids(self, card_ids: Sequence[int]) -> None:
        if not card_ids:
            return
        await self.db.execute(delete(FlashCard).where(FlashCard.id.in_(card_ids)))

    async def clear_user_card_references_by_ids(self, card_ids: Sequence[int]) -> None:
        if not card_ids:
            return
        await self.db.execute(
            update(UserCard)
            .where(UserCard.last_shown_card_id.in_(card_ids))
            .values(last_shown_card_id=None)
        )
        await self.db.execute(
            update(UserCard)
            .where(UserCard.active_card_id.in_(card_ids))
            .values(active_card_id=None)
        )

    async def set_cards_addable_by_ids(
        self,
        card_ids: Sequence[int],
        is_addable: bool,
    ) -> None:
        if not card_ids:
            return
        await self.db.execute(
            update(FlashCard)
            .where(FlashCard.id.in_(card_ids))
            .values(is_addable=is_addable)
        )

    async def disable_addable_cards_for_pool(self, pool_id: int) -> None:
        await self.db.execute(
            update(FlashCard)
            .where(FlashCard.pool_id == pool_id)
            .where(FlashCard.is_addable.is_(True))
            .values(is_addable=False)
        )

    def _definition_payload_for_lemma(self, lemma: Lemma) -> DefinitionPayload:
        """Snapshot the lemma article into a self-contained DEFINITION payload.

        Cards do not depend on a live FK to the lexicon to render. If a
        definition is edited later, existing cards keep the content they were
        created with (correct SRS behavior).
        """
        return DefinitionPayload(
            lemma_uuid=str(lemma.uuid),
            source_article_id=lemma.source_article_id,
            source_lemma_id=lemma.source_lemma_id,
            hgno=lemma.hgno,
            sense_cue=None,  # filled by the collision sync after the card exists
            is_sub_article=lemma.is_sub_article,
            word=lemma.word,
            pos=lemma.pos,
            primary_translation=lemma.primary_translation,
            ipa=lemma.ipa,
            intonation=lemma.intonation,
            ipa_approximate=lemma.ipa_approximate,
            audio_url=lemma.audio_url,
            definitions=[
                DefinitionEntry(
                    uuid=str(definition.uuid),
                    definition=definition.definition,
                    translation=definition.translation,
                    examples_json=definition.examples_json,
                )
                for definition in lemma.definitions
            ],
        )

    async def _sync_sense_cues(self, word: str, pos: LemmaPos) -> None:
        """Precompute and store the Norwegian sense cue on every addable
        DEFINITION card that shares this (word, pos).

        Set the cue only when >1 such card coexists (a real homograph collision);
        clear it otherwise. Cheap and idempotent — runs on card creation.
        """
        rows = (
            await self.db.execute(
                select(FlashCard, Lemma)
                .join(CardPool, FlashCard.pool_id == CardPool.id)
                .join(Lemma, CardPool.lemma_id == Lemma.id)
                .where(Lemma.word == word)
                .where(Lemma.pos == pos)
                .where(FlashCard.type == CardType.DEFINITION)
                .where(FlashCard.is_addable.is_(True))
                .options(selectinload(Lemma.definitions))
            )
        ).all()

        cues = self._resolve_group_cues(rows) if len(rows) > 1 else {}
        for card, _lemma in rows:
            cue = cues.get(card.id)
            if card.payload_json.get("sense_cue") != cue:
                card.payload_json = {**card.payload_json, "sense_cue": cue}

    @staticmethod
    def _resolve_group_cues(
        rows: Sequence[Any],
    ) -> dict[int, str | None]:
        """Cue per card in a colliding (word, pos) group, kept distinct.

        Truncated first definition normally; falls back to the full definition
        when two truncations collide (shared first ~41 chars).
        """
        full = {card.id: _first_definition(lemma) for card, lemma in rows}
        cues = {cid: (_truncate_cue(t) if t else None) for cid, t in full.items()}
        dupes = {c for c, n in Counter(c for c in cues.values() if c).items() if n > 1}
        for cid in cues:
            if cues[cid] in dupes and full[cid]:
                cues[cid] = full[cid]
        return cues
