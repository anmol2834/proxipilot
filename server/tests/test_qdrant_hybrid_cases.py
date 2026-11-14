"""Multi-Case Automated Test Suite for Active Qdrant Hybrid Retrieval.

Covers:
Case 1: Exact SKU lookup with Qdrant enrichment
Case 2: Hard numerical constraint filtering (Price <= 1500 INR)
Case 3: Broad semantic discovery (Vector similarity search via Qdrant)
Case 4: Conversational continuation with exclusion of 10 prior items (0% duplicates)
Case 5: Strict cross-tenant isolation in Qdrant (0 leaked points)
"""

import pytest
import time
from sqlalchemy import text

from app.core.database import db_manager
from app.core.qdrant import qdrant_manager
from app.services.retrieval_router import retrieval_router_service
from app.services.retrieval_router.semantic_retriever import semantic_retriever
from app.contracts.requirement_plan import (
    RequirementPlan, IntentType, ValidationStatus, PlanMetadata,
    PlannedEntity, PlannedRange, PlannedResultCount, FilterOperator
)

ACCOUNT_ID = "int_469e5d57dadd49f0a84d209b057d4361"


@pytest.mark.asyncio
async def test_qdrant_hybrid_all_five_cases(seeded_tenant):
    """Verify all 5 retrieval workflows with active Qdrant."""
    qdrant_manager.initialize()
    db_manager.initialize()

    # DB pool warm-up
    async with db_manager.session_factory() as s:
        await s.execute(text("SELECT 1"))

    # Case 1: Exact SKU Lookup
    plan1 = RequirementPlan(
        schema_version="1.0",
        plan_id="plan_c1",
        tenant_id=seeded_tenant,
        integration_account_id=ACCOUNT_ID,
        thread_id="thr_c1",
        message_id="msg_c1",
        context_revision=1,
        intent=IntentType.PRODUCT_DISCOVERY,
        validation_status=ValidationStatus.READY_FOR_RETRIEVAL,
        entities=[
            PlannedEntity(entity_type="sku", original_text="HA-001", canonical_value="HA-001"),
            PlannedEntity(entity_type="sku", original_text="HA-020", canonical_value="HA-020"),
        ],
        requested_result_count=PlannedResultCount(final_count=2),
        metadata=PlanMetadata(embedding_profile_id="emb_voyage_4_large_1024_v1")
    )
    res1 = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan1, dispatch_event=False)
    assert res1.status.value == "SUCCESS"
    assert len(res1.results) == 2
    assert {r.external_identity_key for r in res1.results} == {"HA-001", "HA-020"}

    # Case 2: Hard Constraint Filter (Price <= 1500 INR)
    plan2 = RequirementPlan(
        schema_version="1.0",
        plan_id="plan_c2",
        tenant_id=seeded_tenant,
        integration_account_id=ACCOUNT_ID,
        thread_id="thr_c2",
        message_id="msg_c2",
        context_revision=1,
        intent=IntentType.PRODUCT_DISCOVERY,
        validation_status=ValidationStatus.READY_FOR_RETRIEVAL,
        range_semantics=PlannedRange(field="price", operator=FilterOperator.LTE, max_value=1500.0, currency_or_unit="INR"),
        requested_result_count=PlannedResultCount(final_count=5),
        metadata=PlanMetadata(embedding_profile_id="emb_voyage_4_large_1024_v1")
    )
    res2 = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan2, dispatch_event=False)
    assert res2.status.value == "SUCCESS"
    assert len(res2.results) > 0
    for r in res2.results:
        assert r.pricing and r.pricing.calculated_total <= 1500.0

    # Case 3: Broad Semantic Discovery (Qdrant Vector Search)
    plan3 = RequirementPlan(
        schema_version="1.0",
        plan_id="plan_c3",
        tenant_id=seeded_tenant,
        integration_account_id=ACCOUNT_ID,
        thread_id="thr_c3",
        message_id="msg_c3",
        context_revision=1,
        intent=IntentType.PRODUCT_DISCOVERY,
        validation_status=ValidationStatus.READY_FOR_RETRIEVAL,
        query_text="cooling repair and air conditioner servicing",
        requested_result_count=PlannedResultCount(final_count=5),
        metadata=PlanMetadata(embedding_profile_id="emb_voyage_4_large_1024_v1")
    )
    res3 = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan3, dispatch_event=False)
    assert res3.status.value == "SUCCESS"
    assert len(res3.results) > 0

    # Case 4: Conversational Continuation (Exclusion of 10 prior items)
    first_10 = ["HA-001", "HA-020", "HA-009", "HA-018", "HA-023", "HA-010", "HA-022", "HA-019", "HA-007", "HA-004"]
    plan4 = RequirementPlan(
        schema_version="1.0",
        plan_id="plan_c4",
        tenant_id=seeded_tenant,
        integration_account_id=ACCOUNT_ID,
        thread_id="thr_c4",
        message_id="msg_c4",
        context_revision=2,
        intent=IntentType.MORE_OPTIONS,
        is_continuation=True,
        continuation_type="more_options",
        excluded_entity_ids=first_10,
        validation_status=ValidationStatus.READY_FOR_RETRIEVAL,
        query_text="more home service options",
        requested_result_count=PlannedResultCount(final_count=5),
        metadata=PlanMetadata(embedding_profile_id="emb_voyage_4_large_1024_v1")
    )
    res4 = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan4, dispatch_event=False)
    assert res4.status.value == "SUCCESS"
    ret_keys = [r.external_identity_key for r in res4.results]
    duplicates = set(ret_keys).intersection(set(first_10))
    assert len(duplicates) == 0, f"Duplicate leakage detected: {duplicates}"
    assert len(res4.results) == 5

    # Case 5: Strict Cross-Tenant Isolation in Qdrant
    other_tenant = "org_99999999999999999999999999999999"
    plan5 = RequirementPlan(
        schema_version="1.0",
        plan_id="plan_c5",
        tenant_id=other_tenant,
        integration_account_id="int_other",
        thread_id="thr_c5",
        message_id="msg_c5",
        context_revision=1,
        intent=IntentType.PRODUCT_DISCOVERY,
        validation_status=ValidationStatus.READY_FOR_RETRIEVAL,
        query_text="AC repair and service",
        metadata=PlanMetadata(embedding_profile_id="emb_voyage_4_large_1024_v1")
    )
    other_hits = await semantic_retriever.search(tenant_id=other_tenant, plan=plan5, top_k=5)
    assert len(other_hits) == 0, "Security violation: Cross-tenant points leaked from Qdrant!"
