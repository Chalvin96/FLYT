"""Unit tests for pronunciation helpers in ordbokene_importer."""

from scripts.ordbokene_importer import _first_pron
from scripts.ordbokene_importer import _is_safe_audio_url
from scripts.ordbokene_importer import _lemma_audio_url
from scripts.ordbokene_importer import _lemma_base_pron
from scripts.ordbokene_importer import _pron_is_approximate


# --- _lemma_audio_url ---


def _audio_ld(url: str) -> dict:
    return {"audio": {"lemma": [{"url": url}]}}


def test_lemma_audio_url_returns_data_url():
    ld = _audio_ld("https://media.example.com/audio/lemma/google/v/abc123.mp3")
    assert (
        _lemma_audio_url(ld)
        == "https://media.example.com/audio/lemma/google/v/abc123.mp3"
    )


def test_lemma_audio_url_missing_audio_key_returns_none():
    assert _lemma_audio_url({}) is None


def test_lemma_audio_url_missing_lemma_key_returns_none():
    assert _lemma_audio_url({"audio": {}}) is None


def test_lemma_audio_url_empty_lemma_list_returns_none():
    assert _lemma_audio_url({"audio": {"lemma": []}}) is None


def test_lemma_audio_url_missing_url_returns_none():
    assert _lemma_audio_url({"audio": {"lemma": [{"file": "x.mp3"}]}}) is None


def test_lemma_audio_url_non_string_url_returns_none():
    assert _lemma_audio_url({"audio": {"lemma": [{"url": 123}]}}) is None


def test_lemma_audio_url_non_https_returns_none():
    assert _lemma_audio_url(_audio_ld("http://insecure/x.mp3")) is None


def test_lemma_audio_url_traversal_returns_none():
    assert _lemma_audio_url(_audio_ld("https://host/../../etc/passwd")) is None


# --- _is_safe_audio_url ---


def test_is_safe_audio_url_valid_https_returns_true():
    assert _is_safe_audio_url("https://media.example.com/audio/lemma/g/v/a.mp3") is True


def test_is_safe_audio_url_http_returns_false():
    assert _is_safe_audio_url("http://media.example.com/a.mp3") is False


def test_is_safe_audio_url_traversal_returns_false():
    assert _is_safe_audio_url("https://host/../a.mp3") is False


def test_is_safe_audio_url_whitespace_returns_false():
    assert _is_safe_audio_url("https://host/a b.mp3") is False


def test_is_safe_audio_url_encoded_crlf_returns_false():
    assert _is_safe_audio_url("https://host/x.mp3%0d%0aHeader:val") is False


def test_is_safe_audio_url_no_host_returns_false():
    assert _is_safe_audio_url("https://") is False


def test_is_safe_audio_url_malformed_returns_false():
    # urlparse raises ValueError on a bad IPv6 literal — must reject, not crash
    assert _is_safe_audio_url("https://[") is False


# --- _pron_is_approximate ---


def test_pron_is_approximate_none_returns_false():
    assert _pron_is_approximate(None) is False


def test_pron_is_approximate_nb_uttale_returns_false():
    pron = {"source": "nb_uttale", "ipa": "ˈhʊn"}
    assert _pron_is_approximate(pron) is False


def test_pron_is_approximate_nb_g2p_returns_true():
    pron = {"source": "nb_g2p", "ipa": "ˈhʊn", "needs_review": True}
    assert _pron_is_approximate(pron) is True


def test_pron_is_approximate_nb_uttale_newwords_returns_false():
    pron = {"source": "nb_uttale_newwords", "ipa": "ˈhʊn"}
    assert _pron_is_approximate(pron) is False


def test_pron_is_approximate_needs_review_only_returns_true():
    pron = {"source": "nb_uttale", "ipa": "ˈhʊn", "needs_review": True}
    assert _pron_is_approximate(pron) is True


def test_pron_is_approximate_empty_dict_returns_false():
    assert _pron_is_approximate({}) is False


# --- _lemma_base_pron ---


def test_lemma_base_pron_finds_matching_word_form():
    ld = {
        "lemma": "hund",
        "word_forms": [
            {
                "word_form": "hund",
                "tags_json": ["Sing", "Ind"],
                "pronunciation": [
                    {"ipa": "ˈhʉn", "tone": 1, "source": "nb_uttale"},
                ],
            },
            {
                "word_form": "hunden",
                "tags_json": ["Sing", "Def"],
                "pronunciation": [
                    {"ipa": "ˈhʉnən", "tone": 2, "source": "nb_uttale"},
                ],
            },
        ],
    }
    pron = _lemma_base_pron(ld)
    assert pron is not None
    assert pron["ipa"] == "ˈhʉn"
    assert pron["tone"] == 1


def test_lemma_base_pron_returns_none_when_no_match():
    ld = {
        "lemma": "katt",
        "word_forms": [
            {"word_form": "hund", "tags_json": [], "pronunciation": []},
        ],
    }
    assert _lemma_base_pron(ld) is None


def test_lemma_base_pron_returns_none_when_pronunciation_empty():
    ld = {
        "lemma": "hund",
        "word_forms": [
            {"word_form": "hund", "tags_json": [], "pronunciation": []},
        ],
    }
    assert _lemma_base_pron(ld) is None


def test_lemma_base_pron_returns_none_when_no_word_forms():
    ld = {"lemma": "hund", "word_forms": []}
    assert _lemma_base_pron(ld) is None


def test_lemma_base_pron_returns_none_when_pronunciation_missing():
    ld = {
        "lemma": "hund",
        "word_forms": [
            {"word_form": "hund", "tags_json": []},
        ],
    }
    assert _lemma_base_pron(ld) is None


# --- _first_pron ---


def test_first_pron_empty_list_returns_none():
    assert _first_pron([]) is None


def test_first_pron_non_empty_returns_first_entry():
    entries = [
        {"ipa": "ˈhʉn", "source": "nb_uttale"},
        {"ipa": "ˈhʉnən", "source": "nb_uttale"},
    ]
    result = _first_pron(entries)
    assert result is not None
    assert result["ipa"] == "ˈhʉn"
