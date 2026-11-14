# ProxiPilot Observability Architecture

---

## 1. Structured Logging (JSON)

ProxiPilot uses `structlog` (`app/core/logging.py`) with automatic context binding:
```json
{
  "timestamp": "2026-09-16T18:46:58.123Z",
  "level": "info",
  "event": "HTTP Request",
  "method": "GET",
  "path": "/ready",
  "status_code": 200,
  "duration_ms": 14.5,
  "request_id": "req_8b9f104d2e"
}
```

### Automatic Redaction
Keys containing `password`, `secret`, `token`, `authorization`, `api_key` are replaced with `[REDACTED]` prior to emission.

---

## 2. Distributed Tracing & Correlation IDs

Every inbound HTTP request and message stream event carries:
- `request_id`: Client or gateway correlation ID.
- `tenant_id`: Multi-tenant boundary context.
- Propagated through Redis stream payloads so worker jobs can trace back to origin webhooks.

---

## 3. Metrics & Prometheus

Exposed at `GET /metrics`:
- API request duration histograms (`P50`, `P95`, `P99`).
- Queue depth and pending entries in Redis Streams.
- Active database connection counts.
- Worker task processing rates and failure rates.
