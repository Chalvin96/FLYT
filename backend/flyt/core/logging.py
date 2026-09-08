"""Structured logging configuration.

Configures a single stdout handler with either a JSON formatter (production)
or a human-readable console formatter (development). A correlation-id filter
from ``asgi-correlation-id`` is attached to the handler so every record carries
the current request's ``correlation_id`` automatically.

Call :func:`configure_logging` once at import time in ``flyt.main``.
"""

from __future__ import annotations

import logging.config

from flyt.core.config import settings


def configure_logging() -> None:
    """Configure root + uvicorn loggers via :func:`logging.config.dictConfig`.

    The formatter is chosen from ``settings.LOG_FORMAT`` (``json`` in
    production, ``console`` in development). ``uvicorn.access`` is silenced to
    WARNING because we emit our own ``flyt.access`` line from the access-log
    middleware.
    """
    log_format = settings.LOG_FORMAT or "console"

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": "pythonjsonlogger.json.JsonFormatter",
                    "fmt": ["asctime", "levelname", "name", "message"],
                    "rename_fields": {
                        "asctime": "timestamp",
                        "levelname": "level",
                        "name": "logger",
                    },
                    "timestamp": True,
                },
                "console": {
                    "format": (
                        "%(asctime)s %(levelname)s %(name)s "
                        "[%(correlation_id)s] %(message)s"
                    ),
                },
            },
            "filters": {
                "correlation_id": {
                    "()": "asgi_correlation_id.log_filters.CorrelationIdFilter",
                    "default_value": "-",
                },
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                    "filters": ["correlation_id"],
                    "formatter": log_format,
                },
            },
            "root": {
                "level": settings.LOG_LEVEL,
                "handlers": ["default"],
            },
            "loggers": {
                "uvicorn": {
                    "handlers": ["default"],
                    "level": settings.LOG_LEVEL,
                    "propagate": False,
                },
                "uvicorn.error": {
                    "handlers": ["default"],
                    "level": settings.LOG_LEVEL,
                    "propagate": False,
                },
                # We emit our own structured access log via flyt.access; suppress
                # uvicorn's plain-text access lines (emitted at INFO) by raising
                # the level to WARNING and disabling propagation.
                "uvicorn.access": {
                    "handlers": [],
                    "level": "WARNING",
                    "propagate": False,
                },
            },
        }
    )
