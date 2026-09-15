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


class WorkerSettings:
    functions: ClassVar[list] = [
        generate_story_pages,
        process_import,
        func(generate_story, max_tries=1),
    ]
    redis_settings = redis_settings()
    on_startup = _on_startup
    on_shutdown = _on_shutdown
    job_timeout = 300
