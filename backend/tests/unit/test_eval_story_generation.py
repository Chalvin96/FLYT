"""Unit tests for the offline story-generation evaluation harness (R-009).

The provider is mocked entirely: every ``GenerationResult`` (and one failure)
comes from the captured OpenRouter responses in
``tests/fixtures/story_generation/``, parsed through the production
``OpenRouterProvider._parse_response`` so the harness never reimplements
response parsing. All quality-signal assertions run through the harness's call
to ``tasks._measure``, never a reimplementation. Selection and measurement run
against a synthetic ``EvalDeck`` fixed in this file; the real harness loads the
production deck from the database.
"""

import json
import uuid
from pathlib import Path
from typing import Any
from collections.abc import Callable

import httpx
import pytest

from flyt.apps.story_generation.eval_profiles import PROFILES
from flyt.apps.story_generation.eval_profiles import EvalDeck
from flyt.apps.story_generation.eval_profiles import build_selection
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import FrequencyLemma
from flyt.apps.story_generation.vocabulary import derive_target_count
from flyt.clients.openrouter import OpenRouterProvider
from flyt.core.config import settings
from scripts.eval_story_generation import LIMITATION
from scripts.eval_story_generation import MODEL_PRICING_USD_PER_M
from scripts.eval_story_generation import CostSource
from scripts.eval_story_generation import _build_payload
from scripts.eval_story_generation import _derive_cost
from scripts.eval_story_generation import _fetch_model_pricing
from scripts.eval_story_generation import _resolve_prices
from scripts.eval_story_generation import evaluate_profile
from scripts.eval_story_generation import format_records
from scripts.eval_story_generation import parse_args
from scripts.eval_story_generation import run_evaluation
from tests.factories import LemmaFactory

pytestmark = pytest.mark.anyio

EXPECTED_PRODUCED_LENGTH = 65
EXPECTED_UNRESOLVED_TOKEN_RATE = 0.0154
EXPECTED_LEXICAL_TOKEN_COUNT = 65
EXPECTED_MASTERED_TOKEN_COUNT = 26
EXPECTED_IN_PROGRESS_TOKEN_COUNT = 6
EXPECTED_UNKNOWN_TOKEN_COUNT = 32
EXPECTED_MASTERED_LEMMA_COUNT = 10
EXPECTED_IN_PROGRESS_LEMMA_COUNT = 3
EXPECTED_UNKNOWN_LEMMA_COUNT = 22
EXPECTED_PROMPT_TOKENS = 151
EXPECTED_COMPLETION_TOKENS = 102
EXPECTED_REASONING_TOKENS = 135

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "story_generation"
_UUID_NAMESPACE = uuid.UUID("a3f8e2c1-4b6d-4e0f-9a2c-7d5b6c8f0a1e")


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((_FIXTURES / name).read_text())


def _result_from_fixture(name: str) -> Any:
    body = _load_fixture(name)
    return OpenRouterProvider._parse_response(httpx.Response(200, json=body))


def _result_from_fixture_without_cost(name: str) -> Any:
    body = _load_fixture(name)
    body["usage"].pop("cost", None)
    return OpenRouterProvider._parse_response(httpx.Response(200, json=body))


def _make_deck(words: list[str]) -> EvalDeck:
    """Build an ``EvalDeck`` from an ordered word list, rank equal to position."""
    lemmas = [
        FrequencyLemma(id=idx, word=word, frequency_rank=idx)
        for idx, word in enumerate(words, start=1)
    ]
    uuid_by_word = {
        lemma.word: str(uuid.uuid5(_UUID_NAMESPACE, lemma.word)) for lemma in lemmas
    }
    word_to_id = {lemma.word: lemma.id for lemma in lemmas}
    return EvalDeck(
        lemmas=lemmas,
        uuid_by_word=uuid_by_word,
        uuid_to_id={
            uuid_str: word_to_id[word] for word, uuid_str in uuid_by_word.items()
        },
    )


def _big_deck() -> EvalDeck:
    """Large enough that the advanced profile's known band exceeds the bound."""
    return _make_deck([f"w{i}" for i in range(1, 651)])


def _fixture_deck() -> EvalDeck:
    """A deck over the ``success_plain`` text for the beginner profile.

    Ranks 1-120 are known (filler plus ten text lemmas), 121-123 in progress,
    124-126 filler targets that never appear in the text, and the rest text
    lemmas the learner has not met; ``paraply`` is deliberately absent so the
    unresolved-token signal is nonzero.
    """
    text_lemmas = [
        "av",
        "barn",
        "bergen",
        "dag",
        "de",
        "det",
        "en",
        "gammel",
        "god",
        "gå",
        "ha",
        "han",
        "himmel",
        "hus",
        "i",
        "komme",
        "kvinne",
        "lite",
        "liten",
        "mann",
        "med",
        "natt",
        "ny",
        "og",
        "opp",
        "på",
        "regn",
        "regnet",
        "se",
        "seg",
        "stor",
        "til",
        "trapp",
        "ut",
        "være",
    ]
    filler = [f"filler{i}" for i in range(1, 111)]
    known = ["det", "være", "en", "stor", "gammel", "dag", "i", "bergen", "mann", "og"]
    in_progress = ["kvinne", "gå", "hus"]
    targets = ["target1", "target2", "target3"]
    early_unknown = ["barn", "se", "god"]
    late_unknown = [
        word for word in text_lemmas if word not in known + in_progress + early_unknown
    ]
    return _make_deck(
        filler + known + in_progress + targets + early_unknown + late_unknown
    )


class StubProvider:
    """Test double that parses captured responses exactly like production."""

    name = "openrouter"
    model = "deepseek/deepseek-v4-flash-0731"

    def __init__(self, handler: Callable[[Any], Any]) -> None:
        self.handler = handler
        self.requests: list[Any] = []

    async def generate(self, user_id: int, request: Any) -> Any:
        self.requests.append(request)
        return self.handler(request)


@pytest.fixture(scope="module")
def prices() -> tuple[float, float]:
    return MODEL_PRICING_USD_PER_M["deepseek/deepseek-v4-flash-0731"]


def _expected_cost(prompt: int, completion: int, prices: tuple[float, float]) -> float:
    input_per_m, output_per_m = prices
    return round(
        prompt * input_per_m / 1_000_000 + completion * output_per_m / 1_000_000,
        6,
    )


async def _seed_frequency_deck(db, count: int = 607) -> None:
    for rank in range(1, count + 1):
        await LemmaFactory.create(frequency_rank=rank)
    await db.flush()


# --- profiles ---


def test_profiles_given_fixed_set_expect_three_anchors_spanned() -> None:
    """R-002/R-009: the fixed profiles cover the frequency, deck, and none anchors."""
    anchors = {profile.anchor for profile in PROFILES}
    assert anchors == {
        AnchorType.FREQUENCY,
        AnchorType.DECK,
        AnchorType.NONE,
    }


def test_profiles_given_wide_vocabulary_range_expect_known_counts_increasing() -> None:
    """R-009: profiles span a wide vocabulary range, from beginner to advanced."""
    deck = _big_deck()
    known_counts = [
        len(build_selection(profile, deck).classifier.known_ids) for profile in PROFILES
    ]
    assert known_counts == sorted(known_counts)
    assert known_counts[0] < known_counts[1] < known_counts[2]


def test_selection_given_advanced_profile_expect_base_bounded_measurement_full() -> (
    None
):
    """R-011: above the prompt-vocabulary bound the base is bounded and
    characterized, while the classifier still measures the full vocabulary."""
    advanced = next(p for p in PROFILES if p.name == "advanced")
    deck = _big_deck()
    selection = build_selection(advanced, deck)
    bound = settings.STORY_GENERATION_PROMPT_VOCABULARY_BOUND

    assert len(selection.classifier.known_ids) > bound
    assert selection.base_truncated is True
    assert len(selection.base_words) <= bound
    assert len(selection.classifier.known_ids) == advanced.mastered_rank


def test_selection_given_each_profile_expect_targets_unknown_and_length_derived() -> (
    None
):
    """R-010: targets are drawn from beyond the learner's knowledge and the
    count derives from length, never a free parameter."""
    deck = _big_deck()
    for profile in PROFILES:
        selection = build_selection(profile, deck)
        assert len(selection.target_words) == derive_target_count(
            profile.requested_length
        )
        assert len(selection.target_words) == len(selection.target_lemma_ids)
        comprehensible = selection.classifier.comprehensible_ids
        assert all(
            target_id not in comprehensible for target_id in selection.target_lemma_ids
        )


# --- pipeline, driven from captured responses ---


async def test_evaluate_profile_given_success_fixture_expect_ready_record_with_all_signals(
    prices: tuple[float, float],
) -> None:
    """R-009/R-007: a successful generation emits the same signals recorded in
    production — unresolved share, both composition axes, produced vs requested
    length, target occurrences including zeroes, tokens, and the cost the
    provider reported."""
    provider = StubProvider(lambda request: _result_from_fixture("success_plain.json"))

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, prices, CostSource.PRICING
    )

    assert record["outcome"] == "ready"
    assert record["provider"] == "openrouter"
    assert record["model"] == provider.model
    assert record["produced_length"] == EXPECTED_PRODUCED_LENGTH
    assert record["produced_ratio"] == round(EXPECTED_PRODUCED_LENGTH / 250, 3)
    assert record["unresolved_token_rate"] == EXPECTED_UNRESOLVED_TOKEN_RATE
    assert record["lexical_token_count"] == EXPECTED_LEXICAL_TOKEN_COUNT
    assert record["mastered_token_count"] == EXPECTED_MASTERED_TOKEN_COUNT
    assert record["in_progress_token_count"] == EXPECTED_IN_PROGRESS_TOKEN_COUNT
    assert record["unknown_token_count"] == EXPECTED_UNKNOWN_TOKEN_COUNT
    assert record["mastered_lemma_count"] == EXPECTED_MASTERED_LEMMA_COUNT
    assert record["in_progress_lemma_count"] == EXPECTED_IN_PROGRESS_LEMMA_COUNT
    assert record["unknown_lemma_count"] == EXPECTED_UNKNOWN_LEMMA_COUNT
    assert record["prompt_tokens"] == EXPECTED_PROMPT_TOKENS
    assert record["completion_tokens"] == EXPECTED_COMPLETION_TOKENS
    assert record["cost_usd"] == _load_fixture("success_plain.json")["usage"]["cost"]
    assert record["cost_source"] == CostSource.PROVIDER
    assert record["reasoning_tokens"] == 0
    assert record["requested_targets"] == len(record["target_occurrences"])
    assert all(count == 0 for count in record["target_occurrences"].values()), (
        "a target that never appears is the informative case"
    )
    assert record["text"].startswith("Det var en stor")
    assert provider.requests[0].max_tokens == 250 * 3


async def test_evaluate_profile_given_markup_fixture_expect_measurement_on_cleaned_text(
    prices: tuple[float, float],
) -> None:
    """R-016: markup a real provider emitted is stripped before normalization, so
    measurement and the recorded text never carry markup."""
    provider = StubProvider(
        lambda request: _result_from_fixture("markdown_emitted.json")
    )

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, prices, CostSource.PRICING
    )

    assert "*" not in record["text"]
    assert "_" not in record["text"]
    assert "stor" in record["text"]


async def test_evaluate_profile_given_empty_content_fixture_expect_failed_record_without_quality(
    prices: tuple[float, float],
) -> None:
    """R-104: a provider returning empty content fails the generation and leaves
    no fabricated quality numbers or partial text."""
    provider = StubProvider(
        lambda request: _result_from_fixture("reasoning_empty_content.json")
    )

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, prices, CostSource.PRICING
    )

    assert record["outcome"] == "failed"
    assert record["failure_class"] == "transient"
    assert "text" not in record
    assert record["cost_usd"] is None
    assert record["cost_source"] is None
    assert record["reasoning_tokens"] is None
    assert all(
        record[key] is None
        for key in (
            "unresolved_token_rate",
            "mastered_token_count",
            "unknown_token_count",
            "target_occurrences",
        )
    )


async def test_run_evaluation_given_stub_provider_expect_record_per_profile(
    db, prices: tuple[float, float]
) -> None:
    """R-009: the harness runs every fixed profile, emitting one record each."""
    await _seed_frequency_deck(db)
    provider = StubProvider(lambda request: _result_from_fixture("success_plain.json"))

    records = await run_evaluation(db, provider, prices, CostSource.PRICING)

    assert [record["profile"] for record in records] == [p.name for p in PROFILES]
    assert all(record["outcome"] == "ready" for record in records)
    assert all(record["model"] == provider.model for record in records)


# --- cost and output ---


def test_derive_cost_given_token_counts_expect_priced_from_table() -> None:
    """Cost is derived from token counts and per-token prices, not provider-reported."""
    prices = MODEL_PRICING_USD_PER_M["deepseek/deepseek-v4-flash-0731"]
    assert _derive_cost(150, 428, prices) == _expected_cost(150, 428, prices)


def test_derive_cost_given_missing_token_counts_expect_none() -> None:
    prices = MODEL_PRICING_USD_PER_M["deepseek/deepseek-v4-flash-0731"]
    assert _derive_cost(None, 428, prices) is None
    assert _derive_cost(150, None, prices) is None


async def test_format_records_given_records_expect_human_readable_table(
    db,
) -> None:
    provider = StubProvider(lambda request: _result_from_fixture("success_plain.json"))
    await _seed_frequency_deck(db)
    records = await run_evaluation(
        db, provider, MODEL_PRICING_USD_PER_M[provider.model], CostSource.PRICING
    )

    table = format_records(records)

    assert "profile" in table
    assert "unres%" in table
    assert "cost $" in table
    assert "reason" in table
    assert "src" in table
    assert all(profile.name in table for profile in PROFILES)


def test_format_records_given_failed_record_expect_report_still_emitted() -> None:
    """R-009: a failed profile carries no quality signals, so formatting must
    not dereference them; the report still emits a row for the failure."""
    record = {
        "profile": "beginner",
        "outcome": "failed",
        "failure_class": "timeout",
        "requested_length": 250,
        "latency_ms": 1000,
        "cost_usd": None,
        "cost_source": None,
        "reasoning_tokens": None,
        "model": "test-model",
        "unresolved_token_rate": None,
        "mastered_token_count": None,
        "in_progress_token_count": None,
        "unknown_token_count": None,
    }

    table = format_records([record])

    assert "failed" in table
    assert "beginner" in table
    assert "test-model" in table


async def test_payload_given_records_expect_json_serializable_with_limitation(
    db,
) -> None:
    """The machine-readable output is diffable JSON and makes the no-verdict
    limitation explicit."""
    provider = StubProvider(lambda request: _result_from_fixture("success_plain.json"))
    prices = MODEL_PRICING_USD_PER_M[provider.model]
    await _seed_frequency_deck(db)
    records = await run_evaluation(db, provider, prices, CostSource.FALLBACK)
    payload = _build_payload(
        records, provider, prices, CostSource.FALLBACK, Path("out.json")
    )

    serialized = json.dumps(payload)
    assert payload["limitation"] == LIMITATION
    assert payload["cost_source"] == CostSource.FALLBACK
    for record in payload["profiles"]:
        assert all(isinstance(key, str) for key in record["target_occurrences"])
        assert record["cost_source"] == CostSource.PROVIDER
        assert record["reasoning_tokens"] == 0
    assert all(profile.name in serialized for profile in PROFILES)


# --- cost provenance and reasoning tokens ---


async def test_evaluate_profile_given_provider_cost_expect_provider_figure_used() -> (
    None
):
    """Cost provenance: the provider's own usage.cost is used verbatim when
    present, never re-derived from a pricing table."""
    body = _load_fixture("success_plain.json")
    provider = StubProvider(lambda request: _result_from_fixture("success_plain.json"))

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, (0.0, 0.0), CostSource.FALLBACK
    )

    assert record["cost_usd"] == body["usage"]["cost"]
    assert record["cost_source"] == CostSource.PROVIDER


async def test_evaluate_profile_given_missing_provider_cost_expect_fetched_pricing_used() -> (
    None
):
    """Cost provenance: without usage.cost the harness derives cost from the
    live-fetched price list, labeled pricing."""
    fetched = (0.14, 0.28)
    provider = StubProvider(
        lambda request: _result_from_fixture_without_cost("success_plain.json")
    )

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, fetched, CostSource.PRICING
    )

    assert record["cost_usd"] == _expected_cost(151, 102, fetched)
    assert record["cost_source"] == CostSource.PRICING


async def test_evaluate_profile_given_missing_provider_cost_expect_approximate_fallback_labeled() -> (
    None
):
    """Cost provenance: with neither usage.cost nor fetched pricing the last
    resort is the approximate literal table, labeled fallback."""
    table = MODEL_PRICING_USD_PER_M["deepseek/deepseek-v4-flash-0731"]
    provider = StubProvider(
        lambda request: _result_from_fixture_without_cost("success_plain.json")
    )

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, table, CostSource.FALLBACK
    )

    assert record["cost_usd"] == _expected_cost(151, 102, table)
    assert record["cost_source"] == CostSource.FALLBACK


async def test_evaluate_profile_given_reasoning_fixture_expect_reasoning_tokens_surfaced() -> (
    None
):
    """Reasoning tokens are billed at the completion rate and drove the largest
    cost swing found; they surface per generation, never hidden."""
    provider = StubProvider(lambda request: _result_from_fixture("reasoning_on.json"))

    record = await evaluate_profile(
        _fixture_deck(), PROFILES[0], provider, (0.0, 0.0), CostSource.PROVIDER
    )

    assert record["reasoning_tokens"] == EXPECTED_REASONING_TOKENS
    assert record["cost_source"] == CostSource.PROVIDER


async def test_fetch_model_pricing_given_models_directory_expect_price_map() -> None:
    """The live price list is parsed into a (input, output) per-million map,
    skipping entries without a full pricing block. OpenRouter publishes USD per
    token (e.g. ``0.00000014``), so the map normalizes to USD per million at the
    point of fetch, matching the literal fallback table."""
    body = {
        "data": [
            {
                "id": "deepseek/deepseek-v4-flash",
                "pricing": {"prompt": "0.00000014", "completion": "0.00000028"},
            },
            {
                "id": "deepseek/deepseek-v4-flash-0731",
                "pricing": {"prompt": "0.00000008", "completion": "0.00000018"},
            },
            {"id": "partial/rates", "pricing": {"prompt": "0.10"}},
            "not-a-dict",
        ]
    }
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    )

    async with client:
        pricing = await _fetch_model_pricing(client)

    assert pricing["deepseek/deepseek-v4-flash"] == (0.14, 0.28)
    assert pricing["deepseek/deepseek-v4-flash-0731"] == (0.08, 0.18)
    assert "partial/rates" not in pricing


async def test_fetch_model_pricing_given_realistic_openrouter_payload_expect_sane_derived_cost() -> (
    None
):
    """R-009: a realistic per-token OpenRouter payload derives a sane per-story
    cost after normalization — cents, never thousands of dollars."""
    body = {
        "data": [
            {
                "id": "deepseek/deepseek-v4-flash",
                "pricing": {"prompt": "0.00000014", "completion": "0.00000028"},
            }
        ]
    }
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    )

    async with client:
        pricing = await _fetch_model_pricing(client)

    cost = _derive_cost(150, 428, pricing["deepseek/deepseek-v4-flash"])

    assert cost is not None
    assert 0 < cost < 1


def test_resolve_prices_given_fetched_entry_expect_fetched_pricing_source() -> None:
    args = parse_args(["--model", "deepseek/deepseek-v4-flash-0731"])

    prices, source = _resolve_prices(
        args, {"deepseek/deepseek-v4-flash-0731": (0.08, 0.18)}
    )

    assert prices == (0.08, 0.18)
    assert source == CostSource.PRICING


def test_resolve_prices_given_cli_override_expect_override_source() -> None:
    args = parse_args(
        [
            "--model",
            "nope/none",
            "--price-prompt",
            "1.0",
            "--price-completion",
            "2.0",
        ]
    )

    prices, source = _resolve_prices(args, {})

    assert prices == (1.0, 2.0)
    assert source == CostSource.OVERRIDE


def test_resolve_prices_given_only_table_entry_expect_fallback_source() -> None:
    args = parse_args(["--model", "deepseek/deepseek-v4-flash"])

    prices, source = _resolve_prices(args, {})

    assert prices == MODEL_PRICING_USD_PER_M["deepseek/deepseek-v4-flash"]
    assert source == CostSource.FALLBACK


def test_resolve_prices_given_unknown_model_expect_exit() -> None:
    args = parse_args(["--model", "nope/none"])

    with pytest.raises(SystemExit):
        _resolve_prices(args, {})
