from datetime import datetime
from datetime import timedelta
from datetime import UTC


def start_of_next_utc_day(value: datetime) -> datetime:
    """Return the UTC midnight that begins the day after ``value`` (naive UTC).

    The day boundary for FSRS scheduling is UTC midnight. For LEARNING /
    RELEARNING cards the whole calendar day is eligible so the frontend can
    gate display by the browser clock; this helper computes that boundary.
    """
    aware = to_utc_aware(value)
    if aware is None:
        raise ValueError("start_of_next_utc_day requires a non-null datetime")
    next_midnight = (aware + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return next_midnight.replace(tzinfo=None)


def to_utc_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def to_utc_naive(value: datetime | None) -> datetime | None:
    aware = to_utc_aware(value)
    if aware is None:
        return None
    return aware.replace(tzinfo=None)


def now_aware() -> datetime:
    return datetime.now(UTC)


def now() -> datetime:
    return now_aware().replace(tzinfo=None)
