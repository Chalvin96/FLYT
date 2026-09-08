from __future__ import annotations

import math
from typing import Any

K_SECTION_SECONDS = 45
K_EXERCISE_SECONDS = 60


def estimate_lesson_minutes(packet_json: dict[str, Any] | None) -> int:
    """Estimate how long a lesson packet takes in whole minutes.

    Sections contribute 45s, exercises 60s.
    """
    sections = len(packet_json.get("sections", [])) if packet_json else 0
    exercises = len(packet_json.get("exercises", [])) if packet_json else 0
    total_seconds = sections * K_SECTION_SECONDS + exercises * K_EXERCISE_SECONDS
    return max(1, math.ceil(total_seconds / 60))
