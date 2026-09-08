from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


@dataclass(frozen=True)
class AiUsageRequest:
    instructions: str
    prompt: str
    max_tokens: int | None = None


@dataclass(frozen=True)
class AiUsageStatus:
    remaining_tokens: int
    budget_tokens: int

    @property
    def is_exhausted(self) -> bool:
        return self.remaining_tokens <= 0

    @property
    def remaining_percent(self) -> int:
        if self.budget_tokens <= 0:
            return 0
        return max(
            0,
            min(100, self.remaining_tokens * 100 // self.budget_tokens),
        )


class AiUsageRefusalReason(StrEnum):
    WEEKLY_BUDGET = "weekly_budget"
    AGGREGATE_BUDGET = "aggregate_budget"


@dataclass(frozen=True)
class AggregateUsageScope:
    provider: str
    window_start: datetime
    budget_tokens: int


@dataclass(frozen=True)
class AiUsageAdmission:
    admitted: bool
    refusal_reason: AiUsageRefusalReason | None
