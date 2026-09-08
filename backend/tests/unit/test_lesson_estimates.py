from flyt.apps.lessons.utils import estimate_lesson_minutes

EXPECTED_ESTIMATED_MINUTES = 4


def test_estimate_lesson_minutes_given_empty_packet_expect_minimum_one() -> None:
    assert estimate_lesson_minutes({"sections": [], "exercises": []}) == 1


def test_estimate_lesson_minutes_given_none_expect_minimum_one() -> None:
    assert estimate_lesson_minutes(None) == 1


def test_estimate_lesson_minutes_given_three_sections_one_exercise_expect_four():
    packet = {"sections": [{}, {}, {}], "exercises": [{}]}
    # 3 * 45s + 60s = 195s => 4 minutes
    assert estimate_lesson_minutes(packet) == EXPECTED_ESTIMATED_MINUTES
