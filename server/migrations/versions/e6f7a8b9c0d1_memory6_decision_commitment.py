"""Memory 6: Decision & Commitment Memory.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-11-12 00:30:00.000000

Additive only:
  1. `commitments`              — promises, decisions and action items with owner, due date,
                                  lifecycle and provenance.
  2. `organizations.timezone`   — optional IANA zone used to resolve "by Friday"-style deadlines.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "commitments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("owed_by", sa.String(16), nullable=False),
        sa.Column("category", sa.String(16), nullable=False, server_default="other"),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("statement_key", sa.String(255), nullable=False),
        sa.Column("thread_id", sa.String(64), nullable=True),
        sa.Column("counterparty_email", sa.String(320), nullable=True),
        sa.Column("owner_email", sa.String(320), nullable=True),
        sa.Column("owner_user_id", sa.String(64), nullable=True),
        sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_text", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_message_id", sa.String(64), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(320), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("resolution_message_id", sa.String(64), nullable=True),
        sa.Column("superseded_by_id", sa.String(64), nullable=True),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "source_message_id", "statement_key", name="uq_commitments_source_statement"),
    )
    op.create_index("ix_commitments_tenant_id", "commitments", ["tenant_id"])
    op.create_index("ix_commitments_created_at", "commitments", ["created_at"])
    op.create_index("ix_commitments_tenant_status_due", "commitments", ["tenant_id", "status", "due_at"])
    op.create_index("ix_commitments_tenant_thread_status", "commitments", ["tenant_id", "thread_id", "status"])
    op.create_index(
        "ix_commitments_tenant_counterparty_status", "commitments", ["tenant_id", "counterparty_email", "status"]
    )
    op.add_column("organizations", sa.Column("timezone", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "timezone")
    op.drop_table("commitments")
