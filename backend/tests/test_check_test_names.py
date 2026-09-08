from importlib.util import module_from_spec
from importlib.util import spec_from_file_location
from pathlib import Path
import sys


def _checker():
    path = Path(__file__).parents[2] / "scripts" / "check_test_names.py"
    spec = spec_from_file_location("check_test_names", path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_find_violations_given_compliant_python_name_expect_empty() -> None:
    checker = _checker()
    source = "def test_parser_given_valid_input_expect_result():\n    pass\n"

    assert checker.find_violations("backend/tests/test_parser.py", source, {1}) == []


def test_find_violations_given_legacy_python_name_expect_violation() -> None:
    checker = _checker()
    source = "def test_parser_works():\n    pass\n"

    violations = checker.find_violations("backend/tests/test_parser.py", source, {1})

    assert [violation.name for violation in violations] == ["test_parser_works"]


def test_find_violations_given_legacy_name_outside_added_lines_expect_empty() -> None:
    checker = _checker()
    source = "def test_parser_works():\n    pass\n"

    assert checker.find_violations("backend/tests/test_parser.py", source, {2}) == []


def test_find_violations_given_parameterized_vitest_title_expect_violation() -> None:
    checker = _checker()
    source = "it.each([[1]])('renders %s', () => {})\n"

    violations = checker.find_violations("frontend/src/parser.test.ts", source, {1})

    assert [violation.name for violation in violations] == ["renders %s"]


def test_find_violations_given_compliant_vitest_title_expect_empty() -> None:
    checker = _checker()
    source = "it('test_parser_given_valid_input_expect_result', () => {})\n"

    assert checker.find_violations("frontend/src/parser.test.ts", source, {1}) == []


def test_find_violations_given_dynamic_vitest_title_expect_violation() -> None:
    checker = _checker()
    source = "const title = 'test_parser_given_valid_input_expect_result';\nit(title, () => {})\n"

    violations = checker.find_violations("frontend/src/parser.test.ts", source, {2})

    assert [violation.name for violation in violations] == ["nonliteral Vitest title"]


def test_is_test_path_given_backend_scope_and_frontend_file_expect_false() -> None:
    checker = _checker()

    assert not checker.is_test_path("frontend/src/parser.test.ts", "backend")


def test_is_test_path_given_backend_scope_and_morph_svc_test_file_expect_true() -> None:
    checker = _checker()

    assert checker.is_test_path("morph-svc/test_app.py", "backend")
    assert not checker.is_test_path("morph-svc/app.py", "backend")


def test_is_test_path_given_frontend_scope_and_extension_test_expect_true() -> None:
    checker = _checker()

    assert checker.is_test_path("extension/src/parser.test.ts", "frontend")


def test_find_violations_given_all_source_lines_expect_legacy_name_violation() -> None:
    checker = _checker()
    source = "def test_parser_works():\n    pass\n"

    violations = checker.find_violations(
        "backend/tests/test_parser.py", source, set(range(1, source.count("\n") + 2))
    )

    assert [violation.name for violation in violations] == ["test_parser_works"]
