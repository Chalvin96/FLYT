from datetime import datetime

from flyt.apps.ai_usage.types import AiUsageStatus
from flyt.apps.ai_usage.week import calculate_utc_week_start

K_TEST_BUDGET = 1_000
K_QUARTER_PERCENT = 25
K_ONE_TOKEN_REMAINING_PERCENT = 99


def test_utc_week_start_given_midweek_expect_monday() -> None:
    assert (
        calculate_utc_week_start(datetime(2026, 9, 2)) == datetime(2026, 8, 31).date()
    )


def test_utc_week_start_given_sunday_expect_previous_monday() -> None:
    assert (
        calculate_utc_week_start(datetime(2026, 8, 30, 23, 59))
        == datetime(2026, 8, 24).date()
    )


def test_utc_week_start_given_monday_expect_same_day() -> None:
    assert (
        calculate_utc_week_start(datetime(2026, 8, 31, 0, 0))
        == datetime(2026, 8, 31).date()
    )


def test_remaining_percent_given_fraction_expect_rounds_down() -> None:
    assert (
        AiUsageStatus(K_TEST_BUDGET - 1, K_TEST_BUDGET).remaining_percent
        == K_ONE_TOKEN_REMAINING_PERCENT
    )
    assert AiUsageStatus(0, K_TEST_BUDGET).remaining_percent == 0
    assert AiUsageStatus(1, K_TEST_BUDGET).remaining_percent == 0


def test_remaining_percent_given_boundary_expect_exact_percent() -> None:
    assert (
        AiUsageStatus(750, K_TEST_BUDGET).remaining_percent == 100 - K_QUARTER_PERCENT
    )


def test_remaining_percent_given_over_budget_expect_zero() -> None:
    assert AiUsageStatus(-500, K_TEST_BUDGET).remaining_percent == 0


def test_is_exhausted_given_stock_at_or_below_zero_expect_true() -> None:
    assert AiUsageStatus(1, K_TEST_BUDGET).is_exhausted is False
    assert AiUsageStatus(0, K_TEST_BUDGET).is_exhausted is True
    assert AiUsageStatus(-1, K_TEST_BUDGET).is_exhausted is True


def test_remaining_percent_given_zero_budget_expect_zero() -> None:
    assert AiUsageStatus(10, 0).remaining_percent == 0
