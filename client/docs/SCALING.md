# ProxiPilot Horizontal Scaling Roadmap

---

## 1. Phased Scaling Strategy

```text
PHASE 1: Current Initial Setup
  - Single FastAPI service handling HTTP Gateway & Health
  - Shared Neon PostgreSQL + Upstash Redis Streams + Qdrant
  - Background workers co-located or single-instance
  - Up to 10,000 emails/day

PHASE 2: Independent Worker Scaling
  - Multiple stateless API instances behind Cloudflare Load Balancer
  - Dedicated AI worker instances scaled to GPU/CPU requirements
  - Dedicated Email Send worker instances scaled to outbound rate limits
  - Up to 250,000 emails/day

PHASE 3: High-Throughput Enterprise Scale
  - PostgreSQL read replicas for analytics and read-heavy dashboard queries
  - Redis cluster / multi-sharded streams
  - Dynamic autoscaling based on Redis Stream pending message depth
  - Up to 5,000,000 emails/day

PHASE 4: Global Multi-Region (Only when legally / latency justified)
  - Regional data residency routing
  - Kubernetes / dedicated inference endpoints
```

---

## 2. Autoscaling Triggers

Workers scale dynamically based on **Stream Queue Depth** rather than solely CPU:

- If `proxipilot:stream:ai_processing` pending count > 100 $\rightarrow$ scale up AI workers.
- If oldest message age > 30s $\rightarrow$ trigger alert & capacity surge.
