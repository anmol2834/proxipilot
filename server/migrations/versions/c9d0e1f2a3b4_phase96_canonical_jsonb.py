"""Phase 9.6: Knowledge Storage Architecture Refactor - Canonical JSONB & Sync Alignment.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-17 22:40:00.000000

Changes:
  1. ALTER TABLE knowledge_versions:
     - ADD COLUMN canonical_data JSONB NULL
     - ADD COLUMN projection_status VARCHAR(32) NOT NULL DEFAULT 'pending'
     - ADD COLUMN semantic_status VARCHAR(32) NOT NULL DEFAULT 'pending'
     - ADD COLUMN projection_error TEXT NULL
     - ADD COLUMN last_projected_at TIMESTAMPTZ NULL
     - GIN Index on canonical_data
     - INDEX on (tenant_id, projection_status)
     - INDEX on (tenant_id, semantic_status)
  2. ALTER TABLE knowledge_semantic_chunks:
     - ADD COLUMN vector_point_id VARCHAR(64) NULL
     - ADD COLUMN semantic_hash VARCHAR(64) NULL
     - ADD COLUMN metadata JSONB NULL
     - INDEX on (tenant_id, semantic_hash)
     - INDEX on vector_point_id
  3. DROP UNUSED LEGACY TABLES (Cost & schema cleanup, safe & idempotent):
     - auth_store
     - es_messages
     - es_conversations
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add canonical_data & sync tracking to knowledge_versions
    # ------------------------------------------------------------------
    json_col_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

    op.add_column(
        "knowledge_versions",
        sa.Column("canonical_data", json_col_type, nullable=True, comment="Authoritative normalized business data"),
    )
    op.add_column(
        "knowledge_versions",
        sa.Column(
            "projection_status",
            sa.String(length=32),
            server_default="pending",
            nullable=False,
            comment="pending | projected | failed",
        ),
    )
    op.add_column(
        "knowledge_versions",
        sa.Column(
            "semantic_status",
            sa.String(length=32),
            server_default="pending",
            nullable=False,
            comment="pending | synced | failed",
        ),
    )
    op.add_column(
        "knowledge_versions",
        sa.Column("projection_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "knowledge_versions",
        sa.Column("last_projected_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Indexes on knowledge_versions
    op.create_index(
        "ix_knowledge_versions_tenant_proj_status",
        "knowledge_versions",
        ["tenant_id", "projection_status"],
        unique=False,
    )
    op.create_index(
        "ix_knowledge_versions_tenant_sem_status",
        "knowledge_versions",
        ["tenant_id", "semantic_status"],
        unique=False,
    )

    # GIN index for PostgreSQL JSONB search
    bind = op.get_bind()
    if bind and bind.dialect.name == "postgresql":
        op.create_index(
            "ix_knowledge_versions_canonical_data",
            "knowledge_versions",
            ["canonical_data"],
            postgresql_using="gin",
        )

    # ------------------------------------------------------------------
    # 2. Add synchronization & metadata columns to knowledge_semantic_chunks
    # ------------------------------------------------------------------
    op.add_column(
        "knowledge_semantic_chunks",
        sa.Column("vector_point_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "knowledge_semantic_chunks",
        sa.Column("semantic_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "knowledge_semantic_chunks",
        sa.Column("metadata", json_col_type, nullable=True),
    )

    op.create_index(
        "ix_knowledge_semantic_chunks_vector_pt",
        "knowledge_semantic_chunks",
        ["vector_point_id"],
        unique=False,
    )
    op.create_index(
        "ix_knowledge_semantic_chunks_tenant_hash",
        "knowledge_semantic_chunks",
        ["tenant_id", "semantic_hash"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 3. Clean up dead/unwanted legacy prototype tables
    # ------------------------------------------------------------------
    op.execute("DROP TABLE IF EXISTS auth_store CASCADE;")
    op.execute("DROP TABLE IF EXISTS es_messages CASCADE;")
    op.execute("DROP TABLE IF EXISTS es_conversations CASCADE;")


def downgrade() -> None:
    # 1. Revert knowledge_semantic_chunks columns & indexes
    op.drop_index("ix_knowledge_semantic_chunks_tenant_hash", table_name="knowledge_semantic_chunks")
    op.drop_index("ix_knowledge_semantic_chunks_vector_pt", table_name="knowledge_semantic_chunks")
    op.drop_column("knowledge_semantic_chunks", "metadata")
    op.drop_column("knowledge_semantic_chunks", "semantic_hash")
    op.drop_column("knowledge_semantic_chunks", "vector_point_id")

    # 2. Revert knowledge_versions columns & indexes
    bind = op.get_bind()
    if bind and bind.dialect.name == "postgresql":
        op.drop_index("ix_knowledge_versions_canonical_data", table_name="knowledge_versions")

    op.drop_index("ix_knowledge_versions_tenant_sem_status", table_name="knowledge_versions")
    op.drop_index("ix_knowledge_versions_tenant_proj_status", table_name="knowledge_versions")
    op.drop_column("knowledge_versions", "last_projected_at")
    op.drop_column("knowledge_versions", "projection_error")
    op.drop_column("knowledge_versions", "semantic_status")
    op.drop_column("knowledge_versions", "projection_status")
    op.drop_column("knowledge_versions", "canonical_data")
