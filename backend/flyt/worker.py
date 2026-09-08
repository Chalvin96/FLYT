"""arq worker entrypoint.

Run: ``uv run arq flyt.worker.WorkerSettings``

Register new background jobs by appending to ``WorkerSettings.functions``.
"""

from typing import Any
from typing import ClassVar

import anyio
from arq.worker import func

from flyt.apps.reading.tasks import process_import
from flyt.apps.reading.tasks import generate_story_pages
from flyt.apps.reading.tokenization import tokenizer
from flyt.apps.story_generation.tasks import generate_story
from flyt.core.logging import configure_logging
from flyt.core.observability import configure_sentry
from flyt.core.queue import close_arq_pool
from flyt.core.queue import redis_settings
from flyt.core.redis import close_redis


async def _on_startup(ctx: dict[str, Any]) -> None:
    """Initialise logging, Sentry, and the spaCy tokenizer before the first job.

    The API process configures both at import time in ``flyt.main``; the
    worker is a separate process and would otherwise run with the default
    logging config and no error reporting, leaving background-job exceptions
    invisible to Sentry/GlitchTip.

    The tokenizer is warmed here so no learner's job pays spaCy's cold load.
    """
    configure_logging()
    configure_sentry()
    await anyio.to_thread.run_sync(tokenizer)


async def _on_shutdown(ctx: dict[str, Any]) -> None:
    await close_arq_pool()
    await close_redis()


class WorkerSettings:
    functions: ClassVar[list] = [
        generate_story_pages,
        process_import,
        # A generation must run exactly once: a terminal outcome (ready, failed,
        # refused) is recorded before the job returns, and a retry would only
        # re-reserve usage on a dead generation. arq's default retries
        # are therefore disabled explicitly.
        func(generate_story, max_tries=1),
    ]
    # Stale imports are re-enqueued by an external scheduler running
    # ``python -m flyt.commands.requeue_stale_imports``, not an in-process cron.
    redis_settings = redis_settings()
    on_startup = _on_startup
    on_shutdown = _on_shutdown
    # A job is force-cancelled at job_timeout; self-heal only requeues after
    # STALE_AFTER. job_timeout MUST stay < STALE_AFTER so a stale reclaim can never
    # run concurrently with (or be overwritten by) the original job. No fence token
    # is needed as long as this holds.
    job_timeout = 300  # seconds; STALE_AFTER is 1h
