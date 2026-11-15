"""Semantic expansion post-processing for AI #1 output (deterministic).

AI #1 returns, per customer need, a standard-English translation, 2-3 HyDE search concepts and
keywords. This module:

1. Sanitises them (bounded counts and lengths, deduplicated, empty entries dropped), so a
   malformed or oversized model answer can never reach retrieval.
2. Attaches each expansion to the decomposed requirement it describes, by word overlap between
   the customer's original phrase and the requirement text. The requirement list itself comes
   from the deterministic decomposer and is never changed here.

Expansions are retrieval aids only: they never become filters, evidence or reply text.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Set

from app.contracts.requirement_plan import PlannedRequirement, RequirementPlan, SemanticExpansion

MAX_EXPANSIONS = 6
MAX_CONCEPTS = 3
MAX_KEYWORDS = 8
MAX_ORIGINAL_CHARS = 200
MAX_TERM_CHARS = 120
MAX_CONCEPT_CHARS = 400
MAX_KEYWORD_CHARS = 40
MIN_MATCH_OVERLAP = 0.5

_WORD_RE = re.compile(r"\w+", re.UNICODE)
_KEYWORD_OK = re.compile(r"^[\w][\w .&/+-]*$", re.UNICODE)


def _clean(value: Any, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit].strip()


def _dedupe(values: Iterable[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for v in values:
        k = v.lower()
        if v and k not in seen:
            seen.add(k)
            out.append(v)
    return out


def sanitize_expansions(raw: Optional[Iterable[Any]]) -> List[SemanticExpansion]:
    """Bounded, cleaned expansions from the model's `search_requirements` (never raises)."""
    out: List[SemanticExpansion] = []
    for entry in list(raw or [])[:MAX_EXPANSIONS]:
        if not isinstance(entry, dict):
            continue
        concepts_val = entry.get("search_concepts")
        keywords_val = entry.get("keywords")
        concepts_raw: List[Any] = concepts_val if isinstance(concepts_val, list) else []
        keywords_raw: List[Any] = keywords_val if isinstance(keywords_val, list) else []
        concepts = _dedupe(_clean(c, MAX_CONCEPT_CHARS) for c in concepts_raw)[:MAX_CONCEPTS]
        keywords = _dedupe(
            kw for kw in (_clean(k, MAX_KEYWORD_CHARS) for k in keywords_raw) if kw and _KEYWORD_OK.match(kw)
        )[:MAX_KEYWORDS]
        exp = SemanticExpansion(
            original_text=_clean(entry.get("original_text"), MAX_ORIGINAL_CHARS),
            translated_standard_term=_clean(entry.get("translated_standard_term"), MAX_TERM_CHARS),
            search_concepts=concepts,
            keywords=keywords,
        )
        if exp.search_concepts or exp.keywords or exp.translated_standard_term:
            out.append(exp)
    return out


def _tokens(text: str) -> Set[str]:
    return {t for t in _WORD_RE.findall((text or "").lower()) if len(t) > 1}


def _overlap(expansion: SemanticExpansion, req: PlannedRequirement) -> float:
    src = _tokens(expansion.original_text)
    if not src:
        return 0.0
    return len(src & _tokens(f"{req.query_text} {req.description}")) / len(src)


def match_expansions(
    expansions: List[SemanticExpansion], requirements: List[PlannedRequirement]
) -> Dict[str, SemanticExpansion]:
    """requirement_id -> the expansion describing it (best word overlap, at least MIN_MATCH_OVERLAP)."""
    matched: Dict[str, SemanticExpansion] = {}
    for req in requirements:
        best: Optional[SemanticExpansion] = None
        best_score = 0.0
        for exp in expansions:
            score = _overlap(exp, req)
            if score > best_score:
                best, best_score = exp, score
        if best is not None and best_score >= MIN_MATCH_OVERLAP:
            matched[req.requirement_id] = best
    # One need, one catalogue requirement, but the model paraphrased the customer's words:
    # the pairing is still unambiguous.
    catalogue_reqs = [r for r in requirements if (r.category or "products_services") == "products_services"]
    if not matched and len(expansions) == 1 and len(catalogue_reqs) == 1:
        matched[catalogue_reqs[0].requirement_id] = expansions[0]
    return matched


def apply_semantic_expansions(plan: RequirementPlan, proposal: Any) -> RequirementPlan:
    """Attach sanitised expansions to the plan and to the requirements they describe."""
    expansions = sanitize_expansions(getattr(proposal, "search_requirements", None))
    if not expansions:
        return plan
    by_req = match_expansions(expansions, list(plan.requirements or []))
    reqs = [
        r.model_copy(update={"semantic_expansion": by_req[r.requirement_id]}) if r.requirement_id in by_req else r
        for r in plan.requirements
    ]
    return plan.model_copy(update={"semantic_expansions": expansions, "requirements": reqs})
