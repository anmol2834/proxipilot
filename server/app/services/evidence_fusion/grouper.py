"""Requirement Grouper — Phase 5: Candidate Fusion & Evidence Verification.

Decomposes incoming emails and RequirementPlans into stable, independent
RequirementGroupDefinition units. Prevents conflating multi-intent emails into
a single flat candidate pool or applying cross-entity filters.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from app.contracts.evidence_fusion import (
    CandidateRole,
    RequirementEvidenceGroup,
    RequirementType,
)
from app.contracts.requirement_plan import (
    IntentType,
    PlannedComparison,
    PlannedEntity,
    PlannedRange,
    RequirementPlan,
)
from app.core.logging import logger
from app.services.context_resolver import ContextEnvelope, UnresolvedRequirement


# "What happens next and how long does it take" questions. Generic wording only (no business
# vocabulary): turnaround, lead time, confirmation/dispatch/delivery/processing times, next steps.
_PROCESS_TIMELINE_RE = re.compile(
    r"\bhow\s+(?:long|soon)\b|\bhow\s+many\s+(?:working\s+|business\s+)?(?:days|hours|weeks)\b|\bby\s+when\b"
    r"|\bwhen\s+(?:will|would|can|could)\s+(?:i|we|you|it|they)\s+(?:get|receive|expect|ship|dispatch|deliver|confirm|process|refund)\b"
    r"|\blead[\s-]?times?\b|\bturn[\s-]?around\b|\btat\b|\beta\b"
    r"|\b(?:processing|confirmation|dispatch|delivery|shipping|transit|approval|response|refund)\s+(?:time|timeline|period|days)\b"
    r"|\b(?:order|po|purchase\s+order)\s+confirmation\b|\bafter\s+(?:the\s+|our\s+|my\s+|we\s+(?:send|place|share)\s+(?:the\s+)?)?(?:po|purchase\s+order|payment|order|approval)\b"
    r"|\bestimated\s+delivery\b|\btimelines?\b|\bwhat\s+happens\s+(?:next|after)\b|\bnext\s+steps?\b"
    r"|\b(?:refund|return|replacement|exchange|onboarding|installation|approval|payment|ordering|order)\s+process\b"
    r"|\bkitne\s+din\b|\bkab\s+tak\b",
    re.IGNORECASE,
)


_CONTACT_WORDS_RE = re.compile(
    r"\b(?:contact|phone|mobile|call|email|e-mail|address|located|location|office|hours|timings|reach)\b",
    re.IGNORECASE,
)


class RequirementGroupDefinition:
    """Internal blueprint for an isolated requirement group."""

    def __init__(
        self,
        requirement_id: str,
        requirement_type: RequirementType,
        intent: str,
        description: str,
        requested_targets: List[str],
        requested_count: int,
        required_attributes: List[str],
        applicable_candidate_roles: Set[CandidateRole],
        is_operational: bool = False,
        operational_type: Optional[str] = None,
        target_category: Optional[str] = None,
        range_semantics: Optional[PlannedRange] = None,
    ):
        self.requirement_id = requirement_id
        self.requirement_type = requirement_type
        self.intent = intent
        self.description = description
        self.requested_targets = requested_targets
        self.requested_count = requested_count
        self.required_attributes = required_attributes
        self.applicable_candidate_roles = applicable_candidate_roles
        self.is_operational = is_operational
        self.operational_type = operational_type
        self.target_category = target_category
        self.range_semantics = range_semantics


class RequirementGrouper:
    """Splits single-intent or multi-intent plans and context into requirement groups."""

    @classmethod
    def decompose_requirements(
        cls,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
    ) -> List[RequirementGroupDefinition]:
        """Decompose plan and conversation context into discrete requirement definitions."""
        groups: List[RequirementGroupDefinition] = []
        body_text = ""
        if envelope and envelope.current_message:
            body_text = envelope.current_message.body_text or ""
        elif plan.query_text:
            body_text = plan.query_text

        # ---------------------------------------------------------------------
        # 0. Explicit Multi-Intent Requirements from Stage 3 Requirement Plan
        # ---------------------------------------------------------------------
        if plan.requirements and len(plan.requirements) > 1:
            for req in plan.requirements:
                req_type = RequirementType.PRODUCT_SERVICE_DISCOVERY
                candidate_roles = {CandidateRole.PRODUCT_SERVICE}
                is_op = False
                op_type = None

                cat = (req.category or "").lower()
                intent_val = req.intent.value if hasattr(req.intent, "value") else str(req.intent)

                if cat == "policies" or "policy" in intent_val or "warranty" in intent_val:
                    req_type = RequirementType.POLICY_QUERY
                    candidate_roles = {CandidateRole.POLICY_DOCUMENT}
                elif cat == "processes_timelines":
                    # "What happens next / how long does it take" is answered from the business's
                    # own stated process - never treated as a booking that needs a live calendar.
                    req_type = RequirementType.GENERAL_INQUIRY
                    candidate_roles = {CandidateRole.PROCESS_TIMELINE}
                elif "contact" in intent_val or (
                    cat == "company_info"
                    and _CONTACT_WORDS_RE.search(f"{req.description or ''} {req.query_text or ''}")
                ):
                    # The company's contact details (phone, email, address, hours) live in Company Info.
                    req_type = RequirementType.CONTACT_RESOLUTION
                    candidate_roles = {CandidateRole.CONTACT_CARD, CandidateRole.GENERAL_KNOWLEDGE}
                elif cat == "support_faqs" or "support" in intent_val or "troubleshoot" in intent_val:
                    req_type = RequirementType.SUPPORT_TROUBLESHOOTING
                    candidate_roles = {CandidateRole.TROUBLESHOOTING_GUIDE}
                elif "delivery" in intent_val or "order" in intent_val:
                    req_type = RequirementType.OPERATIONAL_SCHEDULING
                    candidate_roles = {CandidateRole.OPERATIONAL_AVAILABILITY, CandidateRole.GENERAL_KNOWLEDGE}
                    is_op = True
                    op_type = "operations_or_delivery"
                elif cat == "company_info":
                    req_type = RequirementType.GENERAL_INQUIRY
                    candidate_roles = {CandidateRole.GENERAL_KNOWLEDGE}
                elif "comparison" in intent_val:
                    req_type = RequirementType.COMPARISON
                    candidate_roles = {CandidateRole.PRODUCT_SERVICE}

                targets = [
                    (e.canonical_value or e.original_text).strip().upper()
                    for e in req.entities
                    if e.entity_type in ("sku", "service_code", "product_code", "model_number")
                ]

                groups.append(
                    RequirementGroupDefinition(
                        requirement_id=req.requirement_id,
                        requirement_type=req_type,
                        intent=intent_val,
                        description=req.description or req.query_text or f"Requirement {req.requirement_id}",
                        requested_targets=targets,
                        requested_count=req.requested_count or 1,
                        # Company Info / process facts are compact, labelled statements: keep them all
                        # (product-style attribute names would drop e.g. the coverage fact).
                        required_attributes=(
                            [] if req_type == RequirementType.GENERAL_INQUIRY and cat in ("company_info", "processes_timelines")
                            else req.requested_attributes or []),
                        applicable_candidate_roles=candidate_roles,
                        is_operational=is_op,
                        operational_type=op_type,
                        target_category=req.category,
                        range_semantics=req.range_semantics,
                    )
                )
            if groups:
                return groups

        text_lower = body_text.lower()

        # ---------------------------------------------------------------------
        # 1. Product/Service Comparison Requirement
        # ---------------------------------------------------------------------
        explicit_comparison = plan.comparison.requested or plan.intent in (
            IntentType.SERVICE_COMPARISON,
            IntentType.PRODUCT_COMPARISON,
        )
        
        # Check explicit comparison targets
        comparison_targets: List[str] = []
        if plan.comparison.target_entities:
            comparison_targets = [t.strip() for t in plan.comparison.target_entities if t.strip()]
        else:
            # Check SKU / product entities
            sku_entities = [
                (e.canonical_value or e.original_text).strip().upper()
                for e in plan.entities
                if e.entity_type in ("sku", "service_code", "product_code")
            ]
            if len(sku_entities) >= 2 or explicit_comparison:
                comparison_targets = sku_entities
            elif "compare" in text_lower:
                match = re.search(
                    r"compare\s+(?:your\s+)?([^,\n\?]+?)(?:\s+service)?\s+(?:with|and|vs|versus)\s+(?:your\s+)?([^,\n\?]+?)(?:\s+service)?(?:\?|\.|\n|$)",
                    body_text,
                    re.IGNORECASE,
                )
                if match:
                    t1 = match.group(1).strip()
                    t2 = match.group(2).strip()
                    if t1 and t2:
                        comparison_targets = [t1, t2]
                        explicit_comparison = True

        if (explicit_comparison and comparison_targets) or (plan.comparison.requested and len(comparison_targets) >= 2):
            req_attrs = list(plan.requested_attributes or ["price"])
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_comparison_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.COMPARISON,
                    intent=plan.intent.value,
                    description=f"Compare requested targets: {', '.join(comparison_targets)}",
                    requested_targets=comparison_targets,
                    requested_count=len(comparison_targets) if comparison_targets else (plan.requested_result_count.explicit_count or 2),
                    required_attributes=req_attrs,
                    applicable_candidate_roles={CandidateRole.PRODUCT_SERVICE},
                    target_category="products_services",
                    range_semantics=None,
                )
            )

        # ---------------------------------------------------------------------
        # 2. Product / Service Price Range Discovery Requirement
        # ---------------------------------------------------------------------
        range_match = re.search(r"between\s+[₹rs\.]*\s*([0-9,]+)\s*(?:and|to|-)\s*[₹rs\.]*\s*([0-9,]+)", text_lower)
        has_price_range = (
            (plan.range_semantics is not None and plan.range_semantics.field == "price")
            or range_match is not None
            or any(kw in text_lower for kw in ("price range", "within this budget", "packages priced between"))
        )
        if has_price_range:
            range_sem = plan.range_semantics
            if not range_sem and range_match:
                try:
                    min_v = float(range_match.group(1).replace(",", ""))
                    max_v = float(range_match.group(2).replace(",", ""))
                    range_sem = PlannedRange(
                        field="price",
                        min_value=min_v,
                        max_value=max_v,
                        currency="INR",
                        is_min_inclusive=True,
                        is_max_inclusive=True,
                    )
                except Exception:
                    pass

            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_discovery_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.PRODUCT_SERVICE_DISCOVERY,
                    intent="price_range_discovery",
                    description="Preventive maintenance or service packages within specified budget range",
                    requested_targets=[],
                    requested_count=plan.requested_result_count.explicit_count or 1,
                    required_attributes=["price"],
                    applicable_candidate_roles={CandidateRole.PRODUCT_SERVICE},
                    target_category="products_services",
                    range_semantics=range_sem,
                )
            )

        # ---------------------------------------------------------------------
        # 3. Policy & Warranty Terms Requirement
        # ---------------------------------------------------------------------
        has_policy = (
            plan.intent == IntentType.POLICY_QUESTION
            or any(kw in text_lower for kw in (
                "warranty policy", "cancellation policy", "return policy", "policy regarding",
                "warranty claims", "order cancellations", "refund policy", "official policy"
            ))
        )
        if has_policy:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_policy_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.POLICY_QUERY,
                    intent=IntentType.POLICY_QUESTION.value,
                    description="Official warranty claims, replacement, and cancellation policy terms",
                    requested_targets=["warranty_policy", "cancellation_policy"],
                    requested_count=1,
                    required_attributes=["policy_statement"],
                    applicable_candidate_roles={CandidateRole.POLICY_DOCUMENT},
                    target_category="policies",
                )
            )

        # ---------------------------------------------------------------------
        # 4. Technical Support & Troubleshooting Requirement
        # ---------------------------------------------------------------------
        has_troubleshooting = (
            plan.intent == IntentType.SUPPORT_ISSUE
            or any(kw in text_lower for kw in (
                "rattling noise", "cooling failure", "troubleshoot", "not cooling",
                "error code", "steps to resolve", "compressor", "leakage", "water leak",
                "making noise", "preliminary troubleshooting"
            ))
        )
        if has_troubleshooting:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_troubleshooting_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.SUPPORT_TROUBLESHOOTING,
                    intent=IntentType.SUPPORT_ISSUE.value,
                    description="Preliminary troubleshooting and diagnostic guidance",
                    requested_targets=[],
                    requested_count=1,
                    required_attributes=["troubleshooting_guidance"],
                    applicable_candidate_roles={
                        CandidateRole.TROUBLESHOOTING_GUIDE,
                        CandidateRole.PRODUCT_SERVICE,
                    },
                    target_category="support_faqs",
                )
            )

        # ---------------------------------------------------------------------
        # 5. Corporate Contact & Escalation Requirement
        # ---------------------------------------------------------------------
        has_contact = (
            any(e.entity_type == "contact_department" for e in plan.entities)
            or any(kw in text_lower for kw in (
                "billing contact", "escalation contact", "contact person",
                "corporate billing", "manager contact", "support email", "phone number",
                "authorized corporate contact", "warranty escalations", "invoice inquiries"
            ))
        )
        if has_contact:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_contact_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.CONTACT_RESOLUTION,
                    intent="contact_lookup",
                    description="Authorized corporate billing and escalation contact resolution",
                    # No title targets: the company's contact details are matched by role and facts,
                    # not by records literally titled "billing" / "escalation".
                    requested_targets=[],
                    requested_count=1,
                    required_attributes=["contact_email", "contact_phone"],
                    # The company's contact details live in Company Info.
                    applicable_candidate_roles={CandidateRole.CONTACT_CARD, CandidateRole.GENERAL_KNOWLEDGE},
                    target_category="company_info",
                )
            )

        # ---------------------------------------------------------------------
        # 5b. Processes & Timelines Requirement ("after the PO, how long until confirmation?")
        # ---------------------------------------------------------------------
        has_process = (
            any((r.category or "") == "processes_timelines" for r in (plan.requirements or []))
            or bool(_PROCESS_TIMELINE_RE.search(text_lower))
        )
        if has_process:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_process_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.GENERAL_INQUIRY,
                    intent="process_timeline",
                    description="How the process works and how long it takes, as the business states it",
                    requested_targets=[],
                    requested_count=2,
                    required_attributes=[],
                    applicable_candidate_roles={CandidateRole.PROCESS_TIMELINE},
                    target_category="processes_timelines",
                )
            )

        # ---------------------------------------------------------------------
        # 5c. Company Info Requirement ("introduce your company", "Pune branch hours", "do you cover
        #     Jaipur?") — previously these fell into the product fallback group whose roles exclude
        #     company records, so the reply had no company evidence at all.
        # ---------------------------------------------------------------------
        has_company = (
            not has_contact
            and any((r.category or "") == "company_info" for r in (plan.requirements or []))
        )
        if has_company:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_company_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.GENERAL_INQUIRY,
                    intent="company_info",
                    description="Company facts the business has approved for customer replies",
                    requested_targets=[],
                    requested_count=1,
                    required_attributes=[],
                    applicable_candidate_roles={CandidateRole.GENERAL_KNOWLEDGE, CandidateRole.CONTACT_CARD},
                    target_category="company_info",
                )
            )

        # ---------------------------------------------------------------------
        # 6. Operational Scheduling & Booking Requirement
        # ---------------------------------------------------------------------
        # Only an explicit request to book/schedule a visit is a scheduling requirement. Product
        # stock/availability or order questions ("how many products do you have in stock?") are NOT
        # — treating them as technician bookings made replies talk about appointments.
        has_scheduling = any(kw in text_lower for kw in (
            "technician", "appointment", "book a slot", "book a visit", "schedule a visit", "site visit",
            "visit our premises", "visit us", "book now", "schedule now", "time slot", "available slot",
            "saturday morning", "this sunday", "sunday booking", "between 2:00 pm and 5:00 pm",
        ))
        if has_scheduling:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_scheduling_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.OPERATIONAL_SCHEDULING,
                    intent="operational_scheduling",
                    description="Technician appointment and visit scheduling investigation",
                    requested_targets=["saturday_morning_visit", "technician_visit_slot"],
                    requested_count=1,
                    required_attributes=["availability_slot"],
                    applicable_candidate_roles={CandidateRole.OPERATIONAL_AVAILABILITY},
                    is_operational=True,
                    operational_type="appointment_scheduling",
                    target_category="operational_availability",
                )
            )

        # ---------------------------------------------------------------------
        # 5. Contextual Short Reply / Conversational Turn
        # ---------------------------------------------------------------------
        stripped = text_lower.strip().rstrip(".!?")
        is_greeting = stripped in ("hello", "hi", "hey", "good morning", "good evening", "namaste")
        is_short_affirmative = stripped in (
            "yes", "ok", "okay", "proceed", "go ahead", "goo ahead", "sure", "ha", "theek hai"
        )
        is_short_demand = stripped in (
            "give me", "show me", "bhejo", "explain", "explain me", "book now", "schedule now"
        )

        if is_greeting:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_greeting_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.CONVERSATIONAL_GREETING,
                    intent="greeting",
                    description="Inbound conversational greeting",
                    requested_targets=[],
                    requested_count=0,
                    required_attributes=[],
                    applicable_candidate_roles=set(),
                )
            )
        elif (is_short_affirmative or is_short_demand) and not groups:
            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_contextual_{plan.plan_id[-6:]}",
                    requirement_type=RequirementType.CONTEXTUAL_FOLLOW_UP,
                    intent=IntentType.FOLLOW_UP.value,
                    description=f"Contextual follow-up utterance: '{stripped}'",
                    requested_targets=[],
                    requested_count=1,
                    required_attributes=[],
                    applicable_candidate_roles={
                        CandidateRole.PRODUCT_SERVICE,
                        CandidateRole.OPERATIONAL_AVAILABILITY,
                        CandidateRole.CONTEXTUAL_PROPOSAL,
                    },
                )
            )

        # ---------------------------------------------------------------------
        # 6. Fallback: Standalone Product / Service Discovery / Price Query
        # ---------------------------------------------------------------------
        if not groups:
            # If standard single intent
            req_type = RequirementType.PRODUCT_SERVICE_DISCOVERY
            if plan.intent in (IntentType.PRODUCT_LOOKUP, IntentType.SERVICE_LOOKUP):
                req_type = RequirementType.PRODUCT_SERVICE_DISCOVERY
            elif plan.intent == IntentType.POLICY_QUESTION:
                req_type = RequirementType.POLICY_QUERY

            targets = [
                (e.canonical_value or e.original_text).strip().upper()
                for e in plan.entities
                if e.entity_type in ("sku", "service_code", "product_code")
            ]
            if plan.requested_result_count.explicit_count:
                req_count = plan.requested_result_count.explicit_count
            elif targets:
                req_count = len(targets)
            elif plan.requested_result_count.final_count:
                req_count = plan.requested_result_count.final_count
            else:
                req_count = plan.requested_result_count.default_count or 5

            groups.append(
                RequirementGroupDefinition(
                    requirement_id=f"req_primary_{plan.plan_id[-6:]}",
                    requirement_type=req_type,
                    intent=plan.intent.value,
                    description=plan.query_text or f"Customer {plan.intent.value} request",
                    requested_targets=targets,
                    requested_count=req_count,
                    required_attributes=list(plan.requested_attributes or ["price"]),
                    applicable_candidate_roles={
                        CandidateRole.PRODUCT_SERVICE,
                        CandidateRole.POLICY_DOCUMENT,
                    },
                )
            )

        return groups
