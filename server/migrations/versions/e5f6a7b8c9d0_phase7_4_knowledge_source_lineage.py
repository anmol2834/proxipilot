"""Phase 7.4 Knowledge Sources Lineage, Authority, and Temporal Validity.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-17 16:15:00.000000

Changes:
  1. ALTER TABLE knowledge_sources:
     - ADD status VARCHAR(32) NOT NULL DEFAULT 'active'
     - ADD source_reference VARCHAR(255) NULL
     - ADD dataset_name VARCHAR(255) NULL
     - ADD file_name VARCHAR(255) NULL
     - ADD checksum VARCHAR(128) NULL
     - ADD schema_fingerprint VARCHAR(64) NULL
     - ADD effective_from TIMESTAMPTZ NULL
     - ADD effective_until TIMESTAMPTZ NULL
     - ADD composite INDEX ix_knowledge_sources_tenant_status (tenant_id, status)
     - ADD composite INDEX ix_knowledge_sources_tenant_checksum (tenant_id, checksum)
     - ADD composite INDEX ix_knowledge_sources_tenant_type_ref (tenant_id, source_type, source_reference)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to knowledge_sources
    with op.batch_alter_table("knowledge_sources") as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(32), nullable=False, server_default="active")
        )
        batch_op.add_column(
            sa.Column("source_reference", sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column("dataset_name", sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column("file_name", sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column("checksum", sa.String(128), nullable=True)
        )
        batch_op.add_column(
            sa.Column("schema_fingerprint", sa.String(64), nullable=True)
        )
        batch_op.add_column(
            sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True)
        )

    # 2. Add composite indexes
    op.create_index(
        "ix_knowledge_sources_tenant_status",
        "knowledge_sources",
        ["tenant_id", "status"],
    )
    op.create_index(
        "ix_knowledge_sources_tenant_checksum",
        "knowledge_sources",
        ["tenant_id", "checksum"],
    )
    op.create_index(
        "ix_knowledge_sources_tenant_type_ref",
        "knowledge_sources",
        ["tenant_id", "source_type", "source_reference"],
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_sources_tenant_type_ref", table_name="knowledge_sources")
    op.drop_index("ix_knowledge_sources_tenant_checksum", table_name="knowledge_sources")
    op.drop_index("ix_knowledge_sources_tenant_status", table_name="knowledge_sources")

    with op.batch_alter_table("knowledge_sources") as batch_op:
        batch_op.drop_column("effective_until")
        batch_op.drop_column("effective_from")
        batch_op.drop_column("schema_fingerprint")
        batch_op.drop_column("checksum")
        batch_op.drop_column("file_name")
        batch_op.drop_column("dataset_name")
        batch_op.drop_column("source_reference")
        batch_op.drop_column("status")
