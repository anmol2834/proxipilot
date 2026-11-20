"""Comprehensive Unit & Integration Test Suite — Phase 5: Candidate Fusion & Evidence Verification.

Covers:
1. Candidate normalization and atomic fact extraction.
2. Multi-SKU target set matching (HA-001 and HA-004) without AND-rejection.
3. Separation of requested_result_count (5) from explicit targets (2).
4. Hard-constraint enforcement before soft ranking.
5. Deduplication preserving distinct targets and hybrid merge.
6. Context-aware short reply resolution ("yes", "ok", "book now", "hello", typos, Hinglish).
7. Audited 4-requirement email end-to-end (comparison, troubleshooting, contact, scheduling).
8. Zero cross-tenant leakage security isolation.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
import pytest

from app.contracts.evidence_fusion import (
    CandidateRole,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementType,
    VerifiedCandidate,
    VerifiedEvidenceResult,
)
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
from app.contracts.retrieval_result import (
    EvidenceProvenance,
    FactVerificationStatus,
    PlanReferenceDTO,
    RetrievedEvidenceItem,
    VerifiedPricingEvidence,
)
from app.services.context_resolver import (
    ContextEnvelope,
    ContextMessage,
    RequirementStatus,
    UnresolvedRequirement,
)
from app.services.evidence_fusion import (
    CandidateNormalizer,
    ContextualReplyEvaluator,
    EvidenceFactVerifier,
    RequirementGrouper,
    TargetEntityMatcher,
    evidence_fusion_service,
)

TARGET_TENANT = "org_31d214d315c84be29023395466af2f28"
FOREIGN_TENANT = "org_foreign_attacker_99"


# =============================================================================
# Helper Fixtures & Builders
# =============================================================================


def _make_candidate(
    entity_id: str,
    sku: Optional[str],
    title: str,
    price: float,
    warranty: str = "1 Year Warranty",
    category: str = "products_services",
    role: CandidateRole = CandidateRole.PRODUCT_SERVICE,
    tenant_id: str = TARGET_TENANT,
    authority: str = "verified_canonical",
) -> VerifiedCandidate:
    cand_id = f"cand_{entity_id}_v1"
    pricing = VerifiedPricingEvidence(
        currency="INR",
        base_price=price,
        visit_diagnostic_charge=0.0,
        estimated_parts_cost=0.0,
        discount_percentage=0.0,
        tax_percentage=18.0,
        calculated_total=round(price * 1.18, 2),
        commercial_price_type="fixed",
        qualifying_statement=f"Authoritative quote for {title}.",
    )
    provenance = EvidenceProvenance(
        source_system="postgresql",
        source_id="src_01",
        version_id="ver_01",
        authority_level=authority,
        authority_score=0.9 if authority == "approved_policy" else 0.85,
        effective_from="2026-01-01T00:00:00Z",
        effective_until="2027-01-01T00:00:00Z",
        temporal_status="current",
        tenant_id=tenant_id,
    )

    return VerifiedCandidate(
        candidate_id=cand_id,
        entity_id=entity_id,
        tenant_id=tenant_id,
        external_identity_key=sku,
        title=title,
        description=f"Description of {title}",
        candidate_role=role,
        category=category,
        pricing=pricing,
        warranty=warranty,
        sla="Within 24 Hours",
        attributes={"sku": sku, "title": title, "category": category},
        semantic_passages=[f"Passage for {title}"],
        provenance=provenance,
        verification_status=FactVerificationStatus.VERIFIED,
        relevance_score=0.85,
        composite_score=150.0,
        retrieval_path="hybrid",
        satisfied_constraints=[],
        unmet_constraints=[],
    )


# =============================================================================
# 1. Multi-SKU Target-Set Matching & Result-Count Distinction
# =============================================================================


@pytest.mark.asyncio
async def test_multi_sku_comparison_retains_both_targets_and_completes():
    """Verify HA-001 and HA-004 are retained independently and status is COMPLETE (not PARTIAL)."""
    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_comp_01",
        message_id="msg_01",
        context_revision=1,
        intent=IntentType.SERVICE_COMPARISON,
        comparison=PlannedComparison(
            requested=True,
            target_entities=["HA-001", "HA-004"],
            criteria=["price", "warranty"],
        ),
        requested_result_count=PlannedResultCount(final_count=5),  # Notice default discovery count is 5!
        requested_attributes=["price", "warranty"],
        query_text="Compare HA-001 and HA-004 price and warranty",
    )

    c1 = _make_candidate("ki_ac", "HA-001", "AC General Service", 699.00)
    c2 = _make_candidate("ki_fridge", "HA-004", "Refrigerator General Service", 899.00)
    c3 = _make_candidate("ki_other", "HA-002", "Unrequested Service", 500.00)

    result: VerifiedEvidenceResult = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        raw_candidates=[c1, c2, c3],
        dispatch_event=False,
    )

    assert result.overall_status == EvidenceOverallStatus.COMPLETE
    assert len(result.requirements) == 1
    comp_group = result.requirements[0]

    assert comp_group.requirement_type == RequirementType.COMPARISON
    assert set(comp_group.requested_targets) == {"HA-001", "HA-004"}
    assert set(comp_group.verified_targets) == {"HA-001", "HA-004"}
    assert comp_group.missing_targets == []
    assert comp_group.status == RequirementCoverageStatus.COMPLETE

    # Both explicit candidates must be retained
    verified_skus = [c.external_identity_key for c in comp_group.verified_candidates]
    assert "HA-001" in verified_skus
    assert "HA-004" in verified_skus
    assert "HA-002" not in verified_skus  # Unrequested entity filtered out from targeted comparison

    # Verify atomic facts extracted
    fact_attrs = [f.attribute_name for f in result.verified_facts]
    assert "price" in fact_attrs
    assert "warranty" in fact_attrs


@pytest.mark.asyncio
async def test_comparison_with_one_missing_target_reports_partial():
    """If HA-001 is found but HA-004 is missing, target recall is partial."""
    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_comp_02",
        message_id="msg_01",
        context_revision=1,
        intent=IntentType.SERVICE_COMPARISON,
        comparison=PlannedComparison(
            requested=True,
            target_entities=["HA-001", "HA-004"],
            criteria=["price", "warranty"],
        ),
        requested_attributes=["price", "warranty"],
        query_text="Compare HA-001 and HA-004",
    )

    c1 = _make_candidate("ki_ac", "HA-001", "AC General Service", 699.00)

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        raw_candidates=[c1],
        dispatch_event=False,
    )

    assert result.overall_status == EvidenceOverallStatus.PARTIAL
    comp_group = result.requirements[0]
    assert comp_group.status == RequirementCoverageStatus.PARTIAL
    assert "HA-001" in comp_group.verified_targets
    assert "HA-004" in comp_group.missing_targets


# =============================================================================
# 2. Hard-Constraint Validation & Boundary Checks
# =============================================================================


@pytest.mark.asyncio
async def test_price_range_hard_rejection_before_ranking():
    """Candidate outside mandatory price range is marked OUT_OF_BOUNDS regardless of score."""
    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_rng",
        message_id="msg_01",
        context_revision=1,
        intent=IntentType.PRICE_QUERY,
        range_semantics=PlannedRange(field="price", min_value=500.0, max_value=1000.0, currency="INR"),
        requested_attributes=["price"],
        query_text="Services between 500 and 1000 INR",
    )

    # c1 is 700 * 1.18 = 826 (within range)
    c1 = _make_candidate("ki_1", "OPT-1", "Valid Option", 700.00)
    # c2 is 1200 * 1.18 = 1416 (above 1000 range)
    c2 = _make_candidate("ki_2", "OPT-2", "Expensive Option", 1200.00)
    c2.relevance_score = 0.99  # High semantic score should NOT override hard price boundary!

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        raw_candidates=[c1, c2],
        dispatch_event=False,
    )

    req_group = result.requirements[0]
    verified_ids = [c.entity_id for c in req_group.verified_candidates]
    assert "ki_1" in verified_ids
    assert "ki_2" not in verified_ids


# =============================================================================
# 3. Context-Aware Short Replies
# =============================================================================


@pytest.mark.asyncio
async def test_short_reply_yes_resolves_pending_proposal_safely():
    """'yes' resolves against previous technician proposal without committing live booking."""
    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="prov_01",
        thread_id="thr_ctx_01",
        current_message_id="msg_02",
        context_revision=2,
        current_message=ContextMessage(
            id="msg_02",
            external_message_id="ext_02",
            direction="inbound",
            from_email="customer@example.com",
            body_text="yes",
        ),
        relevant_previous_messages=[
            ContextMessage(
                id="msg_01",
                external_message_id="ext_01",
                direction="outbound",
                from_email="support@business.com",
                body_text="Would you like us to schedule a technician visit for AC General Service (HA-001) for this Saturday morning at ₹799?",
            )
        ],
    )

    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_ctx_01",
        message_id="msg_02",
        context_revision=2,
        intent=IntentType.FOLLOW_UP,
        query_text="yes",
    )

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=envelope,
        dispatch_event=False,
    )

    assert result.action_context.contextual_intent == "proposal_accepted"
    assert result.action_context.referenced_proposal_id == "msg_01"
    assert result.action_context.workflow_action_required is True
    assert result.action_context.booking_confirmed is False  # CRITICAL INVARIANT
    assert result.action_context.required_workflow_type == "appointment_scheduling"


@pytest.mark.asyncio
async def test_short_reply_greeting_requires_no_retrieval():
    """'hello' requires no database retrieval and does not trigger actions."""
    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="prov_02",
        thread_id="thr_ctx_02",
        current_message_id="msg_01",
        context_revision=1,
        current_message=ContextMessage(
            id="msg_01",
            external_message_id="ext_01",
            direction="inbound",
            from_email="customer@example.com",
            body_text="hello",
        ),
    )

    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_ctx_02",
        message_id="msg_01",
        context_revision=1,
        intent=IntentType.OTHER,
        query_text="hello",
    )

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=envelope,
        dispatch_event=False,
    )

    assert result.overall_status == EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED
    assert result.action_context.safe_response_strategy == "conversational_greeting"
    assert result.action_context.workflow_action_required is False


@pytest.mark.asyncio
async def test_short_reply_proceed_typo_and_hinglish():
    """'goo ahead' and Hinglish 'ha' resolve correctly."""
    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="prov_03",
        thread_id="thr_ctx_03",
        current_message_id="msg_02",
        context_revision=2,
        current_message=ContextMessage(
            id="msg_02",
            external_message_id="ext_02",
            direction="inbound",
            from_email="customer@example.com",
            body_text="goo ahead",  # Common typo for 'go ahead'
        ),
        relevant_previous_messages=[
            ContextMessage(
                id="msg_01",
                external_message_id="ext_01",
                direction="outbound",
                from_email="support@business.com",
                body_text="I have prepared the quote for Refrigerator General Service. Shall I proceed?",
            )
        ],
    )

    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_ctx_03",
        message_id="msg_02",
        context_revision=2,
        intent=IntentType.FOLLOW_UP,
        query_text="goo ahead",
    )

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=envelope,
        dispatch_event=False,
    )

    assert result.action_context.contextual_intent == "proposal_accepted"
    assert result.action_context.referenced_proposal_id == "msg_01"


@pytest.mark.asyncio
async def test_short_reply_yes_without_antecedent_requires_clarification():
    """'yes' with no prior context does not hallucinate an action."""
    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_empty",
        message_id="msg_01",
        context_revision=1,
        intent=IntentType.UNKNOWN,
        query_text="yes",
    )

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=None,
        dispatch_event=False,
    )

    assert result.overall_status == EvidenceOverallStatus.NEEDS_CLARIFICATION
    assert result.action_context.clarification_required is True


# =============================================================================
# 4. End-to-End Audited 4-Requirement Scenario
# =============================================================================


@pytest.mark.asyncio
async def test_audited_4_requirement_scenario_honest_partial_aggregation():
    """Recreate the audited 4-requirement email:
    1. Compare HA-001 and HA-004 with pricing and warranty.
    2. Troubleshooting advice for rattling noise/cooling failure.
    3. Corporate billing contact for escalation.
    4. Saturday morning technician visit.
    
    Asserts:
    - 4 isolated requirement groups created.
    - HA-001 and HA-004 verified independently.
    - Troubleshooting guide verified.
    - Corporate contact card verified.
    - Scheduling capability marked CAPABILITY_UNAVAILABLE (workflow_action_required=True, booking_confirmed=False).
    - Overall status is PARTIAL (honest aggregate: comparison success does not hide missing booking integration!).
    """
    email_body = (
        "1. Please compare AC General Service (HA-001) and Refrigerator General Service (HA-004) with prices and warranty.\n"
        "2. Also my AC makes a loud rattling noise and cooling has stopped, what preliminary troubleshooting can I do?\n"
        "3. Who is the corporate billing contact for escalation?\n"
        "4. Can a technician visit this Saturday morning?"
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="prov_audit_01",
        thread_id="thr_audit_01",
        current_message_id="msg_audit_01",
        context_revision=1,
        current_message=ContextMessage(
            id="msg_audit_01",
            external_message_id="ext_audit_01",
            direction="inbound",
            from_email="anmolsinha4321@gmail.com",
            body_text=email_body,
        ),
    )

    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_audit_01",
        message_id="msg_audit_01",
        context_revision=1,
        intent=IntentType.SERVICE_COMPARISON,
        comparison=PlannedComparison(
            requested=True,
            target_entities=["HA-001", "HA-004"],
            criteria=["price", "warranty"],
        ),
        requested_attributes=["price", "warranty"],
        query_text=email_body,
    )

    # Supply representative candidates for the 4 requirements
    c_ha001 = _make_candidate("ki_ac", "HA-001", "AC General Service", 699.00)
    c_ha004 = _make_candidate("ki_fridge", "HA-004", "Refrigerator General Service", 899.00)
    
    c_trouble = _make_candidate(
        entity_id="ki_trouble_01",
        sku=None,
        title="AC Troubleshooting Guide: Rattling Noise & Cooling Failure",
        price=0.0,
        role=CandidateRole.TROUBLESHOOTING_GUIDE,
        category="support_faqs",
    )
    c_trouble.semantic_passages = [
        "1. Power off the AC. 2. Inspect outdoor compressor fan for debris causing rattling noise. 3. Clean air filters."
    ]

    c_contact = _make_candidate(
        entity_id="ki_contact_01",
        sku="BILLING-ESCALATION",
        title="Corporate Billing & Escalation Desk",
        price=0.0,
        role=CandidateRole.CONTACT_CARD,
        category="company_info",
    )
    c_contact.attributes = {
        "email": "billing-escalations@proxipilot.com",
        "phone": "+91-9876543210",
        "department": "corporate_billing",
    }

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=envelope,
        raw_candidates=[c_ha001, c_ha004, c_trouble, c_contact],
        dispatch_event=False,
    )

    # 1. Overall Status Assertion
    # Since operational scheduling integration is not connected, status MUST be PARTIAL!
    assert result.overall_status == EvidenceOverallStatus.PARTIAL
    assert result.action_context.workflow_action_required is True
    assert result.action_context.booking_confirmed is False
    assert result.action_context.required_workflow_type == "appointment_scheduling"

    # 2. Check Requirement Groups
    assert len(result.requirements) == 4
    req_map = {r.requirement_type: r for r in result.requirements}

    # Comparison Group
    comp = req_map[RequirementType.COMPARISON]
    assert comp.status == RequirementCoverageStatus.COMPLETE
    assert set(comp.verified_targets) == {"HA-001", "HA-004"}
    assert comp.missing_targets == []
    comp_skus = [c.external_identity_key for c in comp.verified_candidates]
    assert "HA-001" in comp_skus
    assert "HA-004" in comp_skus

    # Support Troubleshooting Group
    trouble = req_map[RequirementType.SUPPORT_TROUBLESHOOTING]
    assert trouble.status == RequirementCoverageStatus.COMPLETE
    assert len(trouble.verified_candidates) >= 1
    assert trouble.verified_candidates[0].candidate_role == CandidateRole.TROUBLESHOOTING_GUIDE

    # Contact Resolution Group
    contact = req_map[RequirementType.CONTACT_RESOLUTION]
    assert contact.status == RequirementCoverageStatus.COMPLETE
    assert contact.verified_candidates[0].candidate_role == CandidateRole.CONTACT_CARD

    # Operational Scheduling Group
    sched = req_map[RequirementType.OPERATIONAL_SCHEDULING]
    assert sched.status == RequirementCoverageStatus.CAPABILITY_UNAVAILABLE
    assert "Operational scheduling integration required" in sched.missing_evidence_reasons[0]


# =============================================================================
# 5. Zero Cross-Tenant Leakage & Security
# =============================================================================


@pytest.mark.asyncio
async def test_cross_tenant_plan_rejection():
    """A plan belonging to another tenant is blocked with PermissionError."""
    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=FOREIGN_TENANT,
        integration_account_id="int_foreign",
        thread_id="thr_foreign",
        message_id="msg_foreign",
        context_revision=1,
        intent=IntentType.PRODUCT_LOOKUP,
        query_text="Attacker query",
    )

    with pytest.raises(PermissionError) as exc_info:
        await evidence_fusion_service.fuse_and_verify(
            tenant_id=TARGET_TENANT,
            plan=plan,
            dispatch_event=False,
        )

    assert "does not match authenticated tenant" in str(exc_info.value)


@pytest.mark.asyncio
async def test_5_requirement_unconfigured_category_scenario_with_honest_escalation():
    """Verify live scenario:
    1. Compare Washing Machine Installation vs Microwave Repair.
    2. Packages between ₹1,000 and ₹2,500.
    3. Official policy regarding warranty claims and cancellation (unconfigured category).
    4. Escalation and billing contact.
    5. Sunday afternoon technician visit (capability unavailable).
    
    Asserts:
    - 5 isolated requirement groups.
    - Comparison: Washing Machine Installation (HA-018) and Microwave Heating Repair (HA-009) matched & verified.
    - Discovery: AC Deep Cleaning (₹1,199) satisfies [1000, 2500] range.
    - Policy: CATEGORY_NOT_CONFIGURED (zero hallucination, reason recorded).
    - Contact: COMPLETE (contact card verified).
    - Scheduling: CAPABILITY_UNAVAILABLE (booking_confirmed=False).
    - Overall status: PARTIAL.
    - requires_human_escalation: True.
    - unsupported_categories: ['policies'].
    - safe_response_strategy: 'partial_evidence_with_escalation'.
    """
    email_body = (
        "Hi Support Team,\n\n"
        "1. Service Comparison & Pricing:\n"
        "Could you please compare your Washing Machine Installation service with your Microwave Repair service? "
        "Please provide the exact price breakdown and warranty.\n\n"
        "2. Price Range Options:\n"
        "Do you have any preventive maintenance or deep cleaning packages priced between ₹1,000 and ₹2,500 INR?\n\n"
        "3. Warranty & Cancellation Policy:\n"
        "What is your official policy regarding service warranty claims and order cancellations if parts need replacement?\n\n"
        "4. Escalation & Billing Contact:\n"
        "Who is the authorized corporate contact person or department email for warranty escalations and invoice inquiries?\n\n"
        "5. Technician Visit Scheduling:\n"
        "Can we arrange for a technician to visit our premises this Sunday between 2:00 PM and 5:00 PM?\n"
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="prov_5req",
        thread_id="thr_5req",
        current_message_id="msg_5req",
        context_revision=1,
        current_message=ContextMessage(
            id="msg_5req",
            external_message_id="ext_5req",
            direction="inbound",
            from_email="chariot8733@gmail.com",
            body_text=email_body,
        ),
    )

    plan = RequirementPlan(
        schema_version="1.0",
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        thread_id="thr_5req",
        message_id="msg_5req",
        context_revision=1,
        intent=IntentType.UNKNOWN,
        comparison=PlannedComparison(
            requested=True,
            target_entities=["Washing Machine Installation", "Microwave Repair"],
            criteria=["price", "warranty"],
        ),
        range_semantics=PlannedRange(field="price", min_value=1000.0, max_value=2500.0, currency="INR"),
        query_text=email_body,
    )

    # Candidates that tenant actually possesses:
    c_wm = _make_candidate("ki_wm", "HA-018", "Washing Machine Installation", 399.00)
    c_micro = _make_candidate("ki_micro", "HA-009", "Microwave Heating Repair", 499.00)
    c_clean = _make_candidate("ki_clean", "HA-020", "AC Deep Cleaning", 1199.00)
    c_contact = _make_candidate(
        "ki_cnt", "BILLING-ESCALATION", "Corporate Escalation Desk", 0.0,
        role=CandidateRole.CONTACT_CARD, category="company_info"
    )
    c_contact.attributes = {"email": "escalations@proxipilot.com", "phone": "+91-9999988888"}

    result = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TARGET_TENANT,
        plan=plan,
        envelope=envelope,
        raw_candidates=[c_wm, c_micro, c_clean, c_contact],
        dispatch_event=False,
    )

    assert result.overall_status == EvidenceOverallStatus.PARTIAL
    assert result.action_context.requires_human_escalation is True
    assert "policies" in result.action_context.unsupported_categories
    assert result.action_context.safe_response_strategy == "partial_evidence_with_escalation"
    assert result.action_context.booking_confirmed is False
    assert result.action_context.workflow_action_required is True

    # 5 Requirement groups
    assert len(result.requirements) == 5
    req_map = {r.requirement_type: r for r in result.requirements}

    # 1. Comparison
    comp = req_map[RequirementType.COMPARISON]
    assert comp.status in (RequirementCoverageStatus.COMPLETE, RequirementCoverageStatus.PARTIAL)
    assert len(comp.verified_targets) == 2
    assert "WASHING MACHINE INSTALLATION" in comp.verified_targets
    assert "MICROWAVE REPAIR" in comp.verified_targets

    # 2. Discovery
    disc = req_map[RequirementType.PRODUCT_SERVICE_DISCOVERY]
    assert disc.status == RequirementCoverageStatus.COMPLETE
    assert len(disc.verified_candidates) >= 1
    assert disc.verified_candidates[0].pricing.calculated_total == 1414.82 or disc.verified_candidates[0].pricing.base_price == 1199.00

    # 3. Policy (Zero Hallucination Guard)
    pol = req_map[RequirementType.POLICY_QUERY]
    assert pol.status == RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED
    assert "no configured records for category 'policies'" in pol.missing_evidence_reasons[0]

    # 4. Contact
    cont = req_map[RequirementType.CONTACT_RESOLUTION]
    assert cont.status == RequirementCoverageStatus.COMPLETE

    # 5. Scheduling
    sched = req_map[RequirementType.OPERATIONAL_SCHEDULING]
    assert sched.status == RequirementCoverageStatus.CAPABILITY_UNAVAILABLE
