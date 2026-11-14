"""users.login_count: tell a first session ("Welcome") from a returning one ("Welcome back").

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-11-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Constant server default: metadata-only on PostgreSQL 11+, no table rewrite or long lock.
    op.add_column("users", sa.Column("login_count", sa.Integer(), nullable=False, server_default="0"))
    # Accounts that existed before this change are returning users, not first sessions.
    op.execute("UPDATE users SET login_count = 1 WHERE created_at < now() - interval '1 hour'")


def downgrade() -> None:
    op.drop_column("users", "login_count")
