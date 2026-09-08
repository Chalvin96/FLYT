import base64
import binascii
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete as sa_delete
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.constants import DEFAULT_PAGE_LIMIT
from flyt.apps.reading.constants import DERIVED_TITLE_WORDS
from flyt.apps.reading.constants import ERROR_CODE_PROCESSING_FAILED
from flyt.apps.reading.constants import ERROR_MESSAGE_MAX_LENGTH
from flyt.apps.reading.constants import IMPORT_LIMIT
from flyt.apps.reading.constants import MAX_NORMALIZED_BYTES
from flyt.apps.reading.constants import MAX_PAGE_LIMIT
from flyt.apps.reading.constants import PROCESS_IMPORT_JOB
from flyt.apps.reading.constants import STALE_AFTER
from flyt.apps.reading.constants import TITLE_MAX_LENGTH
from flyt.apps.reading.exceptions import ImportEmptyError
from flyt.apps.reading.exceptions import ImportInvalidCursorError
from flyt.apps.reading.exceptions import ImportInvalidSourceUrlError
from flyt.apps.reading.exceptions import ImportNotFoundError
from flyt.apps.reading.exceptions import ImportNotRetryableError
from flyt.apps.reading.exceptions import ImportQuotaExceededError
from flyt.apps.reading.exceptions import ImportTooLargeError
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportQuota
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.schemas import ImportItemRead
from flyt.apps.reading.schemas import ImportListResponse
from flyt.apps.reading.schemas import QuotaRead
from flyt.apps.reading.import_text import InvalidSourceUrl
from flyt.apps.reading.import_text import content_hash as hash_text
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.reading.import_text import normalized_byte_length
from flyt.apps.reading.import_text import validate_source_url
from flyt.apps.reading.import_text import word_count
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.tokenization import PageData
from flyt.core.queue import enqueue_job
from flyt.libs.utils.date import now

_PROCESSING_STATUSES = (ImportStatus.PENDING, ImportStatus.PROCESSING)


def _pages_reconstruct(pages: list[PageData], normalized: str) -> bool:
    """True when joining the pages reproduces the normalized text exactly.

    ``reading.annotation.build_pages`` never splits a paragraph and joins whole
    paragraphs with blank lines, so a faithful handover round-trips. A mismatch
    means the handed-over pages no longer describe the stored text.
    """
    return "\n\n".join(page.content for page in pages) == normalized


def _encode_cursor(created_at: datetime, item_id: int) -> str:
    raw = f"{created_at.isoformat()}|{item_id}".encode()
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _decode_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        iso, item_id = raw.rsplit("|", 1)
        parsed = datetime.fromisoformat(iso)
        if parsed.tzinfo is not None:
            raise ImportInvalidCursorError()
        return parsed, int(item_id)
    except (ValueError, binascii.Error) as exc:
        raise ImportInvalidCursorError() from exc


def derive_title(normalized: str) -> str:
    first_line = normalized.split("\n", 1)[0].strip()
    source = first_line or normalized
    words = source.split()
    title = " ".join(words[:DERIVED_TITLE_WORDS]).strip()
    if not title:
        title = "Imported text"
    return title[:TITLE_MAX_LENGTH]


async def _advisory_lock(db: AsyncSession, key: str) -> None:
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": key})


@dataclass(frozen=True)
class OwnedImportRef:
    user_story_id: int
    story_id: int
    content_hash: str


@dataclass(frozen=True)
class ImportDraft:
    """A flushed ingress write plus the effects that must follow its commit."""

    user_story: UserStory
    story_id: int
    content_hash: str
    pages_to_publish: list[PageData] | None
    needs_processing: bool


def _require_story(story: Story | None) -> Story:
    if story is None:
        raise RuntimeError("Import metadata references a missing story")
    return story


def _require_user_story(user_story: UserStory | None) -> UserStory:
    if user_story is None:
        raise RuntimeError("Import row was created without a user story")
    return user_story


def _require_import_meta(meta: ImportMeta | None) -> ImportMeta:
    if meta is None:
        raise RuntimeError("Imported story is missing import metadata")
    return meta


class ImportService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        user_id: int,
        text_value: str,
        title: str | None,
        source_url: str | None,
    ) -> ImportDraft:
        return await self._import(
            user_id=user_id,
            text_value=text_value,
            title=title,
            source_url=source_url,
            pages=None,
        )

    async def create_from_generation(
        self,
        user_id: int,
        text: str,
        pages: list[PageData] | None,
        title: str | None,
    ) -> ImportDraft:
        return await self._import(
            user_id=user_id,
            text_value=text,
            title=title,
            source_url=None,
            pages=pages,
        )

    async def finalize_import(self, draft: ImportDraft) -> ImportItemRead:
        """Run effects that follow the ingress commit, then read the item."""
        if draft.pages_to_publish is not None:
            await self.publish_pages(
                draft.story_id, draft.content_hash, draft.pages_to_publish
            )
        elif draft.needs_processing:
            await enqueue_job(PROCESS_IMPORT_JOB, draft.story_id)
        return await self._hydrate(draft.user_story)

    async def retry(self, user_id: int, import_uuid) -> int:
        """Reset the import and return its story for post-commit enqueueing."""
        owned = await self._find_owned(user_id=user_id, import_uuid=import_uuid)
        if owned is None:
            raise ImportNotFoundError()
        _ui, story, _meta = owned

        result = await self._db.execute(
            update(ImportMeta)
            .where(
                ImportMeta.story_id == story.id,
                (ImportMeta.status == ImportStatus.FAILED)
                | (
                    ImportMeta.status.in_(
                        (ImportStatus.PENDING, ImportStatus.PROCESSING)
                    )
                    & (ImportMeta.updated_at < now() - STALE_AFTER)
                ),
            )
            .values(status=ImportStatus.PENDING, error_code=None, error_message=None)
            .returning(ImportMeta.id)
        )
        if result.first() is None:
            raise ImportNotRetryableError()
        return story.id

    async def _import(
        self,
        *,
        user_id: int,
        text_value: str,
        title: str | None,
        source_url: str | None,
        pages: list[PageData] | None,
    ) -> ImportDraft:
        normalized = normalize_text(text_value)
        if not normalized:
            raise ImportEmptyError()
        if normalized_byte_length(normalized) > MAX_NORMALIZED_BYTES:
            raise ImportTooLargeError()
        if source_url is not None:
            try:
                source_url = validate_source_url(source_url)
            except InvalidSourceUrl as exc:
                raise ImportInvalidSourceUrlError(str(exc)) from exc

        digest = hash_text(normalized)

        await _advisory_lock(self._db, f"quota:{user_id}")
        await _advisory_lock(self._db, f"content:{digest}")

        already_owned = await self._db.scalar(
            select(UserStory.id)
            .join(ImportMeta, ImportMeta.story_id == UserStory.story_id)
            .where(UserStory.user_id == user_id, ImportMeta.content_hash == digest)
        )
        if already_owned is None:
            used = await self._quota_used(user_id)
            if used >= IMPORT_LIMIT:
                raise ImportQuotaExceededError()

        story, is_new = await self._dedup_or_create_story(digest, normalized)

        clean_title = (title or "").strip()[:TITLE_MAX_LENGTH] or None
        user_story = await self._get_or_create_user_story(
            user_id=user_id,
            story_id=story.id,
            title=clean_title,
            source_url=source_url,
        )

        if already_owned is None:
            await self._db.execute(
                pg_insert(ImportQuota)
                .values(user_id=user_id, used=1)
                .on_conflict_do_update(
                    index_elements=[ImportQuota.user_id],
                    set_={"used": ImportQuota.used + 1},
                )
            )

        pages_to_publish = (
            pages
            if is_new and pages is not None and _pages_reconstruct(pages, normalized)
            else None
        )
        return ImportDraft(
            user_story=user_story,
            story_id=story.id,
            content_hash=digest,
            pages_to_publish=pages_to_publish,
            needs_processing=is_new and pages_to_publish is None,
        )

    async def _quota_used(self, user_id: int) -> int:
        used = await self._db.scalar(
            select(ImportQuota.used).where(ImportQuota.user_id == user_id)
        )
        return int(used or 0)

    async def _dedup_or_create_story(
        self, digest: str, normalized: str
    ) -> tuple[Story, bool]:

        existing = await self._db.execute(
            select(ImportMeta).where(ImportMeta.content_hash == digest)
        )
        meta = existing.scalar_one_or_none()
        if meta is not None:
            story = _require_story(await self._db.get(Story, meta.story_id))
            return story, False

        story = Story(
            title=derive_title(normalized),
            content=normalized,
            cefr_level=None,
            slug=None,
            reading_group_id=None,
            visibility=StoryVisibility.PRIVATE,
            is_ready=False,
            word_count=word_count(normalized),
        )
        self._db.add(story)
        await self._db.flush()

        insert_meta = (
            pg_insert(ImportMeta)
            .values(
                story_id=story.id,
                content_hash=digest,
                status=ImportStatus.PENDING,
            )
            .on_conflict_do_nothing(index_elements=[ImportMeta.content_hash])
            .returning(ImportMeta.story_id)
        )
        result = await self._db.execute(insert_meta)
        if result.first() is None:
            await self._db.delete(story)
            winner = await self._db.execute(
                select(ImportMeta).where(ImportMeta.content_hash == digest)
            )
            meta = winner.scalar_one()
            story = _require_story(await self._db.get(Story, meta.story_id))
            return story, False
        return story, True

    async def _get_or_create_user_story(
        self,
        user_id: int,
        story_id: int,
        title: str | None,
        source_url: str | None,
    ) -> UserStory:
        insert_ui = (
            pg_insert(UserStory)
            .values(
                user_id=user_id,
                story_id=story_id,
                title=title,
                source_url=source_url,
                last_page_index=0,
                completed=False,
            )
            .on_conflict_do_nothing(
                index_elements=[UserStory.user_id, UserStory.story_id]
            )
            .returning(UserStory.id)
        )
        result = await self._db.execute(insert_ui)
        row = result.first()
        if row is not None:
            return _require_user_story(await self._db.get(UserStory, row.id))

        existing = await self._db.execute(
            select(UserStory).where(
                UserStory.user_id == user_id, UserStory.story_id == story_id
            )
        )
        return existing.scalar_one()

    def _to_item(
        self,
        ui: UserStory,
        story: Story,
        meta: ImportMeta,
        page_count_raw: int | None,
    ) -> ImportItemRead:
        title = ui.title or story.title
        page_count = (
            int(page_count_raw or 0) if meta.status is ImportStatus.READY else None
        )
        return ImportItemRead(
            id=ui.uuid,
            storyUuid=story.uuid,
            title=title,
            sourceUrl=ui.source_url,
            status=meta.status,
            errorCode=meta.error_code,
            errorMessage=meta.error_message,
            pageCount=page_count,
            wordCount=story.word_count,
            createdAt=ui.created_at,
        )

    async def _hydrate(self, ui: UserStory) -> ImportItemRead:
        story = _require_story(await self._db.get(Story, ui.story_id))
        meta = _require_import_meta(
            await self._db.scalar(
                select(ImportMeta).where(ImportMeta.story_id == ui.story_id)
            )
        )
        page_count_raw: int | None = None
        if meta.status is ImportStatus.READY:
            page_count_raw = int(
                (
                    await self._db.execute(
                        select(func.count())
                        .select_from(StoryPage)
                        .where(StoryPage.story_id == story.id)
                    )
                ).scalar_one()
            )
        return self._to_item(ui, story, meta, page_count_raw)

    async def list_imports(
        self,
        user_id: int,
        status: ImportStatus | None = None,
        query: str | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_LIMIT,
    ) -> ImportListResponse:
        limit = max(1, min(limit, MAX_PAGE_LIMIT))
        page_counts = (
            select(
                StoryPage.story_id.label("story_id"),
                func.count().label("page_count"),
            )
            .group_by(StoryPage.story_id)
            .subquery()
        )
        stmt = (
            select(UserStory, Story, ImportMeta, page_counts.c.page_count)
            .join(Story, Story.id == UserStory.story_id)
            .join(ImportMeta, ImportMeta.story_id == Story.id)
            .outerjoin(page_counts, page_counts.c.story_id == Story.id)
            .where(
                UserStory.user_id == user_id,
                Story.visibility == StoryVisibility.PRIVATE,
            )
        )
        if status is ImportStatus.PROCESSING:
            stmt = stmt.where(ImportMeta.status.in_(_PROCESSING_STATUSES))
        elif status is not None:
            stmt = stmt.where(ImportMeta.status == status)
        if query:
            like = f"%{query.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(func.coalesce(UserStory.title, Story.title)).like(like),
                    func.lower(func.coalesce(UserStory.source_url, "")).like(like),
                )
            )
        if cursor:
            created_at, item_id = _decode_cursor(cursor)
            stmt = stmt.where(
                or_(
                    UserStory.created_at < created_at,
                    (UserStory.created_at == created_at) & (UserStory.id < item_id),
                )
            )
        stmt = stmt.order_by(UserStory.created_at.desc(), UserStory.id.desc()).limit(
            limit + 1
        )

        rows = (await self._db.execute(stmt)).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [
            self._to_item(ui, story, meta, page_count)
            for ui, story, meta, page_count in rows
        ]
        next_cursor = (
            _encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more else None
        )
        return ImportListResponse(
            items=items,
            nextCursor=next_cursor,
            quota=QuotaRead(
                used=await self._quota_used(user_id),
                limit=IMPORT_LIMIT,
            ),
        )

    async def _find_owned(
        self, user_id: int, import_uuid
    ) -> tuple[UserStory, Story, ImportMeta] | None:
        row = (
            await self._db.execute(
                select(UserStory, Story, ImportMeta)
                .join(Story, Story.id == UserStory.story_id)
                .join(ImportMeta, ImportMeta.story_id == Story.id)
                .where(
                    UserStory.uuid == import_uuid,
                    UserStory.user_id == user_id,
                    Story.visibility == StoryVisibility.PRIVATE,
                )
            )
        ).first()
        if row is None:
            return None
        return row[0], row[1], row[2]

    async def owned_import_refs(self, user_id: int) -> list[OwnedImportRef]:
        rows = (
            await self._db.execute(
                select(UserStory.id, Story.id, ImportMeta.content_hash)
                .join(Story, Story.id == UserStory.story_id)
                .join(ImportMeta, ImportMeta.story_id == Story.id)
                .where(
                    UserStory.user_id == user_id,
                    Story.visibility == StoryVisibility.PRIVATE,
                )
                .order_by(ImportMeta.content_hash)
            )
        ).all()
        return [
            OwnedImportRef(
                user_story_id=user_story_id, story_id=story_id, content_hash=digest
            )
            for user_story_id, story_id, digest in rows
        ]

    async def owned_import_count(self, user_id: int) -> int:
        total = await self._db.scalar(
            select(func.count())
            .select_from(UserStory)
            .join(Story, Story.id == UserStory.story_id)
            .join(ImportMeta, ImportMeta.story_id == Story.id)
            .where(
                UserStory.user_id == user_id,
                Story.visibility == StoryVisibility.PRIVATE,
            )
        )
        return int(total or 0)

    async def release_reference(self, ref: OwnedImportRef) -> bool:
        await _advisory_lock(self._db, f"content:{ref.content_hash}")
        await self._db.execute(
            sa_delete(UserStory).where(UserStory.id == ref.user_story_id)
        )
        remaining = await self._db.scalar(
            select(func.count())
            .select_from(UserStory)
            .where(UserStory.story_id == ref.story_id)
        )
        if remaining:
            return False
        await self._db.execute(sa_delete(Story).where(Story.id == ref.story_id))
        return True

    async def get_import(self, user_id: int, import_uuid) -> ImportItemRead:
        owned = await self._find_owned(user_id=user_id, import_uuid=import_uuid)
        if owned is None:
            raise ImportNotFoundError()
        ui, _story, _meta = owned
        return await self._hydrate(ui)

    async def delete(self, user_id: int, import_uuid) -> None:
        owned = await self._find_owned(user_id=user_id, import_uuid=import_uuid)
        if owned is None:
            raise ImportNotFoundError()
        ui, story, meta = owned
        await self.release_reference(
            OwnedImportRef(
                user_story_id=ui.id,
                story_id=story.id,
                content_hash=meta.content_hash,
            )
        )

    async def _set_status(
        self,
        story_id: int,
        *,
        status: ImportStatus,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        await self._db.execute(
            update(ImportMeta)
            .where(ImportMeta.story_id == story_id)
            .values(
                status=status,
                error_code=error_code,
                error_message=(
                    error_message[:ERROR_MESSAGE_MAX_LENGTH] if error_message else None
                ),
            )
        )

    async def claim_for_processing(self, story_id: int) -> str | None:
        """Claim the row for the worker; the task entrypoint commits the claim."""
        row = (
            await self._db.execute(
                update(ImportMeta)
                .where(
                    ImportMeta.story_id == story_id,
                    (ImportMeta.status == ImportStatus.PENDING)
                    | (
                        (ImportMeta.status == ImportStatus.PROCESSING)
                        & (ImportMeta.updated_at < now() - STALE_AFTER)
                    ),
                )
                .values(status=ImportStatus.PROCESSING)
                .returning(ImportMeta.content_hash)
            )
        ).first()
        if row is None:
            return None
        return row[0]

    async def content_to_process(self, story_id: int) -> str | None:
        story = await self._db.get(Story, story_id)
        if story is None:
            return None
        if story.content is None:
            raise ValueError(f"inline content missing for story {story_id}")
        return story.content

    async def mark_failed(self, story_id: int, message: str) -> None:
        """Record the bounded failure; the task entrypoint commits it."""
        await self._set_status(
            story_id,
            status=ImportStatus.FAILED,
            error_code=ERROR_CODE_PROCESSING_FAILED,
            error_message=message,
        )

    async def publish_pages(
        self, story_id: int, content_hash: str, pages: list[PageData]
    ) -> None:
        """Publish the computed pages; the task entrypoint commits them."""
        await _advisory_lock(self._db, f"content:{content_hash}")
        if await self._db.scalar(select(Story.id).where(Story.id == story_id)) is None:
            return
        await self._set_status(story_id, status=ImportStatus.READY)
        await self._db.execute(
            sa_delete(StoryPage).where(StoryPage.story_id == story_id)
        )
        self._db.add_all(
            StoryPage(
                story_id=story_id,
                index=page.index,
                content=page.content,
                text_annotations_json=page.tokens,
                word_count=page.word_count,
            )
            for page in pages
        )
        await self._db.flush()
