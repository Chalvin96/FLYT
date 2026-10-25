"""Container health check for both processes the backend image runs.

The API must answer ``/health/ready``. The arq worker serves no HTTP, so it
is healthy while its Redis heartbeat is fresh.
"""

import asyncio
import sys
import urllib.request
from http import HTTPStatus
from pathlib import Path

from arq.worker import async_check_health

from flyt.core.queue import redis_settings

K_READY_URL = "http://127.0.0.1:8000/health/ready"
K_TIMEOUT_SECONDS = 3


def is_worker_process(main_process_args: list[str]) -> bool:
    return any(Path(arg).name == "arq" for arg in main_process_args)


def _main_process_args() -> list[str]:
    return Path("/proc/1/cmdline").read_bytes().decode().split("\0")


def _is_api_ready() -> bool:
    try:
        with urllib.request.urlopen(K_READY_URL, timeout=K_TIMEOUT_SECONDS) as response:
            return response.status == HTTPStatus.OK
    except OSError:
        return False


def _is_worker_alive() -> bool:
    return asyncio.run(async_check_health(redis_settings())) == 0


if __name__ == "__main__":
    healthy = (
        _is_worker_alive()
        if is_worker_process(_main_process_args())
        else _is_api_ready()
    )
    sys.exit(0 if healthy else 1)
