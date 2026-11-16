"""Lexical (keyword) retrieval branch — IDF-weighted name / SKU matching in PostgreSQL.

Why this exists
---------------
Dense vectors are only as good as the embedding model. With the local deterministic
provider (hashed bag-of-words, no IDF), every catalogue item shares the same long
projection header, so all document vectors are nearly identical (cosine ~0.95) and a
customer query like "Do you have DIN RAIL?" scored the right product BELOW unrelated
ones — measured recall@5 for name queries was 0%.

Hybrid retrieval (sparse + dense) is the standard remedy: this branch matches whole
words of the customer's question against product titles and identity keys / SKUs,
weighting rare words (e.g. "DIN", "PCB", "DAHD0063") far above common ones
("model", "suitable"). It is model-independent, so names, partial names and SKUs typed
inside a sentence resolve correctly whatever embedding provider is configured.

Scoring
-------
    weight(token) = ln((N + 1) / (df + 1)) + 1           (smoothed IDF over the tenant)
    score(item)   = Σ matched weights / Σ weights of query words present in the
                    catalogue                              (0..1, fraction of the
                                                            query's catalogue
                                                            vocabulary matched)
An exact identity-key / SKU token match forces score = 1.0.

Cost: one indexed-by-tenant scan + one version load (2 round trips). Titles are short,
so word-boundary regex over tens of thousands of rows stays in the low milliseconds.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.knowledge import KnowledgeItem, KnowledgeVersion
from app.services.knowledge_read_contract import build_current_version_filter, normalize_utc_timestamp

# Words customers use around the thing they ask about. They carry no product identity.
_STOPWORDS: Set[str] = {
    "a", "an", "and", "any", "are", "as", "at", "be", "can", "could", "do", "does", "for",
    "from", "get", "give", "has", "have", "hello", "hi", "how", "i", "if", "in", "is", "it",
    "kindly", "let", "me", "much", "my", "need", "of", "on", "or", "our", "please", "send",
    "share", "should", "sir", "madam", "tell", "that", "the", "there", "this", "to", "us",
    "want", "we", "what", "whats", "which", "who", "will", "with", "would", "you", "your",
    "price", "prices", "pricing", "cost", "rate", "rates", "mrp", "quote", "quotation",
    "available", "availability", "stock", "details", "detail", "info", "information",
    "about", "buy", "order", "regards", "thanks", "thank", "dear", "team", "rs", "inr",
    "also", "some", "know", "looking", "interested", "required", "require", "product",
    "products", "item", "items", "sell", "sells", "selling", "something", "anything",
    "keep", "using", "use", "used", "good", "best", "new", "like", "just", "get",
}

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[-/.][a-z0-9]+)*")
_MAX_TOKENS = 12

STRONG_MATCH_THRESHOLD = 0.75
FACET_WEIGHT = 0.6


@dataclass
class LexicalHit:
    knowledge_item_id: str
    knowledge_version_id: Optional[str]
    score: float
    exact_key: bool
    title: str
    # Share of the query's words that exist anywhere in this catalogue (0..1). Below 1 the
    # keyword branch is partly blind: a word it cannot see ("fridge" in a catalogue that says
    # "mini bar") may be the very thing asked for, so its scores describe only the rest.
    query_coverage: float = 1.0


def tokenize_query(query: str) -> List[str]:
    """Meaningful lowercase tokens; hyphenated codes are kept whole and also split."""
    out: List[str] = []
    seen: Set[str] = set()
    for tok in _TOKEN_RE.findall((query or "").lower()):
        candidates = [tok]
        if any(sep in tok for sep in "-/."):
            candidates += [p for p in re.split(r"[-/.]", tok) if p]
        for c in candidates:
            if c in _STOPWORDS:
                continue
            c = _singular(c)
            if c in seen or c in _STOPWORDS:
                continue
            if len(c) < 2 and not c.isdigit():
                continue
            seen.add(c)
            out.append(c)
    return out[:_MAX_TOKENS]


def _singular(token: str) -> str:
    """Light English plural folding for alphabetic words ("bars"->"bar", "brushes"->"brush").

    Matching is prefix-based, so the singular stem still matches plural titles.
    Codes / numbers are left untouched.
    """
    if not token.isalpha() or len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith(("sses", "shes", "ches", "xes", "zes")):
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def _word_pattern(token: str) -> str:
    """PostgreSQL ARE word pattern (\\m = word start, \\M = word end), metacharacters escaped.

    Tokens of 3+ characters match as a word PREFIX, so a partial model code
    ("DAHD", "DSDR1") still reaches "DAHD0080" / "DSDR108"; shorter tokens
    ("ss", "4") must match a whole word so they don't match everything.
    """
    escaped = re.sub(r"([.\-/\\^$*+?()\[\]{}|])", r"\\\1", token)
    if len(token) < 3:
        return r"\m" + escaped + r"\M"
    if any(ch.isdigit() for ch in token):
        return r"\m" + escaped  # code-like token: open prefix ("DSDR1" -> "DSDR108")
    # Plain word: whole word, plural ending, or a letter-prefix that continues straight into
    # a model number ("DAHD" -> "DAHD0080"). An open prefix made ordinary words match
    # unrelated longer words ("dust" -> "dustbin", "out" -> "outdoor"), which pulled noise
    # into the keyword list for descriptive questions.
    return r"\m" + escaped + r"(?:(?:s|es)?\M|(?=[0-9]))"


class LexicalRetriever:
    """IDF-weighted keyword retrieval over titles, product category/type, brand and SKUs."""

    async def search(
        self,
        db: AsyncSession,
        tenant_id: str,
        query_text: str,
        top_k: int = 5,
        exclude_entity_ids: Optional[Sequence[str]] = None,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion, LexicalHit]]:
        if not tenant_id or not tenant_id.strip():
            raise ValueError("tenant_id is required for lexical retrieval")
        tokens = tokenize_query(query_text)
        if not tokens:
            return []

        params: Dict[str, object] = {"tid": tenant_id, "toks": tokens, "lim": max(1, top_k) * 3}
        # Very large catalogues: a GIN full-text prefilter narrows the scan to the best candidates
        # (posting-list lookup instead of a regex over every item). Smaller catalogues keep the
        # exact full scan, so ranking is unchanged where it is already fast.
        prefilter = ""
        cand = await _prefilter_candidates(db, tenant_id, tokens)
        if cand is not None:
            if not cand:
                return []
            params["cand"] = cand
            prefilter = " AND i.id = ANY(:cand)"
        match_cols = []
        for i, tok in enumerate(tokens):
            params[f"p{i}"] = _word_pattern(tok)
            # t{i}: word in the title / SKU (full weight); m{i}: anywhere incl. facets
            match_cols.append(
                f"((title ~* :p{i}) OR (coalesce(k, '') ~* :p{i}))::int AS t{i}, "
                f"((hay ~* :p{i}) OR (coalesce(k, '') ~* :p{i}))::int AS m{i}"
            )
        any_match = " + ".join(f"m{i}" for i in range(len(tokens)))
        weights = [f"(ln((s.n + 1.0) / (s.d{i} + 1.0)) + 1.0)" for i in range(len(tokens))]
        df_cols = ", ".join(f"coalesce(sum(m{i}), 0) AS d{i}" for i in range(len(tokens)))
        # A word found only in a facet (category / type / brand) counts FACET_WEIGHT of a title
        # hit, so "Stainless Steel Folding Grab Bar" outranks a shower seat that merely sits
        # in the "Grab Bar" category, and the queue manager outranks its own screws.
        matched = " + ".join(
            f"(c.t{i} + {FACET_WEIGHT} * (c.m{i} - c.t{i})) * {w}" for i, w in enumerate(weights)
        )
        # Normalise only over query words that exist somewhere in this catalogue: a word
        # that matches no item ("disabled", "people") carries no information about which
        # item is meant and must not drag down an otherwise exact name match.
        total = " + ".join(
            f"(CASE WHEN s.d{i} > 0 THEN {w} ELSE 0 END)" for i, w in enumerate(weights)
        )

        known = " + ".join(f"(s.d{i} > 0)::int" for i in range(len(tokens)))

        sql = text(f"""
            WITH base AS (
                -- Searchable text = title + the facets customers name products by
                -- (product category, product type, brand). "Do you have carpet tiles?" must
                -- reach items whose CATEGORY is "Marzel Carpet Tiles" even if the title isn't.
                SELECT i.id, i.title, i.external_identity_key AS k, i.current_version_id AS vid,
                       concat_ws(' ', i.title,
                                 v.canonical_data->>'category',
                                 v.canonical_data->'custom_attributes'->>'category',
                                 v.canonical_data->>'product_type',
                                 v.canonical_data->'custom_attributes'->>'product_type',
                                 v.canonical_data->>'sub_category',
                                 v.canonical_data->>'brand',
                                 v.canonical_data->>'sku') AS hay
                FROM knowledge_items i
                LEFT JOIN knowledge_versions v ON v.id = i.current_version_id
                WHERE i.tenant_id = :tid AND i.is_active{prefilter}
            ),
            m AS (
                SELECT id, vid, title, k,
                       {", ".join(match_cols)},
                       (lower(coalesce(k, '')) = ANY(:toks))::int AS exact
                FROM base
            ),
            cand AS (SELECT * FROM m WHERE ({any_match}) > 0 OR exact = 1),
            s AS (SELECT (SELECT count(*) FROM base) AS n, {df_cols} FROM cand)
            SELECT c.id, c.vid, c.title, c.exact, ({known}) AS known,
                   CASE WHEN c.exact = 1 THEN 1.0 ELSE ({matched}) / GREATEST(({total}), 1e-9) END AS score
            FROM cand c CROSS JOIN s
            ORDER BY score DESC, c.exact DESC, length(c.title) ASC
            LIMIT :lim
        """)
        rows = (await db.execute(sql, params)).all()

        excluded = {str(x).strip() for x in (exclude_entity_ids or []) if x}
        ranked = [r for r in rows if r.id not in excluded and r.vid]
        if not ranked:
            return []

        # Load the authoritative current versions (with temporal validity) in one query.
        ref_time = normalize_utc_timestamp(as_of)
        ver_res = await db.execute(
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeVersion.id.in_([r.vid for r in ranked]),
                build_current_version_filter(ref_time),
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
        )
        versions = {v.id: v for v in ver_res.scalars().all() if v.knowledge_item is not None}

        out: List[Tuple[KnowledgeItem, KnowledgeVersion, LexicalHit]] = []
        for r in ranked:
            v = versions.get(r.vid)
            if v is None:
                continue
            out.append((
                v.knowledge_item,
                v,
                LexicalHit(
                    knowledge_item_id=r.id,
                    knowledge_version_id=r.vid,
                    score=round(float(r.score), 4),
                    exact_key=bool(r.exact),
                    title=r.title,
                    query_coverage=round(float(r.known) / len(tokens), 4),
                ),
            ))
            if len(out) >= top_k * 2:
                break
        return out


lexical_retriever = LexicalRetriever()


_TENANT_SIZE: Dict[str, Tuple[float, int]] = {}
_SIZE_TTL_S = 300.0
_TSQ_SAFE = re.compile(r"[^a-z0-9]")


async def _prefilter_candidates(db, tenant_id: str, tokens: List[str]) -> Optional[List[str]]:
    """Candidate ids from the GIN full-text index for tenants above the configured size, else None
    (= no prefilter). Prefix matching (tok:*) keeps partial words and codes findable."""
    import time as _time

    from sqlalchemy import text as _t

    from app.core.config import get_retrieval_budget
    from app.services.knowledge_search_index import is_available

    budget = get_retrieval_budget()
    if budget.lexical_prefilter_threshold <= 0 or not await is_available(db, tenant_id):
        return None
    hit = _TENANT_SIZE.get(tenant_id)
    if hit is None or _time.monotonic() - hit[0] > _SIZE_TTL_S:
        n = int((await db.execute(_t("SELECT count(*) FROM knowledge_search_index WHERE tenant_id = :t"),
                                  {"t": tenant_id})).scalar() or 0)
        _TENANT_SIZE[tenant_id] = (_time.monotonic(), n)
    else:
        n = hit[1]
    if n <= budget.lexical_prefilter_threshold:
        return None
    terms = [t for t in (_TSQ_SAFE.sub("", tok) for tok in tokens) if t]
    if not terms:
        return None
    tsq = " | ".join(f"{t}:*" for t in terms)
    rows = (await db.execute(_t("""
        SELECT knowledge_item_id FROM knowledge_search_index
        WHERE tenant_id = :t AND search_tsv @@ to_tsquery('simple', :q)
        ORDER BY ts_rank_cd(search_tsv, to_tsquery('simple', :q)) DESC
        LIMIT :lim"""), {"t": tenant_id, "q": tsq, "lim": budget.lexical_prefilter_limit})).scalars().all()
    return list(rows)
