"""Company Info: Company-Info-owned public facts + share flags per workspace (additive).

Shared facts (name, website, industry, description, industries served, offerings, customer types)
stay owned by organizations / business_profiles; this table holds only the facts the Company Info
editor owns (contact routes, branches, hours, coverage, ...) and the share flags. The searchable
knowledge item is a derived projection (knowledge_items.external_identity_key = 'company_profile').

Rollback: `alembic downgrade 1b2c3d4e5f6a` drops this table only. Manual Company Info knowledge
items and every knowledge version (including the managed item's history) are untouched.

Revision ID: 2c3d4e5f6a7b
Revises: 1b2c3d4e5f6a
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "2c3d4e5f6a7b"
down_revision: Union[str, None] = "1b2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_info_profiles",
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("revision", sa.Integer, nullable=False, server_default="0"),
        sa.Column("facts", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("share", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("knowledge_item_id", sa.String(64), nullable=True),
        sa.Column("updated_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("company_info_profiles")
