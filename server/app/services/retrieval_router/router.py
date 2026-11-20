"""Retrieval Router — Phase 4.

The core routing decision and execution coordinator:
1. Validates server-side tenant scope and plan consistency.
2. Formulates the optimal retrieval execution path:
   - EXACT_STRUCTURED: for SKUs, exact codes, contacts, or strict numeric ranges.
   - SEMANTIC_DISCOVERY: for narrative policies, general support FAQs, or troubleshooting.
   - HYBRID: for comparisons, service discovery, or specifications requiring both exact facts and descriptions.
3. Executes independent structured and semantic retrieval in parallel using asyncio.gather.
4. Handles partial failures and timeouts gracefully.
5. Invokes FactVerifier to reconcile evidence, enforce hard constraints, and rank results.
6. Packages the output into the stable versioned RetrievalResult contract (`schema_version = '1.0'`).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.context_resolver import ContextEnvelope
from app.contracts.requirement_plan import (
    IntentType,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.retrieval_result import (
    PlanReferenceDTO,
    RetrievalResult,
    RetrievalStatus,
    RetrievalStrategyUsed,
    RetrievedEvidenceItem,
    SourceExecutionMetadata,
)
from app.core.database import db_manager
from app.core.logging import logger
from app.models.knowledge import KnowledgeCategory, KnowledgeItem, KnowledgeVersion
from app.services.retrieval_router.lexical_retriever import (
    STRONG_MATCH_THRESHOLD,
    lexical_retriever as default_lexical_retriever,
)
from app.services.retrieval_router.semantic_retriever import (
    SemanticCandidateHit,
    semantic_retriever,
    semantic_retriever as default_semantic_retriever,
)
from app.services.retrieval_router.structured_retriever import (
    structured_retriever,
    structured_retriever as default_structured_retriever,
)
from app.services.retrieval_router.verifier import (
    fact_verifier,
    fact_verifier as default_fact_verifier,
)


# Requirements retrieved concurrently (each uses its own DB session + query embedding).
MAX_PARALLEL_REQUIREMENTS = 4

# Weight of a keyword list that could not see every word of the question (see fusion below).
BLIND_LEXICAL_WEIGHT = 0.05

# Weight of the keyword list built from AI #1's expansion keywords: they are model-written
# guesses, so they reinforce dense matches but never outvote the customer's own words.
EXPANSION_LEXICAL_WEIGHT = 0.5
# Extra dense queries per (sub-)plan: translated terms + HyDE concepts, deduplicated.
MAX_EXPANSION_QUERIES = 4
_EXACT_ID_ENTITY_TYPES = frozenset({"sku", "service_code", "product_code", "model_number"})


def expansion_search_inputs(plan: RequirementPlan, enabled: bool = True) -> Tuple[List[str], str]:
    """(extra dense queries, expansion keyword query) for a plan.

    Empty when expansions are absent / unusable, so retrieval falls back to the plan's own
    query text exactly as before. Bypassed when the customer gave an exact identifier.
    """
    exps = list(getattr(plan, "semantic_expansions", None) or [])
    if not enabled or not exps:
        return [], ""
    if any((e.entity_type or "").lower() in _EXACT_ID_ENTITY_TYPES and (e.canonical_value or "").strip()
           for e in plan.entities) or "exact_sku_lookup" in (plan.retrieval_strategy_hints or []):
        return [], ""
    base = (plan.query_text or "").strip().lower()
    queries: List[str] = []
    seen = {base} if base else set()
    # Round-robin across needs so a two-need email gets concepts for both within the cap.
    per_need = [[exp.translated_standard_term, *exp.search_concepts] for exp in exps]
    for rank in range(max(len(c) for c in per_need)):
        for cands in per_need:
            q = (cands[rank] if rank < len(cands) else "").strip()
            if q and q.lower() not in seen:
                seen.add(q.lower())
                queries.append(q)
    words: List[str] = []
    for exp in exps:
        for w in [*exp.keywords, exp.translated_standard_term]:
            w = (w or "").strip()
            if w and w.lower() not in (x.lower() for x in words):
                words.append(w)
    return queries[:MAX_EXPANSION_QUERIES], " ".join(words)[:300]


class RetrievalRouter:
    """Decides and executes the multi-source retrieval plan."""

    def __init__(
        self,
        timeout_seconds: float = 25.0,
        structured_retriever=None,
        semantic_retriever=None,
        verifier=None,
        lexical_retriever=None,
    ):
        self._timeout_seconds = timeout_seconds
        self._structured_retriever = structured_retriever or default_structured_retriever
        self._semantic_retriever = semantic_retriever or default_semantic_retriever
        self._verifier = verifier or default_fact_verifier
        self._lexical_retriever = lexical_retriever or default_lexical_retriever

    async def execute_retrieval(
        self,
        db: AsyncSession,
        tenant_id: str,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
        as_of: Optional[datetime] = None,
    ) -> RetrievalResult:
        """Route, retrieve, verify, and package evidence for the given plan.

        A message with several independent requirements is retrieved PER REQUIREMENT: each one
        gets its own query text, filters, ranges and eligibility rules (the single-requirement
        path below), run in bounded parallel on separate sessions. One search over the whole
        email let the dominant topic crowd out every other requirement. Results are merged by
        entity and tagged with the requirement(s) they were found for, so evidence fusion gives
        each requirement only its own evidence.
        """
        if plan.tenant_id != tenant_id:
            # Same guard as the single path, before any fan-out work.
            raise PermissionError("Cross-tenant plan retrieval rejected by policy")
        reqs = [r for r in (plan.requirements or []) if (r.query_text or r.description or "").strip()]
        if plan.focus_entity_ids:
            focused = await self._execute_focused(tenant_id, plan, reqs, envelope, as_of)
            if focused is not None:
                return focused
        if len(reqs) < 2:
            return await self._execute_single(db, tenant_id, plan, envelope, as_of)
        return await self._execute_per_requirement(tenant_id, plan, reqs, envelope, as_of)

    async def _execute_focused(
        self,
        tenant_id: str,
        plan: RequirementPlan,
        reqs: List[Any],
        envelope: Optional[ContextEnvelope],
        as_of: Optional[datetime],
    ) -> Optional[RetrievalResult]:
        """The customer already selected an item: retrieve exactly that item (by its exact key, with
        authoritative facts), never a fresh catalogue discovery. Requirements about other knowledge
        (policies, contacts, delivery...) are still retrieved on their own. Returns None (normal
        retrieval) if the selected item can no longer be found."""
        from app.contracts.requirement_plan import PlannedEntity

        sel = plan.active_selection or {}
        title = (sel.get("title") or "").strip()
        keys = [k.strip() for k in (plan.focus_keys or [sel.get("external_key") or ""]) if k and k.strip()]
        focus = set(plan.focus_entity_ids)
        count = max(len(focus), 1)
        sub = plan.model_copy(update={
            "intent": IntentType.PRODUCT_LOOKUP,
            "query_text": title or plan.query_text,
            "entities": [PlannedEntity(entity_type="sku", original_text=k, canonical_value=k) for k in keys],
            "filters": [], "range_semantics": None, "requirements": [], "excluded_entity_ids": [],
            "focus_entity_ids": [], "focus_keys": [], "semantic_expansions": [],
            "requested_result_count": plan.requested_result_count.model_copy(
                update={"final_count": max(count, plan.requested_result_count.final_count or 1)}),
        })
        async with db_manager.session_factory() as f_db:
            res = await self._execute_single(f_db, tenant_id, sub, envelope, as_of)
        selected = [i for i in res.results if i.entity_id in focus]
        if not selected:
            logger.warning("Selected item not retrievable; using normal retrieval", tenant_id=tenant_id,
                           plan_id=plan.plan_id, focus=list(focus))
            return None
        results = list(selected)
        other = [r for r in reqs if (r.category or "products_services") != "products_services"]
        warnings = list(res.warnings)
        if other:
            extra = await self._execute_per_requirement(tenant_id, plan, other, envelope, as_of) if len(other) > 1                 else await self._run_one_requirement(tenant_id, plan, other[0], envelope, as_of)
            seen = {i.entity_id for i in results}
            cat_of = {r.requirement_id: r.category for r in other}
            # Product evidence comes only from the selection; another requirement contributes only
            # items of its own knowledge category (a category the business has no data for is
            # reported downstream as not configured, never back-filled with catalogue products).
            results += [i for i in extra.results if i.entity_id not in seen
                        and any(cat_of.get(rid) == i.category for rid in (i.requirement_ids or []))]
            warnings += [w for w in extra.warnings if w not in warnings]
        logger.info("Focused retrieval for selected item(s)", tenant_id=tenant_id, plan_id=plan.plan_id,
                    selected=title[:80], focus=len(focus), other_requirements=len(other), results=len(results))
        return res.model_copy(update={
            "status": RetrievalStatus.SUCCESS, "results": results, "warnings": warnings,
            "plan_reference": res.plan_reference.model_copy(update={"plan_id": plan.plan_id}),
        })

    async def _run_one_requirement(self, tenant_id, plan, req, envelope, as_of) -> RetrievalResult:
        sub = plan.model_copy(update={
            "intent": req.intent, "query_text": (req.query_text or req.description).strip(),
            "entities": list(req.entities), "filters": list(req.filters), "range_semantics": req.range_semantics,
            "requirements": [req], "focus_entity_ids": [],
            "semantic_expansions": [req.semantic_expansion] if req.semantic_expansion else [],
        })
        async with db_manager.session_factory() as r_db:
            res = await self._execute_single(r_db, tenant_id, sub, envelope, as_of)
        return res.model_copy(update={"results": [i.model_copy(update={"requirement_ids": [req.requirement_id]})
                                                  for i in res.results]})

    async def _execute_per_requirement(
        self,
        tenant_id: str,
        plan: RequirementPlan,
        reqs: List[Any],
        envelope: Optional[ContextEnvelope],
        as_of: Optional[datetime],
    ) -> RetrievalResult:
        sem = asyncio.Semaphore(MAX_PARALLEL_REQUIREMENTS)

        async def run(req: Any) -> Tuple[Any, Optional[RetrievalResult]]:
            count = max(1, min(int(req.requested_count or 5), plan.requested_result_count.max_safe_limit))
            sub = plan.model_copy(update={
                "intent": req.intent,
                "query_text": (req.query_text or req.description).strip(),
                "entities": list(req.entities),
                "filters": list(req.filters),
                "range_semantics": req.range_semantics,
                "requested_attributes": list(req.requested_attributes),
                "retrieval_strategy": req.retrieval_strategy,
                "requirements": [req],
                "focus_entity_ids": [],
                "semantic_expansions": [req.semantic_expansion] if req.semantic_expansion else [],
                "requested_result_count": plan.requested_result_count.model_copy(
                    update={"final_count": count, "explicit_count": count}),
            })
            async with sem:
                try:
                    async with db_manager.session_factory() as req_db:
                        return req, await self._execute_single(req_db, tenant_id, sub, envelope, as_of)
                except PermissionError:
                    raise
                except Exception as exc:  # noqa: BLE001 - one requirement must not sink the others
                    logger.warning("Per-requirement retrieval failed", requirement_id=req.requirement_id,
                                   error=f"{type(exc).__name__}: {str(exc)[:200]}", tenant_id=tenant_id)
                    return req, None

        outcomes = await asyncio.gather(*(run(r) for r in reqs))

        merged: Dict[str, RetrievedEvidenceItem] = {}
        order: List[str] = []
        warnings: List[str] = []
        base: Optional[RetrievalResult] = None
        failed: List[str] = []
        for req, res in outcomes:
            if res is None:
                failed.append(req.requirement_id)
                continue
            base = base or res
            warnings.extend(w for w in res.warnings if w not in warnings)
            for item in res.results:
                cur = merged.get(item.entity_id)
                if cur is None:
                    merged[item.entity_id] = item.model_copy(update={"requirement_ids": [req.requirement_id]})
                    order.append(item.entity_id)
                elif req.requirement_id not in cur.requirement_ids:
                    cur.requirement_ids.append(req.requirement_id)
                    if item.relevance_score > cur.relevance_score:
                        cur.relevance_score = item.relevance_score
        if failed:
            warnings.append(f"Retrieval failed for requirement(s) {', '.join(failed)}; their evidence is missing.")
        if base is None:
            # Every requirement failed: fall back to one whole-message retrieval.
            async with db_manager.session_factory() as fb_db:
                return await self._execute_single(fb_db, tenant_id, plan, envelope, as_of)

        results = [merged[i] for i in order]
        status = RetrievalStatus.SUCCESS if results else base.status
        if results and (failed or any(res is not None and not res.results for _r, res in outcomes)):
            status = RetrievalStatus.PARTIAL
        logger.info("Per-requirement retrieval merged", tenant_id=tenant_id, plan_id=plan.plan_id,
                    requirements=len(reqs), failed=len(failed), results=len(results),
                    per_requirement=[len(res.results) if res else -1 for _r, res in outcomes])
        return base.model_copy(update={
            "status": status,
            "results": results,
            "warnings": warnings,
            "plan_reference": base.plan_reference.model_copy(update={"plan_id": plan.plan_id}),
        })

    async def _execute_single(
        self,
        db: AsyncSession,
        tenant_id: str,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
        as_of: Optional[datetime] = None,
    ) -> RetrievalResult:
        """Single-requirement retrieval: structured + semantic + lexical, eligibility, fusion."""
        start_time = time.perf_counter()

        # ---------------------------------------------------------------------
        # 1. Tenant Scope Validation
        # ---------------------------------------------------------------------
        if not tenant_id or not tenant_id.strip():
            raise ValueError("tenant_id must be provided and non-empty")
        if plan.tenant_id != tenant_id:
            logger.error(
                "SECURITY: Plan tenant_id does not match authenticated domain tenant",
                plan_tenant=plan.tenant_id,
                domain_tenant=tenant_id,
            )
            raise PermissionError("Cross-tenant plan retrieval rejected by policy")

        # ---------------------------------------------------------------------
        # 2. Determine Strategy and Execution Branches
        # ---------------------------------------------------------------------
        # Check for exact business keys (SKUs, codes)
        exact_keys: List[str] = []
        for e in plan.entities:
            if e.entity_type in ("sku", "service_code", "product_code", "model_number"):
                val = e.canonical_value or e.original_text
                if val:
                    exact_keys.append(val.strip().upper())

        # Determine target category
        target_category: Optional[str] = None
        for f in plan.filters:
            if f.field == "category" and isinstance(f.value, str):
                target_category = f.value.lower().strip()
                break
        if not target_category:
            for e in plan.entities:
                if e.entity_type == "service_category":
                    target_category = e.canonical_value or e.original_text
                    break
        if not target_category:
            target_category = KnowledgeCategory.PRODUCTS_SERVICES.value

        # Routing decision matrix
        intent = plan.intent
        is_exact_sku = len(exact_keys) > 0
        is_price_range = plan.range_semantics is not None and plan.range_semantics.field == "price"
        is_comparison = plan.comparison.requested or intent in (
            IntentType.SERVICE_COMPARISON,
            IntentType.PRODUCT_COMPARISON,
        )
        is_contact_request = intent == IntentType.OTHER and "contact" in (plan.query_text or "").lower()
        if not is_contact_request:
            for e in plan.entities:
                if e.entity_type in ("contact", "department", "person"):
                    is_contact_request = True
                    break

        run_structured = False
        run_semantic = False
        strategy_used = RetrievalStrategyUsed.HYBRID

        if plan.retrieval_strategy == RetrievalStrategy.CLARIFICATION_REQUIRED and not plan.is_continuation:
            # Fatal ambiguity prevents retrieval; do not execute broad generic discovery
            run_structured = False
            run_semantic = False
            strategy_used = RetrievalStrategyUsed.EXACT_STRUCTURED
        elif is_contact_request:
            run_structured = True
            run_semantic = False
            strategy_used = RetrievalStrategyUsed.EXACT_STRUCTURED
        elif is_exact_sku:
            run_structured = True
            # Semantic branch is optional secondary for detailed description
            run_semantic = True
            strategy_used = RetrievalStrategyUsed.EXACT_STRUCTURED
        elif is_price_range and not is_comparison:
            run_structured = True
            run_semantic = True
            strategy_used = RetrievalStrategyUsed.EXACT_STRUCTURED
        elif intent in (IntentType.POLICY_QUESTION, IntentType.SUPPORT_ISSUE):
            run_structured = False
            run_semantic = True
            strategy_used = RetrievalStrategyUsed.SEMANTIC_DISCOVERY
        else:
            # Broad discovery, comparison, recommendations, hybrid
            run_structured = True
            run_semantic = True
            strategy_used = RetrievalStrategyUsed.HYBRID

        # ---------------------------------------------------------------------
        # 2b. Requirement eligibility spec (role / family / compatibility / specs)
        # ---------------------------------------------------------------------
        # Resolved once per plan from the plan + THIS tenant's category vocabulary; the
        # verifier applies it as a hard gate before ranking.
        eligibility_spec = None
        if target_category == KnowledgeCategory.PRODUCTS_SERVICES.value and not is_contact_request:
            try:
                from app.services.retrieval_router.entity_eligibility import (
                    build_request_spec,
                    load_tenant_vocabulary,
                )

                vocab = await load_tenant_vocabulary(db, tenant_id)
                eligibility_spec = build_request_spec(plan, vocab)
            except Exception as spec_err:  # noqa: BLE001 — never block retrieval on the spec
                logger.warning("Eligibility spec unavailable; retrieving without it", error=str(spec_err)[:200])
                eligibility_spec = None
        # item_id -> (origin, relevance) for structured candidates (see verifier)
        structured_origin: Dict[str, Tuple[str, float]] = {}
        # item_id -> requested code it approximates (the requested code itself does not exist)
        near_for: Dict[str, str] = {}
        # indexed progressive retrieval outcome: was every catalogue match considered?
        index_search: Dict[str, Any] = {"used": False, "exhaustive": None, "matching": None}

        async def _near_matches(found: List[Tuple[KnowledgeItem, KnowledgeVersion]]):
            """Closest existing codes for requested codes that do not exist (suggestions only)."""
            fetch = getattr(self._structured_retriever, "fetch_near_keys", None)
            if fetch is None:
                return []
            have = {(it.external_identity_key or "").upper() for it, _v in found}
            seen_ids = {it.id for it, _v in found}
            extra: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
            for missing in [k for k in exact_keys if k not in have]:
                try:
                    near = await fetch(db=db, tenant_id=tenant_id, key=missing, as_of=as_of)
                except Exception as err:  # noqa: BLE001 - suggestions are optional
                    logger.warning("Near-code lookup failed", key=missing, error=str(err)[:160])
                    continue
                for it, ver in near:
                    if it.id in seen_ids:
                        continue
                    seen_ids.add(it.id)
                    extra.append((it, ver))
                    near_for[it.id] = missing
                    structured_origin[it.id] = ("near_key", 0.5)
                    if eligibility_spec is not None:
                        # a suggestion must not be filtered out by the role / family gates
                        eligibility_spec.exact_keys.add((it.external_identity_key or "").upper())
                        eligibility_spec.suggestion_keys.add((it.external_identity_key or "").upper())
            if extra:
                logger.info("Requested code(s) not found; suggesting closest existing codes",
                            tenant_id=tenant_id, missing=[k for k in exact_keys if k not in have],
                            suggestions=[it.external_identity_key for it, _v in extra])
            return extra
        result_count = plan.requested_result_count.final_count or 5
        # Wider candidate pool when eligibility filtering will remove ineligible items.
        candidate_pool = max(result_count * 4, 20) if eligibility_spec is not None and eligibility_spec.active else result_count

        # AI #1 semantic expansions usable for this (sub-)plan; none when the customer named an
        # exact identifier (exact lookup needs no expansion) or for contact requests.
        expansion_queries, expansion_keyword_query = expansion_search_inputs(
            plan, enabled=not is_contact_request)

        # ---------------------------------------------------------------------
        # 3. Parallel Retrieval Execution with Deadlines
        # ---------------------------------------------------------------------
        structured_results: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        has_more_structured = False
        structured_status = "NOT_INVOKED"
        structured_dur_ms = 0.0

        structured_is_generic_browse = False
        semantic_results: List[SemanticCandidateHit] = []
        semantic_status = "NOT_INVOKED"
        semantic_dur_ms = 0.0

        async def _run_structured_branch() -> None:
            nonlocal structured_results, has_more_structured, structured_status, structured_dur_ms
            nonlocal structured_is_generic_browse
            t0 = time.perf_counter()
            try:
                # If plan has multiple decomposed requirements, execute across distinct categories
                if plan.requirements and len(plan.requirements) > 1:
                    seen_keys: Set[str] = set()
                    merged_results: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []

                    # 1. Company contact details (they live in Company Info)
                    has_contact_req = any(
                        "contact" in (r.query_text or "").lower()
                        for r in plan.requirements
                    )
                    if has_contact_req:
                        contact_items = await self._structured_retriever.fetch_contacts(
                            db=db,
                            tenant_id=tenant_id,
                            department_or_role=None,
                            limit=5,
                            as_of=as_of,
                        )
                        for it, ver in contact_items:
                            k = f"{it.id}_{ver.id}"
                            if k not in seen_keys:
                                seen_keys.add(k)
                                merged_results.append((it, ver))
                                structured_origin[it.id] = ("exact_structured", 1.0)

                    # 2. Exact keys
                    if exact_keys:
                        exact_items = await self._structured_retriever.fetch_by_exact_keys(
                            db=db,
                            tenant_id=tenant_id,
                            keys=exact_keys,
                            as_of=as_of,
                        )
                        for it, ver in exact_items:
                            k = f"{it.id}_{ver.id}"
                            if k not in seen_keys:
                                seen_keys.add(k)
                                merged_results.append((it, ver))
                                structured_origin[it.id] = ("exact_key", 1.0)
                        for it, ver in await _near_matches(exact_items):
                            k = f"{it.id}_{ver.id}"
                            if k not in seen_keys:
                                seen_keys.add(k)
                                merged_results.append((it, ver))

                    # 3. Fetch each distinct category represented in requirements
                    categories_to_fetch = set()
                    for r in plan.requirements:
                        if r.category:
                            categories_to_fetch.add(r.category)

                    for req_cat in categories_to_fetch:
                        req_range = None
                        req_filters = []
                        for r in plan.requirements:
                            if r.category == req_cat:
                                if r.range_semantics:
                                    req_range = r.range_semantics
                                if r.filters:
                                    req_filters.extend(r.filters)

                        cat_items, _ = await self._structured_retriever.fetch_by_category_and_range(
                            db=db,
                            tenant_id=tenant_id,
                            category=req_cat,
                            range_semantics=req_range,
                            filters=req_filters,
                            exclude_entity_ids=plan.excluded_entity_ids,
                            limit=5,
                            offset=0,
                            as_of=as_of,
                        )
                        # An unfiltered category listing has no relevance ordering: it is a
                        # "generic" fallback, never authoritative evidence (previously it was
                        # scored like an exact match and buried every relevant result).
                        origin = ("constrained", 0.3) if (req_range or req_filters) else ("generic", 0.0)
                        for it, ver in cat_items:
                            k = f"{it.id}_{ver.id}"
                            if k not in seen_keys:
                                seen_keys.add(k)
                                merged_results.append((it, ver))
                                structured_origin.setdefault(it.id, origin)

                    structured_results = merged_results
                    has_more_structured = False
                elif is_contact_request:
                    contact_dept = plan.entities[0].canonical_value if plan.entities else None
                    structured_results = await self._structured_retriever.fetch_contacts(
                        db=db,
                        tenant_id=tenant_id,
                        department_or_role=contact_dept,
                        limit=plan.requested_result_count.final_count or 5,
                        as_of=as_of,
                    )
                    has_more_structured = False
                    for it, _ in structured_results:
                        structured_origin[it.id] = ("exact_structured", 1.0)
                elif is_exact_sku:
                    structured_results = await self._structured_retriever.fetch_by_exact_keys(
                        db=db,
                        tenant_id=tenant_id,
                        keys=exact_keys,
                        as_of=as_of,
                    )
                    has_more_structured = False
                    for it, _ in structured_results:
                        structured_origin[it.id] = ("exact_key", 1.0)
                    structured_results = list(structured_results) + await _near_matches(structured_results)
                else:
                    # Category listing with no relevance ordering. Only authoritative when
                    # the customer constrained it (filters / price range); otherwise it is
                    # an unranked fallback (see demotion below).
                    structured_is_generic_browse = not plan.range_semantics and not any(
                        f.field != "category" for f in plan.filters
                    )
                    target_limit = plan.requested_result_count.final_count or 5
                    structured_results, has_more_structured = (
                        await self._structured_retriever.fetch_by_category_and_range(
                            db=db,
                            tenant_id=tenant_id,
                            category=target_category,
                            range_semantics=plan.range_semantics,
                            filters=plan.filters,
                            exclude_entity_ids=plan.excluded_entity_ids,
                            limit=target_limit,
                            offset=0,
                            as_of=as_of,
                        )
                    )
                    origin = ("generic", 0.0) if structured_is_generic_browse else ("constrained", 0.3)
                    for it, _ in structured_results:
                        structured_origin.setdefault(it.id, origin)

                # Progressive retrieval for a resolved product family: fetch the family's
                # members from PostgreSQL (bounded) so the eligible items are always in the
                # candidate set, whatever the top-K of the similarity branches returned.
                token_groups: List[List[str]] = []
                fam_labels = [f.label for f in eligibility_spec.families] if eligibility_spec is not None else []
                used_index = False
                if fam_labels:
                    # Indexed, exhaustive path: every hard constraint evaluated by PostgreSQL over the
                    # WHOLE catalogue (O(log n + k)); no fixed candidate window to fall out of.
                    from app.services.knowledge_search_index import is_available as _idx_ok
                    if await _idx_ok(db, tenant_id):
                        from app.core.config import get_retrieval_budget
                        from app.services.retrieval_router.verifier import price_order as _po
                        rng = plan.range_semantics if (plan.range_semantics and plan.range_semantics.field == "price") else None
                        idx_items, exhaustive, matching = await self._structured_retriever.fetch_indexed_candidates(
                            db=db, tenant_id=tenant_id, families=fam_labels,
                            roles=[r.value for r in (eligibility_spec.wanted_roles or [])] or None,
                            nominal=eligibility_spec.nominal,
                            price_order=_po(getattr(plan.comparison, "ranking_criterion", None)),
                            price_min=rng.min_value if rng else None, price_max=rng.max_value if rng else None,
                            top_n=result_count, budget=get_retrieval_budget().index_candidate_budget, as_of=as_of)
                        index_search.update(used=True, exhaustive=exhaustive, matching=matching)
                        used_index = True
                        have = {it.id for it, _ in structured_results}
                        for it, ver in idx_items:
                            if it.id not in have:
                                structured_results.append((it, ver))
                                have.add(it.id)
                            if structured_origin.get(it.id, ("generic", 0.0))[0] == "generic":
                                structured_origin[it.id] = ("family", 0.0)
                if eligibility_spec is not None:
                    if not used_index:
                        token_groups += [sorted(f.tokens) for f in eligibility_spec.families]
                    # "parts for model X": every record that names X (its parts / accessories)
                    token_groups += [[m.lower()] for m in eligibility_spec.target_models]
                if token_groups:
                    fam_items = await self._structured_retriever.fetch_family_candidates(
                        db=db,
                        tenant_id=tenant_id,
                        family_token_groups=token_groups,
                        limit=150,
                        as_of=as_of,
                    )
                    have = {it.id for it, _ in structured_results}
                    for it, ver in fam_items:
                        if it.id not in have:
                            structured_results.append((it, ver))
                            have.add(it.id)
                        if structured_origin.get(it.id, ("generic", 0.0))[0] == "generic":
                            structured_origin[it.id] = ("family", 0.0)

                structured_status = "SUCCESS" if structured_results else "EMPTY"
            except Exception as err:
                structured_status = "FAILED"
                logger.warning("Structured retrieval branch encountered an error", error=str(err), tenant_id=tenant_id)
            finally:
                structured_dur_ms = round((time.perf_counter() - t0) * 1000, 2)

        async def _run_semantic_branch() -> None:
            nonlocal semantic_results, semantic_status, semantic_dur_ms
            t0 = time.perf_counter()
            try:
                target_top_k = candidate_pool
                search_kwargs: Dict[str, Any] = {}
                if expansion_queries:
                    search_kwargs["extra_queries"] = expansion_queries
                semantic_results = await self._semantic_retriever.search(
                    tenant_id=tenant_id,
                    plan=plan,
                    top_k=target_top_k,
                    exclude_entity_ids=plan.excluded_entity_ids,
                    **search_kwargs,
                )
                semantic_status = "SUCCESS" if semantic_results else "EMPTY"
            except Exception as err:
                semantic_status = "FAILED"
                logger.warning("Semantic retrieval branch encountered an error", error=str(err), tenant_id=tenant_id)
            finally:
                semantic_dur_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Lexical (keyword / SKU) branch — runs alongside whenever the plan searches the
        # catalogue. It is embedding-model independent, so product names, partial names
        # and SKUs typed inside a sentence resolve even when dense vectors are weak.
        lexical_results: List[Tuple[KnowledgeItem, KnowledgeVersion, Any]] = []
        lexical_status = "NOT_INVOKED"
        lexical_query = (plan.query_text or "").strip() or " ".join(
            (e.canonical_value or e.original_text or "") for e in plan.entities
        ).strip()
        run_lexical = (run_semantic or (run_structured and not is_contact_request)) and bool(lexical_query)

        # AI #1 expansions (translation, HyDE concepts, keywords) widen recall for vague, regional
        # or functional wording. The customer's own words still drive the primary keyword search,
        # so exact names / codes keep their exact-match strength; keyword hits that exist only
        # because of model-written keywords are never treated as exact evidence.
        expansion_lexical: List[Tuple[KnowledgeItem, KnowledgeVersion, Any]] = []
        expansion_lexical_query = expansion_keyword_query
        run_expansion_lexical = run_lexical and bool(expansion_lexical_query) and (
            expansion_lexical_query.lower() != lexical_query.lower())

        async def _run_expansion_lexical_branch() -> None:
            nonlocal expansion_lexical
            try:
                async with db_manager.session_factory() as exp_db:
                    expansion_lexical = await self._lexical_retriever.search(
                        db=exp_db,
                        tenant_id=tenant_id,
                        query_text=expansion_lexical_query,
                        top_k=candidate_pool,
                        exclude_entity_ids=plan.excluded_entity_ids,
                        as_of=as_of,
                    )
            except Exception as err:  # noqa: BLE001 - an aid; never fails retrieval
                logger.warning("Expansion keyword branch encountered an error", error=str(err), tenant_id=tenant_id)

        async def _run_lexical_branch() -> None:
            nonlocal lexical_results, lexical_status
            try:
                # Own session: an AsyncSession cannot run concurrent operations, and the
                # structured branch is using `db` at the same time. Loaded attributes and
                # relationships stay readable after close (expire_on_commit=False).
                async with db_manager.session_factory() as lexical_db:
                    lexical_results = await self._lexical_retriever.search(
                        db=lexical_db,
                        tenant_id=tenant_id,
                        query_text=lexical_query,
                        top_k=candidate_pool,
                        exclude_entity_ids=plan.excluded_entity_ids,
                        as_of=as_of,
                    )
                lexical_status = "SUCCESS" if lexical_results else "EMPTY"
            except Exception as err:
                lexical_status = "FAILED"
                logger.warning("Lexical retrieval branch encountered an error", error=str(err), tenant_id=tenant_id)

        tasks = []
        if run_structured:
            tasks.append(_run_structured_branch())
        if run_semantic:
            tasks.append(_run_semantic_branch())
        if run_lexical:
            tasks.append(_run_lexical_branch())
        if run_expansion_lexical:
            tasks.append(_run_expansion_lexical_branch())

        deadline_hit = False
        if tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=self._timeout_seconds)
            except asyncio.TimeoutError:
                logger.error("Retrieval execution exceeded deadline", timeout_seconds=self._timeout_seconds)
                # A branch cancelled mid-query leaves the shared session's transaction invalid.
                # Verify on a FRESH session (a rollback would expire the candidates already
                # loaded and trigger lazy IO): retrieval degrades to the branches that finished
                # instead of failing outright.
                deadline_hit = True

        # An unconstrained category listing says nothing about the customer's question.
        # It used to enter the verifier as "exact" evidence (base score 100), so the same
        # arbitrary items outranked every relevant match. Keep it only as a fallback when
        # the query-driven branches found nothing.
        if lexical_query and (lexical_results or semantic_results):
            kept = [(it, v) for it, v in structured_results
                    if structured_origin.get(it.id, ("exact_structured", 1.0))[0] != "generic"]
            if len(kept) != len(structured_results):
                structured_results = kept
                has_more_structured = False

        # Rank fusion (RRF) of the dense and lexical lists, computed from RANKS before the
        # weak lexical hits are merged into the semantic list. Raw cosine and IDF scores live
        # on different scales and must never be compared directly.
        from app.services.retrieval_router.rank_fusion import ranked_ids, reciprocal_rank_fusion

        # The keyword list only saw the words this catalogue contains. When the question's
        # other words (often the very thing asked for: "fridge" vs "Mini Bar") are unknown to
        # it, its ranking describes the leftover words ("hotel room") and counts for less.
        lexical_coverage = min((h.query_coverage for _i, _v, h in lexical_results), default=1.0)
        semantic_ids = {h.knowledge_item_id for h in semantic_results}
        rank_lists = [
            ranked_ids((h.knowledge_item_id, h.score) for h in semantic_results),
            [it.id for it, _v, _h in lexical_results],
        ]
        # Blind keyword list: tie-breaker only. With RRF k=60 any larger weight lets an
        # item the semantic list ranked ~15th (it matched "hotel room") plus a keyword
        # rank near the top outrank the semantic #1 (the fridge) - false "agreement".
        rank_weights = [1.0, 1.0 if lexical_coverage >= 1.0 else BLIND_LEXICAL_WEIGHT]
        if expansion_lexical:
            rank_lists.append([it.id for it, _v, _h in expansion_lexical])
            rank_weights.append(EXPANSION_LEXICAL_WEIGHT)
            have_ids = semantic_ids | {it.id for it, _v, _h in lexical_results}
            for item, version, hit in expansion_lexical:
                if item.id in have_ids:
                    continue
                have_ids.add(item.id)
                semantic_results.append(
                    SemanticCandidateHit(
                        knowledge_item_id=item.id,
                        knowledge_version_id=version.id,
                        score=hit.score,
                        text_excerpt="",
                        category=item.category,
                        payload={"retrieval_source": "expansion_lexical", "lexical_blind": True},
                    )
                )
        fused_relevance = reciprocal_rank_fusion(rank_lists, weights=rank_weights)

        def _is_strong(item_id: str, hit: Any) -> bool:
            # A confident keyword match is exact evidence only if the keyword branch read the
            # whole question, or the semantic branch independently found the same item.
            if hit.exact_key:
                return True
            if hit.score < STRONG_MATCH_THRESHOLD:
                return False
            return hit.query_coverage >= 1.0 or item_id in semantic_ids

        # Fuse lexical hits: confident name / SKU matches are treated as exact evidence
        # (ranked ahead of generic category browsing); weaker ones compete with dense
        # hits on score (the verifier keeps the max score per item).
        if lexical_results:
            strong_pairs: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
            for item, version, hit in lexical_results:
                if _is_strong(item.id, hit):
                    strong_pairs.append((item, version))
                else:
                    semantic_results.append(
                        SemanticCandidateHit(
                            knowledge_item_id=item.id,
                            knowledge_version_id=version.id,
                            score=hit.score,
                            text_excerpt="",
                            category=item.category,
                            payload={"retrieval_source": "lexical", "lexical_blind": lexical_coverage < 1.0},
                        )
                    )
            if strong_pairs:
                for (it, _v), (_i2, _v2, hit) in zip(
                        strong_pairs, [x for x in lexical_results if _is_strong(x[0].id, x[2])]):
                    structured_origin[it.id] = ("exact_key", 1.0) if hit.exact_key else ("lexical", float(hit.score))
                strong_ids = {it.id for it, _ in strong_pairs}
                structured_results = strong_pairs + [
                    (it, v) for it, v in structured_results if it.id not in strong_ids
                ]

        # ---------------------------------------------------------------------
        # 4. Authoritative Verification, Fact Checking & Ranking
        # ---------------------------------------------------------------------
        verify_plan = plan
        if near_for:
            # room for the requested items plus up to 3 closest-code suggestions per missing code
            need = len(exact_keys) + len(near_for)
            if need > (plan.requested_result_count.final_count or 0):
                verify_plan = plan.model_copy(update={"requested_result_count": plan.requested_result_count.model_copy(
                    update={"final_count": min(need, plan.requested_result_count.max_safe_limit)})})

        async def _verify(verify_db):
            return await self._verifier.verify_and_rank(
                db=verify_db,
                tenant_id=tenant_id,
                plan=verify_plan,
                structured_candidates=structured_results,
                semantic_candidates=semantic_results,
                has_more_structured=has_more_structured,
                as_of=as_of,
                eligibility_spec=eligibility_spec,
                structured_origin=structured_origin,
                fused_relevance=fused_relevance,
            )

        # Verification rehydrates facts from PostgreSQL. A dropped / reset connection on a lossy
        # link must not fail the customer's reply: retry transient errors on a fresh session.
        from app.services.knowledge_persistence import _is_transient_db_error

        verified = None
        for attempt in range(3):
            try:
                if deadline_hit or attempt > 0:
                    async with db_manager.session_factory() as fresh_db:
                        verified = await _verify(fresh_db)
                else:
                    verified = await _verify(db)
                break
            except Exception as verify_err:  # noqa: BLE001
                if attempt < 2 and _is_transient_db_error(verify_err):
                    logger.warning("Retrieval verification retry after transient DB error",
                                   attempt=attempt + 1, error=f"{type(verify_err).__name__}: {str(verify_err)[:160]}")
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise
        (
            final_evidence,
            coverage,
            verification,
            follow_up,
            retrieval_status,
            warnings,
        ) = verified
        if near_for:
            final_evidence = [i.model_copy(update={"near_match_for": near_for[i.entity_id]})
                              if i.entity_id in near_for else i for i in final_evidence]
            missing_codes = sorted(set(near_for.values()))
            warnings = list(warnings) + [
                f"Requested code {c} does not exist in the catalogue; closest existing codes are suggestions only."
                for c in missing_codes]

        total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # ---------------------------------------------------------------------
        # 5. Assemble Stable Versioned Output Contract
        # ---------------------------------------------------------------------
        metadata = SourceExecutionMetadata(
            structured_source_status=structured_status,
            semantic_source_status=semantic_status,
            embedding_profile_id=plan.metadata.embedding_profile_id,
            strategy_used=strategy_used,
            duration_ms=total_duration_ms,
            structured_duration_ms=structured_dur_ms,
            semantic_duration_ms=semantic_dur_ms,
            candidate_counts={
                "structured_candidates": len(structured_results),
                "semantic_candidates": len(semantic_results),
                "lexical_candidates": len(lexical_results),
                "verified_matches": len(final_evidence),
            },
        )

        plan_ref = PlanReferenceDTO(
            schema_version=plan.schema_version,
            plan_id=plan.plan_id,
            tenant_id=plan.tenant_id,
            thread_id=plan.thread_id,
            message_id=plan.message_id,
            context_revision=plan.context_revision,
        )

        from app.services.retrieval_router.verifier import price_order as _price_order
        unscoped = bool(_price_order(getattr(plan.comparison, "ranking_criterion", None))) and not (
            eligibility_spec is not None and (eligibility_spec.families or eligibility_spec.nominal
                                              or eligibility_spec.exact_keys or plan.focus_entity_ids))
        result = RetrievalResult(
            search_exhaustive=index_search["exhaustive"],
            candidates_matching=index_search["matching"],
            price_ranking_unscoped=unscoped,
            schema_version="1.0",
            status=retrieval_status,
            plan_reference=plan_ref,
            retrieval=metadata,
            results=final_evidence,
            coverage=coverage,
            verification=verification,
            follow_up=follow_up,
            warnings=warnings,
        )

        logger.info(
            "Retrieval Router completed execution",
            retrieval_id=result.retrieval_id,
            plan_id=plan.plan_id,
            tenant_id=tenant_id,
            status=result.status.value,
            strategy=strategy_used.value,
            matches_count=len(final_evidence),
            duration_ms=total_duration_ms,
        )

        return result


retrieval_router = RetrievalRouter()
