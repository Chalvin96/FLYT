#!/usr/bin/env python3
"""Reject pytest and Vitest names outside Flyt's test convention."""

from __future__ import annotations

import argparse
import ast
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

TEST_NAME = re.compile(r"^test_[a-z0-9]+(?:_[a-z0-9]+)*_given_[a-z0-9]+(?:_[a-z0-9]+)*_expect_[a-z0-9]+(?:_[a-z0-9]+)*$")
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
DIRECT_VITEST = re.compile(r"\b(?:it|test)(?:\.(?:only|skip|todo))?\s*\(\s*(['\"`])([^\n'\"`]*)\1")
EACH_VITEST = re.compile(r"\b(?:it|test)\.each\s*\([\s\S]*?\)\s*\(\s*(['\"`])([^\n'\"`]*)\1")
DIRECT_VITEST_CALL = re.compile(r"\b(?:it|test)(?:\.(?:only|skip|todo))?\s*\(")
EACH_VITEST_CALL = re.compile(r"\b(?:it|test)\.each\s*\(")


@dataclass(frozen=True)
class Violation:
    path: str
    line: int
    name: str

    def render(self) -> str:
        return (
            f"{self.path}:{self.line}: {self.name!r} must match "
            "test_<what>_given_<scenario>_expect_<result>"
        )


def is_test_path(path: str, scope: str = "all") -> bool:
    pure_path = PurePosixPath(path)
    is_backend_test = path.startswith("backend/tests/") and pure_path.suffix == ".py"
    is_morph_svc_test = (
        path.startswith("morph-svc/")
        and pure_path.name.startswith("test_")
        and pure_path.suffix == ".py"
    )
    is_frontend_test = (
        path.startswith(("frontend/src/", "extension/src/", "packages/"))
        and pure_path.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))
    )
    if scope == "backend":
        return is_backend_test or is_morph_svc_test
    if scope == "frontend":
        return is_frontend_test
    return is_backend_test or is_morph_svc_test or is_frontend_test


def added_lines_by_path(diff: str, scope: str = "all") -> dict[str, set[int]]:
    result: dict[str, set[int]] = {}
    path: str | None = None
    next_line: int | None = None

    for line in diff.splitlines():
        if line.startswith("+++ "):
            candidate = line[4:]
            path = None if candidate == "/dev/null" else candidate.removeprefix("b/")
            next_line = None
            continue
        match = HUNK.match(line)
        if match:
            next_line = int(match.group(1))
            continue
        if path is None or next_line is None or line.startswith("\\"):
            continue
        if line.startswith("+"):
            result.setdefault(path, set()).add(next_line)
            next_line += 1
        elif not line.startswith("-"):
            next_line += 1

    return {path: lines for path, lines in result.items() if is_test_path(path, scope)}


def vitest_violations(path: str, source: str, added_lines: set[int]) -> list[Violation]:
    violations: list[Violation] = []
    seen: set[tuple[int, str]] = set()
    static_starts: set[int] = set()
    for pattern in (DIRECT_VITEST, EACH_VITEST):
        for match in pattern.finditer(source):
            static_starts.add(match.start())
            title_start = match.start(2)
            line = source.count("\n", 0, title_start) + 1
            title = match.group(2)
            key = (line, title)
            if line in added_lines and key not in seen and not TEST_NAME.fullmatch(title):
                violations.append(Violation(path, line, title))
                seen.add(key)
    for pattern in (DIRECT_VITEST_CALL, EACH_VITEST_CALL):
        for match in pattern.finditer(source):
            line = source.count("\n", 0, match.start()) + 1
            if line in added_lines and match.start() not in static_starts:
                violations.append(Violation(path, line, "nonliteral Vitest title"))
    return violations


def python_violations(path: str, source: str, added_lines: set[int]) -> list[Violation]:
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError as error:
        return [Violation(path, error.lineno or 1, "unparseable Python test source")]

    violations: list[Violation] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if node.lineno in added_lines and node.name.startswith("test_") and not TEST_NAME.fullmatch(node.name):
            violations.append(Violation(path, node.lineno, node.name))
    return violations


def find_violations(path: str, source: str, added_lines: set[int]) -> list[Violation]:
    if path.endswith(".py"):
        return python_violations(path, source, added_lines)
    return vitest_violations(path, source, added_lines)


def run_git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, text=True, capture_output=True
    ).stdout


def sources_for_diff(diff_paths: Iterable[str], *, staged: bool) -> dict[str, str]:
    sources: dict[str, str] = {}
    for path in diff_paths:
        try:
            if staged:
                sources[path] = run_git("show", f":{path}")
            else:
                sources[path] = run_git("show", f"HEAD:{path}")
        except subprocess.CalledProcessError:
            continue
    return sources


def sources_for_all_test_files(scope: str) -> dict[str, str]:
    paths = (path for path in run_git("ls-files").splitlines() if is_test_path(path, scope))
    return {
        path: Path(path).read_text(encoding="utf-8")
        for path in paths
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--staged", action="store_true", help="check staged changes")
    mode.add_argument("--range", help="check additions in a Git revision range")
    mode.add_argument("--all", action="store_true", help="check every tracked test")
    parser.add_argument(
        "--scope",
        choices=("all", "backend", "frontend"),
        default="all",
        help="limit checks to one platform (default: all)",
    )
    args = parser.parse_args()

    if args.all:
        sources = sources_for_all_test_files(args.scope)
        added_by_path = {
            path: set(range(1, source.count("\n") + 2))
            for path, source in sources.items()
        }
    else:
        diff_args = ["diff", "--no-ext-diff", "--unified=0"]
        if args.staged:
            diff_args.append("--cached")
        else:
            diff_args.append(args.range)
        diff = run_git(*diff_args)
        added_by_path = added_lines_by_path(diff, args.scope)
        sources = sources_for_diff(added_by_path, staged=args.staged)
    violations = [
        violation
        for path, lines in added_by_path.items()
        for violation in find_violations(path, sources.get(path, ""), lines)
    ]
    if violations:
        print("Invalid test names:", file=sys.stderr)
        print("\n".join(v.render() for v in violations), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
