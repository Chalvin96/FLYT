#!/usr/bin/env python3
"""Ratchet React Doctor findings against the recorded per-rule baseline.

Runs the pinned react-doctor devDependency with --json and fails when errors
appear, when any rule exceeds its recorded warning count, or when a rule absent
from the baseline reports warnings. When counts drop below the baseline it asks
for the baseline to be lowered so improvements ratchet in.

The scan uses the flags in the baseline's `scan_args` to skip the dead-code and
supply-chain plugins: their unused-file/export/dependency findings resolve
node_modules and vary by install state, so they are not a deterministic ratchet
target. This ratchet covers deterministic AST lint rules. Keep intentional
exceptions reviewable in the pull request description when changing the baseline.
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


def load_report(report_path: Path) -> dict:
    with report_path.open() as handle:
        return json.load(handle)


def run_scanner(scan_args: list[str], report_path: Path) -> None:
    # Uses the react-doctor devDependency pinned in package.json (no network
    # fetch); the report's version field is checked against the baseline below.
    command = [
        "pnpm",
        "exec",
        "react-doctor",
        ".",
        *scan_args,
        "--json",
        "--json-out",
        str(report_path),
    ]
    completed = subprocess.run(command, cwd=REPO_ROOT, check=False)
    if not report_path.exists():
        raise SystemExit(f"react-doctor did not produce a report (exit {completed.returncode})")


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
        print("Rules below baseline — lower scripts/react_doctor_baseline.json to lock them in:")
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

    if args.report:
        report = load_report(args.report)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / "react-doctor.json"
            run_scanner(baseline.get("scan_args", []), report_path)
            report = load_report(report_path)

    if report["version"] != baseline["version"]:
        print(
            f"warning: report version {report['version']} differs from baseline "
            f"{baseline['version']}; counts may not be comparable",
            file=sys.stderr,
        )

    problems = compare(report, baseline)
    if problems:
        print("React Doctor ratchet failed:", file=sys.stderr)
        for line in problems:
            print(f"  {line}", file=sys.stderr)
        print(
            "Fix the regression or explain an intentional exception in the pull request "
            "before updating scripts/react_doctor_baseline.json.",
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
