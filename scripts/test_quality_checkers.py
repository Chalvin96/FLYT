"""Focused tests for the repository quality-checking scripts."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

K_REPO_ROOT = Path(__file__).resolve().parent.parent
K_ESLINT = K_REPO_ROOT / "node_modules" / "eslint" / "bin" / "eslint.js"
K_CHECK_CONVENTIONS = Path(__file__).with_name("check_conventions.py")
K_CHECK_ESCAPES = Path(__file__).with_name("check_design_system_escapes.py")
K_CHECK_REACT_DOCTOR = Path(__file__).with_name("check_react_doctor.py")
K_CHECK_TYPOGRAPHY_SEMANTICS = Path(__file__).with_name(
    "check_typography_semantics.mjs"
)
K_REACT_DOCTOR_BASELINE = Path(__file__).with_name("react_doctor_baseline.json")

K_EXEMPT_GLOBS = [
    "packages/ui/src/components/**/*.tsx",
    "frontend/src/**/*.{test,spec,stories}.{ts,tsx}",
    "packages/**/src/**/*.{test,spec,stories}.{ts,tsx}",
    "extension/src/**/*.{test,spec}.{ts,tsx}",
]

K_STYLE_MESSAGE = "STYLE_OWNERS"
K_TYPE_SCALE_MESSAGE = "Text owns the type scale"
K_TYPE_LEADING_MESSAGE = "A Text size carries its own leading"
K_TYPOGRAPHY_RULE = "better-tailwindcss/no-restricted-classes"
K_UI_LAYER_MESSAGE = (
    "packages/ui is the design system and must not import domain or app code."
)
K_LEXICON_LAYER_MESSAGE = (
    "packages/lexicon is shared domain UI and must not import app code."
)
K_UI_LAYER_PROBE = "packages/ui/src/__layer_probe__.tsx"
K_LEXICON_LAYER_PROBE = "packages/lexicon/src/__layer_probe__.tsx"

# One probe per typography lint glob, written under the real config. The owner
# file carries the same utilities as the shared recipe probe and is named in
# TYPOGRAPHY_OWNERS, so the pair separates the rule from its stand-down list.
K_TYPOGRAPHY_PROBES = {
    "frontend/src/__typography_probe__.tsx": (
        "export function TypographyProbe() {\n"
        '  return <p className="text-sm">Bare utility</p>;\n'
        "}\n"
    ),
    "extension/src/__typography_probe__.tsx": (
        "export function TypographyProbe() {\n"
        '  return <p className="text-sm">Bare utility</p>;\n'
        "}\n"
    ),
    "packages/ui/src/__typography_probe__.tsx": (
        "import { cva } from 'class-variance-authority';\n"
        "\n"
        "export const probeVariants = cva('flex w-full text-base', {\n"
        "  variants: {\n"
        "    size: { md: 'md:text-sm' },\n"
        "    tone: { quiet: 'leading-normal' },\n"
        "  },\n"
        "});\n"
    ),
}
K_TYPOGRAPHY_OWNER_RECIPE = "packages/ui/src/components/input-variants.ts"

# Every spelling the regex layer was found to miss, compiled against both
# design systems by check_typography_semantics.mjs. A loosened pattern passes
# the string ratchet, so the corpus is what catches a widening: it fails on
# behaviour instead.
K_SEMANTIC_REJECT_CLASSES = [
    "text-sm",
    "text-sm/10",
    "text-(length:--type-size-xs)",
    "[font-size:47px]",
    "leading-copy",
    "font-sans",
    "font-[550]",
    "text-prompt",
    "font-(--x)",
    "sm:text-sm",
    "sm:leading-copy",
    "2xl:leading-copy",
    "[letter-spacing:2px]",
    "text-4xl",
    "leading-normal",
    "[font:550_47px_serif]",
    "[font:47px/2_serif]",
]
K_SEMANTIC_PROPERTY_BY_CLASS = {
    "text-sm": "font-size",
    "text-(length:--type-size-xs)": "font-size",
    "[font-size:47px]": "font-size",
    "text-prompt": "font-size",
    "leading-copy": "line-height",
    "font-sans": "font-family",
    "font-[550]": "font-weight",
    "[font:550_47px_serif]": "font",
    "[font:47px/2_serif]": "font",
}
# `text-(--x)` compiles to color, not to a type property: the compiler reads a
# bare text- variable as a colour, so the corpus pins it on the accepting side.
K_SEMANTIC_ACCEPT_CLASSES = [
    "text-danger",
    "[color:red]",
    "w-[440px]",
    "flex",
    "text-(--x)",
    "not-a-class",
]
K_SEMANTIC_PROBE = "frontend/src/__typography_semantics_probe__.tsx"
K_GROUP_PROBE = "frontend/src/__group_probe__.tsx"
K_DEPTH_PROBE = "frontend/src/pages/HomePage/components/__typography_depth_probe__.tsx"

# The selectors the ban has to reach, stated here rather than read from the
# config under test: a config that narrows its own selector list and wires the
# narrowed set would otherwise ratchet itself.
K_CLASS_ASSERTION_SELECTORS = [
    "CallExpression[callee.property.name='toHaveClass']",
    "CallExpression[callee.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
    "CallExpression[callee.object.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
    "CallExpression[callee.property.name='toHaveAttribute'] Literal[value='class']",
    "CallExpression[callee.property.name='getAttribute'] Literal[value='class']",
]


def _render_entries(entries: list[str]) -> str:
    return "".join(f"\n  '{entry}'," for entry in entries) + "\n"


def _render_selector_entries(entries: list[str]) -> str:
    # Selectors carry single quotes of their own, so they are double quoted.
    return "".join(f'\n  "{entry}",' for entry in entries) + "\n"


def _render_literals(entries: list[str]) -> str:
    return ", ".join(f"'{entry}'" for entry in entries)


def _eslint_config(
    raw_button_owners: list[str],
    closed_components: list[str],
    *,
    narrowed_closed_surface: bool = False,
    wired_closed_components: list[str] | None = None,
    closed_surface_in_main_rule: bool = True,
    raw_button_in_main_rule: bool = True,
    main_rule_severity: str = "error",
    exempted_owners: list[str] | None = None,
    exempt_globs: list[str] | None = None,
    ignored_paths: list[str] | None = None,
    unlisted_exempt_globs: list[str] | None = None,
    unlisted_ignored_paths: list[str] | None = None,
    typography_owners: list[str] | None = None,
    typography_lint_globs: list[str] | None = None,
    typography_block: bool = True,
    typography_shadow: str | None = None,
    class_assertion_exempt_packages: list[str] | None = None,
    class_assertion_exempt_tests: list[str] | None = None,
    class_assertion_selectors: list[str] | None = None,
    class_assertion_in_enforcement: bool = True,
    class_assertion_ignores_exempt: bool = True,
    class_assertion_exempt_wired: bool = True,
    style_owners: list[str] | None = None,
    style_in_main_rule: bool = True,
    style_owner_standdown: bool = True,
    style_shadow: bool = False,
    raw_form_type_owners: list[str] | None = None,
    type_import_block: bool = True,
) -> str:
    """A flat config the checker's node helper can import and ESLint can resolve.

    A bare array literal, not `tseslint.config(...)`, so the throwaway repository
    needs no `node_modules`; `package.json` still declares the ESM type.
    """
    if wired_closed_components is not None:
        surface_source = (
            "const closedSurfaceComponents = "
            f"[{_render_entries(wired_closed_components)}];\n"
        )
    elif narrowed_closed_surface:
        surface_source = "const closedSurfaceComponents = CLOSED_COMPONENTS.slice(0, 1);\n"
    else:
        surface_source = "const closedSurfaceComponents = CLOSED_COMPONENTS;\n"

    owners = raw_button_owners if exempted_owners is None else exempted_owners
    main_rule = [f"'{main_rule_severity}'"]
    if raw_button_in_main_rule:
        main_rule.append("rawButton")
    main_rule.append("rawDialog")
    if style_in_main_rule:
        main_rule.append("inlineStyle")
    main_rule.append("...classAssertions")
    if closed_surface_in_main_rule:
        main_rule.append("...closedSurface")

    exempt_packages = (
        ["packages/ui"]
        if class_assertion_exempt_packages is None
        else class_assertion_exempt_packages
    )
    exempt_tests = [] if class_assertion_exempt_tests is None else class_assertion_exempt_tests
    selectors = (
        K_CLASS_ASSERTION_SELECTORS
        if class_assertion_selectors is None
        else class_assertion_selectors
    )
    enforcement_rule = [f"'{main_rule_severity}'"]
    if closed_surface_in_main_rule:
        enforcement_rule.append("...closedSurface")
    if class_assertion_in_enforcement:
        enforcement_rule.append("...classAssertions")
    enforcement_ignores = (
        "CLASS_ASSERTION_EXEMPT_PACKAGES.map(\n"
        "      (packagePath) => `${packagePath}/**`,\n"
        "    )"
        if class_assertion_ignores_exempt
        else "[]"
    )
    exempt_block = (
        """  {
    files: CLASS_ASSERTION_EXEMPT_TESTS,
    rules: {
      'no-restricted-syntax': ['error', ...closedSurface],
    },
  },
"""
        if class_assertion_exempt_wired and exempt_tests
        else ""
    )
    style_owner_block = (
        """  {
    files: STYLE_OWNERS,
    rules: {
      'no-restricted-syntax': ['error', rawButton, rawDialog, ...closedSurface],
    },
  },
"""
        if style_owner_standdown and style_owners
        else ""
    )
    style_shadow_block = (
        """  {
    files: ['frontend/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', rawButton, rawDialog, ...closedSurface],
    },
  },
"""
        if style_shadow
        else ""
    )

    globs = K_EXEMPT_GLOBS if exempt_globs is None else exempt_globs
    ignores = ", ".join(
        ["...IGNORED_PATHS", *(f"'{path}'" for path in unlisted_ignored_paths or [])]
    )
    owner_files = [*owners, *globs, *(unlisted_exempt_globs or [])]
    lint_globs = (
        ["frontend/src/**/*.{ts,tsx}"]
        if typography_lint_globs is None
        else typography_lint_globs
    )
    typography_source = (
        ""
        if not typography_block
        else """
  {
    files: TYPOGRAPHY_LINT_GLOBS,
    ignores: TYPOGRAPHY_OWNERS,
    plugins: {
      'better-tailwindcss': {
        rules: { 'no-restricted-classes': { meta: { schema: false } } },
      },
    },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        { restrict: TYPOGRAPHY_RESTRICTIONS },
      ],
    },
  },"""
    )
    forced_only = "{ restrict: [{ pattern: '^!.+', message: 'forced' }] }"
    shadows = {
        "rule": f"""
  {{
    files: ['frontend/src/**/*.tsx'],
    rules: {{ 'better-tailwindcss/no-restricted-classes': ['error', {forced_only}] }},
  }},""",
        "owners": f"""
  {{
    files: [...TYPOGRAPHY_OWNERS, 'frontend/src/**/*.tsx'],
    rules: {{ 'better-tailwindcss/no-restricted-classes': ['error', {forced_only}] }},
  }},""",
        "severity": """
  {
    files: TYPOGRAPHY_LINT_GLOBS,
    ignores: TYPOGRAPHY_OWNERS,
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'warn',
        { restrict: TYPOGRAPHY_RESTRICTIONS },
      ],
    },
  },""",
    }
    typography_source += shadows.get(typography_shadow, "")
    type_import_source = (
        ""
        if not type_import_block
        else """
  {
    files: ['frontend/src/**/*.{ts,tsx}', 'extension/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@flyt/ui', importNames: ['textVariants', 'headingVariants'] }] },
      ],
    },
  },"""
    )
    type_import_owner_source = (
        ""
        if not raw_form_type_owners or not type_import_block
        else """
  {
    files: RAW_FORM_TYPE_VARIANT_OWNERS,
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@flyt/ui', importNames: ['headingVariants'] }] },
      ],
    },
  },"""
    )

    return f"""export const RAW_BUTTON_OWNERS = [{_render_entries(raw_button_owners)}];
export const RAW_DIALOG_OWNERS = [];
export const CLOSED_COMPONENTS = [{_render_entries(closed_components)}];
export const RAW_ELEMENT_EXEMPT_GLOBS = [{_render_entries(globs)}];
export const IGNORED_PATHS = [{_render_entries(ignored_paths or [])}];
export const TYPOGRAPHY_LINT_GLOBS = [{_render_entries(lint_globs)}];
export const TYPOGRAPHY_OWNERS = [{_render_entries(typography_owners or [])}];
export const TYPOGRAPHY_RESTRICTIONS = [
  {{ pattern: '(^|:)text-(xs|sm)$', message: 'type scale' }},
];
export const CLASS_ASSERTION_EXEMPT_PACKAGES = [{_render_entries(exempt_packages)}];
export const CLASS_ASSERTION_EXEMPT_TESTS = [{_render_entries(exempt_tests)}];
export const STYLE_OWNERS = [{_render_entries(style_owners or [])}];
export const RAW_FORM_TYPE_VARIANT_OWNERS = [{_render_entries(raw_form_type_owners or [])}];

{surface_source}const closedSurface = ['className', 'style'].map((prop) => ({{
  selector: `JSXOpeningElement:matches(${{closedSurfaceComponents
    .map((name) => `[name.name='${{name}}']`)
    .join(', ')}}) > JSXAttribute[name.name='${{prop}}']`,
  message: 'closed surface',
}}));
const rawButton = {{
  selector: "JSXOpeningElement[name.name='button']",
  message: 'raw button',
}};
const rawDialog = {{
  selector:
    "JSXOpeningElement[name.type='JSXMemberExpression'][name.object.name='DialogPrimitive'][name.property.name=/^(Content|Overlay)$/]",
  message: 'raw dialog',
}};
const inlineStyle = {{
  selector: "JSXAttribute[name.name='style']",
  message: 'closed style',
}};
const classAssertions = [{_render_selector_entries(selectors)}].map((selector) => ({{
  selector,
  message: 'class assertion',
}}));

export default [
  {{
    ignores: [{ignores}],
  }},
  {{
    files: ['**/*.{{ts,tsx}}'],
    rules: {{
      'no-restricted-syntax': [{', '.join(main_rule)}],
    }},
  }},
  {{
    files: RAW_ELEMENT_EXEMPT_GLOBS,
    rules: {{
      'no-restricted-syntax': ['error', ...closedSurface],
    }},
  }},
  {{
    files: [{_render_literals(owner_files)}],
    rules: {{
      'no-restricted-syntax': ['error', ...closedSurface, inlineStyle],
    }},
  }},{style_owner_block}
  {{
    files: RAW_ELEMENT_EXEMPT_GLOBS,
    ignores: {enforcement_ignores},
    rules: {{
      'no-restricted-syntax': [{', '.join(enforcement_rule)}],
    }},
  }},{typography_source}{type_import_source}{type_import_owner_source}
{exempt_block}{style_shadow_block}];
"""


def _write_escapes_files(root: Path, config_source: str) -> None:
    root.mkdir(parents=True, exist_ok=True)
    (root / "package.json").write_text('{"type": "module"}\n', encoding="utf-8")
    (root / "eslint.config.js").write_text(config_source, encoding="utf-8")


def _escapes_repo(
    root: Path,
    raw_button_owners: list[str],
    closed_components: list[str],
    **options: object,
) -> None:
    _write_escapes_files(
        root, _eslint_config(raw_button_owners, closed_components, **options)
    )
    for command in (
        ["git", "init", "-q", "-b", "main"],
        ["git", "config", "user.email", "test@example.com"],
        ["git", "config", "user.name", "Test"],
        ["git", "add", "-A"],
        ["git", "commit", "-qm", "base"],
    ):
        subprocess.run(command, cwd=root, check=True, capture_output=True)


def _write_escapes_config(
    root: Path,
    raw_button_owners: list[str],
    closed_components: list[str],
    **options: object,
) -> None:
    _write_escapes_files(
        root, _eslint_config(raw_button_owners, closed_components, **options)
    )


def _git(root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments], cwd=root, text=True, capture_output=True, check=True
    )


def _run_script(
    script: Path,
    *arguments: str,
    cwd: Path,
    stdin: str = "",
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(script), *arguments],
        cwd=cwd,
        input=stdin,
        text=True,
        capture_output=True,
        check=False,
    )


def _conventions_diff(path: str, added_lines: list[str]) -> str:
    return "\n".join(
        [
            f"diff --git a/{path} b/{path}",
            "--- /dev/null",
            f"+++ b/{path}",
            f"@@ -0,0 +1,{len(added_lines)} @@",
            *(f"+{line}" for line in added_lines),
            "",
        ]
    )


def _react_doctor_report(version: str, warnings: dict[str, int] | None = None) -> str:
    diagnostics = [
        {"rule": rule, "severity": "warning"}
        for rule, count in (warnings or {}).items()
        for _ in range(count)
    ]
    return json.dumps(
        {
            "version": version,
            "summary": {
                "errorCount": 0,
                "warningCount": len(diagnostics),
                "score": 100,
            },
            "diagnostics": diagnostics,
        }
    )


def _react_doctor_baseline_version() -> str:
    return json.loads(K_REACT_DOCTOR_BASELINE.read_text(encoding="utf-8"))["version"]


def _react_doctor_checker(root: Path, scan_args: list[str]) -> Path:
    script = root / K_CHECK_REACT_DOCTOR.name
    script.write_text(
        K_CHECK_REACT_DOCTOR.read_text(encoding="utf-8"), encoding="utf-8"
    )
    baseline = json.loads(K_REACT_DOCTOR_BASELINE.read_text(encoding="utf-8"))
    baseline["scan_args"] = scan_args
    (root / K_REACT_DOCTOR_BASELINE.name).write_text(
        json.dumps(baseline), encoding="utf-8"
    )
    return script

def _lint_repo_config(relative_paths: list[str]) -> dict[str, str]:
    """What the repository's own ESLint config reports for each path."""
    result = subprocess.run(
        ["node", str(K_ESLINT), "--format", "json", *relative_paths],
        cwd=K_REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode > 1:
        raise AssertionError(f"eslint could not run: {result.stderr.strip()}")
    findings: dict[str, str] = {}
    for report in json.loads(result.stdout):
        relative = Path(report["filePath"]).relative_to(K_REPO_ROOT).as_posix()
        findings[relative] = " | ".join(
            f"{message['ruleId']}: {message['message']}"
            for message in report["messages"]
        )
    return findings


def _run_typography_semantics(
    *arguments: str, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(K_CHECK_TYPOGRAPHY_SEMANTICS), *arguments],
        cwd=K_REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
        env={**os.environ, **(env or {})},
    )


def _write_probe_files(probes: dict[str, str]) -> list[Path]:
    written = []
    for relative, source in probes.items():
        path = K_REPO_ROOT / relative
        path.write_text(source, encoding="utf-8")
        written.append(path)
    return written


def _remove_paths(paths: list[Path]) -> None:
    for path in paths:
        path.unlink(missing_ok=True)


class DesignSystemEscapeTests(unittest.TestCase):
    def test_escape_checker_given_added_raw_form_type_owner_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, [], ["Button"])
            _write_escapes_config(
                root,
                [],
                ["Button"],
                raw_form_type_owners=["frontend/src/new-control.tsx"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("frontend/src/new-control.tsx", result.stdout)

    def test_escape_checker_given_unwired_type_import_ban_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, [], ["Button"])
            _write_escapes_config(root, [], ["Button"], type_import_block=False)

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("type import restriction", result.stdout)

    def test_escape_checker_given_added_raw_button_owner_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(root, ["src/a.tsx", "src/b.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("src/b.tsx", result.stdout)

    def test_escape_checker_given_dropped_closed_component_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button", "Card"])
            _write_escapes_config(root, ["src/a.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("Card", result.stdout)

    def test_escape_checker_given_removed_then_readded_owner_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(root, [], ["Button"])
            subprocess.run(["git", "commit", "-qam", "narrow"], cwd=root, check=True, capture_output=True)
            _write_escapes_config(root, ["src/a.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("src/a.tsx", result.stdout)

    def test_escape_checker_given_acknowledged_owner_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(root, ["src/a.tsx", "src/b.tsx"], ["Button"])

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={
                    **os.environ,
                    "DESIGN_SYSTEM_ESCAPES_ACK": "src/b.tsx",
                },
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_narrowed_allowlist_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx", "src/b.tsx"], ["Button"])
            _write_escapes_config(root, ["src/a.tsx"], ["Button", "Card"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_invalid_ref_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES,
                "--repo",
                str(root),
                "--base",
                "does-not-exist-ref",
                cwd=root,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("cannot resolve base", result.stderr)

    def test_escape_checker_given_unrelated_root_commit_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            base_sha = _git(root, "rev-parse", "HEAD").stdout.strip()

            _git(root, "checkout", "--orphan", "unrelated")
            _git(root, "rm", "-rf", ".")
            _write_escapes_config(root, ["src/a.tsx"], ["Button"])
            (root / "README.md").write_text("unrelated\n", encoding="utf-8")
            _git(root, "add", "-A")
            _git(root, "commit", "-qm", "unrelated root")

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", base_sha, cwd=root
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("merge base", result.stderr)

    def test_escape_checker_given_shallow_history_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            _escapes_repo(source, ["src/a.tsx"], ["Button"])
            _write_escapes_config(source, ["src/a.tsx", "src/b.tsx"], ["Button"])
            _git(source, "commit", "-qam", "second")
            first_sha = _git(source, "rev-parse", "HEAD~1").stdout.strip()

            shallow = root / "shallow"
            _git(root, "clone", "--depth", "1", f"file://{source}", str(shallow))

            result = _run_script(
                K_CHECK_ESCAPES,
                "--repo",
                str(shallow),
                "--base",
                first_sha,
                cwd=shallow,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("cannot resolve base", result.stderr)

    def test_escape_checker_given_config_absent_at_valid_base_expect_bootstrap(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _git(root, "init", "-q", "-b", "main")
            _git(root, "config", "user.email", "test@example.com")
            _git(root, "config", "user.name", "Test")
            (root / "README.md").write_text("no config yet\n", encoding="utf-8")
            _git(root, "add", "-A")
            _git(root, "commit", "-qm", "base without config")
            _write_escapes_config(root, ["src/a.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 0)
            self.assertIn("bootstrap", result.stdout)

    def test_escape_checker_given_unspread_closed_surface_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button", "Card"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button", "Card"],
                closed_surface_in_main_rule=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("wiring", result.stdout)
            self.assertIn("frontend/src/__ratchet_probe__.tsx", result.stdout)
            self.assertIn("Card", result.stdout)

    def test_escape_checker_given_narrowed_closed_surface_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button", "Card"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button", "Card"],
                narrowed_closed_surface=True,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("className selector does not cover Card", result.stdout)

    def test_escape_checker_given_decoy_closed_component_list_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button", "Card"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button", "Card"],
                wired_closed_components=["Button"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("className selector does not cover Card", result.stdout)

    def test_escape_checker_given_unexempted_raw_button_owner_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                exempted_owners=[],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("src/a.tsx: a raw-button owner still answers", result.stdout)

    def test_escape_checker_given_ignored_probe_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                ignored_paths=["frontend/src/__ratchet_probe__.tsx"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/__ratchet_probe__.tsx: ignored by the config", result.stdout
            )

    def test_escape_checker_given_fully_wired_config_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button", "Card"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 0)
            self.assertIn("unchanged against", result.stdout)

    def test_escape_checker_given_warned_main_rule_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                main_rule_severity="warn",
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("frontend/src/__ratchet_probe__.tsx", result.stdout)
            self.assertIn("severity is", result.stdout)
            self.assertIn("not 'error'", result.stdout)

    def test_escape_checker_given_raw_button_absent_from_main_rule_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                raw_button_in_main_rule=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            for probe in (
                "frontend/src/__ratchet_probe__.tsx",
                "packages/lexicon/src/__ratchet_probe__.tsx",
                "extension/src/__ratchet_probe__.tsx",
            ):
                self.assertIn(
                    f"{probe}: must restrict the raw <button>, but does not",
                    result.stdout,
                )

    def test_escape_checker_given_added_exempt_glob_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                exempt_globs=[*K_EXEMPT_GLOBS, "frontend/src/legacy/**/*.tsx"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("+ raw-element exemption: frontend/src/legacy/**", result.stdout)

    def test_escape_checker_given_acknowledged_exempt_glob_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                exempt_globs=[*K_EXEMPT_GLOBS, "frontend/src/legacy/**/*.tsx"],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={
                    **os.environ,
                    "DESIGN_SYSTEM_ESCAPES_ACK": "frontend/src/legacy/**/*.tsx",
                },
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_comma_bearing_glob_acknowledged_by_newline_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glob = "frontend/src/legacy/**/*.{test,spec}.tsx"
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                exempt_globs=[*K_EXEMPT_GLOBS, glob],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={**os.environ, "DESIGN_SYSTEM_ESCAPES_ACK": f"\n{glob}\n"},
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_comma_bearing_glob_acknowledged_by_comma_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glob = "frontend/src/legacy/**/*.{test,spec}.tsx"
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                exempt_globs=[*K_EXEMPT_GLOBS, glob],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={**os.environ, "DESIGN_SYSTEM_ESCAPES_ACK": glob},
            )

            self.assertEqual(result.returncode, 1)

    def test_escape_checker_given_added_ignored_path_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                ignored_paths=["frontend/src/legacy/**"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("+ ignored path: frontend/src/legacy/**", result.stdout)

    def test_escape_checker_given_unlisted_exempt_glob_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                unlisted_exempt_globs=["frontend/src/legacy/**"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/legacy/**: the config selects on this raw-element "
                "exemption glob, but no list names it",
                result.stdout,
            )

    def test_escape_checker_given_unlisted_ignored_path_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                unlisted_ignored_paths=["frontend/src/legacy/**"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/legacy/**: the config selects on this ignored path glob, "
                "but no list names it",
                result.stdout,
            )

    def test_escape_checker_given_added_style_owner_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                style_owners=["src/b.tsx"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("+ style owner: src/b.tsx", result.stdout)

    def test_escape_checker_given_acknowledged_style_owner_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                style_owners=["src/b.tsx"],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={
                    **os.environ,
                    "DESIGN_SYSTEM_ESCAPES_ACK": "src/b.tsx",
                },
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_escape_checker_given_dropped_style_ban_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root, ["src/a.tsx"], ["Button"], style_in_main_rule=False
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("frontend/src/__ratchet_probe__.tsx", result.stdout)
            self.assertIn("the style attribute is not rejected here", result.stdout)

    def test_escape_checker_given_shadowed_style_ban_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root, ["src/a.tsx"], ["Button"], style_shadow=True
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("frontend/src/__ratchet_probe__.tsx", result.stdout)
            self.assertIn("the style attribute is not rejected here", result.stdout)

    def test_escape_checker_given_unwired_style_owner_standdown_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                style_owners=["src/b.tsx"],
                style_owner_standdown=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "src/b.tsx: STYLE_OWNERS keeps the style channel open here",
                result.stdout,
            )

    def test_escape_checker_given_added_class_assertion_exemption_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_packages=["packages/ui", "packages/lexicon"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "+ class-assertion exempt package: packages/lexicon", result.stdout
            )

    def test_escape_checker_given_acknowledged_class_assertion_exemption_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_packages=["packages/ui", "packages/lexicon"],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={
                    **os.environ,
                    "DESIGN_SYSTEM_ESCAPES_ACK": "packages/lexicon",
                },
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_class_assertion_ban_unwired_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_in_enforcement=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("toHaveClass is not rejected here", result.stdout)
            self.assertIn("frontend/src/__glob__/__glob__.test.ts", result.stdout)

    def test_escape_checker_given_ban_reaching_exempt_package_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_ignores_exempt=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "packages/ui/src/__ratchet_probe__.test.tsx: the exempt package's own "
                "tests must keep their class assertions",
                result.stdout,
            )

    def test_escape_checker_given_narrowed_class_assertion_selector_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_selectors=[K_CLASS_ASSERTION_SELECTORS[0]],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("toHaveClass is not rejected here", result.stdout)
            for probe in (
                "frontend/src/__glob__/__glob__.test.ts",
                "frontend/e2e/__ratchet_probe__.spec.ts",
            ):
                self.assertIn(probe, result.stdout)

    def test_escape_checker_given_wired_class_assertion_exemption_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_tests=["frontend/src/exempt.test.tsx"],
            )
            _git(root, "commit", "-qam", "class-assertion exemption")

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 0)

    def test_escape_checker_given_added_exempt_test_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_tests=["frontend/src/exempt.test.tsx"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "+ class-assertion exempt test: frontend/src/exempt.test.tsx",
                result.stdout,
            )

    def test_escape_checker_given_exempt_test_unwired_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_tests=["frontend/src/exempt.test.tsx"],
            )
            _git(root, "commit", "-qam", "class-assertion exemption")
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                class_assertion_exempt_tests=["frontend/src/exempt.test.tsx"],
                class_assertion_exempt_wired=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/exempt.test.tsx: this test's subject is not perceivable in "
                "the DOM, so the ban must stand down for it",
                result.stdout,
            )

    def test_escape_checker_given_base_config_at_old_location_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _git(root, "init", "-q", "-b", "main")
            _git(root, "config", "user.email", "test@example.com")
            _git(root, "config", "user.name", "Test")
            previous = root / "frontend/eslint.config.js"
            previous.parent.mkdir(parents=True)
            previous.write_text(
                "export const RAW_BUTTON_OWNERS = [];\nexport default [];\n",
                encoding="utf-8",
            )
            _git(root, "add", "-A")
            _git(root, "commit", "-qm", "config at the old location")
            _write_escapes_config(root, ["src/a.tsx"], ["Button"])

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("predates the config's move", result.stdout)
            self.assertNotIn("bootstrap", result.stdout)

    def test_escape_checker_given_old_config_without_exports_expect_bootstrap(self) -> None:
        for wired in (True, False):
            with self.subTest(wired=wired), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                _git(root, "init", "-q", "-b", "main")
                _git(root, "config", "user.email", "test@example.com")
                _git(root, "config", "user.name", "Test")
                previous = root / "frontend/eslint.config.js"
                previous.parent.mkdir(parents=True)
                previous.write_text(
                    "const RAW_BUTTON_OWNERS = [];\nexport default [];\n",
                    encoding="utf-8",
                )
                _git(root, "add", "-A")
                _git(root, "commit", "-qm", "config without design-system allowlists")
                _write_escapes_config(
                    root,
                    ["src/a.tsx"],
                    ["Button"],
                    closed_surface_in_main_rule=wired,
                )

                result = _run_script(
                    K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
                )

                self.assertEqual(result.returncode, 0 if wired else 1)
                self.assertIn("bootstrap", result.stdout)
                if not wired:
                    self.assertIn("wiring no longer consumes", result.stdout)

    def test_escape_checker_given_bootstrap_with_unwired_rule_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _git(root, "init", "-q", "-b", "main")
            _git(root, "config", "user.email", "test@example.com")
            _git(root, "config", "user.name", "Test")
            (root / "README.md").write_text("no config yet\n", encoding="utf-8")
            _git(root, "add", "-A")
            _git(root, "commit", "-qm", "base without config")
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                closed_surface_in_main_rule=False,
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("bootstrap", result.stdout)
            self.assertIn("wiring no longer consumes", result.stdout)
            self.assertIn("frontend/src/__ratchet_probe__.tsx", result.stdout)


    def test_escape_checker_given_dropped_typography_block_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root, ["src/a.tsx"], ["Button"], typography_block=False
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("wiring no longer consumes", result.stdout)
            self.assertIn(
                "frontend/src/__glob__/__glob__.ts: the config resolves 0 of 1 type "
                "restrictions for this path",
                result.stdout,
            )

    def test_escape_checker_given_shadowed_typography_rule_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root, ["src/a.tsx"], ["Button"], typography_shadow="rule"
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/__glob__/__glob__.tsx: the config resolves 0 of 1 type "
                "restrictions for this path",
                result.stdout,
            )

    def test_escape_checker_given_typography_rule_spread_into_owners_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                typography_owners=["frontend/src/owned.tsx"],
                typography_shadow="owners",
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/__glob__/__glob__.tsx: the config resolves 0 of 1 type "
                "restrictions for this path",
                result.stdout,
            )

    def test_escape_checker_given_warned_typography_rule_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root, ["src/a.tsx"], ["Button"], typography_shadow="severity"
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "frontend/src/__glob__/__glob__.ts: better-tailwindcss/"
                "no-restricted-classes severity is 1, not 'error'",
                result.stdout,
            )

    def test_escape_checker_given_dropped_type_lint_glob_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(
                root,
                ["src/a.tsx"],
                ["Button"],
                typography_lint_globs=[
                    "frontend/src/**/*.{ts,tsx}",
                    "extension/src/**/*.{ts,tsx}",
                ],
            )
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                typography_lint_globs=["frontend/src/**/*.{ts,tsx}"],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "- type lint glob: extension/src/**/*.{ts,tsx}", result.stdout
            )

    def test_escape_checker_given_acknowledged_type_lint_glob_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                typography_lint_globs=["frontend/src/legacy/**/*.{ts,tsx}"],
            )

            result = subprocess.run(
                ["python3", str(K_CHECK_ESCAPES), "--repo", str(root), "--base", "HEAD"],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
                env={
                    **os.environ,
                    "DESIGN_SYSTEM_ESCAPES_ACK": "\n".join(
                        [
                            "frontend/src/**/*.{ts,tsx}",
                            "frontend/src/legacy/**/*.{ts,tsx}",
                        ]
                    ),
                },
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_escape_checker_given_added_type_lint_glob_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _escapes_repo(root, ["src/a.tsx"], ["Button"])
            _write_escapes_config(
                root,
                ["src/a.tsx"],
                ["Button"],
                typography_lint_globs=[
                    "frontend/src/**/*.{ts,tsx}",
                    "extension/src/**/*.{ts,tsx}",
                ],
            )

            result = _run_script(
                K_CHECK_ESCAPES, "--repo", str(root), "--base", "HEAD", cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn(
                "+ type lint glob: extension/src/**/*.{ts,tsx}", result.stdout
            )


class TypographyRuleTests(unittest.TestCase):
    """What the repository's own config does to a file carrying a bare utility.

    The fixtures are written into the paths the config lints, because the rule
    under test is the one the working tree resolves for real files.
    """

    def test_typography_rule_given_bare_utility_fixture_expect_rejection(self) -> None:
        written = _write_probe_files(K_TYPOGRAPHY_PROBES)
        try:
            findings = _lint_repo_config(list(K_TYPOGRAPHY_PROBES))
        finally:
            _remove_paths(written)

        for relative in K_TYPOGRAPHY_PROBES:
            self.assertIn(
                K_TYPE_SCALE_MESSAGE, findings.get(relative, ""), relative
            )
        self.assertIn(
            K_TYPE_LEADING_MESSAGE,
            findings["packages/ui/src/__typography_probe__.tsx"],
        )

    def test_typography_rule_given_owner_listed_recipe_expect_silence(self) -> None:
        probe = "packages/ui/src/__typography_probe__.tsx"
        written = _write_probe_files({probe: K_TYPOGRAPHY_PROBES[probe]})
        try:
            findings = _lint_repo_config([probe, K_TYPOGRAPHY_OWNER_RECIPE])
        finally:
            _remove_paths(written)

        self.assertIn(K_TYPE_SCALE_MESSAGE, findings[probe])
        self.assertNotIn(
            K_TYPOGRAPHY_RULE, findings.get(K_TYPOGRAPHY_OWNER_RECIPE, "")
        )


class UILayerBoundaryTests(unittest.TestCase):
    """What the repository's own config does to an import across UI layers.

    The probes are written under the package sources the layer rules resolve
    for, because the rule under test is the one the working tree gives real
    files, not the one a copied config would give a fixture.
    """

    def test_layer_boundary_given_lexicon_import_of_ui_expect_no_restriction(
        self,
    ) -> None:
        probe = {
            K_LEXICON_LAYER_PROBE: (
                "import { Button } from '@flyt/ui';\n"
                "\n"
                "export function LayerProbe() {\n"
                "  return <Button />;\n"
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            findings = _lint_repo_config(list(probe))
        finally:
            _remove_paths(written)

        self.assertNotIn(
            "no-restricted-imports", findings.get(K_LEXICON_LAYER_PROBE, "")
        )

    def test_layer_boundary_given_ui_import_of_lexicon_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_UI_LAYER_PROBE: "import { LemmaHeader } from '@flyt/lexicon';\n"
        }
        written = _write_probe_files(probe)
        try:
            findings = _lint_repo_config(list(probe))
        finally:
            _remove_paths(written)

        self.assertIn("no-restricted-imports", findings[K_UI_LAYER_PROBE])
        self.assertIn(K_UI_LAYER_MESSAGE, findings[K_UI_LAYER_PROBE])

    def test_layer_boundary_given_ui_import_of_extension_source_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_UI_LAYER_PROBE: (
                "import { popupView } from "
                "'../../../extension/src/popup/popupView';\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            findings = _lint_repo_config(list(probe))
        finally:
            _remove_paths(written)

        self.assertIn("no-restricted-imports", findings[K_UI_LAYER_PROBE])
        self.assertIn(K_UI_LAYER_MESSAGE, findings[K_UI_LAYER_PROBE])

    def test_layer_boundary_given_lexicon_import_of_app_alias_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_LEXICON_LAYER_PROBE: (
                "import { BackLink } from "
                "'@/components/common/BackLink/BackLink';\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            findings = _lint_repo_config(list(probe))
        finally:
            _remove_paths(written)

        self.assertIn("no-restricted-imports", findings[K_LEXICON_LAYER_PROBE])
        self.assertIn(K_LEXICON_LAYER_MESSAGE, findings[K_LEXICON_LAYER_PROBE])

    def test_layer_boundary_given_lexicon_import_of_frontend_source_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_LEXICON_LAYER_PROBE: (
                "import { BackLink } from "
                "'../../../frontend/src/components/common/BackLink/BackLink';\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            findings = _lint_repo_config(list(probe))
        finally:
            _remove_paths(written)

        self.assertIn("no-restricted-imports", findings[K_LEXICON_LAYER_PROBE])
        self.assertIn(K_LEXICON_LAYER_MESSAGE, findings[K_LEXICON_LAYER_PROBE])


class TypographySemanticsTests(unittest.TestCase):
    """What the compiler says a string does, for both design systems.

    The corpus carries the spellings the regex layer was probed to miss, so a
    pattern that loosens fails on behaviour even though the string ratchet
    cannot tell a tightened regex from a loosened one.
    """

    def test_typography_semantics_given_uncommitted_source_deletion_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {
                "package.json": '{"type":"module"}',
                ".gitignore": "node_modules/\n",
                "eslint.config.js": (
                    "export const CLASS_ASSERTION_EXEMPT_PACKAGES = [];\n"
                    "export const CLASS_ASSERTION_EXEMPT_TESTS = [];\n"
                    "export const IGNORED_PATHS = [];\n"
                    "export const TYPOGRAPHY_OWNERS = [];\n"
                    "export const TYPOGRAPHY_LINT_GLOBS = ['frontend/src/**/*.tsx'];\n"
                ),
                "scripts/check_typography_semantics.mjs": (
                    K_CHECK_TYPOGRAPHY_SEMANTICS.read_text(encoding="utf-8")
                ),
                "scripts/typography_semantics_baseline.json": '{"findings":[]}',
                "frontend/src/index.css": '@import "tailwindcss";\n',
                "packages/ui/src/styles/entry.css": '@import "tailwindcss";\n',
                "extension/tailwind/index.css": '@import "tailwindcss";\n',
                "frontend/src/RemovedCard.tsx": (
                    'export function RemovedCard() { return <div className="text-sm" />; }\n'
                ),
            }
            for relative, source in files.items():
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(source, encoding="utf-8")
            _git(root, "init", "-q")
            _git(root, "add", "-A")
            _git(
                root,
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=Test",
                "commit",
                "-qm",
                "base",
            )
            for package in ("frontend", "packages/ui", "extension"):
                (root / package / "node_modules").symlink_to(
                    K_REPO_ROOT / package / "node_modules", target_is_directory=True
                )
            (root / "frontend/src/RemovedCard.tsx").unlink()
            result = subprocess.run(
                [
                    "node",
                    str(root / "scripts/check_typography_semantics.mjs"),
                    "--base",
                    "HEAD",
                ],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("nothing new", result.stdout)

    def test_typography_semantics_given_the_style_sheet_entries_expect_the_extension_sheet_compiled(
        self,
    ) -> None:
        source = K_CHECK_TYPOGRAPHY_SEMANTICS.read_text(encoding="utf-8")
        entries_match = re.search(
            r"const STYLE_SHEET_ENTRIES = \[(.*?)\];", source, flags=re.DOTALL
        )
        self.assertIsNotNone(entries_match, "STYLE_SHEET_ENTRIES is missing")
        entries = re.findall(r"'([^']+)'", entries_match.group(1))

        self.assertEqual(
            entries,
            [
                "frontend/src/index.css",
                "packages/ui/src/styles/entry.css",
                "extension/tailwind/index.css",
            ],
        )

    def test_typography_semantics_given_typography_spellings_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_SEMANTIC_PROBE: (
                "export function TypographySemanticsProbe() {\n"
                "  return (\n"
                "    <p\n"
                "      className={`"
                + " ".join(K_SEMANTIC_REJECT_CLASSES)
                + "`}\n"
                "    >\n"
                "      probe\n"
                "    </p>\n"
                "  );\n"
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics()
        finally:
            _remove_paths(written)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        for candidate in K_SEMANTIC_REJECT_CLASSES:
            self.assertIn(f"{K_SEMANTIC_PROBE}: {candidate} sets", result.stdout)
        for candidate, property_name in K_SEMANTIC_PROPERTY_BY_CLASS.items():
            self.assertIn(f"{candidate} sets {property_name}", result.stdout)

    def test_typography_semantics_given_a_file_nested_several_directories_deep_expect_rejection(
        self,
    ) -> None:
        probe = {
            K_DEPTH_PROBE: (
                "export function TypographyDepthProbe() {\n"
                '  return <p className="text-sm">probe</p>;\n'
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics()
        finally:
            _remove_paths(written)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"{K_DEPTH_PROBE}: text-sm sets", result.stdout)

    def test_typography_semantics_given_non_typography_strings_expect_success(
        self,
    ) -> None:
        probe = {
            K_SEMANTIC_PROBE: (
                "export function TypographySemanticsProbe() {\n"
                "  return (\n"
                "    <p\n"
                "      className={`"
                + " ".join(K_SEMANTIC_ACCEPT_CLASSES)
                + "`}\n"
                "    >\n"
                "      learning to read Norwegian together\n"
                "    </p>\n"
                "  );\n"
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics()
        finally:
            _remove_paths(written)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(K_SEMANTIC_PROBE, result.stdout)

    def test_typography_semantics_given_group_marker_class_expect_silence(
        self,
    ) -> None:
        probe = {
            K_GROUP_PROBE: (
                "export function GroupProbe() {\n"
                '  return <p className="group">probe</p>;\n'
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics()
        finally:
            _remove_paths(written)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(K_GROUP_PROBE, result.stdout)

    def test_typography_semantics_given_group_hover_variant_expect_isolated_finding(
        self,
    ) -> None:
        probe = {
            K_GROUP_PROBE: (
                "export function GroupProbe() {\n"
                '  return <p className="group-hover:text-sm">probe</p>;\n'
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics()
        finally:
            _remove_paths(written)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"{K_GROUP_PROBE}: group-hover:text-sm sets font-size, line-height",
            result.stdout,
        )
        self.assertNotIn("packages/ui/src/components/", result.stdout)


class TypographyBaselineRatchetTests(unittest.TestCase):
    """The baseline is an allowlist like any other: growth needs an ack.

    The ratchet reads the baseline as of the merge base, so the tests point
    --base at commits of this repository and edit the working-tree file the
    way a widening would.
    """

    def test_typography_semantics_given_added_baseline_entry_expect_failure(
        self,
    ) -> None:
        baseline_path = self._baseline_path()
        original = self._baseline_with_added_probe_entry()
        probe = {
            K_GROUP_PROBE: (
                "export function GroupProbe() {\n"
                '  return <p className="text-sm">probe</p>;\n'
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics("--base", "HEAD")
        finally:
            _remove_paths(written)
            baseline_path.write_text(original, encoding="utf-8")

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"+ {K_GROUP_PROBE}: text-sm", result.stdout)
        self.assertIn("DESIGN_SYSTEM_ESCAPES_ACK", result.stdout)
        self.assertNotIn(f"{K_GROUP_PROBE}: text-sm sets", result.stdout)

    def test_typography_semantics_given_acknowledged_baseline_entry_expect_success(
        self,
    ) -> None:
        baseline_path = self._baseline_path()
        original = self._baseline_with_added_probe_entry()
        probe = {
            K_GROUP_PROBE: (
                "export function GroupProbe() {\n"
                '  return <p className="text-sm">probe</p>;\n'
                "}\n"
            )
        }
        written = _write_probe_files(probe)
        try:
            result = _run_typography_semantics(
                "--base",
                "HEAD",
                env={"DESIGN_SYSTEM_ESCAPES_ACK": K_GROUP_PROBE},
            )
        finally:
            _remove_paths(written)
            baseline_path.write_text(original, encoding="utf-8")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("nothing new", result.stdout)

    def test_typography_semantics_given_removed_baseline_entry_expect_no_growth_report(
        self,
    ) -> None:
        baseline_path = self._baseline_path()
        original = self._baseline_with_removed_card_entry()
        try:
            result = _run_typography_semantics("--base", "HEAD")
        finally:
            baseline_path.write_text(original, encoding="utf-8")

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            "packages/ui/src/components/card.tsx: tracking-tight sets letter-spacing",
            result.stdout,
        )
        self.assertNotIn("grew against", result.stdout)

    def test_typography_semantics_given_baseline_absent_at_base_expect_bootstrap(
        self,
    ) -> None:
        result = _run_typography_semantics("--base", self._first_baseline_commit())

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("first-time bootstrap", result.stdout)

    def _baseline_path(self) -> Path:
        return K_REPO_ROOT / "scripts" / "typography_semantics_baseline.json"

    def _baseline_with_added_probe_entry(self) -> str:
        baseline_path = self._baseline_path()
        original = baseline_path.read_text(encoding="utf-8")
        baseline = json.loads(original)
        baseline["findings"].append(
            {
                "file": K_GROUP_PROBE,
                "candidate": "text-sm",
                "reason": "any reason goes here",
            }
        )
        baseline_path.write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        return original

    def _baseline_with_removed_card_entry(self) -> str:
        baseline_path = self._baseline_path()
        original = baseline_path.read_text(encoding="utf-8")
        baseline = json.loads(original)
        baseline["findings"] = [
            finding
            for finding in baseline["findings"]
            if finding["file"] != "packages/ui/src/components/card.tsx"
        ]
        baseline_path.write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        return original

    def _first_baseline_commit(self) -> str:
        introduced = subprocess.run(
            [
                "git",
                "rev-list",
                "HEAD",
                "--",
                "scripts/typography_semantics_baseline.json",
            ],
            cwd=K_REPO_ROOT,
            text=True,
            capture_output=True,
            check=True,
        ).stdout.splitlines()
        return f"{introduced[-1]}~1"


class StyleAttributeBanTests(unittest.TestCase):
    """The style attribute is closed by one selector, with STYLE_OWNERS as the
    ratcheted stand-down, threaded through the raw-element restrictions."""

    def test_style_attribute_ban_given_inline_style_fixture_expect_rejection(
        self,
    ) -> None:
        probe = "frontend/src/__style_probe__.tsx"
        source = (
            "export function StyleProbe() {\n"
            "  return (\n"
            "    <>\n"
            "      <p style={{ color: 'red' }}>literal</p>\n"
            "      <p style={undefined}>discard</p>\n"
            "    </>\n"
            "  );\n"
            "}\n"
        )
        written = _write_probe_files({probe: source})
        try:
            findings = _lint_repo_config([probe])
        finally:
            _remove_paths(written)

        self.assertIn(K_STYLE_MESSAGE, findings.get(probe, ""))

    def test_style_attribute_ban_given_owner_listed_file_expect_silence(
        self,
    ) -> None:
        owned = [
            "frontend/src/pages/HomePage/components/QueueDiagram.tsx",
            "frontend/src/components/flashcard/TokenBoard/TokenBoard.tsx",
            "frontend/src/components/flashcard/FlashCardWrite/FlashCardWrite.stories.tsx",
        ]
        findings = _lint_repo_config(owned)

        for relative in owned:
            self.assertNotIn(K_STYLE_MESSAGE, findings.get(relative, ""))


class QualityCheckerTests(unittest.TestCase):
    def test_conventions_checker_given_declaration_prose_in_string_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "frontend/src/example.ts"
            source.parent.mkdir(parents=True)
            lines = ["const message = 'Text owns the type scale. Ask for size=.';"]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("frontend/src/example.ts", lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-TS004", result.stdout)

    def test_conventions_checker_given_declaration_prose_in_url_string_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "frontend/src/example.ts"
            source.parent.mkdir(parents=True)
            lines = ["const message = 'type scale = https://example.com';"]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("frontend/src/example.ts", lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-TS004", result.stdout)

    def test_conventions_checker_given_lowercase_type_declaration_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "frontend/src/example.ts"
            source.parent.mkdir(parents=True)
            lines = ["type scale = { step: number };"]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("frontend/src/example.ts", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-TS004", result.stdout)

    def test_conventions_checker_given_new_constant_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/example.py"
            source.parent.mkdir(parents=True)
            source.write_text("BAD = 1\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/example.py", ["BAD = 1"]),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-PY006", result.stdout)

    def test_conventions_checker_given_new_non_predicate_bool_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/example.py"
            source.parent.mkdir(parents=True)
            lines = ["def evaluate() -> bool:", "    return True"]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/example.py", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-PY007", result.stdout)

    def test_conventions_checker_given_unchanged_finding_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/example.py"
            source.parent.mkdir(parents=True)
            source.write_text(
                "BAD = 1\ndef is_ready() -> bool:\n    return True\n", encoding="utf-8"
            )
            diff = (
                "diff --git a/backend/flyt/example.py b/backend/flyt/example.py\n"
                "--- a/backend/flyt/example.py\n"
                "+++ b/backend/flyt/example.py\n"
                "@@ -1,1 +1,3 @@\n"
                " BAD = 1\n"
                "+def is_ready() -> bool:\n"
                "+    return True\n"
            )

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=diff,
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-PY006", result.stdout)

    def test_conventions_checker_given_generated_types_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "frontend/src/types/api.generated.ts"
            source.parent.mkdir(parents=True)
            lines = ["export interface paths {", "  webhooks: never;", "}"]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)

    def test_conventions_checker_given_route_commit_on_session_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/router.py"
            source.parent.mkdir(parents=True)
            lines = [
                '@router.post("")',
                "async def create_thing() -> None:",
                "    await db.commit()",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/router.py", lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-FAPI001", result.stdout)

    def test_conventions_checker_given_route_write_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/router.py"
            source.parent.mkdir(parents=True)
            lines = [
                '@router.post("")',
                "async def create_thing() -> None:",
                "    db.add(Thing())",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/router.py", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-FAPI001", result.stdout)

    def test_conventions_checker_given_route_flush_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/router.py"
            source.parent.mkdir(parents=True)
            lines = [
                '@router.post("")',
                "async def create_thing() -> None:",
                "    await db.flush()",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/router.py", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-FAPI001", result.stdout)

    def test_conventions_checker_given_route_foreign_commit_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/router.py"
            source.parent.mkdir(parents=True)
            lines = [
                '@router.post("")',
                "async def create_thing() -> None:",
                "    await service.commit()",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/router.py", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-FAPI001", result.stdout)

    def test_conventions_checker_given_service_commit_expect_failure(self) -> None:
        for name in (
            "services.py",
            "service.py",
            "card_service.py",
            "content_service.py",
        ):
            with self.subTest(module=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                relative_path = f"backend/flyt/apps/example/{name}"
                source = root / relative_path
                source.parent.mkdir(parents=True)
                lines = [
                    "class ExampleService:",
                    "    async def save(self) -> None:",
                    "        await self._db.commit()",
                ]
                source.write_text("\n".join(lines) + "\n", encoding="utf-8")

                result = _run_script(
                    K_CHECK_CONVENTIONS,
                    "--root",
                    str(root),
                    "--diff-stdin",
                    cwd=root,
                    stdin=_conventions_diff(relative_path, lines),
                )

                self.assertEqual(result.returncode, 1)
                self.assertIn("UME-FAPI005", result.stdout)

    def test_conventions_checker_given_service_commit_with_ignore_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/services.py"
            source.parent.mkdir(parents=True)
            lines = [
                "class ExampleService:",
                "    async def save(self) -> None:",
                "        # ume-ignore: UME-FAPI005 — reason",
                "        await self._db.commit()",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/services.py", lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-FAPI005", result.stdout)

    def test_conventions_checker_given_service_flush_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "backend/flyt/apps/example/services.py"
            source.parent.mkdir(parents=True)
            lines = [
                "class ExampleService:",
                "    async def save(self) -> None:",
                "        await self._db.flush()",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff("backend/flyt/apps/example/services.py", lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-FAPI005", result.stdout)

    def test_conventions_checker_given_class_name_read_in_test_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative_path = "frontend/src/example.test.tsx"
            source = root / relative_path
            source.parent.mkdir(parents=True)
            lines = [
                "const classOf = (element: HTMLElement) => element.className;",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff(relative_path, lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-DS004", result.stdout)

    def test_conventions_checker_given_destructured_class_list_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative_path = "frontend/src/example.test.tsx"
            source = root / relative_path
            source.parent.mkdir(parents=True)
            lines = [
                "const { classList } = document.createElement('div');",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff(relative_path, lines),
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("UME-DS004", result.stdout)

    def test_conventions_checker_given_class_read_outside_a_test_expect_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative_path = "frontend/src/example.tsx"
            source = root / relative_path
            source.parent.mkdir(parents=True)
            lines = [
                "const classOf = (element: HTMLElement) => element.className;",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff(relative_path, lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-DS004", result.stdout)

    def test_conventions_checker_given_class_read_in_design_system_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative_path = "packages/ui/src/components/example.test.tsx"
            source = root / relative_path
            source.parent.mkdir(parents=True)
            lines = [
                "expect(button.className).not.toContain('opacity-50');",
            ]
            source.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = _run_script(
                K_CHECK_CONVENTIONS,
                "--root",
                str(root),
                "--diff-stdin",
                cwd=root,
                stdin=_conventions_diff(relative_path, lines),
            )

            self.assertEqual(result.returncode, 0)
            self.assertNotIn("UME-DS004", result.stdout)


class ReactDoctorRatchetTests(unittest.TestCase):
    def test_react_doctor_checker_given_mismatched_report_version_expect_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "react-doctor.json"
            report.write_text(
                _react_doctor_report("0.0.0-baseline-mismatch"), encoding="utf-8"
            )

            result = _run_script(
                K_CHECK_REACT_DOCTOR, "--report", str(report), cwd=root
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("does not match baseline version", result.stderr)
            self.assertIn("pnpm exec react-doctor", result.stderr)
            self.assertIn("--json-out", result.stderr)
            self.assertNotIn("passed", result.stdout)

    def test_react_doctor_checker_given_matching_report_version_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "react-doctor.json"
            report.write_text(
                _react_doctor_report(_react_doctor_baseline_version()), encoding="utf-8"
            )

            result = _run_script(
                K_CHECK_REACT_DOCTOR, "--report", str(report), cwd=root
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("React Doctor ratchet passed", result.stdout)
            self.assertNotIn("does not match baseline version", result.stderr)

    def test_react_doctor_checker_given_extra_scan_arg_expect_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = _react_doctor_checker(
                root, ["--no-dead-code", "--no-supply-chain", "--no-warnings"]
            )
            report = root / "react-doctor.json"
            report.write_text(
                _react_doctor_report(_react_doctor_baseline_version()), encoding="utf-8"
            )

            result = _run_script(script, "--report", str(report), cwd=root)

            self.assertEqual(result.returncode, 1)
            self.assertIn("do not match the sanctioned", result.stderr)
            self.assertIn("--no-warnings", result.stderr)
            self.assertNotIn("passed", result.stdout)

    def test_react_doctor_checker_given_sanctioned_scan_args_expect_success(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = _react_doctor_checker(
                root, ["--no-dead-code", "--no-supply-chain"]
            )
            report = root / "react-doctor.json"
            report.write_text(
                _react_doctor_report(_react_doctor_baseline_version()), encoding="utf-8"
            )

            result = _run_script(script, "--report", str(report), cwd=root)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("React Doctor ratchet passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
