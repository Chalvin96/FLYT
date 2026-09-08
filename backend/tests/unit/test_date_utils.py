from datetime import datetime
from datetime import UTC

from flyt.libs.utils.date import to_utc_aware
from flyt.libs.utils.date import to_utc_naive

EXPECTED_UTC_HOUR = 10


def test_to_utc_aware_given_naive_datetime_expect_utc_aware_datetime() -> None:
    naive = datetime(2026, 2, 27, 10, 0, 0)
    normalized = to_utc_aware(naive)

    assert normalized is not None
    assert normalized.tzinfo == UTC
    assert normalized.hour == EXPECTED_UTC_HOUR


def test_to_utc_aware_given_aware_datetime_expect_converted_utc_datetime() -> None:
    aware = datetime(2026, 2, 27, 10, 0, 0, tzinfo=UTC)
    normalized = to_utc_aware(aware)

    assert normalized is not None
    assert normalized.tzinfo == UTC
    assert normalized.hour == EXPECTED_UTC_HOUR


def test_to_utc_naive_given_aware_datetime_expect_naive_utc_datetime() -> None:
    aware = datetime(2026, 2, 27, 10, 0, 0, tzinfo=UTC)
    normalized = to_utc_naive(aware)

    assert normalized is not None
    assert normalized.tzinfo is None
    assert normalized.hour == EXPECTED_UTC_HOUR
