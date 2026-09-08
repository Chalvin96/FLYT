import uuid as uuid_mod
from unittest.mock import MagicMock

from flyt.apps.flashcards.schemas import DefinitionPayload
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.schemas import LemmaSummaryRead
from flyt.apps.lexicons.schemas import ResolveCandidate
from flyt.apps.lexicons.schemas import WordFormRead


def test_word_form_read_nullable():
    wf = WordFormRead(id=1, form="hunden", tags_json=[])
    assert wf.ipa is None
    assert wf.audio_url is None


def test_word_form_read_ipa_approximate_defaults_false():
    wf = WordFormRead(id=1, form="hunden", tags_json=[])
    assert wf.ipa_approximate is False


def test_lemma_summary_read_ipa_approximate_defaults_false():
    ls = LemmaSummaryRead(
        uuid=uuid_mod.uuid4(),
        word="hund",
        pos=LemmaPos.NOUN,
    )
    assert ls.ipa_approximate is False


def test_pronunciation_schemas_given_no_values_expect_intonation_nullable():
    ls = LemmaSummaryRead(uuid=uuid_mod.uuid4(), word="hund", pos=LemmaPos.NOUN)
    dp = DefinitionPayload(word="hund", pos=LemmaPos.NOUN, primary_translation="dog")
    assert ls.intonation is None
    assert dp.intonation is None


def test_definition_payload_ipa_approximate_defaults_false():
    dp = DefinitionPayload(
        word="hund",
        pos=LemmaPos.NOUN,
        primary_translation="dog",
    )
    assert dp.ipa_approximate is False


def _make_lemma(ipa=None, intonation=None, ipa_approximate=None):
    m = MagicMock()
    m.uuid = uuid_mod.uuid4()
    m.word = "hund"
    m.pos = LemmaPos.NOUN
    m.hgno = 1
    m.is_sub_article = False
    m.ipa = ipa
    m.intonation = intonation
    m.ipa_approximate = ipa_approximate
    m.definitions = []
    return m


def test_resolve_candidate_ipa_approximate_defaults_false():
    lemma = _make_lemma()
    candidate = ResolveCandidate(
        lemma_uuid=lemma.uuid,
        word=lemma.word,
        pos=lemma.pos,
        hgno=lemma.hgno,
        definitions=[],
    )
    assert candidate.ipa_approximate is False
