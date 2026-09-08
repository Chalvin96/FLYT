"""Unit tests for the arq worker ``on_startup`` hook.

Verifies that the worker initialises structured logging and Sentry/GlitchTip
when it boots, so background-job exceptions are visible and logs are
structured. Both dependencies are mocked so no real Sentry SDK state is
mutated.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from flyt.worker import WorkerSettings

pytestmark = pytest.mark.anyio


async def test_worker_on_startup_given_dsn_expect_logging_and_sentry_configured() -> (
    None
):
    """on_startup must call configure_logging() and configure_sentry() once each.

    arq passes the worker ctx dict to on_startup; we pass a dummy dict to
    match the real signature. Both callees are mocked so this test stays
    self-contained and order-independent of the rest of the suite.
    """
    with (
        patch("flyt.worker.configure_logging") as configure_logging_mock,
        patch("flyt.worker.configure_sentry") as configure_sentry_mock,
    ):
        await WorkerSettings.on_startup({})

    configure_logging_mock.assert_called_once_with()
    configure_sentry_mock.assert_called_once_with()


async def test_worker_on_startup_given_worker_boot_expect_tokenizer_cache_warmed() -> (
    None
):
    """on_startup must warm the spaCy tokenizer so the first learner request
    does not pay the ~47 s cold model load. The loader is mocked so the real
    ``nb_core_news_md`` model is never loaded in CI."""
    with (
        patch("flyt.worker.configure_logging"),
        patch("flyt.worker.configure_sentry"),
        patch("flyt.worker.tokenizer") as tokenizer_mock,
    ):
        await WorkerSettings.on_startup({})

    tokenizer_mock.assert_called_once_with()
