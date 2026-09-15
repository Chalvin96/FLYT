"""The single retention boundary for story generation.

Polling expiry, worker admission, and content cleanup all derive the same
cutoff from ``created_at`` and the configured TTL so the policy cannot drift.
"""

from datetime import datetime
from datetime import timedelta

from flyt.core.config import settings
from flyt.libs.utils.date import now


def retention_cutoff() -> datetime:
    """Generations created before this instant are no longer pollable."""
    return now() - timedelta(hours=settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS)
