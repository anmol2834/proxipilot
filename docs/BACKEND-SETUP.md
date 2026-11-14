# ProxiPilot Backend Setup & Developer Guide

> **Target Audience**: Backend Engineers, DevOps, AI Coding Agents  
> **Location**: `/server`  
> **Status**: Production-Ready Initial Infrastructure

---

## 1. Quick Start

### Prerequisites
- Python 3.11+ (Python 3.14 compatible)
- Neon PostgreSQL connection string (or local Postgres)
- Upstash Redis URL (or local Redis)
- Docker & Docker Compose (optional for containerized workflow)

### Local Setup in 3 Commands
```bash
cd server

# 1. Copy environment template and configure secrets
cp .env.example .env

# 2. Run automated test suite
python -m pytest tests/ -v

# 3. Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 2. Running Background Workers

The backend separates stateless HTTP API requests from asynchronous AI and email workloads. Workers are launched via the unified CLI runner:

```bash
# Run the AI & RAG Worker
python -m app.workers.cli --worker ai

# Run the Email Ingestion & Send Worker
python -m app.workers.cli --worker email

# Run the Automation & Workflow Worker
python -m app.workers.cli --worker automation
```

In Docker Compose:
```bash
docker compose up
```

---

## 3. Configuration Management

ProxiPilot enforces a **Centralized Typed Configuration Layer** (`app/core/config.py`).
- **Never call `os.getenv()` directly** in business logic.
- Config is scoped by process:
  - `ApiSettings`: API only consumes DB, Redis, Security, and Observability.
  - `AiWorkerSettings`: AI worker consumes DB, Redis, Qdrant, and OpenAI.
  - `EmailWorkerSettings`: Email worker consumes DB, Redis, and Email OAuth credentials.
  - `AutomationWorkerSettings`: Automation worker consumes DB and Redis.
- Production deployments inject secrets via environment variables from **AWS Secrets Manager**, **Azure Key Vault**, or **Vault** with zero code changes.

---

## 4. Database Migrations (Alembic)

Alembic is pre-configured with async support (`asyncpg`) and connects dynamically to `DATABASE_URL`:

```bash
# Check current migration revision
alembic current

# Create a new automatic schema migration
alembic revision --autogenerate -m "create_initial_tables"

# Apply pending migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1
```

---

## 5. Endpoints & Probes

| Route | Method | Purpose | Typical Response |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Liveness probe ($O(1)$ fast check for K8s/load balancers) | `{"status": "healthy", "alive": true}` |
| `/ready` | `GET` | Readiness probe (validates Neon DB, Upstash Redis, Qdrant) | `{"status": "ready", "dependencies": {...}}` |
| `/metrics` | `GET` | Prometheus telemetry metrics scrape | Prometheus plaintext text format |
