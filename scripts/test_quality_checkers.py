"""Focused tests for the repository quality-checking scripts."""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

K_CHECK_CONVENTIONS = Path(__file__).with_name("check_conventions.py")


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


class QualityCheckerTests(unittest.TestCase):
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

if __name__ == "__main__":
    unittest.main()
