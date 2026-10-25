from datetime import date
from datetime import datetime
from datetime import timedelta

from flyt.libs.utils.date import now
from flyt.libs.utils.date import to_utc_naive


def calculate_utc_week_start(value: datetime | None = None) -> date:
    """Monday that begins the UTC calendar week containing ``value``."""
    current = to_utc_naive(value) or now()
    return current.date() - timedelta(days=current.weekday())
