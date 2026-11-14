"""Authoritative Fact Verification and Ranking Engine — Phase 4.

Responsible for:
1. Canonical PostgreSQL re-hydration of all candidate entities.
2. Tenant scope and temporal validity re-verification.
3. Strict Decimal money calculations with mandatory commercial qualification statements.
4. Hard-constraint enforcement:
   - Price range boundary verification (min_value, max_value, inclusivity, currency).
   - Location / service area validation.
   - Exact SKU / code validation.
   Candidates violating hard constraints are marked OUT_OF_BOUNDS and excluded from results.
5. Contradictory evidence and multi-source conflict arbitration.
6. Evidence coverage assessment: requested vs returned counts, missing attributes.
7. Candidate ranking based on hard-constraint satisfaction, source authority, and semantic score.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.requirement_plan import PlannedRange, RequirementPlan
from app.contracts.retrieval_result import (
    CoverageAssessment,
    EvidenceProvenance,
    FactVerificationStatus,
    FollowUpActions,
    RetrievalStatus,
    RetrievedEvidenceItem,
    VerificationAssessment,
    VerifiedPricingEvidence,
)
from app.core.logging import logger
from app.models.knowledge import KnowledgeItem, KnowledgeVersion
from app.services.hybrid_retrieval import _compute_exact_pricing, _has_real_price
from app.services.knowledge_read_contract import (
    CanonicalKnowledgeReader,
    compute_temporal_status,
    normalize_utc_timestamp,
)


AUTHORITY_WEIGHTS: Dict[str, float] = {
    "system": 1.0,
    "owner": 0.95,
    "admin": 0.90,
    "business_profile": 0.85,
    "imported_data": 0.70,
    "manual": 0.60,
    "external_source": 0.50,
    "semantic_kb": 0.40,
}


class CandidateVerificationResult:
    """Internal container for evaluated evidence."""

    def __init__(
        self,
        evidence_item: RetrievedEvidenceItem,
        is_hard_constraint_satisfied: bool,
        composite_rank_score: float,
    ):
        self.evidence_item = evidence_item
        self.is_hard_constraint_satisfied = is_hard_constraint_satisfied
        self.composite_rank_score = composite_rank_score


class FactVerifier:
    """Production fact verification and ranking engine."""

    async def verify_and_rank(
        self,
        db: AsyncSession,
        tenant_id: str,
        plan: RequirementPlan,
        structured_candidates: List[Tuple[KnowledgeItem, KnowledgeVersion]],
        semantic_candidates: List[Any],  # SemanticCandidateHit
        has_more_structured: bool = False,
        as_of: Optional[datetime] = None,
        eligibility_spec: Optional[Any] = None,
        structured_origin: Optional[Dict[str, Tuple[str, float]]] = None,
        fused_relevance: Optional[Dict[str, float]] = None,
    ) -> Tuple[List[RetrievedEvidenceItem], CoverageAssessment, VerificationAssessment, FollowUpActions, RetrievalStatus, List[str]]:
        """Verify all candidates against authoritative truth and rank the final evidence set.

        ``eligibility_spec`` (entity_eligibility.RequestSpec): what the customer asked for —
        role, product family, compatibility target, sizes, minimum specs. Candidates that
        violate it are rejected BEFORE ranking, so no similarity score can override a
        category / role / compatibility mismatch.
        ``structured_origin``: item_id -> (origin, relevance) for structured candidates:
        exact_key | family | constrained | lexical | generic. An unranked category listing
        ("generic") carries no relevance and must never outrank a relevant match.
        """
        ref_time = normalize_utc_timestamp(as_of)
        warnings: List[str] = []

        # ---------------------------------------------------------------------
        # 1. Merge and Deduplicate Candidates by KnowledgeItem.id
        # ---------------------------------------------------------------------
        # Map item_id -> {"item": item, "version": version, "semantic_score": score, "passages": [], "path": path}
        merged_candidates: Dict[str, Dict[str, Any]] = {}

        # Ingest structured candidates (exact key or category/range)
        origin_map = structured_origin or {}
        for item, version in structured_candidates:
            origin, rel = origin_map.get(item.id, ("exact_structured", 1.0))
            merged_candidates[item.id] = {
                "item": item,
                "version": version,
                "semantic_score": rel,
                "passages": [],
                "passage_versions": [],
                "path": origin,
            }

        # Ingest semantic candidates from Qdrant
        for sem_hit in semantic_candidates:
            item_id = sem_hit.knowledge_item_id
            if item_id in merged_candidates:
                # Elevate existing candidate - unless the second sighting comes from a keyword
                # search that could not read the whole question: agreement on the leftover
                # words ("hotel room") is not independent confirmation of the asked-for item.
                if not (getattr(sem_hit, "payload", None) or {}).get("lexical_blind"):
                    merged_candidates[item_id]["path"] = "hybrid"
                merged_candidates[item_id]["semantic_score"] = max(
                    merged_candidates[item_id]["semantic_score"], sem_hit.score
                )
                if sem_hit.text_excerpt:
                    merged_candidates[item_id]["passages"].append(sem_hit.text_excerpt)
                    merged_candidates[item_id]["passage_versions"].append(sem_hit.knowledge_version_id)
            else:
                merged_candidates[item_id] = {
                    "item": None,  # Will resolve from DB
                    "version": None,
                    "semantic_score": sem_hit.score,
                    "passages": [sem_hit.text_excerpt] if sem_hit.text_excerpt else [],
                    "passage_versions": [sem_hit.knowledge_version_id] if sem_hit.text_excerpt else [],
                    "path": "semantic_discovery",
                }

        # ---------------------------------------------------------------------
        # 2. Canonical PostgreSQL Re-hydration and Authority Verification
        # ---------------------------------------------------------------------
        evaluated_candidates: List[CandidateVerificationResult] = []
        conflicts: List[str] = []
        conflict_details: List[Dict[str, Any]] = []
        requested_skus: Set[str] = set()
        for entity in plan.entities:
            if entity.entity_type in ("sku", "service_code", "product_code"):
                k = entity.canonical_value or entity.original_text
                if k and k.strip():
                    requested_skus.add(k.upper().strip())

        # "Spare parts for model X": X names the parent product the customer owns, not the item
        # requested — the eligibility layer checks compatibility with X instead.
        if eligibility_spec is not None and getattr(eligibility_spec, "target_models", None):
            requested_skus -= {m.upper().strip() for m in eligibility_spec.target_models}

        # Pre-fetch all missing semantic candidates in a single batch query
        missing_ids = [mid for mid, c in merged_candidates.items() if c["item"] is None or c["version"] is None]
        rehydrated_map: Dict[str, Tuple[KnowledgeItem, KnowledgeVersion]] = {}
        if missing_ids:
            rehydrated_map = await CanonicalKnowledgeReader.get_current_items_batch(
                db=db,
                tenant_id=tenant_id,
                item_ids=missing_ids,
                as_of=ref_time,
            )

        for item_id, cand in merged_candidates.items():
            item = cand["item"]
            version = cand["version"]

            # Rehydrate from pre-fetched batch if missing
            if item is None or version is None:
                pair = rehydrated_map.get(item_id)
                if not pair:
                    # Item is inactive, expired, or deleted in PostgreSQL
                    continue
                item, version = pair

            # Outdated-text guard: a vector can briefly outlive its version (e.g. while a
            # sync retries). Facts always come from the current version re-hydrated from
            # PostgreSQL; drop any passage whose chunk belongs to a different version.
            if cand.get("passages"):
                kept = [
                    txt for txt, ver_id in zip(cand["passages"], cand.get("passage_versions") or [])
                    if not ver_id or ver_id == version.id
                ]
                if len(kept) != len(cand["passages"]):
                    logger.info(
                        "Dropped outdated semantic passages",
                        item_id=item_id,
                        current_version=version.id,
                        dropped=len(cand["passages"]) - len(kept),
                    )
                cand["passages"] = kept

            # Strict Tenant Isolation Assertion
            if item.tenant_id != tenant_id or version.tenant_id != tenant_id:
                logger.error(
                    "SECURITY: Cross-tenant candidate blocked during fact verification",
                    expected_tenant=tenant_id,
                    item_tenant=item.tenant_id,
                    version_tenant=version.tenant_id,
                    item_id=item_id,
                )
                continue

            # Novelty Exclusion Guard for continuation requests (MORE_OPTIONS)
            if plan.excluded_entity_ids:
                excluded_set = {x.upper().strip() for x in plan.excluded_entity_ids if x and str(x).strip()} | {x.strip() for x in plan.excluded_entity_ids if x and str(x).strip()}
                ext_key = (item.external_identity_key or "").strip().upper()
                if item.id in excluded_set or (ext_key and ext_key in excluded_set):
                    continue

            canonical = version.canonical_data or {}
            pricing_data = canonical.get("pricing") or {}
            if not pricing_data and "price" in canonical:
                pricing_data = {
                    "base_price": canonical["price"],
                    "currency": canonical.get("currency", "INR"),
                }

            # Exact Decimal Pricing Calculations
            pricing_evidence: Optional[VerifiedPricingEvidence] = None
            if pricing_data:
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

            # A price of 0 (or blank) in an imported sheet means "not listed", never "free".
            # Produce NO price evidence for it: the requirement is then reported as missing
            # price information, so the reply says the price will be confirmed instead of
            # quoting ₹0, and such items can never satisfy a "under ₹X" price filter.
            if pricing_data and not _has_real_price(base_price, calculated_total):
                pricing_data = {}

            if pricing_data:
                pricing_evidence = VerifiedPricingEvidence(
                    currency=str(pricing_data.get("currency", "INR")).upper(),
                    base_price=float(base_price),
                    visit_diagnostic_charge=float(visit_charge),
                    estimated_parts_cost=float(parts_cost),
                    discount_percentage=float(discount_pct),
                    tax_percentage=float(tax_pct),
                    calculated_total=float(calculated_total),
                    commercial_price_type=commercial_type.value,
                    pricing_notes=pricing_notes,
                    qualifying_statement=qualifying_stmt,
                )

            # -----------------------------------------------------------------
            # 3. Hard-Constraint Verification
            # -----------------------------------------------------------------
            is_valid = True
            satisfied_constraints: List[str] = []
            unmet_constraints: List[str] = []

            # 3A. Price Range & Currency Gate
            if plan.range_semantics and plan.range_semantics.field == "price":
                rng = plan.range_semantics
                if not pricing_evidence:
                    is_valid = False
                    unmet_constraints.append("missing_price_data")
                else:
                    item_price = Decimal(str(pricing_evidence.calculated_total))
                    item_currency = pricing_evidence.currency

                    # Currency constraint
                    if rng.currency and rng.currency.upper() != item_currency:
                        is_valid = False
                        unmet_constraints.append(f"currency_mismatch_{item_currency}_vs_{rng.currency}")
                    else:
                        satisfied_constraints.append(f"currency_match_{item_currency}")

                    # Min value constraint
                    if rng.min_value is not None:
                        min_dec = Decimal(str(rng.min_value))
                        if rng.is_min_inclusive:
                            if item_price < min_dec:
                                is_valid = False
                                unmet_constraints.append(f"price_{item_price}_below_min_{min_dec}")
                            else:
                                satisfied_constraints.append(f"price_{item_price}_gte_{min_dec}")
                        else:
                            if item_price <= min_dec:
                                is_valid = False
                                unmet_constraints.append(f"price_{item_price}_lte_min_{min_dec}")
                            else:
                                satisfied_constraints.append(f"price_{item_price}_gt_{min_dec}")

                    # Max value constraint
                    if rng.max_value is not None:
                        max_dec = Decimal(str(rng.max_value))
                        if rng.is_max_inclusive:
                            if item_price > max_dec:
                                is_valid = False
                                unmet_constraints.append(f"price_{item_price}_above_max_{max_dec}")
                            else:
                                satisfied_constraints.append(f"price_{item_price}_lte_{max_dec}")
                        else:
                            if item_price >= max_dec:
                                is_valid = False
                                unmet_constraints.append(f"price_{item_price}_gte_max_{max_dec}")
                            else:
                                satisfied_constraints.append(f"price_{item_price}_lt_{max_dec}")

            # 3B. Exact SKU / Service Code Gate
            if requested_skus:
                act_key = (item.external_identity_key or canonical.get("sku") or "").upper().strip()
                if act_key and act_key in requested_skus:
                    satisfied_constraints.append(f"sku_match_{act_key}")
                elif act_key and act_key not in requested_skus:
                    # Candidate does not match any of the specifically requested SKUs — hard rejection
                    is_valid = False
                    unmet_constraints.append(f"sku_unrequested_{act_key}")

            # 3C. Provenance & Temporal Status
            temp_status = compute_temporal_status(version.effective_from, version.effective_until, ref_time)
            if temp_status != "current":
                is_valid = False
                unmet_constraints.append(f"temporal_status_{temp_status}")

            authority_level = str(version.authority_level or "imported_data").lower()
            auth_weight = AUTHORITY_WEIGHTS.get(authority_level, 0.6)

            provenance = EvidenceProvenance(
                source_system="postgresql",
                source_id=version.source_id,
                source_type=item.source_type,
                version_id=version.id,
                authority_level=authority_level,
                authority_score=auth_weight,
                effective_from=version.effective_from.isoformat() if version.effective_from else None,
                effective_until=version.effective_until.isoformat() if version.effective_until else None,
                temporal_status=temp_status,
            )

            # 3D. Requirement eligibility: role / family / compatibility / specs (generic)
            elig = None
            if eligibility_spec is not None and getattr(eligibility_spec, "active", False):
                from app.services.retrieval_router.entity_eligibility import evaluate as _evaluate

                elig = _evaluate(canonical, item.title, item.external_identity_key, eligibility_spec)
                satisfied_constraints.extend(elig.satisfied)
                unmet_constraints.extend(elig.unmet)
                if not elig.eligible:
                    is_valid = False

            # Verification classification
            ver_status = FactVerificationStatus.VERIFIED if is_valid else FactVerificationStatus.OUT_OF_BOUNDS

            # Composite ranking score (eligible candidates only are ever returned):
            # origin prior + relevance (semantic / lexical) + requirement fit + authority.
            # The old "structured = base 100" rule let an unranked category listing outrank
            # every relevant semantic match (root cause of the air-curtain incident).
            sem_score = cand["semantic_score"]
            if fused_relevance is not None:
                # Rank-fused relevance (RRF of semantic + lexical ranks); exact identifiers
                # keep full relevance, items found by neither list get none.
                if cand["path"] == "exact_key":
                    sem_score = max(sem_score, fused_relevance.get(item_id, 0.0))
                else:
                    sem_score = fused_relevance.get(item_id, 0.0)
            origin_prior = {
                "exact_key": 100.0, "exact_structured": 60.0, "constrained": 60.0, "hybrid": 60.0,
                "lexical": 40.0, "family": 40.0, "semantic_discovery": 40.0, "generic": 0.0,
            }.get(cand["path"], 40.0)
            composite_score = (
                origin_prior
                + (50.0 if is_valid else -100.0)
                + (auth_weight * 5.0)
                + (sem_score * 40.0)
            )
            if elig is not None:
                composite_score += (100.0 if elig.exact_match else 0.0) + (25.0 if elig.family_match else 0.0)                     + (10.0 if any(x.startswith("role_") for x in elig.satisfied) else 0.0) + elig.fit_bonus * 15.0

            evidence_item = RetrievedEvidenceItem(
                entity_id=item.id,
                external_identity_key=item.external_identity_key or canonical.get("sku"),
                title=item.title or canonical.get("name") or "Untitled Knowledge Item",
                description=canonical.get("description"),
                category=item.category,
                service_area=canonical.get("service_area") or canonical.get("region"),
                pricing=pricing_evidence,
                warranty=canonical.get("warranty"),
                sla=canonical.get("sla"),
                attributes={
                    **(canonical.get("custom_attributes") or {}),
                    **({"product_role": elig.facets.role.value,
                        "product_family": elig.facets.family or None,
                        "match_notes": elig.notes} if elig is not None else {}),
                },
                semantic_passages=cand["passages"],
                relevance_score=round(sem_score, 4),
                retrieval_path=cand["path"],
                verification_status=ver_status,
                provenance=provenance,
                satisfied_constraints=satisfied_constraints,
                unmet_constraints=unmet_constraints,
            )

            evaluated_candidates.append(
                CandidateVerificationResult(
                    evidence_item=evidence_item,
                    is_hard_constraint_satisfied=is_valid,
                    composite_rank_score=composite_score,
                )
            )

        # ---------------------------------------------------------------------
        # 4. Rank and Filter Candidates
        # ---------------------------------------------------------------------
        # Only retain candidates satisfying hard constraints
        valid_candidates = [c for c in evaluated_candidates if c.is_hard_constraint_satisfied]
        valid_candidates.sort(key=lambda c: c.composite_rank_score, reverse=True)

        # Determine target count limit (from plan's requested count or max safe limit 20)
        target_count = plan.requested_result_count.final_count or 5
        target_count = min(max(target_count, 1), plan.requested_result_count.max_safe_limit)

        final_evidence = [c.evidence_item for c in valid_candidates[:target_count]]
        has_more = has_more_structured or (len(valid_candidates) > target_count)

        # ---------------------------------------------------------------------
        # 5. Coverage Assessment
        # ---------------------------------------------------------------------
        satisfied_attrs: Set[str] = set()
        missing_attrs: Set[str] = set()

        for req_attr in plan.requested_attributes:
            req_lower = req_attr.lower().strip()
            found = False
            for ev in final_evidence:
                if req_lower == "price" and ev.pricing:
                    found = True
                    break
                elif req_lower == "warranty" and (ev.warranty or (ev.attributes and "warranty" in str(ev.attributes).lower())):
                    found = True
                    break
                elif req_lower in ev.attributes:
                    found = True
                    break

            if found:
                satisfied_attrs.add(req_attr)
            else:
                missing_attrs.add(req_attr)

        coverage = CoverageAssessment(
            requested_count=target_count,
            returned_count=len(final_evidence),
            satisfied_attributes=sorted(list(satisfied_attrs)),
            missing_attributes=sorted(list(missing_attrs)),
            unmet_constraints=[],
            has_more=has_more,
        )

        verification = VerificationAssessment(
            exact_facts_checked=True,
            hard_constraints_satisfied=len(final_evidence) > 0,
            unresolved_conflicts=conflicts,
            conflict_details=conflict_details,
        )

        # ---------------------------------------------------------------------
        # 6. Operational Follow-Up and Status Determination
        # ---------------------------------------------------------------------
        follow_up = FollowUpActions(
            clarification_required=plan.clarification_required,
            clarification_reason=plan.clarification_reason,
            workflow_action_required=False,
            required_workflow_type=None,
            operational_limitation_reason=None,
        )

        # Check for operational workflows: e.g. booking an appointment or delivery
        intent_val = plan.intent.value.lower()
        query_lower = (plan.query_text or "").lower()
        is_scheduling_request = (
            "booking" in intent_val
            or "appointment" in intent_val
            or "order_or_delivery" in intent_val
            or (intent_val == "availability_query" and any(w in query_lower for w in ("book", "appointment", "schedule", "tomorrow", "friday", "slot", "technician")))
            or any(w in query_lower for w in ("book a", "book an", "schedule a", "schedule an", "need an appointment"))
        )
        if is_scheduling_request:
            follow_up.workflow_action_required = True
            follow_up.required_workflow_type = (
                "appointment_scheduling"
                if any(w in query_lower or w in intent_val for w in ("appointment", "technician", "ac", "repair", "service"))
                else "delivery_scheduling"
            )
            follow_up.operational_limitation_reason = (
                "Transactional booking slot reservation requires customer confirmation through operational scheduler. "
                "Retrieved service details and prerequisites are provided as authoritative guidance."
            )

        # Classify overall status
        if follow_up.workflow_action_required and not final_evidence:
            status = RetrievalStatus.CAPABILITY_UNAVAILABLE
            warnings.append(follow_up.operational_limitation_reason or "Operational capability requires separate workflow.")
        elif not final_evidence:
            status = RetrievalStatus.NO_MATCH
            warnings.append("Zero records matched the validated requirements and price boundaries.")
        elif missing_attrs or (len(final_evidence) < target_count and target_count > 1):
            status = RetrievalStatus.PARTIAL
            if len(final_evidence) < target_count:
                warnings.append(f"Requested {target_count} options, but only {len(final_evidence)} eligible records exist.")
            if missing_attrs:
                warnings.append(f"Requested attributes {sorted(list(missing_attrs))} not available on all returned records.")
        else:
            status = RetrievalStatus.SUCCESS

        return final_evidence, coverage, verification, follow_up, status, warnings


fact_verifier = FactVerifier()
