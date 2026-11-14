# Multi-Tenant Scoping Architecture: PostgreSQL, Redis, Qdrant & Events

## 1. Overview & Isolation Principle

ProxiPilot enforces a strict **Pooled Multi-Tenancy** architecture with logical isolation across all persistent and streaming layers. An unscoped query at any boundary is treated as a security violation.

---

## 2. PostgreSQL Scoping

Every organization-owned table must include an `organization_id` foreign key.

### Repository Query Enforcement
Unscoped queries (`SELECT * FROM table WHERE id = :id`) are forbidden. All queries must enforce tenant scoping:
```python
stmt = select(Resource).where(
    Resource.id == resource_id,
    Resource.organization_id == context.organization_id
)
```
The helper `enforce_tenant_query(query, model_class, organization_id)` in `app.core.tenant` verifies that queries explicitly filter on `organization_id`.

---

## 3. Redis Scoping

Redis keys must always follow the strict hierarchical namespace:
```
tenant:{organization_id}:{namespace}:{key}
```

### Examples:
- `tenant:0194abc:config:business_profile`
- `tenant:0194abc:ratelimit:api:192.168.1.1`
- `tenant:0194abc:session:active_users`

### Global Cache Keys:
Global cache keys (`system:...` or `auth:otp:...`) are permitted only for cross-tenant infrastructure (e.g. rate limiters by IP, email OTP verification tokens).

---

## 4. Qdrant Scoping

All vector points in Qdrant collections (e.g., `knowledge_points`, `email_embeddings`) must store `organization_id` in their payload:
```json
{
  "organization_id": "0194...",
  "document_id": "doc_123",
  "category": "pricing"
}
```

### Golden Retrieval Security Rule:
> **NEVER** retrieve vectors globally and filter by tenant in application memory.

Filtering must happen inside the vector engine filter boundary:
```python
tenant_filter = Filter(
    must=[
        FieldCondition(
            key="organization_id",
            match=MatchValue(value=context.organization_id)
        )
    ]
)
```
The utility `assert_qdrant_filter_has_tenant(filter_instance, tenant_id)` in `app.core.tenant` validates filter construction before any search request is executed.

---

## 5. Event Bus Scoping (Redis Streams / RabbitMQ)

Every event published to the system event bus must conform to the canonical event envelope:
```json
{
  "event_id": "0194...",
  "event_type": "business_profile.updated",
  "organization_id": "0194...",
  "occurred_at": "2026-09-17T05:30:00Z",
  "payload": { ... }
}
```
Consumers validate `organization_id` before deserializing or processing domain payloads. Events missing `organization_id` are rejected into the dead-letter queue.

---

## 6. Object Storage Isolation (S3 / MinIO)

All uploaded tenant artifacts (knowledge docs, email attachments, logos) are partitioned by tenant prefix:
```
s3://proxipilot-storage/organizations/{organization_id}/knowledge/{file_id}.pdf
```
Presigned URLs are generated only after verifying the requesting user's active membership in `organization_id`.
