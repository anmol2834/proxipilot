"""Phase 7.2 flexible schema engine: reusable tenant-scoped schema mapping profiles.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-17 15:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_schema_profiles",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False, server_default="csv"),
        sa.Column("mappings_json", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "category",
            "fingerprint",
            "version",
            name="uq_knowledge_schema_profile_tenant_cat_fp_ver",
        ),
    )
    op.create_index(
        "ix_knowledge_schema_profiles_tenant_cat_fp",
        "knowledge_schema_profiles",
        ["tenant_id", "category", "fingerprint"],
    )
    op.create_index(
        "ix_knowledge_schema_profiles_fingerprint",
        "knowledge_schema_profiles",
        ["fingerprint"],
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_schema_profiles_fingerprint", table_name="knowledge_schema_profiles")
    op.drop_index("ix_knowledge_schema_profiles_tenant_cat_fp", table_name="knowledge_schema_profiles")
    op.drop_table("knowledge_schema_profiles")
