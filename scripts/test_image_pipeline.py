# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml==6.0.3"]
# ///
"""Regression tests for release cache reuse and scan-before-publish behavior."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

K_ROOT = Path(__file__).resolve().parent.parent
K_MASTER = K_ROOT / ".github/workflows/master.yml"
K_PUSH = K_ROOT / "scripts/push_scanned_image.sh"
K_RELEASE_JOBS = ("build-backend", "build-frontend")


def step_using(steps: list[dict], action: str) -> list[tuple[int, dict]]:
    return [
        (index, step)
        for index, step in enumerate(steps)
        if step.get("uses", "").startswith(action)
    ]


class ReleaseWorkflowTests(unittest.TestCase):
    @property
    def jobs(self) -> dict:
        return yaml.safe_load(K_MASTER.read_text())["jobs"]

    def test_release_jobs_given_master_workflow_expect_one_local_build_without_remote_cache(
        self,
    ) -> None:
        for job_id in K_RELEASE_JOBS:
            with self.subTest(job=job_id):
                builds = step_using(
                    self.jobs[job_id]["steps"], "docker/build-push-action@"
                )
                self.assertEqual(len(builds), 1)
                settings = builds[0][1]["with"]
                self.assertTrue(settings["load"])
                self.assertFalse(settings["push"])
                self.assertNotIn("cache-from", settings)
                self.assertNotIn("cache-to", settings)

    def test_release_builders_given_master_workflow_expect_separate_persistent_state(
        self,
    ) -> None:
        names = set()
        groups = set()
        for job_id in K_RELEASE_JOBS:
            with self.subTest(job=job_id):
                job = self.jobs[job_id]
                ((_, builder),) = step_using(
                    job["steps"], "docker/setup-buildx-action@"
                )
                self.assertTrue(builder["with"]["keep-state"])
                names.add(builder["with"]["name"])
                groups.add(job["concurrency"]["group"])
                self.assertFalse(job["concurrency"]["cancel-in-progress"])
        self.assertEqual(len(names), 2)
        self.assertEqual(len(groups), 2)

    def test_release_publish_given_master_workflow_expect_push_of_scanned_image_id(
        self,
    ) -> None:
        for job_id in K_RELEASE_JOBS:
            with self.subTest(job=job_id):
                steps = self.jobs[job_id]["steps"]
                ((scan_index, scan),) = step_using(steps, "aquasecurity/trivy-action@")
                pushes = [
                    (index, step)
                    for index, step in enumerate(steps)
                    if step.get("run") == "bash scripts/push_scanned_image.sh"
                ]
                self.assertEqual(len(pushes), 1)
                push_index, push = pushes[0]
                self.assertLess(scan_index, push_index)
                self.assertEqual(str(scan["with"]["exit-code"]), "1")
                self.assertEqual(str(scan["with"]["cache"]).lower(), "false")
                self.assertEqual(
                    scan["with"]["image-ref"], "${{ steps.build.outputs.imageid }}"
                )
                self.assertEqual(push["env"]["IMAGE_ID"], scan["with"]["image-ref"])


class PushScannedImageTests(unittest.TestCase):
    def run_push(
        self, *, fail_tag: str = "", image_id: str = "sha256:scanned"
    ) -> tuple[subprocess.CompletedProcess[str], list[list[str]]]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "calls.jsonl"
            docker = root / "docker"
            docker.write_text(
                "#!/usr/bin/env python3\n"
                "import json, os, sys\n"
                "with open(os.environ['DOCKER_CALL_LOG'], 'a') as log:\n"
                "    log.write(json.dumps(sys.argv[1:]) + '\\n')\n"
                "if sys.argv[1:3] == ['image', 'push'] and sys.argv[-1] == os.environ.get('FAIL_TAG'):\n"
                "    sys.exit(17)\n"
            )
            docker.chmod(0o755)
            env = dict(
                os.environ,
                PATH=f"{root}:{os.environ['PATH']}",
                DOCKER_CALL_LOG=str(log),
                IMAGE_ID=image_id,
                IMAGE_TAGS="ghcr.io/flyt/backend:latest\nghcr.io/flyt/backend:sha-123\n",
                FAIL_TAG=fail_tag,
            )
            result = subprocess.run(
                ["bash", str(K_PUSH)],
                check=False,
                env=env,
                capture_output=True,
                text=True,
            )
            calls = (
                [json.loads(line) for line in log.read_text().splitlines()]
                if log.exists()
                else []
            )
            return result, calls

    def test_push_scanned_image_given_tags_expect_each_tag_pushed_from_scanned_id(
        self,
    ) -> None:
        result, calls = self.run_push()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            calls,
            [
                ["image", "tag", "sha256:scanned", "ghcr.io/flyt/backend:latest"],
                ["image", "push", "ghcr.io/flyt/backend:latest"],
                ["image", "tag", "sha256:scanned", "ghcr.io/flyt/backend:sha-123"],
                ["image", "push", "ghcr.io/flyt/backend:sha-123"],
            ],
        )

    def test_push_scanned_image_given_failed_push_expect_publication_stops(
        self,
    ) -> None:
        result, calls = self.run_push(fail_tag="ghcr.io/flyt/backend:latest")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 2)

    def test_push_scanned_image_given_missing_image_id_expect_nothing_published(
        self,
    ) -> None:
        result, calls = self.run_push(image_id="")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
