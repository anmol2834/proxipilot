"""Automated Regression Tests for Phase 10 Hybrid Retrieval and Fact Verification Engine.

Tests:
1. Exact Code / SKU Retrieval (HA-001) with authoritative PostgreSQL canonical re-hydration.
2. Semantic Vector ANN Candidate Search via Qdrant with tenant isolation and metadata filtering.
3. Pure Decimal Pricing Arithmetic and Mandatory Commercial Pricing Disclaimers.
4. Geographic Boundary Validation Gate (Clarification trigger on location mismatch).
5. Unserviceable Query Handling (Human hand-off trigger on missing evidence / zero hallucination).
6. Temporal Validity Filter (Exclusion of expired and future items).
"""

from datetime import datetime, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.rag import (
    CommercialPriceType,
    HybridRetrievalRequestDTO,
    VerificationDecision,
)
from app.core.database import get_db
from app.services.hybrid_retrieval import hybrid_retrieval_service



@pytest.mark.asyncio
async def test_exact_code_retrieval_and_canonical_pricing(seeded_tenant):
    """Verify that querying for HA-001 resolves authoritative facts from PostgreSQL."""
    async for db in get_db():
        req = HybridRetrievalRequestDTO(
            query_text="What is the price of service HA-001 in Ahmedabad?",
            required_service_code="HA-001",
            customer_location="Ahmedabad",
            top_k=3,
        )

        resp = await hybrid_retrieval_service.retrieve_and_verify(
            db=db,
            tenant_id=seeded_tenant,
            request=req,
        )

        assert resp.total_candidates_found >= 1, "Must find at least 1 candidate for HA-001"
        top_ev = resp.evidence_objects[0]
        assert top_ev.external_key == "HA-001"
        assert "AC" in top_ev.title
        assert top_ev.pricing is not None

        # Verify exact Decimal calculation: (699 + 149) * 1.18 = 1000.64
        pr = top_ev.pricing
        assert pr.base_price == 699.0
        assert pr.visit_diagnostic_charge == 149.0
        assert pr.tax_percentage == 18.0
        assert pr.calculated_total == 1000.64
        assert pr.currency == "INR"

        # Verify commercial qualifier: not_specified/estimate must never be hallucinated as fixed quote
        assert pr.commercial_price_type in (
            CommercialPriceType.NOT_SPECIFIED,
            CommercialPriceType.ESTIMATE,
        )
        assert "not fixed" in pr.qualifying_statement or "Estimated" in pr.qualifying_statement

        # Coverage validation
        assert resp.validation.decision == VerificationDecision.PROCEED
        assert resp.validation.coverage_status == "COMPLETE"
        assert len(resp.validation.missing_requirements) == 0
        break


@pytest.mark.asyncio
async def test_semantic_vector_ann_candidate_retrieval(seeded_tenant):
    """Verify that natural language query finds relevant home appliance services in Qdrant."""
    async for db in get_db():
        req = HybridRetrievalRequestDTO(
            query_text="I need help cleaning and servicing my split air conditioner that is not cooling well",
            customer_location="Ahmedabad",
            top_k=5,
            score_threshold=0.3,
        )

        resp = await hybrid_retrieval_service.retrieve_and_verify(
            db=db,
            tenant_id=seeded_tenant,
            request=req,
        )

        assert resp.total_candidates_found >= 1
        found_ac = any("AC" in ev.title for ev in resp.evidence_objects)
        assert found_ac, f"Expected AC service among candidates, got: {[e.title for e in resp.evidence_objects]}"
        assert resp.validation.decision == VerificationDecision.PROCEED
        assert len(resp.validation.verified_fact_summary) > 20
        break


@pytest.mark.asyncio
async def test_geographic_boundary_mismatch_triggers_clarification(seeded_tenant):
    """Verify that a customer location outside Ahmedabad triggers CLARIFY instead of hallucinating coverage."""
    async for db in get_db():
        req = HybridRetrievalRequestDTO(
            query_text="I want HA-001 Split AC service at my apartment",
            required_service_code="HA-001",
            customer_location="Bengaluru",  # Outside Ahmedabad
            top_k=3,
        )

        resp = await hybrid_retrieval_service.retrieve_and_verify(
            db=db,
            tenant_id=seeded_tenant,
            request=req,
        )

        assert resp.total_candidates_found >= 1
        assert resp.validation.decision == VerificationDecision.CLARIFY
        assert resp.validation.coverage_status == "PARTIAL"
        assert any("GEOGRAPHIC_BOUNDARY_MISMATCH" in r for r in resp.validation.missing_requirements)
        assert resp.validation.clarification_prompt is not None
        assert "Ahmedabad" in resp.validation.clarification_prompt
        assert "Bengaluru" in resp.validation.clarification_prompt
        break


@pytest.mark.asyncio
async def test_unserviceable_inquiry_triggers_human_handoff(seeded_tenant):
    """Verify that inquiry with zero matching knowledge triggers HUMAN_HANDOFF (zero hallucination)."""
    async for db in get_db():
        req = HybridRetrievalRequestDTO(
            query_text="Underwater submarine torpedo propulsion nuclear overhaul service",
            top_k=3,
            score_threshold=0.85,  # High threshold guarantees no false match
        )

        resp = await hybrid_retrieval_service.retrieve_and_verify(
            db=db,
            tenant_id=seeded_tenant,
            request=req,
        )

        assert resp.validation.decision == VerificationDecision.HUMAN_HANDOFF
        assert resp.validation.coverage_status == "INSUFFICIENT"
        assert "NO_MATCHING_KNOWLEDGE_FOUND" in resp.validation.missing_requirements
        assert resp.validation.clarification_prompt is not None
        break


@pytest.mark.asyncio
async def test_temporal_validity_filters_historical_as_of(seeded_tenant):
    """Verify that queries evaluated before effective_from return no active items."""
    async for db in get_db():
        # Source records are effective from 2026-01-01. As of 2020, they should be invalid.
        past_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
        req = HybridRetrievalRequestDTO(
            query_text="HA-001 Split AC Service",
            required_service_code="HA-001",
            top_k=3,
        )

        resp = await hybrid_retrieval_service.retrieve_and_verify(
            db=db,
            tenant_id=seeded_tenant,
            request=req,
            as_of=past_time,
        )

        # In 2020, HA-001 was not yet effective -> should be filtered out
        assert resp.total_candidates_found == 0
        assert resp.validation.decision == VerificationDecision.HUMAN_HANDOFF
        break
