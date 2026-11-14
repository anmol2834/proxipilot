"""Phase 7.1 knowledge category schemas: tenant-scoped custom attribute definitions.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-17 15:38:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_attribute_definitions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("value_type", sa.String(32), nullable=False, server_default="string"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("allowed_values_json", sa.Text(), nullable=True),
        sa.Column("validation_regex", sa.String(512), nullable=True),
        sa.Column("description", sa.String(512), nullable=True),
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
        sa.UniqueConstraint("tenant_id", "category", "key", name="uq_knowledge_attr_def_tenant_cat_key"),
    )
    op.create_index(
        "ix_knowledge_attr_def_tenant_cat",
        "knowledge_attribute_definitions",
        ["tenant_id", "category"],
    )
    op.create_index(
        "ix_knowledge_attr_def_key",
        "knowledge_attribute_definitions",
        ["key"],
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_attr_def_key", table_name="knowledge_attribute_definitions")
    op.drop_index("ix_knowledge_attr_def_tenant_cat", table_name="knowledge_attribute_definitions")
    op.drop_table("knowledge_attribute_definitions")
