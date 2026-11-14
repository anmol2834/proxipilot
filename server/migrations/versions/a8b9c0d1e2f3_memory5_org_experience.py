"""Memory 5: Organizational Experience Memory.

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-11-12 03:00:00.000000

Additive only: `org_practices` — workflows, negotiation limits, approval rules, complaint
handling, exceptions; employee-written or learned (suggested until approved).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_practices",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("situation", sa.String(32), nullable=False, server_default="general"),
        sa.Column("trigger_keywords", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("rules", sa.Text(), nullable=True),
        sa.Column("exceptions", sa.Text(), nullable=True),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approver", sa.String(255), nullable=True),
        sa.Column("escalate_to_human", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("origin", sa.String(16), nullable=False, server_default="employee"),
        sa.Column("derived_key", sa.String(200), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        sa.Column("updated_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "derived_key", name="uq_org_practices_derived_key"),
    )
    op.create_index("ix_org_practices_tenant_id", "org_practices", ["tenant_id"])
    op.create_index("ix_org_practices_created_at", "org_practices", ["created_at"])
    op.create_index("ix_org_practices_tenant_status", "org_practices", ["tenant_id", "status"])


def downgrade() -> None:
    op.drop_table("org_practices")
