"""Centralized Audit Service — Enterprise Audit Event System.

Core Responsibilities:
- Centralized creation of immutable audit events
- Strict metadata sanitization preventing secrets (passwords, tokens, OTPs, keys) from persisting
- Transactional consistency within active database sessions
- Tenant-scoped audit history retrieval
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.models.audit import AuditAction, AuditActorType, AuditEvent

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "password_hash",
    "otp",
    "otp_hash",
    "token",
    "access_token",
    "refresh_token",
    "refresh_token_hash",
    "secret",
    "jwt_secret_key",
    "api_key",
    "authorization",
    "credentials",
    "cookie",
    "session_secret",
}


def sanitize_audit_metadata(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Recursively scrub any sensitive fields from metadata dictionary."""
    if not data or not isinstance(data, dict):
        return {}

    sanitized: Dict[str, Any] = {}
    for key, value in data.items():
        key_lower = str(key).lower()
        if any(sensitive in key_lower for sensitive in SENSITIVE_KEYS):
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_audit_metadata(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_audit_metadata(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value

    return sanitized


class AuditService:
    """Centralized service for emitting and querying audit events."""

    @staticmethod
    async def record(
        db: AsyncSession,
        action: AuditAction | str,
        resource_type: str,
        resource_id: str,
        organization_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_type: AuditActorType | str = AuditActorType.USER,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditEvent:
        """Record an immutable audit event within the active transaction.

        Invariants:
        - Never stores passwords, tokens, or raw secrets in metadata.
        - Written to db session so it commits atomically with the business mutation.
        """
        action_val = action.value if isinstance(action, AuditAction) else str(action)
        actor_type_val = (
            actor_type.value if isinstance(actor_type, AuditActorType) else str(actor_type)
        )

        clean_metadata = sanitize_audit_metadata(metadata)

        event = AuditEvent(
            id=f"aud_{uuid.uuid4().hex}",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=actor_type_val,
            action=action_val,
            resource_type=resource_type,
            resource_id=str(resource_id),
            metadata_=clean_metadata,
            created_at=datetime.now(timezone.utc),
        )

        db.add(event)

        logger.info(
            "Audit event recorded",
            audit_id=event.id,
            action=action_val,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            resource_type=resource_type,
            resource_id=resource_id,
        )

        return event

    @staticmethod
    async def get_organization_audit_events(
        db: AsyncSession,
        organization_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AuditEvent]:
        """Fetch audit events strictly scoped to an organization."""
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.organization_id == organization_id)
            .order_by(desc(AuditEvent.created_at))
            .limit(limit)
            .offset(offset)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


audit_service = AuditService()
