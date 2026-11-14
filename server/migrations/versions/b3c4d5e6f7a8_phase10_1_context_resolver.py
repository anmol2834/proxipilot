"""Phase 10.1: Conversation Context Resolver, Thread State & Unresolved Requirements.

Revision ID: b3c4d5e6f7a8
Revises: f1e2d3c4b5a6
Create Date: 2026-10-19 12:00:00.000000

Changes:
  1. Add `context_revision` to `email_threads` (default 1, optimistic locking).
  2. Add `unresolved_requirements` to `email_threads` (JSON array of customer requests).
  3. Add `summary_metadata` to `email_threads` (JSON metadata for incremental summaries).
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_threads",
        sa.Column(
            "context_revision",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Optimistic locking revision counter for context resolution and summary updates",
        ),
    )
    op.add_column(
        "email_threads",
        sa.Column(
            "unresolved_requirements",
            sa.Text(),
            nullable=True,
            comment="JSON array of structured unresolved customer requirements and requests",
        ),
    )
    op.add_column(
        "email_threads",
        sa.Column(
            "summary_metadata",
            sa.Text(),
            nullable=True,
            comment="JSON metadata tracking summary provenance, included messages, and participant roles",
        ),
    )


def downgrade() -> None:
    op.drop_column("email_threads", "summary_metadata")
    op.drop_column("email_threads", "unresolved_requirements")
    op.drop_column("email_threads", "context_revision")
