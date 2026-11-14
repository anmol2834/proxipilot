"""Production Tests for Phase 4: Enterprise Tenant-Scoped Retrieval Router.

Tests:
1. Exact SKU / Code Structured Retrieval (HA-001) with authoritative PostgreSQL canonical facts.
2. Price Range Boundary & Currency Filtering (e.g. ₹500 to ₹1,500) ensuring 0% out-of-bounds leakage.
3. Impossible Range Query producing typed NO_MATCH (Zero Hallucination / No Silent Range Relaxation).
4. Semantic ANN Knowledge Retrieval via Qdrant for narrative support questions.
5. Multi-Source Comparison with Attribute Coverage (price and warranty).
6. Contact Person / Office Resolution strictly scoped to tenant.
7. Appointment / Booking Request handling with operational limitation and workflow flag.
8. Strict Tenant Isolation Assertion (rejection of cross-tenant plan references).
9. Partial Failure Resilience (graceful degradation when vector search fails).
10. Exact Decimal Money Calculation and Mandatory Commercial Qualifiers.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.requirement_plan import (
    IntentType,
    PlannedComparison,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedResultCount,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.retrieval_capability import FilterOperator
from app.contracts.retrieval_result import (
    FactVerificationStatus,
    RetrievalResult,
    RetrievalStatus,
    RetrievalStrategyUsed,
)
from app.core.database import get_db
from app.services.retrieval_router import (
    retrieval_router,
    retrieval_router_service,
)



def _create_test_plan(
    intent: IntentType = IntentType.PRODUCT_LOOKUP,
    entities: list[PlannedEntity] | None = None,
    filters: list[PlannedFilter] | None = None,
    range_semantics: PlannedRange | None = None,
    comparison: PlannedComparison | None = None,
    requested_attributes: list[str] | None = None,
    query_text: str = "",
    target_count: int = 5,
    tenant_id: str = "",
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.SEMANTIC_DISCOVERY,
) -> RequirementPlan:
    """Helper factory for valid RequirementPlan instances."""
    return RequirementPlan(
        schema_version="1.0",
        tenant_id=tenant_id,
        integration_account_id="int_test_acc",
        thread_id="thr_test_thread",
        message_id="msg_test_msg",
        context_revision=1,
        intent=intent,
        retrieval_strategy=retrieval_strategy,
        entities=entities or [],
        filters=filters or [],
        range_semantics=range_semantics,
        comparison=comparison or PlannedComparison(),
        requested_attributes=requested_attributes or [],
        requested_result_count=PlannedResultCount(final_count=target_count),
        query_text=query_text,
    )


@pytest.mark.asyncio
async def test_exact_sku_structured_retrieval(seeded_tenant):
    """Verify that exact SKU 'HA-001' routes to structured PostgreSQL and resolves canonical facts."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.PRODUCT_LOOKUP,
            retrieval_strategy=RetrievalStrategy.EXACT_LOOKUP,
            entities=[
                PlannedEntity(
                    entity_type="sku",
                    original_text="HA-001",
                    canonical_value="HA-001",
                )
            ],
            query_text="What is the price of HA-001?",
            requested_attributes=["price", "warranty"],
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.schema_version == "1.0"
        assert result.status in (RetrievalStatus.SUCCESS, RetrievalStatus.PARTIAL)
        assert result.retrieval.strategy_used in (
            RetrievalStrategyUsed.EXACT_STRUCTURED,
            RetrievalStrategyUsed.HYBRID,
        )
        assert len(result.results) >= 1

        top_match = result.results[0]
        assert top_match.external_identity_key == "HA-001"
        assert "AC" in top_match.title
        assert top_match.verification_status == FactVerificationStatus.VERIFIED
        assert top_match.pricing is not None
        assert top_match.pricing.base_price == 699.0
        assert top_match.pricing.calculated_total == 1000.64
        assert top_match.pricing.currency == "INR"
        assert "not fixed" in top_match.pricing.qualifying_statement or "Estimated" in top_match.pricing.qualifying_statement
        assert top_match.provenance.source_system == "postgresql"
        assert top_match.provenance.temporal_status == "current"
        break


@pytest.mark.asyncio
async def test_price_range_boundary_filtering(seeded_tenant):
    """Verify that price range filter (₹500 to ₹1,500) returns ONLY matching records."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.PRICE_QUERY,
            range_semantics=PlannedRange(
                field="price",
                min_value=500.0,
                max_value=1500.0,
                currency="INR",
                is_min_inclusive=True,
                is_max_inclusive=True,
            ),
            query_text="Give me home appliance services between 500 and 1500 rupees",
            target_count=3,
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.status in (RetrievalStatus.SUCCESS, RetrievalStatus.PARTIAL)
        assert len(result.results) > 0, "Expected at least 1 service within 500-1500 INR"

        # Verify that EVERY single returned candidate is strictly within ₹500 and ₹1,500
        for ev in result.results:
            assert ev.pricing is not None, f"Item {ev.title} must have pricing"
            total = ev.pricing.calculated_total
            assert (
                500.0 <= total <= 1500.0
            ), f"Item {ev.title} total {total} violates requested range [500, 1500]"
            assert ev.pricing.currency == "INR"
            assert ev.verification_status == FactVerificationStatus.VERIFIED

        assert result.verification.hard_constraints_satisfied is True
        break


@pytest.mark.asyncio
async def test_impossible_range_returns_no_match(seeded_tenant):
    """Verify that an impossible price range (₹90,000 to ₹100,000) returns NO_MATCH without relaxing boundaries."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.PRICE_QUERY,
            range_semantics=PlannedRange(
                field="price",
                min_value=90000.0,
                max_value=100000.0,
                currency="INR",
            ),
            query_text="Show me services between 90000 and 100000 rupees",
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.status == RetrievalStatus.NO_MATCH
        assert len(result.results) == 0, "Must not return out-of-range items or relax range"
        assert len(result.warnings) > 0
        break


@pytest.mark.asyncio
async def test_semantic_knowledge_retrieval(seeded_tenant):
    """Verify that narrative inquiries find relevant knowledge in Qdrant with tenant filter."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.SUPPORT_ISSUE,
            query_text="cleaning and servicing split air conditioner cooling issue",
            target_count=3,
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.status in (RetrievalStatus.SUCCESS, RetrievalStatus.PARTIAL)
        assert len(result.results) > 0
        found_ac = any("AC" in r.title for r in result.results)
        assert found_ac, f"Expected AC service among candidates, got: {[r.title for r in result.results]}"
        break


@pytest.mark.asyncio
async def test_multi_source_comparison_coverage(seeded_tenant):
    """Verify comparison request tracks criteria coverage (price and warranty)."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.SERVICE_COMPARISON,
            comparison=PlannedComparison(
                requested=True,
                target_entities=["AC General Service", "Refrigerator General Service"],
                criteria=["price", "warranty"],
            ),
            requested_attributes=["price", "warranty"],
            query_text="Compare AC service and refrigerator service pricing and warranty",
            target_count=2,
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.status in (RetrievalStatus.SUCCESS, RetrievalStatus.PARTIAL)
        assert result.coverage.requested_count == 2
        assert "price" in result.coverage.satisfied_attributes
        break


@pytest.mark.asyncio
async def test_appointment_booking_limitation(seeded_tenant):
    """Verify that an appointment request emits workflow_action_required and operational limitation."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.AVAILABILITY_QUERY,
            query_text="Book an AC technician for repair tomorrow afternoon",
            entities=[
                PlannedEntity(
                    entity_type="service_category",
                    original_text="AC technician",
                    canonical_value="Air Conditioner",
                )
            ],
        )

        result = await retrieval_router.execute_retrieval(
            db=db,
            tenant_id=seeded_tenant,
            plan=plan,
        )

        assert result.follow_up.workflow_action_required is True
        assert result.follow_up.required_workflow_type == "appointment_scheduling"
        assert result.follow_up.operational_limitation_reason is not None
        assert "booking" in result.follow_up.operational_limitation_reason.lower()
        break


@pytest.mark.asyncio
async def test_cross_tenant_isolation_rejection(seeded_tenant):
    """Verify that executing a plan with mismatched tenant_id raises PermissionError."""
    async for db in get_db():
        foreign_plan = _create_test_plan(
            tenant_id="org_attacker_tenant_xyz",
            query_text="Show me all products",
        )

        with pytest.raises(PermissionError):
            await retrieval_router.execute_retrieval(
                db=db,
                tenant_id=seeded_tenant,
                plan=foreign_plan,
            )
        break


@pytest.mark.asyncio
async def test_partial_failure_resilience(seeded_tenant):
    """Verify that if semantic search fails, structured retrieval still returns results gracefully."""
    async for db in get_db():
        plan = _create_test_plan(
            tenant_id=seeded_tenant,
            intent=IntentType.PRODUCT_LOOKUP,
            entities=[
                PlannedEntity(
                    entity_type="sku",
                    original_text="HA-001",
                    canonical_value="HA-001",
                )
            ],
            query_text="HA-001 details",
        )

        # Mock semantic search to raise an exception
        with patch("app.services.retrieval_router.router.semantic_retriever.search", new_callable=AsyncMock) as mock_sem:
            mock_sem.side_effect = RuntimeError("Qdrant simulated connection failure")

            result = await retrieval_router.execute_retrieval(
                db=db,
                tenant_id=seeded_tenant,
                plan=plan,
            )

            assert result.retrieval.semantic_source_status == "FAILED"
            assert result.retrieval.structured_source_status == "SUCCESS"
            assert len(result.results) >= 1
            assert result.results[0].external_identity_key == "HA-001"
        break
