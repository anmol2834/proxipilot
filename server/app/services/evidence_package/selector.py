"""Evidence Selector — Phase 6: Minimal Evidence Package.

Selects strictly relevant, verified facts, source excerpts, and explicit
missing-information signals for each independent customer requirement.

Guiding Principles:
1. Bounded Inclusion: Only include facts that directly satisfy the requested
   attributes, constraints, or comparison targets of the specific requirement.
2. Provenance Preservation: Retains full authority level, source system, version,
   and verification status for every selected fact.
3. Explicit Missing Signals: Transforms uncovered targets, unconfigured categories,
   and unavailable operational capabilities into typed MissingInformationSignals.
4. Contextual Resolution: Compact antecedent tracking for short/dependent messages.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from app.contracts.evidence_fusion import (
    CandidateRole,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
    VerifiedEvidenceResult,
    VerifiedFact,
)
from app.contracts.evidence_package import (
    ContextualReference,
    EvidenceExcerpt,
    EvidenceFactType,
    FactTemporalStatus,
    MissingInformationSignal,
    MissingSignalType,
    PackagedFact,
    RequirementActionGuidance,
    RequirementEvidencePackage,
)
from app.contracts.requirement_plan import RequirementPlan
from app.contracts.retrieval_result import FactVerificationStatus
from app.core.logging import logger
from app.services.context_resolver import ContextEnvelope


class EvidenceSelector:
    """Selects and structures minimal, requirement-scoped evidence packages."""

    @classmethod
    def select_requirement_evidence(
        cls,
        group: RequirementEvidenceGroup,
        fusion_result: VerifiedEvidenceResult,
        plan: Optional[RequirementPlan] = None,
    ) -> RequirementEvidencePackage:
        """Construct a minimal, requirement-scoped evidence package for an individual requirement."""
        # 1. Determine origin of requirement (plan vs context reconstruction)
        origin = "validated_plan"
        if plan and plan.comparison.requested and group.requirement_type == RequirementType.COMPARISON:
            origin = "validated_plan"
        elif plan and plan.range_semantics and group.requirement_type == RequirementType.PRODUCT_SERVICE_DISCOVERY:
            origin = "validated_plan"
        elif group.requirement_type in (
            RequirementType.POLICY_QUERY,
            RequirementType.CONTACT_RESOLUTION,
            RequirementType.OPERATIONAL_SCHEDULING,
            RequirementType.CONTEXTUAL_FOLLOW_UP,
        ):
            origin = "context_reconstructed"
        else:
            origin = "hybrid"

        # 2. Extract strictly relevant PackagedFact items for this requirement
        selected_facts: List[PackagedFact] = []
        fact_dedup_keys: Set[str] = set()

        # Map candidate IDs and entity IDs that belong to this requirement group
        group_candidate_ids = {c.candidate_id for c in group.verified_candidates}
        group_entity_ids = {c.entity_id for c in group.verified_candidates}
        group_skus = {c.external_identity_key.upper().strip() for c in group.verified_candidates if c.external_identity_key}
        
        # Mapping from entity_id and SKU -> VerifiedCandidate for quick metadata lookup
        cand_map: Dict[str, VerifiedCandidate] = {c.entity_id: c for c in group.verified_candidates}
        for c in group.verified_candidates:
            if c.external_identity_key:
                cand_map[c.external_identity_key.upper().strip()] = c

        for vf in fusion_result.verified_facts:
            # Fact must belong to one of the verified candidates in this requirement group
            if vf.entity_id in group_entity_ids or (vf.external_identity_key and vf.external_identity_key.upper().strip() in group_skus):
                # Check attribute relevance
                attr_lower = vf.attribute_name.lower().strip()
                is_relevant_attr = True
                # Fit / suitability caveats qualify every item they belong to: always keep them,
                # otherwise the reply could present a near-match as an exact fit.
                if attr_lower == "fit_note":
                    pass
                elif group.required_attributes:
                    is_relevant_attr = any(
                        req_a.lower().strip() in attr_lower or attr_lower in req_a.lower().strip()
                        for req_a in group.required_attributes
                    )
                
                if is_relevant_attr:
                    cand = cand_map.get(vf.entity_id)
                    if not cand and vf.external_identity_key:
                        cand = cand_map.get(vf.external_identity_key.upper().strip())
                    fact_type = cls._infer_fact_type(attr_lower, vf.typed_value)
                        
                    packaged = PackagedFact(
                        fact_id=f"fct_{uuid.uuid4().hex[:10]}",
                        attribute_name=vf.attribute_name,
                        fact_type=fact_type,
                        typed_value=vf.typed_value,
                        currency_or_unit=vf.currency_or_unit,
                        entity_id=vf.entity_id,
                        external_identity_key=vf.external_identity_key or (cand.external_identity_key if cand else None),
                        entity_title=cand.title if cand else None,
                        source_system=vf.source_system,
                        source_version_id=vf.source_version_id,
                        authority_level=vf.authority_level,
                        authority_score=vf.authority_score,
                        verification_status=vf.verification_status,
                        temporal_status=FactTemporalStatus.CURRENT,
                        effective_from=vf.effective_from,
                        effective_until=vf.effective_until,
                        supports_requirement_id=group.requirement_id,
                        supports_attribute=vf.attribute_name,
                        is_authoritative=True,
                    )
                    selected_facts.append(packaged)

        # 3. Extract compact supporting excerpts (strictly <= 200 chars)
        supporting_excerpts: List[EvidenceExcerpt] = []
        for cand in group.verified_candidates:
            if cand.semantic_passages:
                # Include only the single best passage per candidate, strictly bounded
                best_passage = cand.semantic_passages[0].strip()
                if best_passage:
                    bounded_text = best_passage[:200]
                    if len(best_passage) > 200:
                        bounded_text += "..."
                    supporting_excerpts.append(
                        EvidenceExcerpt(
                            excerpt_id=f"exc_{uuid.uuid4().hex[:8]}",
                            entity_id=cand.entity_id,
                            source_system=cand.provenance.source_system,
                            version_id=cand.provenance.version_id,
                            text=bounded_text,
                            relevance_reason=f"Authoritative passage for {cand.title}",
                        )
                    )

        # 4. Generate explicit MissingInformationSignals
        missing_signals: List[MissingInformationSignal] = []

        if group.status == RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED:
            missing_signals.append(
                MissingInformationSignal(
                    signal_type=MissingSignalType.CATEGORY_NOT_CONFIGURED,
                    requirement_id=group.requirement_id,
                    target_field_or_entity=group.target_category or "policies",
                    reason=f"Tenant knowledge base has no configured records for category '{group.target_category or 'policies'}'. Direct factual assertion withheld to prevent hallucination.",
                    remediation_action="escalate_to_human",
                    requires_human_escalation=True,
                )
            )
        elif group.status == RequirementCoverageStatus.CAPABILITY_UNAVAILABLE:
            missing_signals.append(
                MissingInformationSignal(
                    signal_type=MissingSignalType.CAPABILITY_UNAVAILABLE,
                    requirement_id=group.requirement_id,
                    target_field_or_entity="operational_scheduling",
                    reason="Operational scheduling integration required to book slot is not connected.",
                    remediation_action="operational_manual_booking",
                    requires_human_escalation=True,
                )
            )
        elif group.status == RequirementCoverageStatus.NO_MATCH:
            target_str = ", ".join(group.requested_targets) if group.requested_targets else None
            missing_signals.append(
                MissingInformationSignal(
                    signal_type=MissingSignalType.NO_MATCH,
                    requirement_id=group.requirement_id,
                    target_field_or_entity=target_str,
                    reason="Zero records matched the required entities or constraints in tenant knowledge base.",
                    remediation_action="offer_catalog",
                    requires_human_escalation=False,
                )
            )
        elif group.status == RequirementCoverageStatus.NEEDS_CLARIFICATION:
            missing_signals.append(
                MissingInformationSignal(
                    signal_type=MissingSignalType.NEEDS_CLARIFICATION,
                    requirement_id=group.requirement_id,
                    reason="Customer request is ambiguous or missing required parameters.",
                    remediation_action="request_clarification",
                    requires_human_escalation=False,
                )
            )
        elif group.status == RequirementCoverageStatus.PARTIAL:
            # Emit signal for each missing target
            for mt in group.missing_targets:
                missing_signals.append(
                    MissingInformationSignal(
                        signal_type=MissingSignalType.NO_MATCH,
                        requirement_id=group.requirement_id,
                        target_field_or_entity=mt,
                        reason=f"Target entity '{mt}' requested in comparison was not found in tenant knowledge base.",
                        remediation_action="offer_catalog",
                    )
                )
            # Emit signal for missing attributes
            for ma in group.missing_attributes:
                missing_signals.append(
                    MissingInformationSignal(
                        signal_type=MissingSignalType.INSUFFICIENT_EVIDENCE,
                        requirement_id=group.requirement_id,
                        target_field_or_entity=ma,
                        reason=f"Attribute '{ma}' is not specified in authoritative knowledge records.",
                    )
                )

        # 5. Requirement-scoped Action Guidance
        action_guidance: Optional[RequirementActionGuidance] = None
        if group.requirement_type == RequirementType.OPERATIONAL_SCHEDULING:
            action_guidance = RequirementActionGuidance(
                workflow_type="appointment_scheduling",
                action_prerequisites_met=False,
                missing_parameters=["technician_availability_check", "customer_phone_number"],
                requires_confirmation=True,
                human_review_required=True,
            )
        elif group.status == RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED:
            action_guidance = RequirementActionGuidance(
                workflow_type="human_escalation",
                action_prerequisites_met=False,
                missing_parameters=[f"tenant_category_policy:{group.target_category}"],
                requires_confirmation=False,
                human_review_required=True,
            )

        return RequirementEvidencePackage(
            requirement_id=group.requirement_id,
            requirement_type=group.requirement_type,
            intent=group.intent,
            description=group.description,
            origin=origin,
            target_entities=list(group.requested_targets),
            verified_targets=list(group.verified_targets),
            missing_targets=list(group.missing_targets),
            coverage_status=group.status,
            facts=selected_facts,
            supporting_excerpts=supporting_excerpts,
            missing_signals=missing_signals,
            satisfied_constraints=list(group.satisfied_constraints),
            unmet_constraints=list(group.unmet_constraints),
            action_guidance=action_guidance,
        )

    @classmethod
    def resolve_contextual_reference(
        cls,
        envelope: Optional[ContextEnvelope],
        fusion_result: VerifiedEvidenceResult,
    ) -> Optional[ContextualReference]:
        """Extract compact antecedent reference for short or context-dependent messages."""
        if not envelope or not envelope.current_message:
            return None

        body = (envelope.current_message.body_text or "").strip().lower()
        
        # Check if the message is a short conversational reply
        short_patterns = [
            r"^(?:yes|yep|yeah|ok|okay|sure|agree|proceed|go\s+ahead|correct)\b",
            r"^(?:book\s+now|schedule\s+now|book\s+it|confirm|reserve)\b",
            r"^(?:show\s+me|tell\s+me|give\s+me|explain)\b",
            r"^(?:ha|haan|theek\s+hai|kardo|chalega|kar\s+do)\b",
            r"^(?:hello|hi|hey|good\s+morning|good\s+afternoon)\b",
        ]

        is_short_reply = len(body.split()) <= 8 or any(re.search(pat, body) for pat in short_patterns)
        if not is_short_reply:
            return None

        # Look for antecedent in unresolved requirements or previous message
        ref_entity_id: Optional[str] = None
        ref_entity_key: Optional[str] = None
        ref_proposal_id: Optional[str] = fusion_result.action_context.referenced_proposal_id
        pending_question: Optional[str] = None
        antecedent_text: Optional[str] = None
        missing_params: List[str] = []

        if envelope.unresolved_requirements:
            latest_req = envelope.unresolved_requirements[-1]
            pending_question = latest_req.description

        if envelope.relevant_previous_messages:
            prev_msg = envelope.relevant_previous_messages[-1]
            antecedent_text = (prev_msg.body_text or "").strip()[:150]
            
            # Check for SKU pattern in antecedent
            sku_match = re.search(r"\b([A-Z]{2,3}-\d{3,4})\b", antecedent_text)
            if sku_match:
                ref_entity_key = sku_match.group(1)

        # Detect booking parameters needed
        if any(w in body for w in ("book", "schedule", "reserve", "kardo")):
            missing_params = ["preferred_slot", "service_address", "phone_number"]

        return ContextualReference(
            antecedent_text=antecedent_text,
            referenced_entity_id=ref_entity_id,
            referenced_entity_key=ref_entity_key,
            referenced_proposal_id=ref_proposal_id,
            pending_question=pending_question,
            is_ambiguous=False,
            missing_parameters=missing_params,
        )

    @classmethod
    def _infer_fact_type(cls, attr_name: str, value: Any) -> EvidenceFactType:
        """Infer the specialized enterprise fact type from attribute name and value."""
        if any(k in attr_name for k in ("price", "charge", "rate", "cost", "tax", "fee", "amount")):
            return EvidenceFactType.STRUCTURED_NUMERIC
        if any(k in attr_name for k in ("email", "phone", "contact", "person", "representative")):
            return EvidenceFactType.CONTACT_IDENTITY
        if any(k in attr_name for k in ("date", "time", "window", "slot", "schedule", "duration")):
            return EvidenceFactType.TEMPORAL_WINDOW
        if any(k in attr_name for k in ("status", "active", "availability", "capability")):
            return EvidenceFactType.OPERATIONAL_STATUS
        if any(k in attr_name for k in ("policy", "rule", "term", "condition", "cancellation", "refund")):
            return EvidenceFactType.POLICY_RULE
        return EvidenceFactType.STRUCTURED_TEXT
