"""Phase 7.0 knowledge architecture: sources, versions, attributes, authority, temporal model

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-17 15:30:00.000000

Changes:
  1. CREATE TABLE knowledge_sources:
     - Lineage, origin URI, metadata, authority level
     - Multi-tenant indexing on (tenant_id, authority_level)

  2. ALTER TABLE knowledge_items:
     - ADD source_id VARCHAR(64) FK to knowledge_sources
     - ADD composite INDEX on (tenant_id, category)
     - ADD composite INDEX on (tenant_id, is_active)

  3. ALTER TABLE knowledge_versions:
     - ADD source_id VARCHAR(64) FK to knowledge_sources
     - ADD authority_level VARCHAR(32) NOT NULL DEFAULT 'manual'
     - ADD change_summary VARCHAR(512) NULL
     - ADD effective_from TIMESTAMPTZ NULL
     - ADD effective_until TIMESTAMPTZ NULL
     - CONVERT published_at to TIMESTAMPTZ
     - CONVERT archived_at to TIMESTAMPTZ
     - ADD UNIQUE(knowledge_item_id, version_number)
     - ADD composite INDEX on (tenant_id, status, effective_from, effective_until)

  4. CREATE TABLE knowledge_attributes:
     - Typed structured facts (string, number, boolean, date, json)
     - UNIQUE(knowledge_version_id, key)
     - Range index on (tenant_id, key, number_value)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # 1. CREATE TABLE knowledge_sources
    # =========================================================================
    op.create_table(
        "knowledge_sources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("authority_level", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("origin_uri", sa.String(2048), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
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
    )
    op.create_index(
        "ix_knowledge_sources_tenant_authority",
        "knowledge_sources",
        ["tenant_id", "authority_level"],
    )
    op.create_index(
        "ix_knowledge_sources_tenant_created",
        "knowledge_sources",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "ix_knowledge_sources_source_type",
        "knowledge_sources",
        ["source_type"],
    )

    # =========================================================================
    # 2. ALTER TABLE knowledge_items
    # =========================================================================
    with op.batch_alter_table("knowledge_items") as batch_op:
        batch_op.add_column(
            sa.Column("source_id", sa.String(64), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_knowledge_items_source_id",
            "knowledge_sources",
            ["source_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_knowledge_items_source_id", ["source_id"])
        batch_op.create_index(
            "ix_knowledge_items_tenant_category",
            ["tenant_id", "category"],
        )
        batch_op.create_index(
            "ix_knowledge_items_tenant_active",
            ["tenant_id", "is_active"],
        )

    # =========================================================================
    # 3. ALTER TABLE knowledge_versions
    # =========================================================================
    with op.batch_alter_table("knowledge_versions") as batch_op:
        batch_op.add_column(
            sa.Column("source_id", sa.String(64), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_knowledge_versions_source_id",
            "knowledge_sources",
            ["source_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_knowledge_versions_source_id", ["source_id"])

        batch_op.add_column(
            sa.Column(
                "authority_level",
                sa.String(32),
                nullable=False,
                server_default="manual",
            )
        )
        batch_op.add_column(
            sa.Column("change_summary", sa.String(512), nullable=True)
        )
        batch_op.add_column(
            sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("created_by_user_id", sa.String(64), nullable=True)
        )

        # Alter published_at and archived_at to TIMESTAMPTZ safely
        batch_op.alter_column(
            "published_at",
            type_=sa.DateTime(timezone=True),
            existing_type=sa.String(64),
            postgresql_using="NULLIF(published_at, '')::timestamptz",
            nullable=True,
        )
        batch_op.alter_column(
            "archived_at",
            type_=sa.DateTime(timezone=True),
            existing_type=sa.String(64),
            postgresql_using="NULLIF(archived_at, '')::timestamptz",
            nullable=True,
        )

        batch_op.create_unique_constraint(
            "uq_knowledge_versions_item_version",
            ["knowledge_item_id", "version_number"],
        )
        batch_op.create_index(
            "ix_knowledge_versions_temporal",
            ["tenant_id", "status", "effective_from", "effective_until"],
        )

    # =========================================================================
    # 4. CREATE TABLE knowledge_attributes
    # =========================================================================
    op.create_table(
        "knowledge_attributes",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column(
            "knowledge_version_id",
            sa.String(64),
            sa.ForeignKey("knowledge_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value_type", sa.String(32), nullable=False, server_default="string"),
        sa.Column("string_value", sa.String(1024), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("number_value", sa.Float(), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.DateTime(timezone=True), nullable=True),
        sa.Column("json_value", sa.Text(), nullable=True),
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


def downgrade() -> None:
    # 1. Drop knowledge_attributes
    op.drop_table("knowledge_attributes")

    # 2. Revert knowledge_versions
    with op.batch_alter_table("knowledge_versions") as batch_op:
        batch_op.drop_index("ix_knowledge_versions_temporal")
        batch_op.drop_constraint("uq_knowledge_versions_item_version", type_="unique")
        batch_op.alter_column(
            "archived_at",
            type_=sa.String(64),
            existing_type=sa.DateTime(timezone=True),
            postgresql_using="archived_at::text",
            nullable=True,
        )
        batch_op.alter_column(
            "published_at",
            type_=sa.String(64),
            existing_type=sa.DateTime(timezone=True),
            postgresql_using="published_at::text",
            nullable=True,
        )
        batch_op.drop_column("created_by_user_id")
        batch_op.drop_column("effective_until")
        batch_op.drop_column("effective_from")
        batch_op.drop_column("change_summary")
        batch_op.drop_column("authority_level")
        batch_op.drop_index("ix_knowledge_versions_source_id")
        batch_op.drop_constraint("fk_knowledge_versions_source_id", type_="foreignkey")
        batch_op.drop_column("source_id")

    # 3. Revert knowledge_items
    with op.batch_alter_table("knowledge_items") as batch_op:
        batch_op.drop_index("ix_knowledge_items_tenant_active")
        batch_op.drop_index("ix_knowledge_items_tenant_category")
        batch_op.drop_index("ix_knowledge_items_source_id")
        batch_op.drop_constraint("fk_knowledge_items_source_id", type_="foreignkey")
        batch_op.drop_column("source_id")

    # 4. Drop knowledge_sources
    op.drop_table("knowledge_sources")
