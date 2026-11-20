"""Follow-ups: workspace automation mode + workspace-level customer email allowance (additive).

mode                    'shadow' (observe only: assess and record, never act) | 'active'
customer_email_allowed  workspace admins must allow automatic customer email before any member can
                        enable it on a conversation (default false; never backfilled)

Revision ID: 0f1a2b3c4d5e
Revises: f4a5b6c7d8e9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0f1a2b3c4d5e"
down_revision: Union[str, None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("followup_policies", sa.Column("mode", sa.String(16), nullable=False, server_default="shadow"))
    op.add_column("followup_policies", sa.Column("customer_email_allowed", sa.Boolean, nullable=False,
                                                 server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("followup_policies", "customer_email_allowed")
    op.drop_column("followup_policies", "mode")
