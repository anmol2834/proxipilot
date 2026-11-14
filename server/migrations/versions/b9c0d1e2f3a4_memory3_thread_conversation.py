"""Memory 3: Thread & Conversation Memory.

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-11-12 04:30:00.000000

Additive only: `thread_memories` — one incrementally maintained conversation memory per thread.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "thread_memories",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("thread_id", sa.String(64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("stage", sa.String(32), nullable=True),
        sa.Column("sentiment", sa.String(16), nullable=True),
        sa.Column("language", sa.String(32), nullable=True),
        sa.Column("last_customer_ask", sa.Text(), nullable=True),
        sa.Column("customer_requirements", sa.Text(), nullable=True),
        sa.Column("open_issues", sa.Text(), nullable=True),
        sa.Column("key_facts", sa.Text(), nullable=True),
        sa.Column("pinned_notes", sa.Text(), nullable=True),
        sa.Column("included_until_message_id", sa.String(64), nullable=True),
        sa.Column("included_until_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("messages_included", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="ok"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("updated_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "thread_id", name="uq_thread_memories_thread"),
    )
    op.create_index("ix_thread_memories_tenant_id", "thread_memories", ["tenant_id"])
    op.create_index("ix_thread_memories_created_at", "thread_memories", ["created_at"])


def downgrade() -> None:
    op.drop_table("thread_memories")
