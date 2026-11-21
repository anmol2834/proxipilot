"""Layer C: Deterministic Validation and Policy Engine.

Enforces trusted server-side invariants, schema constraints, range contradiction checks,
and safe execution policy on model proposals before compiling the final RequirementPlan.

Architectural rules:
1. The LLM only PROPOSES a plan. Trusted application code decides whether the plan
   is valid, safe, consistent, and executable.
2. Tenant Isolation Invariant: Tenant ID, thread ID, message ID, and revision are
   injected strictly from trusted server-side ContextEnvelope. The model cannot alter them.
3. Allowlist Gate: Reject any field or operator not present in the RetrievalCapabilityCatalogue.
   Never permit raw SQL, arbitrary Qdrant filters, or unbounded database work.
4. Contradiction Resolution: Deterministically resolves range bounds (min <= max),
   currency alignment, and context supersession.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.contracts.requirement_plan import (
    Ambiguity,
    EntityResolutionStatus,
    EvidenceReference,
    IntentType,
    MissingDetail,
    PlanMetadata,
    PlannedComparison,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedResultCount,
    PlannerProposalDTO,
    RequirementPlan,
    RetrievalStrategy,
    ValidationStatus,
)
from app.contracts.retrieval_capability import (
    FilterOperator,
    RetrievalCapabilityCatalogue,
)
from app.core.logging import logger
from app.services.context_resolver import ContextEnvelope
from app.services.requirement_planner.decomposer import MultiIntentDecomposer
from app.services.requirement_planner.preprocessor import PreprocessedEmail



# Near-synonym intent labels an LLM may produce, mapped onto the taxonomy (defence in depth;
# the planner schema already constrains the intent to the enum).
_INTENT_ALIASES = (
    (("stock", "inventory", "in_stock", "availability", "available"), IntentType.AVAILABILITY_QUERY),
    (("catalog", "catalogue", "range", "product_list", "product_count", "how_many"), IntentType.CATALOGUE_REQUEST),
    (("price", "pricing", "cost", "rate", "quote", "quotation"), IntentType.PRICE_QUERY),
    (("compare", "comparison", "versus"), IntentType.PRODUCT_COMPARISON),
    (("recommend", "suggest", "best"), IntentType.RECOMMENDATION),
    (("order", "delivery", "dispatch", "shipping", "tracking"), IntentType.ORDER_OR_DELIVERY_QUESTION),
    (("warranty", "guarantee"), IntentType.WARRANTY_QUESTION),
    (("policy", "refund", "return"), IntentType.POLICY_QUESTION),
    (("complaint", "issue", "problem", "support", "damaged", "broken"), IntentType.SUPPORT_ISSUE),
    (("product", "item", "discovery", "inquiry", "enquiry"), IntentType.PRODUCT_DISCOVERY),
)


def _intent_alias(raw_intent: str, text: str) -> "IntentType | None":
    label = (raw_intent or "").replace("-", "_").replace(" ", "_")
    for keys, intent in _INTENT_ALIASES:
        if any(k in label for k in keys):
            return intent
    # "how many products do you have (in stock)?" style questions
    if "how many" in text and any(w in text for w in ("product", "item", "stock")):
        return IntentType.CATALOGUE_REQUEST
    return None

IDENTIFIER_ENTITY_TYPES = frozenset({"sku", "service_code", "product_code", "model_number"})
_NUMBER_UNIT_RE = re.compile(r"^[0-9]+(?:[.,][0-9]+)?[\s\-_]?[a-z]{1,6}$", re.IGNORECASE)


def looks_like_identifier(value: Optional[str]) -> bool:
    """A real code: one token (dashes / slashes allowed), letters AND digits or a long digit run,
    and not a quantity with a unit ("30L", "30 liters", "800ml")."""
    v = (value or "").strip()
    if not v or len(v) > 40 or len(v.split()) > 1:
        return False
    if _NUMBER_UNIT_RE.match(v):
        return False
    has_digit = any(ch.isdigit() for ch in v)
    has_alpha = any(ch.isalpha() for ch in v)
    return has_digit and (has_alpha or len(v) >= 5)


class DeterministicPlanValidator:
    """Enterprise deterministic validator and policy engine for requirement plans."""

    def validate_and_compile(
        self,
        envelope: ContextEnvelope,
        preprocessed: PreprocessedEmail,
        proposal: PlannerProposalDTO,
        catalogue: RetrievalCapabilityCatalogue,
        metadata: PlanMetadata,
    ) -> RequirementPlan:
        """Validate LLM proposal against trusted server-side rules and compile final RequirementPlan."""
        start_t = time.perf_counter()
        validation_errors: List[str] = []
        ambiguities: List[Ambiguity] = []
        missing_details: List[MissingDetail] = []

        # ---------------------------------------------------------------------
        # 1. Intent Validation
        # ---------------------------------------------------------------------
        raw_intent = (proposal.intent or "").strip().lower()
        clean_text = preprocessed.cleaned_current_text.strip().lower()
        continuation_phrases = (
            "more options", "any more options", "do have any more options",
            "do you have any more options", "any other options", "other options",
            "what else", "what else do you have", "what else is available",
            "any alternatives", "alternative options", "alternatives",
            "show me more", "show more", "give me more",
            "show me something different", "something different",
            "anything else", "anything different", "any different options",
            "different options", "different services", "more services",
        )
        is_continuation_request = (
            raw_intent in ("more_options", "different_options")
            or clean_text in ("more", "more?", "more please", "options", "more options?")
            or any(phrase in clean_text for phrase in continuation_phrases)
        )

        try:
            validated_intent = IntentType(raw_intent)
        except ValueError:
            aliased = _intent_alias(raw_intent, clean_text)
            if is_continuation_request and (envelope.previously_presented_entity_ids or envelope.active_discovery_scope):
                validated_intent = IntentType.MORE_OPTIONS
            elif aliased is not None:
                validated_intent = aliased
            else:
                validation_errors.append(f"Unrecognized intent '{proposal.intent}'; falling back to UNKNOWN")
                validated_intent = IntentType.UNKNOWN

        # Model said "unknown" for a recognisable catalogue/stock question: recover from the text.
        if validated_intent == IntentType.UNKNOWN and not is_continuation_request:
            recovered = _intent_alias("", clean_text)
            if recovered is not None:
                validated_intent = recovered

        # If LLM fell back to unknown on a clear continuation request, recover intent
        if validated_intent in (IntentType.UNKNOWN, IntentType.CLARIFICATION) and is_continuation_request:
            if envelope.previously_presented_entity_ids or envelope.active_discovery_scope:
                validated_intent = IntentType.MORE_OPTIONS


        # ---------------------------------------------------------------------
        # 2. Category & Capability Catalogue Validation
        # ---------------------------------------------------------------------
        target_category = proposal.target_category if proposal.target_category in catalogue.categories else "products_services"
        if proposal.target_category not in catalogue.categories:
            validation_errors.append(f"Target category '{proposal.target_category}' unknown; defaulted to 'products_services'")

        # ---------------------------------------------------------------------
        # 3. Entity Extraction & Resolution
        # ---------------------------------------------------------------------
        validated_entities: List[PlannedEntity] = []
        for ent in proposal.entities:
            e_type = ent.get("entity_type", "unknown")
            orig = ent.get("original_text", "")
            canon = ent.get("canonical_value") or orig
            raw_res = ent.get("resolution_status", "resolved")

            try:
                res_status = EntityResolutionStatus(raw_res)
            except ValueError:
                res_status = EntityResolutionStatus.UNRESOLVED

            if str(e_type).lower() in IDENTIFIER_ENTITY_TYPES and not looks_like_identifier(canon):
                # The model tagged a phrase ("product code", "30 liters") as an identifier. As an
                # exact key it would hard-reject every real candidate; keep it only as a descriptor.
                e_type = "descriptor"

            validated_entities.append(
                PlannedEntity(
                    entity_type=e_type,
                    original_text=orig,
                    canonical_value=canon,
                    resolution_status=res_status,
                )
            )

        # Incorporate preprocessed exact identifiers if omitted by model
        existing_skus = {e.canonical_value for e in validated_entities if e.entity_type == "sku"}
        for ident in preprocessed.identifiers:
            if ident.identifier not in existing_skus:
                validated_entities.append(
                    PlannedEntity(
                        entity_type="sku",
                        original_text=ident.raw_text,
                        canonical_value=ident.identifier,
                        resolution_status=EntityResolutionStatus.RESOLVED,
                        source_span=f"char[{ident.start_char}:{ident.end_char}]",
                    )
                )

        # ---------------------------------------------------------------------
        # 4. Filter Allowlist & Operator Validation
        # ---------------------------------------------------------------------
        validated_filters: List[PlannedFilter] = []
        for flt in proposal.filters:
            f_name = flt.get("field", "").strip().lower()
            raw_op = flt.get("operator", "").strip().lower()
            val = flt.get("value")

            # Check field exists in capability catalogue
            if not catalogue.is_field_allowed(target_category, f_name):
                # Try products_services as fallback
                if not catalogue.is_field_allowed("products_services", f_name):
                    validation_errors.append(f"Field '{f_name}' not permitted in capability catalogue; rejected")
                    continue

            # Check operator is permitted
            try:
                op_enum = FilterOperator(raw_op)
            except ValueError:
                validation_errors.append(f"Operator '{raw_op}' not supported for field '{f_name}'; rejected")
                continue

            if not catalogue.is_operator_allowed(target_category, f_name, op_enum):
                validation_errors.append(f"Operator '{op_enum.value}' not allowed on field '{f_name}'; rejected")
                continue

            validated_filters.append(
                PlannedFilter(
                    field=f_name,
                    operator=op_enum,
                    value=val,
                )
            )

        # ---------------------------------------------------------------------
        # 5. Range Contradiction & Numeric Bounds Checks
        # ---------------------------------------------------------------------
        r_min = proposal.range_min
        r_max = proposal.range_max
        r_curr = proposal.currency or "INR"
        r_unit = proposal.unit

        # Detect proposal min > max contradiction
        if proposal.range_min is not None and proposal.range_max is not None and proposal.range_min > proposal.range_max:
            validation_errors.append(f"Contradictory range: minimum ({proposal.range_min}) > maximum ({proposal.range_max})")
            ambiguities.append(
                Ambiguity(
                    field="price_range",
                    competing_interpretations=[f"min: {proposal.range_min}", f"max: {proposal.range_max}"],
                    requires_clarification=True,
                )
            )
            r_min, r_max = proposal.range_max, proposal.range_min

        # Preprocessed ranges take precedence if model hallucinated conflicting bounds
        if preprocessed.ranges:
            top_range = preprocessed.ranges[0]
            if top_range.min_value is not None:
                r_min = top_range.min_value
            if top_range.max_value is not None:
                r_max = top_range.max_value
            if top_range.currency:
                r_curr = top_range.currency

        # Ensure bounds are ordered
        if r_min is not None and r_max is not None and r_min > r_max:
            validation_errors.append(f"Contradictory range: minimum ({r_min}) > maximum ({r_max})")
            r_min, r_max = r_max, r_min

        # Detect count vs price confusion (e.g. model set price = 3 when user said 'top 3 options')
        if preprocessed.counts and r_max is not None:
            for cnt in preprocessed.counts:
                if cnt.count == r_max and cnt.count <= 10 and not any(p.amount == cnt.count for p in preprocessed.prices):
                    validation_errors.append(f"Count ({cnt.count}) was erroneously assigned to price limit; cleared")
                    r_max = None

        planned_range: Optional[PlannedRange] = None
        if r_min is not None or r_max is not None:
            planned_range = PlannedRange(
                field="price",
                min_value=r_min,
                max_value=r_max,
                currency=r_curr,
                unit=r_unit,
                is_min_inclusive=True,
                is_max_inclusive=(r_min is not None and r_max is not None),
            )

        # ---------------------------------------------------------------------
        # 6. Requested Result Count Clamping & Safe Limits
        # ---------------------------------------------------------------------
        user_count = proposal.requested_count
        if preprocessed.counts:
            # Prefer explicit preprocessed count
            user_count = preprocessed.counts[0].count

        # Default and max safe limits from catalogue
        def_count = catalogue.default_result_count
        max_safe = catalogue.max_safe_result_limit

        if user_count is not None and user_count > 0:
            final_count = min(user_count, max_safe)
            if user_count > max_safe:
                validation_errors.append(
                    f"Requested count ({user_count}) exceeds server safety policy ({max_safe}); clamped to {final_count}"
                )
        else:
            final_count = def_count

        result_count = PlannedResultCount(
            explicit_count=user_count,
            default_count=def_count,
            max_safe_limit=max_safe,
            final_count=final_count,
        )

        # ---------------------------------------------------------------------
        # 7. Comparison Requirements
        # ---------------------------------------------------------------------
        comp_req = proposal.comparison_requested
        comp_criteria = proposal.comparison_criteria
        # If user asked for top N with multiple options or said compare
        if preprocessed.counts and any(c.is_top_n for c in preprocessed.counts):
            comp_req = True
            if not comp_criteria:
                comp_criteria = ["price", "features", "warranty"]

        # A comparison must be what the customer asked for: the comparison intent, explicit
        # comparison wording, or a top-N request. "Suggest suitable models" is discovery.
        _cmp_text = (preprocessed.cleaned_current_text or "").lower()
        _explicit_cmp = bool(re.search(r"\b(?:compare|comparison|versus|vs\.?|difference|differ|better|which\s+is\s+best)\b", _cmp_text))
        if comp_req and not (
            validated_intent in (IntentType.PRODUCT_COMPARISON, IntentType.SERVICE_COMPARISON)
            or _explicit_cmp
            or (preprocessed.counts and any(c.is_top_n for c in preprocessed.counts))
        ):
            comp_req = False
        # Only entities that identify an offering can be comparison targets — never a
        # measurement, person, place or date mentioned in the email.
        _target_types = {"sku", "service_code", "product_code", "model_number", "product", "service",
                         "product_name", "service_name", "brand", "model"}
        _cmp_targets = [e.canonical_value for e in validated_entities
                        if e.canonical_value and str(e.entity_type or "").lower() in _target_types]

        planned_comparison = PlannedComparison(
            requested=comp_req,
            target_entities=_cmp_targets if comp_req else [],
            criteria=comp_criteria if comp_req else [],
            ranking_criterion=proposal.ranking_criterion or None,
        )

        # ---------------------------------------------------------------------
        # 8. Missing Details & Clarification Consistency
        # ---------------------------------------------------------------------
        clarification_required = proposal.clarification_needed or (len(ambiguities) > 0 and any(a.requires_clarification for a in ambiguities))
        clarification_reason = proposal.clarification_reason

        for miss in proposal.missing_required_details:
            missing_details.append(
                MissingDetail(
                    field_or_concept=miss,
                    is_required_for_retrieval=True,
                    recovered_from_context=False,
                )
            )

        # Check context recovery: if user inquiry is a follow-up, check previous requirements
        if validated_intent == IntentType.FOLLOW_UP and envelope.unresolved_requirements:
            for req in envelope.unresolved_requirements:
                if req.status.value == "OPEN":
                    missing_details.append(
                        MissingDetail(
                            field_or_concept=req.description,
                            is_required_for_retrieval=False,
                            recovered_from_context=True,
                            safe_default_applied=req.requirement_id,
                        )
                    )

        # ---------------------------------------------------------------------
        # 9. Novelty, Continuation, and Retrieval Strategy Compilation
        # ---------------------------------------------------------------------
        is_continuation = validated_intent in (IntentType.MORE_OPTIONS, IntentType.DIFFERENT_OPTIONS)
        continuation_type = "MORE_OPTIONS" if validated_intent == IntentType.MORE_OPTIONS else ("DIFFERENT_OPTIONS" if validated_intent == IntentType.DIFFERENT_OPTIONS else None)
        excluded_ids = list(envelope.previously_presented_entity_ids) if is_continuation else []

        if is_continuation:
            # A valid continuation request in an active discovery session should proceed to retrieval
            clarification_required = False
            clarification_reason = None
            strategy = RetrievalStrategy.HYBRID
            val_status = ValidationStatus.READY_FOR_RETRIEVAL
        elif clarification_required:
            strategy = RetrievalStrategy.CLARIFICATION_REQUIRED
            val_status = ValidationStatus.NEEDS_CLARIFICATION
        elif any(e.entity_type == "sku" for e in validated_entities):
            strategy = RetrievalStrategy.EXACT_LOOKUP
            val_status = ValidationStatus.READY_FOR_RETRIEVAL
        elif validated_filters and not proposal.semantic_search_query:
            strategy = RetrievalStrategy.STRUCTURED_FILTER
            val_status = ValidationStatus.READY_FOR_RETRIEVAL
        elif validated_filters and proposal.semantic_search_query:
            strategy = RetrievalStrategy.HYBRID
            val_status = ValidationStatus.READY_FOR_RETRIEVAL
        else:
            strategy = RetrievalStrategy.SEMANTIC_DISCOVERY
            val_status = ValidationStatus.READY_FOR_RETRIEVAL

        # ---------------------------------------------------------------------
        # 10. Evidence References & Metadata Assembly
        # ---------------------------------------------------------------------
        evidence_refs: List[EvidenceReference] = []
        if preprocessed.ranges:
            for r in preprocessed.ranges:
                evidence_refs.append(
                    EvidenceReference(
                        message_id=envelope.current_message_id,
                        source_span=f"char[{r.start_char}:{r.end_char}]: '{r.raw_text}'",
                        field_supported="price_range",
                    )
                )
        if preprocessed.counts:
            for c in preprocessed.counts:
                evidence_refs.append(
                    EvidenceReference(
                        message_id=envelope.current_message_id,
                        source_span=f"char[{c.start_char}:{c.end_char}]: '{c.raw_text}'",
                        field_supported="requested_count",
                    )
                )

        val_duration_ms = (time.perf_counter() - start_t) * 1000.0
        metadata.validation_duration_ms = val_duration_ms

        # Sanitize query text for vector retrieval
        query_text = proposal.semantic_search_query.strip() if proposal.semantic_search_query else preprocessed.cleaned_current_text[:200]

        # Multi-Intent Requirement Decomposition (supports 10+ independent requirements)
        raw_msg_text = ""
        if envelope and envelope.current_message and envelope.current_message.body_text:
            raw_msg_text = envelope.current_message.body_text
        elif preprocessed and preprocessed.cleaned_current_text:
            raw_msg_text = preprocessed.cleaned_current_text

        requirements = MultiIntentDecomposer.decompose(
            text=raw_msg_text,
            preprocessed=preprocessed,
            envelope=envelope,
            fallback_intent=validated_intent,
            fallback_category=getattr(proposal, "target_category", None) or "products_services",
        )
        requirements = MultiIntentDecomposer.add_model_requirements(
            requirements, getattr(proposal, "search_requirements", None))

        return RequirementPlan(
            schema_version="1.0",
            tenant_id=envelope.tenant_id,  # Authoritative server-side scope
            integration_account_id=envelope.integration_account_id,
            thread_id=envelope.thread_id,
            message_id=envelope.current_message_id,
            context_revision=envelope.context_revision,
            intent=validated_intent,
            entities=validated_entities,
            filters=validated_filters,
            range_semantics=planned_range,
            requested_attributes=(
                list(proposal.requested_attributes)
                if proposal.requested_attributes is not None
                else (["price"] if validated_intent in (IntentType.PRICE_QUERY, IntentType.PRODUCT_DISCOVERY, IntentType.MORE_OPTIONS) else [])
            ),
            comparison=planned_comparison,
            requested_result_count=result_count,
            requirements=requirements,
            missing_details=missing_details,
            ambiguities=ambiguities,
            clarification_required=clarification_required,
            clarification_reason=clarification_reason,
            retrieval_strategy=strategy,
            retrieval_strategy_hints=proposal.retrieval_hints,
            query_text=query_text,
            is_continuation=is_continuation,
            continuation_type=continuation_type,
            excluded_entity_ids=excluded_ids,
            validation_status=val_status,
            validation_errors=validation_errors,
            evidence_references=evidence_refs,
            metadata=metadata,
        )


# Singleton validator instance
deterministic_plan_validator = DeterministicPlanValidator()
