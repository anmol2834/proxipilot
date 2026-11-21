"""Drop three tables nothing uses: evidence, attachment_metadata, business_entities.

They were created by the initial schema but no code reads or writes them (their models had no
callers and only two unused back-references). All three are empty in production.

Rollback: `alembic downgrade 3d4e5f6a7b8c` recreates them empty with the same columns, keys and
indexes.

Revision ID: 4e5f6a7b8c9d
Revises: 3d4e5f6a7b8c
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4e5f6a7b8c9d"
down_revision: Union[str, None] = "3d4e5f6a7b8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("evidence", "attachment_metadata", "business_entities"):
        op.execute(f"DROP TABLE IF EXISTS {table}")


def _stamps():
    return [
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def downgrade() -> None:
    op.create_table(
        "evidence",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("ai_run_id", sa.String(64), sa.ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False,
                  index=True),
        sa.Column("source_type", sa.String(64), nullable=False, index=True),
        sa.Column("source_id", sa.String(64), nullable=False),
        sa.Column("qdrant_point_id", sa.String(128), nullable=True),
        sa.Column("relevance_score", sa.Float, nullable=True),
        sa.Column("authority_score", sa.Float, nullable=True),
        sa.Column("excerpt", sa.Text, nullable=True),
        sa.Column("retrieval_rank", sa.Integer, nullable=True),
        *_stamps(),
    )
    op.create_table(
        "attachment_metadata",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("message_id", sa.String(64), sa.ForeignKey("email_messages.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("storage_object_key", sa.String(2048), nullable=True),
        sa.Column("is_inline", sa.Boolean, nullable=False),
        *_stamps(),
    )
    op.create_table(
        "business_entities",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("entity_type", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(512), nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("attributes_json", sa.Text, nullable=True),
        sa.Column("authority_score", sa.Float, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, index=True),
        sa.Column("effective_from", sa.String(64), nullable=True),
        sa.Column("effective_until", sa.String(64), nullable=True),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        *_stamps(),
    )
