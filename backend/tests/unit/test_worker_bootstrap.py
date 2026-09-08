import os
import subprocess
import sys
from pathlib import Path


def test_worker_bootstrap_imports_all_model_mappers() -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env.setdefault("SECRET_KEY", "x" * 32)
    env.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
    env.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    env.setdefault("OAUTH_SESSION_SECRET", "test-oauth-session-secret")
    env.setdefault("ADMIN_SESSION_SECRET", "x" * 32)

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from sqlalchemy.orm import configure_mappers; "
                "from flyt.apps.reading.tasks import generate_story_pages; "
                "configure_mappers(); "
                "print(generate_story_pages.__name__)"
            ),
        ],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "generate_story_pages"


def test_seed_script_bootstrap_imports_all_model_mappers() -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env.setdefault("SECRET_KEY", "x" * 32)
    env.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
    env.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    env.setdefault("OAUTH_SESSION_SECRET", "test-oauth-session-secret")
    env.setdefault("ADMIN_SESSION_SECRET", "x" * 32)

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from sqlalchemy.orm import configure_mappers; "
                "from scripts.import_lexicon import run_import; "
                "configure_mappers(); "
                "print(run_import.__name__)"
            ),
        ],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "run_import"
