"""Phase 8.0 Knowledge Import Architecture and Job Lifecycle.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-17 16:35:00.000000

Changes:
  1. CREATE TABLE import_jobs:
     - id VARCHAR(64) PRIMARY KEY
     - tenant_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
     - source_id VARCHAR(64) NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE
     - dataset_name VARCHAR(255) NOT NULL
     - file_type VARCHAR(32) NOT NULL
     - file_size_bytes BIGINT NULL
     - file_uri VARCHAR(2048) NULL
     - idempotency_key VARCHAR(255) NULL
     - row_count INTEGER NULL
     - processed_rows INTEGER NOT NULL DEFAULT 0
     - failed_rows INTEGER NOT NULL DEFAULT 0
     - progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00
     - status VARCHAR(32) NOT NULL DEFAULT 'created'
     - current_stage VARCHAR(32) NOT NULL DEFAULT 'created'
     - worker_id VARCHAR(128) NULL
     - last_heartbeat_at TIMESTAMPTZ NULL
     - started_at TIMESTAMPTZ NULL
     - completed_at TIMESTAMPTZ NULL
     - cancel_requested_at TIMESTAMPTZ NULL
     - retry_count INTEGER NOT NULL DEFAULT 0
     - max_retries INTEGER NOT NULL DEFAULT 3
     - error_summary TEXT NULL
     - error_details_json TEXT NULL
     - metadata_json TEXT NULL
     - created_by_user_id VARCHAR(64) NULL REFERENCES users(id) ON DELETE SET NULL
     - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     - updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  2. Create composite and operational indexes:
     - ix_import_jobs_tenant_status (tenant_id, status)
     - ix_import_jobs_tenant_created (tenant_id, created_at)
     - ix_import_jobs_tenant_source (tenant_id, source_id)
     - uq_import_jobs_tenant_idempotency (tenant_id, idempotency_key)
     - ix_import_jobs_heartbeat_recovery (status, last_heartbeat_at)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(64),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_id",
            sa.String(64),
            sa.ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dataset_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(32), nullable=False, server_default="csv"),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("file_uri", sa.String(2048), nullable=True),
        sa.Column("idempotency_key", sa.String(255), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "progress_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="created"),
        sa.Column("current_stage", sa.String(32), nullable=False, server_default="created"),
        sa.Column("worker_id", sa.String(128), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("error_details_json", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_import_jobs_tenant_status",
        "import_jobs",
        ["tenant_id", "status"],
    )
    op.create_index(
        "ix_import_jobs_tenant_created",
        "import_jobs",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "ix_import_jobs_tenant_source",
        "import_jobs",
        ["tenant_id", "source_id"],
    )
    op.create_index(
        "uq_import_jobs_tenant_idempotency",
        "import_jobs",
        ["tenant_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )
    op.create_index(
        "ix_import_jobs_heartbeat_recovery",
        "import_jobs",
        ["status", "last_heartbeat_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_import_jobs_heartbeat_recovery", table_name="import_jobs")
    op.drop_index("uq_import_jobs_tenant_idempotency", table_name="import_jobs")
    op.drop_index("ix_import_jobs_tenant_source", table_name="import_jobs")
    op.drop_index("ix_import_jobs_tenant_created", table_name="import_jobs")
    op.drop_index("ix_import_jobs_tenant_status", table_name="import_jobs")
    op.drop_table("import_jobs")
