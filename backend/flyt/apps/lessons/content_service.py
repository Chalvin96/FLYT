"""Lesson release activation and practice-content reconciliation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import LESSON_REVIEW_AUDIO_KEY
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lessons.exceptions import LessonNotFoundError
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lessons.types import LessonImportBatch
from flyt.apps.lessons.types import LessonImportItem
from flyt.content.schemas import K_LESSON_PACKET_SCHEMA_VERSION
from flyt.content.schemas import LessonPacket

_EXERCISE_UUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "flyt://exercise")


def _exercise_uuid(lesson_source_id: str, exercise_id: str) -> uuid.UUID:
    return uuid.uuid5(
        _EXERCISE_UUID_NAMESPACE, f"{lesson_source_id}/exercises/{exercise_id}"
    )


@dataclass
class PracticeState:
    pools: list[CardPool]
    pools_by_key: dict[str, CardPool]
    cards: list[FlashCard]
    cards_by_uuid: dict[uuid.UUID, FlashCard]


class LessonContentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def import_lesson_content(
        self,
        lesson_import: LessonImportBatch,
        *,
        source: str,
    ) -> LessonRelease:
        revision = await self._activate_lesson_revision(lesson_import, source)
        await self._synchronize_lesson_content(revision, lesson_import)
        return revision

    async def delete_lesson_by_source_id(self, source_id: str) -> None:
        lesson = await self.db.scalar(
            select(Lesson)
            .join(LessonRelease)
            .where(Lesson.source_id == source_id)
            .where(LessonRelease.is_active.is_(True))
            .order_by(LessonRelease.id.desc())
        )
        if lesson is None:
            raise LessonNotFoundError()
        revision_id = lesson.release_id
        await self._delete_lesson_rows([lesson.id])
        revision = await self.db.get(LessonRelease, revision_id)
        if revision is None:
            return
        revision.lesson_count = await self._renumber_lessons(revision_id)
        await self.db.flush()

    async def _activate_lesson_revision(
        self,
        lesson_import: LessonImportBatch,
        source: str,
    ) -> LessonRelease:
        active_revision = await self._active_revision_for_import()
        if active_revision is None:
            active_revision = self._new_revision(lesson_import, source)
            self.db.add(active_revision)
        else:
            await self._deactivate_other_revisions(active_revision.id)
            self._update_revision(active_revision, lesson_import, source)

        await self.db.flush()
        return active_revision

    async def _synchronize_lesson_content(
        self,
        revision: LessonRelease,
        lesson_import: LessonImportBatch,
    ) -> None:
        existing_in_order = await self._lessons_for_revision(revision.id)
        existing_lessons = {lesson.source_id: lesson for lesson in existing_in_order}
        imported_ids = {item.packet.id for item in lesson_import.lessons}
        for item in lesson_import.lessons:
            lesson = existing_lessons.get(item.packet.id)
            if lesson is None:
                lesson = self._new_lesson(revision.id, item)
                self.db.add(lesson)
                await self.db.flush()
                await self._sync_practice_groups(lesson, item.packet)
                existing_lessons[lesson.source_id] = lesson
                continue

            packet_json = item.packet.model_dump(mode="json")
            packet_changed = lesson.packet_json != packet_json
            self._update_lesson(lesson, item)
            if packet_changed or await self._lesson_needs_audio_sync(
                lesson, item.packet
            ):
                await self._sync_practice_groups(lesson, item.packet)
                if packet_changed:
                    await self._preserve_progress(lesson, item.packet)

        omitted_lessons = [
            lesson
            for lesson in existing_in_order
            if lesson.source_id not in imported_ids
        ]
        await self._delete_lesson_rows([lesson.id for lesson in omitted_lessons])
        revision.lesson_count = len(lesson_import.lessons)
        await self.db.flush()

    async def _active_revision_for_import(self) -> LessonRelease | None:
        revision = await self.db.scalar(
            select(LessonRelease)
            .where(LessonRelease.is_active.is_(True))
            .order_by(LessonRelease.id.desc())
        )
        if revision is not None:
            return revision
        return await self.db.scalar(
            select(LessonRelease).order_by(LessonRelease.id.desc())
        )

    async def _deactivate_other_revisions(self, revision_id: int) -> None:
        revisions = (
            await self.db.scalars(
                select(LessonRelease)
                .where(LessonRelease.is_active.is_(True))
                .where(LessonRelease.id != revision_id)
            )
        ).all()
        for revision in revisions:
            revision.is_active = False

    @staticmethod
    def _update_revision(
        revision: LessonRelease,
        lesson_import: LessonImportBatch,
        source: str,
    ) -> None:
        revision.source = source
        revision.digest = lesson_import.digest
        revision.schema_version = K_LESSON_PACKET_SCHEMA_VERSION
        revision.language = lesson_import.language
        revision.translation_language = lesson_import.translation_language
        revision.is_active = True

    async def _lessons_for_revision(self, revision_id: int) -> list[Lesson]:
        return list(
            (
                await self.db.scalars(
                    select(Lesson)
                    .where(Lesson.release_id == revision_id)
                    .order_by(Lesson.release_order)
                )
            ).all()
        )

    async def _renumber_lessons(self, revision_id: int) -> int:
        remaining = await self._lessons_for_revision(revision_id)
        for release_order, lesson in enumerate(remaining, start=1):
            lesson.release_order = release_order
        return len(remaining)

    def _new_revision(
        self, lesson_import: LessonImportBatch, source: str
    ) -> LessonRelease:
        return LessonRelease(
            source=source,
            digest=lesson_import.digest,
            schema_version=K_LESSON_PACKET_SCHEMA_VERSION,
            language=lesson_import.language,
            translation_language=lesson_import.translation_language,
            lesson_count=lesson_import.lesson_count,
            is_active=True,
        )

    def _new_lesson(self, revision_id: int, item: LessonImportItem) -> Lesson:
        lesson = Lesson(release_id=revision_id, source_id=item.packet.id)
        self._update_lesson(lesson, item)
        return lesson

    def _update_lesson(self, lesson: Lesson, item: LessonImportItem) -> None:
        packet = item.packet
        lesson.release_order = item.entry.position + 1
        lesson.kind = packet.kind
        lesson.family_id = item.entry.family_id
        lesson.title = packet.title
        lesson.cefr_level = packet.cefr_level
        lesson.goal = packet.goal
        lesson.packet_json = packet.model_dump(mode="json")

    async def _lesson_needs_audio_sync(
        self, lesson: Lesson, packet: LessonPacket
    ) -> bool:
        audio_by_id = {
            asset.id: asset.model_dump(mode="json") for asset in packet.media.audio
        }
        expected_audio_by_exercise = {
            exercise.id: audio_by_id[exercise.audio_id]
            for exercise in packet.exercises
            if exercise.audio_id is not None
        }
        if not expected_audio_by_exercise:
            return False

        state = await self._load_practice_state(lesson.id)
        for exercise_id, expected_audio in expected_audio_by_exercise.items():
            card = state.cards_by_uuid.get(
                _exercise_uuid(lesson.source_id, exercise_id)
            )
            if (
                card is None
                or card.payload_json.get(LESSON_REVIEW_AUDIO_KEY) != expected_audio
            ):
                return True
        return False

    async def _sync_practice_groups(self, lesson: Lesson, packet: LessonPacket) -> None:
        state = await self._load_practice_state(lesson.id)
        await self._upsert_practice_pools(lesson, packet, state)
        await self.db.flush()
        desired_card_uuids, moved_pool_ids = self._upsert_practice_cards(
            lesson, packet, state
        )
        await self.db.flush()
        await self._remove_obsolete_practice_rows(
            packet, state, desired_card_uuids, moved_pool_ids
        )

    async def _load_practice_state(self, lesson_id: int) -> PracticeState:
        pools = list(
            (
                await self.db.scalars(
                    select(CardPool).where(CardPool.lesson_id == lesson_id)
                )
            ).all()
        )
        cards = list(
            (
                await self.db.scalars(
                    select(FlashCard)
                    .join(CardPool, FlashCard.pool_id == CardPool.id)
                    .where(CardPool.lesson_id == lesson_id)
                )
            ).all()
        )
        return PracticeState(
            pools=pools,
            pools_by_key={pool.key: pool for pool in pools},
            cards=cards,
            cards_by_uuid={card.uuid: card for card in cards if card.uuid is not None},
        )

    async def _upsert_practice_pools(
        self,
        lesson: Lesson,
        packet: LessonPacket,
        state: PracticeState,
    ) -> None:
        objective_statements = {
            objective.id: objective.statement for objective in packet.objectives
        }
        for group in packet.practice_groups:
            pool = state.pools_by_key.get(group.id)
            if pool is None:
                pool = CardPool(lesson_id=lesson.id, key=group.id)
                self.db.add(pool)
                state.pools_by_key[group.id] = pool
            pool.description = objective_statements.get(group.objective_id)

    def _upsert_practice_cards(
        self,
        lesson: Lesson,
        packet: LessonPacket,
        state: PracticeState,
    ) -> tuple[set[uuid.UUID], dict[int, set[int]]]:
        exercises_by_id = {exercise.id: exercise for exercise in packet.exercises}
        audio_by_id = {
            asset.id: asset.model_dump(mode="json") for asset in packet.media.audio
        }
        desired_card_uuids: set[uuid.UUID] = set()
        moved_pool_ids: dict[int, set[int]] = {}

        for group in packet.practice_groups:
            pool = state.pools_by_key[group.id]
            for exercise_id in group.exercise_ids:
                exercise = exercises_by_id[exercise_id]
                card_uuid = _exercise_uuid(lesson.source_id, exercise.id)
                payload_json = exercise.model_dump(mode="json")
                if exercise.audio_id is not None:
                    payload_json[LESSON_REVIEW_AUDIO_KEY] = audio_by_id[
                        exercise.audio_id
                    ]
                desired_card_uuids.add(card_uuid)
                card = state.cards_by_uuid.get(card_uuid)
                if card is None:
                    self.db.add(
                        FlashCard(
                            type=CardType(exercise.operation),
                            pool_id=pool.id,
                            is_addable=True,
                            schema_version=K_LESSON_PACKET_SCHEMA_VERSION,
                            uuid=card_uuid,
                            payload_json=payload_json,
                        )
                    )
                    continue
                if card.pool_id is not None and card.pool_id != pool.id:
                    moved_pool_ids.setdefault(card.pool_id, set()).add(pool.id)
                card.type = CardType(exercise.operation)
                card.pool_id = pool.id
                card.schema_version = K_LESSON_PACKET_SCHEMA_VERSION
                card.payload_json = payload_json

        return desired_card_uuids, moved_pool_ids

    async def _remove_obsolete_practice_rows(
        self,
        packet: LessonPacket,
        state: PracticeState,
        desired_card_uuids: set[uuid.UUID],
        moved_pool_ids: dict[int, set[int]],
    ) -> None:
        desired_pool_keys = {group.id for group in packet.practice_groups}
        removed_pool_ids = {
            pool.id for pool in state.pools if pool.key not in desired_pool_keys
        }
        removed_card_ids = {
            card.id
            for card in state.cards
            if card.uuid not in desired_card_uuids
            and card.pool_id not in removed_pool_ids
        }
        if removed_pool_ids:
            await self._migrate_user_cards(
                {
                    source_pool_id: next(iter(destination_pool_ids))
                    for source_pool_id, destination_pool_ids in moved_pool_ids.items()
                    if source_pool_id in removed_pool_ids
                    and len(destination_pool_ids) == 1
                }
            )
            await self._delete_user_cards_for_pools(removed_pool_ids)
            await self.db.execute(
                delete(FlashCard).where(FlashCard.pool_id.in_(removed_pool_ids))
            )
            await self.db.execute(
                delete(CardPool).where(CardPool.id.in_(removed_pool_ids))
            )
        if removed_card_ids:
            await self.db.execute(
                delete(FlashCard).where(FlashCard.id.in_(removed_card_ids))
            )

    async def _migrate_user_cards(self, pool_migrations: dict[int, int]) -> None:
        for source_pool_id, destination_pool_id in pool_migrations.items():
            source_cards = (
                await self.db.scalars(
                    select(UserCard).where(UserCard.pool_id == source_pool_id)
                )
            ).all()
            destination_cards = (
                await self.db.scalars(
                    select(UserCard).where(UserCard.pool_id == destination_pool_id)
                )
            ).all()
            destination_by_user_id = {
                user_card.user_id: user_card for user_card in destination_cards
            }

            for source_card in source_cards:
                destination_card = destination_by_user_id.get(source_card.user_id)
                if destination_card is None:
                    source_card.pool_id = destination_pool_id
                    destination_by_user_id[source_card.user_id] = source_card
                    continue

                survivor = self._latest_user_card(source_card, destination_card)
                duplicate = destination_card if survivor is source_card else source_card
                await self.db.execute(
                    update(StatsReviewLog)
                    .where(StatsReviewLog.user_card_id == duplicate.id)
                    .values(user_card_id=survivor.id)
                )
                if survivor is source_card:
                    if source_card.last_shown_card_id is None:
                        source_card.last_shown_card_id = (
                            destination_card.last_shown_card_id
                        )
                    if source_card.active_card_id is None:
                        source_card.active_card_id = destination_card.active_card_id
                    await self.db.delete(destination_card)
                    await self.db.flush()
                    source_card.pool_id = destination_pool_id
                    destination_by_user_id[source_card.user_id] = source_card
                else:
                    if destination_card.last_shown_card_id is None:
                        destination_card.last_shown_card_id = (
                            source_card.last_shown_card_id
                        )
                    if destination_card.active_card_id is None:
                        destination_card.active_card_id = source_card.active_card_id
                    await self.db.delete(source_card)

    @staticmethod
    def _latest_user_card(first: UserCard, second: UserCard) -> UserCard:
        first_activity = first.last_review_at or first.introduced_at or first.created_at
        second_activity = (
            second.last_review_at or second.introduced_at or second.created_at
        )
        return first if first_activity > second_activity else second

    async def _preserve_progress(self, lesson: Lesson, packet: LessonPacket) -> None:
        exercise_ids = {exercise.id for exercise in packet.exercises}
        progress_rows = (
            await self.db.scalars(
                select(UserLessonProgress).where(
                    UserLessonProgress.lesson_id == lesson.id
                )
            )
        ).all()
        for progress in progress_rows:
            completed = [
                exercise_id
                for exercise_id in progress.completed_exercise_ids_json or []
                if exercise_id in exercise_ids
            ]
            progress.completed_exercise_ids_json = completed
            if not exercise_ids.issubset(completed):
                progress.completed_at = None

    async def _delete_lesson_rows(self, lesson_ids: list[int]) -> None:
        if not lesson_ids:
            return
        pool_ids = list(
            (
                await self.db.scalars(
                    select(CardPool.id).where(CardPool.lesson_id.in_(lesson_ids))
                )
            ).all()
        )
        if pool_ids:
            await self._delete_user_cards_for_pools(pool_ids)
            await self.db.execute(
                delete(FlashCard).where(FlashCard.pool_id.in_(pool_ids))
            )
            await self.db.execute(delete(CardPool).where(CardPool.id.in_(pool_ids)))
        await self.db.execute(
            delete(UserLessonProgress).where(
                UserLessonProgress.lesson_id.in_(lesson_ids)
            )
        )
        await self.db.execute(delete(Lesson).where(Lesson.id.in_(lesson_ids)))

    async def _delete_user_cards_for_pools(
        self, pool_ids: list[int] | set[int]
    ) -> None:
        user_card_ids = list(
            (
                await self.db.scalars(
                    select(UserCard.id).where(UserCard.pool_id.in_(pool_ids))
                )
            ).all()
        )
        if not user_card_ids:
            return
        await self.db.execute(
            delete(StatsReviewLog).where(StatsReviewLog.user_card_id.in_(user_card_ids))
        )
        await self.db.execute(delete(UserCard).where(UserCard.id.in_(user_card_ids)))
