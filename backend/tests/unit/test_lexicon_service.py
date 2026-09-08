import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.constants import K_LEXICON_SUGGESTIONS_LIMIT
from flyt.apps.lexicons.services import LexiconService
from flyt.apps.users.services import UserLemmaService
from flyt.core.config import settings
from flyt.core.exceptions import ValidationError
from tests.factories import CardPoolFactory
from tests.factories import DefinitionFactory
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import WordFormFactory
from tests.helpers.tagger import FakeTaggerResponse
from tests.helpers.tagger import install_fake_tagger

EXPECTED_LEMMA_SEARCH_RESULT_COUNT = 2
EXPECTED_DEFINITION_COUNT = 2
EXPECTED_HEADWORD_ENTRY_COUNT = 2
SECOND_HEADWORD_NUMBER = 2


@pytest.mark.anyio
async def test_search_lemmas_given_exact_match_expect_lemma_returned(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="gikk")
    await WordFormFactory.create(form="gikk", lemma=lemma)

    result = await service.search_lemmas("gikk")

    assert len(result) == 1
    assert result[0].word == "gikk"
    assert result[0].id == lemma.id


@pytest.mark.anyio
async def test_search_lemmas_given_multiple_lemmas_expect_all_returned(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma1 = await LemmaFactory.create(word="test1")
    lemma2 = await LemmaFactory.create(word="test2")
    await WordFormFactory.create(form="gikk", lemma=lemma1)
    await WordFormFactory.create(form="gikk", lemma=lemma2)

    result = await service.search_lemmas("gikk")

    assert len(result) == EXPECTED_LEMMA_SEARCH_RESULT_COUNT
    word_values = {r.word for r in result}
    assert word_values == {"test1", "test2"}


@pytest.mark.anyio
async def test_search_lemmas_given_no_match_expect_empty_list(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="test")
    await WordFormFactory.create(form="gikk")

    result = await service.search_lemmas("nonexistent")

    assert result == []


@pytest.mark.anyio
async def test_search_lemmas_given_word_with_definitions_expect_definitions_loaded(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="test")
    await WordFormFactory.create(form="test", lemma=lemma)
    await DefinitionFactory.create(lemma=lemma, definition="First definition")
    await DefinitionFactory.create(lemma=lemma, definition="Second definition")

    result = await service.search_lemmas("test")

    assert len(result) == 1
    assert len(result[0].definitions) == EXPECTED_DEFINITION_COUNT
    definition_texts = {d.definition for d in result[0].definitions}
    assert definition_texts == {"First definition", "Second definition"}


@pytest.mark.anyio
async def test_search_lemmas_given_case_sensitive_expect_no_match(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="Gikk")
    await WordFormFactory.create(form="Gikk", lemma=lemma)

    result = await service.search_lemmas("gikk")

    assert len(result) == 0


@pytest.mark.anyio
async def test_search_lemmas_given_word_form_different_from_lemma_expect_match(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="gå")
    await WordFormFactory.create(form="gikk", lemma=lemma)

    result = await service.search_lemmas("gikk")

    assert len(result) == 1
    assert result[0].word == "gå"


@pytest.mark.anyio
async def test_search_lemmas_given_norwegian_letters_expect_match(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="vær")
    await WordFormFactory.create(form="været", lemma=lemma)

    result = await service.search_lemmas("været")

    assert len(result) == 1
    assert result[0].word == "vær"


@pytest.mark.anyio
async def test_search_lemmas_given_invalid_characters_expect_error(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.search_lemmas("test123")


@pytest.mark.anyio
async def test_search_lemmas_given_special_characters_expect_error(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.search_lemmas("test@#$")


@pytest.mark.anyio
async def test_search_lemmas_given_matching_word_form_expect_loaded_forms_and_translations(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="bok")
    await WordFormFactory.create(lemma=lemma, form="boken", tags_json=["Def"])
    await DefinitionFactory.create(lemma=lemma, definition="book", translation="book")

    result = await service.search_lemmas("boken")

    assert result[0].word_forms[0].form == "boken"
    assert result[0].definitions[0].translation == "book"


@pytest.mark.anyio
async def test_get_lemma_definitions_given_existing_and_missing_ids_expect_definitions_or_none(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create()
    await DefinitionFactory.create(lemma=lemma, definition="test def")
    definitions = await service.get_lemma_definitions(lemma.uuid)
    assert definitions is not None
    assert len(definitions) == 1


@pytest.mark.anyio
async def test_mark_lemma_known_given_no_user_card_expect_mastered_lemma_only(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    user_lemma_service = UserLemmaService(async_session)
    await user_lemma_service.set_lemma_mastery_state(user.id, lemma.id, True)
    await async_session.flush()

    from flyt.apps.users.models import UserLemma

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )

    assert user_lemma is not None
    assert user_lemma.is_mastered is True


@pytest.mark.anyio
async def test_get_lemma_state_use_user_lemma_states(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    new_lemma = await LemmaFactory.create()
    learning_lemma = await LemmaFactory.create()
    mastered_lemma = await LemmaFactory.create()
    await UserLemmaFactory.create(
        user=user,
        lemma=learning_lemma,
        is_mastered=False,
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=mastered_lemma,
        is_mastered=True,
    )

    state_new = await service.get_lemma_state(new_lemma.id, user.id)
    state_learning = await service.get_lemma_state(learning_lemma.id, user.id)
    state_mastered = await service.get_lemma_state(mastered_lemma.id, user.id)

    assert state_new == "new"
    assert state_learning == "learning"
    assert state_mastered == "mastered"


@pytest.mark.anyio
async def test_get_lemma_state_reads_user_lemma_only_not_active_card(
    async_session: AsyncSession,
) -> None:
    """Vocabulary state reads from UserLemma only. An ACTIVE lemma-owned card
    without a UserLemma row (pre-backfill state) reads as "new"."""
    from flyt.apps.flashcards.models import CardState
    from flyt.apps.flashcards.models import Enrollment
    from tests.factories import UserCardFactory

    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="state-active-no-lemma")
    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    state = await service.get_lemma_state(lemma.id, user.id)

    assert state == "new"


@pytest.mark.anyio
async def test_list_user_lemmas_reads_user_lemma_only(
    async_session: AsyncSession,
) -> None:
    """list_user_lemmas reads from UserLemma only; active cards without a
    UserLemma row do not contribute."""
    from flyt.apps.flashcards.models import CardState
    from flyt.apps.flashcards.models import Enrollment
    from tests.factories import UserCardFactory

    user = await UserFactory.create()
    saved_lemma = await LemmaFactory.create(word="saved")
    unsaved_lemma = await LemmaFactory.create(word="unsaved")
    await UserLemmaFactory.create(user=user, lemma=saved_lemma, is_mastered=False)
    # Active card without UserLemma should NOT appear in the list.
    pool = await CardPoolFactory.create(lemma=unsaved_lemma, key="list-active")
    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    result = await service.list_user_lemmas(user.id)

    assert len(result) == 1
    assert result[0].lemma.word == "saved"


# --- get_suggestions tests ---


@pytest.mark.anyio
async def test_get_suggestions_given_exact_headword_match_expect_headword_returned(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå")

    result = await service.get_suggestions("gå")

    assert result == ["gå"]


@pytest.mark.anyio
async def test_get_suggestions_given_prefix_match_expect_headword_returned(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="hunden")

    result = await service.get_suggestions("hun")

    assert result == ["hunden"]


@pytest.mark.anyio
async def test_get_suggestions_given_exact_before_prefix_expect_exact_first(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå")
    # "går" only has a prefix headword match.
    await LemmaFactory.create(word="går")

    result = await service.get_suggestions("gå")

    assert result == ["gå", "går"]


@pytest.mark.anyio
async def test_get_suggestions_given_duplicate_headwords_expect_collapsed(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå", hgno=1)
    await LemmaFactory.create(word="gå", hgno=2)

    result = await service.get_suggestions("gå")

    assert result == ["gå"]


@pytest.mark.anyio
async def test_get_suggestions_given_more_than_eight_expect_limited(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    for i in range(10):
        await LemmaFactory.create(word=f"test{i}")

    result = await service.get_suggestions("te")

    assert len(result) == K_LEXICON_SUGGESTIONS_LIMIT


@pytest.mark.anyio
async def test_get_suggestions_given_no_match_expect_empty(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="hund")

    result = await service.get_suggestions("zz")

    assert result == []


@pytest.mark.anyio
async def test_get_suggestions_given_invalid_characters_expect_error(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.get_suggestions("test123")


@pytest.mark.anyio
async def test_get_suggestions_given_norwegian_letters_expect_match(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="været")

    result = await service.get_suggestions("væ")

    assert result == ["været"]


# --- resolve_headword tests ---


@pytest.mark.anyio
async def test_resolve_headword_given_exact_headword_expect_resolved(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå", hgno=1, is_sub_article=False)

    result = await service.resolve_headword("gå")

    assert result is not None
    assert result.headword == "gå"
    assert result.is_fallback is False
    assert len(result.entries) == 1
    assert result.entries[0].hgno == 1
    assert result.selected_lemma_uuid == result.entries[0].uuid


@pytest.mark.anyio
async def test_resolve_headword_given_homographs_expect_all_entries(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma1 = await LemmaFactory.create(word="bok", hgno=1, is_sub_article=False)
    lemma2 = await LemmaFactory.create(word="bok", hgno=2, is_sub_article=False)

    result = await service.resolve_headword("bok")

    assert result is not None
    assert result.headword == "bok"
    assert len(result.entries) == EXPECTED_HEADWORD_ENTRY_COUNT
    assert result.entries[0].hgno == 1
    assert result.entries[1].hgno == SECOND_HEADWORD_NUMBER
    assert result.entries[0].uuid == lemma1.uuid
    assert result.entries[1].uuid == lemma2.uuid
    assert result.selected_lemma_uuid == lemma1.uuid


@pytest.mark.anyio
async def test_resolve_headword_given_sub_articles_expect_selected_non_sub(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="bok", hgno=1, is_sub_article=True)
    main_lemma = await LemmaFactory.create(word="bok", hgno=2, is_sub_article=False)

    result = await service.resolve_headword("bok")

    assert result is not None
    assert len(result.entries) == EXPECTED_HEADWORD_ENTRY_COUNT
    assert result.selected_lemma_uuid == main_lemma.uuid


@pytest.mark.anyio
async def test_resolve_headword_given_only_sub_articles_expect_first_selected(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    sub1 = await LemmaFactory.create(word="bok", hgno=1, is_sub_article=True)

    result = await service.resolve_headword("bok")

    assert result is not None
    assert len(result.entries) == 1
    assert result.selected_lemma_uuid == sub1.uuid


@pytest.mark.anyio
async def test_resolve_headword_given_no_exact_expect_fallback(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    # "går" is a prefix headword match for query "gå", no exact headword "gå" exists
    await LemmaFactory.create(word="går")

    result = await service.resolve_headword("gå")

    assert result is not None
    assert result.headword == "går"
    assert result.is_fallback is True


@pytest.mark.anyio
async def test_resolve_headword_given_no_match_expect_none(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="hund")

    result = await service.resolve_headword("zz")

    assert result is None


@pytest.mark.anyio
async def test_resolve_headword_given_invalid_characters_expect_error(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.resolve_headword("test123")


@pytest.mark.anyio
async def test_resolve_headword_given_exact_before_prefix_fallback_expect_exact(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    # Exact headword "gå" exists
    await LemmaFactory.create(word="gå", hgno=1)
    # Prefix-match candidate "går" also exists
    await LemmaFactory.create(word="går")

    result = await service.resolve_headword("gå")

    assert result is not None
    assert result.headword == "gå"
    assert result.is_fallback is False


# --- deduplication edge-case tests ---


@pytest.mark.anyio
async def test_get_suggestions_given_many_homographs_fewer_unique_still_hits_limit(
    async_session: AsyncSession,
) -> None:
    """When one headword has 10+ homographs, suggestions should still return
    up to K_LEXICON_SUGGESTIONS_LIMIT *unique* headwords across different
    headword values, not just 1 after collapsing."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    # "gå" has many homographs (10 rows sharing the same headword)
    for i in range(10):
        await LemmaFactory.create(word="gå", hgno=i + 1)

    result = await service.get_suggestions("gå")

    # Should get 1 unique headword ("gå") since there are no other candidates
    assert result == ["gå"]


@pytest.mark.anyio
async def test_get_suggestions_given_homographs_plus_prefix_expect_full_limit(
    async_session: AsyncSession,
) -> None:
    """With many homographs for one headword AND many other distinct headword
    prefixes, the deduplicated limit should still be met."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    # Create 15 homographs for "test"
    for i in range(15):
        await LemmaFactory.create(word="test", hgno=i + 1)
    # Create 15 other unique headwords that also match the prefix "te"
    for i in range(15):
        await LemmaFactory.create(word=f"te{i:02d}", hgno=1)

    result = await service.get_suggestions("te")

    assert len(result) == K_LEXICON_SUGGESTIONS_LIMIT
    # All prefix matches here; alphabetical order applies.
    # "te" is the query, so no exact match exists.
    # "te00" sorts before "test" alphabetically.
    assert result[0] == "te00"
    # All should be unique
    assert len(set(result)) == len(result)


# --- trimmed min-length validation tests ---


@pytest.mark.anyio
async def test_get_suggestions_given_padded_single_char_expect_error(
    async_session: AsyncSession,
) -> None:
    """Whitespace-padded single char should fail after trimming."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.get_suggestions(" a ")


@pytest.mark.anyio
async def test_get_suggestions_given_two_char_with_padding_expect_success(
    async_session: AsyncSession,
) -> None:
    """Whitespace-padded two chars should pass after trimming."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå")

    result = await service.get_suggestions(" gå ")

    assert result == ["gå"]


@pytest.mark.anyio
async def test_resolve_headword_given_padded_single_char_expect_error(
    async_session: AsyncSession,
) -> None:
    """Whitespace-padded single char should fail after trimming."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    with pytest.raises(ValidationError, match="Query contains invalid characters"):
        await service.resolve_headword(" a ")


@pytest.mark.anyio
async def test_resolve_headword_given_two_char_with_padding_expect_success(
    async_session: AsyncSession,
) -> None:
    """Whitespace-padded two chars should pass after trimming."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    await LemmaFactory.create(word="gå", hgno=1)

    result = await service.resolve_headword(" gå ")

    assert result is not None
    assert result.headword == "gå"


# --- browse sub-articles visibility tests ---


@pytest.mark.anyio
async def test_resolve_headword_given_mixed_sub_and_main_expect_all_visible(
    async_session: AsyncSession,
) -> None:
    """Browse should return all homographs including sub-articles."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    sub = await LemmaFactory.create(word="ord", hgno=1, is_sub_article=True)
    main = await LemmaFactory.create(word="ord", hgno=2, is_sub_article=False)

    result = await service.resolve_headword("ord")

    assert result is not None
    assert len(result.entries) == EXPECTED_HEADWORD_ENTRY_COUNT
    entry_uuids = {e.uuid for e in result.entries}
    assert sub.uuid in entry_uuids
    assert main.uuid in entry_uuids
    assert result.selected_lemma_uuid == main.uuid


@pytest.mark.anyio
async def test_list_user_lemmas_returns_saved_with_state_and_excludes_others(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    user = await UserFactory.create()
    other = await UserFactory.create()

    learning_lemma = await LemmaFactory.create(word="lese")
    mastered_lemma = await LemmaFactory.create(word="hus")
    other_lemma = await LemmaFactory.create(word="gå")

    await UserLemmaFactory.create(user=user, lemma=learning_lemma, is_mastered=False)
    await UserLemmaFactory.create(user=user, lemma=mastered_lemma, is_mastered=True)
    # Belongs to a different user — must not leak.
    await UserLemmaFactory.create(user=other, lemma=other_lemma, is_mastered=True)

    result = await service.list_user_lemmas(user.id)

    by_word = {entry.lemma.word: entry.state for entry in result}
    assert by_word == {"lese": "learning", "hus": "mastered"}


@pytest.mark.anyio
async def test_list_user_lemmas_given_no_saved_words_expect_empty(
    async_session: AsyncSession,
) -> None:
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    user = await UserFactory.create()

    result = await service.list_user_lemmas(user.id)

    assert result == []


# --- resolve_word tagger fallback tests ---


@pytest.mark.anyio
async def test_resolve_word_given_direct_match_expect_lemmas_not_compound(
    async_session: AsyncSession,
) -> None:
    """Case 1: direct WordForm match returns lemmas with is_compound=False."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    lemma = await LemmaFactory.create(word="gå", pos="verb", hgno=1)
    await WordFormFactory.create(form="går", lemma=lemma)

    result = await service.resolve_word("går")

    assert len(result.lemmas) == 1
    assert result.lemmas[0].word == "gå"
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_no_match_and_tagger_disabled_expect_empty(
    async_session: AsyncSession,
) -> None:
    """Case 2: no match, TAGGER_SVC_URL unset — empty result, feature fully off."""
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    result = await service.resolve_word("zzzz")

    assert result.lemmas == []
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_compound_fallback_expect_head_lemma_and_compound_flag(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 3: flyt-tagger returns a compound analysis; head lemma is looked up."""
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

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    head_lemma = await LemmaFactory.create(word="vei", pos="noun", hgno=1)
    await WordFormFactory.create(form="vei", lemma=head_lemma)

    result = await service.resolve_word("sykkelvei")

    assert len(result.lemmas) == 1
    assert result.lemmas[0].word == "vei"
    assert result.is_compound is True


@pytest.mark.anyio
async def test_resolve_word_given_de_inflection_fallback_expect_lemma_and_not_compound(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 4: flyt-tagger returns a non-compound lemma (deinflection)."""
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(
            200,
            {
                "word": "gikk",
                "analyses": [
                    {
                        "lemma": "gå",
                        "pos": "verb",
                        "is_compound": False,
                        "head": None,
                    },
                ],
            },
        ),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    base_lemma = await LemmaFactory.create(word="gå", pos="verb", hgno=1)
    await WordFormFactory.create(form="gå", lemma=base_lemma)

    result = await service.resolve_word("gikk")

    assert len(result.lemmas) == 1
    assert result.lemmas[0].word == "gå"
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_fallback_candidate_not_in_db_expect_empty(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 5: flyt-tagger returns a candidate that also doesn't exist in the DB."""
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
                        "head": "fantesikke",
                    },
                ],
            },
        ),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    result = await service.resolve_word("sykkelvei")

    assert result.lemmas == []
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_multi_analysis_first_miss_second_hits(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case N: first candidate not in DB, second analysis candidate resolves."""
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(
            200,
            {
                "word": "gikk",
                "analyses": [
                    {
                        "lemma": "fantesikke",  # compound-ish miss
                        "pos": "verb",
                        "is_compound": True,
                        "head": "fantesikke",  # head == lemma == not in DB
                    },
                    {
                        "lemma": "gå",  # plain deinflection — IS in DB
                        "pos": "verb",
                        "is_compound": False,
                        "head": None,
                    },
                ],
            },
        ),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    base_lemma = await LemmaFactory.create(word="gå", pos="verb", hgno=1)
    await WordFormFactory.create(form="gå", lemma=base_lemma)

    result = await service.resolve_word("gikk")

    assert len(result.lemmas) == 1
    assert result.lemmas[0].word == "gå"
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_malformed_analyses_expect_empty_no_exception(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """200 with a malformed body (non-dict analysis entries) fails open, no raise."""
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(200, {"analyses": [None, "x", 42]}),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    result = await service.resolve_word("sykkelvei")

    assert result.lemmas == []
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_tagger_non_200_expect_empty_no_exception(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 6: flyt-tagger responds non-200 (503) — empty result, no exception."""
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(503, {"error": "busy"}),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    result = await service.resolve_word("sykkelvei")

    assert result.lemmas == []
    assert result.is_compound is False


@pytest.mark.anyio
async def test_resolve_word_given_tagger_timeout_expect_empty_no_exception(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Case 7: flyt-tagger call raises a timeout — empty result, no exception."""
    import httpx as _httpx

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    install_fake_tagger(
        monkeypatch,
        exc=_httpx.ReadTimeout("timed out"),
    )

    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    result = await service.resolve_word("sykkelvei")

    assert result.lemmas == []
    assert result.is_compound is False
