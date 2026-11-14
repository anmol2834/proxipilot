"""Phase 10.0: Transactional Outbox for Durable Gmail Ingress and Reliable Queue Relay.

Revision ID: f1e2d3c4b5a6
Revises: e1f2a3b4c5d6
Create Date: 2026-10-18 20:00:00.000000

Changes:
  1. Create `outbox_events` table for atomic ingress acceptance with provider_events.
  2. Add indexes for tenant isolation, status querying, and batch relay sweeping.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "outbox_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("stream_name", sa.String(64), nullable=False, server_default="email_events"),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("aggregate_type", sa.String(64), nullable=False),
        sa.Column("aggregate_id", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("correlation_id", sa.String(64), nullable=True),
        sa.Column("causation_id", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["organizations.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_outbox_events_tenant_id", "outbox_events", ["tenant_id"], unique=False)
    op.create_index("ix_outbox_events_status", "outbox_events", ["status"], unique=False)
    op.create_index("ix_outbox_events_stream_name", "outbox_events", ["stream_name"], unique=False)
    op.create_index(
        "ix_outbox_events_status_created",
        "outbox_events",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_events_status_created", table_name="outbox_events")
    op.drop_index("ix_outbox_events_stream_name", table_name="outbox_events")
    op.drop_index("ix_outbox_events_status", table_name="outbox_events")
    op.drop_index("ix_outbox_events_tenant_id", table_name="outbox_events")
    op.drop_table("outbox_events")
