"""Memory 2: Communication Style Memory.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-11-12 01:30:00.000000

Additive only: `style_profiles` — learned + employee-defined writing style per company and per sender.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "style_profiles",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("scope", sa.String(16), nullable=False),
        sa.Column("scope_key", sa.String(320), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="insufficient_data"),
        sa.Column("stats", sa.Text(), nullable=True),
        sa.Column("learned_guide", sa.Text(), nullable=True),
        sa.Column("overrides", sa.Text(), nullable=True),
        sa.Column("employee_guide", sa.Text(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sample_fingerprint", sa.String(64), nullable=True),
        sa.Column("source_watermark", sa.DateTime(timezone=True), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "scope", "scope_key", name="uq_style_profiles_scope"),
    )
    op.create_index("ix_style_profiles_tenant_id", "style_profiles", ["tenant_id"])
    op.create_index("ix_style_profiles_created_at", "style_profiles", ["created_at"])


def downgrade() -> None:
    op.drop_table("style_profiles")
