"""Phase 10: Hybrid Retrieval & Authoritative Fact Verification Engine.

Implements the multi-stage retrieval architecture:
1. Requirement & Entity Extraction (Service codes, SKU, location, commercial intent)
2. Dual Search Planner (Qdrant dense vector ANN search + PostgreSQL exact identity lookup)
3. Candidate Merge, Deduplication, and Scoring
4. PostgreSQL Authoritative Re-hydration via CanonicalKnowledgeReader
5. Strict Temporal Validity & Authority Arbitration
6. Typed Evidence Construction with Exact Decimal Money Calculations
7. Requirement-Coverage & Safety Validation Gate (Zero Hallucination Policy)

Architectural Invariants:
- Qdrant provides semantic relevance candidates ONLY.
- PostgreSQL provides authoritative commercial truth (prices, warranties, SLAs).
- Controlled commercial types: fixed, estimate, starting_price, quote_required, not_specified.
- Unspecified or estimated pricing MUST NOT be hallucinated as guaranteed fixed quotes.
- Missing or ambiguous business requirements trigger CLARIFY or HUMAN_HANDOFF.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from qdrant_client import models as qmodels
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.contracts.embeddings import (
    EmbeddingBatchRequest,
    EmbeddingInputType,
    EmbeddingRequestItem,
)
from app.contracts.rag import (
    AuthoritativeEvidenceObject,
    AuthoritativePricingEvidence,
    CommercialPriceType,
    HybridRetrievalRequestDTO,
    HybridRetrievalResponseDTO,
    RequirementValidationResult,
    VerificationDecision,
)
from app.core.config import get_settings
from app.core.logging import logger
from app.models.knowledge import KnowledgeItem, KnowledgeVersion
from app.services.embedding_providers import get_embedding_provider
from app.services.knowledge_read_contract import (
    CanonicalKnowledgeReader,
    normalize_utc_timestamp,
)
from app.services.qdrant_service import qdrant_indexer_service


def _has_real_price(base_price: Any, calculated_total: Any) -> bool:
    """True when a catalogue row carries an actual price. A blank or 0 price in an imported
    sheet means "price not listed" (seen on raw materials / parts), never "free"."""
    for v in (calculated_total, base_price):
        try:
            if v is not None and Decimal(str(v)) > 0:
                return True
        except Exception:  # noqa: BLE001 — unparsable amounts are not prices
            continue
    return False


def _compute_exact_pricing(
    pricing_data: Dict[str, Any],
) -> Tuple[Decimal, Decimal, Decimal, Decimal, Decimal, Decimal, CommercialPriceType, Optional[str], str]:
    """Compute exact authoritative monetary values using Python Decimal.
    
    Formula:
        subtotal = base_price + visit_charge + estimated_parts_cost
        after_discount = subtotal * (1 - discount_pct / 100)
        total = after_discount * (1 + tax_pct / 100)
    All money arithmetic rounded to 2 decimal places with ROUND_HALF_UP.
    """
    currency = pricing_data.get("currency", "INR")
    base_price = Decimal(str(pricing_data.get("base_price", "0.00")))
    visit_charge = Decimal(
        str(
            pricing_data.get("visit_diagnostic_charge")
            or pricing_data.get("visit_charge")
            or "0.00"
        )
    )
    parts_cost = Decimal(
        str(
            pricing_data.get("estimated_parts_cost")
            or pricing_data.get("parts_cost_estimate")
            or "0.00"
        )
    )
    discount_pct = Decimal(
        str(
            pricing_data.get("discount_percentage")
            or pricing_data.get("discount_percent")
            or "0.00"
        )
    )
    tax_pct = Decimal(
        str(
            pricing_data.get("tax_percentage")
            or pricing_data.get("tax_percent")
            or "0.00"
        )
    )
    notes = (
        pricing_data.get("pricing_notes")
        or pricing_data.get("pricing_note")
        or pricing_data.get("notes")
    )

    subtotal = base_price + visit_charge + parts_cost
    discount_mult = Decimal("1.00") - (discount_pct / Decimal("100.00"))
    after_discount = subtotal * discount_mult
    tax_mult = Decimal("1.00") + (tax_pct / Decimal("100.00"))
    calculated_total = (after_discount * tax_mult).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Determine commercial price type
    raw_type = (pricing_data.get("commercial_price_type") or "not_specified").lower().strip()
    try:
        commercial_type = CommercialPriceType(raw_type)
    except ValueError:
        commercial_type = CommercialPriceType.NOT_SPECIFIED

    # Construct mandatory non-hallucinatory commercial qualifier
    if commercial_type == CommercialPriceType.FIXED:
        qualifier = (
            f"Fixed price quote: {currency} {calculated_total:.2f} inclusive of diagnostics and applicable taxes. "
            f"No hidden fees for covered scope."
        )
    elif commercial_type == CommercialPriceType.ESTIMATE:
        qualifier = (
            f"Estimated service cost: {currency} {calculated_total:.2f} (Base: {currency} {base_price:.2f}, "
            f"Visit Fee: {currency} {visit_charge:.2f}, Est. Parts: {currency} {parts_cost:.2f} + {tax_pct}% GST). "
            f"Final bill depends on inspection. Parts billed as required."
        )
    elif commercial_type == CommercialPriceType.STARTING_PRICE:
        qualifier = (
            f"Starting price: {currency} {calculated_total:.2f}. Covers initial service and diagnostic assessment. "
            f"Component replacements quoted separately."
        )
    elif commercial_type == CommercialPriceType.QUOTE_REQUIRED:
        qualifier = (
            f"Custom quote required upon technician visit. Diagnostic charge: {currency} {visit_charge:.2f}."
        )
    else:  # not_specified
        qualifier = (
            f"Estimated price: {currency} {calculated_total:.2f} (Visit fee {currency} {visit_charge:.2f} included). "
            f"Commercial type not fixed; parts and specialized repair billed according to actual requirements."
        )

    if notes:
        qualifier += f" Note: {notes}"

    return (
        base_price,
        visit_charge,
        parts_cost,
        discount_pct,
        tax_pct,
        calculated_total,
        commercial_type,
        notes,
        qualifier,
    )


class HybridRetrievalService:
    """Production-grade Phase 10 Hybrid Retrieval and Fact Verification Engine."""

    def __init__(self):
        self._code_pattern = re.compile(r"\b([A-Z]{2,4}-\d{3,5})\b", re.IGNORECASE)

    async def retrieve_and_verify(
        self,
        db: AsyncSession,
        tenant_id: str,
        request: HybridRetrievalRequestDTO,
        as_of: Optional[datetime] = None,
    ) -> HybridRetrievalResponseDTO:
        """Executes the complete 8-stage hybrid retrieval and fact verification pipeline."""
        start_time = time.perf_counter()
        ref_time = normalize_utc_timestamp(as_of)

        # ---------------------------------------------------------------------
        # Stage 1: Requirement & Entity Extraction
        # ---------------------------------------------------------------------
        extracted_codes: Set[str] = set()
        if request.required_service_code:
            extracted_codes.add(request.required_service_code.strip().upper())
        for match in self._code_pattern.finditer(request.query_text):
            extracted_codes.add(match.group(1).upper())

        customer_location = request.customer_location.strip() if request.customer_location else None

        # ---------------------------------------------------------------------
        # Stage 2: Dual Search Planner
        # ---------------------------------------------------------------------
        candidate_items: Dict[str, Dict[str, Any]] = {}

        # Branch 2A: Exact Structured Business Key Lookup
        if extracted_codes:
            stmt = select(KnowledgeItem).where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeItem.is_active.is_(True),
                KnowledgeItem.external_identity_key.in_(list(extracted_codes)),
            )
            res = await db.execute(stmt)
            for item in res.scalars().all():
                candidate_items[item.id] = {
                    "item": item,
                    "similarity_score": 1.0,
                    "retrieval_source": "exact_key",
                }

        # Branch 2B: Semantic ANN Candidate Retrieval from Qdrant
        try:
            provider = get_embedding_provider()
            query_hash = hashlib.sha256(request.query_text.encode("utf-8")).hexdigest()
            embed_req = EmbeddingBatchRequest(
                model=provider.model_name,
                input_type=EmbeddingInputType.QUERY,
                items=[
                    EmbeddingRequestItem(
                        item_id="retrieval_query",
                        text=request.query_text,
                        content_hash=query_hash,
                        metadata={"tenant_id": tenant_id},
                    )
                ],
                model_name=provider.model_name,
                dimension=provider.dimension,
            )
            embed_res = await provider.embed_batch(embed_req)
            query_vector = embed_res.results[0].vector

            # Construct strict tenant filter
            filter_must: List[Any] = [
                qmodels.FieldCondition(
                    key="organization_id",
                    match=qmodels.MatchValue(value=tenant_id),
                ),
                qmodels.FieldCondition(
                    key="status",
                    match=qmodels.MatchValue(value="active"),
                ),
            ]

            if request.category_filter:
                filter_must.append(
                    qmodels.FieldCondition(
                        key="category",
                        match=qmodels.MatchAny(any=request.category_filter),
                    )
                )

            qdrant_filter = qmodels.Filter(must=filter_must)

            search_results = await qdrant_indexer_service._client.search(
                collection_name="proxipilot_knowledge",
                query_vector=qmodels.NamedVector(name="dense", vector=query_vector),
                query_filter=qdrant_filter,
                limit=request.top_k * 2,  # Bounded over-fetch for post-filtering
                score_threshold=request.score_threshold,
            )

            for point in search_results:
                payload = point.payload or {}
                item_id = payload.get("knowledge_item_id")
                if not item_id:
                    continue

                if item_id in candidate_items:
                    # Item already found via exact match; elevate score
                    candidate_items[item_id]["similarity_score"] = max(
                        candidate_items[item_id]["similarity_score"], float(point.score)
                    )
                    candidate_items[item_id]["retrieval_source"] = "hybrid"
                else:
                    candidate_items[item_id] = {
                        "item": None,  # Will resolve from DB
                        "similarity_score": float(point.score),
                        "retrieval_source": "vector_ann",
                    }
        except Exception as err:
            logger.warning(
                "Qdrant ANN search encountered issue, falling back to structured DB retrieval",
                error=str(err),
                tenant_id=tenant_id,
            )

        # ---------------------------------------------------------------------
        # Stage 3 & 4: PostgreSQL Authoritative Re-hydration & Temporal Validation
        # ---------------------------------------------------------------------
        evidence_objects: List[AuthoritativeEvidenceObject] = []
        
        for item_id, cand_meta in candidate_items.items():
            current_pair = await CanonicalKnowledgeReader.get_current_item_version(
                db=db,
                tenant_id=tenant_id,
                item_id=item_id,
                as_of=ref_time,
            )
            if not current_pair:
                continue

            item, version = current_pair
            canonical = version.canonical_data or {}

            # Parse authoritative pricing struct
            pricing_data = canonical.get("pricing") or {}
            (
                base_price,
                visit_charge,
                parts_cost,
                discount_pct,
                tax_pct,
                calculated_total,
                commercial_type,
                pricing_notes,
                qualifying_stmt,
            ) = _compute_exact_pricing(pricing_data)

            pricing_evidence = AuthoritativePricingEvidence(
                currency=str(pricing_data.get("currency", "INR")),
                base_price=float(base_price),
                visit_diagnostic_charge=float(visit_charge),
                estimated_parts_cost=float(parts_cost),
                discount_percentage=float(discount_pct),
                tax_percentage=float(tax_pct),
                calculated_total=float(calculated_total),
                commercial_price_type=commercial_type,
                pricing_notes=pricing_notes,
                qualifying_statement=qualifying_stmt,
            )

            # Build typed evidence object
            evidence_obj = AuthoritativeEvidenceObject(
                item_id=item.id,
                external_key=item.external_identity_key,
                title=item.title or canonical.get("title", "Untitled Knowledge Item"),
                description=canonical.get("description"),
                category=item.category,
                service_area=canonical.get("service_area") or canonical.get("region"),
                business_domain=canonical.get("business_domain"),
                pricing=pricing_evidence,
                warranty=canonical.get("warranty"),
                sla=canonical.get("sla"),
                custom_attributes=canonical.get("custom_attributes") or {},
                authority_level=str(
                    (version.source.authority_level if version.source else None)
                    or canonical.get("authority_level")
                    or "imported_data"
                ),
                effective_from=version.effective_from.isoformat() if version.effective_from else None,
                effective_until=version.effective_until.isoformat() if version.effective_until else None,
                similarity_score=cand_meta["similarity_score"],
                retrieval_source=cand_meta["retrieval_source"],
            )
            evidence_objects.append(evidence_obj)

        # Sort evidence objects by similarity score descending (bounded to top_k)
        evidence_objects.sort(key=lambda x: x.similarity_score, reverse=True)
        evidence_objects = evidence_objects[: request.top_k]

        # ---------------------------------------------------------------------
        # Stage 5: Requirement-Coverage & Safety Validation Gate
        # ---------------------------------------------------------------------
        missing_reqs: List[str] = []
        decision = VerificationDecision.PROCEED
        coverage_status = "COMPLETE"
        clarification_prompt: Optional[str] = None

        if not evidence_objects:
            decision = VerificationDecision.HUMAN_HANDOFF
            coverage_status = "INSUFFICIENT"
            missing_reqs.append("NO_MATCHING_KNOWLEDGE_FOUND")
            clarification_prompt = (
                "No verified services found matching your specific inquiry. "
                "I will hand this over to our support specialists to assist you personally."
            )
        else:
            top_ev = evidence_objects[0]

            # Geographic Location Verification
            if customer_location and top_ev.service_area:
                loc_norm = customer_location.lower().strip()
                area_norm = top_ev.service_area.lower().strip()
                # Check for geographic coverage match
                if loc_norm not in area_norm and area_norm not in loc_norm:
                    missing_reqs.append(
                        f"GEOGRAPHIC_BOUNDARY_MISMATCH: Customer location '{customer_location}' "
                        f"is outside primary service area '{top_ev.service_area}'."
                    )
                    decision = VerificationDecision.CLARIFY
                    coverage_status = "PARTIAL"
                    clarification_prompt = (
                        f"Our listed service coverage is primarily in {top_ev.service_area}. "
                        f"Could you please confirm if your address in {customer_location} falls within our operational boundary?"
                    )

            # Commercial Verification Check
            if top_ev.pricing and top_ev.pricing.commercial_price_type == CommercialPriceType.QUOTE_REQUIRED:
                missing_reqs.append("QUOTE_REQUIRED: On-site inspection mandatory before pricing commitment.")
                decision = VerificationDecision.CLARIFY
                coverage_status = "PARTIAL"
                clarification_prompt = (
                    f"This service requires an on-site technician diagnostic inspection "
                    f"(fee: {top_ev.pricing.currency} {top_ev.pricing.visit_diagnostic_charge:.2f}). "
                    f"Would you like us to schedule an inspection visit?"
                )

        # ---------------------------------------------------------------------
        # Stage 6: Fact Summary Synthesis
        # ---------------------------------------------------------------------
        summary_lines: List[str] = []
        for ev in evidence_objects:
            pr = ev.pricing
            price_text = pr.qualifying_statement if pr else "Pricing not specified."
            line = f"• [{ev.external_key or 'GEN'}] {ev.title} (Area: {ev.service_area or 'Unrestricted'}): {price_text}"
            if ev.warranty and ev.warranty.get("duration_days"):
                line += f" | Warranty: {ev.warranty.get('duration_days')} days"
            if ev.sla and ev.sla.get("response_time_hours"):
                line += f" | Response SLA: {ev.sla.get('response_time_hours')}h"
            summary_lines.append(line)

        fact_summary = "\n".join(summary_lines) if summary_lines else "No verified facts available."

        validation_result = RequirementValidationResult(
            decision=decision,
            coverage_status=coverage_status,
            missing_requirements=missing_reqs,
            clarification_prompt=clarification_prompt,
            verified_fact_summary=fact_summary,
        )

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        return HybridRetrievalResponseDTO(
            query_text=request.query_text,
            tenant_id=tenant_id,
            validation=validation_result,
            evidence_objects=evidence_objects,
            total_candidates_found=len(evidence_objects),
            duration_ms=round(duration_ms, 2),
        )


hybrid_retrieval_service = HybridRetrievalService()
