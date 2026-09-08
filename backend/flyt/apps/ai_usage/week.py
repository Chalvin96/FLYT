from datetime import date
from datetime import datetime
from datetime import timedelta

from flyt.libs.utils.date import now


def calculate_utc_week_start(value: datetime | None = None) -> date:
    """Monday that begins the UTC calendar week containing ``value``."""
    current = now() if value is None else value
    return current.date() - timedelta(days=current.weekday())
