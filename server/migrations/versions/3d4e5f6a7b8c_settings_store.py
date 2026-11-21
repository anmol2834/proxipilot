"""Settings store: user_settings + workspace_settings (registry-backed values, additive).

One row per (owner, setting key). Keys, types and defaults are defined in code
(app/contracts/settings_registry.py), so adding a setting later needs no migration: new owners are
provisioned at creation and existing owners by the idempotent start-up reconcile.

This migration only creates the tables. Existing users/workspaces receive their default rows from
`settings_store.reconcile_defaults()` (runs once at API start-up under an advisory lock; insert-only
for missing keys).

Rollback: `alembic downgrade 2c3d4e5f6a7b` drops both tables. Nothing else reads them yet.

Revision ID: 3d4e5f6a7b8c
Revises: 2c3d4e5f6a7b
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3d4e5f6a7b8c"
down_revision: Union[str, None] = "2c3d4e5f6a7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(owner_col: str, owner_fk: str):
    return [
        sa.Column(owner_col, sa.String(64), sa.ForeignKey(owner_fk, ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", postgresql.JSONB, nullable=False),
        sa.Column("is_customized", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table("user_settings", *_columns("user_id", "users.id"))
    op.create_index("ix_user_settings_created_at", "user_settings", ["created_at"])
    op.create_table("workspace_settings", *_columns("tenant_id", "organizations.id"))
    op.create_index("ix_workspace_settings_created_at", "workspace_settings", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_workspace_settings_created_at", table_name="workspace_settings")
    op.drop_table("workspace_settings")
    op.drop_index("ix_user_settings_created_at", table_name="user_settings")
    op.drop_table("user_settings")
