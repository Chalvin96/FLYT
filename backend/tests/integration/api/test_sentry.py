"""Integration tests for Sentry SDK initialization gating.

Verifies that when ``SENTRY_DSN`` is unset (the dev/test default),
``sentry_sdk.init`` is never called so the app never phones home, and that
when a DSN is set the SDK is initialised with the expected integrations.
"""

from unittest.mock import MagicMock

import pytest
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from flyt.core.config import settings
from flyt.core.observability import configure_sentry


def test_sentry_given_no_dsn_expect_init_skipped() -> None:
    # In the test environment SENTRY_DSN is None, so sentry_sdk.init was
    # never called when flyt.main was imported.  is_initialized() stays
    # False as proof.
    assert not sentry_sdk.is_initialized()


def test_configure_sentry_given_dsn_expect_init_with_integrations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Mock sentry_sdk.init so no real global SDK state is mutated, keeping
    # this test order-independent from test_sentry_given_no_dsn_expect_init_skipped.
    init_mock = MagicMock()
    monkeypatch.setattr(sentry_sdk, "init", init_mock)
    monkeypatch.setattr(settings, "SENTRY_DSN", "https://example.invalid/test")

    configure_sentry()

    init_mock.assert_called_once()
    kwargs = init_mock.call_args.kwargs
    integrations = kwargs["integrations"]
    integration_types = [type(i) for i in integrations]
    assert FastApiIntegration in integration_types
    assert SqlalchemyIntegration in integration_types
    logging_integrations = [
        i for i in integrations if isinstance(i, LoggingIntegration)
    ]
    assert len(logging_integrations) == 1
    # event_level=None means no EventHandler is created (breadcrumbs only),
    # so the internal _handler stays unset.
    assert logging_integrations[0]._handler is None
