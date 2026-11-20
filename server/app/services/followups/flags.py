"""Rollout flags for follow-ups. Process-wide switches; per-tenant / per-thread controls live in Postgres.

FOLLOWUP_ASSESSMENT_ENABLED     AI #2 assesses each new business message (default on)
FOLLOWUP_SHADOW_MODE            assess + store only; never change effective state or act (default off)
FOLLOWUP_REMINDERS_ENABLED      internal team notices are delivered (default on)
FOLLOWUP_CUSTOMER_SEND_ENABLED  kill switch for proactive customer email AND its retries (default OFF)
FOLLOWUP_SCHEDULER_TICK_SECONDS scheduler cadence (0 disables the embedded loop)

The kill switch never blocks reconciliation of an already-attempted send or internal operations.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field

from app.core.config import BaseAppConfig


class FollowupFlags(BaseAppConfig):
    assessment_enabled: bool = Field(default=True, alias="FOLLOWUP_ASSESSMENT_ENABLED")
    shadow_mode: bool = Field(default=False, alias="FOLLOWUP_SHADOW_MODE")
    reminders_enabled: bool = Field(default=True, alias="FOLLOWUP_REMINDERS_ENABLED")
    customer_send_enabled: bool = Field(default=False, alias="FOLLOWUP_CUSTOMER_SEND_ENABLED")
    scheduler_tick_seconds: float = Field(default=60.0, alias="FOLLOWUP_SCHEDULER_TICK_SECONDS")
    assess_max_age_hours: int = Field(default=48, alias="FOLLOWUP_ASSESS_MAX_AGE_HOURS")


@lru_cache(maxsize=1)
def get_flags() -> FollowupFlags:
    return FollowupFlags()


def reset_flags_cache() -> None:
    get_flags.cache_clear()
