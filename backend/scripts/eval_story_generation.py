#!/usr/bin/env python3
"""Offline evaluation harness for story generation (R-009).

Runs the production generation pipeline — vocabulary selection, prompt
construction, provider call, markup stripping, normalization, pagination, and
``quality.measure`` — against the fixed synthetic profiles in ``eval_profiles``,
then emits the same signals recorded in production plus the cost the provider
reported, falling back to derived-from-token-count pricing only when the
provider omits it. A model, provider, or prompt change can be judged against
identical inputs before release.

Measured live on one identical prompt (launch baseline):

| model | $/gen | words (asked 250) | outTok | latency |
|---|---|---|---|---|
| deepseek/deepseek-v4-flash-0731 | $0.000131 | 255 | 428 | 60.1s |
| deepseek/deepseek-v4-flash (reasoning off) | $0.000096 | 216 | 366 | 7.9s |
| openai/gpt-5.6-luna | $0.0032 | 249 | 5,300 | 58.2s |
| openai/gpt-5.6-terra | $0.0334 | 250 | 5,512 | 82.8s |
| openai/gpt-5.6-sol | $0.0432 | 250 | 1,394 | 38.4s |
| z-ai/glm-5.2 | $0.0491 | 250 | 20,203 | 104.2s |

Provider default reasoning is nondeterministic: the same prompt produced 6,857
reasoning tokens on one call and 0 on the next two — a 27x cost swing — which is
why reasoning is disabled by default. Pass ``--reasoning`` to turn it on.

No verdict: these numbers rank models on length and target coverage only, not on
whether the output is Norwegian. Live sampling showed three models hit the
requested length with clean target counts while producing markedly worse
Norwegian, and one produced fluent prose containing ``Barnet var liten`` — a
neuter agreement error (``barn`` is neuter, so ``lite``) that every signal in
the set reports as healthy. A human must read the sampled text; this report
informs that reading, it does not replace it.

Usage::

    uv run python scripts/eval_story_generation.py --model deepseek/deepseek-v4-flash-0731

Requires ``OPENROUTER_API_KEY`` (the settings validator fails loudly without it).
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict
from enum import StrEnum
import json
from datetime import datetime
from datetime import UTC
import httpx
from pathlib import Path
import sys
import time
from typing import Any
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.story_generation.constants import K_ESTIMATED_OUTPUT_TOKENS_PER_WORD
from flyt.apps.story_generation.eval_profiles import PROFILES
from flyt.apps.story_generation.eval_profiles import build_pages
from flyt.apps.story_generation.eval_profiles import build_selection
from flyt.apps.story_generation.eval_profiles import EvalDeck
from flyt.apps.story_generation.eval_profiles import EvalProfile
from flyt.apps.story_generation.eval_profiles import load_eval_deck
from flyt.apps.story_generation.prompt import build_prompt
from flyt.apps.story_generation.prompt import strip_markup
from flyt.apps.story_generation.quality import measure
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.reading.import_text import word_count
from flyt.apps.story_generation.vocabulary import VocabularySelection
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderFailure
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "artifacts" / "eval" / "story_generation.json"

# (input, output) USD per million tokens, keyed by model id. Last resort only:
# the provider's per-request usage.cost wins, then the live model list fetched
# from OpenRouter. These literals drift when a provider reprices; treat them as
# approximate. Override with --price-prompt/--price-completion.
MODEL_PRICING_USD_PER_M: dict[str, tuple[float, float]] = {
    "deepseek/deepseek-v4-flash-0731": (0.08, 0.18),
    "deepseek/deepseek-v4-flash": (0.14, 0.28),
    "openai/gpt-5.6-luna": (2.50, 5.00),
    "openai/gpt-5.6-terra": (5.00, 20.00),
    "openai/gpt-5.6-sol": (6.00, 30.00),
    "z-ai/glm-5.2": (0.30, 2.50),
}

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


class CostSource(StrEnum):
    PROVIDER = "provider"
    OVERRIDE = "override"
    PRICING = "pricing"
    FALLBACK = "fallback"


LIMITATION = (
    "These signals rank models on length, vocabulary composition, and target "
    "coverage only. They do not judge whether the output is Norwegian, and they "
    "report healthy on constructions a native reader rejects: live sampling "
    "showed fluent prose containing 'Barnet var liten' (barn is neuter; lite) "
    "scoring clean on every signal. A model swap must be decided by a human "
    "reading the sampled text, not by these numbers. No verdict is implied."
)

QUALITY_KEYS: tuple[str, ...] = (
    "lexical_token_count",
    "unresolved_token_rate",
    "mastered_lemma_count",
    "in_progress_lemma_count",
    "unknown_lemma_count",
    "mastered_token_count",
    "in_progress_token_count",
    "unknown_token_count",
    "target_occurrences",
)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate story generation against fixed synthetic profiles."
    )
    parser.add_argument(
        "--model",
        required=True,
        help="OpenRouter model id, e.g. deepseek/deepseek-v4-flash-0731",
    )
    parser.add_argument("--provider", default="openrouter", choices=["openrouter"])
    parser.add_argument(
        "--output",
        default=None,
        help=f"JSON output path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--reasoning",
        action="store_true",
        help="Enable provider reasoning (nondeterministic; off by default)",
    )
    parser.add_argument(
        "--price-prompt",
        type=float,
        default=None,
        help="Prompt-token price in USD per million tokens, overriding all derived pricing",
    )
    parser.add_argument(
        "--price-completion",
        type=float,
        default=None,
        help="Completion-token price in USD per million tokens, overriding all derived pricing",
    )
    return parser.parse_args(argv)


def _safe_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


async def _fetch_model_pricing(
    client: httpx.AsyncClient,
) -> dict[str, tuple[float, float]]:
    """Price by model id from the live OpenRouter model directory."""
    response = await client.get(OPENROUTER_MODELS_URL)
    response.raise_for_status()
    try:
        data = response.json().get("data")
    except ValueError:
        return {}
    pricing: dict[str, tuple[float, float]] = {}
    if not isinstance(data, list):
        return pricing
    for entry in data:
        if not isinstance(entry, dict):
            continue
        model_id = entry.get("id")
        rates = entry.get("pricing")
        if not isinstance(model_id, str) or not isinstance(rates, dict):
            continue
        prompt = _safe_float(rates.get("prompt"))
        completion = _safe_float(rates.get("completion"))
        if prompt is not None and completion is not None:
            # OpenRouter publishes USD per token (e.g. 0.00000014); the rest of
            # the harness prices in USD per million tokens, matching the literal
            # fallback table, so convert at the point of fetch.
            pricing[model_id] = (prompt * 1_000_000, completion * 1_000_000)
    return pricing


async def _fetch_pricing_or_empty() -> dict[str, tuple[float, float]]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            return await _fetch_model_pricing(client)
    except httpx.HTTPError:
        return {}


def _resolve_prices(
    args: argparse.Namespace,
    fetched: dict[str, tuple[float, float]],
) -> tuple[tuple[float, float], CostSource]:
    if args.price_prompt is not None and args.price_completion is not None:
        return (args.price_prompt, args.price_completion), CostSource.OVERRIDE
    if args.model in fetched:
        return fetched[args.model], CostSource.PRICING
    if args.model in MODEL_PRICING_USD_PER_M:
        return MODEL_PRICING_USD_PER_M[args.model], CostSource.FALLBACK
    raise SystemExit(
        f"no pricing for '{args.model}'; pass --price-prompt and "
        "--price-completion in USD per million tokens"
    )


def _derive_cost(
    prompt_tokens: int | None,
    completion_tokens: int | None,
    prices: tuple[float, float],
) -> float | None:
    if prompt_tokens is None or completion_tokens is None:
        return None
    input_per_m, output_per_m = prices
    cost = (
        prompt_tokens * input_per_m / 1_000_000
        + completion_tokens * output_per_m / 1_000_000
    )
    return round(cost, 6)


def _base_record(
    profile: EvalProfile,
    selection: VocabularySelection,
    provider: ModelProvider,
    *,
    outcome: str,
    failure_class: str | None,
    latency_ms: int,
    prompt_tokens: int | None,
    completion_tokens: int | None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "profile": profile.name,
        "anchor": profile.anchor.value if profile.anchor else None,
        "requested_length": profile.requested_length,
        "requested_targets": len(selection.target_lemma_ids),
        "target_words": selection.target_words,
        "base_words_sent": len(selection.base_words),
        "base_truncated": selection.base_truncated,
        "provider": provider.name,
        "model": provider.model,
        "outcome": outcome,
        "failure_class": failure_class,
        "latency_ms": latency_ms,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": None,
        "cost_source": None,
        "reasoning_tokens": None,
    }
    record.update({key: None for key in QUALITY_KEYS})
    return record


async def evaluate_profile(
    deck: EvalDeck,
    profile: EvalProfile,
    provider: ModelProvider,
    prices: tuple[float, float],
    price_source: CostSource,
) -> dict[str, Any]:
    """Generate and measure one profile, reusing the production pipeline."""
    selection = build_selection(profile, deck)
    prompt = build_prompt(
        base_words=selection.base_words,
        target_words=selection.target_words,
        length=profile.requested_length,
        topic=profile.topic,
        base_truncated=selection.base_truncated,
    )
    request = GenerationRequest(
        instructions=prompt.instructions,
        prompt=prompt.prompt,
        max_tokens=profile.requested_length * K_ESTIMATED_OUTPUT_TOKENS_PER_WORD,
    )
    start = time.monotonic()
    try:
        result = await provider.generate(0, request)
    except ProviderFailure as exc:
        return _base_record(
            profile,
            selection,
            provider,
            outcome="failed",
            failure_class=exc.failure_class.value,
            latency_ms=int((time.monotonic() - start) * 1000),
            prompt_tokens=None,
            completion_tokens=None,
        )
    latency_ms = int((time.monotonic() - start) * 1000)

    normalized = normalize_text(strip_markup(result.text))
    pages = await build_pages(normalized, deck)
    quality = measure(
        pages, selection.classifier, deck.uuid_to_id, selection.target_lemma_ids
    )
    produced = word_count(normalized)

    record = _base_record(
        profile,
        selection,
        provider,
        outcome="ready",
        failure_class=None,
        latency_ms=latency_ms,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )
    record.update(asdict(quality))
    record["target_occurrences"] = {
        str(target_id): occurrences
        for target_id, occurrences in quality.target_occurrences.items()
    }
    record["produced_length"] = produced
    record["produced_ratio"] = round(produced / profile.requested_length, 3)
    record["reasoning_tokens"] = result.reasoning_tokens
    if result.cost is not None:
        record["cost_usd"] = result.cost
        record["cost_source"] = CostSource.PROVIDER
    else:
        derived = _derive_cost(result.prompt_tokens, result.completion_tokens, prices)
        if derived is not None:
            record["cost_usd"] = derived
            record["cost_source"] = price_source
    record["text"] = normalized
    return record


async def run_evaluation(
    db: AsyncSession,
    provider: ModelProvider,
    prices: tuple[float, float],
    price_source: CostSource,
) -> list[dict[str, Any]]:
    decks = {profile.name: await load_eval_deck(db, profile) for profile in PROFILES}
    return [
        await evaluate_profile(
            decks[profile.name], profile, provider, prices, price_source
        )
        for profile in PROFILES
    ]


def format_records(records: list[dict[str, Any]]) -> str:
    header = (
        f"{'profile':<10}{'outcome':<8}{'words':>6}{'req':>5}{'ratio':>7}"
        f"{'unres%':>8}{'m/i/u tok':>12}{'tgt hit':>8}{'latency':>9}"
        f"{'cost $':>10}{'reason':>7}{'src':>9} model"
    )
    rows = [header]
    for record in records:
        target_hits = "-"
        if record.get("target_occurrences") is not None:
            target_hits = str(
                sum(1 for count in record["target_occurrences"].values() if count)
            )
        miu = "-"
        if record["mastered_token_count"] is not None:
            miu = (
                f"{record['mastered_token_count']}/"
                f"{record['in_progress_token_count']}/"
                f"{record['unknown_token_count']}"
            )
        ratio = "-"
        if record.get("produced_ratio") is not None:
            ratio = f"{record['produced_ratio']:.2f}"
        unres = "-"
        if record["unresolved_token_rate"] is not None:
            unres = f"{record['unresolved_token_rate'] * 100:.1f}"
        reason = (
            record["reasoning_tokens"]
            if record["reasoning_tokens"] is not None
            else "-"
        )
        src = record["cost_source"] if record["cost_source"] is not None else "-"
        rows.append(
            f"{record['profile']:<10}{record['outcome']:<8}"
            f"{record.get('produced_length') or '-':>6}"
            f"{record['requested_length']:>5}{ratio:>7}{unres:>8}{miu:>12}"
            f"{target_hits:>8}{record['latency_ms']:>9}"
            f"{record['cost_usd'] if record['cost_usd'] is not None else '-':>10}"
            f"{reason:>7}{src:>9} {record['model']}"
        )
    return "\n".join(rows)


def _build_payload(
    records: list[dict[str, Any]],
    provider: ModelProvider,
    prices: tuple[float, float],
    price_source: CostSource,
    output: Path,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "provider": provider.name,
        "model": provider.model,
        "reasoning_enabled": bool(
            settings.STORY_GENERATION_OPENROUTER_REASONING_ENABLED
        ),
        "prices_usd_per_m": {"input": prices[0], "output": prices[1]},
        "cost_source": price_source,
        "limitation": LIMITATION,
        "profiles": records,
    }


async def _run(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    settings.STORY_GENERATION_OPENROUTER_MODEL = args.model
    if args.reasoning:
        settings.STORY_GENERATION_OPENROUTER_REASONING_ENABLED = True

    fetched = (
        {}
        if args.price_prompt is not None and args.price_completion is not None
        else await _fetch_pricing_or_empty()
    )
    prices, price_source = _resolve_prices(args, fetched)
    provider = OpenRouterProvider()
    async with AsyncSessionLocal() as db:
        records = await run_evaluation(db, provider, prices, price_source)

    print(format_records(records))
    print()
    print(LIMITATION)

    output = Path(args.output) if args.output else DEFAULT_OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            _build_payload(records, provider, prices, price_source, output),
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nWrote {output}")
    return 0


def main(argv: Sequence[str] | None = None) -> None:
    try:
        asyncio.run(_run(argv))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
