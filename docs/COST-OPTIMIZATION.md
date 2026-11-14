# ProxiPilot Cost Optimization & Unit Economics

> **Core Axiom**: Scale only what needs scaling. Maximize useful throughput per dollar of compute.

---

## 1. Top Cost Drivers & Mitigations

| Cost Driver | Risk | Mitigation Architecture |
| :--- | :--- | :--- |
| **LLM Token Ingestion** | Full email threads submitted on every turn | Compact thread summarization + context pruning (saves up to 65% tokens) |
| **LLM Inference** | Premium models used for simple emails | Fast-path classifier + dynamic routing to `gpt-4o-mini` for 80% of queries |
| **Vector DB Queries** | Unfiltered global Qdrant searches | Strict tenant metadata filters + cached search plans |
| **Database Connections** | Worker connection pool explosion on Neon | Shared pool manager + `pool_size=10` + connection multiplexing |
| **Message Broker** | High Kafka / RabbitMQ cluster operational cost | Low-cost serverless Redis Streams on existing Upstash cluster |

---

## 2. Fast-Path Economics

Processing 100,000 emails/month:
- Unoptimized (All gpt-4o): 100k × \$0.03 = \$3,000/mo.
- Optimized (40% Fast-path canned + 50% gpt-4o-mini + 10% gpt-4o):
  - 40k @ \$0.00 = \$0
  - 50k @ \$0.0015 = \$75
  - 10k @ \$0.02 = \$200
  - **Total**: \$275/mo (Over 90% reduction).
