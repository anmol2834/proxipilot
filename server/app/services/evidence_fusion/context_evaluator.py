"""Contextual Reply Evaluator — Phase 5: Candidate Fusion & Evidence Verification.

Resolves short contextual replies ("yes", "ok", "give me", "explain", "book now",
"proceed", "hello", "hi", typos, and Hinglish) against preceding conversation
history and pending proposals without making unsupported transactional assertions.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.contracts.evidence_fusion import (
    ActionWorkflowContext,
    CandidateRole,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
)
from app.contracts.retrieval_result import EvidenceProvenance, FactVerificationStatus
from app.core.logging import logger
from app.services.context_resolver import (
    ContextEnvelope,
    ContextMessage,
    RequirementStatus,
    UnresolvedRequirement,
)


class ContextualReplyEvaluator:
    """Evaluates short contextual messages in the light of conversational antecedents."""

    # Normalization dictionary for common colloquial/informal expressions
    _AFFIRMATIVE_UTTERANCES = {
        "yes", "yeah", "yep", "sure", "proceed", "go ahead", "goo ahead",
        "please proceed", "ha", "haan", "bhejo", "kar do", "approved", "confirm",
    }
    _ACKNOWLEDGMENT_UTTERANCES = {
        "ok", "okay", "k", "got it", "noted", "understood", "theek hai", "fine",
    }
    _DEMAND_UTTERANCES = {
        "give me", "show me", "send me", "share with me", "provide", "bhejo",
    }
    _EXPLANATION_UTTERANCES = {
        "explain", "explain me", "tell me more", "how does it work", "details", "samjhao",
    }
    _BOOKING_UTTERANCES = {
        "book now", "schedule now", "book it", "schedule it", "confirm booking", "book appointment",
    }
    _GREETING_UTTERANCES = {
        "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "namaste",
    }

    @classmethod
    def evaluate_short_reply(
        cls,
        message_text: str,
        envelope: Optional[ContextEnvelope],
    ) -> Tuple[ActionWorkflowContext, Optional[RequirementEvidenceGroup], Optional[EvidenceOverallStatus]]:
        """Evaluate an utterance for contextual references against conversation state.
        
        Returns:
            Tuple of:
            - ActionWorkflowContext
            - Optional[RequirementEvidenceGroup]
            - Optional[EvidenceOverallStatus]
        """
        clean_text = message_text.lower().strip().rstrip(".!?")
        
        # 1. Greetings
        if clean_text in cls._GREETING_UTTERANCES:
            action_ctx = ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=False,
                contextual_intent="greeting",
                safe_response_strategy="conversational_greeting",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_greeting",
                intent="greeting",
                requirement_type=RequirementType.CONVERSATIONAL_GREETING,
                description=f"Conversational greeting: '{clean_text}'",
                requested_targets=[],
                requested_count=0,
                status=RequirementCoverageStatus.NO_RETRIEVAL_REQUIRED,
            )
            return action_ctx, group, EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED

        # Extract previous assistant message and open requirements
        prev_messages = envelope.relevant_previous_messages if envelope else []
        last_assistant_msg: Optional[ContextMessage] = None
        for m in reversed(prev_messages):
            if m.direction == "outbound" or "assistant" in m.direction.lower():
                last_assistant_msg = m
                break

        unresolved_reqs = envelope.unresolved_requirements if envelope else []
        open_reqs = [r for r in unresolved_reqs if r.status == RequirementStatus.OPEN]

        # 2. Case: No useful preceding context at all
        if not last_assistant_msg and not open_reqs:
            if clean_text in cls._AFFIRMATIVE_UTTERANCES or clean_text in cls._ACKNOWLEDGMENT_UTTERANCES or clean_text in cls._DEMAND_UTTERANCES or clean_text in cls._BOOKING_UTTERANCES:
                action_ctx = ActionWorkflowContext(
                    workflow_action_required=False,
                    booking_confirmed=False,
                    clarification_required=True,
                    clarification_reason=f"Received contextual expression '{clean_text}' without active preceding proposal or conversation context.",
                    contextual_intent="ambiguous_antecedent",
                    safe_response_strategy="clarification_prompt",
                )
                group = RequirementEvidenceGroup(
                    requirement_id="req_contextual_ambiguous",
                    intent="follow_up",
                    requirement_type=RequirementType.CONTEXTUAL_FOLLOW_UP,
                    description=f"Contextual expression '{clean_text}' without prior proposal",
                    status=RequirementCoverageStatus.NEEDS_CLARIFICATION,
                    missing_evidence_reasons=["Missing conversation antecedent"],
                )
                return action_ctx, group, EvidenceOverallStatus.NEEDS_CLARIFICATION

        # 3. Case: Multiple conflicting open proposals
        proposal_count = 0
        assistant_body = last_assistant_msg.body_text.lower() if last_assistant_msg else ""
        if "option 1" in assistant_body and "option 2" in assistant_body:
            proposal_count += 2
        elif len(open_reqs) > 1:
            proposal_count = len(open_reqs)

        if proposal_count > 1 and clean_text in cls._AFFIRMATIVE_UTTERANCES:
            # Ambiguous: user said "yes" or "proceed" when multiple proposals exist
            action_ctx = ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=True,
                clarification_reason=f"Utterance '{clean_text}' is ambiguous across multiple pending options.",
                contextual_intent="multiple_proposals_ambiguity",
                safe_response_strategy="clarification_prompt",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_contextual_multi_proposal",
                intent="follow_up",
                requirement_type=RequirementType.CONTEXTUAL_FOLLOW_UP,
                description=f"Affirmative reply '{clean_text}' with multiple pending proposals",
                status=RequirementCoverageStatus.NEEDS_CLARIFICATION,
                missing_evidence_reasons=["Ambiguous target proposal: multiple open options in thread"],
            )
            return action_ctx, group, EvidenceOverallStatus.NEEDS_CLARIFICATION

        # 4. Booking Expressions ("book now", "schedule now")
        if clean_text in cls._BOOKING_UTTERANCES or "book" in clean_text:
            # Resolves booking intention against previous message
            service_ref = "Service from previous turn"
            if last_assistant_msg:
                # Look for service mention in last assistant message
                if "ac general service" in assistant_body or "ha-001" in assistant_body:
                    service_ref = "AC General Service (HA-001)"
                elif "refrigerator" in assistant_body or "ha-004" in assistant_body:
                    service_ref = "Refrigerator General Service (HA-004)"

            action_ctx = ActionWorkflowContext(
                workflow_action_required=True,
                required_workflow_type="appointment_scheduling",
                booking_confirmed=False,  # CRITICAL INVARIANT: NEVER TRUE IN FUSION STAGE
                clarification_required=False,
                contextual_intent="booking_requested",
                referenced_proposal_id=last_assistant_msg.id if last_assistant_msg else None,
                safe_response_strategy="operational_escalation",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_booking_contextual",
                intent="operational_scheduling",
                requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
                description=f"Booking requested for {service_ref} from previous turn",
                requested_targets=[service_ref],
                requested_count=1,
                status=RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,  # Operational scheduler integration required
                missing_evidence_reasons=["Live scheduling engine required to commit slot"],
                warnings=["Candidate fusion establishes intent; transactional slot confirmation deferred to operational action stage."],
            )
            return action_ctx, group, EvidenceOverallStatus.PARTIAL

        # 5. Affirmative Confirmation ("yes", "proceed", "go ahead", "goo ahead", "ha")
        if clean_text in cls._AFFIRMATIVE_UTTERANCES:
            # User is accepting the single pending proposal in the previous assistant message
            is_booking_proposal = any(w in assistant_body for w in ("book", "appointment", "schedule", "technician", "visit", "slot"))
            
            action_ctx = ActionWorkflowContext(
                workflow_action_required=is_booking_proposal,
                required_workflow_type="appointment_scheduling" if is_booking_proposal else None,
                booking_confirmed=False,  # CRITICAL INVARIANT: strictly False
                clarification_required=False,
                contextual_intent="proposal_accepted",
                referenced_proposal_id=last_assistant_msg.id if last_assistant_msg else None,
                safe_response_strategy="operational_escalation" if is_booking_proposal else "evidence_supported_response",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_proposal_accepted",
                intent="follow_up",
                requirement_type=RequirementType.CONTEXTUAL_FOLLOW_UP,
                description=f"Customer accepted proposal from message {last_assistant_msg.id if last_assistant_msg else 'thread'}",
                status=RequirementCoverageStatus.COMPLETE if not is_booking_proposal else RequirementCoverageStatus.CAPABILITY_UNAVAILABLE,
                evidence_references=[last_assistant_msg.id] if last_assistant_msg else [],
            )
            overall = EvidenceOverallStatus.COMPLETE if not is_booking_proposal else EvidenceOverallStatus.PARTIAL
            return action_ctx, group, overall

        # 6. Neutral Acknowledgment ("ok", "theek hai", "noted")
        if clean_text in cls._ACKNOWLEDGMENT_UTTERANCES:
            action_ctx = ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=False,
                contextual_intent="acknowledgment",
                safe_response_strategy="conversational_acknowledgement",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_acknowledgment",
                intent="follow_up",
                requirement_type=RequirementType.CONTEXTUAL_FOLLOW_UP,
                description=f"Customer acknowledged previous message: '{clean_text}'",
                status=RequirementCoverageStatus.NO_RETRIEVAL_REQUIRED,
            )
            return action_ctx, group, EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED

        # 7. Explanation Demands ("explain", "explain me", "tell me more")
        if clean_text in cls._EXPLANATION_UTTERANCES or "explain" in clean_text:
            action_ctx = ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=False,
                contextual_intent="explanation_requested",
                safe_response_strategy="evidence_supported_response",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_explanation_contextual",
                intent="support_issue",
                requirement_type=RequirementType.SUPPORT_TROUBLESHOOTING,
                description="Explanation requested on topic under discussion",
                status=RequirementCoverageStatus.COMPLETE,
            )
            return action_ctx, group, EvidenceOverallStatus.COMPLETE

        # 8. Selection / Display Demands ("give me", "show me", "bhejo")
        if clean_text in cls._DEMAND_UTTERANCES or any(clean_text.startswith(d) for d in cls._DEMAND_UTTERANCES):
            action_ctx = ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=False,
                contextual_intent="catalogue_selection_requested",
                safe_response_strategy="evidence_supported_response",
            )
            group = RequirementEvidenceGroup(
                requirement_id="req_display_contextual",
                intent="catalogue_request",
                requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
                description="Catalogue or details requested from preceding options",
                status=RequirementCoverageStatus.COMPLETE,
            )
            return action_ctx, group, EvidenceOverallStatus.COMPLETE

        # Default fallback
        return (
            ActionWorkflowContext(
                workflow_action_required=False,
                booking_confirmed=False,
                clarification_required=False,
                safe_response_strategy="evidence_supported_response",
            ),
            None,
            None,
        )
