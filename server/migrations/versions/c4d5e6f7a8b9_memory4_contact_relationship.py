"""Memory 4: Contact & Relationship Memory.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-11-11 23:30:00.000000

Additive only:
  1. `contacts`       — one row per external party per tenant (unique tenant_id+email),
                        relationship classification and interaction statistics.
  2. `contact_facts`  — preferences / interests / needs / issues / notes with
                        provenance, confidence and supersession history.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("contact_type", sa.String(32), nullable=False, server_default="unknown"),
        sa.Column("type_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("preferred_language", sa.String(32), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("lead_temperature", sa.String(16), nullable=True),
        sa.Column("last_intent", sa.String(64), nullable=True),
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("inbound_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("outbound_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_interaction_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_interaction_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_inbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_outbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "email", name="uq_contacts_tenant_email"),
    )
    op.create_index("ix_contacts_tenant_id", "contacts", ["tenant_id"])
    op.create_index("ix_contacts_domain", "contacts", ["domain"])
    op.create_index("ix_contacts_created_at", "contacts", ["created_at"])
    op.create_index("ix_contacts_tenant_last_interaction", "contacts", ["tenant_id", "last_interaction_at"])
    op.create_index("ix_contacts_tenant_type", "contacts", ["tenant_id", "contact_type"])

    op.create_table(
        "contact_facts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column(
            "contact_id", sa.String(64),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("fact_type", sa.String(32), nullable=False),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("value_normalized", sa.String(512), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_ref", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("superseded_by_id", sa.String(64), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("occurrences", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_contact_facts_tenant_id", "contact_facts", ["tenant_id"])
    op.create_index("ix_contact_facts_created_at", "contact_facts", ["created_at"])
    op.create_index(
        "ix_contact_facts_tenant_contact_status", "contact_facts", ["tenant_id", "contact_id", "status"]
    )
    op.create_index("ix_contact_facts_lookup", "contact_facts", ["contact_id", "key", "value_normalized"])


def downgrade() -> None:
    op.drop_table("contact_facts")
    op.drop_table("contacts")
