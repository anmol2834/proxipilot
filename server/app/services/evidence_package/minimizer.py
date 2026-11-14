"""Evidence Minimizer & Budget Enforcer — Phase 6: Minimal Evidence Package.

Applies deterministic deduplication, excerpt bounding, and payload budget
enforcement to produce compact, high-efficiency evidence packages without
dropping material facts, constraints, or missing-information signals.

Optimization Objective:
Smallest sufficient evidence package that preserves all material facts,
constraints, provenance, and unresolved requirements.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Set, Tuple

from app.contracts.evidence_package import (
    EvidenceExcerpt,
    PackageBudgetMetrics,
    PackagedFact,
    RequirementEvidencePackage,
)
from app.core.logging import logger


class EvidenceMinimizer:
    """Minimizes package footprint and enforces token and byte budgets."""

    @classmethod
    def minimize_and_budget(
        cls,
        requirements: List[RequirementEvidencePackage],
        max_bytes: int = 65536,
        raw_input_bytes: int = 0,
    ) -> Tuple[List[RequirementEvidencePackage], PackageBudgetMetrics]:
        """Apply deterministic deduplication, bounding, and budget trimming."""
        facts_evaluated = 0
        facts_included = 0
        facts_excluded = 0
        excerpts_included = 0
        excerpts_truncated = 0
        reductions_applied: List[str] = []

        minimized_requirements: List[RequirementEvidencePackage] = []

        # 1. Deduplicate facts and bound excerpts per requirement
        for req in requirements:
            # Fact deduplication: keep 1 distinct fact per (attribute_name, entity_id, value)
            seen_facts: Set[str] = set()
            clean_facts: List[PackagedFact] = []
            
            for f in req.facts:
                facts_evaluated += 1
                key = f"{f.attribute_name.lower().strip()}_{f.entity_id}_{str(f.typed_value)}"
                if key not in seen_facts:
                    seen_facts.add(key)
                    clean_facts.append(f)
                    facts_included += 1
                else:
                    facts_excluded += 1

            # Excerpt bounding: bound text length strictly <= 200 chars and limit to max 2 excerpts per req
            clean_excerpts: List[EvidenceExcerpt] = []
            seen_excerpt_texts: Set[str] = set()

            for exc in req.supporting_excerpts:
                text_norm = exc.text.strip()
                if text_norm and text_norm not in seen_excerpt_texts:
                    seen_excerpt_texts.add(text_norm)
                    if len(text_norm) > 200:
                        text_norm = text_norm[:200] + "..."
                        excerpts_truncated += 1
                        exc.text = text_norm
                    clean_excerpts.append(exc)
                    excerpts_included += 1
                    if len(clean_excerpts) >= 2:
                        break

            # Create updated requirement package copy
            min_req = req.model_copy(update={
                "facts": clean_facts,
                "supporting_excerpts": clean_excerpts,
            })
            minimized_requirements.append(min_req)

        # 2. Measure Serialized Footprint
        temp_dict = [r.model_dump() for r in minimized_requirements]
        current_bytes = len(json.dumps(temp_dict, default=str).encode("utf-8"))

        # 3. Graceful reduction if over budget
        if current_bytes > max_bytes:
            reductions_applied.append("budget_exceeded_dropping_supporting_excerpts")
            logger.warning(
                "Evidence package exceeded byte budget; applying graceful excerpt reduction",
                current_bytes=current_bytes,
                max_bytes=max_bytes,
            )
            # Step A: Drop supporting excerpts before touching any verified facts
            for req in minimized_requirements:
                req.supporting_excerpts = []
            
            temp_dict = [r.model_dump() for r in minimized_requirements]
            current_bytes = len(json.dumps(temp_dict, default=str).encode("utf-8"))

        # Estimate tokens as roughly 4 bytes per token for JSON payload
        estimated_tokens = max(1, current_bytes // 4)

        metrics = PackageBudgetMetrics(
            candidate_input_bytes=raw_input_bytes,
            serialized_package_bytes=current_bytes,
            estimated_tokens=estimated_tokens,
            facts_evaluated_count=facts_evaluated,
            facts_included_count=facts_included,
            facts_excluded_count=facts_excluded,
            excerpts_included_count=excerpts_included,
            excerpts_truncated_count=excerpts_truncated,
            budget_reductions_applied=reductions_applied,
        )

        return minimized_requirements, metrics
