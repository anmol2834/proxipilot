"""Phase 9.7: Decommission EAV Storage - Drop knowledge_attributes.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-03 18:30:00.000000

Changes:
  1. Drop redundant EAV table knowledge_attributes and associated indexes:
     - ix_knowledge_attributes_numeric_range
     - ix_knowledge_attributes_tenant_key
     - ix_knowledge_attributes_knowledge_version_id
     - uq_knowledge_attributes_version_key
  2. All structured business and custom attributes are now stored authoritatively
     in knowledge_versions.canonical_data (JSONB) with GIN indexing.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safely drop indexes and constraints on knowledge_attributes, then drop table
    op.execute("DROP INDEX IF EXISTS ix_knowledge_attributes_numeric_range")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_attributes_tenant_key")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_attributes_knowledge_version_id")
    op.execute("DROP TABLE IF EXISTS knowledge_attributes CASCADE")


def downgrade() -> None:
    op.create_table(
        "knowledge_attributes",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column(
            "knowledge_version_id",
            sa.String(length=64),
            sa.ForeignKey("knowledge_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value_type", sa.String(length=32), nullable=False, server_default="string"),
        sa.Column("string_value", sa.String(length=1024), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("number_value", sa.Float(), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.DateTime(timezone=True), nullable=True),
        sa.Column("json_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "knowledge_version_id",
            "key",
            name="uq_knowledge_attributes_version_key",
        ),
    )
    op.create_index(
        "ix_knowledge_attributes_knowledge_version_id",
        "knowledge_attributes",
        ["knowledge_version_id"],
    )
    op.create_index(
        "ix_knowledge_attributes_tenant_key",
        "knowledge_attributes",
        ["tenant_id", "key"],
    )
    op.create_index(
        "ix_knowledge_attributes_numeric_range",
        "knowledge_attributes",
        ["tenant_id", "key", "number_value"],
    )
