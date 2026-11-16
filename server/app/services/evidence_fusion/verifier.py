"""Evidence Fact Verifier — Phase 5: Candidate Fusion & Evidence Verification.

Performs hard constraint validation, source authority ranking, conflict resolution,
and per-requirement coverage aggregation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from app.contracts.evidence_fusion import (
    CandidateRole,
    ConflictRecord,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
    VerifiedFact,
)
from app.contracts.requirement_plan import PlannedRange, RequirementPlan
from app.contracts.retrieval_result import FactVerificationStatus
from app.core.logging import logger
from app.services.evidence_fusion.normalizer import CandidateNormalizer

AUTHORITY_WEIGHTS: Dict[str, float] = {
    "operational_system": 1.00,
    "approved_policy": 0.95,
    "official_manual": 0.90,
    "verified_canonical": 0.85,
    "imported_data": 0.60,
    "unverified_semantic": 0.40,
}


class EvidenceFactVerifier:
    """Deterministic fact verifier and per-requirement coverage evaluator."""

    @classmethod
    def verify_and_rank_group(
        cls,
        group: RequirementEvidenceGroup,
        candidates: List[VerifiedCandidate],
        plan: RequirementPlan,
        tenant_id: str,
        as_of: Optional[datetime] = None,
        group_def: Optional[Any] = None,
    ) -> Tuple[List[VerifiedCandidate], List[VerifiedFact], List[ConflictRecord], List[str]]:
        """Verify hard constraints and rank candidates for a specific requirement group."""
        ref_time = as_of or datetime.now(timezone.utc)
        verified_candidates: List[VerifiedCandidate] = []
        verified_facts: List[VerifiedFact] = []
        conflicts: List[ConflictRecord] = []
        warnings: List[str] = []

        # Target set for targeted requirements
        requested_targets_set: Set[str] = {t.upper().strip() for t in group.requested_targets if t.strip()}

        for cand in candidates:
            is_valid = True
            satisfied: List[str] = list(cand.satisfied_constraints)
            unmet: List[str] = list(cand.unmet_constraints)

            # -----------------------------------------------------------------
            # 1. Hard Constraint: Tenant Security Isolation
            # -----------------------------------------------------------------
            # Candidates must not cross tenant boundaries
            cand_tenant = cand.tenant_id or cand.provenance.tenant_id or tenant_id
            if cand_tenant != tenant_id:
                logger.error(
                    "SECURITY: Cross-tenant candidate blocked in fusion verifier",
                    expected_tenant=tenant_id,
                    candidate_tenant=cand_tenant,
                    candidate_id=cand.candidate_id,
                )
                cand.verification_status = FactVerificationStatus.OUT_OF_BOUNDS
                unmet.append("cross_tenant_violation")
                continue

            # Novelty Exclusion Guard for continuation requests (MORE_OPTIONS)
            if plan.excluded_entity_ids:
                excluded_set = {x.upper().strip() for x in plan.excluded_entity_ids if x and str(x).strip()} | {x.strip() for x in plan.excluded_entity_ids if x and str(x).strip()}
                ext_key = (cand.external_identity_key or "").strip().upper()
                if cand.entity_id in excluded_set or (ext_key and ext_key in excluded_set):
                    cand.verification_status = FactVerificationStatus.OUT_OF_BOUNDS
                    unmet.append("previously_presented_exclusion")
                    continue

            # -----------------------------------------------------------------
            # 2. Hard Constraint: Numeric Price Boundaries (if applicable)
            # -----------------------------------------------------------------
            range_filter: Optional[PlannedRange] = None
            if group_def and getattr(group_def, "range_semantics", None):
                range_filter = group_def.range_semantics
            elif plan.range_semantics and group.requirement_type == RequirementType.PRODUCT_SERVICE_DISCOVERY:
                range_filter = plan.range_semantics

            if range_filter and range_filter.field == "price" and cand.pricing:
                rng: PlannedRange = range_filter
                item_price = Decimal(str(cand.pricing.calculated_total))

                # Currency check
                if rng.currency and cand.pricing.currency != rng.currency:
                    is_valid = False
                    unmet.append(f"currency_mismatch_{cand.pricing.currency}_vs_{rng.currency}")
                else:
                    # Min boundary
                    if rng.min_value is not None:
                        min_dec = Decimal(str(rng.min_value))
                        if rng.is_min_inclusive:
                            if item_price < min_dec:
                                is_valid = False
                                unmet.append(f"price_{item_price}_below_min_{min_dec}")
                            else:
                                satisfied.append(f"price_{item_price}_gte_{min_dec}")
                        else:
                            if item_price <= min_dec:
                                is_valid = False
                                unmet.append(f"price_{item_price}_lte_min_{min_dec}")
                            else:
                                satisfied.append(f"price_{item_price}_gt_{min_dec}")

                    # Max boundary
                    if rng.max_value is not None:
                        max_dec = Decimal(str(rng.max_value))
                        if rng.is_max_inclusive:
                            if item_price > max_dec:
                                is_valid = False
                                unmet.append(f"price_{item_price}_above_max_{max_dec}")
                            else:
                                satisfied.append(f"price_{item_price}_lte_{max_dec}")
                        else:
                            if item_price >= max_dec:
                                is_valid = False
                                unmet.append(f"price_{item_price}_gte_max_{max_dec}")
                            else:
                                satisfied.append(f"price_{item_price}_lt_{max_dec}")

            # -----------------------------------------------------------------
            # 3. Hard Constraint: Target Set Membership
            # -----------------------------------------------------------------
            if requested_targets_set and group.requirement_type == RequirementType.COMPARISON:
                ext_key = (cand.external_identity_key or "").upper().strip()
                title_up = cand.title.upper().strip()
                from app.services.evidence_fusion.matcher import TargetEntityMatcher
                is_member = ext_key in requested_targets_set or any(TargetEntityMatcher._matches_target(t, ext_key, title_up) for t in requested_targets_set)
                if not is_member:
                    is_valid = False
                    unmet.append(f"target_unrequested_{ext_key or cand.title}")

            # -----------------------------------------------------------------
            # 4. Temporal Validity Check
            # -----------------------------------------------------------------
            if cand.provenance.effective_until:
                try:
                    eff_until = datetime.fromisoformat(cand.provenance.effective_until)
                    if eff_until <= ref_time:
                        is_valid = False
                        unmet.append("version_expired")
                        cand.verification_status = FactVerificationStatus.EXPIRED
                except Exception:
                    pass

            # -----------------------------------------------------------------
            # 5. Composite Ranking Score
            # -----------------------------------------------------------------
            auth_level = (cand.provenance.authority_level or "imported_data").lower()
            auth_weight = AUTHORITY_WEIGHTS.get(auth_level, 0.60)
            if is_valid:
                cand.verification_status = FactVerificationStatus.VERIFIED
                # Role alignment bonus
                role_alignment = 0.0
                if group.requirement_type == RequirementType.SUPPORT_TROUBLESHOOTING and cand.candidate_role == CandidateRole.TROUBLESHOOTING_GUIDE:
                    role_alignment = 100.0
                elif group.requirement_type == RequirementType.CONTACT_RESOLUTION and cand.candidate_role == CandidateRole.CONTACT_CARD:
                    role_alignment = 100.0
                elif group.requirement_type == RequirementType.POLICY_QUERY and cand.candidate_role == CandidateRole.POLICY_DOCUMENT:
                    role_alignment = 100.0
                elif group.requirement_type in (RequirementType.COMPARISON, RequirementType.PRODUCT_SERVICE_DISCOVERY) and cand.candidate_role == CandidateRole.PRODUCT_SERVICE:
                    role_alignment = 100.0

                # Base score + hard constraint satisfaction + authority + semantic + role alignment
                cand.composite_score = (
                    100.0  # Base
                    + (50.0 if any("target_match_" in s for s in satisfied) else 0.0)
                    + (auth_weight * 20.0)
                    + min(cand.relevance_score * 10.0, 10.0)
                    + role_alignment
                )
            else:
                cand.verification_status = FactVerificationStatus.OUT_OF_BOUNDS
                cand.composite_score = -100.0

            cand.satisfied_constraints = satisfied
            cand.unmet_constraints = unmet

            if is_valid:
                verified_candidates.append(cand)
                # Extract verified atomic facts
                atomic_facts = CandidateNormalizer.extract_atomic_facts(cand)
                verified_facts.extend(atomic_facts)

        # Sort verified candidates by composite score descending
        verified_candidates.sort(key=lambda c: c.composite_score, reverse=True)
        order = getattr(group_def, "price_order", None) if group_def is not None else None
        if order:
            # "cheapest / most expensive": price decides, relevance only breaks ties (retrieval
            # already filtered to eligible items); unpriced items go last.
            def _p(c):
                v = getattr(c.pricing, "calculated_total", None) if c.pricing else None
                return float(v) if v not in (None, "") and float(v) > 0 else None
            priced = sorted([c for c in verified_candidates if _p(c) is not None],
                            key=lambda c: (_p(c) if order == "asc" else -_p(c), -c.composite_score))
            verified_candidates = priced + [c for c in verified_candidates if _p(c) is None]

        # Closest-code suggestions (requested code does not exist) are kept apart from the count.
        suggestions = [c for c in verified_candidates if getattr(c, "near_match_for", None)][:3]
        verified_candidates = [c for c in verified_candidates if not getattr(c, "near_match_for", None)]

        # Respect explicit count limit (if specified)
        target_limit = group.requested_count
        if target_limit > 0 and len(verified_candidates) > target_limit:
            # For comparison with explicit targets, keep all verified targets!
            if group.requirement_type != RequirementType.COMPARISON:
                verified_candidates = verified_candidates[:target_limit]
        verified_candidates = verified_candidates + suggestions

        return verified_candidates, verified_facts, conflicts, warnings

    @classmethod
    def assess_group_coverage(
        cls,
        group: RequirementEvidenceGroup,
        verified_candidates: List[VerifiedCandidate],
    ) -> RequirementCoverageStatus:
        """Evaluate evidence coverage for a requirement group."""
        group.returned_count = len(verified_candidates)
        group.verified_candidates = verified_candidates

        # 0. Unconfigured Category (withheld to prevent hallucination)
        if group.status == RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED:
            return group.status

        # 1. Operational Scheduling
        if group.requirement_type == RequirementType.OPERATIONAL_SCHEDULING:
            # Invariant: live slot checking requires operational workflow
            group.status = RequirementCoverageStatus.CAPABILITY_UNAVAILABLE
            group.missing_evidence_reasons.append("Operational scheduling integration required to book slot.")
            return group.status

        # 2. Conversational Greeting
        if group.requirement_type == RequirementType.CONVERSATIONAL_GREETING:
            group.status = RequirementCoverageStatus.NO_RETRIEVAL_REQUIRED
            return group.status

        # 3. Zero Candidates Matched
        if not verified_candidates:
            group.status = RequirementCoverageStatus.NO_MATCH
            group.missing_evidence_reasons.append("Zero records matched the required entities or constraints.")
            return group.status

        # 4. Attribute Satisfaction
        satisfied_attrs: Set[str] = set()
        missing_attrs: Set[str] = set()

        for req_attr in group.required_attributes:
            attr_lower = req_attr.lower().strip()
            found = False
            for c in verified_candidates:
                if attr_lower in ("price", "pricing", "base_price", "total_price", "price_if_present") and c.pricing:
                    found = True
                    break
                elif attr_lower in ("name", "title", "service_name", "product_name") and c.title:
                    found = True
                    break
                elif attr_lower in ("description", "desc") and c.description:
                    found = True
                    break
                elif attr_lower == "warranty" and (c.warranty or "warranty" in str(c.attributes).lower()):
                    found = True
                    break
                elif attr_lower == "troubleshooting_guidance" and (c.candidate_role == CandidateRole.TROUBLESHOOTING_GUIDE or c.semantic_passages):
                    found = True
                    break
                elif attr_lower in ("contact_email", "contact_phone") and c.candidate_role == CandidateRole.CONTACT_CARD:
                    found = True
                    break
                elif attr_lower == "policy_statement" and (c.candidate_role == CandidateRole.POLICY_DOCUMENT or c.semantic_passages):
                    found = True
                    break
                elif attr_lower in c.attributes:
                    found = True
                    break

            if found:
                satisfied_attrs.add(req_attr)
            else:
                missing_attrs.add(req_attr)

        group.satisfied_attributes = sorted(list(satisfied_attrs))
        group.missing_attributes = sorted(list(missing_attrs))

        # 5. Targeted Comparison Coverage
        if group.requirement_type == RequirementType.COMPARISON:
            if group.missing_targets:
                group.status = RequirementCoverageStatus.PARTIAL
                group.missing_evidence_reasons.append(f"Missing comparison targets: {', '.join(group.missing_targets)}")
            elif missing_attrs:
                group.status = RequirementCoverageStatus.PARTIAL
                group.missing_evidence_reasons.append(f"Missing attributes: {', '.join(missing_attrs)}")
            else:
                group.status = RequirementCoverageStatus.COMPLETE
            return group.status

        # 6. General Discovery or Support Coverage
        if missing_attrs:
            group.status = RequirementCoverageStatus.PARTIAL
            group.missing_evidence_reasons.append(f"Missing required attributes: {', '.join(missing_attrs)}")
        elif group.requested_count > 1 and len(verified_candidates) < group.requested_count:
            group.status = RequirementCoverageStatus.PARTIAL
            group.missing_evidence_reasons.append(
                f"Requested {group.requested_count} results, but only {len(verified_candidates)} found."
            )
        else:
            group.status = RequirementCoverageStatus.COMPLETE

        return group.status

    @classmethod
    def aggregate_overall_status(
        cls,
        groups: List[RequirementEvidenceGroup],
    ) -> EvidenceOverallStatus:
        """Consolidate per-requirement coverage statuses into an honest overall outcome.
        
        Principle:
        Never label a multi-requirement email as COMPLETE if any material requirement
        is partial, unsupported, or has an unavailable capability!
        """
        if not groups:
            return EvidenceOverallStatus.NO_MATCH

        # Check for greeting or standalone non-retrieval
        if all(g.status == RequirementCoverageStatus.NO_RETRIEVAL_REQUIRED for g in groups):
            return EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED

        # Check for material ambiguity
        if any(g.status == RequirementCoverageStatus.NEEDS_CLARIFICATION for g in groups):
            return EvidenceOverallStatus.NEEDS_CLARIFICATION

        # Check for conflicts
        if any(g.status == RequirementCoverageStatus.CONFLICTING_EVIDENCE for g in groups):
            return EvidenceOverallStatus.CONFLICTING_EVIDENCE

        # Check if all requirements are COMPLETE
        all_complete = all(g.status == RequirementCoverageStatus.COMPLETE for g in groups)
        if all_complete:
            return EvidenceOverallStatus.COMPLETE

        # Check if all requirements returned NO_MATCH or CATEGORY_NOT_CONFIGURED
        all_no_match = all(
            g.status in (RequirementCoverageStatus.NO_MATCH, RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED)
            for g in groups
        )
        if all_no_match:
            return EvidenceOverallStatus.NO_MATCH

        # If any requirement is PARTIAL or CAPABILITY_UNAVAILABLE while others succeeded, overall is PARTIAL
        return EvidenceOverallStatus.PARTIAL
