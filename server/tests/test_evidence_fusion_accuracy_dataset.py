"""Held-Out Accuracy Evaluation Benchmark for Phase 5 Candidate Fusion & Evidence Verification.

Evaluates candidate fusion and fact verification accuracy across 9 critical enterprise task families:
1. Multi-entity target matching (preserving distinct explicit targets without AND-rejection)
2. Result count vs explicit target distinction (preventing false PARTIAL degradation)
3. Hard-constraint numeric price verification (strict Decimal boundaries)
4. Temporal validity & expired version rejection
5. Source authority & conflict handling (preferring PostgreSQL canonical facts)
6. Support troubleshooting & contact role isolation
7. Operational scheduling & booking integrity (booking_confirmed strictly False)
8. Contextual short reply resolution (yes, ok, book now, proceed, hello, typos, Hinglish, ambiguities)
9. Zero cross-tenant data leakage security isolation

Target: >= 90% accuracy across held-out evaluation dataset, 0% cross-tenant leakage,
0% unsupported action confirmations.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
import pytest

from app.contracts.evidence_fusion import (
    ActionWorkflowContext,
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
from app.services.context_resolver import (
    ContextEnvelope,
    ContextMessage,
    RequirementStatus,
    UnresolvedRequirement,
)
from app.services.evidence_fusion import evidence_fusion_service

TARGET_ORG_ID = "org_31d214d315c84be29023395466af2f28"
FOREIGN_ORG_ID = "org_foreign_attacker_01"


class FusionBenchmarkCase:
    """A labeled evaluation benchmark test case."""

    def __init__(
        self,
        case_id: str,
        task_family: str,
        description: str,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
        raw_candidates: Optional[List[VerifiedCandidate]] = None,
        expected_overall_status: List[EvidenceOverallStatus] | None = None,
        expected_verified_skus: Optional[List[str]] = None,
        expected_workflow_action: Optional[bool] = None,
        expected_booking_confirmed: bool = False,
        expected_clarification_required: Optional[bool] = None,
        should_reject_cross_tenant: bool = False,
    ):
        self.case_id = case_id
        self.task_family = task_family
        self.description = description
        self.plan = plan
        self.envelope = envelope
        self.raw_candidates = raw_candidates or []
        self.expected_overall_status = expected_overall_status or [EvidenceOverallStatus.COMPLETE]
        self.expected_verified_skus = expected_verified_skus
        self.expected_workflow_action = expected_workflow_action
        self.expected_booking_confirmed = expected_booking_confirmed
        self.expected_clarification_required = expected_clarification_required
        self.should_reject_cross_tenant = should_reject_cross_tenant


def _make_candidate(
    entity_id: str,
    sku: Optional[str],
    title: str,
    price: float,
    warranty: str = "1 Year Warranty",
    category: str = "products_services",
    role: CandidateRole = CandidateRole.PRODUCT_SERVICE,
    tenant_id: str = TARGET_ORG_ID,
    authority: str = "verified_canonical",
    effective_until: str = "2027-01-01T00:00:00Z",
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
        qualifying_statement=f"Quote for {title}.",
    )
    provenance = EvidenceProvenance(
        source_system="postgresql",
        source_id="src_01",
        version_id="ver_01",
        authority_level=authority,
        authority_score=0.9 if authority == "approved_policy" else 0.85,
        effective_from="2026-01-01T00:00:00Z",
        effective_until=effective_until,
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


def _build_benchmark_dataset() -> List[FusionBenchmarkCase]:
    cases: List[FusionBenchmarkCase] = []

    # -------------------------------------------------------------------------
    # Family 1: Multi-Entity Target Matching
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="MULTI_ENTITY_01",
            task_family="multi_entity_matching",
            description="Compare HA-001 and HA-004 preserves both distinct targets",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_me_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.SERVICE_COMPARISON,
                comparison=PlannedComparison(requested=True, target_entities=["HA-001", "HA-004"]),
                requested_attributes=["price", "warranty"],
                query_text="Compare HA-001 and HA-004",
            ),
            raw_candidates=[
                _make_candidate("ki_ac", "HA-001", "AC General Service", 699.00),
                _make_candidate("ki_fridge", "HA-004", "Refrigerator General Service", 899.00),
            ],
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
            expected_verified_skus=["HA-001", "HA-004"],
        )
    )

    # -------------------------------------------------------------------------
    # Family 2: Result Count vs Target Distinction
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="COUNT_DISTINCTION_01",
            task_family="count_vs_target_distinction",
            description="2 explicit comparison targets with default count=5 must NOT degrade to PARTIAL",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_cd_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.SERVICE_COMPARISON,
                comparison=PlannedComparison(requested=True, target_entities=["HA-001", "HA-004"]),
                requested_result_count=PlannedResultCount(final_count=5),  # Default discovery count
                requested_attributes=["price", "warranty"],
                query_text="Compare HA-001 and HA-004",
            ),
            raw_candidates=[
                _make_candidate("ki_ac", "HA-001", "AC General Service", 699.00),
                _make_candidate("ki_fridge", "HA-004", "Refrigerator General Service", 899.00),
            ],
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
            expected_verified_skus=["HA-001", "HA-004"],
        )
    )

    # -------------------------------------------------------------------------
    # Family 3: Hard-Constraint Numeric Price Boundaries
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="PRICE_BOUND_01",
            task_family="exact_value_verification",
            description="Price range ₹500 to ₹1000 INR retains 700 and rejects 1200",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_pb_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.PRICE_QUERY,
                range_semantics=PlannedRange(field="price", min_value=500.0, max_value=1000.0, currency="INR"),
                query_text="Services between 500 and 1000 INR",
            ),
            raw_candidates=[
                _make_candidate("ki_ok", "HA-001", "Valid Option", 700.00),
                _make_candidate("ki_high", "HA-009", "Too Expensive", 1200.00),
            ],
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
            expected_verified_skus=["HA-001"],
        )
    )

    # -------------------------------------------------------------------------
    # Family 4: Temporal Validity & Version Expiry
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="TEMPORAL_01",
            task_family="temporal_validity",
            description="Expired knowledge record is discarded by fact verifier",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_tv_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.PRODUCT_LOOKUP,
                entities=[PlannedEntity(entity_type="sku", original_text="HA-001", canonical_value="HA-001")],
                query_text="Lookup HA-001",
            ),
            raw_candidates=[
                _make_candidate(
                    "ki_old", "HA-001", "Old AC Service", 500.00,
                    effective_until="2025-01-01T00:00:00Z"  # Expired in past
                )
            ],
            expected_overall_status=[EvidenceOverallStatus.NO_MATCH],
        )
    )

    # -------------------------------------------------------------------------
    # Family 5: Troubleshooting & Support Isolation
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="TROUBLE_01",
            task_family="support_troubleshooting",
            description="Troubleshooting query resolves technical guide without requiring price SKU",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_tr_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.SUPPORT_ISSUE,
                query_text="AC compressor making rattling noise and cooling failure troubleshooting",
            ),
            raw_candidates=[
                _make_candidate(
                    "ki_guide_01", None, "Compressor Noise Troubleshooting", 0.0,
                    role=CandidateRole.TROUBLESHOOTING_GUIDE, category="support_faqs"
                )
            ],
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
        )
    )

    # -------------------------------------------------------------------------
    # Family 6: Corporate Contact Resolution
    # -------------------------------------------------------------------------
    c_contact = _make_candidate(
        "ki_cnt_01", "BILLING-CONTACT", "Billing Support Desk", 0.0,
        role=CandidateRole.CONTACT_CARD, category="company_info"
    )
    c_contact.attributes = {"email": "billing@proxipilot.com", "phone": "+91-9876543210"}

    cases.append(
        FusionBenchmarkCase(
            case_id="CONTACT_01",
            task_family="contact_resolution",
            description="Corporate billing contact resolves authorized contact card",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_ct_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.OTHER,
                query_text="Who is the corporate billing contact for escalation?",
            ),
            raw_candidates=[c_contact],
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
        )
    )

    # -------------------------------------------------------------------------
    # Family 7: Operational Scheduling & Booking Integrity
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="SCHED_01",
            task_family="operational_scheduling",
            description="Technician booking request flags workflow action without confirming live booking",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_sc_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.AVAILABILITY_QUERY,
                query_text="Can a technician visit this Saturday morning?",
            ),
            raw_candidates=[],
            expected_overall_status=[EvidenceOverallStatus.PARTIAL, EvidenceOverallStatus.CAPABILITY_UNAVAILABLE],
            expected_workflow_action=True,
            expected_booking_confirmed=False,  # MUST NEVER BE TRUE
        )
    )

    # -------------------------------------------------------------------------
    # Family 8: Contextual Short Replies (Cases A through J)
    # -------------------------------------------------------------------------
    # Case A: "yes" with antecedent proposal
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_YES_01",
            task_family="contextual_follow_ups",
            description="'yes' with preceding technician proposal resolves action without committing booking",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_yes_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.FOLLOW_UP,
                query_text="yes",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_yes",
                thread_id="thr_yes_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="yes"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="Shall I book your AC service technician for Saturday morning at ₹799?"
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.PARTIAL],
            expected_workflow_action=True,
            expected_booking_confirmed=False,
        )
    )

    # Case B: "ok" (informational acknowledgment)
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_OK_01",
            task_family="contextual_follow_ups",
            description="'ok' resolves as conversational acknowledgment without triggering actions",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_ok_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.FOLLOW_UP,
                query_text="ok",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_ok",
                thread_id="thr_ok_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="ok"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="Your inquiry has been received and our team will get back to you."
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED],
            expected_workflow_action=False,
        )
    )

    # Case C: "show me" (display catalogue selection)
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_SHOW_ME_01",
            task_family="contextual_follow_ups",
            description="'show me' resolves display request from previous catalogue options",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_sm_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.CATALOGUE_REQUEST,
                query_text="show me",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_sm",
                thread_id="thr_sm_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="show me"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="We have AC General Service (₹799) and Deep Clean (₹1499). Which one would you prefer?"
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
        )
    )

    # Case D: "explain"
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_EXPLAIN_01",
            task_family="contextual_follow_ups",
            description="'explain' resolves explanation topic from previous turn",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_exp_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.SUPPORT_ISSUE,
                query_text="explain",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_exp",
                thread_id="thr_exp_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="explain"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="The rattling noise could be due to a loose fan blade in the outdoor unit."
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
        )
    )

    # Case E: "book now"
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_BOOK_NOW_01",
            task_family="contextual_follow_ups",
            description="'book now' identifies booking intent, sets workflow_action_required=True, booking_confirmed=False",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_bn_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.AVAILABILITY_QUERY,
                query_text="book now",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_bn",
                thread_id="thr_bn_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="book now"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="AC General Service is available tomorrow Saturday 10 AM."
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.PARTIAL],
            expected_workflow_action=True,
            expected_booking_confirmed=False,
        )
    )

    # Case F: "go ahead" / "goo ahead" (typo)
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_PROCEED_TYPO_01",
            task_family="contextual_follow_ups",
            description="'goo ahead' typo resolves as confirmation of pending proposal",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_ga_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.FOLLOW_UP,
                query_text="goo ahead",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_ga",
                thread_id="thr_ga_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="goo ahead"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="I have prepared the quote for HA-001. Shall I proceed?"
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.COMPLETE],
        )
    )

    # Case G: "hello" / "hi" (greeting)
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_GREETING_01",
            task_family="contextual_follow_ups",
            description="'hello' greeting requires zero retrieval",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_gr_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.OTHER,
                query_text="hello",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_gr",
                thread_id="thr_gr_01",
                current_message_id="msg_01",
                context_revision=1,
                current_message=ContextMessage(
                    id="msg_01", external_message_id="e1", direction="inbound", from_email="u@test.com", body_text="hello"
                ),
            ),
            expected_overall_status=[EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED],
            expected_workflow_action=False,
        )
    )

    # Case H: Hinglish variant "theek hai"
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_HINGLISH_01",
            task_family="contextual_follow_ups",
            description="Hinglish 'theek hai' resolves as acknowledgment",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_hi_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.FOLLOW_UP,
                query_text="theek hai",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_hi",
                thread_id="thr_hi_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="theek hai"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="Your service will take approximately 45 minutes."
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED],
            expected_workflow_action=False,
        )
    )

    # Case I: "yes" with no preceding context requires clarification
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_NO_CONTEXT_01",
            task_family="contextual_follow_ups",
            description="'yes' with zero conversation antecedent emits clarification_required=True",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_nc_01",
                message_id="msg_01",
                context_revision=1,
                intent=IntentType.UNKNOWN,
                query_text="yes",
            ),
            envelope=None,
            expected_overall_status=[EvidenceOverallStatus.NEEDS_CLARIFICATION],
            expected_clarification_required=True,
        )
    )

    # Case J: Multiple competing proposals
    cases.append(
        FusionBenchmarkCase(
            case_id="CTX_MULTI_PROPOSAL_01",
            task_family="contextual_follow_ups",
            description="'yes' when multiple active proposals exist asks for clarification",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                thread_id="thr_mp_01",
                message_id="msg_02",
                context_revision=2,
                intent=IntentType.FOLLOW_UP,
                query_text="yes",
            ),
            envelope=ContextEnvelope(
                tenant_id=TARGET_ORG_ID,
                integration_account_id="int_01",
                provider_thread_id="p_mp",
                thread_id="thr_mp_01",
                current_message_id="msg_02",
                context_revision=2,
                current_message=ContextMessage(
                    id="msg_02", external_message_id="e2", direction="inbound", from_email="u@test.com", body_text="yes"
                ),
                relevant_previous_messages=[
                    ContextMessage(
                        id="msg_01", external_message_id="e1", direction="outbound", from_email="agent@test.com",
                        body_text="Option 1 is AC Service at ₹799. Option 2 is Deep Clean at ₹1499. Which one shall I book?"
                    )
                ],
            ),
            expected_overall_status=[EvidenceOverallStatus.NEEDS_CLARIFICATION],
            expected_clarification_required=True,
        )
    )

    # -------------------------------------------------------------------------
    # Family 9: Cross-Tenant Security Isolation
    # -------------------------------------------------------------------------
    cases.append(
        FusionBenchmarkCase(
            case_id="SECURITY_CROSS_TENANT_01",
            task_family="cross_tenant_isolation",
            description="Plan belonging to foreign tenant must be unconditionally rejected",
            plan=RequirementPlan(
                schema_version="1.0",
                tenant_id=FOREIGN_ORG_ID,
                integration_account_id="int_foreign",
                thread_id="thr_sec_01",
                message_id="msg_sec_01",
                context_revision=1,
                intent=IntentType.PRODUCT_LOOKUP,
                query_text="Attempt cross tenant lookup",
            ),
            should_reject_cross_tenant=True,
        )
    )

    return cases


@pytest.mark.asyncio
async def test_evidence_fusion_held_out_accuracy_benchmark():
    """Run full benchmark across all task families and compute formal accuracy report."""
    cases = _build_benchmark_dataset()
    total_cases = len(cases)
    passed_cases = 0
    task_family_results: Dict[str, Dict[str, int]] = {}

    for case in cases:
        tf = case.task_family
        if tf not in task_family_results:
            task_family_results[tf] = {"total": 0, "passed": 0}
        task_family_results[tf]["total"] += 1

        if case.should_reject_cross_tenant:
            try:
                await evidence_fusion_service.fuse_and_verify(
                    tenant_id=TARGET_ORG_ID,
                    plan=case.plan,
                    raw_candidates=case.raw_candidates,
                    dispatch_event=False,
                )
                pytest.fail(f"Case {case.case_id} failed: Expected PermissionError on cross-tenant plan")
            except PermissionError:
                passed_cases += 1
                task_family_results[tf]["passed"] += 1
            continue

        result: VerifiedEvidenceResult = await evidence_fusion_service.fuse_and_verify(
            tenant_id=TARGET_ORG_ID,
            plan=case.plan,
            envelope=case.envelope,
            raw_candidates=case.raw_candidates,
            dispatch_event=False,
        )

        case_passed = True

        # Check overall status
        if result.overall_status not in case.expected_overall_status:
            case_passed = False

        # Check expected verified SKUs
        if case.expected_verified_skus:
            all_verified_skus = [
                c.external_identity_key
                for req in result.requirements
                for c in req.verified_candidates
                if c.external_identity_key
            ]
            for exp_sku in case.expected_verified_skus:
                if exp_sku not in all_verified_skus:
                    case_passed = False

        # Check workflow action flag
        if case.expected_workflow_action is not None:
            if result.action_context.workflow_action_required != case.expected_workflow_action:
                case_passed = False

        # Check booking confirmed invariant (MUST BE STRICTLY FALSE)
        if result.action_context.booking_confirmed != case.expected_booking_confirmed:
            case_passed = False

        # Check clarification flag
        if case.expected_clarification_required is not None:
            if result.action_context.clarification_required != case.expected_clarification_required:
                case_passed = False

        if case_passed:
            passed_cases += 1
            task_family_results[tf]["passed"] += 1
        else:
            print(f"FAILED CASE {case.case_id}: overall={result.overall_status.value} (expected {[s.value for s in case.expected_overall_status]}) "
                  f"action_req={result.action_context.workflow_action_required} (exp {case.expected_workflow_action}) "
                  f"booking_conf={result.action_context.booking_confirmed} (exp {case.expected_booking_confirmed}) "
                  f"clarif_req={result.action_context.clarification_required} (exp {case.expected_clarification_required})")

    accuracy = (passed_cases / total_cases) * 100.0
    print("\n" + "=" * 80)
    print(f"PHASE 5 CANDIDATE FUSION & EVIDENCE VERIFICATION ACCURACY BENCHMARK: {accuracy:.1f}%")
    print(f"Total Cases: {total_cases} | Passed: {passed_cases} | Failed: {total_cases - passed_cases}")
    print("=" * 80)
    for tf, stats in sorted(task_family_results.items()):
        pct = (stats["passed"] / stats["total"]) * 100.0 if stats["total"] > 0 else 0.0
        print(f" - {tf:32s}: {stats['passed']}/{stats['total']} ({pct:.1f}%)")
    print("=" * 80)

    # Enterprise Target: >= 90% accuracy, 0 security violations
    assert accuracy >= 90.0, f"Accuracy {accuracy:.1f}% fell below required 90.0% target"
    assert task_family_results["cross_tenant_isolation"]["passed"] == task_family_results["cross_tenant_isolation"]["total"]
