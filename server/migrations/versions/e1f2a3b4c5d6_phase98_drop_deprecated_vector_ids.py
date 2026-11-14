"""Phase 9.8: Safe Schema Cleanup - Drop deprecated knowledge_versions.vector_ids column.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-18 12:45:00.000000

Changes:
  1. Drop legacy column `vector_ids` on `knowledge_versions`.
     Authoritative vector mappings are exclusively managed by
     `knowledge_semantic_chunks.vector_point_id`.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safely drop deprecated vector_ids column if it exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("knowledge_versions")]
    if "vector_ids" in columns:
        op.drop_column("knowledge_versions", "vector_ids")


def downgrade() -> None:
    op.add_column(
        "knowledge_versions",
        sa.Column(
            "vector_ids",
            sa.Text(),
            nullable=True,
            comment="JSON array of Qdrant point UUIDs for this version's chunk embeddings",
        ),
    )
