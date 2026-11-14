# ADR-002: Relational Database & ORM — PostgreSQL + SQLAlchemy 2.0 Async

## Status

Accepted

## Context

ProxiPilot requires an ACID-compliant transactional database for core business entities: tenants, users, mailboxes, email threads, message metadata, automations, and audit logs. The system must support async non-blocking I/O.

## Decision

We adopted **PostgreSQL** (hosted via Neon Serverless Postgres) with **SQLAlchemy 2.0** and **asyncpg**.

## Alternatives Considered

1. **MongoDB / Document Store**: Flexible for raw email JSON, but lacks strict relational constraints, transactional foreign keys, and reliable ACID guarantees for billing and multi-tenant access.
2. **Synchronous psycopg2**: Blocks FastAPI's event loop, destroying concurrent throughput under load.

## Consequences

- **Pros**: Strong data consistency, typed schema models via SQLAlchemy 2.0, non-blocking `asyncpg` queries, keyset pagination support.
- **Cons**: Serverless connection limits on Neon require strict connection pooling (`pool_size=10`, `pool_pre_ping=True`, `pool_recycle=300s`).
