# ADR-003: Vector Database — Qdrant with Mandatory Tenant Metadata Isolation

## Status

Accepted

## Context

ProxiPilot requires semantic retrieval for company knowledge bases (FAQs, documentation, policies). Retrievals must strictly guarantee that one tenant can never access or search another tenant's vectors.

## Decision

We adopted **Qdrant** as the dedicated vector database engine, accessed asynchronously via `qdrant-client`.
All vector upserts and queries MUST include and filter by `tenant_id`.

## Alternatives Considered

1. **pgvector (inside PostgreSQL)**: Convenient to host in Postgres, but degrades relational transactional throughput during heavy vector indexing and ANN graph traversals.
2. **Pinecone**: Fully managed, but proprietary and expensive for high multi-tenant namespace density.

## Consequences

- **Pros**: Outstanding HNSW indexing speed, payload filtering, async client support, low operational memory footprint.
- **Cons**: Requires keeping relational data in Postgres and vector embeddings in Qdrant; orchestrated via the retrieval query planner.
