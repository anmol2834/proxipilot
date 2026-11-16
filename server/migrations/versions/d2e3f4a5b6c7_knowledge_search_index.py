"""knowledge_search_index: indexed retrieval projection for very large catalogues (1 lakh+ items).

One row per active knowledge item with the facets every hard retrieval constraint needs as real,
indexed columns, so filtering is an index lookup (O(log n + k)) instead of a regex scan over every
item's JSON (O(n)):

  code_upper    exact / prefix code lookup          B-tree (tenant_id, code_upper) + trigram
  family        product family (role-stripped)      B-tree (tenant_id, family, price)
  item_role     finished / part / accessory / ...   B-tree (tenant_id, family, item_role, price)
  price         numeric, for cheapest / ranges      in the composite keys above
  volume_ml / weight_g / power_w  nominal sizes      B-tree (tenant_id, family, volume_ml, price)
  search_tsv    full-text document                  GIN
  title         fuzzy title match                   GIN trigram

Additive only: no existing table or column changes. Maintained by the application on every
knowledge write; backfilled per tenant by app.services.knowledge_search_index.rebuild_tenant().

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-11-16
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_search_index (
            knowledge_item_id   VARCHAR(64) PRIMARY KEY
                                REFERENCES knowledge_items(id) ON DELETE CASCADE,
            tenant_id           VARCHAR(64)  NOT NULL,
            category            VARCHAR(64),
            family              VARCHAR(255),
            product_type        VARCHAR(255),
            item_role           VARCHAR(32),
            brand               VARCHAR(255),
            code_upper          VARCHAR(255),
            title               TEXT,
            price               NUMERIC(14, 2),
            volume_ml           NUMERIC(14, 3),
            weight_g            NUMERIC(14, 3),
            power_w             NUMERIC(14, 3),
            search_tsv          TSVECTOR,
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tenant_code ON knowledge_search_index (tenant_id, code_upper)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tenant_family_price "
               "ON knowledge_search_index (tenant_id, family, price)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tenant_family_role_price "
               "ON knowledge_search_index (tenant_id, family, item_role, price)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tenant_family_volume_price "
               "ON knowledge_search_index (tenant_id, family, volume_ml, price)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tenant_category ON knowledge_search_index (tenant_id, category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_tsv ON knowledge_search_index USING GIN (search_tsv)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_code_trgm ON knowledge_search_index USING GIN (code_upper gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ksi_title_trgm ON knowledge_search_index USING GIN (title gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS knowledge_search_index")
