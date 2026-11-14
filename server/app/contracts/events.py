"""Canonical Domain Event Specifications and Registry.

Enforces immutable event envelopes, versioning, and tenant context across message buses.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid
from pydantic import BaseModel, Field


class DomainEventEnvelope(BaseModel):
    """Universal immutable event envelope for ProxiPilot event streams."""

    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex}")
    event_type: str = Field(description="Dotted event name (e.g. email.received)")
    event_version: int = Field(default=1, description="Schema version of this event type")
    tenant_id: str = Field(description="Mandatory organization ID scoping this event")
    aggregate_type: str = Field(description="Domain aggregate (e.g. email, thread, knowledge)")
    aggregate_id: str = Field(description="Unique ID of the primary entity")
    occurred_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of occurrence",
    )
    producer: str = Field(default="proxipilot-backend", description="Originating service or worker")
    correlation_id: Optional[str] = Field(default=None, description="End-to-end request trace ID")
    causation_id: Optional[str] = Field(default=None, description="Preceding event ID that triggered this")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Typed event payload")


class EventNames:
    """Canonical event taxonomy registry."""

    # Organization
    ORG_CREATED = "organization.created"
    ORG_MEMBER_ADDED = "organization.member_added"

    # Integrations
    GMAIL_CONNECTED = "gmail.account.connected"
    GMAIL_DISCONNECTED = "gmail.account.disconnected"

    # Inbox / Email
    EMAIL_RECEIVED = "email.received"
    EMAIL_NORMALIZED = "email.normalized"
    THREAD_CREATED = "thread.created"
    THREAD_UPDATED = "thread.updated"

    # Knowledge
    KNOWLEDGE_CREATED = "knowledge.created"
    KNOWLEDGE_VERSION_PUBLISHED = "knowledge.version_published"
    KNOWLEDGE_ARCHIVED = "knowledge.archived"
    KNOWLEDGE_ROLLED_BACK = "knowledge.rolled_back"
    KNOWLEDGE_REPLACED = "knowledge.replaced"
    KNOWLEDGE_SEMANTIC_PROJECTION_READY = "knowledge.semantic_projection.ready"

    # AI & Synthesis
    AI_RUN_STARTED = "ai.run.started"
    AI_RUN_COMPLETED = "ai.run.completed"
    AI_RUN_FAILED = "ai.run.failed"
    RESPONSE_GENERATED = "response.generated"
    RESPONSE_VALIDATED = "response.validated"

    # Review & Outbound
    HUMAN_REVIEW_CREATED = "human_review.created"
    HUMAN_REVIEW_RESOLVED = "human_review.resolved"
    OUTBOUND_CREATED = "outbound_message.created"
    OUTBOUND_SENT = "outbound_message.sent"
    OUTBOUND_FAILED = "outbound_message.failed"
