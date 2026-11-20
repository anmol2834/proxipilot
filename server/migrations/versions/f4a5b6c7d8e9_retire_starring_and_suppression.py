"""Retire conversation starring and add thread suppression marker.

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create thread_suppression_markers table for permanent delete tombstoning across sync/replay
    op.create_table(
        "thread_suppression_markers",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("integration_account_id", sa.String(64), nullable=False, index=True),
        sa.Column("external_thread_id", sa.String(512), nullable=False, index=True),
        sa.Column("deleted_thread_id", sa.String(64), nullable=False, index=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "integration_account_id", "external_thread_id", name="uq_thread_suppression_tenant_account_ext"),
    )
    op.create_index(
        "ix_thread_suppression_lookup",
        "thread_suppression_markers",
        ["tenant_id", "deleted_thread_id"],
    )

    # 2. Retire is_starred column from email_threads
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("email_threads")]
    if "is_starred" in cols:
        op.drop_column("email_threads", "is_starred")


def downgrade() -> None:
    # 1. Re-add is_starred column
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("email_threads")]
    if "is_starred" not in cols:
        op.add_column("email_threads", sa.Column("is_starred", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # 2. Drop thread_suppression_markers table
    op.drop_index("ix_thread_suppression_lookup", table_name="thread_suppression_markers")
    op.drop_table("thread_suppression_markers")
