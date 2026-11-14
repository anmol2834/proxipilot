# ADR-018: Multi-Tenant Data Isolation Across Persistence and Streaming

## Status
Accepted

## Context
ProxiPilot leverages a multi-store storage model (PostgreSQL for relational domain entities, Redis for caching and session state, Qdrant for vector retrieval, RabbitMQ/Redis Streams for async jobs, S3 for documents). Without architectural enforcement across all four layers, tenant data could leak.

## Decision
We enforce multi-tenant isolation uniformly across all storage and streaming engines:
1. **PostgreSQL**:
   - Every tenant entity has `organization_id` foreign key.
   - Repositories must include `organization_id == context.organization_id` in all read/write queries.
2. **Redis**:
   - All tenant keys follow `tenant:{organization_id}:{namespace}:{key}`.
   - Global keys are prohibited for business entities.
3. **Qdrant**:
   - All vector points require `organization_id` in payload.
   - Retrieval queries must inject a mandatory `FieldCondition(key="organization_id", match=MatchValue(value=context.organization_id))`.
   - Global retrieval with in-memory tenant filtering is strictly prohibited.
4. **Events & Queues**:
   - All messages carry `organization_id` in the canonical envelope header.

## Consequences
- Cross-tenant leakage is prevented at the infrastructure layer.
- Tests systematically verify that queries without tenant filters fail.
