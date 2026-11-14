# ADR-004: Background Processing — Modular Monolith with Independently Scalable Workers

## Status
Accepted

## Context
Background tasks (AI reasoning, RAG vector searches, email provider sending, automated workflow execution) have vastly different resource requirements than stateless HTTP API requests.

## Decision
We adopted a **Modular Monolith** pattern with **Independently Scalable Worker Processes**.
The codebase shares domain definitions, configurations, and models under `app/`, but exposes distinct entrypoints:
- `app.main:app`: Stateless FastAPI HTTP Gateway.
- `app.workers.cli`: Background worker runner (`--worker ai`, `--worker email`, `--worker automation`).

## Alternatives Considered
1. **10+ Microservices with independent repositories**: High operational overhead, deployment complexity, network latency hops, and duplicated models.
2. **Synchronous in-API processing**: Blocks API response threads and crashes webhooks under load.

## Consequences
- **Pros**: Simple developer experience (one repo, shared types); workers can scale from a single thread on local dev up to dedicated container clusters in production based on queue depth.
- **Cons**: Requires discipline to maintain domain boundaries and prevent circular imports within the shared codebase.
