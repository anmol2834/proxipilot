"""Phase 8.6: AI-Ready Semantic Projection Chunks & Semantic Version.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-17 18:25:00.000000

Changes:
  1. ALTER TABLE knowledge_versions:
     - ADD COLUMN semantic_version INTEGER NULL
  2. CREATE TABLE knowledge_semantic_chunks:
     - id VARCHAR(64) PRIMARY KEY
     - tenant_id VARCHAR(64) NOT NULL
     - knowledge_item_id VARCHAR(64) NOT NULL
     - knowledge_version_id VARCHAR(64) NOT NULL
     - chunk_index INTEGER NOT NULL
     - section VARCHAR(64) NOT NULL
     - text TEXT NOT NULL
     - char_count INTEGER NOT NULL
     - projection_version INTEGER NOT NULL DEFAULT 1
     - source_id VARCHAR(64) NULL
     - authority_level VARCHAR(32) NOT NULL DEFAULT 'manual'
     - status VARCHAR(32) NOT NULL DEFAULT 'active'
     - effective_from TIMESTAMPTZ NULL
     - effective_until TIMESTAMPTZ NULL
     - created_at TIMESTAMPTZ NOT NULL
     - updated_at TIMESTAMPTZ NOT NULL
  3. Unique and performance indexes:
     - UNIQUE (knowledge_version_id, chunk_index)
     - INDEX (tenant_id, knowledge_version_id)
     - INDEX (tenant_id, section)
     - INDEX (tenant_id, knowledge_item_id)
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add semantic_version to knowledge_versions
    op.add_column(
        "knowledge_versions",
        sa.Column(
            "semantic_version",
            sa.Integer(),
            nullable=True,
            comment="Semantic projection schema version (Phase 8.6)",
        ),
    )

    # 2. Create knowledge_semantic_chunks table
    op.create_table(
        "knowledge_semantic_chunks",
        sa.Column("id", sa.String(length=64), nullable=False, comment="Deterministic chunk ID (e.g. chk_<sha256>)"),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("knowledge_item_id", sa.String(length=64), nullable=False),
        sa.Column("knowledge_version_id", sa.String(length=64), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, comment="0-indexed position within the version projection"),
        sa.Column("section", sa.String(length=64), nullable=False, comment="Logical section name (e.g. overview, pricing)"),
        sa.Column("text", sa.Text(), nullable=False, comment="Exact chunk text ready for embedding"),
        sa.Column("char_count", sa.Integer(), nullable=False, comment="Character length of chunk text"),
        sa.Column("projection_version", sa.Integer(), nullable=False, server_default="1", comment="Projection template schema version"),
        sa.Column("source_id", sa.String(length=64), nullable=True),
        sa.Column("authority_level", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["knowledge_item_id"],
            ["knowledge_items.id"],
            name="fk_knowledge_semantic_chunks_item_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_version_id"],
            ["knowledge_versions.id"],
            name="fk_knowledge_semantic_chunks_version_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["knowledge_sources.id"],
            name="fk_knowledge_semantic_chunks_source_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_knowledge_semantic_chunks"),
        sa.UniqueConstraint("knowledge_version_id", "chunk_index", name="uq_knowledge_semantic_chunks_ver_idx"),
    )

    op.create_index("ix_knowledge_semantic_chunks_tenant_id", "knowledge_semantic_chunks", ["tenant_id"])
    op.create_index("ix_knowledge_semantic_chunks_tenant_ver", "knowledge_semantic_chunks", ["tenant_id", "knowledge_version_id"])
    op.create_index("ix_knowledge_semantic_chunks_tenant_sec", "knowledge_semantic_chunks", ["tenant_id", "section"])
    op.create_index("ix_knowledge_semantic_chunks_tenant_item", "knowledge_semantic_chunks", ["tenant_id", "knowledge_item_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_semantic_chunks_tenant_item", table_name="knowledge_semantic_chunks")
    op.drop_index("ix_knowledge_semantic_chunks_tenant_sec", table_name="knowledge_semantic_chunks")
    op.drop_index("ix_knowledge_semantic_chunks_tenant_ver", table_name="knowledge_semantic_chunks")
    op.drop_index("ix_knowledge_semantic_chunks_tenant_id", table_name="knowledge_semantic_chunks")
    op.drop_table("knowledge_semantic_chunks")
    op.drop_column("knowledge_versions", "semantic_version")
