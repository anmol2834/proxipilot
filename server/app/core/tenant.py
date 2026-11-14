"""Multi-Tenant Scoping Utilities across PostgreSQL, Redis, Qdrant, and Event Streams.

Core Principles:
1. Every query accessing organization-owned entities must filter by organization_id.
2. Every Redis cache/lock key must be namespaced: tenant:{org_id}:{namespace}:{key}.
3. Every vector search in Qdrant must require tenant_id filtering. Global un-filtered searches are forbidden.
4. Every domain event must include tenant_id.
"""

from typing import Any, Dict, Optional
from qdrant_client.http import models as qmodels
from sqlalchemy import Select
from app.contracts.events import DomainEventEnvelope
from app.core.redis import RedisManager


class TenantScopingError(ValueError):
    """Raised when an operation attempts to bypass multi-tenant isolation."""
    pass


def enforce_tenant_query(query: Select, model: Any, organization_id: str) -> Select:
    """Ensure a SQLAlchemy select statement is strictly scoped to the tenant organization.

    Prevents accidental unscoped queries in repository and service layers.
    """
    if not organization_id or not organization_id.strip():
        raise TenantScopingError("organization_id is required to scope query")

    # Match organization_id column on model
    if hasattr(model, "organization_id"):
        return query.where(model.organization_id == organization_id)
    elif hasattr(model, "tenant_id"):
        return query.where(model.tenant_id == organization_id)
    else:
        raise TenantScopingError(f"Model {model.__name__} has neither organization_id nor tenant_id column")


def build_tenant_cache_key(organization_id: str, namespace: str, key: str) -> str:
    """Build a tenant-isolated Redis cache or lock key."""
    return RedisManager.build_tenant_key(organization_id, namespace, key)


def build_qdrant_tenant_filter(organization_id: str) -> qmodels.Filter:
    """Construct mandatory Qdrant vector search filter.

    CRITICAL SECURITY INVARIANT: Unrestricted vector searches are strictly prohibited.
    """
    if not organization_id or not organization_id.strip():
        raise TenantScopingError("organization_id is required for vector retrieval filter")

    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="tenant_id",
                match=qmodels.MatchValue(value=organization_id),
            )
        ]
    )


def assert_qdrant_filter_has_tenant(filter_obj: Optional[qmodels.Filter], organization_id: str) -> None:
    """Audit and verify that a Qdrant search filter contains the active organization filter."""
    if not filter_obj or not filter_obj.must:
        raise TenantScopingError("Qdrant query rejected: missing mandatory tenant isolation filter")

    has_tenant_condition = False
    for cond in filter_obj.must:
        if isinstance(cond, qmodels.FieldCondition) and cond.key == "tenant_id":
            if hasattr(cond.match, "value") and cond.match.value == organization_id:
                has_tenant_condition = True
                break

    if not has_tenant_condition:
        raise TenantScopingError(f"Qdrant query rejected: tenant filter does not match active organization {organization_id}")


def build_tenant_event_envelope(
    event_type: str,
    organization_id: str,
    aggregate_type: str,
    aggregate_id: str,
    payload: Dict[str, Any],
    correlation_id: Optional[str] = None,
) -> DomainEventEnvelope:
    """Construct a tenant-scoped domain event envelope."""
    if not organization_id or not organization_id.strip():
        raise TenantScopingError("organization_id is mandatory for all domain events")

    return DomainEventEnvelope(
        event_type=event_type,
        tenant_id=organization_id,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        correlation_id=correlation_id,
        payload=payload,
    )
