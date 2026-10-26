#!/usr/bin/env python3
"""Fail when the design system's escape hatches grow, or stop being enforced.

The ESLint config keeps the allowlists that decide how far the design system
reaches: files permitted to render a raw `<button>` (`RAW_BUTTON_OWNERS`), files
permitted to render the Radix dialog primitives directly (`RAW_DIALOG_OWNERS`),
the closed components whose surface lint protects (`CLOSED_COMPONENTS`), the
globs the raw-element rules stand down on (`RAW_ELEMENT_EXEMPT_GLOBS`), the paths
the config does not lint at all (`IGNORED_PATHS`), the type vocabulary's
scope, stand-down list and restrictions (`TYPOGRAPHY_LINT_GLOBS`,
`TYPOGRAPHY_OWNERS`, `TYPOGRAPHY_RESTRICTIONS`), the packages whose tests may
still assert a class string (`CLASS_ASSERTION_EXEMPT_PACKAGES`), the tests
whose assertion subject is a target box or a visually hidden live region
(`CLASS_ASSERTION_EXEMPT_TESTS`), and the files where the style attribute stays
available (`STYLE_OWNERS`). They are ordinary source, so anything with
write access can widen them — which is the cheapest way to make a failing
design-system rule pass without changing the code that failed.

The lists are read by importing the config, not by scraping its text, and the
same import answers the second question: whether the rules still consume them.
A list can stay byte-identical while the rule that reads it is unhooked, and a
ratchet that only compares contents would report every surface still closed.
That second question is answered by what ESLint resolves for a probe path, never
by the shape of the block that names the list.

The comparison is against the merge base, never against a file the same commit
can rewrite: a widening is only allowed when every added or dropped entry is
named in `DESIGN_SYSTEM_ESCAPES_ACK`, which has to be typed at the call site.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

K_REPO_ROOT = Path(__file__).resolve().parent.parent
K_CONFIG = "eslint.config.js"
K_OLD_CONFIG = "frontend/eslint.config.js"
K_HELPER = Path(__file__).resolve().parent / "lib" / "design_system_config.mjs"
K_ACK_VARIABLE = "DESIGN_SYSTEM_ESCAPES_ACK"
K_DEFAULT_BASE = "origin/master"
K_LIST_NAMES = (
    "RAW_BUTTON_OWNERS",
    "RAW_DIALOG_OWNERS",
    "CLOSED_COMPONENTS",
    "RAW_ELEMENT_EXEMPT_GLOBS",
    "IGNORED_PATHS",
    "TYPOGRAPHY_OWNERS",
    "TYPOGRAPHY_LINT_GLOBS",
    "TYPOGRAPHY_RESTRICTIONS",
    "CLASS_ASSERTION_EXEMPT_PACKAGES",
    "CLASS_ASSERTION_EXEMPT_TESTS",
    "STYLE_OWNERS",
    "RAW_FORM_TYPE_VARIANT_OWNERS",
)
K_SURFACE_PROPERTIES = ("className", "style")
K_ERROR_SEVERITIES = ("error", 2)
K_REPORTED_NAMES = 8
K_TEST_PATH = re.compile(r"\.(?:test|spec|stories)\.(?:ts|tsx)$")


def resolve_base(repo_root: Path, base: str) -> str:
    """The merge base commit, or a nonzero exit when the base is not usable."""
    verified = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}"],
        cwd=repo_root,
        text=True,
        capture_output=True,
        check=False,
    )
    if verified.returncode != 0:
        raise SystemExit(
            f"Design-system escape ratchet cannot resolve base {base!r} to a commit. "
            "Refusing to run without a baseline."
        )

    merged = subprocess.run(
        ["git", "merge-base", "HEAD", base],
        cwd=repo_root,
        text=True,
        capture_output=True,
        check=False,
    )
    if merged.returncode != 0 or not merged.stdout.strip():
        raise SystemExit(
            f"Design-system escape ratchet cannot find a merge base between HEAD and "
            f"{base!r}. A shallow checkout or an unrelated base cannot be ratcheted "
            "against; refusing to run without a baseline."
        )
    return merged.stdout.strip()


def run_helper(repo_root: Path, config_path: Path, *, lists_only: bool) -> dict:
    """The helper's JSON for one config, or a nonzero exit carrying its stderr."""
    command = ["node", str(K_HELPER), "--config", str(config_path)]
    if lists_only:
        command.append("--lists-only")
    result = subprocess.run(
        command, cwd=repo_root, text=True, capture_output=True, check=False
    )
    if result.returncode != 0:
        raise SystemExit(
            f"Design-system escape ratchet could not read {config_path} through "
            f"{K_HELPER.name}: "
            f"{result.stderr.strip() or 'the helper failed without a message'}"
        )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit(
            f"Design-system escape ratchet read no JSON from {K_HELPER.name} for "
            f"{config_path}: {error}"
        ) from error


def working_tree_config(repo_root: Path) -> Path:
    path = repo_root / K_CONFIG
    if not path.is_file():
        raise SystemExit(
            "Design-system escape ratchet could not read the working tree eslint "
            f"config at {K_CONFIG}."
        )
    return path


def resolve_base_temp_path(repo_root: Path) -> Path:
    # Node resolves the config's plugin imports by walking up from the file, so
    # the base copy has to sit inside the repository to reach `node_modules`.
    return repo_root / f"eslint.config.{os.getpid()}.ratchet-base.mjs"


def read_base_lists(
    repo_root: Path, base: str, config: str = K_CONFIG
) -> dict | None:
    """The allowlists at the base, or None when the base predates the config."""
    shown = subprocess.run(
        ["git", "show", f"{base}:{config}"],
        cwd=repo_root,
        text=True,
        capture_output=True,
        check=False,
    )
    if shown.returncode != 0:
        if "does not exist" in shown.stderr or "exists on disk" in shown.stderr:
            return None
        raise SystemExit(
            f"Design-system escape ratchet could not read {config} at {base}: "
            f"{shown.stderr.strip() or 'git show failed'}"
        )

    temporary = resolve_base_temp_path(repo_root)
    temporary.write_text(shown.stdout, encoding="utf-8")
    try:
        return run_helper(repo_root, temporary, lists_only=True)
    finally:
        temporary.unlink(missing_ok=True)


def has_allowlists_at_old_location(repo_root: Path, base: str) -> bool:
    """Whether the old config already exported design-system allowlists."""
    lists = read_base_lists(repo_root, base, K_OLD_CONFIG)
    return lists is not None and any(
        lists.get(name) is not None for name in K_LIST_NAMES
    )


def acknowledged_entries() -> set[str]:
    # A glob entry carries its own commas (`*.{test,spec}.tsx`), so a newline in
    # the value switches the separator rather than shredding the entry.
    raw = os.environ.get(K_ACK_VARIABLE, "")
    separator = "\n" if "\n" in raw else ","
    return {entry.strip() for entry in raw.split(separator) if entry.strip()}


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=str(K_REPO_ROOT))
    parser.add_argument(
        "--base",
        default=os.environ.get("LOCAL_CI_BASE_SHA") or K_DEFAULT_BASE,
    )
    return parser.parse_args(argv)


def render_names(names: list[str]) -> str:
    shown = ", ".join(names[:K_REPORTED_NAMES])
    if len(names) > K_REPORTED_NAMES:
        return f"{shown} (+{len(names) - K_REPORTED_NAMES} more, {len(names)} total)"
    return shown


def collect_widening_violations(
    current: dict, baseline: dict, acknowledged: set[str]
) -> list[str]:
    def added(name: str, label: str) -> list[str]:
        entries = set(current[name]) - set(baseline[name])
        return [
            f"+ {label}: {entry}" for entry in sorted(entries) if entry not in acknowledged
        ]

    def dropped(name: str, label: str) -> list[str]:
        entries = set(baseline[name]) - set(current[name])
        return [
            f"- {label}: {entry}" for entry in sorted(entries) if entry not in acknowledged
        ]

    return (
        added("RAW_BUTTON_OWNERS", "raw-button owner")
        + added("RAW_DIALOG_OWNERS", "raw-dialog owner")
        + added("RAW_ELEMENT_EXEMPT_GLOBS", "raw-element exemption")
        + added("IGNORED_PATHS", "ignored path")
        + added("TYPOGRAPHY_OWNERS", "type owner")
        # The scope list the typography rule reads: a glob leaving it un-rules a
        # whole workspace, so either direction is an acknowledged change.
        + added("TYPOGRAPHY_LINT_GLOBS", "type lint glob")
        + dropped("TYPOGRAPHY_LINT_GLOBS", "type lint glob")
        # Either direction is an acknowledged change: an entry leaving the list
        # opens the utility it named.
        + added("TYPOGRAPHY_RESTRICTIONS", "type restriction")
        + dropped("TYPOGRAPHY_RESTRICTIONS", "type restriction")
        + added("CLASS_ASSERTION_EXEMPT_PACKAGES", "class-assertion exempt package")
        + added("CLASS_ASSERTION_EXEMPT_TESTS", "class-assertion exempt test")
        + added("STYLE_OWNERS", "style owner")
        + added("RAW_FORM_TYPE_VARIANT_OWNERS", "raw-form type owner")
        + [
            f"- closed component: {entry}"
            for entry in sorted(
                set(baseline["CLOSED_COMPONENTS"]) - set(current["CLOSED_COMPONENTS"])
            )
            if entry not in acknowledged
        ]
    )


def is_class_assertion_target(
    probe_path: str, exempt_packages: set[str], exempt_tests: set[str]
) -> bool:
    """Whether the class-assertion ban must reach a probe path.

    Every test path outside an exempt package answers to it; a package's own
    tests and the exempt tests do not. A non-test path is outside the ban's
    scope either way, so it is never reported for carrying or missing it.
    """
    if probe_path in exempt_tests:
        return False
    if is_exempt_package_path(probe_path, exempt_packages):
        return False
    return bool(K_TEST_PATH.search(probe_path))


def is_exempt_package_path(path: str, exempt_packages: set[str]) -> bool:
    return any(
        path == package or path.startswith(f"{package}/") for package in exempt_packages
    )


def collect_class_assertion_violations(
    current: dict, exempt_packages: set[str], exempt_tests: set[str]
) -> list[str]:
    """Whether the rule that bans class assertions reaches what it must.

    The exemption is the package path, so the same import has to show the ban
    reaching a feature test and standing down inside the design-system package.
    A rule present everywhere looks identical on a feature test and only the
    exempted path tells the two apart.
    """
    violations: list[str] = []
    for probe in current["probes"]:
        path = probe["path"]
        # Only a test carries a class assertion, so only a test is reported for
        # carrying or missing the ban that reaches them.
        if not K_TEST_PATH.search(path):
            continue
        expected = is_class_assertion_target(path, exempt_packages, exempt_tests)
        if expected and not probe["classAssertions"]:
            violations.append(
                f"{path}: toHaveClass is not rejected here; the ban must reach "
                "every test outside the exempt paths"
            )
        elif not expected and probe["classAssertions"]:
            if path in exempt_tests:
                violations.append(
                    f"{path}: this test's subject is not perceivable in the DOM, "
                    "so the ban must stand down for it"
                )
            elif is_exempt_package_path(path, exempt_packages):
                violations.append(
                    f"{path}: the exempt package's own tests must keep their class "
                    "assertions"
                )
    return violations


def collect_wiring_violations(current: dict) -> list[str]:
    """Every way the rule stops consuming a list it is supposed to enforce."""
    closed_components = current["CLOSED_COMPONENTS"]
    raw_button_owners = set(current["RAW_BUTTON_OWNERS"])
    raw_dialog_owners = set(current["RAW_DIALOG_OWNERS"])
    style_owners = set(current["STYLE_OWNERS"])
    raw_form_type_owners = set(current["RAW_FORM_TYPE_VARIANT_OWNERS"])
    violations: list[str] = []

    for entry in current["unlistedGlobs"]:
        violations.append(
            f"{entry['glob']}: the config selects on this {entry['kind']} glob, "
            "but no list names it"
        )

    violations.extend(current.get("typographyViolations") or [])

    for probe in current["probes"]:
        path = probe["path"]
        if probe["pathIgnored"]:
            violations.append(f"{path}: ignored by the config, so no rule reaches it")
            continue

        if path.startswith(("frontend/src/", "extension/src/")):
            restricted = set(probe["restrictedTypeImports"])
            expected = (
                {"headingVariants"}
                if path in raw_form_type_owners
                else {"textVariants", "headingVariants"}
            )
            if restricted != expected:
                violations.append(
                    f"{path}: type import restriction is {sorted(restricted)}, "
                    f"expected {sorted(expected)}"
                )
            if expected and probe["typeImportSeverity"] not in K_ERROR_SEVERITIES:
                violations.append(
                    f"{path}: no-restricted-imports severity is "
                    f"{probe['typeImportSeverity']!r}, not 'error'"
                )

        if probe["severity"] not in K_ERROR_SEVERITIES:
            violations.append(
                f"{path}: no-restricted-syntax severity is {probe['severity']!r}, "
                "not 'error'"
            )

        for property_name in K_SURFACE_PROPERTIES:
            covered = set(probe["closedComponents"][property_name])
            missing = sorted(name for name in closed_components if name not in covered)
            if missing:
                violations.append(
                    f"{path}: the {property_name} selector does not cover "
                    f"{render_names(missing)}"
                )

        if not probe["exempt"]:
            if path in style_owners and probe["styleBan"]:
                violations.append(
                    f"{path}: STYLE_OWNERS keeps the style channel open here, "
                    "but the style ban reaches it"
                )
            elif path not in style_owners and not probe["styleBan"]:
                violations.append(
                    f"{path}: the style attribute is not rejected here; the ban "
                    "must reach every surface outside STYLE_OWNERS and the "
                    "raw-element exemptions"
                )

        owns_button = path in raw_button_owners
        owns_dialog = path in raw_dialog_owners
        if owns_button or owns_dialog:
            if owns_button and probe["rawButton"]:
                violations.append(
                    f"{path}: a raw-button owner still answers to the raw-button rule"
                )
            if owns_dialog and probe["rawDialog"]:
                violations.append(
                    f"{path}: a raw-dialog owner still answers to the dialog rule"
                )
            continue

        exempt = probe["exempt"]
        if probe["rawButton"] != (not exempt):
            violations.append(
                f"{path}: {'must not' if exempt else 'must'} restrict the raw <button>, "
                f"but {'does' if probe['rawButton'] else 'does not'}"
            )
        if probe["rawDialog"] != (not exempt):
            violations.append(
                f"{path}: {'must not' if exempt else 'must'} restrict the DialogPrimitive "
                f"Content/Overlay member expression, but "
                f"{'does' if probe['rawDialog'] else 'does not'}"
            )

    return violations


def report_wiring(violations: list[str]) -> None:
    print("Design-system rule wiring no longer consumes the allowlists:")
    for line in violations:
        print(f"  {line}")
    print(
        "\nAn allowlist can be byte-identical while the rule that reads it is unhooked,\n"
        "so every surface above is open even though nothing was widened. Widening the\n"
        "allowlist, loosening a selector or disabling the rule is not the fix: restore\n"
        "the rule block that consumes the list."
    )


def main(argv: list[str]) -> int:
    arguments = parse_arguments(argv)
    repo_root = Path(arguments.repo).resolve()

    current = run_helper(repo_root, working_tree_config(repo_root), lists_only=False)
    # Wiring is base-independent, so it is answered before the base is even read.
    wiring = collect_wiring_violations(current) + collect_class_assertion_violations(
        current,
        set(current["CLASS_ASSERTION_EXEMPT_PACKAGES"] or []),
        set(current["CLASS_ASSERTION_EXEMPT_TESTS"] or []),
    )

    base = resolve_base(repo_root, arguments.base)
    base_lists = read_base_lists(repo_root, base)
    if base_lists is None:
        if has_allowlists_at_old_location(repo_root, base):
            print(
                f"Design-system escape ratchet found no {K_CONFIG} at {base}, but "
                f"{K_OLD_CONFIG} exports design-system allowlists. The base "
                "predates the config's move to the repository root; refusing "
                "to skip their baseline. Re-run against a base that includes the move."
            )
            return 1
        print(
            f"Design-system escape allowlists do not exist at {base} — "
            "first-time bootstrap, nothing to ratchet against."
        )
        if wiring:
            report_wiring(wiring)
            return 1
        return 0

    baseline = {
        name: base_lists[name] if base_lists.get(name) is not None else current[name]
        for name in K_LIST_NAMES
    }

    widenings = collect_widening_violations(current, baseline, acknowledged_entries())

    if widenings:
        print(f"Design-system escape hatches widened against {base}:")
        for line in widenings:
            print(f"  {line}")
        print(
            "\nA file that needs a raw <button>, or a component leaving the closed set,\n"
            "is a design decision. Make it deliberately: state the reason in the PR, then\n"
            f"re-run with {K_ACK_VARIABLE} naming each entry above, comma separated —\n"
            "or newline separated, which an entry containing a comma requires."
        )

    if wiring:
        report_wiring(wiring)

    if widenings or wiring:
        return 1

    print(
        f"Design-system escapes unchanged against {base}: "
        f"{len(current['RAW_BUTTON_OWNERS'])} raw-button owners, "
        f"{len(current['RAW_DIALOG_OWNERS'])} raw-dialog owners, "
        f"{len(current['CLOSED_COMPONENTS'])} closed components, "
        f"{len(current['TYPOGRAPHY_OWNERS'])} type owners over "
        f"{len(current['TYPOGRAPHY_LINT_GLOBS'])} type lint globs, "
        f"{len(current['STYLE_OWNERS'])} style owners, and "
        f"{len(current['CLASS_ASSERTION_EXEMPT_PACKAGES'])} class-assertion exempt "
        "packages."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
