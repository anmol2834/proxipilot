# ProxiPilot Relational Database Architecture

---

## 1. Core Technology & Driver

- **Engine**: PostgreSQL 16+ (Neon Serverless PostgreSQL).
- **ORM**: SQLAlchemy 2.0 with modern type-annotated declarations (`Mapped[...]`, `mapped_column(...)`).
- **Async Driver**: `asyncpg` with connection pooling and SSL encryption (`sslmode=require`).
- **Migrations**: Alembic with asynchronous runner (`migrations/env.py`).

---

## 2. Table Indexing & Query Patterns

Indexes must reflect actual access patterns to avoid write degradation:
- `(tenant_id, created_at)`: Primary composite index on timeline feeds.
- `(mailbox_id, provider_message_id)`: Unique constraint ensuring email idempotency.
- `(tenant_id, status)`: Fast-path filtering for active/pending threads.

---

## 3. Keyset / Cursor Pagination

**Anti-Pattern**:
```sql
SELECT * FROM email_messages WHERE tenant_id = 't1' ORDER BY created_at DESC OFFSET 500000 LIMIT 50;
```
High-offset pagination scans and discards 500,000 rows, consuming CPU and memory.

**Enforced Pattern**:
```sql
SELECT * FROM email_messages 
WHERE tenant_id = 't1' AND (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC 
LIMIT 50;
```
Executes via indexed index-range scan in $O(\log n)$ time regardless of depth.

---

## 4. Partitioning Roadmap

High-volume event tables (`email_messages`, `email_events`, `audit_logs`) will be partitioned by range (`created_at` monthly) when data volume exceeds 10 million rows per month.
