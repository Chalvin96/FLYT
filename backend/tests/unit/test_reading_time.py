import pytest

from flyt.apps.reading.services import calculate_reading_minutes


@pytest.mark.parametrize(
    ("word_count", "expected_minutes"),
    [(0, 0), (1, 1), (150, 1), (151, 2), (9000, 60)],
)
def test_reading_minutes_given_word_count_expect_whole_minutes_rounded_up(
    word_count: int, expected_minutes: int
) -> None:
    assert calculate_reading_minutes(word_count) == expected_minutes
