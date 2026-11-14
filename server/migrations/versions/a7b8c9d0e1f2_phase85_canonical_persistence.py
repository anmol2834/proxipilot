"""Phase 8.5 — Canonical Persistence: external_identity_key on knowledge_items.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-17 17:48:00.000000

Changes:
  1. ALTER TABLE knowledge_items:
     - ADD COLUMN external_identity_key VARCHAR(512) NULL
       Stores the deterministic canonical identity key assigned by Phase 8.5 bulk
       import engine. NULL for manually authored items (partial constraint safe).

  2. CREATE INDEX ix_knowledge_items_external_identity on knowledge_items(external_identity_key)
     Supports fast lookup by raw identity key for diagnostics.

  3. CREATE UNIQUE INDEX uq_knowledge_items_tenant_cat_identity on
     knowledge_items(tenant_id, category, external_identity_key)
     WHERE external_identity_key IS NOT NULL
     Partial unique constraint — enforces DB-level idempotency for bulk imports
     without affecting manually authored items that have no external identity.

Rationale:
  Phase 8.5 needs the database to provide the final correctness layer for:
  - Import restart safety (re-importing same file does not duplicate records)
  - Idempotent retry (worker crash + restart stays consistent)
  - Upsert resolution (SELECT existing by identity → decide INSERT vs new version)

  The partial index ensures:
  - Null-safe: only rows with a non-null key participate in uniqueness enforcement
  - Write-safe: manual CRUD operations remain completely unaffected
  - Performance: enables O(log N) lookup by (tenant, category, identity_key)
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add external_identity_key column to knowledge_items
    op.add_column(
        "knowledge_items",
        sa.Column(
            "external_identity_key",
            sa.String(512),
            nullable=True,
            comment=(
                "Deterministic canonical identity key assigned during bulk import (Phase 8.5). "
                "Derived from category-specific business fields (e.g. SKU+name for products). "
                "NULL for manually authored items. "
                "Unique per (tenant_id, category) when non-NULL."
            ),
        ),
    )

    # 2. Plain index for diagnostic lookups by raw identity key
    op.create_index(
        "ix_knowledge_items_external_identity",
        "knowledge_items",
        ["external_identity_key"],
    )

    # 3. Partial unique index — idempotency guarantee for bulk imports
    #    WHERE external_identity_key IS NOT NULL ensures manual items (NULL) are exempt.
    op.create_index(
        "uq_knowledge_items_tenant_cat_identity",
        "knowledge_items",
        ["tenant_id", "category", "external_identity_key"],
        unique=True,
        postgresql_where=sa.text("external_identity_key IS NOT NULL"),
    )


def downgrade() -> None:
    # Reverse in dependency order
    op.drop_index(
        "uq_knowledge_items_tenant_cat_identity",
        table_name="knowledge_items",
    )
    op.drop_index(
        "ix_knowledge_items_external_identity",
        table_name="knowledge_items",
    )
    op.drop_column("knowledge_items", "external_identity_key")
