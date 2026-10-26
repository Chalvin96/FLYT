"""Unit tests for structured logging and tokenizer startup in the arq worker."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from flyt.worker import WorkerSettings

pytestmark = pytest.mark.anyio


async def test_worker_on_startup_given_worker_boot_expect_logging_configured() -> None:
    with patch("flyt.worker.configure_logging") as configure_logging_mock:
        await WorkerSettings.on_startup({})

    configure_logging_mock.assert_called_once_with()


async def test_worker_on_startup_given_worker_boot_expect_tokenizer_cache_warmed() -> (
    None
):
    """on_startup must warm the spaCy tokenizer so the first learner request
    does not pay the ~47 s cold model load. The loader is mocked so the real
    ``nb_core_news_md`` model is never loaded in CI."""
    with (
        patch("flyt.worker.configure_logging"),
        patch("flyt.worker.tokenizer") as tokenizer_mock,
    ):
        await WorkerSettings.on_startup({})

    tokenizer_mock.assert_called_once_with()
