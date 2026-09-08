#!/usr/bin/env python3
"""Run deterministic repository convention checks on changed source files.

The checker uses Python's AST for Python files and conservative regular
expressions for JavaScript and TypeScript files. It never imports or executes
the target project.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import asdict
from dataclasses import dataclass
from pathlib import Path

K_SOURCE_SUFFIXES = {".js", ".jsx", ".py", ".pyi", ".ts", ".tsx"}
K_SKIP_DIRS = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
}
K_GENERATED_SUFFIXES = (".generated.ts", ".gen.ts")
K_TRANSPORT_MODULES = {"aiohttp", "httpx", "requests", "urllib"}
K_HTTP_METHODS = {"delete", "get", "head", "patch", "post", "put", "request"}
K_NETWORK_CALLS = {
    *(f"requests.{method}" for method in K_HTTP_METHODS),
    *(f"httpx.{method}" for method in K_HTTP_METHODS),
    "httpx.Client",
    "httpx.AsyncClient",
    "urllib.request.urlopen",
    "aiohttp.ClientSession",
}
K_BLOCKING_CALLS = {
    *(f"requests.{method}" for method in K_HTTP_METHODS),
    *(f"httpx.{method}" for method in K_HTTP_METHODS),
    "urllib.request.urlopen",
    "subprocess.run",
    "time.sleep",
}
K_SECRET_NAME = re.compile(
    r"(?:API_KEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET)$",
    re.IGNORECASE,
)
K_SNAKE_CASE = re.compile(r"^[a-z_][a-z0-9_]*$")
K_CONSTANT_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")
K_PASCAL_CASE = re.compile(r"^[A-Z][A-Za-z0-9]*$")
K_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
K_MIN_GETATTR_ARGS = 2
K_MIN_SECRET_LENGTH = 6
K_NOQA = re.compile(
    r"(?:#|//).*?(?:noqa|ume-ignore)(?::\s*([^\s]+(?:\s*,\s*[^\s]+)*))?", re.IGNORECASE
)
K_DATABASE_ROOTS = {"db", "database", "session", "unit_of_work", "uow"}
K_SERVICE_MODULE_NAMES = {"services.py", "service.py"}
K_UNSUPPRESSIBLE_RULES = frozenset({"UME-FAPI005"})


@dataclass(frozen=True)
class Finding:
    rule: str
    path: str
    line: int
    message: str


def _is_single_private(name: str) -> bool:
    return name.startswith("_") and not name.startswith("__")


def _qualified_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _qualified_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return None


def _root_name(node: ast.AST) -> str | None:
    while isinstance(node, ast.Attribute):
        node = node.value
    return node.id if isinstance(node, ast.Name) else None


def _target_names(node: ast.AST) -> Iterable[str]:
    if isinstance(node, ast.Name):
        yield node.id
    elif isinstance(node, (ast.Tuple, ast.List)):
        for child in node.elts:
            yield from _target_names(child)


def _has_keyword(call: ast.Call, name: str) -> bool:
    return any(keyword.arg == name for keyword in call.keywords)


def _is_safe_yaml_loader(call: ast.Call) -> bool:
    for keyword in call.keywords:
        if keyword.arg != "Loader":
            continue
        qualified = _qualified_name(keyword.value)
        return qualified in {"SafeLoader", "yaml.SafeLoader"}
    return False


def _is_suppressed(lines: list[str], line: int, rule: str) -> bool:
    for index in (line - 1, line - 2):
        if index < 0 or index >= len(lines):
            continue
        match = K_NOQA.search(lines[index])
        if not match:
            continue
        codes = match.group(1)
        if not codes or rule.lower() in {
            code.strip().lower() for code in codes.split(",")
        }:
            return True
    return False


class Checker:
    def __init__(self, root: Path, changed_lines: dict[str, set[int]] | None) -> None:
        self.root = root
        self.changed_lines = changed_lines
        self.findings: list[Finding] = []

    def emit(
        self,
        path: str,
        line: int,
        rule: str,
        message: str,
        lines: list[str],
        related_lines: Iterable[int] = (),
    ) -> None:
        candidates = [line, *related_lines]
        if self.changed_lines is not None:
            changed = self.changed_lines.get(path, set())
            changed_candidates = [
                candidate for candidate in candidates if candidate in changed
            ]
            if not changed_candidates:
                return
            line = changed_candidates[0]
        if rule not in K_UNSUPPRESSIBLE_RULES and _is_suppressed(lines, line, rule):
            return
        finding = Finding(rule, path, line, message)
        if finding not in self.findings:
            self.findings.append(finding)


def _python_imports(tree: ast.AST) -> tuple[set[str], set[str], set[str]]:
    imported_names: set[str] = set()
    legacy_names: set[str] = set()
    legacy_qualified: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                bound_name = alias.asname or alias.name.split(".")[0]
                imported_names.add(bound_name)
                if alias.name.startswith("sqlalchemy.") or alias.name == "sqlalchemy":
                    legacy_qualified.update(
                        {
                            f"{bound_name}.Column",
                            f"{bound_name}.orm.declarative_base",
                        }
                    )
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == "*":
                    continue
                bound_name = alias.asname or alias.name
                imported_names.add(bound_name)
                if node.module == "sqlalchemy" and alias.name == "Column":
                    legacy_names.add(bound_name)
                if node.module == "sqlalchemy.orm" and alias.name == "declarative_base":
                    legacy_names.add(bound_name)

    return imported_names, legacy_names, legacy_qualified


def _is_route_decorator(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
        return False
    return node.func.attr in K_HTTP_METHODS - {"request"}


def _is_migration_path(path: str) -> bool:
    parts = set(Path(path).parts)
    return bool(parts & {"alembic", "migrations"}) or Path(path).name.startswith(
        "migration"
    )


def _has_k_constant_scope(path: str) -> bool:
    if _is_migration_path(path):
        return False
    parts = Path(path).parts
    try:
        tests_index = parts.index("tests")
    except ValueError:
        return True
    return tests_index + 1 < len(parts) and parts[tests_index + 1] == "integration"


def _is_bool_returning(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    annotation = node.returns
    if isinstance(annotation, ast.Name):
        return annotation.id == "bool"
    return isinstance(annotation, ast.Constant) and annotation.value == "bool"


def _is_predicate_name(name: str) -> bool:
    visible_name = name[1:] if _is_single_private(name) else name
    return visible_name.startswith(("is_", "has_"))


def _check_python(  # noqa: C901, PLR0912, PLR0915
    checker: Checker, path: str, text: str, django_evidence: bool
) -> None:
    lines = text.splitlines()
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as error:
        checker.emit(
            path,
            error.lineno or 1,
            "UME-TOOL001",
            f"Python file cannot be parsed: {error.msg}",
            lines,
        )
        return

    imported_names, legacy_names, legacy_qualified = _python_imports(tree)

    # UME-DJ001: Django settings are accessed through django.conf.settings.
    if django_evidence:
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                invalid = any(
                    alias.name == "settings" or alias.name.endswith(".settings")
                    for alias in node.names
                )
            elif isinstance(node, ast.ImportFrom):
                invalid = bool(
                    node.module
                    and (node.module == "settings" or node.module.endswith(".settings"))
                )
            else:
                continue
            if invalid:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-DJ001",
                    "import Django settings through `django.conf.settings`, not a settings module",
                    lines,
                )

    # UME-PY001: mutable default values are unambiguous AST findings.
    mutable_nodes = (
        ast.List,
        ast.Dict,
        ast.Set,
        ast.ListComp,
        ast.DictComp,
        ast.SetComp,
    )
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defaults = [default for default in node.args.defaults]
            defaults.extend(
                default for default in node.args.kw_defaults if default is not None
            )
            for default in defaults:
                if isinstance(default, mutable_nodes) or (
                    isinstance(default, ast.Call)
                    and _qualified_name(default.func) in {"list", "dict", "set"}
                ):
                    checker.emit(
                        path,
                        default.lineno,
                        "UME-PY001",
                        "mutable default argument; use a sentinel or a factory",
                        lines,
                    )

    # UME-PY002: a single-leading-underscore name is file-local.
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _is_single_private(alias.name.rsplit(".", 1)[-1]):
                    checker.emit(
                        path,
                        node.lineno,
                        "UME-PY002",
                        "private module name is imported across a file boundary",
                        lines,
                    )
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if _is_single_private(alias.name):
                    checker.emit(
                        path,
                        node.lineno,
                        "UME-PY002",
                        "private function or method is imported across a file boundary",
                        lines,
                    )
        elif isinstance(node, ast.Attribute) and _is_single_private(node.attr):
            if _root_name(node.value) in imported_names:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY002",
                    "private attribute is accessed across a file boundary",
                    lines,
                )
        elif (
            isinstance(node, ast.Call)
            and _qualified_name(node.func) == "getattr"
            and len(node.args) >= K_MIN_GETATTR_ARGS
            and isinstance(node.args[1], ast.Constant)
        ):
            private_name = node.args[1].value
            if isinstance(private_name, str) and _is_single_private(private_name):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY002",
                    "private attribute is accessed dynamically across a file boundary",
                    lines,
                )

    for node in ast.walk(tree):
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if not any(
            isinstance(target, ast.Name) and target.id == "__all__"
            for target in targets
        ):
            continue
        values = (
            node.value.elts
            if isinstance(node.value, (ast.List, ast.Tuple, ast.Set))
            else []
        )
        for value in values:
            if (
                isinstance(value, ast.Constant)
                and isinstance(value.value, str)
                and _is_single_private(value.value)
            ):
                checker.emit(
                    path,
                    value.lineno,
                    "UME-PY002",
                    "private name is exported through `__all__`; use a public name",
                    lines,
                )

    # UME-PY003: public definitions precede file-local helpers.
    private_seen = False
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if _is_single_private(node.name):
            private_seen = True
        elif private_seen and not node.name.startswith("__"):
            checker.emit(
                path,
                node.lineno,
                "UME-PY003",
                "public module function appears after a private helper",
                lines,
                related_lines=[
                    prior.lineno
                    for prior in tree.body[: tree.body.index(node)]
                    if isinstance(prior, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and _is_single_private(prior.name)
                ],
            )

    for class_node in (
        node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)
    ):
        private_seen = False
        for node in class_node.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if _is_single_private(node.name):
                private_seen = True
            elif private_seen and (
                node.name == "__init__" or not node.name.startswith("_")
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY003",
                    f"public method `{node.name}` appears after a private helper",
                    lines,
                    related_lines=[
                        prior.lineno
                        for prior in class_node.body[: class_node.body.index(node)]
                        if isinstance(prior, (ast.FunctionDef, ast.AsyncFunctionDef))
                        and _is_single_private(prior.name)
                    ],
                )

    # UME-PY004: basic Python identifier shape is mechanically knowable.
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.name.startswith("__") and not K_SNAKE_CASE.fullmatch(node.name):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY004",
                    f"function name `{node.name}` is not snake_case",
                    lines,
                )
        elif isinstance(node, ast.ClassDef) and not K_PASCAL_CASE.fullmatch(node.name):
            checker.emit(
                path,
                node.lineno,
                "UME-PY004",
                f"class name `{node.name}` is not PascalCase",
                lines,
            )

    # UME-PY006: new direct module constants use the repository prefix.
    if _has_k_constant_scope(path):
        for node in tree.body:
            if isinstance(node, ast.Assign):
                targets = node.targets
            elif isinstance(node, ast.AnnAssign) and node.value is not None:
                targets = [node.target]
            else:
                continue
            invalid_names = [
                name
                for target in targets
                for name in _target_names(target)
                if K_CONSTANT_NAME.fullmatch(name) and not name.startswith("K_")
            ]
            if invalid_names:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY006",
                    f"module-level constant(s) {', '.join(invalid_names)} must start with `K_`",
                    lines,
                )

    # UME-PY007: boolean callables read as predicates.
    if _has_k_constant_scope(path):
        for node in ast.walk(tree):
            if (
                isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                and not node.name.startswith("__")
                and _is_bool_returning(node)
                and not _is_predicate_name(node.name)
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY007",
                    f"bool-returning callable `{node.name}` must start with `is_` or `has_`",
                    lines,
                )

    # UME-SEC001: direct unsafe evaluation or deserialization calls.
    unsafe_calls = {
        "eval",
        "exec",
        "pickle.load",
        "pickle.loads",
        "dill.load",
        "dill.loads",
        "yaml.unsafe_load",
    }
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        qualified = _qualified_name(node.func)
        if qualified in unsafe_calls or (
            qualified == "yaml.load" and not _is_safe_yaml_loader(node)
        ):
            checker.emit(
                path,
                node.lineno,
                "UME-SEC001",
                f"unsafe evaluation or deserialization call `{qualified}`",
                lines,
            )

    # UME-NET001: known direct network calls must state a timeout.
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and _qualified_name(node.func) in K_NETWORK_CALLS
            and not _has_keyword(node, "timeout")
        ):
            checker.emit(
                path,
                node.lineno,
                "UME-NET001",
                "direct external call has no explicit timeout",
                lines,
            )

    # UME-PY005: known blocking calls inside async functions.
    for function in (
        node for node in ast.walk(tree) if isinstance(node, ast.AsyncFunctionDef)
    ):
        for node in ast.walk(function):
            if (
                isinstance(node, ast.Call)
                and _qualified_name(node.func) in K_BLOCKING_CALLS
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-PY005",
                    "blocking call is made inside an async function",
                    lines,
                )

    # UME-SA001: SQLAlchemy 1.x query/model constructors are not the v2 API.
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            qualified = _qualified_name(node.func)
            if isinstance(node.func, ast.Attribute) and node.func.attr == "query":
                checker.emit(
                    path,
                    node.lineno,
                    "UME-SA001",
                    "legacy SQLAlchemy `.query()` usage; use `select()`",
                    lines,
                )
            elif not _is_migration_path(path) and (
                qualified in legacy_names or qualified in legacy_qualified
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-SA002",
                    "legacy SQLAlchemy constructor; use the typed SQLAlchemy 2.x API",
                    lines,
                )

    client = _client_parts(path)
    if client and client[1] == "manager.py":
        # UME-FAPI003: managers call api.py; they do not own transport setup.
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                transport_imported = any(
                    alias.name.split(".", 1)[0] in K_TRANSPORT_MODULES
                    for alias in node.names
                )
            elif isinstance(node, ast.ImportFrom):
                transport_imported = bool(
                    node.module and node.module.split(".", 1)[0] in K_TRANSPORT_MODULES
                )
            else:
                continue
            if transport_imported:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI003",
                    "client manager imports transport code; keep HTTP/SDK setup in `api.py`",
                    lines,
                )

        # UME-FAPI004: managers must not own local transaction commits.
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr in {"commit", "flush", "rollback"}
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI004",
                    "client manager owns a local transaction operation; delegate the write to a service",
                    lines,
                )

    # UME-FAPI001: routes delegate writes to services and own the commit.
    mutation_methods = {"add", "delete", "merge", "bulk_save_objects"}
    for function in (
        node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ):
        if not any(
            _is_route_decorator(decorator) for decorator in function.decorator_list
        ):
            continue
        for node in ast.walk(function):
            if not (
                isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            ):
                continue
            receiver = _root_name(node.func.value)
            if node.func.attr in mutation_methods and receiver in K_DATABASE_ROOTS:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI001",
                    "route function performs a database write; delegate the write to a service and commit the route's transaction",
                    lines,
                )
            elif node.func.attr == "flush":
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI001",
                    "route function flushes; services flush and the route commits",
                    lines,
                )
            elif (
                node.func.attr in {"commit", "rollback"}
                and receiver not in K_DATABASE_ROOTS
            ):
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI001",
                    "route function must commit or roll back only its injected database session",
                    lines,
                )

    # UME-FAPI005: services flush; the composition root commits. The rule
    # cannot be suppressed: there is no sanctioned service commit.
    parts = Path(path).parts
    is_app_service_module = (
        parts[-1] in K_SERVICE_MODULE_NAMES or parts[-1].endswith("_service.py")
    ) and any(
        part == "flyt" and parts[index + 1] == "apps"
        for index, part in enumerate(parts[:-1])
    )
    if is_app_service_module:
        for node in ast.walk(tree):
            if not (
                isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            ):
                continue
            receiver = node.func.value
            receiver_names: set[str] = set()
            while isinstance(receiver, ast.Attribute):
                receiver_names.add(receiver.attr.lstrip("_"))
                receiver = receiver.value
            if isinstance(receiver, ast.Name):
                receiver_names.add(receiver.id.lstrip("_"))
            if node.func.attr == "commit" and receiver_names & K_DATABASE_ROOTS:
                checker.emit(
                    path,
                    node.lineno,
                    "UME-FAPI005",
                    "service module commits; services flush and the composition root commits",
                    lines,
                )

    # UME-SEC002: obvious literal credentials are never source configuration.
    for node in ast.walk(tree):
        targets: list[str] = []
        if isinstance(node, ast.Assign):
            for target in node.targets:
                targets.extend(_target_names(target))
            value = node.value
        elif isinstance(node, ast.AnnAssign):
            targets.extend(_target_names(node.target))
            value = node.value
        else:
            continue
        if (
            not isinstance(value, ast.Constant)
            or not isinstance(value.value, str)
            or not value.value
        ):
            continue
        if any(K_SECRET_NAME.search(target) for target in targets):
            checker.emit(
                path,
                node.lineno,
                "UME-SEC002",
                "credential-like value is hard-coded in source",
                lines,
            )


def _strip_js_comments(lines: list[str]) -> list[str]:
    result: list[str] = []
    in_block = False
    for line in lines:
        output = line
        if in_block:
            end = output.find("*/")
            if end < 0:
                result.append("")
                continue
            output = output[end + 2 :]
            in_block = False
        while "/*" in output:
            start = output.find("/*")
            end = output.find("*/", start + 2)
            if end < 0:
                output = output[:start]
                in_block = True
                break
            output = output[:start] + output[end + 2 :]
        output = re.sub(r"//.*$", "", output)
        result.append(output)
    return result


def _check_javascript(checker: Checker, path: str, text: str) -> None:
    original_lines = text.splitlines()
    lines = _strip_js_comments(original_lines)
    for number, line in enumerate(lines, 1):
        # UME-TS001: explicit `any` hides an untyped boundary.
        if re.search(
            r"(?::\s*any\b|\bas\s+any\b|<\s*any\s*>|\bArray\s*<\s*any\s*>)", line
        ):
            checker.emit(
                path,
                number,
                "UME-TS001",
                "explicit `any` hides the type boundary",
                original_lines,
            )

        # UME-TS002: non-null assertions are mechanically visible.
        if re.search(r"(?<![=!])[A-Za-z_$][\w$]*!\s*(?=[.;,)\]:])", line):
            checker.emit(
                path,
                number,
                "UME-TS002",
                "non-null assertion hides an unchecked nullability boundary",
                original_lines,
            )

        # UME-REACT001: do not pass a hook call directly as another call's argument.
        if re.search(r"\b[A-Za-z_$][\w$]*\(\s*(?:await\s+)?use[A-Z][\w$]*\(", line):
            checker.emit(
                path,
                number,
                "UME-REACT001",
                "hook call is passed directly as another function's argument",
                original_lines,
            )

        # UME-SEC003: obvious literal credentials in browser-delivered code.
        secret = re.search(
            r"\b(?:API_KEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET)\b\s*[:=]\s*(['\"])(.*?)\1",
            line,
            re.IGNORECASE,
        )
        if secret and len(secret.group(2)) >= K_MIN_SECRET_LENGTH:
            checker.emit(
                path,
                number,
                "UME-SEC003",
                "credential-like value is hard-coded in browser-delivered source",
                original_lines,
            )

        function = re.search(
            r"\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
            line,
        )
        if function and "_" in function.group(1):
            checker.emit(
                path,
                number,
                "UME-TS003",
                f"function name `{function.group(1)}` is not camelCase",
                original_lines,
            )

        arrow = re.search(
            r"\b(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>",
            line,
        )
        if arrow and "_" in arrow.group(1):
            checker.emit(
                path,
                number,
                "UME-TS003",
                f"function name `{arrow.group(1)}` is not camelCase",
                original_lines,
            )

        declaration = re.search(
            r"\b(?:export\s+)?(?:class|interface|type)\s+([A-Za-z_$][\w$]*)", line
        )
        if declaration and not K_PASCAL_CASE.fullmatch(declaration.group(1)):
            checker.emit(
                path,
                number,
                "UME-TS004",
                f"type or class name `{declaration.group(1)}` is not PascalCase",
                original_lines,
            )


def _client_parts(path: str) -> tuple[str, str] | None:
    parts = Path(path).parts
    for index, part in enumerate(parts[:-2]):
        if part == "clients":
            return str(Path(*parts[: index + 2])), parts[index + 2]
    return None


def _check_client_layout(
    checker: Checker, paths: list[str], existing: set[str]
) -> None:
    checked: set[str] = set()
    for path in paths:
        client = _client_parts(path)
        if client is None:
            continue
        directory, filename = client
        if (
            filename not in {"api.py", "manager.py", "config.py"}
            or directory in checked
        ):
            continue
        checked.add(directory)
        for required in ("api.py", "manager.py", "config.py"):
            if f"{directory}/{required}" not in existing:
                anchor = 1
                if checker.changed_lines is not None:
                    anchor = min(checker.changed_lines.get(path, {1}))
                checker.emit(
                    path,
                    anchor,
                    "UME-FAPI002",
                    f"vendor client folder is missing `{required}`",
                    [""]
                    if not (checker.root / path).exists()
                    else (checker.root / path).read_text(encoding="utf-8").splitlines(),
                )


def _parse_diff(diff: str) -> dict[str, set[int]]:
    changed: dict[str, set[int]] = defaultdict(set)
    path: str | None = None
    new_line: int | None = None
    for raw in diff.splitlines():
        if raw.startswith("+++ b/"):
            path = raw[6:]
            new_line = None
            continue
        if raw.startswith("+++ /dev/null"):
            path = None
            new_line = None
            continue
        hunk = K_HUNK.match(raw)
        if hunk:
            new_line = int(hunk.group(1))
            continue
        if path is None or new_line is None or raw.startswith("\\"):
            continue
        if raw.startswith("+"):
            changed[path].add(new_line)
            new_line += 1
        elif raw.startswith("-"):
            continue
        else:
            new_line += 1
    return dict(changed)


def _relative_path(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def _source_paths(root: Path, inputs: list[str]) -> list[tuple[str, Path]]:
    paths: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for value in inputs:
        candidate = (
            (root / value).resolve()
            if not Path(value).is_absolute()
            else Path(value).resolve()
        )
        if not candidate.exists():
            continue
        candidates = candidate.rglob("*") if candidate.is_dir() else [candidate]
        for file in candidates:
            if not file.is_file() or file.suffix.lower() not in K_SOURCE_SUFFIXES:
                continue
            if file.name.endswith(K_GENERATED_SUFFIXES):
                continue
            if any(part in K_SKIP_DIRS for part in file.relative_to(root).parts):
                continue
            relative = _relative_path(root, file)
            if relative not in seen:
                seen.add(relative)
                paths.append((relative, file))
    return paths


def _all_source_paths(root: Path) -> set[str]:
    return {relative for relative, _ in _source_paths(root, ["."])}


def _has_django_evidence(root: Path) -> bool:
    if (root / "manage.py").exists():
        return True
    for pattern in ("pyproject.toml", "requirements*.txt", "setup.cfg", "setup.py"):
        for file in root.glob(pattern):
            try:
                if "django" in file.read_text(encoding="utf-8").lower():
                    return True
            except UnicodeDecodeError:
                continue
    return False


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths", nargs="*", help="source files or directories to inspect"
    )
    parser.add_argument(
        "--root", default=".", help="repository root; defaults to the current directory"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--staged",
        action="store_true",
        help="inspect staged source and staged changed lines",
    )
    mode.add_argument(
        "--range", help="inspect the post-change source for a Git revision range"
    )
    mode.add_argument(
        "--diff-stdin",
        action="store_true",
        help="read a unified diff from stdin and inspect changed lines only",
    )
    parser.add_argument("--format", choices={"text", "json"}, default="text")
    return parser.parse_args()


def _git_output(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, text=True, capture_output=True
    ).stdout


def _diff_for_args(args: argparse.Namespace) -> tuple[str, bool, str | None]:
    if args.diff_stdin:
        return sys.stdin.read(), False, None
    if args.staged:
        return (
            _git_output("diff", "--cached", "--no-ext-diff", "--unified=0"),
            True,
            None,
        )
    if args.range:
        return (
            _git_output("diff", args.range, "--no-ext-diff", "--unified=0"),
            False,
            args.range,
        )
    return "", False, None


def _range_end(revision_range: str) -> str:
    for separator in ("...", ".."):
        if separator in revision_range:
            return revision_range.rsplit(separator, 1)[1]
    return revision_range


def _sources_from_git(
    paths: Iterable[str], *, staged: bool, revision_range: str | None
) -> dict[str, str]:
    sources: dict[str, str] = {}
    revision = ":" if staged else f"{_range_end(revision_range or 'HEAD')}"
    for path in paths:
        try:
            spec = f":{path}" if staged else f"{revision}:{path}"
            sources[path] = _git_output("show", spec)
        except subprocess.CalledProcessError:
            continue
    return sources


def main() -> int:  # ume-ignore: UME-PY003
    args = _parse_args()
    root = Path(args.root).resolve()
    changed_lines: dict[str, set[int]] | None = None
    diff, from_staged, revision_range = _diff_for_args(args)
    source_texts: dict[str, str] = {}
    if args.diff_stdin or args.staged or args.range:
        changed_lines = _parse_diff(diff)
        inputs = list(changed_lines)
        if args.staged or args.range:
            source_texts = _sources_from_git(
                inputs, staged=from_staged, revision_range=revision_range
            )
    else:
        inputs = args.paths or ["."]

    source_paths = _source_paths(root, inputs)
    checker = Checker(root, changed_lines)
    existing = _all_source_paths(root)
    django_evidence = _has_django_evidence(root)
    for relative, file in source_paths:
        try:
            text = source_texts.get(relative, file.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            continue
        if file.suffix.lower() in {".py", ".pyi"}:
            _check_python(checker, relative, text, django_evidence)
        else:
            _check_javascript(checker, relative, text)

    _check_client_layout(checker, [relative for relative, _ in source_paths], existing)
    checker.findings.sort(
        key=lambda finding: (finding.path, finding.line, finding.rule)
    )
    if args.format == "json":
        print(json.dumps([asdict(finding) for finding in checker.findings], indent=2))
    elif checker.findings:
        for finding in checker.findings:
            print(f"{finding.rule} {finding.path}:{finding.line} — {finding.message}")
    else:
        print("No mechanical findings.")
    return 1 if checker.findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
