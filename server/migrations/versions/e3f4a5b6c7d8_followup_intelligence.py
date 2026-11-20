"""Conversation intelligence & follow-ups (additive).

Creates policy, per-thread controls, message assessments, effective state, contact suppressions,
follow-up occurrences and per-recipient notice deliveries. Existing threads keep lead_intent
untouched; customer email permission is never backfilled (defaults to false).

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def _thread_fk(primary=False):
    return sa.Column("thread_id", sa.String(64), sa.ForeignKey("email_threads.id", ondelete="CASCADE"),
                     primary_key=primary, nullable=False)


def upgrade() -> None:
    op.create_table(
        "followup_policies",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("assessment_enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("planning_enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("cadence_hot_days", sa.Integer, nullable=False, server_default="1"),
        sa.Column("cadence_warm_days", sa.Integer, nullable=False, server_default="3"),
        sa.Column("cadence_cold_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column("workdays", sa.String(32), nullable=False, server_default="0,1,2,3,4"),
        sa.Column("send_window_start", sa.String(5), nullable=False, server_default="09:00"),
        sa.Column("send_window_end", sa.String(5), nullable=False, server_default="18:00"),
        sa.Column("default_local_time", sa.String(5), nullable=False, server_default="10:00"),
        sa.Column("advance_notice_days", sa.Integer, nullable=False, server_default="1"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("min_spacing_hours", sa.Integer, nullable=False, server_default="24"),
        sa.Column("timezone", sa.String(64)),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(64)),
        *_ts(),
        sa.UniqueConstraint("tenant_id", name="uq_followup_policy_tenant"),
    )
    op.create_table(
        "thread_followup_controls",
        _thread_fk(primary=True),
        sa.Column("assessment_enabled", sa.Boolean),
        sa.Column("planning_enabled", sa.Boolean),
        sa.Column("customer_email_enabled", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("customer_recipient_email", sa.String(320)),
        sa.Column("customer_email_enabled_by", sa.String(64)),
        sa.Column("customer_email_enabled_at", sa.DateTime(timezone=True)),
        sa.Column("manual_temperature", sa.String(16)),
        sa.Column("manual_temperature_by", sa.String(64)),
        sa.Column("manual_temperature_at", sa.DateTime(timezone=True)),
        sa.Column("manual_due_at", sa.DateTime(timezone=True)),
        sa.Column("manual_due_tz", sa.String(64)),
        sa.Column("manual_due_by", sa.String(64)),
        sa.Column("manual_interval_days", sa.Integer),
        sa.Column("manual_max_attempts", sa.Integer),
        sa.Column("manual_notice_days", sa.Integer),
        sa.Column("snoozed_until", sa.DateTime(timezone=True)),
        sa.Column("completed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("completed_by", sa.String(64)),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        *_ts(),
    )
    op.create_table(
        "message_assessments",
        sa.Column("id", sa.String(64), primary_key=True),
        _thread_fk(),
        sa.Column("message_id", sa.String(64), nullable=False),
        sa.Column("message_sent_at", sa.DateTime(timezone=True)),
        sa.Column("prompt_version", sa.String(48), nullable=False),
        sa.Column("model", sa.String(64)),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("applied", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("not_applied_reason", sa.String(64)),
        sa.Column("suggested_temperature", sa.String(16)),
        sa.Column("label_confidence", sa.Float),
        sa.Column("buying_interest", sa.Float),
        sa.Column("outcome", sa.String(32)),
        sa.Column("next_actor", sa.String(16)),
        sa.Column("decision", sa.String(32)),
        sa.Column("explanation", sa.Text),
        sa.Column("result", JSONB),
        sa.Column("error", sa.Text),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer),
        *_ts(),
        sa.UniqueConstraint("thread_id", "message_id", "prompt_version", name="uq_assessment_message_version"),
    )
    op.create_index("ix_assessment_thread_created", "message_assessments", ["tenant_id", "thread_id", "created_at"])
    op.create_table(
        "thread_followup_states",
        _thread_fk(primary=True),
        sa.Column("revision", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_message_id", sa.String(64)),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("last_assessment_id", sa.String(64)),
        sa.Column("suggested_temperature", sa.String(16)),
        sa.Column("effective_temperature", sa.String(16)),
        sa.Column("temperature_source", sa.String(16)),
        sa.Column("temperature_reason", sa.Text),
        sa.Column("outcome", sa.String(32)),
        sa.Column("next_actor", sa.String(16)),
        sa.Column("next_action", sa.Text),
        sa.Column("decision", sa.String(32)),
        sa.Column("status", sa.String(16), nullable=False, server_default="none"),
        sa.Column("opportunities", JSONB),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("due_tz", sa.String(64)),
        sa.Column("due_precision", sa.String(16)),
        sa.Column("due_source", sa.String(32)),
        sa.Column("due_phrase", sa.Text),
        sa.Column("notice_at", sa.DateTime(timezone=True)),
        sa.Column("needs_review", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("review_reason", sa.Text),
        sa.Column("stale", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("stale_reason", sa.String(64)),
        sa.Column("sequence_anchor_message_id", sa.String(64)),
        sa.Column("attempts_used", sa.Integer, nullable=False, server_default="0"),
        *_ts(),
    )
    op.create_index("ix_followup_state_status", "thread_followup_states", ["tenant_id", "status"])
    op.create_index("ix_followup_state_due", "thread_followup_states", ["tenant_id", "due_at"])
    op.create_table(
        "contact_suppressions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("recipient_email", sa.String(320), nullable=False),
        sa.Column("scope", sa.String(16), nullable=False),
        sa.Column("until_at", sa.DateTime(timezone=True)),
        sa.Column("thread_id", sa.String(64)),
        sa.Column("source_message_id", sa.String(64)),
        sa.Column("quote", sa.Text),
        sa.Column("lifted_at", sa.DateTime(timezone=True)),
        sa.Column("lifted_by", sa.String(64)),
        *_ts(),
    )
    op.create_index("ix_suppression_lookup", "contact_suppressions", ["tenant_id", "recipient_email"])
    op.create_index("uq_suppression_active", "contact_suppressions", ["tenant_id", "recipient_email", "scope"],
                    unique=True, postgresql_where=sa.text("lifted_at IS NULL"))
    op.create_table(
        "followup_occurrences",
        sa.Column("id", sa.String(64), primary_key=True),
        _thread_fk(),
        sa.Column("anchor_message_id", sa.String(64), nullable=False),
        sa.Column("step", sa.Integer, nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("scheduled_by", sa.String(64)),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notice_at", sa.DateTime(timezone=True)),
        sa.Column("tz", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("reason", sa.Text),
        sa.Column("status", sa.String(16), nullable=False, server_default="scheduled"),
        sa.Column("advance_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("due_notice_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("customer_status", sa.String(16), nullable=False, server_default="not_applicable"),
        sa.Column("state_revision", sa.Integer, nullable=False, server_default="0"),
        sa.Column("recipient_email", sa.String(320)),
        sa.Column("outbound_message_id", sa.String(64)),
        sa.Column("hold_reason", sa.Text),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text),
        *_ts(),
        sa.UniqueConstraint("thread_id", "anchor_message_id", "step", name="uq_occurrence_anchor_step"),
    )
    op.create_index("ix_occurrence_due", "followup_occurrences", ["status", "due_at"])
    op.create_index("ix_occurrence_notice", "followup_occurrences", ["status", "notice_at"])
    op.create_table(
        "followup_notice_deliveries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("occurrence_id", sa.String(64), sa.ForeignKey("followup_occurrences.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("notice_type", sa.String(16), nullable=False),
        sa.Column("user_id", sa.String(64)),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        *_ts(),
        sa.UniqueConstraint("occurrence_id", "notice_type", "email", name="uq_notice_recipient"),
    )


def downgrade() -> None:
    op.drop_table("followup_notice_deliveries")
    op.drop_table("followup_occurrences")
    op.drop_index("uq_suppression_active", table_name="contact_suppressions")
    op.drop_index("ix_suppression_lookup", table_name="contact_suppressions")
    op.drop_table("contact_suppressions")
    op.drop_table("thread_followup_states")
    op.drop_table("message_assessments")
    op.drop_table("thread_followup_controls")
    op.drop_table("followup_policies")
