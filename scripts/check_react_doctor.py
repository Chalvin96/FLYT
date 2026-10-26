#!/usr/bin/env python3
"""Ratchet React Doctor findings against the recorded per-rule baseline.

Runs the pinned react-doctor devDependency with --json and fails when errors
appear, when the report and the baseline come from different analyser versions,
when the baseline asks the scan for flags other than the sanctioned ones, when
any rule exceeds its recorded warning count, or when a rule absent from the
baseline reports warnings. When counts drop below the baseline it asks for the
baseline to be lowered so improvements ratchet in.

The sanctioned scan skips the dead-code and supply-chain plugins: their
unused-file/export/dependency findings resolve node_modules and vary by install
state, so they are not a deterministic ratchet target. This ratchet covers
deterministic AST lint rules. Those flags are pinned here rather than left to the
baseline, so that changing what the scan measures is an edit to this checker and
a baseline requesting anything else fails the gate. Keep intentional exceptions
reviewable in the pull request description when changing the baseline.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BASELINE_PATH = Path(__file__).resolve().parent / "react_doctor_baseline.json"
K_BASELINE_NAME = BASELINE_PATH.relative_to(REPO_ROOT).as_posix()
K_SANCTIONED_SCAN_ARGS = ["--no-dead-code", "--no-supply-chain"]
K_FAILURE_HEADER = "React Doctor ratchet failed:"
K_REPORT_NAME = "react-doctor.json"


def load_report(report_path: Path) -> dict:
    with report_path.open() as handle:
        return json.load(handle)


def build_scanner_command(scan_args: list[str], report_path: str) -> list[str]:
    return [
        "pnpm",
        "exec",
        "react-doctor",
        ".",
        *scan_args,
        "--json",
        "--json-out",
        report_path,
    ]


def run_scanner(scan_args: list[str], report_path: Path) -> None:
    completed = subprocess.run(
        build_scanner_command(scan_args, str(report_path)), cwd=REPO_ROOT, check=False
    )
    if not report_path.exists():
        raise SystemExit(f"react-doctor did not produce a report (exit {completed.returncode})")


def render_scan_args_mismatch(scan_args: list[str]) -> str:
    changed = [
        f"  {'+' if flag in scan_args else '-'} {flag}"
        for flag in sorted(set(scan_args) ^ set(K_SANCTIONED_SCAN_ARGS))
    ]
    return "\n".join(
        [
            K_FAILURE_HEADER,
            f"  scan args {' '.join(scan_args)} do not match the sanctioned "
            f"{' '.join(K_SANCTIONED_SCAN_ARGS)}",
            *changed,
            "  Update K_SANCTIONED_SCAN_ARGS in this checker to change what the "
            "ratchet measures.",
        ]
    )


def render_version_mismatch(report: dict, baseline: dict, scan_args: list[str]) -> str:
    command = " ".join(build_scanner_command(scan_args, K_REPORT_NAME))
    return (
        f"{K_FAILURE_HEADER}\n"
        f"  report version {report['version']} does not match baseline version "
        f"{baseline['version']}\n"
        f"  {command}"
    )


def compare(report: dict, baseline: dict) -> list[str]:
    problems: list[str] = []
    improvements: list[str] = []

    error_count = report["summary"]["errorCount"]
    if error_count > baseline["max_errors"]:
        problems.append(f"errors: {error_count} (baseline allows {baseline['max_errors']})")

    warning_counts = Counter(
        diagnostic["rule"]
        for diagnostic in report["diagnostics"]
        if diagnostic["severity"] == "warning"
    )
    allowed: dict[str, int] = baseline["max_warnings_by_rule"]

    for rule in sorted(set(warning_counts) | set(allowed)):
        observed = warning_counts.get(rule, 0)
        limit = allowed.get(rule, 0)
        if observed > limit:
            problems.append(f"{rule}: {observed} warnings (baseline {limit})")
        elif observed < limit:
            improvements.append(f"{rule}: {observed} warnings (baseline {limit})")

    if improvements:
        print(f"Rules below baseline — lower {K_BASELINE_NAME} to lock them in:")
        for line in improvements:
            print(f"  {line}")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report",
        type=Path,
        help="parse an existing react-doctor --json report instead of running the scanner",
    )
    args = parser.parse_args()

    baseline = json.loads(BASELINE_PATH.read_text())
    scan_args = baseline["scan_args"]

    if scan_args != K_SANCTIONED_SCAN_ARGS:
        print(render_scan_args_mismatch(scan_args), file=sys.stderr)
        return 1

    if args.report:
        report = load_report(args.report)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / K_REPORT_NAME
            run_scanner(scan_args, report_path)
            report = load_report(report_path)

    if report["version"] != baseline["version"]:
        print(render_version_mismatch(report, baseline, scan_args), file=sys.stderr)
        return 1

    problems = compare(report, baseline)
    if problems:
        print(K_FAILURE_HEADER, file=sys.stderr)
        for line in problems:
            print(f"  {line}", file=sys.stderr)
        print(
            "Fix the regression or explain an intentional exception in the pull request "
            f"before updating {K_BASELINE_NAME}.",
            file=sys.stderr,
        )
        return 1

    summary = report["summary"]
    print(
        f"React Doctor ratchet passed: {summary['errorCount']} errors, "
        f"{summary['warningCount']} warnings (score {summary['score']})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
