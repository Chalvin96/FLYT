"""Unit tests for ``flyt.core.logging.configure_logging``.

Exercises formatter selection (json vs console) and verifies that an emitted
JSON record contains the expected renamed fields plus the correlation_id
injected by the filter.
"""

from __future__ import annotations

import io
import json
import logging

import pytest
from asgi_correlation_id.context import correlation_id
from pythonjsonlogger.json import JsonFormatter

from flyt.core.config import settings
from flyt.core.logging import configure_logging


@pytest.fixture(autouse=True)
def restore_logging() -> None:
    """Re-run configure_logging after each test to reset global state."""
    yield
    configure_logging()


def _root_handler() -> logging.Handler:
    handlers = logging.getLogger().handlers
    assert handlers, "root logger has no handlers"
    return handlers[0]


def test_configure_logging_given_format_json_expect_json_formatter_on_root(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "LOG_FORMAT", "json")
    monkeypatch.setattr(settings, "LOG_LEVEL", "INFO")

    configure_logging()

    formatter = _root_handler().formatter
    assert isinstance(formatter, JsonFormatter)


def test_configure_logging_given_format_console_expect_console_formatter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "LOG_FORMAT", "console")
    monkeypatch.setattr(settings, "LOG_LEVEL", "INFO")

    configure_logging()

    formatter = _root_handler().formatter
    assert not isinstance(formatter, JsonFormatter)


def test_json_log_given_emitted_record_expect_correlation_id_field(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "LOG_FORMAT", "json")
    monkeypatch.setattr(settings, "LOG_LEVEL", "INFO")
    configure_logging()

    handler = _root_handler()
    original_stream = handler.stream
    captured = io.StringIO()
    handler.stream = captured
    token = correlation_id.set("test-correlation-id")
    try:
        logging.getLogger("test.module").warning("hello %s", "world")
    finally:
        handler.stream = original_stream
        correlation_id.reset(token)

    line = captured.getvalue().strip()
    assert line, "no log output captured"
    data = json.loads(line)
    assert data["correlation_id"] == "test-correlation-id"
    assert data["level"] == "WARNING"
    assert data["logger"] == "test.module"
    assert data["message"] == "hello world"
    assert "timestamp" in data
