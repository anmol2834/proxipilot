"""Phase 4 inbox schema: filter pipeline, proper types, constraints, trusted_senders

Revision ID: a1b2c3d4e5f6
Revises: 8f12a4b3c7d9
Create Date: 2026-09-17 13:10:00.000000

Changes:
  email_messages:
    - DROP subject (stored on thread only)
    - DROP body_html (no HTML in DB per policy)
    - DROP raw_headers (replaced by minimal RFC fields)
    - ADD direction VARCHAR(16) NOT NULL DEFAULT 'inbound'
    - ADD message_id_header VARCHAR(998) NULL
    - ADD references_header TEXT NULL
    - ADD filter_reason VARCHAR(64) NULL
    - ALTER sent_at String(64) -> TIMESTAMPTZ
    - ADD UNIQUE(integration_account_id, external_message_id)
    - ADD composite INDEX(tenant_id, thread_id, sent_at ASC)

  email_threads:
    - ALTER first_message_at String(64) -> TIMESTAMPTZ
    - ALTER last_message_at String(64) -> TIMESTAMPTZ
    - RENAME last_message_at -> latest_message_at
    - ADD UNIQUE(tenant_id, integration_account_id, external_thread_id)
    - ADD composite INDEX(tenant_id, integration_account_id, latest_message_at DESC)

  trusted_senders:
    - CREATE TABLE for organization-level allowlist
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "8f12a4b3c7d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # email_messages: remove bloat columns
    # =========================================================================
    with op.batch_alter_table("email_messages") as batch_op:
        # Drop columns that violate the clean-inbox spec
        batch_op.drop_column("subject")
        batch_op.drop_column("body_html")
        batch_op.drop_column("raw_headers")

        # Add direction (inbound / outbound)
        batch_op.add_column(
            sa.Column(
                "direction",
                sa.String(16),
                nullable=False,
                server_default="inbound",
            )
        )
        # RFC threading headers (minimal, needed for reply chaining)
        batch_op.add_column(
            sa.Column("message_id_header", sa.String(998), nullable=True)
        )
        batch_op.add_column(
            sa.Column("references_header", sa.Text(), nullable=True)
        )
        # Filter reason for observability/debugging
        batch_op.add_column(
            sa.Column("filter_reason", sa.String(64), nullable=True)
        )

        # Migrate sent_at: String(64) -> TIMESTAMPTZ
        # Use USING clause: attempt ISO cast, fall back to NOW()
        batch_op.alter_column(
            "sent_at",
            existing_type=sa.String(64),
            type_=sa.DateTime(timezone=True),
            existing_nullable=True,
            postgresql_using="CASE WHEN sent_at IS NULL OR sent_at = '' THEN NULL ELSE sent_at::timestamptz END",
        )

        # Drop old individual sent_at index (if exists) — will recreate as composite
        try:
            batch_op.drop_index("ix_email_messages_sent_at")
        except Exception:
            pass

    # Unique constraint on (integration_account_id, external_message_id) for idempotency
    op.create_unique_constraint(
        "uq_email_messages_account_message_id",
        "email_messages",
        ["integration_account_id", "external_message_id"],
    )
    # Composite index for thread detail query
    op.create_index(
        "ix_email_messages_tenant_thread_sent",
        "email_messages",
        ["tenant_id", "thread_id", "sent_at"],
    )

    # =========================================================================
    # email_threads: fix types, add constraints and indexes
    # =========================================================================
    with op.batch_alter_table("email_threads") as batch_op:
        # Migrate first_message_at
        batch_op.alter_column(
            "first_message_at",
            existing_type=sa.String(64),
            type_=sa.DateTime(timezone=True),
            existing_nullable=True,
            postgresql_using="CASE WHEN first_message_at IS NULL OR first_message_at = '' THEN NULL ELSE first_message_at::timestamptz END",
        )
        # Migrate last_message_at -> latest_message_at
        batch_op.alter_column(
            "last_message_at",
            new_column_name="latest_message_at",
            existing_type=sa.String(64),
            type_=sa.DateTime(timezone=True),
            existing_nullable=True,
            postgresql_using="CASE WHEN last_message_at IS NULL OR last_message_at = '' THEN NULL ELSE last_message_at::timestamptz END",
        )

        # Drop old index on last_message_at (name may vary)
        try:
            batch_op.drop_index("ix_email_threads_last_message_at")
        except Exception:
            pass

    # Unique constraint for thread upsert race safety
    op.create_unique_constraint(
        "uq_email_threads_tenant_account_thread",
        "email_threads",
        ["tenant_id", "integration_account_id", "external_thread_id"],
    )
    # Composite index for inbox list query (keyset pagination)
    op.create_index(
        "ix_email_threads_tenant_account_latest",
        "email_threads",
        ["tenant_id", "integration_account_id", sa.text("latest_message_at DESC")],
    )
    # Index for latest_message_at alone (descending) for broad org queries
    op.create_index(
        "ix_email_threads_latest_message_at",
        "email_threads",
        ["latest_message_at"],
    )

    # =========================================================================
    # trusted_senders: organization-level allowlist
    # =========================================================================
    op.create_table(
        "trusted_senders",
        sa.Column(
            "id",
            sa.String(64),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column(
            "email",
            sa.String(320),
            nullable=True,
            comment="Trust specific email address (e.g. billing@stripe.com)",
        ),
        sa.Column(
            "domain",
            sa.String(253),
            nullable=True,
            comment="Trust all senders from this domain (e.g. customer-company.com)",
        ),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["organizations.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_trusted_senders_tenant_id", "trusted_senders", ["tenant_id"])
    op.create_unique_constraint(
        "uq_trusted_senders_tenant_email",
        "trusted_senders",
        ["tenant_id", "email"],
    )
    op.create_unique_constraint(
        "uq_trusted_senders_tenant_domain",
        "trusted_senders",
        ["tenant_id", "domain"],
    )


def downgrade() -> None:
    # Drop trusted_senders
    op.drop_table("trusted_senders")

    # Restore email_threads
    op.drop_index("ix_email_threads_latest_message_at", table_name="email_threads")
    op.drop_index("ix_email_threads_tenant_account_latest", table_name="email_threads")
    op.drop_constraint("uq_email_threads_tenant_account_thread", "email_threads", type_="unique")
    with op.batch_alter_table("email_threads") as batch_op:
        batch_op.alter_column(
            "latest_message_at",
            new_column_name="last_message_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.String(64),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "first_message_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.String(64),
            existing_nullable=True,
        )

    # Restore email_messages
    op.drop_index("ix_email_messages_tenant_thread_sent", table_name="email_messages")
    op.drop_constraint("uq_email_messages_account_message_id", "email_messages", type_="unique")
    with op.batch_alter_table("email_messages") as batch_op:
        batch_op.drop_column("filter_reason")
        batch_op.drop_column("references_header")
        batch_op.drop_column("message_id_header")
        batch_op.drop_column("direction")
        batch_op.alter_column(
            "sent_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.String(64),
            existing_nullable=True,
        )
        batch_op.add_column(sa.Column("raw_headers", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("body_html", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("subject", sa.String(998), nullable=True))
