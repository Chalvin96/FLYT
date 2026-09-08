"""Capture SQL statements executed through a session's engine.

Lets tests assert real query behavior (statement counts, table reads,
parameter scope) against the live test database instead of mirroring
implementation internals with mocks.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession


@contextmanager
def capture_sql(session: AsyncSession) -> Iterator[list[tuple[str, Any]]]:
    """Record (statement, parameters) for every SQL execution while open."""
    executed: list[tuple[str, Any]] = []

    def record(
        _conn: Any,
        _cursor: Any,
        statement: str,
        parameters: Any,
        _context: Any,
        _executemany: Any,
    ) -> None:
        executed.append((statement, parameters))

    engine = session.get_bind().engine
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield executed
    finally:
        event.remove(engine, "before_cursor_execute", record)


def statements_reading(
    executed: list[tuple[str, Any]],
    table: str,
) -> list[tuple[str, Any]]:
    """Statements that read the given table in a FROM or JOIN clause."""
    markers = (f"FROM {table}", f"JOIN {table}")
    return [
        (statement, parameters)
        for statement, parameters in executed
        if any(marker in statement for marker in markers)
    ]


def params_contain(parameters: Any, value: int) -> bool:
    """Whether an execution's bound parameters carry the given int value,
    descending into the expanded sequences SQLAlchemy uses for IN clauses."""
    values = parameters.values() if isinstance(parameters, dict) else parameters
    if values is None:
        return False
    for item in values:
        if isinstance(item, (list, tuple)):
            if any(entry == value for entry in item):
                return True
        elif item == value:
            return True
    return False
