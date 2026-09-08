from pydantic import BaseModel


class StatsSnapshotRead(BaseModel):
    this_week: list[int] = [0] * 7
    last_week: list[int] = [0] * 7
    two_weeks_ago: list[int] = [0] * 7
    three_weeks_ago: list[int] = [0] * 7


class StatsRead(BaseModel):
    dueCount: int
    dueNew: int
    lessonCount: int
    new: int
    learning: int
    relearning: int
    accuracy7d: float | None = None
    wordsPracticed: int
    streak: int
    snapshot: StatsSnapshotRead = StatsSnapshotRead()
