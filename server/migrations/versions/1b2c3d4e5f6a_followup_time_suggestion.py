"""Follow-ups: AI time-change suggestion awaiting human review (additive, nullable).

A follow-up date that is already set (by a person, or earlier) is locked: a later AI assessment that
points to a different time is stored here and highlighted in the inbox until a person accepts or
dismisses it.

Revision ID: 1b2c3d4e5f6a
Revises: 0f1a2b3c4d5e
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "1b2c3d4e5f6a"
down_revision: Union[str, None] = "0f1a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLS = ("suggested_due_at", "suggested_due_tz", "suggested_due_phrase", "suggested_due_source", "suggested_at")


def upgrade() -> None:
    op.add_column("thread_followup_states", sa.Column("suggested_due_at", sa.DateTime(timezone=True)))
    op.add_column("thread_followup_states", sa.Column("suggested_due_tz", sa.String(64)))
    op.add_column("thread_followup_states", sa.Column("suggested_due_phrase", sa.Text))
    op.add_column("thread_followup_states", sa.Column("suggested_due_source", sa.String(32)))
    op.add_column("thread_followup_states", sa.Column("suggested_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    for c in reversed(_COLS):
        op.drop_column("thread_followup_states", c)
