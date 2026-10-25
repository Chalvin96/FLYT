# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml==6.0.3"]
# ///

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from functools import cached_property
from pathlib import Path

import yaml

K_ROOT = Path(__file__).resolve().parent.parent
K_WORKFLOW = K_ROOT / ".github/workflows/extension-release.yml"
K_CHROME_SECRETS = {
    "CHROME_EXTENSION_ID": "chrome-id",
    "CHROME_PUBLISHER_ID": "publisher-id",
    "CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL": "publisher@example.com",
    "CHROME_SERVICE_ACCOUNT_PRIVATE_KEY": "test-key",
}
K_FIREFOX_SECRETS = {
    "FIREFOX_EXTENSION_ID": "flytlese@flyt.umebocchi.my.id",
    "FIREFOX_JWT_ISSUER": "test-issuer",
    "FIREFOX_JWT_SECRET": "test-secret",
}


def release_step(name: str) -> str:
    steps = yaml.safe_load(K_WORKFLOW.read_text())["jobs"]["build-and-release"]["steps"]
    return next(step["run"] for step in steps if step.get("name") == name)


class ExtensionReleaseTests(unittest.TestCase):
    @cached_property
    def root(self) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        sources = {
            "extension/package.json": json.dumps({"version": "1.2.3"}),
            "extension/src/background/index.ts": "export {};\n",
            "extension/README.md": "pnpm --filter @flyt/extension build:firefox\n",
            "packages/ui/package.json": "{}",
            "packages/lexicon/package.json": "{}",
            "package.json": "{}",
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
            "pnpm-workspace.yaml": "packages: [extension, 'packages/*']\n",
            "tsconfig.base.json": "{}",
            ".gitignore": "dist/\nnode_modules/\n",
            "scripts/check_pnpm_version.mjs": "export {};\n",
            "LICENSE": "MIT License\n",
        }
        for name, content in sources.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        for browser in ("chrome", "firefox"):
            path = root / "extension/dist" / browser
            path.mkdir(parents=True)
            (path / "manifest.json").write_text(json.dumps({"version": "1.2.3"}))
            (path / "assets").mkdir()
            (path / "assets/background.js").write_text("export {};\n")
        for args in (("init", "-q"), ("add", *sources)):
            subprocess.run(
                ["git", *args], cwd=root, check=True, text=True, capture_output=True
            )
        return root

    @cached_property
    def tree(self) -> str:
        return self.git("write-tree").strip()

    def git(self, *args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=self.root, check=True, text=True, capture_output=True
        ).stdout

    def run_step(self, name: str, **overrides: str) -> subprocess.CompletedProcess[str]:
        env = dict(os.environ)
        env.update({key: "" for key in K_CHROME_SECRETS | K_FIREFOX_SECRETS})
        env.update(
            GITHUB_REF_TYPE="tag",
            GITHUB_REF_NAME="ext-v1.2.3",
            GITHUB_SHA=self.tree,
            GITHUB_ENV=str(self.root / "github-env"),
            ASSET_PREFIX="extension/flytlese-ext-v1.2.3",
            DRY_RUN="false",
        )
        env.update(overrides)
        return subprocess.run(
            ["bash", "-euo", "pipefail", "-c", release_step(name)],
            cwd=self.root,
            env=env,
            check=False,
            text=True,
            capture_output=True,
        )

    def install_publisher_stub(self) -> dict[str, str]:
        executable = self.root / "bin/pnpm"
        executable.parent.mkdir()
        executable.write_text(
            "#!/usr/bin/env python3\n"
            "import json, os, pathlib, sys\n"
            "pathlib.Path(os.environ['PUBLISH_LOG']).write_text(json.dumps(sys.argv[1:]))\n"
        )
        executable.chmod(0o755)
        return {
            "PATH": f"{executable.parent}:{os.environ['PATH']}",
            "PUBLISH_LOG": str(self.root / "publish.json"),
        }

    def test_release_version_given_mismatched_tag_expect_failure(self) -> None:
        result = self.run_step("Validate release version", GITHUB_REF_NAME="ext-v9.9.9")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ext-v1.2.3", result.stderr)
        self.assertFalse((self.root / "github-env").exists())

    def test_release_version_given_matching_tag_expect_tagged_assets(self) -> None:
        result = self.run_step("Validate release version")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            "ASSET_PREFIX=extension/flytlese-ext-v1.2.3",
            (self.root / "github-env").read_text(),
        )

    def test_release_version_given_dispatch_branch_expect_development_assets(
        self,
    ) -> None:
        result = self.run_step(
            "Validate release version",
            GITHUB_REF_TYPE="branch",
            GITHUB_REF_NAME="master",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            f"ASSET_PREFIX=extension/flytlese-dev-{self.tree[:7]}",
            (self.root / "github-env").read_text(),
        )

    def test_release_archives_given_both_builds_expect_root_manifests_and_rebuild_sources(
        self,
    ) -> None:
        result = self.run_step("Package extension archives")

        self.assertEqual(result.returncode, 0, result.stderr)
        for browser in ("chrome", "firefox"):
            with zipfile.ZipFile(
                self.root / f"extension/flytlese-ext-v1.2.3-{browser}.zip"
            ) as archive:
                self.assertEqual(
                    set(archive.namelist()), {"manifest.json", "assets/background.js"}
                )
        with zipfile.ZipFile(
            self.root / "extension/flytlese-ext-v1.2.3-sources.zip"
        ) as archive:
            for name in (
                "extension/src/background/index.ts",
                "extension/README.md",
                "packages/ui/package.json",
                "packages/lexicon/package.json",
                "package.json",
                "pnpm-lock.yaml",
                "pnpm-workspace.yaml",
                "tsconfig.base.json",
                ".gitignore",
                "scripts/check_pnpm_version.mjs",
                "LICENSE",
            ):
                self.assertIn(name, archive.namelist())
            self.assertFalse(any("dist/" in name for name in archive.namelist()))

    def test_publish_given_missing_credentials_expect_store_skips_without_cli(
        self,
    ) -> None:
        stub = self.install_publisher_stub()

        result = self.run_step("Publish to extension stores", **stub)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Skipping Chrome", result.stdout)
        self.assertIn("Skipping Firefox", result.stdout)
        self.assertFalse((self.root / "publish.json").exists())

    def test_publish_given_partial_credentials_expect_store_skips_without_cli(
        self,
    ) -> None:
        stub = self.install_publisher_stub()

        result = self.run_step(
            "Publish to extension stores", CHROME_EXTENSION_ID="chrome-id", **stub
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Skipping Chrome", result.stdout)
        self.assertFalse((self.root / "publish.json").exists())

    def test_publish_given_chrome_credentials_expect_only_chrome_with_v2(self) -> None:
        stub = self.install_publisher_stub()

        result = self.run_step(
            "Publish to extension stores", **K_CHROME_SECRETS, **stub
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads((self.root / "publish.json").read_text())
        self.assertEqual(
            args[:4], ["--filter", "@flyt/extension", "exec", "publish-extension"]
        )
        self.assertEqual(args[args.index("--chrome-api-version") + 1], "v2")
        self.assertEqual(
            args[args.index("--chrome-zip") + 1],
            str(self.root / "extension/flytlese-ext-v1.2.3-chrome.zip"),
        )
        self.assertNotIn("--firefox-zip", args)
        self.assertNotIn("--dry-run", args)
        self.assertIn("Skipping Firefox", result.stdout)

    def test_publish_given_firefox_credentials_expect_only_firefox_with_sources(
        self,
    ) -> None:
        stub = self.install_publisher_stub()

        result = self.run_step(
            "Publish to extension stores", **K_FIREFOX_SECRETS, **stub
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads((self.root / "publish.json").read_text())
        self.assertEqual(
            args[args.index("--firefox-zip") + 1],
            str(self.root / "extension/flytlese-ext-v1.2.3-firefox.zip"),
        )
        self.assertEqual(
            args[args.index("--firefox-sources-zip") + 1],
            str(self.root / "extension/flytlese-ext-v1.2.3-sources.zip"),
        )
        self.assertNotIn("--chrome-zip", args)
        self.assertIn("Skipping Chrome", result.stdout)

    def test_publish_given_dry_run_expect_both_stores_without_upload(self) -> None:
        stub = self.install_publisher_stub()

        result = self.run_step(
            "Publish to extension stores",
            DRY_RUN="true",
            **K_CHROME_SECRETS,
            **K_FIREFOX_SECRETS,
            **stub,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads((self.root / "publish.json").read_text())
        self.assertIn("--chrome-zip", args)
        self.assertIn("--firefox-zip", args)
        self.assertIn("--firefox-sources-zip", args)
        self.assertIn("--dry-run", args)

    def test_publish_given_workspace_install_expect_exact_publisher_dependency(self) -> None:
        package = json.loads((K_ROOT / "extension/package.json").read_text())

        self.assertEqual(
            package["devDependencies"].get("publish-browser-extension"), "6.2.0"
        )


if __name__ == "__main__":
    unittest.main()
