# ProxiPilot Master Quick Reference & Setup Guide

> **IMPORTANT: Read this document before modifying the ProxiPilot platform (Frontend or Backend).**

---

## 1. System Overview

```text
ProxiPilot Platform
│
├── Frontend (/client)
│   ├── Stack               → Next.js 16 (App Router), React 19, TypeScript, MUI 9, Emotion, SCSS Modules
│   ├── Architecture        → Server-first, domain-driven features, centralized core libraries
│   ├── State Management    → 5-tier state: TanStack Query, Zustand, React Hook Form, URL params, useState
│   ├── Styling Rules       → MUI Theme + SCSS Modules, 8pt spacing grid, zero Tailwind CSS
│   └── Verification        → npm run lint && npm run typecheck && npm run build
│
└── Backend (/server)
    ├── Stack               → Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, asyncpg, Redis Streams, Qdrant
    ├── Architecture        → Modular Monolith with independently scalable background workers
    ├── Configuration       → Centralized typed Pydantic Settings with service-level scoping
    ├── Event Bus           → Redis Streams with consumer groups, ACK, DLQ, and at-least-once idempotency
    ├── Security            → Authoritative token-derived tenant resolution, bcrypt password hashing, RBAC matrix
    ├── Algorithms (DSA)    → PriorityQueue (heap), TokenBucket (rate limiting), LruTtlCache, BloomFilter
    └── Verification        → pytest tests/ -v && black --check app tests && flake8 app tests
```

---

## 2. Core Commands & Workflows

### Frontend (`client/`)

```bash
npm run dev           # Start Next.js dev server (http://localhost:3000)
npm run typecheck     # Validate TypeScript strictly
npm run lint          # Run ESLint validation
npm run format:check  # Check formatting with Prettier
npm run build         # Full production build
```

### Backend (`server/`)

```bash
# Run unit tests
python -m pytest tests/ -v

# Start FastAPI API Gateway
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Start background workers
python -m app.workers.cli --worker ai
python -m app.workers.cli --worker email
python -m app.workers.cli --worker automation

# Database migrations
alembic current
alembic upgrade head

# Run full stack with Docker Compose
docker compose up
```

---

## 3. Architecture Blueprint

### Key Invariants:

1. **Server Components Default on Frontend**: No `"use client"` unless interactive state/hooks are strictly required.
2. **Modular Monolith on Backend**: Keep business logic modular; scale independent worker entrypoints (`ai`, `email`, `automation`) as queue volume grows.
3. **Strict Tenant Isolation**: Every DB query must filter by `tenant_id`; all Redis keys use `tenant:{tenant_id}:{namespace}:{key}`; all Qdrant queries enforce tenant filters.
4. **Authoritative Authorization**: Never trust client-provided tenant IDs; resolve tenant exclusively from authenticated JWT tokens on the server.
5. **Short Transaction Boundaries**: Never hold a PostgreSQL transaction open while waiting for LLM or external HTTP APIs.

---

## 4. Documentation Index

- **Backend Developer Guide**: [`/docs/BACKEND-SETUP.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/BACKEND-SETUP.md)
- **Backend Architecture**: [`/docs/ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/ARCHITECTURE.md)
- **Security & Multi-Tenancy**: [`/docs/SECURITY.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/SECURITY.md)
- **Performance & Concurrency**: [`/docs/PERFORMANCE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/PERFORMANCE.md)
- **AI & Model Routing**: [`/docs/AI-ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/AI-ARCHITECTURE.md)
- **RAG & Knowledge Retrieval**: [`/docs/RAG-ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/RAG-ARCHITECTURE.md)
- **Event-Driven Messaging**: [`/docs/EVENT-ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/EVENT-ARCHITECTURE.md)
- **Database Architecture**: [`/docs/DATABASE-ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/DATABASE-ARCHITECTURE.md)
- **Observability**: [`/docs/OBSERVABILITY.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/OBSERVABILITY.md)
- **Scaling Roadmap**: [`/docs/SCALING.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/SCALING.md)
- **Cost Optimization**: [`/docs/COST-OPTIMIZATION.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/COST-OPTIMIZATION.md)
- **Algorithms & Complexity**: [`/docs/DSA-ALGORITHMS.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/DSA-ALGORITHMS.md)
- **Frontend Architecture**: [`/docs/FRONTEND-ARCHITECTURE.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/FRONTEND-ARCHITECTURE.md)
- **AI Agent Directives**: [`/docs/AI-DEVELOPMENT-RULES.md`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/AI-DEVELOPMENT-RULES.md)
- **Architecture Decision Records**: [`/docs/adr/`](file:///c:/Users/anmol/OneDrive/Desktop/proxipilot/docs/adr/)
