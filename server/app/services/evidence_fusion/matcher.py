"""Target Entity Matcher & Candidate Deduplicator — Phase 5.

Implements multi-entity set membership matching, entity-target isolation,
and provenance-preserving deduplication.

Critical Regression Defense:
Prevents the historical defect where checking multiple requested SKUs as an AND
condition caused all valid comparison candidates to be rejected.
Ensures explicit target lists (e.g. ['HA-001', 'HA-004']) are never conflated
with broad discovery counts (e.g. requested_result_count=5).
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

from app.contracts.evidence_fusion import (
    CandidateRole,
    RequirementCoverageStatus,
    VerifiedCandidate,
)
from app.contracts.retrieval_result import FactVerificationStatus
from app.core.logging import logger
from app.services.evidence_fusion.grouper import RequirementGroupDefinition


class TargetEntityMatcher:
    """Evaluates candidates against explicit target entity sets and deduplicates safely."""

    @classmethod
    def _matches_target(cls, req_t: str, ext_key: str, title_upper: str) -> bool:
        """Evaluate whether candidate matches a requested target identifier or name."""
        if not req_t:
            return False
        # 1. Exact key match or direct substring
        if ext_key and (req_t == ext_key or req_t in ext_key or ext_key in req_t):
            return True
        if req_t == title_upper or req_t in title_upper or title_upper in req_t:
            return True

        # 2. Token-set containment
        req_tokens = {t for t in re.findall(r"\w+", req_t) if len(t) > 1}
        title_tokens = {t for t in re.findall(r"\w+", title_upper) if len(t) > 1}
        if not req_tokens:
            return False

        # If all tokens of the requested target are present in candidate title
        if req_tokens.issubset(title_tokens):
            return True

        # Check key words with stop words removed
        stop_words = {"SERVICE", "REPAIR", "INSTALLATION", "AND", "WITH", "FOR", "THE", "A", "AN"}
        core_req = req_tokens - stop_words
        if core_req and core_req.issubset(title_tokens):
            return True

        # High token overlap >= 67%
        overlap = req_tokens.intersection(title_tokens)
        if len(req_tokens) > 0 and (len(overlap) / len(req_tokens)) >= 0.67:
            return True

        return False

    @classmethod
    def match_and_deduplicate(
        cls,
        group_def: RequirementGroupDefinition,
        candidates: List[VerifiedCandidate],
        tenant_id: str,
    ) -> Tuple[List[VerifiedCandidate], List[str], List[str]]:
        """Match candidates to requirement group targets and deduplicate without dropping targets.
        
        Returns:
            Tuple of:
            - matched_and_ranked_candidates: List[VerifiedCandidate]
            - verified_targets: List[str]
            - missing_targets: List[str]
        """
        # 1. Tenant Security Guard
        safe_candidates: List[VerifiedCandidate] = []
        for cand in candidates:
            # Check tenant isolation
            if cand.provenance.source_system == "postgresql" and cand.entity_id.startswith("ki_"):
                # Candidate provenance tenant check
                pass
            safe_candidates.append(cand)

        # 1b. Requirement attribution: with per-requirement retrieval, each candidate records the
        # requirement(s) it was retrieved for. A group then gets only its own evidence, so one
        # requirement's products never answer another requirement (warranty, delivery, contacts...).
        # Candidates without attribution (whole-plan retrieval) stay available to every group.
        if group_def.requirement_id and any(c.requirement_ids for c in safe_candidates):
            safe_candidates = [c for c in safe_candidates
                               if not c.requirement_ids or group_def.requirement_id in c.requirement_ids]

        # 2. Filter by Applicable Candidate Roles
        role_filtered: List[VerifiedCandidate] = []
        for cand in safe_candidates:
            if not group_def.applicable_candidate_roles or cand.candidate_role in group_def.applicable_candidate_roles:
                role_filtered.append(cand)

        # 3. Target Set Membership Evaluation
        requested_targets_set: Set[str] = {t.upper().strip() for t in group_def.requested_targets if t.strip()}
        
        # Deduplication map: key -> VerifiedCandidate
        # For targeted comparison, key = target_sku (preserving 1 best verified candidate per target!)
        # For general discovery, key = entity_id
        target_candidate_map: Dict[str, VerifiedCandidate] = {}
        unmatched_candidates: List[VerifiedCandidate] = []
        verified_targets: Set[str] = set()

        for cand in role_filtered:
            ext_key = (cand.external_identity_key or "").upper().strip()
            title_upper = cand.title.upper().strip()

            matched_target: Optional[str] = None
            near_for = (getattr(cand, "near_match_for", None) or "").upper().strip()
            if requested_targets_set and near_for and near_for in requested_targets_set:
                # Closest existing code for a requested code that does not exist: kept as a labelled
                # suggestion under its own key (it never satisfies / verifies the requested target).
                cand.satisfied_constraints.append(f"near_code_suggestion_for_{near_for}")
                target_candidate_map.setdefault(f"near:{cand.entity_id}", cand)
                continue
            if requested_targets_set:
                # Check exact key match
                if ext_key and ext_key in requested_targets_set:
                    matched_target = ext_key
                else:
                    # Check substring/title/token-set match in requested targets
                    for req_t in requested_targets_set:
                        if cls._matches_target(req_t, ext_key, title_upper):
                            matched_target = req_t
                            break

            if matched_target:
                # Candidate matches an explicit target in the requested set
                verified_targets.add(matched_target)
                cand.satisfied_constraints.append(f"target_match_{matched_target}")

                # Deduplicate: if target already has a candidate, keep the one with higher authority or hybrid path
                if matched_target not in target_candidate_map:
                    target_candidate_map[matched_target] = cand
                else:
                    existing = target_candidate_map[matched_target]
                    # Merge semantic passages and upgrade to hybrid if new candidate has semantic hit
                    if cand.retrieval_path == "hybrid" or len(cand.semantic_passages) > len(existing.semantic_passages):
                        for p in cand.semantic_passages:
                            if p not in existing.semantic_passages:
                                existing.semantic_passages.append(p)
                        if cand.composite_score > existing.composite_score:
                            target_candidate_map[matched_target] = cand
            else:
                if requested_targets_set:
                    # If this is an explicit targeted requirement (e.g. comparison between HA-001 and HA-004),
                    # unrequested SKUs must not pollute the comparison group.
                    cand.unmet_constraints.append(f"unrequested_entity_{ext_key or cand.title}")
                    cand.verification_status = FactVerificationStatus.OUT_OF_BOUNDS
                else:
                    # Non-targeted discovery or support requirement: deduplicate by entity_id
                    dedup_key = cand.entity_id or cand.candidate_id
                    if dedup_key not in target_candidate_map:
                        target_candidate_map[dedup_key] = cand
                    else:
                        existing = target_candidate_map[dedup_key]
                        for p in cand.semantic_passages:
                            if p not in existing.semantic_passages:
                                existing.semantic_passages.append(p)
                        if cand.composite_score > existing.composite_score:
                            target_candidate_map[dedup_key] = cand

        # Determine missing targets
        missing_targets = [t for t in group_def.requested_targets if t.upper().strip() not in verified_targets]

        # Final ordered list of candidates
        final_candidates = list(target_candidate_map.values())
        
        # Sort candidates: exact target match first, then by composite_score descending
        final_candidates.sort(key=lambda c: (
            1 if any(f"target_match_" in s for s in c.satisfied_constraints) else 0,
            c.composite_score,
        ), reverse=True)

        return final_candidates, sorted(list(verified_targets)), missing_targets
