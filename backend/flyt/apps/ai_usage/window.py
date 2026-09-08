from datetime import UTC
from datetime import datetime
from datetime import timedelta


def calculate_utc_window_start(
    value: datetime | None = None,
    window_hours: int = 24,
) -> datetime:
    if window_hours < 1:
        raise ValueError("window_hours must be positive")

    current = datetime.now(UTC) if value is None else value
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    current = current.astimezone(UTC)

    epoch = datetime(1970, 1, 1, tzinfo=UTC)
    window_seconds = window_hours * 60 * 60
    elapsed_seconds = int((current - epoch).total_seconds())
    start_seconds = elapsed_seconds - elapsed_seconds % window_seconds
    return (epoch + timedelta(seconds=start_seconds)).replace(tzinfo=None)
