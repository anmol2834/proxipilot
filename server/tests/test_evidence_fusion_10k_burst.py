"""Enterprise 10,000-Event Burst & High-Throughput Benchmark — Phase 5: Candidate Fusion.

Benchmark Objective:
Evaluate the candidate fusion and evidence verification layer under a burst of 10,000
incoming eligible events under bounded concurrency (25 concurrent workers matching DB pool).

Measures and Reports:
1. Admission throughput (events admitted into memory queue per second).
2. Worker dispatch and execution throughput (completed verified outcomes per second).
3. Backlog drain time under bounded concurrency (25 workers).
4. Fusion-stage latency distribution (p50, p95, p99, max) overall and per tenant.
5. Per-tenant fairness under asymmetric load (Tenant A: 70%, Tenant B: 20%, Tenant C: 10%).
6. Deduplication efficacy: candidates per requirement before and after deduplication.
7. Requirement coverage outcome breakdown.
"""

import asyncio
import time
from typing import Dict, List, Tuple
import numpy as np
import pytest

from app.contracts.evidence_fusion import (
    CandidateRole,
    EvidenceOverallStatus,
    VerifiedCandidate,
    VerifiedEvidenceResult,
)
from app.contracts.requirement_plan import (
    IntentType,
    PlannedComparison,
    PlannedEntity,
    PlannedRange,
    PlannedResultCount,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.retrieval_result import (
    EvidenceProvenance,
    FactVerificationStatus,
    VerifiedPricingEvidence,
)
from app.services.context_resolver import ContextEnvelope, ContextMessage
from app.services.evidence_fusion import evidence_fusion_service


def _build_synthetic_workload_item(idx: int, tenant_id: str) -> Tuple[RequirementPlan, Optional[ContextEnvelope], List[VerifiedCandidate]]:
    """Build representative workload: comparison, multi-intent, short replies, and range queries."""
    mod = idx % 4

    pricing_ha001 = VerifiedPricingEvidence(
        currency="INR", base_price=699.00, calculated_total=824.82, tax_percentage=18.0,
        commercial_price_type="fixed", qualifying_statement="Quote for AC Service"
    )
    pricing_ha004 = VerifiedPricingEvidence(
        currency="INR", base_price=899.00, calculated_total=1060.82, tax_percentage=18.0,
        commercial_price_type="fixed", qualifying_statement="Quote for Fridge Service"
    )

    prov_01 = EvidenceProvenance(
        source_system="postgresql", source_id="src_01", version_id="ver_01",
        authority_level="verified_canonical", authority_score=0.85, temporal_status="current",
        tenant_id=tenant_id,
    )
    prov_04 = EvidenceProvenance(
        source_system="postgresql", source_id="src_04", version_id="ver_04",
        authority_level="verified_canonical", authority_score=0.85, temporal_status="current",
        tenant_id=tenant_id,
    )

    c_ha001 = VerifiedCandidate(
        candidate_id=f"cand_ha001_{idx}", entity_id="ki_ac", tenant_id=tenant_id,
        external_identity_key="HA-001", title="AC General Service",
        candidate_role=CandidateRole.PRODUCT_SERVICE, category="products_services",
        pricing=pricing_ha001, warranty="1 Year Warranty", sla="24h",
        provenance=prov_01, verification_status=FactVerificationStatus.VERIFIED,
        relevance_score=0.92, composite_score=150.0, retrieval_path="hybrid",
    )
    c_ha004 = VerifiedCandidate(
        candidate_id=f"cand_ha004_{idx}", entity_id="ki_fridge", tenant_id=tenant_id,
        external_identity_key="HA-004", title="Refrigerator General Service",
        candidate_role=CandidateRole.PRODUCT_SERVICE, category="products_services",
        pricing=pricing_ha004, warranty="1 Year Warranty", sla="24h",
        provenance=prov_04, verification_status=FactVerificationStatus.VERIFIED,
        relevance_score=0.90, composite_score=145.0, retrieval_path="hybrid",
    )

    if mod == 0:
        # Comparison Query (HA-001 vs HA-004)
        plan = RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.SERVICE_COMPARISON,
            comparison=PlannedComparison(requested=True, target_entities=["HA-001", "HA-004"]),
            requested_attributes=["price", "warranty"],
            query_text="Compare HA-001 and HA-004",
        )
        return plan, None, [c_ha001, c_ha004]

    elif mod == 1:
        # Multi-Intent Inquiry: Comparison + Troubleshooting + Contact + Scheduling
        email_body = (
            "Compare AC General Service (HA-001) and Refrigerator General Service (HA-004).\n"
            "AC compressor makes rattling noise and cooling failure troubleshooting.\n"
            "Corporate billing contact for escalation.\n"
            "Can a technician visit this Saturday morning?"
        )
        envelope = ContextEnvelope(
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            provider_thread_id=f"p_{idx}",
            thread_id=f"thr_{idx}",
            current_message_id=f"msg_{idx}",
            context_revision=1,
            current_message=ContextMessage(
                id=f"msg_{idx}", external_message_id=f"ext_{idx}", direction="inbound",
                from_email="user@test.com", body_text=email_body,
            ),
        )
        plan = RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.SERVICE_COMPARISON,
            comparison=PlannedComparison(requested=True, target_entities=["HA-001", "HA-004"]),
            query_text=email_body,
        )

        c_trouble = VerifiedCandidate(
            candidate_id=f"cand_tr_{idx}", entity_id="ki_trouble", tenant_id=tenant_id,
            external_identity_key=None, title="Compressor Troubleshooting",
            candidate_role=CandidateRole.TROUBLESHOOTING_GUIDE, category="support_faqs",
            semantic_passages=["1. Power off. 2. Clear debris."], provenance=prov_01,
            verification_status=FactVerificationStatus.VERIFIED, composite_score=130.0,
        )
        c_contact = VerifiedCandidate(
            candidate_id=f"cand_ct_{idx}", entity_id="ki_contact", tenant_id=tenant_id,
            external_identity_key="BILLING", title="Billing Escalations",
            candidate_role=CandidateRole.CONTACT_CARD, category="company_info",
            attributes={"email": "billing@proxipilot.com", "phone": "1234567890"}, provenance=prov_01,
            verification_status=FactVerificationStatus.VERIFIED, composite_score=140.0,
        )

        return plan, envelope, [c_ha001, c_ha004, c_trouble, c_contact]

    elif mod == 2:
        # Contextual Short Reply ("yes" confirming previous proposal)
        envelope = ContextEnvelope(
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            provider_thread_id=f"p_{idx}",
            thread_id=f"thr_{idx}",
            current_message_id=f"msg_{idx}",
            context_revision=2,
            current_message=ContextMessage(
                id=f"msg_{idx}", external_message_id=f"e_{idx}", direction="inbound",
                from_email="user@test.com", body_text="yes",
            ),
            relevant_previous_messages=[
                ContextMessage(
                    id=f"prev_{idx}", external_message_id=f"ep_{idx}", direction="outbound",
                    from_email="agent@test.com", body_text="Shall I book your technician for Saturday at ₹799?"
                )
            ],
        )
        plan = RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=2,
            intent=IntentType.FOLLOW_UP,
            query_text="yes",
        )
        return plan, envelope, []

    else:
        # Exact Price Range Query
        plan = RequirementPlan(
            schema_version="1.0",
            tenant_id=tenant_id,
            integration_account_id=f"int_{tenant_id}",
            thread_id=f"thr_{idx}",
            message_id=f"msg_{idx}",
            context_revision=1,
            intent=IntentType.PRICE_QUERY,
            range_semantics=PlannedRange(field="price", min_value=500.0, max_value=1000.0, currency="INR"),
            query_text="Services between 500 and 1000 INR",
        )
        return plan, None, [c_ha001]


@pytest.mark.asyncio
async def test_evidence_fusion_10k_burst_benchmark():
    """Run full 10,000-event high-concurrency burst benchmark."""
    TOTAL_EVENTS = 10_000
    CONCURRENT_WORKERS = 25

    TENANTS = {
        "tenant_enterprise_corp": 0.70,   # 7,000 events (70%)
        "tenant_midmarket_co": 0.20,      # 2,000 events (20%)
        "tenant_boutique_shop": 0.10,     # 1,000 events (10%)
    }

    print("\n" + "=" * 80)
    print("STARTING 10,000-EVENT CANDIDATE FUSION & EVIDENCE VERIFICATION BURST BENCHMARK")
    print(f"Total Events: {TOTAL_EVENTS} | Concurrent Workers: {CONCURRENT_WORKERS}")
    print(f"Tenant Distribution: {TENANTS}")
    print("=" * 80)

    print("\n[PREPARING 10,000 WORKLOAD ITEMS...]")
    tenant_keys = list(TENANTS.keys())
    tenant_weights = list(TENANTS.values())
    chosen_tenants = np.random.choice(tenant_keys, size=TOTAL_EVENTS, p=tenant_weights)

    prebuilt_batch = [
        (str(t_id), _build_synthetic_workload_item(i, str(t_id)))
        for i, t_id in enumerate(chosen_tenants)
    ]

    # -------------------------------------------------------------------------
    # STAGE 1: Durable Event Admission
    # -------------------------------------------------------------------------
    queue: asyncio.Queue = asyncio.Queue()
    admission_start = time.perf_counter()

    for item in prebuilt_batch:
        queue.put_nowait(item)

    admission_duration = time.perf_counter() - admission_start
    admission_rate = TOTAL_EVENTS / admission_duration if admission_duration > 0 else 0.0

    print("\n[STAGE 1: ADMISSION THROUGHPUT]")
    print(f"  - Admitted Events    : {TOTAL_EVENTS:,}")
    print(f"  - Admission Time     : {admission_duration * 1000:.2f} ms ({admission_duration:.4f} s)")
    print(f"  - Admission Rate     : {admission_rate:,.1f} events/sec")
    assert admission_rate > 10000.0, "Admission rate must exceed 10,000 events/sec"

    # -------------------------------------------------------------------------
    # STAGE 2: Bounded Worker Pool Backlog Draining
    # -------------------------------------------------------------------------
    latencies_all: List[float] = []
    latencies_by_tenant: Dict[str, List[float]] = {t: [] for t in TENANTS}
    status_counts: Dict[str, int] = {}
    total_candidates_processed = 0
    total_duplicates_removed = 0
    completed_count = 0
    lock = asyncio.Lock()

    drain_start = time.perf_counter()

    async def worker_loop(worker_id: int):
        nonlocal completed_count, total_candidates_processed, total_duplicates_removed
        while True:
            try:
                t_id, (plan, env, cands) = queue.get_nowait()
            except asyncio.QueueEmpty:
                break

            t0 = time.perf_counter()
            try:
                res: VerifiedEvidenceResult = await evidence_fusion_service.fuse_and_verify(
                    tenant_id=t_id,
                    plan=plan,
                    envelope=env,
                    raw_candidates=cands,
                    dispatch_event=False,
                )
                dur_ms = (time.perf_counter() - t0) * 1000.0
                st = res.overall_status.value
                num_cands = sum(len(r.verified_candidates) for r in res.requirements)
                dups = res.duplicates_removed
            except Exception as e:
                dur_ms = (time.perf_counter() - t0) * 1000.0
                st = "ERROR"
                num_cands = 0
                dups = 0

            async with lock:
                latencies_all.append(dur_ms)
                latencies_by_tenant[t_id].append(dur_ms)
                status_counts[st] = status_counts.get(st, 0) + 1
                total_candidates_processed += num_cands
                total_duplicates_removed += dups
                completed_count += 1

            queue.task_done()

    workers = [asyncio.create_task(worker_loop(w)) for w in range(CONCURRENT_WORKERS)]
    await asyncio.gather(*workers)

    drain_duration = time.perf_counter() - drain_start
    throughput = TOTAL_EVENTS / drain_duration if drain_duration > 0 else 0.0

    # -------------------------------------------------------------------------
    # Latency Percentiles & Reporting
    # -------------------------------------------------------------------------
    p50 = float(np.percentile(latencies_all, 50))
    p95 = float(np.percentile(latencies_all, 95))
    p99 = float(np.percentile(latencies_all, 99))
    max_lat = float(np.max(latencies_all))

    print("\n[STAGE 2: BACKLOG DRAIN & FUSION EXECUTION]")
    print(f"  - Completed Fusion Jobs : {completed_count:,}")
    print(f"  - Backlog Drain Time    : {drain_duration:.2f} s")
    print(f"  - Verified Outcomes/Sec : {throughput:,.1f} outcomes/sec")
    print(f"  - Latency p50           : {p50:.2f} ms")
    print(f"  - Latency p95           : {p95:.2f} ms")
    print(f"  - Latency p99           : {p99:.2f} ms")
    print(f"  - Latency Max           : {max_lat:.2f} ms")

    print("\n[EVIDENCE DEDUPLICATION & METRICS]")
    print(f"  - Total Verified Candidates Retained : {total_candidates_processed:,}")
    print(f"  - Total Duplicate Records Filtered   : {total_duplicates_removed:,}")
    print(f"  - Outcome Status Breakdown           : {status_counts}")

    print("\n[STAGE 3: PER-TENANT FAIRNESS METRICS]")
    for t_id, t_lats in latencies_by_tenant.items():
        t_count = len(t_lats)
        t_pct = (t_count / TOTAL_EVENTS) * 100.0
        t_p50 = float(np.percentile(t_lats, 50))
        t_p95 = float(np.percentile(t_lats, 95))
        print(f"  - {t_id:24s} | Load: {t_count:5,d} ({t_pct:4.1f}%) | p50: {t_p50:5.2f} ms | p95: {t_p95:5.2f} ms")

    print("=" * 80 + "\n")

    # Assertions
    assert completed_count == TOTAL_EVENTS
    assert throughput > 500.0, f"Throughput {throughput:.1f} outcomes/sec fell below 500 target"
    assert p95 < 50.0, f"p95 latency {p95:.2f} ms exceeded 50ms bound"
    assert status_counts.get("ERROR", 0) == 0, "Zero runtime exceptions permitted under burst"
