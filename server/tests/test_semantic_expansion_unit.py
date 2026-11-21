"""Unit tests: AI #1 semantic expansion (sanitising, matching, router inputs, multi-vector pooling)."""

import asyncio
from types import SimpleNamespace

import pytest

from app.contracts.requirement_plan import (
    IntentType,
    PlannedEntity,
    PlannedRequirement,
    PlannerProposalDTO,
    RequirementPlan,
    SemanticExpansion,
)
from app.services.business_taxonomy import BusinessTaxonomy
from app.services.requirement_planner import planner as planner_mod
from app.services.requirement_planner.expansion import (
    MAX_CONCEPTS,
    MAX_KEYWORDS,
    apply_semantic_expansions,
    match_expansions,
    sanitize_expansions,
)
import importlib

sem_mod = importlib.import_module("app.services.retrieval_router.semantic_retriever")
from app.services.retrieval_router.router import MAX_EXPANSION_QUERIES, expansion_search_inputs


def _plan(**kw) -> RequirementPlan:
    base = dict(tenant_id="t1", integration_account_id="a", thread_id="th", message_id="m",
                context_revision=1, intent=IntentType.PRODUCT_DISCOVERY, query_text="customer words")
    base.update(kw)
    return RequirementPlan(**base)


def _exp(orig="x", term="Thing", concepts=("c1",), kws=("k1",)) -> SemanticExpansion:
    return SemanticExpansion(original_text=orig, translated_standard_term=term,
                             search_concepts=list(concepts), keywords=list(kws))


# --- sanitising -------------------------------------------------------------------------------

def test_sanitize_bounds_dedupes_and_drops_junk():
    raw = [
        {"original_text": "  hanth   dhone ke liye  ", "translated_standard_term": "hand washing",
         "search_concepts": ["A", "a", "B", "C", "D", ""], "keywords": ["soap", "SOAP", "x" * 99, "<script>", *map(str, range(20))]},
        {"original_text": "", "translated_standard_term": "", "search_concepts": [], "keywords": []},  # empty -> dropped
        "not a dict",
        {"search_concepts": "not a list", "keywords": None, "translated_standard_term": "only term"},
    ]
    out = sanitize_expansions(raw)
    assert len(out) == 2
    first = out[0]
    assert first.original_text == "hanth dhone ke liye"
    assert first.search_concepts == ["A", "B", "C"][:MAX_CONCEPTS]
    assert "soap" in first.keywords and "SOAP" not in first.keywords
    assert "<script>" not in first.keywords and len(first.keywords) <= MAX_KEYWORDS
    assert all(len(k) <= 40 for k in first.keywords)
    assert out[1].translated_standard_term == "only term" and out[1].search_concepts == []


def test_sanitize_none_is_empty():
    assert sanitize_expansions(None) == []


# --- matching to requirements ----------------------------------------------------------------

def test_match_by_word_overlap_and_paraphrase_fallback():
    r1 = PlannedRequirement(requirement_id="r1", query_text="kapde dhone wali machine kharab hai")
    r2 = PlannedRequirement(requirement_id="r2", category="policies", query_text="warranty kitni hai")
    e1 = _exp(orig="kapde dhone wali machine kharab")
    e2 = _exp(orig="warranty kitni")
    m = match_expansions([e1, e2], [r1, r2])
    assert m["r1"] is e1 and m["r2"] is e2

    # One need + one catalogue requirement, model paraphrased the words: still paired.
    only = PlannedRequirement(requirement_id="r9", query_text="totally different words")
    assert match_expansions([_exp(orig="paraphrase")], [only]) == {"r9": _exp(orig="paraphrase")}
    # Two needs, no overlap: nothing guessed.
    assert match_expansions([_exp(orig="aaa"), _exp(orig="bbb")], [only]) == {}


def test_apply_attaches_to_plan_and_requirement():
    req = PlannedRequirement(requirement_id="r1", query_text="nahane ka paani garam nahi")
    plan = _plan(requirements=[req])
    proposal = PlannerProposalDTO(intent="product_discovery", semantic_search_query="q", search_requirements=[
        {"original_text": "nahane ka paani garam nahi", "translated_standard_term": "water heater repair",
         "search_concepts": ["Water heater not heating repair service"], "keywords": ["water heater", "repair"]}])
    out = apply_semantic_expansions(plan, proposal)
    assert out.semantic_expansions[0].translated_standard_term == "water heater repair"
    assert out.requirements[0].semantic_expansion is not None
    # No expansions -> plan returned unchanged.
    assert apply_semantic_expansions(plan, PlannerProposalDTO(intent="x", semantic_search_query="q")) is plan


# --- router inputs ---------------------------------------------------------------------------

def test_router_inputs_fallback_bypass_and_cap():
    # No expansions: original behaviour (no extra queries, no expansion keyword search).
    assert expansion_search_inputs(_plan()) == ([], "")

    exps = [_exp(orig="a", term="Term A", concepts=("A1", "A2", "A3"), kws=("ka",)),
            _exp(orig="b", term="Term B", concepts=("B1", "B2"), kws=("kb",))]
    queries, kw = expansion_search_inputs(_plan(semantic_expansions=exps))
    assert len(queries) == MAX_EXPANSION_QUERIES
    # Round-robin: both needs are represented within the cap.
    assert queries[:2] == ["Term A", "Term B"] and "A1" in queries and "B1" in queries
    assert "ka" in kw and "kb" in kw

    # Exact identifier from the customer: expansion bypassed (exact lookup only).
    sku = PlannedEntity(entity_type="sku", original_text="HA-001", canonical_value="HA-001")
    assert expansion_search_inputs(_plan(semantic_expansions=exps, entities=[sku])) == ([], "")
    assert expansion_search_inputs(_plan(semantic_expansions=exps, retrieval_strategy_hints=["exact_sku_lookup"])) == ([], "")
    assert expansion_search_inputs(_plan(semantic_expansions=exps), enabled=False) == ([], "")

    # A concept equal to the query text is not searched twice.
    q2, _ = expansion_search_inputs(_plan(query_text="Term A", semantic_expansions=[exps[0]]))
    assert "Term A" not in q2


# --- planner prompt + schema ------------------------------------------------------------------

def test_strict_schema_requires_every_expansion_field():
    schema = planner_mod.OPENAI_PLANNER_JSON_SCHEMA["schema"]
    assert "search_requirements" in schema["required"]
    item = schema["properties"]["search_requirements"]["items"]
    assert set(item["required"]) == set(item["properties"]) == {
        "original_text", "translated_standard_term", "search_concepts", "keywords", "category"}
    assert item["additionalProperties"] is False


def test_system_prompt_injects_taxonomy_only_when_present():
    from app.contracts.retrieval_capability import build_retrieval_capability_catalogue

    cat = build_retrieval_capability_catalogue("t1")
    p = planner_mod.openai_structured_planner
    tax = BusinessTaxonomy(business_name="Acme Services", product_families=[("Widgets", 4)],
                           knowledge_categories=[("products_services", 4)], total_items=4)
    with_tax = p._build_system_prompt(cat, tax)
    assert "BUSINESS CONTEXT & TAXONOMY" in with_tax and '"Widgets":4' in with_tax
    assert "search_concepts" in with_tax
    without = p._build_system_prompt(cat, None)
    assert "BUSINESS CONTEXT & TAXONOMY" not in without and "search_concepts" in without


# --- semantic retriever: one embedding batch, parallel searches, pooled, partial failure -----

class _Provider:
    model_name = "stub"
    dimension = 3

    def __init__(self):
        self.calls = 0

    async def embed_batch(self, req):
        self.calls += 1
        return SimpleNamespace(results=[SimpleNamespace(item_id=i.item_id, vector=[float(n), 0.0, 1.0])
                                        for n, i in enumerate(req.items)])


def _point(pid, item, score):
    return SimpleNamespace(id=pid, score=score, payload={"knowledge_item_id": item, "text": item})


class _Qdrant:
    def __init__(self, fail_on=None):
        self.fail_on = fail_on
        self.queries = 0

    async def search(self, *, query_vector, **_):
        self.queries += 1
        n = int(query_vector.vector[0])
        if n == self.fail_on:
            raise RuntimeError("qdrant down for this query")
        if n == 0:  # the customer's own words: weak
            return [_point("p1", "ki_a", 0.31)]
        return [_point("p2", "ki_b", 0.72), _point("p3", "ki_a", 0.55 + n / 100), _point(f"p{9+n}", "ki_b", 0.40)]


def _run_search(monkeypatch, qdrant, extra):
    provider = _Provider()
    monkeypatch.setattr(sem_mod, "get_embedding_provider", lambda: provider)
    monkeypatch.setattr(sem_mod, "qdrant_manager", SimpleNamespace(client=qdrant))
    hits = asyncio.run(sem_mod.SemanticRetriever().search(tenant_id="t1", plan=_plan(), top_k=5, extra_queries=extra))
    return hits, provider


def test_multi_query_pools_best_score_per_item(monkeypatch):
    q = _Qdrant()
    hits, provider = _run_search(monkeypatch, q, ["concept one", "concept two"])
    assert provider.calls == 1            # one embedding round trip for all queries
    assert q.queries == 3                 # original + 2 concepts, searched in parallel
    ids = [h.knowledge_item_id for h in hits]
    assert ids == ["ki_b", "ki_a"]        # deduplicated per item, best score first
    assert hits[0].score == pytest.approx(0.72) and hits[1].score == pytest.approx(0.57)


def test_one_failed_query_does_not_sink_the_rest(monkeypatch):
    hits, _ = _run_search(monkeypatch, _Qdrant(fail_on=1), ["concept one", "concept two"])
    assert {h.knowledge_item_id for h in hits} == {"ki_a", "ki_b"}


def test_all_queries_failing_still_raises(monkeypatch):
    class Down(_Qdrant):
        async def search(self, **_):
            raise RuntimeError("down")
    with pytest.raises(RuntimeError):
        _run_search(monkeypatch, Down(), ["c"])


def test_no_extra_queries_is_single_search(monkeypatch):
    q = _Qdrant()
    hits, _ = _run_search(monkeypatch, q, None)
    assert q.queries == 1 and [h.knowledge_item_id for h in hits] == ["ki_a"]
