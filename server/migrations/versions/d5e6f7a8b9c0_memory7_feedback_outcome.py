"""Memory 7: Feedback & Outcome Memory.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-11-11 23:59:00.000000

Additive only:
  1. `draft_feedback`     — human judgement on AI drafts (approve / edit / reject / replace).
  2. `response_outcomes`  — customer reaction to each sent reply.
  3. `feedback_lessons`   — tenant drafting rules learned from feedback or set by employees.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table(
        "draft_feedback",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("ai_response_id", sa.String(64), nullable=True),
        sa.Column("thread_id", sa.String(64), nullable=False),
        sa.Column("message_id", sa.String(64), nullable=True),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False),
        sa.Column("reviewer_user_id", sa.String(64), nullable=True),
        sa.Column("reason_code", sa.String(32), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("intent", sa.String(64), nullable=True),
        sa.Column("original_text", sa.Text(), nullable=True),
        sa.Column("final_text", sa.Text(), nullable=True),
        sa.Column("similarity", sa.Float(), nullable=True),
        sa.Column("length_ratio", sa.Float(), nullable=True),
        *_ts(),
        sa.UniqueConstraint("tenant_id", "ai_response_id", "message_id", name="uq_draft_feedback_response_message"),
    )
    op.create_index("ix_draft_feedback_tenant_id", "draft_feedback", ["tenant_id"])
    op.create_index("ix_draft_feedback_created_at", "draft_feedback", ["created_at"])
    op.create_index("ix_draft_feedback_tenant_created", "draft_feedback", ["tenant_id", "created_at"])
    op.create_index("ix_draft_feedback_tenant_action", "draft_feedback", ["tenant_id", "action"])
    op.create_index("ix_draft_feedback_tenant_intent", "draft_feedback", ["tenant_id", "intent"])

    op.create_table(
        "response_outcomes",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("thread_id", sa.String(64), nullable=False),
        sa.Column("sent_message_id", sa.String(64), nullable=False),
        sa.Column("customer_message_id", sa.String(64), nullable=False),
        sa.Column("sent_by", sa.String(16), nullable=False),
        sa.Column("ai_response_id", sa.String(64), nullable=True),
        sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("signals", sa.Text(), nullable=True),
        sa.Column("response_latency_seconds", sa.Integer(), nullable=True),
        *_ts(),
        sa.UniqueConstraint("tenant_id", "sent_message_id", name="uq_response_outcomes_sent_message"),
    )
    op.create_index("ix_response_outcomes_tenant_id", "response_outcomes", ["tenant_id"])
    op.create_index("ix_response_outcomes_created_at", "response_outcomes", ["created_at"])
    op.create_index("ix_response_outcomes_tenant_outcome", "response_outcomes", ["tenant_id", "outcome"])

    op.create_table(
        "feedback_lessons",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("scope_intent", sa.String(64), nullable=True),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("derived_key", sa.String(128), nullable=True),
        sa.Column("evidence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        *_ts(),
        sa.UniqueConstraint("tenant_id", "derived_key", name="uq_feedback_lessons_derived_key"),
    )
    op.create_index("ix_feedback_lessons_tenant_id", "feedback_lessons", ["tenant_id"])
    op.create_index("ix_feedback_lessons_created_at", "feedback_lessons", ["created_at"])
    op.create_index("ix_feedback_lessons_tenant_status", "feedback_lessons", ["tenant_id", "status"])


def downgrade() -> None:
    op.drop_table("feedback_lessons")
    op.drop_table("response_outcomes")
    op.drop_table("draft_feedback")
