# ADR-011: Modular Monolith vs. Premature Microservices

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
Deploying 10+ independent microservices in early development introduces operational complexity (network latency, distributed transaction orchestration, complex deployment topologies) without immediate scaling justification.

## Decision
For V1, ProxiPilot will be built as a **Modular Monolith** with strict logical domain boundaries, clean module interfaces, and dedicated table ownership.
Background workers (email ingestion, AI workers, Qdrant indexers) run as dedicated worker processes consuming from Redis Streams, sharing domain contracts. Independent microservices will be extracted only when specific components hit scaling, compliance, or fault-isolation thresholds.

## Consequences
- **Positive**: Rapid feature velocity, shared transactions within domain boundaries, simplified local development and CI/CD pipelines.
- **Negative**: Requires strict discipline to prevent cross-module direct table joins.
