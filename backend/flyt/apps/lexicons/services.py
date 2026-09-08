from collections.abc import Sequence
from dataclasses import dataclass
import logging
import re
from uuid import UUID

from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import select
from sqlalchemy import union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from flyt.apps.lexicons.constants import K_LEXICON_BROWSE_QUERY_MIN_LENGTH
from flyt.apps.lexicons.constants import K_LEXICON_INVALID_QUERY_MESSAGE
from flyt.apps.lexicons.constants import K_LEXICON_MATCH_KIND_EXACT
from flyt.apps.lexicons.constants import K_LEXICON_MATCH_KIND_PREFIX
from flyt.apps.lexicons.constants import K_LEXICON_MATCH_KIND_WORDFORM_EXACT
from flyt.apps.lexicons.constants import K_LEXICON_MATCH_KIND_WORDFORM_PREFIX
from flyt.apps.lexicons.constants import K_LEXICON_SUGGEST_QUERY_MIN_LENGTH
from flyt.apps.lexicons.constants import K_LEXICON_SUGGESTIONS_LIMIT
from flyt.apps.lexicons.exceptions import LexiconNotFoundError
from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from flyt.apps.flashcards.models import CardPool
from flyt.clients import tagger
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_MASTERED
from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.users.services import UserLemmaService
from flyt.apps.users.services import UserVocabularyQueries
from flyt.core.config import settings
from flyt.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

NORWEGIAN_PATTERN = re.compile(r"^[a-zA-ZæøåÆØÅ]+(?:[-\s][a-zA-ZæøåÆØÅ]+)*$")


@dataclass(frozen=True)
class BrowseHeadwordEntry:
    uuid: UUID
    hgno: int
    label: str


@dataclass(frozen=True)
class BrowseHeadwordResolution:
    headword: str
    entries: list[BrowseHeadwordEntry]
    selected_lemma_uuid: UUID | None
    is_fallback: bool


@dataclass(frozen=True)
class UserLemmaEntry:
    lemma: Lemma
    state: UserLemmaState


@dataclass(frozen=True)
class WordResolution:
    """Result of resolve_word: matching lemmas and fallback provenance."""

    lemmas: Sequence[Lemma]
    is_compound: bool


class LexiconService:
    def __init__(
        self,
        db: AsyncSession,
        user_lemma_service: UserLemmaService,
        user_vocabulary_queries: UserVocabularyQueries | None = None,
    ):
        self.db = db
        self.user_lemma_service = user_lemma_service
        self.user_vocabulary_queries = user_vocabulary_queries or UserVocabularyQueries(
            db
        )

    async def search_lemmas(self, query: str) -> Sequence[Lemma]:
        sanitized_query = self._sanitize_and_validate_query(
            query,
            context="search_lemmas",
        )

        lemmas = (
            await self.db.scalars(
                select(Lemma)
                .join(WordForm, WordForm.lemma_id == Lemma.id)
                .where(WordForm.form == sanitized_query)
                .distinct()
                .options(selectinload(Lemma.word_forms))
                .options(selectinload(Lemma.definitions))
            )
        ).all()

        logger.info("[LexiconService.search_lemmas] Found %s lemmas", len(lemmas))
        return lemmas

    async def resolve_word(self, query: str) -> WordResolution:
        """Return lemmas whose word forms case-insensitively match the query.

        On a miss, fall back to flyt-tagger (if configured) to deinflect/decompound
        the surface form into a candidate base lemma, then look that up.

        Ordered by frequency rank (ASC NULLS LAST) then homograph number so the
        most useful candidate surfaces first.
        """
        sanitized_query = self._sanitize_and_validate_query(
            query,
            context="resolve_word",
        )

        lemmas = await self._lemmas_by_form(sanitized_query)
        if lemmas:
            logger.info(
                "[LexiconService.resolve_word] Found %s lemmas (direct)",
                len(lemmas),
            )
            return WordResolution(lemmas=lemmas, is_compound=False)

        if settings.TAGGER_SVC_URL:
            async with tagger.open_session() as client:
                candidates = await tagger.analyze(client, sanitized_query)
        else:
            candidates = []
        for candidate in candidates:
            fallback_lemmas = await self._lemmas_by_form(candidate.lemma)
            if fallback_lemmas:
                logger.info(
                    "[LexiconService.resolve_word] Found %s lemmas via tagger "
                    "fallback (candidate=%r, is_compound=%s)",
                    len(fallback_lemmas),
                    candidate.lemma,
                    candidate.is_compound,
                )
                return WordResolution(
                    lemmas=fallback_lemmas,
                    is_compound=candidate.is_compound,
                )

        logger.info("[LexiconService.resolve_word] No lemmas found")
        return WordResolution(lemmas=[], is_compound=False)

    async def _lemmas_by_form(self, form: str) -> Sequence[Lemma]:
        """Return lemmas whose word forms case-insensitively match *form*.

        Ordered by frequency rank (ASC NULLS LAST) then homograph number.
        """
        return (
            await self.db.scalars(
                select(Lemma)
                .join(WordForm, WordForm.lemma_id == Lemma.id)
                .outerjoin(CardPool, CardPool.lemma_id == Lemma.id)
                .where(func.lower(WordForm.form) == func.lower(form))
                .group_by(Lemma.id)
                .options(selectinload(Lemma.definitions))
                .options(selectinload(Lemma.see_also))
                .order_by(
                    func.min(CardPool.frequency_rank).asc().nullslast(),
                    Lemma.hgno.asc(),
                )
            )
        ).all()

    async def get_suggestions(self, query: str) -> list[str]:
        """Return ranked headword suggestions for the autocomplete surface."""
        sanitized_query = self._sanitize_and_validate_query(
            query,
            context="get_suggestions",
            min_length=K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
        )

        suggestions = await self._list_ranked_headword_candidates(
            sanitized_query,
            limit=K_LEXICON_SUGGESTIONS_LIMIT,
        )

        logger.info(
            "[LexiconService.get_suggestions] Found %s suggestions",
            len(suggestions),
        )
        return suggestions

    async def get_lemma_by_uuid(self, lemma_uuid: UUID) -> Lemma | None:
        return await self.db.scalar(select(Lemma).where(Lemma.uuid == lemma_uuid))

    async def get_lemma_definitions(self, lemma_uuid: UUID) -> list[Definition]:
        lemma = await self.db.scalar(
            select(Lemma)
            .where(Lemma.uuid == lemma_uuid)
            .options(selectinload(Lemma.definitions))
        )
        if lemma is None:
            raise LexiconNotFoundError("Lemma not found")
        return list(lemma.definitions)

    async def load_lemma_with_relations(self, lemma_uuid: UUID) -> Lemma:
        """Load a lemma with definitions and see_also rows eagerly loaded."""
        lemma = await self.db.scalar(
            select(Lemma)
            .where(Lemma.uuid == lemma_uuid)
            .options(selectinload(Lemma.definitions))
            .options(selectinload(Lemma.see_also))
        )
        if lemma is None:
            raise LexiconNotFoundError("Lemma not found")
        return lemma

    async def resolve_see_also_targets(
        self, entries: Sequence[SeeAlso]
    ) -> dict[int, Lemma]:
        """Batch-resolve ``target_article_id`` -> first lemma via one query.

        Returns a mapping of ``article_id -> Lemma`` for all targets that have
        an imported lemma. Targets not present in the DB are simply absent
        from the dict (dangling). The first lemma per article_id (ordered by
        ``hgno, id``) is picked deterministically.
        """
        if not entries:
            return {}
        article_ids = {e.target_article_id for e in entries}
        rows = (
            await self.db.scalars(
                select(Lemma)
                .where(Lemma.source_article_id.in_(article_ids))
                .order_by(Lemma.hgno, Lemma.id)
            )
        ).all()
        resolved: dict[int, Lemma] = {}
        for lemma in rows:
            # First-seen wins because rows are ordered by hgno, id.
            if lemma.source_article_id is not None:
                resolved.setdefault(lemma.source_article_id, lemma)
        return resolved

    async def get_lemma_state(self, lemma_id: int, user_id: int) -> UserLemmaState:
        # Vocabulary state is derived solely from UserLemma membership. The
        # activation invariant ensures any ACTIVE lemma-owned UserCard has a
        # matching UserLemma row, so a card-aware projection is unnecessary.
        return await self.user_vocabulary_queries.get_lemma_state(user_id, lemma_id)

    async def list_user_lemmas(self, user_id: int) -> list[UserLemmaEntry]:
        """All lemmas the user is learning or has mastered.

        Reads from UserLemma only (the shared vocabulary state projection).
        """
        rows = await self.user_vocabulary_queries.list_user_lemmas(user_id)
        entries: list[UserLemmaEntry] = [
            UserLemmaEntry(
                lemma=lemma,
                state=state,
            )
            for lemma, state in rows
        ]

        return sorted(
            entries,
            key=lambda e: (e.state == K_USER_LEMMA_STATE_MASTERED, e.lemma.word),
        )

    async def resolve_headword(self, query: str) -> BrowseHeadwordResolution | None:
        """Resolve a browse query into one headword group and selected lemma.

        Resolution order:
        1) exact headword match
        2) ranked fallback candidate
        3) no result
        """
        sanitized_query = self._sanitize_and_validate_query(
            query,
            context="resolve_headword",
            min_length=K_LEXICON_BROWSE_QUERY_MIN_LENGTH,
        )

        exact_lemmas = await self._list_homographs_for_headword(sanitized_query)

        if exact_lemmas:
            return self._build_browse_headword_response(
                headword=sanitized_query,
                lemmas=exact_lemmas,
                is_fallback=False,
            )

        suggestions_result = await self._list_ranked_headword_candidates(
            sanitized_query
        )
        if not suggestions_result:
            return None

        best_headword = suggestions_result[0]
        fallback_lemmas = await self._list_homographs_for_headword(best_headword)

        return self._build_browse_headword_response(
            headword=best_headword,
            lemmas=fallback_lemmas,
            is_fallback=True,
        )

    def _build_browse_headword_response(
        self,
        headword: str,
        lemmas: Sequence[Lemma],
        is_fallback: bool,
    ) -> BrowseHeadwordResolution:
        """Build the resolved browse result for one headword."""
        entries = [
            BrowseHeadwordEntry(uuid=lm.uuid, hgno=lm.hgno, label=lm.word)
            for lm in lemmas
        ]

        selected_lemma_uuid = self._select_preferred_lemma_uuid(lemmas)

        return BrowseHeadwordResolution(
            headword=headword,
            entries=entries,
            selected_lemma_uuid=selected_lemma_uuid,
            is_fallback=is_fallback,
        )

    async def _list_ranked_headword_candidates(
        self, query: str, limit: int | None = None
    ) -> list[str]:
        """Return deduplicated headwords ordered by exact-then-prefix ranking.

        Headword matches rank above word-form matches: querying "leser"
        surfaces the headword "leser" first, then "lese" - a related lemma
        reachable only via its word form ("leser" is also a present-tense
        form of "lese"), not its own headword. Uses SQL grouping to collapse
        homographs/duplicates before applying the limit, so the caller always
        gets up to *limit* unique headwords.
        """
        exact_literal = literal(K_LEXICON_MATCH_KIND_EXACT)
        prefix_literal = literal(K_LEXICON_MATCH_KIND_PREFIX)
        wordform_exact_literal = literal(K_LEXICON_MATCH_KIND_WORDFORM_EXACT)
        wordform_prefix_literal = literal(K_LEXICON_MATCH_KIND_WORDFORM_PREFIX)

        headword_matches = select(
            Lemma.word.label("headword"),
            case(
                (Lemma.word == query, exact_literal),
                else_=prefix_literal,
            ).label("match_kind"),
        ).where((Lemma.word == query) | Lemma.word.startswith(query))

        wordform_matches = (
            select(
                Lemma.word.label("headword"),
                case(
                    (WordForm.form == query, wordform_exact_literal),
                    else_=wordform_prefix_literal,
                ).label("match_kind"),
            )
            .join(Lemma, Lemma.id == WordForm.lemma_id)
            .where((WordForm.form == query) | WordForm.form.startswith(query))
        )

        combined = union_all(headword_matches, wordform_matches).subquery()

        # One row per headword, ranked by its best match kind across both branches.
        ranked = (
            select(
                combined.c.headword,
                func.min(combined.c.match_kind).label("best_match"),
            )
            .group_by(combined.c.headword)
            .order_by(func.min(combined.c.match_kind), combined.c.headword)
        )

        if limit is not None:
            ranked = ranked.limit(limit)

        rows = (await self.db.execute(ranked)).all()
        return [headword for headword, _best_match in rows]

    async def _list_homographs_for_headword(self, headword: str) -> list[Lemma]:
        """Return all lemma rows for one headword, ordered for stable UI rendering."""
        lemmas = (
            await self.db.scalars(
                select(Lemma)
                .where(Lemma.word == headword)
                .order_by(Lemma.hgno, Lemma.id)
            )
        ).all()
        return list(lemmas)

    def _select_preferred_lemma_uuid(
        self,
        lemmas: Sequence[Lemma],
    ) -> UUID | None:
        """Pick a default lemma: prefer non-sub-article, else first entry."""
        for lemma in lemmas:
            if not lemma.is_sub_article:
                return lemma.uuid
        if lemmas:
            return lemmas[0].uuid
        return None

    def _sanitize_and_validate_query(
        self,
        query: str,
        context: str,
        min_length: int = 1,
    ) -> str:
        """Strip and validate user query against the Norwegian input policy."""
        sanitized_query = query.strip()

        if len(sanitized_query) < min_length:
            logger.warning("[LexiconService.%s] Query too short", context)
            raise ValidationError(K_LEXICON_INVALID_QUERY_MESSAGE)

        if not NORWEGIAN_PATTERN.match(sanitized_query):
            logger.warning("[LexiconService.%s] Invalid query format", context)
            raise ValidationError(K_LEXICON_INVALID_QUERY_MESSAGE)
        return sanitized_query
