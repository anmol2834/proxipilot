"""create sync_cursors and provider_events tables and reconcile integration accounts

Revision ID: 8f12a4b3c7d9
Revises: 13dd0c35777f
Create Date: 2026-09-17 10:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f12a4b3c7d9"
down_revision: Union[str, None] = "13dd0c35777f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add missing lifecycle and health columns to connected_integration_accounts
    with op.batch_alter_table("connected_integration_accounts") as batch_op:
        batch_op.add_column(
            sa.Column(
                "connection_status",
                sa.String(32),
                nullable=False,
                server_default="healthy",
            )
        )
        batch_op.add_column(sa.Column("provider_account_id", sa.String(256), nullable=True))
        batch_op.add_column(sa.Column("last_connected_at", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("last_disconnected_at", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("last_successful_sync_at", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("last_event_received_at", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("last_error_code", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("last_error_at", sa.String(64), nullable=True))
        batch_op.create_index(
            "ix_connected_integration_accounts_tenant_provider_status",
            ["tenant_id", "provider", "status"],
            unique=False,
        )

    # 2. Create sync_cursors table
    op.create_table(
        "sync_cursors",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("integration_account_id", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False, server_default="gmail"),
        sa.Column("cursor_type", sa.String(32), nullable=False, server_default="history_id"),
        sa.Column("cursor_value", sa.String(128), nullable=True),
        sa.Column("sync_state", sa.String(32), nullable=False, server_default="idle"),
        sa.Column("watch_resource_id", sa.String(128), nullable=True),
        sa.Column("watch_expires_at", sa.String(64), nullable=True),
        sa.Column("last_successful_sync_at", sa.String(64), nullable=True),
        sa.Column("last_attempted_sync_at", sa.String(64), nullable=True),
        sa.Column("last_full_sync_at", sa.String(64), nullable=True),
        sa.Column("last_failure_at", sa.String(64), nullable=True),
        sa.Column("last_failure_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.String(64), nullable=False),
        sa.Column("updated_at", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["integration_account_id"],
            ["connected_integration_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("integration_account_id", name="uq_sync_cursors_integration_account_id"),
    )
    op.create_index("ix_sync_cursors_tenant_id", "sync_cursors", ["tenant_id"], unique=False)
    op.create_index("ix_sync_cursors_provider", "sync_cursors", ["provider"], unique=False)
    op.create_index("ix_sync_cursors_sync_state", "sync_cursors", ["sync_state"], unique=False)
    op.create_index("ix_sync_cursors_watch_expires_at", "sync_cursors", ["watch_expires_at"], unique=False)
    op.create_index(
        "ix_sync_cursors_watch_renewal",
        "sync_cursors",
        ["provider", "sync_state", "watch_expires_at"],
        unique=False,
    )

    # 3. Create provider_events table
    op.create_table(
        "provider_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("integration_account_id", sa.String(64), nullable=True),
        sa.Column("provider", sa.String(32), nullable=False, server_default="gmail"),
        sa.Column("provider_event_id", sa.String(128), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False, server_default="gmail.mailbox_change"),
        sa.Column("event_payload_hash", sa.String(64), nullable=True),
        sa.Column("provider_timestamp", sa.String(64), nullable=True),
        sa.Column("received_at", sa.String(64), nullable=False),
        sa.Column("processed_at", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="received"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.String(64), nullable=False),
        sa.Column("updated_at", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["integration_account_id"],
            ["connected_integration_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("provider", "provider_event_id", name="uq_provider_events_provider_event_id"),
    )
    op.create_index("ix_provider_events_tenant_id", "provider_events", ["tenant_id"], unique=False)
    op.create_index("ix_provider_events_provider", "provider_events", ["provider"], unique=False)
    op.create_index("ix_provider_events_provider_event_id", "provider_events", ["provider_event_id"], unique=False)
    op.create_index("ix_provider_events_status", "provider_events", ["status"], unique=False)
    op.create_index(
        "ix_provider_events_account_received",
        "provider_events",
        ["integration_account_id", "received_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("provider_events")
    op.drop_table("sync_cursors")
    with op.batch_alter_table("connected_integration_accounts") as batch_op:
        batch_op.drop_index("ix_connected_integration_accounts_tenant_provider_status")
        batch_op.drop_column("last_error_at")
        batch_op.drop_column("last_error_code")
        batch_op.drop_column("last_event_received_at")
        batch_op.drop_column("last_successful_sync_at")
        batch_op.drop_column("last_disconnected_at")
        batch_op.drop_column("last_connected_at")
        batch_op.drop_column("provider_account_id")
        batch_op.drop_column("connection_status")
