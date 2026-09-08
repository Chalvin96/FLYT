"""Sentry/GlitchTip SDK initialization.

This module is import-safe from both the FastAPI app (``flyt.main``) and the
arq worker (``flyt.worker``) without pulling in the web stack. Keeping
``configure_sentry`` here lets background-job processes initialize the same
error reporting as the API without importing ``flyt.main`` (which would mount
the whole FastAPI app and its routers).
"""

from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.scrubber import DEFAULT_DENYLIST
from sentry_sdk.scrubber import EventScrubber

from flyt.core.config import settings
from version import __version__


CREDENTIAL_FIELD_NAMES = [
    "access_token",
    "refresh_token",
    "refresh_token_or_keep_stored",
    "id_token",
    "authorization_code",
    "tokens",
    "plaintext",
    "api_key",
    "apiKey",
    "code_verifier",
]

SCRUBBED_FIELD_NAMES = DEFAULT_DENYLIST + CREDENTIAL_FIELD_NAMES


def configure_sentry() -> None:
    """Initialise the Sentry/GlitchTip SDK if ``SENTRY_DSN`` is set.

    No-op when the DSN is absent so dev/test never phone home.
    """
    if not settings.SENTRY_DSN:
        return
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        release=settings.RELEASE or f"flyt@{__version__}",
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
        event_scrubber=EventScrubber(denylist=SCRUBBED_FIELD_NAMES, recursive=True),
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            LoggingIntegration(event_level=None),
        ],
    )
