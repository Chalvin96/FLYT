"""Focused tests for the flyt-tagger client: POS normalization, transport reuse, fail-open."""

import httpx
import pytest

from flyt.clients import tagger as tagger_client
from flyt.clients.tagger import _derive_tagger_candidate
from flyt.clients.tagger import _normalize_obt_pos
from flyt.clients.tagger import open_session
from flyt.core.config import settings
from tests.helpers.tagger import FakeTaggerClient
from tests.helpers.tagger import FakeTaggerResponse
from tests.helpers.tagger import install_fake_tagger


def test_normalize_obt_pos_given_common_labels_expect_lemma_pos() -> None:
    assert _normalize_obt_pos("subst") == "noun"
    assert _normalize_obt_pos("verb") == "verb"
    assert _normalize_obt_pos("adj") == "adjective"
    assert _normalize_obt_pos("adv") == "adverb"
    assert _normalize_obt_pos("prep") == "preposition"
    assert _normalize_obt_pos("konj") == "conjunction"
    assert _normalize_obt_pos("pron") == "pronoun"
    assert _normalize_obt_pos("det") == "determiner"
    assert _normalize_obt_pos("interj") == "interjection"
    assert _normalize_obt_pos("kardinal") == "numeral"


def test_normalize_obt_pos_given_mixed_case_expect_normalized_pos() -> None:
    assert _normalize_obt_pos("Subst") == "noun"
    assert _normalize_obt_pos("VERB") == "verb"


def test_normalize_obt_pos_given_unknown_label_expect_none() -> None:
    assert _normalize_obt_pos("unknowntag") is None
    assert _normalize_obt_pos("") is None
    assert _normalize_obt_pos(None) is None


def test_derive_candidate_given_compound_head_expect_normalized_pos() -> None:
    analyses = [
        {
            "lemma": "innbyggerantall",
            "pos": "subst",
            "is_compound": True,
            "head": "antall",
        }
    ]
    candidates = _derive_tagger_candidate("innbyggerantall", analyses)
    assert len(candidates) == 1
    assert candidates[0].lemma == "antall"
    assert candidates[0].is_compound is True
    assert candidates[0].pos == "noun"


def test_derive_candidate_given_inflected_word_expect_lemma_and_pos() -> None:
    analyses = [{"lemma": "spise", "pos": "verb", "is_compound": False, "head": None}]
    candidates = _derive_tagger_candidate("spiste", analyses)
    assert len(candidates) == 1
    assert candidates[0].lemma == "spise"
    assert candidates[0].pos == "verb"


def test_derive_candidate_given_unknown_pos_expect_eligible_candidate() -> None:
    analyses = [
        {"lemma": "word", "pos": "mystery_tag", "is_compound": False, "head": None}
    ]
    candidates = _derive_tagger_candidate("wordx", analyses)
    assert len(candidates) == 1
    assert candidates[0].pos is None


def test_derive_candidate_given_missing_pos_expect_eligible_candidate() -> None:
    analyses = [{"lemma": "word", "is_compound": False, "head": None}]
    candidates = _derive_tagger_candidate("wordx", analyses)
    assert len(candidates) == 1
    assert candidates[0].pos is None


@pytest.mark.anyio
async def test_analyze_given_shared_client_expect_reuses_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The analyze(client, word) path must reuse the given client, not create one."""
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    fake = FakeTaggerClient(
        response=FakeTaggerResponse(
            200,
            {
                "word": "katter",
                "analyses": [
                    {
                        "lemma": "katt",
                        "pos": "subst",
                        "is_compound": False,
                        "head": None,
                    }
                ],
            },
        )
    )

    result = await tagger_client.analyze(fake, "katter")
    assert len(result) == 1
    assert result[0].lemma == "katt"
    assert result[0].pos == "noun"


@pytest.mark.anyio
async def test_open_session_given_enabled_service_expect_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    fake = install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(
            200,
            {"analyses": []},
        ),
    )
    async with open_session() as client:
        assert client is fake
        await tagger_client.analyze(client, "word")


@pytest.mark.anyio
async def test_analyze_given_non_200_response_expect_fail_open(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    fake = install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(503, {"error": "busy"}),
    )
    result = await tagger_client.analyze(fake, "word")
    assert result == []


@pytest.mark.anyio
async def test_analyze_given_timeout_expect_fail_open(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    fake = install_fake_tagger(monkeypatch, exc=httpx.ReadTimeout("timed out"))
    result = await tagger_client.analyze(fake, "word")
    assert result == []


@pytest.mark.anyio
async def test_analyze_given_malformed_json_expect_fail_open(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")
    fake = install_fake_tagger(
        monkeypatch,
        response=FakeTaggerResponse(200, "not a dict"),
    )
    result = await tagger_client.analyze(fake, "word")
    assert result == []
