"""Unit & Integration Tests for Phase 6 Minimal Evidence Package.

Covers:
- Deterministic requirement-scoped evidence selection
- Strict exclusion of unrelated candidate facts
- Deduplication of identical facts with provenance preservation
- Multi-target comparison preservation (HA-006 vs HA-009)
- Price range discovery packaging
- Missing-information signals (CATEGORY_NOT_CONFIGURED, NO_MATCH, CAPABILITY_UNAVAILABLE)
- Operational booking safety invariant (booking_confirmed strictly False)
- Contextual short replies ('yes', 'book now', 'show me', 'hello')
- Stale context revision rejection
- Tenant isolation and cross-tenant rejection
- Payload and token budget metrics
"""

from decimal import Decimal
from typing import Any, Dict, List
import pytest

from app.contracts.evidence_fusion import (
    ActionWorkflowContext,
    CandidateRole,
    ConflictRecord,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
    VerifiedEvidenceResult,
    VerifiedFact,
)
from app.contracts.evidence_package import (
    EvidenceFactType,
    FactTemporalStatus,
    MinimalEvidencePackage,
    MissingSignalType,
    PackageStatus,
)
from app.contracts.requirement_plan import (
    IntentType,
    PlannedComparison,
    PlannedRange,
    PlannedResultCount,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.retrieval_result import (
    EvidenceProvenance,
    FactVerificationStatus,
    PlanReferenceDTO,
    VerifiedPricingEvidence,
)
from app.services.context_resolver import (
    ContextEnvelope,
    ContextMessage,
    RequirementStatus,
    UnresolvedRequirement,
)
from app.services.evidence_package.service import evidence_package_service

TARGET_TENANT = "org_31d214d315c84be29023395466af2f28"
ATTACKER_TENANT = "org_foreign_attacker_99"


def _make_candidate(
    entity_id: str,
    sku: str,
    title: str,
    price: float,
    role: CandidateRole = CandidateRole.PRODUCT_SERVICE,
    passages: List[str] = None,
) -> VerifiedCandidate:
    pricing = VerifiedPricingEvidence(
        calculated_total=Decimal(str(price)),
        currency="INR",
        tax_inclusive=True,
        qualifying_statement=f"Authoritative quote for {title}.",
    )
    prov = EvidenceProvenance(
        source_system="postgresql",
        version_id="ver_001",
        authority_level="verified_canonical",
        tenant_id=TARGET_TENANT,
    )
    return VerifiedCandidate(
        candidate_id=f"cand_{entity_id}",
        entity_id=entity_id,
        tenant_id=TARGET_TENANT,
        external_identity_key=sku,
        title=title,
        candidate_role=role,
        category="products_services",
        pricing=pricing,
        provenance=prov,
        semantic_passages=passages or [f"Authoritative description for {title}."],
    )


def _make_fact(
    entity_id: str,
    sku: str,
    attr: str,
    val: Any,
    unit: str = "INR",
) -> VerifiedFact:
    return VerifiedFact(
        attribute_name=attr,
        entity_id=entity_id,
        external_identity_key=sku,
        typed_value=val,
        currency_or_unit=unit,
        source_system="postgresql",
        source_version_id="ver_001",
        authority_level="verified_canonical",
        verification_status=FactVerificationStatus.VERIFIED,
    )


def _make_plan_ref(plan_id: str = "plan_01", rev: int = 1, tenant_id: str = TARGET_TENANT) -> PlanReferenceDTO:
    return PlanReferenceDTO(
        plan_id=plan_id,
        tenant_id=tenant_id,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=rev,
        retrieval_strategy="hybrid",
    )


# =============================================================================
# 1. Regression Test: 5-Requirement Compound Email Fixture
# =============================================================================


@pytest.mark.asyncio
async def test_5_requirement_compound_email_packaging():
    """Verify exact packaging of the audited 5-requirement live email."""
    cand1 = _make_candidate("ent_006", "HA-006", "Washing Machine General Service", 1000.64)
    cand2 = _make_candidate("ent_007", "HA-007", "Washing Machine Drainage Repair", 1708.64)
    cand3 = _make_candidate("ent_009", "HA-009", "Microwave Heating Repair", 2416.64)
    cand4 = _make_candidate("ent_010", "HA-010", "RO Water Purifier Service", 1959.51)
    cand5 = _make_candidate("ent_024", "HA-024", "Geyser Descaling Service", 1531.64)

    facts = [
        _make_fact("ent_006", "HA-006", "price", 1000.64),
        _make_fact("ent_007", "HA-007", "price", 1708.64),
        _make_fact("ent_009", "HA-009", "price", 2416.64),
        _make_fact("ent_010", "HA-010", "price", 1959.51),
        _make_fact("ent_024", "HA-024", "price", 1531.64),
    ]

    req_comp = RequirementEvidenceGroup(
        requirement_id="req_comp_01",
        intent="service_comparison",
        requirement_type=RequirementType.COMPARISON,
        description="Compare Washing Machine Installation vs Microwave Repair",
        requested_targets=["Washing Machine Installation", "Microwave Repair"],
        verified_targets=["WASHING MACHINE INSTALLATION", "MICROWAVE REPAIR"],
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[cand1, cand3],
    )

    req_disc = RequirementEvidenceGroup(
        requirement_id="req_disc_02",
        intent="product_service_discovery",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="Service packages between 1000 and 2500 INR",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[cand1, cand2, cand3, cand4, cand5],
    )

    req_policy = RequirementEvidenceGroup(
        requirement_id="req_pol_03",
        intent="policy_query",
        requirement_type=RequirementType.POLICY_QUERY,
        description="Warranty and cancellation policy terms",
        status=RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED,
        target_category="policies",
    )

    req_contact = RequirementEvidenceGroup(
        requirement_id="req_cnt_04",
        intent="contact_resolution",
        requirement_type=RequirementType.CONTACT_RESOLUTION,
        description="Escalation contact person",
        status=RequirementCoverageStatus.NO_MATCH,
        requested_targets=["billing", "escalation"],
    )

    req_sched = RequirementEvidenceGroup(
        requirement_id="req_sch_05",
        intent="operational_scheduling",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Sunday technician appointment scheduling",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
    )

    act_ctx = ActionWorkflowContext(
        safe_response_strategy="partial_evidence_with_escalation",
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=False,
        requires_human_escalation=True,
        unsupported_categories=["policies"],
        escalation_reason="Customer inquired about 'policies', but tenant has no active knowledge records.",
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_test_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=2,
        plan_reference=_make_plan_ref("plan_01", rev=2),
        overall_status=EvidenceOverallStatus.PARTIAL,
        requirements=[req_comp, req_disc, req_policy, req_contact, req_sched],
        verified_facts=facts,
        action_context=act_ctx,
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="pthr_01",
        thread_id="thr_01",
        current_message_id="msg_01",
        context_revision=2,
        current_message=ContextMessage(
            id="msg_01",
            external_message_id="ext_01",
            direction="inbound",
            from_email="customer@example.com",
            body_text="Please compare washing machine and microwave repair, give options under 2500, state warranty, escalation email, and book Sunday slot.",
        ),
    )

    # Build package
    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        envelope=envelope,
        dispatch_event=False,
    )

    # Assertions
    assert pkg.schema_version == "1.0"
    assert pkg.tenant_id == TARGET_TENANT
    assert pkg.package_status == PackageStatus.PARTIAL_EVIDENCE
    assert len(pkg.requirements) == 5

    # Check Comparison Group
    pkg_comp = next(r for r in pkg.requirements if r.requirement_id == "req_comp_01")
    assert pkg_comp.coverage_status == RequirementCoverageStatus.COMPLETE
    # Must only contain facts for HA-006 and HA-009 (2 facts), NOT all 5 candidates!
    comp_skus = {f.external_identity_key for f in pkg_comp.facts}
    assert comp_skus == {"HA-006", "HA-009"}
    assert len(pkg_comp.facts) == 2

    # Check Discovery Group
    pkg_disc = next(r for r in pkg.requirements if r.requirement_id == "req_disc_02")
    assert pkg_disc.coverage_status == RequirementCoverageStatus.COMPLETE
    assert len(pkg_disc.facts) == 5  # All 5 in budget range

    # Check Policy Group
    pkg_pol = next(r for r in pkg.requirements if r.requirement_id == "req_pol_03")
    assert pkg_pol.coverage_status == RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED
    assert len(pkg_pol.facts) == 0  # Zero hallucinated facts!
    assert len(pkg_pol.missing_signals) == 1
    assert pkg_pol.missing_signals[0].signal_type == MissingSignalType.CATEGORY_NOT_CONFIGURED
    assert pkg_pol.missing_signals[0].requires_human_escalation is True

    # Check Contact Group
    pkg_cnt = next(r for r in pkg.requirements if r.requirement_id == "req_cnt_04")
    assert pkg_cnt.coverage_status == RequirementCoverageStatus.NO_MATCH
    assert len(pkg_cnt.facts) == 0
    assert pkg_cnt.missing_signals[0].signal_type == MissingSignalType.NO_MATCH

    # Check Scheduling Group
    pkg_sch = next(r for r in pkg.requirements if r.requirement_id == "req_sch_05")
    assert pkg_sch.coverage_status == RequirementCoverageStatus.CAPABILITY_UNAVAILABLE
    assert pkg_sch.missing_signals[0].signal_type == MissingSignalType.CAPABILITY_UNAVAILABLE
    assert pkg_sch.action_guidance is not None
    assert pkg_sch.action_guidance.human_review_required is True

    # Check Invariant: booking_confirmed MUST BE FALSE
    assert pkg.action_context.booking_confirmed is False
    assert pkg.action_context.requires_human_escalation is True
    assert pkg.action_context.safe_response_strategy == "partial_evidence_with_escalation"

    # Check Budget Metrics
    assert pkg.budget_metrics.facts_included_count == 7
    assert pkg.budget_metrics.serialized_package_bytes > 0
    assert pkg.budget_metrics.estimated_tokens > 0


# =============================================================================
# 2. Strict Security: Reject Cross-Tenant Infiltration
# =============================================================================


@pytest.mark.asyncio
async def test_cross_tenant_isolation_security_rejection():
    """Verify that any cross-tenant injection is rejected immediately."""
    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_sec_01",
        tenant_id=ATTACKER_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1, tenant_id=ATTACKER_TENANT),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[],
        verified_facts=[],
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="pthr_01",
        thread_id="thr_01",
        current_message_id="msg_01",
        context_revision=1,
        current_message=ContextMessage(
            id="msg_01",
            external_message_id="ext_01",
            direction="inbound",
            from_email="user@test.com",
            body_text="hello",
        ),
    )

    with pytest.raises(PermissionError, match="Tenant isolation"):
        await evidence_package_service.build_package(
            tenant_id=TARGET_TENANT,
            fusion_result=fusion_res,
            envelope=envelope,
            dispatch_event=False,
        )


# =============================================================================
# 3. Freshness: Reject Stale Context Revisions
# =============================================================================


@pytest.mark.asyncio
async def test_stale_context_revision_rejection():
    """Verify that a package is marked STALE_REJECTED when context revisions diverge."""
    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_stale_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,  # Older revision!
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[],
        verified_facts=[],
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="pthr_01",
        thread_id="thr_01",
        current_message_id="msg_01",
        context_revision=2,  # Current is 2
        current_message=ContextMessage(
            id="msg_01",
            external_message_id="ext_01",
            direction="inbound",
            from_email="user@test.com",
            body_text="hello",
        ),
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        envelope=envelope,
        dispatch_event=False,
    )

    assert pkg.package_status == PackageStatus.STALE_REJECTED
    assert any("Stale context detected" in w for w in pkg.warnings)


# =============================================================================
# 4. Short / Dependent Message Packaging ("Book now", "Yes", "Show me")
# =============================================================================


@pytest.mark.asyncio
async def test_short_reply_contextual_antecedent_packaging():
    """Verify that 'book now' captures antecedent service reference without thread bloat."""
    cand = _make_candidate("ent_006", "HA-006", "Washing Machine General Service", 1000.64)
    fact = _make_fact("ent_006", "HA-006", "price", 1000.64)

    req = RequirementEvidenceGroup(
        requirement_id="req_followup_01",
        intent="booking_requested",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Book the discussed washing machine service",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
        verified_candidates=[cand],
    )

    act_ctx = ActionWorkflowContext(
        safe_response_strategy="operational_escalation",
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=False,
        contextual_intent="booking_requested",
        referenced_proposal_id="prop_washing_service_01",
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_short_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_02",
        context_revision=2,
        plan_reference=_make_plan_ref("plan_02", rev=2),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req],
        verified_facts=[fact],
        action_context=act_ctx,
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="pthr_01",
        thread_id="thr_01",
        current_message_id="msg_02",
        context_revision=2,
        current_message=ContextMessage(
            id="msg_02",
            external_message_id="ext_02",
            direction="inbound",
            from_email="user@test.com",
            body_text="book now please",
        ),
        relevant_previous_messages=[
            ContextMessage(
                id="msg_01",
                external_message_id="ext_01",
                direction="outbound",
                from_email="support@proxipilot.com",
                body_text="We offer HA-006 Washing Machine General Service for INR 1,000.",
            )
        ],
        unresolved_requirements=[
            UnresolvedRequirement(
                requirement_id="req_prev_01",
                description="Washing Machine Service Booking",
                origin_message_id="msg_01",
            )
        ],
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        envelope=envelope,
        dispatch_event=False,
    )

    assert pkg.contextual_reference is not None
    assert pkg.contextual_reference.referenced_entity_key == "HA-006"
    assert pkg.contextual_reference.referenced_proposal_id == "prop_washing_service_01"
    assert "preferred_slot" in pkg.contextual_reference.missing_parameters
    assert pkg.action_context.booking_confirmed is False


# =============================================================================
# 5. Token & Byte Budget Minimization and Excerpt Bounding
# =============================================================================


@pytest.mark.asyncio
async def test_budget_minimization_and_excerpt_bounding():
    """Verify that huge passages are strictly bounded and byte limits trigger graceful reduction."""
    long_passage = "A" * 500  # 500-char passage
    cand = _make_candidate("ent_001", "HA-001", "AC Service", 999.0, passages=[long_passage])
    fact = _make_fact("ent_001", "HA-001", "price", 999.0)

    req = RequirementEvidenceGroup(
        requirement_id="req_01",
        intent="price_query",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="AC Service",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[cand],
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_bgt_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req],
        verified_facts=[fact],
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        max_bytes=65536,
        dispatch_event=False,
    )

    # Excerpt should be bounded <= 203 chars (200 + '...')
    pkg_req = pkg.requirements[0]
    assert len(pkg_req.supporting_excerpts) == 1
    assert len(pkg_req.supporting_excerpts[0].text) <= 205
    assert pkg.budget_metrics.excerpts_truncated_count == 1
    assert pkg.budget_metrics.serialized_package_bytes < 5000


# =============================================================================
# 6. Operational Booking Safety Invariant
# =============================================================================


@pytest.mark.asyncio
async def test_operational_booking_confirmed_safety_enforcement():
    """Verify that even if upstream sets booking_confirmed=True, the policy gate forces False."""
    act_ctx = ActionWorkflowContext(
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=True,  # Injected / corrupted upstream!
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_fake_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[],
        verified_facts=[],
        action_context=act_ctx,
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        dispatch_event=False,
    )

    # Must be forced to False
    assert pkg.action_context.booking_confirmed is False
    assert any("booking_confirmed=False" in w for w in pkg.warnings)


# =============================================================================
# 7. Multilingual / Hinglish Short Replies ("ha book kardo", "theek hai")
# =============================================================================


@pytest.mark.asyncio
async def test_multilingual_hinglish_short_reply():
    """Verify that Hinglish replies 'ha book kardo' resolve contextual parameters."""
    cand = _make_candidate("ent_007", "HA-007", "Drainage Repair", 1708.64)
    fact = _make_fact("ent_007", "HA-007", "price", 1708.64)

    req = RequirementEvidenceGroup(
        requirement_id="req_hinglish_01",
        intent="booking_requested",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Drainage repair booking",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
        verified_candidates=[cand],
    )

    act_ctx = ActionWorkflowContext(
        safe_response_strategy="operational_escalation",
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=False,
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_hin_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_02",
        context_revision=2,
        plan_reference=_make_plan_ref("plan_02", rev=2),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req],
        verified_facts=[fact],
        action_context=act_ctx,
    )

    envelope = ContextEnvelope(
        tenant_id=TARGET_TENANT,
        integration_account_id="int_01",
        provider_thread_id="pthr_01",
        thread_id="thr_01",
        current_message_id="msg_02",
        context_revision=2,
        current_message=ContextMessage(
            id="msg_02",
            external_message_id="ext_02",
            direction="inbound",
            from_email="user@test.com",
            body_text="theek hai ha book kardo",
        ),
        relevant_previous_messages=[
            ContextMessage(
                id="msg_01",
                external_message_id="ext_01",
                direction="outbound",
                from_email="support@proxipilot.com",
                body_text="HA-007 Drainage Repair is available.",
            )
        ],
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        envelope=envelope,
        dispatch_event=False,
    )

    assert pkg.contextual_reference is not None
    assert pkg.contextual_reference.referenced_entity_key == "HA-007"
    assert "preferred_slot" in pkg.contextual_reference.missing_parameters
    assert pkg.action_context.booking_confirmed is False


# =============================================================================
# 8. Conversational Greeting & No Retrieval Required
# =============================================================================


@pytest.mark.asyncio
async def test_greeting_no_retrieval_required():
    """Verify greeting emails are classified as NO_RETRIEVAL_REQUIRED with zero hallucinated facts."""
    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_greet_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED,
        requirements=[],
        verified_facts=[],
        action_context=ActionWorkflowContext(
            safe_response_strategy="conversational_greeting",
            workflow_action_required=False,
        ),
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        dispatch_event=False,
    )

    assert pkg.package_status == PackageStatus.NO_RETRIEVAL_REQUIRED
    assert pkg.action_context.safe_response_strategy == "conversational_greeting"
    assert len(pkg.requirements) == 0


# =============================================================================
# 9. Duplicate Fact Deduplication
# =============================================================================


@pytest.mark.asyncio
async def test_duplicate_fact_deduplication():
    """Verify that duplicate facts from multiple candidate models are consolidated."""
    cand = _make_candidate("ent_001", "HA-001", "AC Service", 999.0)
    # Duplicate fact identical in attr, entity, value
    fact1 = _make_fact("ent_001", "HA-001", "price", 999.0)
    fact2 = _make_fact("ent_001", "HA-001", "price", 999.0)

    req = RequirementEvidenceGroup(
        requirement_id="req_01",
        intent="price_query",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="AC Service",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[cand],
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_dup_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req],
        verified_facts=[fact1, fact2],
    )

    pkg = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        dispatch_event=False,
    )

    # Only 1 fact included, 1 excluded
    assert len(pkg.requirements[0].facts) == 1
    assert pkg.budget_metrics.facts_included_count == 1
    assert pkg.budget_metrics.facts_excluded_count == 1


# =============================================================================
# 10. Idempotent Repeated Construction
# =============================================================================


@pytest.mark.asyncio
async def test_idempotent_repeated_construction():
    """Verify that repeated package construction produces deterministic, identical results."""
    cand = _make_candidate("ent_006", "HA-006", "Washing Machine Service", 1000.64)
    fact = _make_fact("ent_006", "HA-006", "price", 1000.64)

    req = RequirementEvidenceGroup(
        requirement_id="req_01",
        intent="price_query",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="Washing Machine Service",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[cand],
    )

    fusion_res = VerifiedEvidenceResult(
        fusion_id="fus_idem_01",
        tenant_id=TARGET_TENANT,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req],
        verified_facts=[fact],
    )

    pkg1 = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        dispatch_event=False,
    )
    pkg2 = await evidence_package_service.build_package(
        tenant_id=TARGET_TENANT,
        fusion_result=fusion_res,
        dispatch_event=False,
    )

    assert pkg1.package_status == pkg2.package_status
    assert len(pkg1.requirements) == len(pkg2.requirements)
    assert pkg1.budget_metrics.facts_included_count == pkg2.budget_metrics.facts_included_count
    assert pkg1.budget_metrics.serialized_package_bytes == pkg2.budget_metrics.serialized_package_bytes

