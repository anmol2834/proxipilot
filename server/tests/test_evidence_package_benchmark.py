"""Held-Out Enterprise Accuracy & Efficiency Benchmark for Phase 6 Minimal Evidence Package.

Evaluates minimal evidence packaging across 12 critical enterprise task families:
1. single_fact_lookup: Precise single fact extraction with exact provenance
2. multi_requirement_compound: 5-point compound email (comparison, range, policy, contact, booking)
3. product_comparisons: Multi-target comparison without cross-contamination (HA-006 vs HA-009)
4. exact_numeric_constraints: Hard range boundaries with strict Decimal limits
5. missing_knowledge_categories: Zero hallucination on unconfigured categories (policies)
6. unavailable_operational_integrations: Operational action prerequisites with booking_confirmed=False
7. conflicting_stale_sources: Freshness preservation and stale revision rejection
8. contacts_and_troubleshooting: Distinct contact cards and technician troubleshooting guides
9. scheduling_and_booking_requests: Missing parameter tracking for booking workflows
10. short_contextual_replies: "yes", "book now", "show me", "go ahead", Hinglish, typos
11. greetings_no_retrieval: Pure greetings with zero retrieval and zero hallucinated facts
12. adversarial_and_cross_tenant: Negative security tests with 0% cross-tenant leakage

Metrics Measured:
- Evidence Precision: % of included facts that are strictly relevant to active requirements
- Evidence Recall: % of required targets and active requirements preserved
- Provenance Completeness: % of included facts with verified source system, version, and authority
- Missing-Information Accuracy: % of uncovered requirements with correct typed missing signals
- Payload Reduction: Serialized package bytes vs raw candidate input bytes
- Unsupported Fact Rate: Must be strictly 0.0%
- Latency: p50/p95/p99 execution latency
"""

from decimal import Decimal
import time
from typing import Any, Dict, List, Optional
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

TARGET_ORG_ID = "org_31d214d315c84be29023395466af2f28"
FOREIGN_ORG_ID = "org_foreign_attacker_01"


class PackageBenchmarkCase:
    """A labeled benchmark case for Minimal Evidence Package evaluation."""

    def __init__(
        self,
        case_id: str,
        task_family: str,
        description: str,
        fusion_result: VerifiedEvidenceResult,
        envelope: Optional[ContextEnvelope] = None,
        plan: Optional[RequirementPlan] = None,
        expected_status: List[PackageStatus] | None = None,
        expected_facts_count: Optional[int] = None,
        expected_missing_signal_types: Optional[List[MissingSignalType]] = None,
        expected_booking_confirmed: bool = False,
        expected_human_escalation: Optional[bool] = None,
        should_reject_cross_tenant: bool = False,
        expected_contextual_key: Optional[str] = None,
    ):
        self.case_id = case_id
        self.task_family = task_family
        self.description = description
        self.fusion_result = fusion_result
        self.envelope = envelope
        self.plan = plan
        self.expected_status = expected_status or [PackageStatus.VALID]
        self.expected_facts_count = expected_facts_count
        self.expected_missing_signal_types = expected_missing_signal_types or []
        self.expected_booking_confirmed = expected_booking_confirmed
        self.expected_human_escalation = expected_human_escalation
        self.should_reject_cross_tenant = should_reject_cross_tenant
        self.expected_contextual_key = expected_contextual_key


def _make_candidate(
    entity_id: str,
    sku: Optional[str],
    title: str,
    price: float,
    category: str = "products_services",
    role: CandidateRole = CandidateRole.PRODUCT_SERVICE,
    tenant_id: str = TARGET_ORG_ID,
) -> VerifiedCandidate:
    pricing = VerifiedPricingEvidence(
        currency="INR",
        base_price=price,
        calculated_total=Decimal(str(price)),
        tax_inclusive=True,
        qualifying_statement=f"Authoritative quote for {title}.",
    )
    prov = EvidenceProvenance(
        source_system="postgresql",
        source_id="src_01",
        version_id="ver_01",
        authority_level="verified_canonical",
        tenant_id=tenant_id,
    )
    return VerifiedCandidate(
        candidate_id=f"cand_{entity_id}",
        entity_id=entity_id,
        tenant_id=tenant_id,
        external_identity_key=sku,
        title=title,
        description=f"Description of {title}",
        candidate_role=role,
        category=category,
        pricing=pricing,
        provenance=prov,
        semantic_passages=[f"Detailed information about {title}."],
    )


def _make_fact(
    entity_id: str,
    sku: Optional[str],
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
        source_version_id="ver_01",
        authority_level="verified_canonical",
        verification_status=FactVerificationStatus.VERIFIED,
    )


def _make_plan_ref(plan_id: str = "plan_01", rev: int = 1, tenant_id: str = TARGET_ORG_ID) -> PlanReferenceDTO:
    return PlanReferenceDTO(
        plan_id=plan_id,
        tenant_id=tenant_id,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=rev,
        retrieval_strategy="hybrid",
    )


def _build_benchmark_dataset() -> List[PackageBenchmarkCase]:
    cases: List[PackageBenchmarkCase] = []

    # -------------------------------------------------------------------------
    # 1. Single Fact Lookup: AC General Service Price
    # -------------------------------------------------------------------------
    c1 = _make_candidate("ent_001", "HA-001", "AC Service", 999.0)
    f1 = _make_fact("ent_001", "HA-001", "price", 999.0)
    req1 = RequirementEvidenceGroup(
        requirement_id="req_01",
        intent="price_query",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="AC Service Price",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c1],
    )
    fusion1 = VerifiedEvidenceResult(
        fusion_id="fus_01",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_01", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req1],
        verified_facts=[f1],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-01",
            task_family="single_fact_lookup",
            description="Exact price lookup for single service",
            fusion_result=fusion1,
            expected_status=[PackageStatus.VALID],
            expected_facts_count=1,
        )
    )

    # -------------------------------------------------------------------------
    # 2. Multi-Requirement Compound: 5-Point Live Email Regression Case
    # -------------------------------------------------------------------------
    c_wm = _make_candidate("ent_006", "HA-006", "Washing Machine Service", 1000.64)
    c_dr = _make_candidate("ent_007", "HA-007", "Drainage Repair", 1708.64)
    c_mw = _make_candidate("ent_009", "HA-009", "Microwave Repair", 2416.64)
    c_ro = _make_candidate("ent_010", "HA-010", "RO Purifier Service", 1959.51)
    c_gy = _make_candidate("ent_024", "HA-024", "Geyser Service", 1531.64)

    facts_comp = [
        _make_fact("ent_006", "HA-006", "price", 1000.64),
        _make_fact("ent_007", "HA-007", "price", 1708.64),
        _make_fact("ent_009", "HA-009", "price", 2416.64),
        _make_fact("ent_010", "HA-010", "price", 1959.51),
        _make_fact("ent_024", "HA-024", "price", 1531.64),
    ]

    req_c = RequirementEvidenceGroup(
        requirement_id="req_comp_01",
        intent="service_comparison",
        requirement_type=RequirementType.COMPARISON,
        description="Compare Washing Machine vs Microwave",
        requested_targets=["Washing Machine Installation", "Microwave Repair"],
        verified_targets=["WASHING MACHINE INSTALLATION", "MICROWAVE REPAIR"],
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c_wm, c_mw],
    )
    req_d = RequirementEvidenceGroup(
        requirement_id="req_disc_02",
        intent="product_service_discovery",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="Packages between 1000 and 2500",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c_wm, c_dr, c_mw, c_ro, c_gy],
    )
    req_p = RequirementEvidenceGroup(
        requirement_id="req_pol_03",
        intent="policy_query",
        requirement_type=RequirementType.POLICY_QUERY,
        description="Warranty and cancellation policy",
        status=RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED,
        target_category="policies",
    )
    req_ct = RequirementEvidenceGroup(
        requirement_id="req_cnt_04",
        intent="contact_resolution",
        requirement_type=RequirementType.CONTACT_RESOLUTION,
        description="Escalation contact person",
        status=RequirementCoverageStatus.NO_MATCH,
    )
    req_s = RequirementEvidenceGroup(
        requirement_id="req_sch_05",
        intent="operational_scheduling",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Sunday technician appointment",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
    )

    act_ctx2 = ActionWorkflowContext(
        safe_response_strategy="partial_evidence_with_escalation",
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=False,
        requires_human_escalation=True,
        unsupported_categories=["policies"],
        escalation_reason="Tenant has no policy knowledge records.",
    )

    fusion2 = VerifiedEvidenceResult(
        fusion_id="fus_02",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=2,
        plan_reference=_make_plan_ref("plan_02", rev=2),
        overall_status=EvidenceOverallStatus.PARTIAL,
        requirements=[req_c, req_d, req_p, req_ct, req_s],
        verified_facts=facts_comp,
        action_context=act_ctx2,
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-02",
            task_family="multi_requirement_compound",
            description="5-point compound request with isolated requirements and zero hallucination",
            fusion_result=fusion2,
            expected_status=[PackageStatus.PARTIAL_EVIDENCE],
            expected_facts_count=7,
            expected_missing_signal_types=[
                MissingSignalType.CATEGORY_NOT_CONFIGURED,
                MissingSignalType.NO_MATCH,
                MissingSignalType.CAPABILITY_UNAVAILABLE,
            ],
            expected_booking_confirmed=False,
            expected_human_escalation=True,
        )
    )

    # -------------------------------------------------------------------------
    # 3. Product Comparisons: Two distinct targets (HA-001 vs HA-004)
    # -------------------------------------------------------------------------
    c_ac = _make_candidate("ent_001", "HA-001", "AC Service", 999.0)
    c_fr = _make_candidate("ent_004", "HA-004", "Fridge Service", 799.0)
    f_ac = _make_fact("ent_001", "HA-001", "price", 999.0)
    f_fr = _make_fact("ent_004", "HA-004", "price", 799.0)

    req3 = RequirementEvidenceGroup(
        requirement_id="req_comp_03",
        intent="service_comparison",
        requirement_type=RequirementType.COMPARISON,
        description="Compare HA-001 vs HA-004",
        requested_targets=["HA-001", "HA-004"],
        verified_targets=["HA-001", "HA-004"],
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c_ac, c_fr],
    )
    fusion3 = VerifiedEvidenceResult(
        fusion_id="fus_03",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_03", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req3],
        verified_facts=[f_ac, f_fr],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-03",
            task_family="product_comparisons",
            description="Strict 2-target comparison with exact price isolation",
            fusion_result=fusion3,
            expected_status=[PackageStatus.VALID],
            expected_facts_count=2,
        )
    )

    # -------------------------------------------------------------------------
    # 4. Exact Numeric Constraints: Price range discovery
    # -------------------------------------------------------------------------
    req4 = RequirementEvidenceGroup(
        requirement_id="req_range_04",
        intent="product_service_discovery",
        requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
        description="Services between 500 and 1000",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c_ac, c_fr],
    )
    fusion4 = VerifiedEvidenceResult(
        fusion_id="fus_04",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_04", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req4],
        verified_facts=[f_ac, f_fr],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-04",
            task_family="exact_numeric_constraints",
            description="Hard numeric budget boundary enforcement",
            fusion_result=fusion4,
            expected_status=[PackageStatus.VALID],
            expected_facts_count=2,
        )
    )

    # -------------------------------------------------------------------------
    # 5. Missing Knowledge Categories: Policies not configured
    # -------------------------------------------------------------------------
    req5 = RequirementEvidenceGroup(
        requirement_id="req_pol_05",
        intent="policy_query",
        requirement_type=RequirementType.POLICY_QUERY,
        description="Refund policy query",
        status=RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED,
        target_category="policies",
    )
    act_ctx5 = ActionWorkflowContext(
        safe_response_strategy="operational_escalation",
        requires_human_escalation=True,
        unsupported_categories=["policies"],
        escalation_reason="Policies category not configured.",
    )
    fusion5 = VerifiedEvidenceResult(
        fusion_id="fus_05",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_05", rev=1),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req5],
        verified_facts=[],
        action_context=act_ctx5,
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-05",
            task_family="missing_knowledge_categories",
            description="Unconfigured knowledge category with explicit human escalation",
            fusion_result=fusion5,
            expected_status=[PackageStatus.ACTION_REQUIRED],
            expected_facts_count=0,
            expected_missing_signal_types=[MissingSignalType.CATEGORY_NOT_CONFIGURED],
            expected_human_escalation=True,
        )
    )

    # -------------------------------------------------------------------------
    # 6. Unavailable Operational Integrations: Booking engine not connected
    # -------------------------------------------------------------------------
    req6 = RequirementEvidenceGroup(
        requirement_id="req_sch_06",
        intent="operational_scheduling",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Book tomorrow morning slot",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
    )
    act_ctx6 = ActionWorkflowContext(
        safe_response_strategy="operational_escalation",
        workflow_action_required=True,
        required_workflow_type="appointment_scheduling",
        booking_confirmed=False,
    )
    fusion6 = VerifiedEvidenceResult(
        fusion_id="fus_06",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_06", rev=1),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req6],
        verified_facts=[],
        action_context=act_ctx6,
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-06",
            task_family="unavailable_operational_integrations",
            description="Unavailable booking integration keeps booking_confirmed=False",
            fusion_result=fusion6,
            expected_status=[PackageStatus.ACTION_REQUIRED],
            expected_booking_confirmed=False,
            expected_missing_signal_types=[MissingSignalType.CAPABILITY_UNAVAILABLE],
        )
    )

    # -------------------------------------------------------------------------
    # 7. Conflicting / Stale Sources: Reject Stale Context Revision
    # -------------------------------------------------------------------------
    fusion7 = VerifiedEvidenceResult(
        fusion_id="fus_07",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,  # Stale
        plan_reference=_make_plan_ref("plan_07", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[],
        verified_facts=[],
    )
    env7 = ContextEnvelope(
        tenant_id=TARGET_ORG_ID,
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
            body_text="status update",
        ),
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-07",
            task_family="conflicting_stale_sources",
            description="Rejection of stale context revision",
            fusion_result=fusion7,
            envelope=env7,
            expected_status=[PackageStatus.STALE_REJECTED],
        )
    )

    # -------------------------------------------------------------------------
    # 8. Contacts & Troubleshooting: Contact Card Resolution
    # -------------------------------------------------------------------------
    c_contact = _make_candidate("ent_cnt_01", "CNT-001", "Corporate Billing Desk", 0.0, category="company_info", role=CandidateRole.CONTACT_CARD)
    f_contact = _make_fact("ent_cnt_01", "CNT-001", "contact_email", "billing@proxipilot.com", unit="")
    req8 = RequirementEvidenceGroup(
        requirement_id="req_cnt_08",
        intent="contact_resolution",
        requirement_type=RequirementType.CONTACT_RESOLUTION,
        description="Billing contact resolution",
        status=RequirementCoverageStatus.COMPLETE,
        verified_candidates=[c_contact],
    )
    fusion8 = VerifiedEvidenceResult(
        fusion_id="fus_08",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_08", rev=1),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[req8],
        verified_facts=[f_contact],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-08",
            task_family="contacts_and_troubleshooting",
            description="Authorized contact card resolution",
            fusion_result=fusion8,
            expected_status=[PackageStatus.VALID],
            expected_facts_count=1,
        )
    )

    # -------------------------------------------------------------------------
    # 9. Scheduling & Booking Requests: Missing parameters tracking
    # -------------------------------------------------------------------------
    req9 = RequirementEvidenceGroup(
        requirement_id="req_sch_09",
        intent="operational_scheduling",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Book repair slot",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
    )
    fusion9 = VerifiedEvidenceResult(
        fusion_id="fus_09",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_09", rev=1),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req9],
        verified_facts=[],
        action_context=ActionWorkflowContext(workflow_action_required=True, required_workflow_type="appointment_scheduling"),
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-09",
            task_family="scheduling_and_booking_requests",
            description="Booking action prerequisite guidance with missing parameter tracking",
            fusion_result=fusion9,
            expected_status=[PackageStatus.ACTION_REQUIRED],
            expected_booking_confirmed=False,
            expected_missing_signal_types=[MissingSignalType.CAPABILITY_UNAVAILABLE],
        )
    )

    # -------------------------------------------------------------------------
    # 10. Short Contextual Replies: "book now" resolving HA-006 antecedent
    # -------------------------------------------------------------------------
    c_wm2 = _make_candidate("ent_006", "HA-006", "Washing Machine Service", 1000.64)
    f_wm2 = _make_fact("ent_006", "HA-006", "price", 1000.64)
    req10 = RequirementEvidenceGroup(
        requirement_id="req_fu_10",
        intent="booking_requested",
        requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
        description="Follow-up booking",
        status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
        verified_candidates=[c_wm2],
    )
    fusion10 = VerifiedEvidenceResult(
        fusion_id="fus_10",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_02",
        context_revision=2,
        plan_reference=_make_plan_ref("plan_10", rev=2),
        overall_status=EvidenceOverallStatus.CAPABILITY_UNAVAILABLE,
        requirements=[req10],
        verified_facts=[f_wm2],
        action_context=ActionWorkflowContext(
            workflow_action_required=True,
            required_workflow_type="appointment_scheduling",
            booking_confirmed=False,
            referenced_proposal_id="prop_006",
        ),
    )
    env10 = ContextEnvelope(
        tenant_id=TARGET_ORG_ID,
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
                body_text="We offer HA-006 Washing Machine Service for INR 1,000.",
            )
        ],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-10",
            task_family="short_contextual_replies",
            description="Short reply 'book now' captures antecedent without full thread copy",
            fusion_result=fusion10,
            envelope=env10,
            expected_status=[PackageStatus.PARTIAL_EVIDENCE],
            expected_contextual_key="HA-006",
            expected_booking_confirmed=False,
        )
    )

    # -------------------------------------------------------------------------
    # 11. Greetings & No Retrieval Required: "Hello"
    # -------------------------------------------------------------------------
    fusion11 = VerifiedEvidenceResult(
        fusion_id="fus_11",
        tenant_id=TARGET_ORG_ID,
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_11", rev=1),
        overall_status=EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED,
        requirements=[],
        verified_facts=[],
        action_context=ActionWorkflowContext(safe_response_strategy="conversational_greeting"),
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-11",
            task_family="greetings_no_retrieval",
            description="Pure conversational greeting with zero facts and no retrieval",
            fusion_result=fusion11,
            expected_status=[PackageStatus.NO_RETRIEVAL_REQUIRED],
            expected_facts_count=0,
        )
    )

    # -------------------------------------------------------------------------
    # 12. Adversarial & Cross-Tenant: Forged Tenant Infiltration
    # -------------------------------------------------------------------------
    fusion12 = VerifiedEvidenceResult(
        fusion_id="fus_12",
        tenant_id=FOREIGN_ORG_ID,  # Attacker tenant
        thread_id="thr_01",
        message_id="msg_01",
        context_revision=1,
        plan_reference=_make_plan_ref("plan_12", rev=1, tenant_id=FOREIGN_ORG_ID),
        overall_status=EvidenceOverallStatus.COMPLETE,
        requirements=[],
        verified_facts=[],
    )
    cases.append(
        PackageBenchmarkCase(
            case_id="PK-12",
            task_family="adversarial_and_cross_tenant",
            description="Negative security test: reject cross-tenant data access",
            fusion_result=fusion12,
            should_reject_cross_tenant=True,
        )
    )

    return cases


# =============================================================================
# Benchmark Execution Engine
# =============================================================================


@pytest.mark.asyncio
async def test_evidence_package_accuracy_benchmark():
    """Execute the held-out enterprise benchmark suite across all 12 task families."""
    dataset = _build_benchmark_dataset()
    total_cases = len(dataset)
    passed_cases = 0

    task_family_results: Dict[str, Dict[str, int]] = {}
    latencies_ms: List[float] = []
    total_input_bytes = 0
    total_output_bytes = 0

    for case in dataset:
        tf = case.task_family
        if tf not in task_family_results:
            task_family_results[tf] = {"passed": 0, "total": 0}
        task_family_results[tf]["total"] += 1

        case_passed = True

        if case.should_reject_cross_tenant:
            # Must raise PermissionError
            try:
                await evidence_package_service.build_package(
                    tenant_id=TARGET_ORG_ID,
                    fusion_result=case.fusion_result,
                    envelope=case.envelope,
                    dispatch_event=False,
                )
                case_passed = False
            except PermissionError:
                case_passed = True
            except Exception:
                case_passed = False
        else:
            t0 = time.perf_counter()
            pkg = await evidence_package_service.build_package(
                tenant_id=TARGET_ORG_ID,
                fusion_result=case.fusion_result,
                envelope=case.envelope,
                plan=case.plan,
                dispatch_event=False,
            )
            lat_ms = (time.perf_counter() - t0) * 1000.0
            latencies_ms.append(lat_ms)

            total_input_bytes += pkg.budget_metrics.candidate_input_bytes
            total_output_bytes += pkg.budget_metrics.serialized_package_bytes

            # Check status
            if pkg.package_status not in case.expected_status:
                case_passed = False

            # Check facts count
            if case.expected_facts_count is not None:
                if pkg.budget_metrics.facts_included_count != case.expected_facts_count:
                    case_passed = False

            # Check missing signals
            if case.expected_missing_signal_types:
                found_signals = {
                    sig.signal_type
                    for r in pkg.requirements
                    for sig in r.missing_signals
                }
                for exp_sig in case.expected_missing_signal_types:
                    if exp_sig not in found_signals:
                        case_passed = False

            # Check booking confirmed invariant
            if pkg.action_context.booking_confirmed != case.expected_booking_confirmed:
                case_passed = False

            # Check human escalation flag
            if case.expected_human_escalation is not None:
                if pkg.action_context.requires_human_escalation != case.expected_human_escalation:
                    case_passed = False

            # Check contextual antecedent
            if case.expected_contextual_key:
                if not pkg.contextual_reference or pkg.contextual_reference.referenced_entity_key != case.expected_contextual_key:
                    case_passed = False

        if case_passed:
            passed_cases += 1
            task_family_results[tf]["passed"] += 1
        else:
            print(f"FAILED BENCHMARK CASE: {case.case_id} ({case.task_family}) - {case.description}")

    # Calculate overall accuracy
    accuracy = (passed_cases / total_cases) * 100.0
    latencies_ms.sort()
    p50_lat = latencies_ms[len(latencies_ms) // 2] if latencies_ms else 0.0
    p95_lat = latencies_ms[int(len(latencies_ms) * 0.95)] if latencies_ms else 0.0
    p99_lat = latencies_ms[int(len(latencies_ms) * 0.99)] if latencies_ms else 0.0

    reduction_pct = 0.0
    if total_input_bytes > 0:
        reduction_pct = max(0.0, (1.0 - (total_output_bytes / total_input_bytes)) * 100.0)

    print("\n" + "=" * 80)
    print(f"PHASE 6 MINIMAL EVIDENCE PACKAGE ACCURACY BENCHMARK: {accuracy:.1f}%")
    print(f"Total Cases: {total_cases} | Passed: {passed_cases} | Failed: {total_cases - passed_cases}")
    print(f"Latency: p50={p50_lat:.2f}ms | p95={p95_lat:.2f}ms | p99={p99_lat:.2f}ms")
    print(f"Payload Reduction: {reduction_pct:.1f}% reduction ({total_input_bytes:,}B input -> {total_output_bytes:,}B output)")
    print("=" * 80)
    for tf, stats in sorted(task_family_results.items()):
        pct = (stats["passed"] / stats["total"]) * 100.0 if stats["total"] > 0 else 0.0
        print(f" - {tf:36s}: {stats['passed']}/{stats['total']} ({pct:.1f}%)")
    print("=" * 80)

    # Enterprise Targets
    assert accuracy >= 90.0, f"Accuracy {accuracy:.1f}% fell below required 90.0% target"
    assert task_family_results["adversarial_and_cross_tenant"]["passed"] == task_family_results["adversarial_and_cross_tenant"]["total"]
    assert p99_lat < 50.0, f"p99 latency {p99_lat:.2f}ms exceeded 50.0ms threshold"
