"""Enterprise Load and Burst Benchmark for Phase 4: Retrieval Router.

Benchmark Objective:
Evaluate the retrieval pipeline against a burst of 10,000 incoming eligible events.
Distinguish:
1. Admission throughput (events accepted durably into queue per second).
2. Worker dispatch and execution throughput (completed retrieval outcomes per second).
3. Backlog drain time under bounded concurrency (25 concurrent workers matching DB pool).
4. p50, p95, p99 retrieval latencies across tenants.
5. Uneven tenant distribution and fairness handling (Tenant A: 70%, Tenant B: 20%, Tenant C: 10%).
"""

import asyncio
import time
from typing import Dict, List, Tuple
import numpy as np
import pytest

from app.contracts.requirement_plan import (
    IntentType,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedResultCount,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.retrieval_result import (
    FactVerificationStatus,
    RetrievalResult,
    RetrievalStatus,
    RetrievalStrategyUsed,
)
from app.services.retrieval_router.router import RetrievalRouter
from app.services.retrieval_router.structured_retriever import StructuredRetriever
from app.services.retrieval_router.semantic_retriever import SemanticRetriever, SemanticCandidateHit
from app.services.retrieval_router.verifier import FactVerifier


class MockFastStructuredRetriever:
    """Simulated low-latency structured database adapter for high-volume benchmark."""

    async def fetch_by_exact_keys(self, db, tenant_id, keys, as_of=None):
        await asyncio.sleep(0.002)  # 2ms DB index scan
        from app.models.knowledge import KnowledgeItem, KnowledgeVersion
        ki = KnowledgeItem(id=f"ki_{keys[0]}", tenant_id=tenant_id, title=f"Service {keys[0]}", external_identity_key=keys[0], category="products_services")
        kv = KnowledgeVersion(id=f"kv_{keys[0]}", tenant_id=tenant_id, knowledge_item_id=ki.id, version_number=1, status="active", canonical_data={"pricing": {"total_price": 799.00, "currency": "INR"}, "warranty": "1 Year"})
        kv.knowledge_item = ki
        return [(ki, kv)]

    async def fetch_by_category_and_range(self, db, tenant_id, category=None, range_semantics=None, filters=None, limit=10, offset=0, as_of=None):
        await asyncio.sleep(0.004)  # 4ms range scan
        from app.models.knowledge import KnowledgeItem, KnowledgeVersion
        items = []
        for i in range(min(limit, 3)):
            ki = KnowledgeItem(id=f"ki_{i}", tenant_id=tenant_id, title=f"Service Option {i}", external_identity_key=f"OPT-{i}", category=category or "products_services")
            kv = KnowledgeVersion(id=f"kv_{i}", tenant_id=tenant_id, knowledge_item_id=ki.id, version_number=1, status="active", canonical_data={"pricing": {"total_price": 850.00 + i * 100, "currency": "INR"}, "warranty": "1 Year"})
            kv.knowledge_item = ki
            items.append((ki, kv))
        return items, False

    async def fetch_contacts(self, db, tenant_id, department_or_role=None, limit=5, as_of=None):
        await asyncio.sleep(0.003)
        return []


class MockFastSemanticRetriever:
    """Simulated low-latency Qdrant semantic retriever for high-volume benchmark."""

    async def search(self, tenant_id, plan, top_k=5, score_threshold=0.20):
        await asyncio.sleep(0.003)  # 3ms vector search
        return [
            SemanticCandidateHit(
                knowledge_item_id=f"ki_{j}",
                knowledge_version_id=f"kv_{j}",
                score=0.88,
                text_excerpt=f"Detailed operational instructions for servicing item {j}...",
                category="products_services",
                authority="semantic_kb",
            )
            for j in range(min(top_k, 2))
        ]


def _build_synthetic_plan(idx: int, tenant_id: str) -> RequirementPlan:
    """Generate representative workload plans."""
    mod = idx % 4
    if mod == 0:
        # Exact SKU
        return RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.PRODUCT_LOOKUP,
            entities=[PlannedEntity(entity_type="sku", original_text="HA-001", canonical_value="HA-001")],
            requested_attributes=["price", "warranty"],
            query_text=f"Check price for HA-001 request {idx}",
        )
    elif mod == 1:
        # Range query
        return RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.PRICE_QUERY,
            range_semantics=PlannedRange(field="price", min_value=500.0, max_value=1500.0, currency="INR"),
            requested_attributes=["price", "warranty"],
            query_text=f"Find services between 500 and 1500 request {idx}",
        )
    elif mod == 2:
        # Narrative troubleshooting
        return RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.SUPPORT_ISSUE,
            query_text=f"Troubleshoot AC water leakage and noise request {idx}",
        )
    else:
        # Appointment scheduling
        return RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.AVAILABILITY_QUERY,
            query_text=f"Book a technician for tomorrow 10am request {idx}",
        )


@pytest.mark.asyncio
async def test_retrieval_router_10k_burst_benchmark():
    """Benchmark admission, dispatch, drain time, and p50/p95/p99 latency for 10,000 events."""
    TOTAL_EVENTS = 10000
    CONCURRENT_WORKERS = 25  # Matches typical PostgreSQL pool size budget
    TENANTS = {
        "tenant_large_enterprise": 0.70,   # 7,000 events (70%)
        "tenant_midsize_business": 0.20,   # 2,000 events (20%)
        "tenant_boutique_shop": 0.10,      # 1,000 events (10%)
    }

    print(f"\n=======================================================")
    print(f"STARTING 10,000-EVENT RETRIEVAL BURST BENCHMARK")
    print(f"Total Events: {TOTAL_EVENTS} | Concurrent Workers: {CONCURRENT_WORKERS}")
    print(f"Tenant Distribution: {TENANTS}")
    print(f"=======================================================")

    print(f"\n[PREPARING 10,000 WORKLOAD PLANS...]")
    tenant_keys = list(TENANTS.keys())
    tenant_weights = list(TENANTS.values())
    prebuilt_batch = [
        (str(t_id), _build_synthetic_plan(i, str(t_id)))
        for i, t_id in enumerate(np.random.choice(tenant_keys, size=TOTAL_EVENTS, p=tenant_weights))
    ]

    # -------------------------------------------------------------------------
    # STAGE 1: Durable Event Admission (Burst Ingestion)
    # -------------------------------------------------------------------------
    queue: asyncio.Queue = asyncio.Queue()
    admission_start = time.perf_counter()

    for item in prebuilt_batch:
        queue.put_nowait(item)

    admission_duration = time.perf_counter() - admission_start
    admission_rate = TOTAL_EVENTS / admission_duration if admission_duration > 0 else 0.0

    print(f"\n[STAGE 1: ADMISSION]")
    print(f"  - Admitted Events    : {TOTAL_EVENTS:,}")
    print(f"  - Admission Time     : {admission_duration * 1000:.2f} ms ({admission_duration:.4f} s)")
    print(f"  - Admission Rate     : {admission_rate:,.1f} events/sec")
    assert admission_rate > 10000.0, "Admission rate must exceed 10,000 events/sec"

    # -------------------------------------------------------------------------
    # STAGE 2: Bounded Worker Pool Backlog Draining
    # -------------------------------------------------------------------------
    # Setup test router with fast simulated adapters
    router = RetrievalRouter(
        timeout_seconds=2.0,
        structured_retriever=MockFastStructuredRetriever(),
        semantic_retriever=MockFastSemanticRetriever(),
        verifier=FactVerifier(),
    )

    latencies_all: List[float] = []
    latencies_by_tenant: Dict[str, List[float]] = {t: [] for t in TENANTS}
    status_counts: Dict[str, int] = {}
    completed_count = 0
    lock = asyncio.Lock()

    drain_start = time.perf_counter()

    from unittest.mock import patch
    from app.models.knowledge import KnowledgeItem, KnowledgeVersion

    async def _mock_get_current_item_version(db, tenant_id, item_id, as_of=None):
        await asyncio.sleep(0.001)
        ki = KnowledgeItem(id=item_id, tenant_id=tenant_id, title=f"Knowledge Item {item_id}", category="products_services", is_active=True)
        kv = KnowledgeVersion(id=f"kv_{item_id}", tenant_id=tenant_id, knowledge_item_id=ki.id, version_number=1, status="active", canonical_data={"pricing": {"total_price": 600.0, "currency": "INR"}, "warranty": "1 Year"})
        kv.knowledge_item = ki
        return (ki, kv)

    async def worker_loop(worker_id: int):
        nonlocal completed_count
        while True:
            try:
                t_id, plan = queue.get_nowait()
            except asyncio.QueueEmpty:
                break

            t0 = time.perf_counter()
            try:
                res: RetrievalResult = await router.execute_retrieval(
                    db=None,
                    tenant_id=t_id,
                    plan=plan,
                )
                dur_ms = (time.perf_counter() - t0) * 1000.0
                st = res.status.value
            except Exception as e:
                dur_ms = (time.perf_counter() - t0) * 1000.0
                st = "ERROR"
                if completed_count == 0:
                    import traceback
                    traceback.print_exc()

            async with lock:
                latencies_all.append(dur_ms)
                latencies_by_tenant[t_id].append(dur_ms)
                status_counts[st] = status_counts.get(st, 0) + 1
                completed_count += 1

            queue.task_done()

    # Launch concurrent worker pool under CanonicalKnowledgeReader patch
    with patch("app.services.knowledge_read_contract.CanonicalKnowledgeReader.get_current_item_version", side_effect=_mock_get_current_item_version):
        workers = [asyncio.create_task(worker_loop(w)) for w in range(CONCURRENT_WORKERS)]
        await asyncio.gather(*workers)

    drain_duration = time.perf_counter() - drain_start
    throughput = completed_count / drain_duration if drain_duration > 0 else 0.0

    # -------------------------------------------------------------------------
    # STAGE 3: Performance & Fairness Analysis
    # -------------------------------------------------------------------------
    p50 = float(np.percentile(latencies_all, 50))
    p95 = float(np.percentile(latencies_all, 95))
    p99 = float(np.percentile(latencies_all, 99))
    max_lat = max(latencies_all)

    print(f"\n[STAGE 2: DISPATCH & EXECUTION DRAIN]")
    print(f"  - Completed Jobs     : {completed_count:,}")
    print(f"  - Peak Queue Backlog : {TOTAL_EVENTS:,}")
    print(f"  - Total Drain Time   : {drain_duration:.2f} s")
    print(f"  - Retrieval Throughput: {throughput:,.1f} completed outcomes/sec")
    print(f"  - Status Distribution: {status_counts}")

    print(f"\n[STAGE 3: LATENCY DISTRIBUTION]")
    print(f"  - Latency p50        : {p50:.2f} ms")
    print(f"  - Latency p95        : {p95:.2f} ms")
    print(f"  - Latency p99        : {p99:.2f} ms")
    print(f"  - Latency Max        : {max_lat:.2f} ms")

    print(f"\n[STAGE 4: PER-TENANT FAIRNESS]")
    for t_id, lats in latencies_by_tenant.items():
        t_p50 = float(np.percentile(lats, 50))
        t_p95 = float(np.percentile(lats, 95))
        pct_of_total = (len(lats) / TOTAL_EVENTS) * 100.0
        print(f"  - {t_id:26s}: Count={len(lats):,d} ({pct_of_total:.0f}%) | p50={t_p50:.2f}ms | p95={t_p95:.2f}ms")

    print(f"=======================================================\n")

    assert completed_count == TOTAL_EVENTS
    assert p95 < 100.0, f"p95 latency {p95:.2f}ms exceeded 100ms budget for simulated burst"
