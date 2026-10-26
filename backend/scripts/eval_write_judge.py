#!/usr/bin/env python3
"""Entry point: offline calibration harness for the lesson write judge (P2).

Validates a producer-owned portable calibration bank and plans a bounded and
reproducible set of judge calls against the production criteria-only prompt.

The harness never touches the database or the API and never calls a provider
unless ``--approve-live`` is passed. Seed-provenance labels stay non-approvable
and are excluded from a live run unless ``--allow-seed-labels`` authorizes them.

Usage::

    uv run python scripts/eval_write_judge.py --input bank.json
    uv run python scripts/eval_write_judge.py --input bank.json \
        --approve-live --output reports/eval_write_judge.json
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
import json
from pathlib import Path
import re
import sys
from typing import Any
from typing import NoReturn

from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import ProviderFailure
from flyt.core.config import settings
from flyt.evaluation.service import EvaluationCase
from flyt.evaluation.service import EvaluationCriterion
from flyt.evaluation.service import EvaluationService
from flyt.evaluation.service import EvaluationUnavailableError
from flyt.libs.utils.date import now_aware

K_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
K_REPORTS_DIRNAME = "reports"
K_SCHEMA_VERSION = "1.1"
K_DEFAULT_REPETITIONS = 3
K_VARIANT = "criteria_only"
K_EXPECTED_LABELS = ("pass", "fail")
K_MAX_FALSE_ACCEPT_RATE = 0.0
K_MAX_FALSE_REJECT_RATE = 0.0
K_BOUNDED_ID_SAMPLE = 20
K_READINESS_SEED_PENDING = "seed_pending_human_review"
K_READINESS_HUMAN_REVIEWED = "human_reviewed"
K_ALLOWED_LABEL_PROVENANCE = frozenset(
    {K_READINESS_SEED_PENDING, K_READINESS_HUMAN_REVIEWED}
)
K_LIVE_NOT_APPROVED_EXIT_CODE = 1

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_BANK_KEYS = frozenset(
    {
        "schema_version",
        "bank_sha256",
        "label_state",
        "dev_anchors",
        "holdout_cases",
    }
)
_LABEL_STATE_KEYS = frozenset(
    {
        "readiness",
        "approvable",
        "pending_seed_case_ids",
        "provenance_counts",
    }
)
_CRITERION_KEYS = frozenset({"id", "instruction", "gating"})
_CASE_KEYS = frozenset(
    {
        "case_id",
        "archetype",
        "error_class",
        "split",
        "expected_label",
        "dimension",
        "source",
        "label_provenance",
        "task",
        "judge_instructions",
        "criteria",
        "stimulus",
        "response",
        "stressors",
        "primary_failed_criterion",
    }
)


class InputValidationError(ValueError):
    """The portable calibration bank is malformed or self-inconsistent."""


@dataclass(frozen=True)
class Criterion:
    id: str
    instruction: str
    gating: bool


@dataclass(frozen=True)
class Case:
    case_id: str
    archetype: str
    error_class: str
    split: str
    expected_label: str
    dimension: str
    source: str
    label_provenance: str
    task: str
    judge_instructions: str
    criteria: tuple[Criterion, ...]
    stimulus: str | None
    response: str
    anchor_case_ids: tuple[str, ...]
    stressors: tuple[str, ...]
    primary_failed_criterion: str | None


@dataclass(frozen=True)
class LabelState:
    readiness: str
    approvable: bool
    pending_seed_case_ids: tuple[str, ...]
    provenance_counts: dict[str, int]


@dataclass(frozen=True)
class Bank:
    schema_version: str
    bank_sha256: str
    label_state: LabelState
    dev_anchors: tuple[Case, ...]
    holdout_cases: tuple[Case, ...]


def parse_bank(raw: Any) -> Bank:
    mapping = _require_mapping(raw, "$")
    _reject_unknown_keys(mapping, _BANK_KEYS, "$")
    schema_version = _parse_schema_version(
        _required(mapping, "schema_version", "$"), "$.schema_version"
    )
    bank_sha256 = _require_str(_required(mapping, "bank_sha256", "$"), "$.bank_sha256")
    if not _SHA256_RE.fullmatch(bank_sha256):
        _fail("$.bank_sha256", "expected a lowercase 64-character hex digest")
    dev_anchors = tuple(
        _parse_case(item, f"$.dev_anchors[{index}]", split="dev")
        for index, item in enumerate(
            _require_list(_required(mapping, "dev_anchors", "$"), "$.dev_anchors")
        )
    )
    holdout_cases = tuple(
        _parse_case(item, f"$.holdout_cases[{index}]", split="holdout")
        for index, item in enumerate(
            _require_list(_required(mapping, "holdout_cases", "$"), "$.holdout_cases")
        )
    )
    if not holdout_cases:
        _fail("$.holdout_cases", "expected at least one case")
    _validate_unique_case_ids(dev_anchors, holdout_cases)
    _validate_anchor_references(dev_anchors, holdout_cases)
    _validate_label_classes(dev_anchors, holdout_cases)
    label_state = _parse_label_state(
        _required(mapping, "label_state", "$"),
        "$.label_state",
        (*dev_anchors, *holdout_cases),
    )
    return Bank(
        schema_version=schema_version,
        bank_sha256=bank_sha256,
        label_state=label_state,
        dev_anchors=dev_anchors,
        holdout_cases=holdout_cases,
    )


def load_bank(path: Path) -> Bank:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        raise InputValidationError(f"{path}: {error}") from error
    try:
        raw = json.loads(text)
    except ValueError as error:
        raise InputValidationError(f"{path}: invalid JSON: {error}") from error
    return parse_bank(raw)


def is_seed_case(case: Case, label_state: LabelState) -> bool:
    return case.case_id in label_state.pending_seed_case_ids or _is_seed_provenance(
        case.label_provenance
    )


def select_cases(
    bank: Bank, *, include_dev: bool, allow_seed_labels: bool
) -> tuple[tuple[Case, ...], tuple[str, ...]]:
    pool: list[Case] = []
    if include_dev:
        pool.extend(bank.dev_anchors)
    pool.extend(bank.holdout_cases)
    seed_cases = [case for case in pool if is_seed_case(case, bank.label_state)]
    if allow_seed_labels:
        return tuple(pool), ()
    return (
        tuple(case for case in pool if not is_seed_case(case, bank.label_state)),
        tuple(case.case_id for case in seed_cases),
    )


def build_evaluation_case(case: Case) -> EvaluationCase:
    return EvaluationCase(
        instructions=case.judge_instructions,
        task=case.task,
        response=case.response,
        criteria=tuple(
            EvaluationCriterion(id=criterion.id, instruction=criterion.instruction)
            for criterion in case.criteria
        ),
    )


def classify_predicted_label(
    verdicts: Sequence[Any], criteria: tuple[Criterion, ...]
) -> str:
    by_id = {verdict.criterion_id: verdict for verdict in verdicts}
    gating = [criterion for criterion in criteria if criterion.gating]
    met = all(by_id[criterion.id].met for criterion in gating)
    return "pass" if met else "fail"


async def evaluate_run(
    service: EvaluationService,
    case: Case,
    run_index: int,
) -> dict[str, Any]:
    evaluation_case = build_evaluation_case(case)
    try:
        verdicts = await service.evaluate(0, evaluation_case)
    except EvaluationUnavailableError as error:
        outcome = (
            "provider_outage"
            if isinstance(error.__cause__, ProviderFailure)
            else "invalid_response"
        )
        return {
            "run": run_index,
            "outcome": outcome,
            "predicted_label": None,
            "verdicts": None,
        }
    return {
        "run": run_index,
        "outcome": "evaluated",
        "predicted_label": classify_predicted_label(verdicts, case.criteria),
        "verdicts": [
            {
                "criterion_id": verdict.criterion_id,
                "met": verdict.met,
                "evidence": verdict.evidence,
            }
            for verdict in verdicts
        ],
    }


def tally_runs(case_reports: Sequence[dict[str, Any]]) -> dict[str, int]:
    counts = _empty_counts()
    for case_report in case_reports:
        expected = case_report["expected_label"]
        for run in case_report["runs"]:
            outcome = run["outcome"]
            if outcome == "evaluated":
                counts["evaluated"] += 1
                if expected == "fail":
                    counts["expected_fail"] += 1
                    if run["predicted_label"] == "pass":
                        counts["false_accept"] += 1
                else:
                    counts["expected_pass"] += 1
                    if run["predicted_label"] == "fail":
                        counts["false_reject"] += 1
            elif outcome == "invalid_response":
                counts["invalid_response"] += 1
            else:
                counts["provider_outage"] += 1
    return counts


def metrics_for_runs(counts: dict[str, int], planned_runs: int) -> dict[str, Any]:
    return {
        "planned_runs": planned_runs,
        "evaluated_runs": counts["evaluated"],
        "invalid_response_count": counts["invalid_response"],
        "provider_outage_count": counts["provider_outage"],
        "expected_pass_runs": counts["expected_pass"],
        "expected_fail_runs": counts["expected_fail"],
        "false_accept_count": counts["false_accept"],
        "false_reject_count": counts["false_reject"],
        "false_accept_rate": _rate(counts["false_accept"], counts["expected_fail"]),
        "false_reject_rate": _rate(counts["false_reject"], counts["expected_pass"]),
        "coverage_complete": counts["evaluated"] == planned_runs,
    }


def per_archetype_metrics(
    case_reports: Sequence[dict[str, Any]], repetitions: int
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for case_report in case_reports:
        grouped.setdefault(case_report["archetype"], []).append(case_report)
    metrics_by_archetype: dict[str, dict[str, Any]] = {}
    for archetype, reports in sorted(grouped.items()):
        metrics = metrics_for_runs(tally_runs(reports), len(reports) * repetitions)
        metrics["per_polarity"] = per_polarity_metrics(reports, repetitions)
        metrics_by_archetype[archetype] = metrics
    return metrics_by_archetype


def per_polarity_metrics(
    case_reports: Sequence[dict[str, Any]], repetitions: int
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for case_report in case_reports:
        grouped.setdefault(case_report["expected_label"], []).append(case_report)
    return {
        expected_label: metrics_for_runs(
            tally_runs(reports), len(reports) * repetitions
        )
        for expected_label, reports in sorted(grouped.items())
    }


def is_gate_passed(metrics: dict[str, Any], thresholds: dict[str, float]) -> bool:
    return (
        _has_clean_runs(metrics)
        and metrics["expected_pass_runs"] > 0
        and metrics["expected_fail_runs"] > 0
        and _is_rate_within_threshold(
            metrics["false_accept_rate"], thresholds["max_false_accept_rate"]
        )
        and _is_rate_within_threshold(
            metrics["false_reject_rate"], thresholds["max_false_reject_rate"]
        )
    )


def is_archetype_gate_passed(
    metrics: dict[str, Any], thresholds: dict[str, float]
) -> bool:
    per_polarity = metrics["per_polarity"]
    has_both_polarities = ("pass" in per_polarity) and ("fail" in per_polarity)
    return (
        _has_clean_runs(metrics)
        and has_both_polarities
        and _is_rate_within_threshold_or_absent(
            metrics["false_accept_rate"], thresholds["max_false_accept_rate"]
        )
        and _is_rate_within_threshold_or_absent(
            metrics["false_reject_rate"], thresholds["max_false_reject_rate"]
        )
        and all(
            is_polarity_gate_passed(bucket)
            for bucket in metrics["per_polarity"].values()
        )
    )


def is_polarity_gate_passed(metrics: dict[str, Any]) -> bool:
    return (
        metrics["planned_runs"] > 0
        and _has_clean_runs(metrics)
        and metrics["false_accept_count"] == 0
        and metrics["false_reject_count"] == 0
    )


async def run_cases(
    service: EvaluationService,
    bank: Bank,
    cases: tuple[Case, ...],
    repetitions: int,
) -> dict[str, Any]:
    case_reports: list[dict[str, Any]] = []
    for case in cases:
        runs = [
            await evaluate_run(service, case, run_index)
            for run_index in range(repetitions)
        ]
        case_reports.append(
            {
                "case_id": case.case_id,
                "archetype": case.archetype,
                "expected_label": case.expected_label,
                "seed_label": is_seed_case(case, bank.label_state),
                "runs": runs,
            }
        )
    metrics = metrics_for_runs(tally_runs(case_reports), len(cases) * repetitions)
    metrics_by_archetype = per_archetype_metrics(case_reports, repetitions)
    thresholds = calibration_thresholds()
    return {
        "cases": case_reports,
        "metrics": metrics,
        "per_archetype": metrics_by_archetype,
        "gate_passed": is_gate_passed(metrics, thresholds)
        and all(
            is_archetype_gate_passed(archetype_metrics, thresholds)
            for archetype_metrics in metrics_by_archetype.values()
        ),
    }


def evaluate_approval(
    run_report: dict[str, Any],
    *,
    approvable: bool,
    model_matches_production_pin: bool,
) -> tuple[bool, str]:
    per_archetype = run_report["per_archetype"]
    if not approvable:
        return False, "producer label_state.approvable is false; not approvable"
    if not per_archetype:
        return False, "no archetype was evaluated"
    thresholds = calibration_thresholds()
    failed = sorted(
        archetype
        for archetype, metrics in per_archetype.items()
        if not is_archetype_gate_passed(metrics, thresholds)
    )
    if failed:
        return False, f"archetype gate failed for: {', '.join(failed)}"
    if not model_matches_production_pin:
        return False, "selected model differs from the production judge pin"
    return (
        True,
        "every evaluated archetype passed the gate and the labels are approvable",
    )


def calibration_thresholds() -> dict[str, float]:
    return {
        "max_false_accept_rate": K_MAX_FALSE_ACCEPT_RATE,
        "max_false_reject_rate": K_MAX_FALSE_REJECT_RATE,
    }


def build_plan(
    bank: Bank,
    cases: tuple[Case, ...],
    *,
    model: str,
    repetitions: int,
    include_dev: bool,
    allow_seed_labels: bool,
    excluded_seed_case_ids: tuple[str, ...],
) -> dict[str, Any]:
    archetype_counts = Counter(case.archetype for case in cases)
    calls = len(cases) * repetitions
    return {
        "split": "dev+holdout" if include_dev else "holdout",
        "cases": len(cases),
        "variants": [K_VARIANT],
        "variant_count": 1,
        "repetitions": repetitions,
        "calls": calls,
        "model": model,
        "temperature": 0,
        "bank_sha256": bank.bank_sha256,
        "schema_version": bank.schema_version,
        "readiness": bank.label_state.readiness,
        "approvable": bank.label_state.approvable,
        "allow_seed_labels": allow_seed_labels,
        "archetype_counts": dict(sorted(archetype_counts.items())),
        "excluded_seed_case_count": len(excluded_seed_case_ids),
        "excluded_seed_case_sample": list(excluded_seed_case_ids[:K_BOUNDED_ID_SAMPLE]),
    }


def format_plan(plan: dict[str, Any]) -> str:
    return "\n".join(
        [
            "Write-judge calibration plan (bounded):",
            f"  split: {plan['split']}",
            f"  cases: {plan['cases']}",
            f"  variants: {', '.join(plan['variants'])}",
            f"  repetitions: {plan['repetitions']}",
            f"  calls: {plan['calls']} = cases * variants * repetitions",
            f"  model: {plan['model']}",
            "  temperature: 0",
            f"  bank_sha256: {plan['bank_sha256']}",
            f"  schema_version: {plan['schema_version']}",
            (
                f"  label readiness: {plan['readiness']} "
                f"(approvable={plan['approvable']})"
            ),
            f"  excluded seed cases: {plan['excluded_seed_case_count']}",
        ]
    )


def resolve_output(args: argparse.Namespace) -> Path | None:
    if args.output:
        return Path(args.output)
    reports_dir = K_REPO_ROOT / K_REPORTS_DIRNAME
    if reports_dir.is_dir():
        timestamp = now_aware().strftime("%Y%m%dT%H%M%SZ")
        return reports_dir / f"eval_write_judge_{timestamp}.json"
    return None


def build_report(
    bank: Bank,
    *,
    args: argparse.Namespace,
    plan: dict[str, Any],
    live: bool,
    run_report: dict[str, Any] | None,
) -> dict[str, Any]:
    production_model = settings.LESSON_WRITE_JUDGE_OPENROUTER_MODEL
    model_matches_production_pin = plan["model"] == production_model
    report: dict[str, Any] = {
        "generated_at": now_aware().isoformat(),
        "live": live,
        "input": {
            "path": str(Path(args.input)),
            "schema_version": bank.schema_version,
            "bank_sha256": bank.bank_sha256,
            "label_state": {
                "readiness": bank.label_state.readiness,
                "approvable": bank.label_state.approvable,
                "pending_seed_case_ids": list(bank.label_state.pending_seed_case_ids),
                "provenance_counts": bank.label_state.provenance_counts,
            },
        },
        "model": plan["model"],
        "production_model_pin": production_model,
        "model_matches_production_pin": model_matches_production_pin,
        "reasoning_enabled": settings.LESSON_WRITE_JUDGE_OPENROUTER_REASONING_ENABLED,
        "temperature": 0,
        "repetitions": args.repetitions,
        "include_dev": args.include_dev,
        "allow_seed_labels": args.allow_seed_labels,
        "plan": plan,
        "thresholds": calibration_thresholds(),
        "run": run_report,
        "calibration_approved": False,
        "approval_reason": "plan only; no provider calls were authorized",
    }
    if run_report is not None:
        approved, reason = evaluate_approval(
            run_report,
            approvable=bank.label_state.approvable,
            model_matches_production_pin=model_matches_production_pin,
        )
        report["calibration_approved"] = approved
        report["approval_reason"] = reason
    return report


def write_report(report: dict[str, Any], output: Path | None) -> None:
    if output is None:
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {output}")


def build_provider(model: str | None) -> OpenRouterProvider:
    return OpenRouterProvider(
        model=(
            model if model is not None else settings.LESSON_WRITE_JUDGE_OPENROUTER_MODEL
        ),
        reasoning_enabled=settings.LESSON_WRITE_JUDGE_OPENROUTER_REASONING_ENABLED,
        timeout_seconds=settings.LESSON_WRITE_JUDGE_OPENROUTER_TIMEOUT_SECONDS,
    )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Calibrate the lesson write judge against a portable producer bank."
        )
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the producer-owned calibration bank JSON",
    )
    parser.add_argument(
        "--output",
        default=None,
        help=(
            "Report JSON path. Defaults under reports/ when that directory "
            "exists; a live run otherwise requires this flag."
        ),
    )
    parser.add_argument(
        "--model",
        default=None,
        help="OpenRouter model id override (defaults to the judge setting)",
    )
    parser.add_argument(
        "--repetitions",
        type=int,
        default=K_DEFAULT_REPETITIONS,
        help=f"Runs per case per variant (default: {K_DEFAULT_REPETITIONS})",
    )
    parser.add_argument(
        "--include-dev",
        action="store_true",
        help="Also run dev anchors (default: holdouts only)",
    )
    parser.add_argument(
        "--allow-seed-labels",
        action="store_true",
        help=("Include seed-provenance cases in the plan; they stay non-approvable"),
    )
    parser.add_argument(
        "--approve-live",
        action="store_true",
        help="Authorize provider calls (without it, only the plan is emitted)",
    )
    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> None:
    if args.repetitions < 1:
        raise SystemExit("--repetitions must be at least 1")


async def run_calibration(args: argparse.Namespace) -> int:
    bank = load_bank(Path(args.input))
    cases, excluded_seed_case_ids = select_cases(
        bank,
        include_dev=args.include_dev,
        allow_seed_labels=args.allow_seed_labels,
    )
    if not cases:
        raise SystemExit("no cases selected; nothing to calibrate")
    model = args.model or settings.LESSON_WRITE_JUDGE_OPENROUTER_MODEL
    plan = build_plan(
        bank,
        cases,
        model=model,
        repetitions=args.repetitions,
        include_dev=args.include_dev,
        allow_seed_labels=args.allow_seed_labels,
        excluded_seed_case_ids=excluded_seed_case_ids,
    )
    print(format_plan(plan))
    output = resolve_output(args)

    if not args.approve_live:
        report = build_report(bank, args=args, plan=plan, live=False, run_report=None)
        write_report(report, output)
        print("\nPlan only. Pass --approve-live to authorize provider calls.")
        return 0

    if output is None:
        raise SystemExit(
            "live run requires --output (no reports/ directory in this repo)"
        )
    service = EvaluationService(build_provider(model))
    run_report = await run_cases(service, bank, cases, args.repetitions)
    report = build_report(bank, args=args, plan=plan, live=True, run_report=run_report)
    write_report(report, output)
    metrics = run_report["metrics"]
    print(
        f"gate_passed={run_report['gate_passed']} "
        f"false_accept_rate={metrics['false_accept_rate']} "
        f"false_reject_rate={metrics['false_reject_rate']}"
    )
    print(f"calibration_approved={report['calibration_approved']}")
    if report["calibration_approved"]:
        return 0
    print(f"\nNot approved: {report['approval_reason']}")
    return K_LIVE_NOT_APPROVED_EXIT_CODE


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    validate_args(args)
    try:
        return asyncio.run(run_calibration(args))
    except InputValidationError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2) from error
    except KeyboardInterrupt:
        sys.exit(130)


def _has_clean_runs(metrics: dict[str, Any]) -> bool:
    return (
        metrics["coverage_complete"]
        and metrics["invalid_response_count"] == 0
        and metrics["provider_outage_count"] == 0
    )


def _fail(path: str, message: str) -> NoReturn:
    raise InputValidationError(f"{path}: {message}")


def _required(mapping: dict[str, Any], key: str, path: str) -> Any:
    if key not in mapping:
        _fail(f"{path}.{key}", "missing required field")
    return mapping[key]


def _require_mapping(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(path, "expected an object")
    return value


def _require_list(value: Any, path: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(path, "expected an array")
    return value


def _require_str(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value:
        _fail(path, "expected a non-empty string")
    return value


def _is_bool_value(value: Any, path: str) -> bool:
    if not isinstance(value, bool):
        _fail(path, "expected a boolean")
    return value


def _require_int(value: Any, path: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _fail(path, "expected an integer")
    if value < 0:
        _fail(path, "expected a non-negative integer")
    return value


def _require_str_list(value: Any, path: str) -> tuple[str, ...]:
    items = _require_list(value, path)
    return tuple(
        _require_str(item, f"{path}[{index}]") for index, item in enumerate(items)
    )


def _reject_unknown_keys(
    mapping: dict[str, Any], allowed: frozenset[str], path: str
) -> None:
    unknown = sorted(set(mapping) - allowed)
    if unknown:
        _fail(path, f"unknown keys: {', '.join(unknown)}")


def _parse_schema_version(value: Any, path: str) -> str:
    schema_version = str(value)
    if schema_version != K_SCHEMA_VERSION:
        _fail(path, f"unsupported schema version; expected {K_SCHEMA_VERSION!r}")
    return schema_version


def _parse_criterion(raw: Any, path: str) -> Criterion:
    mapping = _require_mapping(raw, path)
    _reject_unknown_keys(mapping, _CRITERION_KEYS, path)
    return Criterion(
        id=_require_str(_required(mapping, "id", path), f"{path}.id"),
        instruction=_require_str(
            _required(mapping, "instruction", path), f"{path}.instruction"
        ),
        gating=_is_bool_value(_required(mapping, "gating", path), f"{path}.gating"),
    )


def _parse_criteria(raw: Any, path: str) -> tuple[Criterion, ...]:
    items = _require_list(raw, path)
    if not items:
        _fail(path, "expected at least one criterion")
    criteria = tuple(
        _parse_criterion(item, f"{path}[{index}]") for index, item in enumerate(items)
    )
    ids = [criterion.id for criterion in criteria]
    if len(set(ids)) != len(ids):
        _fail(path, "criterion ids must be unique")
    if not any(criterion.gating for criterion in criteria):
        _fail(path, "expected at least one gating criterion")
    return criteria


def _parse_case(raw: Any, path: str, *, split: str) -> Case:
    mapping = _require_mapping(raw, path)
    allowed = _CASE_KEYS | ({"anchor_case_ids"} if split == "holdout" else set())
    _reject_unknown_keys(mapping, frozenset(allowed), path)

    declared_split = _require_str(_required(mapping, "split", path), f"{path}.split")
    if declared_split != split:
        _fail(f"{path}.split", f"expected {split!r}")

    expected_label = _require_str(
        _required(mapping, "expected_label", path), f"{path}.expected_label"
    )
    if expected_label not in K_EXPECTED_LABELS:
        _fail(f"{path}.expected_label", "expected 'pass' or 'fail'")

    anchor_case_ids: tuple[str, ...] = ()
    if split == "holdout":
        anchor_case_ids = _require_str_list(
            _required(mapping, "anchor_case_ids", path),
            f"{path}.anchor_case_ids",
        )

    stimulus = mapping.get("stimulus")
    if stimulus is not None and not isinstance(stimulus, str):
        _fail(f"{path}.stimulus", "expected a string or null")

    label_provenance = _require_str(
        _required(mapping, "label_provenance", path),
        f"{path}.label_provenance",
    )
    if label_provenance not in K_ALLOWED_LABEL_PROVENANCE:
        _fail(
            f"{path}.label_provenance",
            "expected 'seed_pending_human_review' or 'human_reviewed'",
        )

    criteria = _parse_criteria(_required(mapping, "criteria", path), f"{path}.criteria")
    primary_failed_criterion = _parse_primary_failed_criterion(
        mapping,
        path,
        expected_label=expected_label,
        criteria=criteria,
    )

    return Case(
        case_id=_require_str(_required(mapping, "case_id", path), f"{path}.case_id"),
        archetype=_require_str(
            _required(mapping, "archetype", path), f"{path}.archetype"
        ),
        error_class=_require_str(
            _required(mapping, "error_class", path), f"{path}.error_class"
        ),
        split=declared_split,
        expected_label=expected_label,
        dimension=_require_str(
            _required(mapping, "dimension", path), f"{path}.dimension"
        ),
        source=_require_str(_required(mapping, "source", path), f"{path}.source"),
        label_provenance=label_provenance,
        task=_require_str(_required(mapping, "task", path), f"{path}.task"),
        judge_instructions=_require_str(
            _required(mapping, "judge_instructions", path),
            f"{path}.judge_instructions",
        ),
        criteria=criteria,
        stimulus=stimulus,
        response=_require_str(_required(mapping, "response", path), f"{path}.response"),
        anchor_case_ids=anchor_case_ids,
        stressors=_require_str_list(mapping.get("stressors", []), f"{path}.stressors"),
        primary_failed_criterion=primary_failed_criterion,
    )


def _parse_primary_failed_criterion(
    mapping: dict[str, Any],
    path: str,
    *,
    expected_label: str,
    criteria: tuple[Criterion, ...],
) -> str | None:
    primary_failed_criterion = mapping.get("primary_failed_criterion")
    field_path = f"{path}.primary_failed_criterion"
    if primary_failed_criterion is not None and not isinstance(
        primary_failed_criterion, str
    ):
        _fail(field_path, "expected a string or null")
    if expected_label == "fail" and primary_failed_criterion is None:
        _fail(field_path, "expected a gating criterion id for a failed case")
    if expected_label == "pass" and primary_failed_criterion is not None:
        _fail(field_path, "expected null or absent for a passing case")
    gating_ids = {criterion.id for criterion in criteria if criterion.gating}
    if (
        primary_failed_criterion is not None
        and primary_failed_criterion not in gating_ids
    ):
        _fail(field_path, "expected an existing gating criterion id")
    return primary_failed_criterion


def _parse_label_state(raw: Any, path: str, cases: tuple[Case, ...]) -> LabelState:
    mapping = _require_mapping(raw, path)
    _reject_unknown_keys(mapping, _LABEL_STATE_KEYS, path)
    case_ids = _all_case_ids(cases)
    pending = _require_str_list(
        _required(mapping, "pending_seed_case_ids", path),
        f"{path}.pending_seed_case_ids",
    )
    if len(set(pending)) != len(pending):
        _fail(f"{path}.pending_seed_case_ids", "pending seed case ids must be unique")
    unknown = sorted(set(pending) - case_ids)
    if unknown:
        _fail(
            f"{path}.pending_seed_case_ids",
            f"unknown case ids: {', '.join(unknown)}",
        )
    seed_ids = {
        case.case_id for case in cases if _is_seed_provenance(case.label_provenance)
    }
    if set(pending) != seed_ids:
        _fail(
            f"{path}.pending_seed_case_ids",
            "expected exactly the seed-provenance case ids",
        )
    counts_raw = _require_mapping(
        _required(mapping, "provenance_counts", path), f"{path}.provenance_counts"
    )
    counts = {
        _require_str(key, f"{path}.provenance_counts"): _require_int(
            value, f"{path}.provenance_counts.{key}"
        )
        for key, value in counts_raw.items()
    }
    expected_counts = dict(Counter(case.label_provenance for case in cases))
    if counts != expected_counts:
        _fail(
            f"{path}.provenance_counts",
            "must exactly match the recorded case provenance",
        )
    approvable = _is_bool_value(
        _required(mapping, "approvable", path), f"{path}.approvable"
    )
    if approvable != (not pending):
        _fail(f"{path}.approvable", "must be true only when no seed case is pending")
    readiness = _require_str(_required(mapping, "readiness", path), f"{path}.readiness")
    expected_readiness = (
        K_READINESS_SEED_PENDING if pending else K_READINESS_HUMAN_REVIEWED
    )
    if readiness != expected_readiness:
        _fail(f"{path}.readiness", f"expected {expected_readiness!r}")
    return LabelState(
        readiness=readiness,
        approvable=approvable,
        pending_seed_case_ids=pending,
        provenance_counts=counts,
    )


def _validate_label_classes(
    dev_anchors: tuple[Case, ...], holdout_cases: tuple[Case, ...]
) -> None:
    labels = {case.expected_label for case in (*dev_anchors, *holdout_cases)}
    if not set(K_EXPECTED_LABELS) <= labels:
        _fail(
            "$",
            "calibration bank must contain at least one expected pass and "
            "one expected fail",
        )


def _validate_anchor_references(
    dev_anchors: tuple[Case, ...], holdout_cases: tuple[Case, ...]
) -> None:
    by_id = {anchor.case_id: anchor for anchor in dev_anchors}
    for case_index, holdout in enumerate(holdout_cases):
        for anchor_index, anchor_id in enumerate(holdout.anchor_case_ids):
            anchor = by_id.get(anchor_id)
            path = f"$.holdout_cases[{case_index}].anchor_case_ids[{anchor_index}]"
            if anchor is None:
                _fail(path, f"unknown dev anchor {anchor_id!r}")
            if anchor.archetype != holdout.archetype:
                _fail(
                    path,
                    f"anchor archetype {anchor.archetype!r} does not match "
                    f"case archetype {holdout.archetype!r}",
                )


def _validate_unique_case_ids(
    dev_anchors: tuple[Case, ...], holdout_cases: tuple[Case, ...]
) -> None:
    seen: set[str] = set()
    for case in (*dev_anchors, *holdout_cases):
        if case.case_id in seen:
            _fail("$", f"duplicate case_id {case.case_id!r}")
        seen.add(case.case_id)


def _empty_counts() -> dict[str, int]:
    return {
        "evaluated": 0,
        "invalid_response": 0,
        "provider_outage": 0,
        "expected_pass": 0,
        "expected_fail": 0,
        "false_accept": 0,
        "false_reject": 0,
    }


def _rate(numerator: int, denominator: int) -> float | None:
    return None if denominator == 0 else round(numerator / denominator, 6)


def _is_rate_within_threshold(rate: float | None, maximum: float) -> bool:
    return rate is not None and rate <= maximum


def _is_rate_within_threshold_or_absent(rate: float | None, maximum: float) -> bool:
    return rate is None or rate <= maximum


def _is_seed_provenance(label_provenance: str) -> bool:
    return label_provenance == K_READINESS_SEED_PENDING


def _all_case_ids(cases: tuple[Case, ...]) -> set[str]:
    return {case.case_id for case in cases}


if __name__ == "__main__":
    raise SystemExit(main())
