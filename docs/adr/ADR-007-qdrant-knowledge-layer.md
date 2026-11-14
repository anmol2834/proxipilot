# ADR-007: Qdrant as Ephemeral Knowledge Retrieval Layer

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
Semantic retrieval is necessary for unstructured company documentation, policies, and support FAQs. However, storing authoritative business data (prices, customer records, invoices, accounts) inside a vector database leads to consistency drift and unconstrained querying.

## Decision
Qdrant is strictly designated as an ephemeral semantic retrieval engine. It indexes text chunks and embeddings generated from published PostgreSQL `knowledge_versions`.
Qdrant is **never** used to resolve transactional business facts, user permissions, or live mailbox state.

## Consequences
- **Positive**: High-performance approximate nearest neighbor (ANN) search without overloading relational database CPU.
- **Negative**: Requires synchronization workers to re-index vectors upon version publication.
