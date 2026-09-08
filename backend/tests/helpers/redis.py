"""Redis helpers for tests.

The Redis fixtures delete keys under ``story_generation:*``, so — like the
test-database guard in ``tests/conftest.py`` — they must refuse to run against
a non-local host instead of destroying a shared instance's data.
"""

from urllib.parse import urlparse


def validate_local_redis_url(url: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1"}:
        msg = f"Refusing to run tests against non-local Redis host '{host}'."
        raise RuntimeError(msg)
