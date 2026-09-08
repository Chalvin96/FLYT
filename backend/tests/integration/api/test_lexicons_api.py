from http import HTTPStatus
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import Enrollment
from flyt.apps.lexicons.constants import K_LEXICON_QUERY_MAX_LENGTH
from flyt.apps.users.models import UserLemma
from tests.factories import CardPoolFactory
from tests.factories import DefinitionFactory
from tests.factories import LemmaFactory
from tests.factories import SeeAlsoFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import WordFormFactory
from tests.helpers.auth import authenticate
from tests.helpers.tagger import FakeTaggerResponse
from tests.helpers.tagger import install_fake_tagger

pytestmark = pytest.mark.anyio

K_EXPECTED_SEARCH_RESULT_COUNT = 2
K_EXPECTED_SUGGESTION_COUNT = 2
K_EXPECTED_BROWSE_ENTRY_COUNT = 2
K_EXPECTED_RESOLVE_CANDIDATE_COUNT = 2
K_EXPECTED_DEFINITION_COUNT = 2
K_TARGET_ARTICLE_ID = 777
K_EXPECTED_USER_LEMMA_COUNT = 2


async def test_search_given_exact_match_expect_lemmas_returned(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gikk")
    await WordFormFactory.create(form="gikk", lemma=lemma)

    response = await client.get("/lexicons/search", params={"query": "gikk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["word"] == "gikk"


async def test_search_given_multiple_lemmas_expect_all_lemmas_returned(
    client: AsyncClient,
) -> None:
    lemma1 = await LemmaFactory.create(word="test1")
    lemma2 = await LemmaFactory.create(word="test2")
    await WordFormFactory.create(form="gikk", lemma=lemma1)
    await WordFormFactory.create(form="gikk", lemma=lemma2)

    response = await client.get("/lexicons/search", params={"query": "gikk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == K_EXPECTED_SEARCH_RESULT_COUNT


async def test_search_given_no_results_expect_empty_list(client: AsyncClient) -> None:
    await WordFormFactory.create(form="gikk")

    response = await client.get("/lexicons/search", params={"query": "nonexistent"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 0


async def test_search_given_word_with_definition_expect_definitions_loaded(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gikk")
    await WordFormFactory.create(form="gikk", lemma=lemma)
    await DefinitionFactory.create(lemma=lemma, definition="Definition test")

    response = await client.get("/lexicons/search", params={"query": "gikk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 1
    assert "definitions" in data[0]
    assert len(data[0]["definitions"]) == 1
    assert data[0]["definitions"][0]["definition"] == "Definition test"


async def test_search_given_query_too_long_expect_validation_error(
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/lexicons/search",
        params={"query": "a" * (K_LEXICON_QUERY_MAX_LENGTH + 1)},
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_search_given_invalid_characters_expect_validation_error(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/search", params={"query": "test123"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    error = response.json()["detail"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "invalid characters" in error["message"].lower()


async def test_search_given_norwegian_letters_expect_lemmas_returned(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="været")
    await WordFormFactory.create(form="været", lemma=lemma)

    response = await client.get("/lexicons/search", params={"query": "været"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 1


async def test_search_given_empty_query_expect_validation_error(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/search", params={"query": ""})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_search_given_hyphen_expect_lemmas_returned(client: AsyncClient) -> None:
    lemma = await LemmaFactory.create(word="færøysk")
    await WordFormFactory.create(form="færøysk", lemma=lemma)

    response = await client.get("/lexicons/search", params={"query": "færøysk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["word"] == "færøysk"


async def test_search_given_lemma_with_word_forms_and_translation_expect_full_payload(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(
        word="gå", pos="verb", hgno=1, primary_translation="walk"
    )
    await WordFormFactory.create(lemma=lemma, form="går", tags_json=["Pres"])
    await DefinitionFactory.create(
        lemma=lemma,
        definition="to walk",
        translation="walk",
        examples_json=[{"no": "Jeg går hjem.", "en": None}],
    )

    response = await client.get("/lexicons/search", params={"query": "går"})
    assert response.status_code == HTTPStatus.OK

    data = response.json()
    item = data[0]
    assert item["word_forms"][0]["form"] == "går"
    assert item["word_forms"][0]["tags_json"] == ["Pres"]
    assert item["definitions"][0]["translation"] == "walk"

    assert sorted(data[0].keys()) == [
        "cross_reference_article_id",
        "definitions",
        "hgno",
        "id",
        "is_sub_article",
        "pos",
        "primary_translation",
        "source_article_id",
        "source_lemma_id",
        "uuid",
        "word",
        "word_forms",
    ]
    assert sorted(data[0]["definitions"][0].keys()) == [
        "definition",
        "examples_json",
        "id",
        "translation",
        "translation_source",
        "uuid",
    ]


# --- /lexicons/suggestions ---


async def test_suggestions_given_exact_match_expect_suggestions_returned(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="gå")

    response = await client.get("/lexicons/suggestions", params={"query": "gå"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["label"] == "gå"


async def test_suggestions_given_prefix_match_expect_suggestions_returned(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="hunden")

    response = await client.get("/lexicons/suggestions", params={"query": "hun"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["label"] == "hunden"


async def test_suggestions_given_no_results_expect_empty_suggestions(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/suggestions", params={"query": "zz"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["suggestions"] == []


async def test_suggestions_given_query_too_short_expect_422(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/suggestions", params={"query": "a"})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_suggestions_given_empty_query_expect_422(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/suggestions", params={"query": ""})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_suggestions_given_invalid_characters_expect_400(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/suggestions", params={"query": "test123"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    error = response.json()["detail"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "invalid characters" in error["message"].lower()


async def test_suggestions_given_duplicate_headwords_expect_collapsed(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="gå", hgno=1)
    await LemmaFactory.create(word="gå", hgno=2)

    response = await client.get("/lexicons/suggestions", params={"query": "gå"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["label"] == "gå"


async def test_suggestions_given_exact_before_prefix_expect_exact_first(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="gå")
    await LemmaFactory.create(word="går")

    response = await client.get("/lexicons/suggestions", params={"query": "gå"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["suggestions"]) == K_EXPECTED_SUGGESTION_COUNT
    assert data["suggestions"][0]["label"] == "gå"
    assert data["suggestions"][1]["label"] == "går"


async def test_suggestions_given_norwegian_letters_expect_suggestions(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="været")

    response = await client.get("/lexicons/suggestions", params={"query": "væ"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["label"] == "været"


async def test_suggestions_given_query_too_long_expect_422(
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/lexicons/suggestions",
        params={"query": "a" * (K_LEXICON_QUERY_MAX_LENGTH + 1)},
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_suggestions_given_existing_search_still_works(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gikk")
    await WordFormFactory.create(form="gikk", lemma=lemma)

    response = await client.get("/lexicons/search", params={"query": "gikk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["word"] == "gikk"


async def test_suggestions_given_query_matches_other_headword_word_form_expect_related_lemma_surfaced(
    client: AsyncClient,
) -> None:
    # "leser" is its own headword (noun, "reader") AND a present-tense word form
    # of the unrelated headword "lese" (verb, "to read") - typing "leser" should
    # surface both, with the literal headword match ranked first.
    leser_noun = await LemmaFactory.create(word="leser", pos="noun")
    await WordFormFactory.create(form="leser", lemma=leser_noun)
    lese_verb = await LemmaFactory.create(word="lese", pos="verb")
    await WordFormFactory.create(form="leser", lemma=lese_verb)

    response = await client.get("/lexicons/suggestions", params={"query": "leser"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    labels = [s["label"] for s in data["suggestions"]]
    assert labels[0] == "leser"
    assert "lese" in labels


async def test_suggestions_given_word_form_match_ranks_above_headword_prefix_match(
    client: AsyncClient,
) -> None:
    # Wordform-exact ("lese", reachable via the "leser" wordform) outranks
    # headword-prefix ("leserbrev"): an inflected form of the same word is
    # semantically closer than a compound that shares a prefix by accident.
    await LemmaFactory.create(word="leserbrev", pos="noun")
    lese_verb = await LemmaFactory.create(word="lese", pos="verb")
    await WordFormFactory.create(form="leser", lemma=lese_verb)

    response = await client.get("/lexicons/suggestions", params={"query": "leser"})
    assert response.status_code == HTTPStatus.OK
    labels = [s["label"] for s in response.json()["suggestions"]]
    assert labels.index("lese") < labels.index("leserbrev")


# --- /lexicons/browse ---


async def test_browse_given_exact_headword_expect_200_with_entries(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gå", hgno=1, is_sub_article=False)

    response = await client.get("/lexicons/browse", params={"q": "gå"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["headword"] == "gå"
    assert data["is_fallback"] is False
    assert len(data["entries"]) == 1
    assert data["entries"][0]["uuid"] == str(lemma.uuid)
    assert data["entries"][0]["hgno"] == 1
    assert data["entries"][0]["label"] == "gå"
    assert data["selected_lemma_uuid"] == str(lemma.uuid)


async def test_browse_given_homographs_expect_all_entries(
    client: AsyncClient,
) -> None:
    lemma1 = await LemmaFactory.create(word="bok", hgno=1, is_sub_article=False)
    lemma2 = await LemmaFactory.create(word="bok", hgno=2, is_sub_article=False)

    response = await client.get("/lexicons/browse", params={"q": "bok"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["headword"] == "bok"
    assert len(data["entries"]) == K_EXPECTED_BROWSE_ENTRY_COUNT
    assert data["entries"][0]["uuid"] == str(lemma1.uuid)
    assert data["entries"][1]["uuid"] == str(lemma2.uuid)
    assert data["selected_lemma_uuid"] == str(lemma1.uuid)


async def test_browse_given_no_exact_expect_fallback_200(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="går")
    await WordFormFactory.create(form="går", lemma=lemma)

    response = await client.get("/lexicons/browse", params={"q": "gå"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["headword"] == "går"
    assert data["is_fallback"] is True
    assert len(data["entries"]) == 1


async def test_browse_given_no_match_expect_404(client: AsyncClient) -> None:
    response = await client.get("/lexicons/browse", params={"q": "zz"})
    assert response.status_code == HTTPStatus.NOT_FOUND
    error = response.json()["detail"]
    assert error["code"] == "NOT_FOUND"


async def test_mark_known_given_lemma_without_pool_expect_mastered(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await authenticate(client, user)

    response = await client.post(f"/lexicons/lemmas/{lemma.uuid}/mark-known")

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_browse_given_query_too_short_expect_422(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/browse", params={"q": "a"})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_browse_given_invalid_characters_expect_400(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/browse", params={"q": "test123"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    error = response.json()["detail"]
    assert error["code"] == "VALIDATION_ERROR"


async def test_browse_given_sub_articles_expect_selected_non_sub(
    client: AsyncClient,
) -> None:
    await LemmaFactory.create(word="bok", hgno=1, is_sub_article=True)
    main_lemma = await LemmaFactory.create(word="bok", hgno=2, is_sub_article=False)

    response = await client.get("/lexicons/browse", params={"q": "bok"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["selected_lemma_uuid"] == str(main_lemma.uuid)


# --- /lexicons/resolve ---


async def test_resolve_given_single_lemma_expect_one_candidate(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gikk", pos="verb", hgno=1)
    await WordFormFactory.create(form="gikk", lemma=lemma)
    await DefinitionFactory.create(lemma=lemma, definition="to go", translation="gå")

    response = await client.get("/lexicons/resolve", params={"word": "gikk"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["query"] == "gikk"
    assert len(data["candidates"]) == 1

    candidate = data["candidates"][0]
    assert candidate["lemma_uuid"] == str(lemma.uuid)
    assert candidate["word"] == "gikk"
    assert candidate["pos"] == "verb"
    assert candidate["hgno"] == 1
    assert candidate["is_compound"] is False
    assert len(candidate["definitions"]) == 1
    assert candidate["definitions"][0]["definition"] == "to go"
    assert candidate["definitions"][0]["translation"] == "gå"
    assert sorted(candidate["definitions"][0].keys()) == ["definition", "translation"]
    assert "state" not in candidate


async def test_resolve_given_homographs_expect_ordered_by_frequency_then_hgno(
    client: AsyncClient,
) -> None:
    lemma_lower_rank = await LemmaFactory.create(word="bok", hgno=2)
    lemma_higher_rank = await LemmaFactory.create(word="bok", hgno=1)
    await WordFormFactory.create(form="bok", lemma=lemma_lower_rank)
    await WordFormFactory.create(form="bok", lemma=lemma_higher_rank)
    await CardPoolFactory.create(lemma=lemma_lower_rank, frequency_rank=5)
    await CardPoolFactory.create(lemma=lemma_higher_rank, frequency_rank=1)

    response = await client.get("/lexicons/resolve", params={"word": "bok"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["candidates"]) == K_EXPECTED_RESOLVE_CANDIDATE_COUNT
    assert data["candidates"][0]["lemma_uuid"] == str(lemma_higher_rank.uuid)
    assert data["candidates"][1]["lemma_uuid"] == str(lemma_lower_rank.uuid)


async def test_resolve_given_homographs_without_frequency_expect_hgno_order(
    client: AsyncClient,
) -> None:
    lemma1 = await LemmaFactory.create(word="bok", hgno=1)
    lemma2 = await LemmaFactory.create(word="bok", hgno=2)
    await WordFormFactory.create(form="bok", lemma=lemma1)
    await WordFormFactory.create(form="bok", lemma=lemma2)

    response = await client.get("/lexicons/resolve", params={"word": "bok"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["candidates"]) == K_EXPECTED_RESOLVE_CANDIDATE_COUNT
    assert data["candidates"][0]["lemma_uuid"] == str(lemma1.uuid)
    assert data["candidates"][1]["lemma_uuid"] == str(lemma2.uuid)


async def test_resolve_given_unknown_word_expect_empty_candidates(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/resolve", params={"word": "nonexistent"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["query"] == "nonexistent"
    assert data["candidates"] == []


async def test_resolve_given_lowercase_query_expect_uppercase_form_match(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="Bok", hgno=1)
    await WordFormFactory.create(form="BOK", lemma=lemma)

    response = await client.get("/lexicons/resolve", params={"word": "bok"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["candidates"]) == 1
    assert data["candidates"][0]["word"] == "Bok"


async def test_resolve_given_invalid_characters_expect_400(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/resolve", params={"word": "test123"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    error = response.json()["detail"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "invalid characters" in error["message"].lower()


async def test_resolve_given_empty_query_expect_422(
    client: AsyncClient,
) -> None:
    response = await client.get("/lexicons/resolve", params={"word": ""})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_resolve_given_anonymous_no_auth_required(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="hus", hgno=1)
    await WordFormFactory.create(form="hus", lemma=lemma)

    response = await client.get("/lexicons/resolve", params={"word": "hus"})
    assert response.status_code == HTTPStatus.OK


async def test_resolve_given_multiple_definitions_expect_all_mapped(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="hus", hgno=1)
    await WordFormFactory.create(form="hus", lemma=lemma)
    await DefinitionFactory.create(
        lemma=lemma, definition="a building", translation="bygning"
    )
    await DefinitionFactory.create(lemma=lemma, definition="a home", translation="hjem")

    response = await client.get("/lexicons/resolve", params={"word": "hus"})
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data["candidates"]) == 1
    assert len(data["candidates"][0]["definitions"]) == K_EXPECTED_DEFINITION_COUNT


async def test_resolve_given_morph_fallback_expect_is_compound_true_on_candidate(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end: flyt-tagger compound fallback surfaces is_compound=True."""
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(
            200,
            {
                "word": "sykkelvei",
                "analyses": [
                    {
                        "lemma": "sykkelvei",
                        "pos": "noun",
                        "is_compound": True,
                        "head": "vei",
                    },
                ],
            },
        ),
    )

    head_lemma = await LemmaFactory.create(word="vei", pos="noun", hgno=1)
    await WordFormFactory.create(form="vei", lemma=head_lemma)

    response = await client.get("/lexicons/resolve", params={"word": "sykkelvei"})

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["query"] == "sykkelvei"
    assert len(data["candidates"]) == 1
    assert data["candidates"][0]["word"] == "vei"
    assert data["candidates"][0]["is_compound"] is True


# ── Lemma userState: derived from UserLemma + ACTIVE UserCard ────────────────
# Regression for the "subscribe to frequency deck, practice once, search still
# says Add to review" bug. An ACTIVE lemma-owned UserCard means the word is in
# active review → LEARNING, even with no UserLemma row. UPCOMING stays NEW.


async def _get_lemma_user_state(client: AsyncClient, lemma_uuid: object) -> str:
    response = await client.get(f"/lexicons/lemmas/{lemma_uuid}/definitions")
    assert response.status_code == HTTPStatus.OK
    return response.json()["definitions"][0]["userState"]


async def test_definitions_given_active_card_without_user_lemma_expect_new(
    client: AsyncClient,
) -> None:
    """Vocabulary state reads from UserLemma only. An ACTIVE card without a
    UserLemma row (pre-backfill state) reads as "new". The activation invariant
    ensures this combination does not occur for cards activated through the
    shared activation command."""
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=lemma)
    pool = await CardPoolFactory.create(lemma=lemma)
    await UserCardFactory.create(
        user=user, pool=pool, enrollment_state=Enrollment.ACTIVE
    )
    await authenticate(client, user)

    assert await _get_lemma_user_state(client, lemma.uuid) == "new"


async def test_definitions_given_upcoming_card_without_user_lemma_expect_new(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=lemma)
    pool = await CardPoolFactory.create(lemma=lemma)
    await UserCardFactory.create(
        user=user, pool=pool, enrollment_state=Enrollment.UPCOMING
    )
    await authenticate(client, user)

    assert await _get_lemma_user_state(client, lemma.uuid) == "new"


async def test_definitions_given_user_lemma_mastered_expect_mastered(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=lemma)
    await UserLemmaFactory.create(user=user, lemma=lemma, is_mastered=True)
    await authenticate(client, user)

    assert await _get_lemma_user_state(client, lemma.uuid) == "mastered"


async def test_definitions_given_saved_user_lemma_expect_learning(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=lemma)
    await UserLemmaFactory.create(user=user, lemma=lemma, is_mastered=False)
    await authenticate(client, user)

    assert await _get_lemma_user_state(client, lemma.uuid) == "learning"


# ── see_also cross-references on GET /lemmas/{uuid}/definitions ─────────────


async def test_definitions_given_resolved_see_also_target_has_uuid(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """A see_also target whose article is imported carries target_lemma_uuid."""
    source = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=source)

    target_lemma = await LemmaFactory.create(source_article_id=777)
    await SeeAlsoFactory.create(
        lemma=source,
        target_article_id=777,
        target_word="mål",
        relation="see",
        ordinal=0,
    )

    response = await client.get(f"/lexicons/lemmas/{source.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    see_also = data["lemma"]["see_also"]
    assert len(see_also) == 1
    assert see_also[0]["article_id"] == K_TARGET_ARTICLE_ID
    assert see_also[0]["word"] == "mål"
    assert see_also[0]["relation"] == "see"
    assert see_also[0]["target_lemma_uuid"] == str(target_lemma.uuid)


async def test_definitions_given_dangling_see_also_has_null_uuid_but_keeps_word(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """A see_also target whose article is NOT imported → uuid null, word kept."""
    source = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=source)

    await SeeAlsoFactory.create(
        lemma=source,
        target_article_id=888,
        target_word="teknikk",
        relation="compare",
        ordinal=0,
    )

    response = await client.get(f"/lexicons/lemmas/{source.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    see_also = data["lemma"]["see_also"]
    assert len(see_also) == 1
    assert see_also[0]["word"] == "teknikk"
    assert see_also[0]["relation"] == "compare"
    assert see_also[0]["target_lemma_uuid"] is None


async def test_definitions_given_no_see_also_returns_empty_list(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """A lemma with no see_also rows returns an empty list (not missing key)."""
    source = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=source)

    response = await client.get(f"/lexicons/lemmas/{source.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["lemma"]["see_also"] == []


# ── /me/lemmas — user vocabulary notebook ────────────────────────────────────


async def test_list_my_lemmas_given_learning_and_mastered_expect_correct_counts(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lemma_learning = await LemmaFactory.create(word="gå")
    lemma_mastered = await LemmaFactory.create(word="hund")
    lemma_other = await LemmaFactory.create(word="katt")
    await UserLemmaFactory.create(user=user, lemma=lemma_learning, is_mastered=False)
    await UserLemmaFactory.create(user=user, lemma=lemma_mastered, is_mastered=True)
    # lemma_other is not in the user's vocabulary — must be excluded.
    await UserLemmaFactory.create(lemma=lemma_other, is_mastered=False)
    await authenticate(client, user)

    response = await client.get("/me/lemmas")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body["lemmas"]) == K_EXPECTED_USER_LEMMA_COUNT
    words = [entry["word"] for entry in body["lemmas"]]
    assert "gå" in words
    assert "hund" in words
    assert body["mastered_count"] == 1
    assert body["learning_count"] == 1


async def test_list_my_lemmas_given_no_user_lemmas_expect_empty(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/lemmas")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["lemmas"] == []
    assert body["mastered_count"] == 0
    assert body["learning_count"] == 0


async def test_list_my_lemmas_given_unauthenticated_expect_401(
    client: AsyncClient,
) -> None:
    response = await client.get("/me/lemmas")

    assert response.status_code == HTTPStatus.UNAUTHORIZED


# ── Missing lemma 404 paths ──────────────────────────────────────────────────


async def test_get_lemma_definitions_given_missing_lemma_uuid_expect_404(
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/lexicons/lemmas/{uuid4()}/definitions",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "NOT_FOUND"


async def test_mark_known_given_missing_lemma_uuid_expect_404(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(f"/lexicons/lemmas/{uuid4()}/mark-known")

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "NOT_FOUND"
