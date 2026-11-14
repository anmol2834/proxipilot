"""Context Intelligence Engine.

The single layer between the seven memories and the drafter. For every reply it:

  1. Retrieves  — all memories in parallel, each under its own timeout; a slow or failing
                  memory degrades that section only, never the reply. Per-memory latency and
                  availability are recorded.
  2. Connects   — one extra query gathers the cross-memory signals (contact language, thread
                  stage / sentiment / stated facts, our overdue promises in this thread,
                  the customer's current words).
  3. Checks     — deterministic conflict and staleness rules:
                    OUTDATED_FACT       a packaged fact is expired / historical / not verified
                    PRICE_CHANGED       a price stated earlier in the conversation differs from
                                        the current verified price for the same product
                    OVERDUE_PROMISE     we owe the customer something past its deadline
                    CUSTOMER_CHASING    ...and the customer is chasing it / is unhappy (high)
                    LANGUAGE            the customer's language / employee language preference
                    NEGATIVE_SENTIMENT  the conversation has turned negative
                    MEMORY_GAP          memory missing / behind / a memory failed
  4. Evaluates  — a context confidence score from evidence status, risks and memory health.
                  Any HIGH risk (or very low confidence) routes the reply to human review.
  5. Budgets    — keeps the total context within a fixed size, trimming the least important
                  sections first, by whole lines.

The result is a ``ContextBundle``: sections for the drafter, an alerts section with exact
instructions, risks, confidence, escalations and timings. ``assemble`` never raises.
"""

from __future__ import annotations

import asyncio
import json
import numbers
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import text

from app.core.database import db_manager
from app.core.logging import logger
from app.services.feedback_memory import strip_quoted

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

MEMORY_TIMEOUT_SECONDS = 6.0
SIGNALS_TIMEOUT_SECONDS = 5.0
CONTEXT_BUDGET_CHARS = 8000
LOW_CONFIDENCE_ESCALATION = 0.35
PRICE_TOLERANCE = 0.005

# Drafter section order = priority (first is most important; last is trimmed first).
SECTION_PRIORITY = ("catalogue", "org", "commitments", "thread", "contact", "feedback", "style")

_CHASE = re.compile(r"\b(any update|still waiting|reminder|follow(?:ing)? up|when will|no (?:reply|response)|"
                    r"waiting for|how long|it'?s been|not received|haven'?t received|yet to receive|kab tak|abhi tak)\b", re.I)
_ORDER = re.compile(r"\b(place (?:the|an|our) order|confirm(?:ing)? (?:the|our) order|go ahead|proceed|"
                    r"purchase order|\bpo\b|we (?:will|'ll) (?:take|order|buy)|send (?:the )?invoice|payment)\b", re.I)
_AMOUNT = re.compile(r"(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]+)?)", re.I)
_PRICE_WORDS = re.compile(r"\b(quot\w*|price[ds]?|priced|rate|per (?:unit|piece|pc|set)|each)\b|/\s*(?:unit|pc|piece)|@", re.I)
_SENTENCE = re.compile(r"(?<=[.;!?])\s+")
_TOKEN = re.compile(r"[a-z0-9]+", re.I)
_STOP = set("the a an and or of for with to in on per unit units pcs piece pieces price quoted rate total "
            "company customer each set mm size model".split())


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class Risk:
    code: str
    severity: str          # low | medium | high
    message: str
    instruction: str
    drafter_message: Optional[str] = None   # what the drafter sees (e.g. without old figures)
    stale_amounts: List[float] = field(default_factory=list)  # superseded figures to redact from memory

    @property
    def escalates(self) -> bool:
        return self.severity == "high"


@dataclass
class ContextBundle:
    sections: Dict[str, Optional[str]] = field(default_factory=dict)
    risks: List[Risk] = field(default_factory=list)
    confidence: float = 1.0
    confidence_reasons: List[str] = field(default_factory=list)
    escalations: List[str] = field(default_factory=list)
    timings_ms: Dict[str, int] = field(default_factory=dict)
    failed: List[str] = field(default_factory=list)
    trimmed: List[str] = field(default_factory=list)
    situations: List[str] = field(default_factory=list)
    org_escalations: List[Dict[str, str]] = field(default_factory=list)
    customer_message: Optional[str] = None  # latest customer email (quotes stripped), for completeness

    @property
    def alerts(self) -> Optional[str]:
        relevant = [r for r in self.risks if r.instruction]
        if not relevant:
            return None
        order = {"high": 0, "medium": 1, "low": 2}
        return "\n".join(f"- [{r.severity.upper()}] {r.drafter_message or r.message} → {r.instruction}"
                         for r in sorted(relevant, key=lambda r: order[r.severity]))

    @property
    def escalation_reason(self) -> Optional[str]:
        return "; ".join(self.escalations) if self.escalations else None

    def metrics(self) -> Dict[str, Any]:
        return {
            "context_confidence": self.confidence, "context_risks": [f"{r.severity}:{r.code}" for r in self.risks],
            "context_escalations": self.escalations, "memory_timings_ms": self.timings_ms,
            "memory_failed": self.failed, "context_trimmed": self.trimmed,
            "memories_used": sorted(k for k, v in self.sections.items() if v),
        }

    def to_dict(self) -> Dict[str, Any]:
        d = self.metrics()
        d.update(sections=self.sections, alerts=self.alerts, risks=[asdict(r) for r in self.risks],
                 confidence=self.confidence, confidence_reasons=self.confidence_reasons,
                 escalations=self.escalations, situations=self.situations)
        return d


# ---------------------------------------------------------------------------
# Pure checks (unit-tested)
# ---------------------------------------------------------------------------


def _fact_get(f: Any, k: str, default=None):
    return f.get(k, default) if isinstance(f, dict) else getattr(f, k, default)


def _enum_val(v: Any) -> str:
    return str(getattr(v, "value", v) or "")


def package_facts(package: Any) -> List[Any]:
    out: List[Any] = []
    for req in getattr(package, "requirements", None) or []:
        out.extend(getattr(req, "facts", None) or [])
    return out


def check_outdated_facts(facts: Sequence[Any], now: datetime) -> List[Risk]:
    risks: List[Risk] = []
    for f in facts:
        temporal = _enum_val(_fact_get(f, "temporal_status")).lower()
        verification = _enum_val(_fact_get(f, "verification_status")).upper()
        until = _fact_get(f, "effective_until")
        expired_window = False
        if until:
            try:
                dt = datetime.fromisoformat(str(until).replace("Z", "+00:00"))
                expired_window = (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)) < now
            except ValueError:
                pass
        if temporal in ("expired", "historical") or expired_window or verification in ("EXPIRED", "CONFLICT_DETECTED"):
            label = f"{_fact_get(f, 'entity_title') or _fact_get(f, 'entity_id')} — {_fact_get(f, 'attribute_name')}"
            risks.append(Risk(
                "OUTDATED_FACT", "medium", f"Outdated or superseded fact in evidence: {label}",
                f"Do not state this {_fact_get(f, 'attribute_name')} as current; use only current verified facts "
                "or say the team will confirm it."))
    return risks


def _tokens(s: str) -> Set[str]:
    return {t.lower() for t in _TOKEN.findall(s or "") if len(t) >= 3 and t.lower() not in _STOP and not t.isdigit()}


def _amounts(s: str) -> List[float]:
    out = []
    for m in _AMOUNT.finditer(s or ""):
        try:
            out.append(float(m.group(1).replace(",", "")))
        except ValueError:
            pass
    return out


def check_price_drift(facts: Sequence[Any], stated: Sequence[str], current_text: str) -> List[Risk]:
    """Earlier-stated prices (conversation facts / commitments) vs the current verified price."""
    verified: List[Tuple[Set[str], float, str]] = []
    for f in facts:
        attr = str(_fact_get(f, "attribute_name") or "").lower()
        val = _fact_get(f, "typed_value")
        if "price" in attr and isinstance(val, numbers.Number) and not isinstance(val, bool) and val > 0:
            title = str(_fact_get(f, "entity_title") or "")
            verified.append((_tokens(title), float(val), title))
    if not verified:
        return []
    risks: List[Risk] = []
    seen: Set[str] = set()
    ordering = bool(_ORDER.search(current_text or ""))
    for line in stated:
        if not _PRICE_WORDS.search(line or ""):
            continue  # an amount without price wording (budget, order value...) is not a quote
        amts = _amounts(line)
        if not amts:
            continue
        toks = _tokens(line)
        for vt, vprice, title in verified:
            if len(toks & vt) < 2 or title in seen:
                continue
            if all(abs(a - vprice) / vprice > PRICE_TOLERANCE for a in amts):
                seen.add(title)
                earlier = ", ".join(f"₹{a:,.2f}".rstrip("0").rstrip(".") for a in amts)
                risks.append(Risk(
                    "PRICE_CHANGED", "high" if ordering else "medium",
                    f"Price for '{title}' changed since it was stated in this conversation "
                    f"(earlier {earlier}, now ₹{vprice:,.2f})",
                    "Quote only the current verified price and do not restate the earlier figure; if the customer "
                    "is relying on the earlier quote, refer to it as 'our earlier quote' and say the team will "
                    "confirm the applicable price — do not honour or refuse the old price yourself.",
                    drafter_message=f"The price for '{title}' has changed since it was quoted earlier in this "
                                    f"conversation; the current verified price is ₹{vprice:,.2f}",
                    stale_amounts=list(amts)))
    return risks


def check_commitments(overdue: Sequence[Dict[str, Any]], current_text: str, sentiment: Optional[str],
                      now: datetime) -> List[Risk]:
    if not overdue:
        return []
    items = "; ".join(o["statement"] for o in overdue[:3])
    chasing = bool(_CHASE.search(current_text or "")) or (sentiment or "") == "negative"
    risks = [Risk("OVERDUE_PROMISE", "medium", f"We have overdue promises in this conversation: {items}",
                  "Acknowledge the delay honestly if relevant; never claim it is done and never invent a new date.")]
    if chasing:
        risks.append(Risk("CUSTOMER_CHASING", "high",
                          "The customer is chasing / unhappy while our promise is overdue",
                          "A person should handle this reply; keep the draft apologetic and factual."))
    return risks


def check_language(contact_language: Optional[str], thread_language: Optional[str]) -> List[Risk]:
    cl, tl = (contact_language or "").strip(), (thread_language or "").strip()
    if cl and tl and cl.lower() != tl.lower():
        return [Risk("LANGUAGE", "low", f"Customer writes in {tl}; their recorded preference is {cl}",
                     f"Reply in {tl} (the language of this conversation) unless the customer asked otherwise.")]
    lang = tl or cl
    if lang and lang.lower() not in ("english", "en"):
        return [Risk("LANGUAGE", "low", f"Customer's language is {lang}", f"Reply in {lang}.")]
    return []


def check_sentiment(sentiment: Optional[str], stage: Optional[str]) -> List[Risk]:
    if (sentiment or "") == "negative":
        return [Risk("NEGATIVE_SENTIMENT", "medium",
                     f"The conversation has turned negative (stage: {stage or 'unknown'})",
                     "Lead with a brief, sincere acknowledgement; be specific about next steps; no upselling.")]
    return []


def check_memory_health(thread_mem: Optional[Dict[str, Any]], unsummarised: int, failed: Sequence[str]) -> List[Risk]:
    risks = []
    if failed:
        risks.append(Risk("MEMORY_GAP", "low", f"Memory unavailable for this reply: {', '.join(failed)}", ""))
    if thread_mem is not None and unsummarised > 3:
        risks.append(Risk("MEMORY_GAP", "low", f"Conversation memory is {unsummarised} messages behind", ""))
    return risks


def redact_stale_amounts(sections: Dict[str, Optional[str]], amounts: Sequence[float],
                         names: Sequence[str] = ("thread", "commitments", "contact")) -> int:
    """Replace superseded figures (e.g. an old quoted price) in memory sections so outdated values
    never reach the drafter. Returns the number of replacements. Mutates ``sections``."""
    if not amounts:
        return 0
    targets = {round(a, 2) for a in amounts}
    count = 0

    def repl(m: "re.Match") -> str:
        nonlocal count
        try:
            val = round(float(m.group(1).replace(",", "")), 2)
        except ValueError:
            return m.group(0)
        if val in targets:
            count += 1
            return "[earlier quoted price — superseded]"
        return m.group(0)

    for name in names:
        if sections.get(name):
            sections[name] = _AMOUNT.sub(repl, sections[name])
    return count


def score_confidence(package_status: str, risks: Sequence[Risk], failed: Sequence[str]) -> Tuple[float, List[str]]:
    score, reasons = 1.0, []
    penalties = {"NO_EVIDENCE": 0.4, "NEEDS_CLARIFICATION": 0.2, "PARTIAL_EVIDENCE": 0.15, "ACTION_REQUIRED": 0.1}
    if package_status in penalties:
        score -= penalties[package_status]
        reasons.append(f"evidence status {package_status} (-{penalties[package_status]})")
    weights = {"high": 0.3, "medium": 0.1, "low": 0.02}
    for r in risks:
        score -= weights[r.severity]
        reasons.append(f"{r.severity} risk {r.code} (-{weights[r.severity]})")
    if failed:
        score -= 0.05 * len(failed)
        reasons.append(f"{len(failed)} memory source(s) unavailable (-{0.05 * len(failed):.2f})")
    return round(max(0.0, min(1.0, score)), 2), reasons


def apply_budget(sections: Dict[str, Optional[str]], budget: int = CONTEXT_BUDGET_CHARS) -> List[str]:
    """Trim least-important sections (whole lines from the end) until the total fits. Mutates."""
    trimmed: List[str] = []

    def total() -> int:
        return sum(len(v) for v in sections.values() if v)

    for name in reversed(SECTION_PRIORITY):
        if total() <= budget:
            break
        val = sections.get(name)
        if not val:
            continue
        lines = val.split("\n")
        while lines and total() > budget:
            lines.pop()
            sections[name] = "\n".join(lines) or None
        trimmed.append(name)
    return trimmed


# ---------------------------------------------------------------------------
# Company knowledge overview (Memory 1, catalogue level)
# ---------------------------------------------------------------------------

_COUNT_STOPWORDS = frozenset(
    "a an and any are at available availability by can do does for from get have how in is it item items many "
    "me my need of on or our please price prices product products range show stock the to want we what which "
    "with you your all some list types type kind kinds models model number count total".split())


def count_terms(raw: str) -> List[str]:
    """Normalise a requested product phrase into match tokens ('Grab Bars 600mm' -> ['grab', 'bar', '600mm'])."""
    toks = []
    for t in re.findall(r"[a-z0-9]+", (raw or "").lower()):
        if len(t) < 2 or t in _COUNT_STOPWORDS:
            continue
        if len(t) > 4 and t.endswith("ies"):
            t = t[:-3] + "y"
        elif len(t) > 4 and t.endswith("es") and t[-3] in "sxz":
            t = t[:-2]
        elif len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        if t not in toks:
            toks.append(t)
    return toks[:6]


def requested_terms(package: Any) -> List[str]:
    """Product phrases the customer asked about, from the verified requirement plan."""
    out: List[str] = []
    for req in (getattr(package, "requirements", None) or []):
        for ent in (getattr(req, "target_entities", None) or []):
            ent = str(ent or "").strip()[:80]
            if ent and ent.lower() not in (o.lower() for o in out):
                out.append(ent)
    return out[:5]


def format_catalogue_overview(total: int, by_category: Sequence[Tuple[str, int]], top_brands: Sequence[Tuple[str, int]],
                              has_stock_data: bool,
                              term_counts: Sequence[Tuple[str, int]] = (),
                              product_categories: Sequence[Tuple[str, int]] = (),
                              product_category_total: int = 0) -> Optional[str]:
    if total <= 0:
        return None
    lines = [f"- Active products in the official catalogue (unique product codes): {total:,}"]
    cats = [f"{humanize_key(c)} ({n:,})" for c, n in by_category if c and n]
    if cats:
        lines.append("- By knowledge category: " + ", ".join(cats))
    brands = [f"{b} ({n:,})" for b, n in top_brands if b and n]
    if brands:
        lines.append("- Main brands: " + ", ".join(brands[:6]))
    pcs = [f"{c} ({n:,})" for c, n in product_categories if c and n]
    if pcs:
        more = product_category_total - len(pcs)
        lines.append(f"- Product categories ({product_category_total:,} in total; largest first): " + ", ".join(pcs)
                     + (f", and {more:,} more" if more > 0 else ""))
    for term, n in term_counts:
        lines.append(f"- Exact number of catalogue items matching \"{term}\": {n:,}"
                     + ("" if n else " (none found by name; do not claim we have it)"))
    lines.append("- Live stock quantities are " + ("recorded per item (see Verified Facts)." if has_stock_data
                 else "NOT recorded in the catalogue: never state stock levels; offer to confirm availability for specific items."))
    return "\n".join(lines)


def humanize_key(v: str) -> str:
    return (v or "").replace("_", " ").strip().capitalize()


async def catalogue_overview(tenant_id: str, terms: Sequence[str] = ()) -> Optional[str]:
    """Verified catalogue-level facts so count questions are answered from the uploaded rows:
    total items, per-category and per-brand counts, and the EXACT number of items matching each
    product the customer asked about (so a reply never presents the top-N retrieved items as the
    whole range). Always live (no cache): a fresh upload is reflected on the very next email.
    Runs in parallel with the other memories, so it adds no wall-clock time."""
    term_tokens = [(t, count_terms(t)) for t in terms]
    term_tokens = [(t, toks) for t, toks in term_tokens if toks]
    params: Dict[str, Any] = {"t": tenant_id}
    term_sql = []
    for i, (_, toks) in enumerate(term_tokens):
        conds = []
        for j, tok in enumerate(toks):
            params[f"k{i}_{j}"] = f"%{tok}%"
            conds.append(f"hay ILIKE :k{i}_{j}")
        term_sql.append(f"SELECT 'term' AS kind, '{i}' AS k, count(*) AS n FROM cur WHERE {' AND '.join(conds)}")
    async with db_manager.session_factory() as db:
        rows = (await db.execute(text("""
            WITH cur AS (
                SELECT i.category, v.canonical_data AS cd,
                       coalesce(v.canonical_data->'custom_attributes'->>'category',
                                v.canonical_data->>'sub_category') AS pcat,
                       lower(coalesce(i.title, '') || ' ' || coalesce(v.canonical_data->>'name', '') || ' ' ||
                             coalesce(v.canonical_data->>'product_name', '') || ' ' ||
                             coalesce(v.canonical_data->>'category', '') || ' ' ||
                             coalesce(v.canonical_data->'custom_attributes'->>'category', '') || ' ' ||
                             coalesce(v.canonical_data->'custom_attributes'->>'product_type', '') || ' ' ||
                             coalesce(v.canonical_data->>'sub_category', '') || ' ' ||
                             coalesce(v.canonical_data->>'brand', '') || ' ' ||
                             coalesce(v.canonical_data->>'sku', '')) AS hay
                FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
                WHERE i.tenant_id = :t AND i.is_active
            )
            SELECT 'cat' AS kind, category AS k, count(*) AS n FROM cur GROUP BY category
            UNION ALL
            (SELECT 'brand', cd->>'brand', count(*) FROM cur WHERE coalesce(cd->>'brand', '') <> ''
             GROUP BY cd->>'brand' ORDER BY count(*) DESC LIMIT 6)
            UNION ALL
            (SELECT 'pcat', pcat, count(*) FROM cur WHERE coalesce(pcat, '') <> ''
             GROUP BY pcat ORDER BY count(*) DESC LIMIT 15)
            UNION ALL
            SELECT 'pcat_total', NULL, count(DISTINCT pcat) FROM cur
            UNION ALL
            SELECT 'stock', NULL, count(*) FROM cur
             WHERE cd ?| array['stock', 'stock_quantity', 'quantity_available', 'in_stock', 'availability']
            """ + "".join("\nUNION ALL\n" + q for q in term_sql)), params)).all()
    cats = [(r.k, int(r.n)) for r in rows if r.kind == "cat"]
    brands = [(r.k, int(r.n)) for r in rows if r.kind == "brand"]
    stock = next((int(r.n) for r in rows if r.kind == "stock"), 0)
    by_idx = {r.k: int(r.n) for r in rows if r.kind == "term"}
    pcats = [(r.k, int(r.n)) for r in rows if r.kind == "pcat"]
    pcat_total = next((int(r.n) for r in rows if r.kind == "pcat_total"), 0)
    term_counts = [(t, by_idx.get(str(i), 0)) for i, (t, _) in enumerate(term_tokens)]
    return format_catalogue_overview(sum(n for _, n in cats), cats, brands, stock > 0, term_counts,
                                     product_categories=pcats, product_category_total=pcat_total)


def invalidate_catalogue_overview(tenant_id: str) -> None:
    """Kept for API compatibility: the overview is computed live, nothing to invalidate."""
    return None


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

Fetcher = Callable[[Any], Awaitable[Any]]


class ContextEngine:
    def __init__(self, fetchers: Optional[Dict[str, Fetcher]] = None,
                 signals_loader: Optional[Callable[[str, str], Awaitable[Dict[str, Any]]]] = None) -> None:
        self._fetchers = fetchers
        self._signals_loader = signals_loader

    def _default_fetchers(self) -> Dict[str, Fetcher]:
        from app.services.commitment_memory import commitment_memory_service
        from app.services.contact_memory import contact_memory_service
        from app.services.feedback_memory import feedback_memory_service, primary_intent
        from app.services.org_memory import org_memory_service
        from app.services.style_memory import style_memory_service
        from app.services.thread_memory import thread_memory_service

        return {
            "contact": lambda p: contact_memory_service.build_prompt_context(p.tenant_id, p.message_id),
            "feedback": lambda p: feedback_memory_service.build_prompt_guidance(p.tenant_id, primary_intent(p)),
            "commitments": lambda p: commitment_memory_service.build_prompt_context(p.tenant_id, p.message_id),
            "style": lambda p: style_memory_service.build_prompt_context(p.tenant_id, p.message_id),
            "org": lambda p: org_memory_service.get_guidance(p.tenant_id, p.message_id),
            "thread": lambda p: thread_memory_service.build_prompt_context(p.tenant_id, p.message_id),
            "catalogue": lambda p: catalogue_overview(p.tenant_id, requested_terms(p)),
        }

    async def _timed(self, name: str, coro: Awaitable[Any], timeout: float) -> Tuple[str, Any, int, bool]:
        t0 = time.perf_counter()
        try:
            val = await asyncio.wait_for(coro, timeout)
            return name, val, int((time.perf_counter() - t0) * 1000), True
        except Exception as exc:  # noqa: BLE001 — one memory never breaks the reply
            logger.warning("context engine: source failed", source=name, error=f"{type(exc).__name__}: {str(exc)[:200]}")
            return name, None, int((time.perf_counter() - t0) * 1000), False

    async def _load_signals(self, tenant_id: str, message_id: str) -> Dict[str, Any]:
        async with db_manager.session_factory() as db:
            row = (await db.execute(text("""
                WITH cur AS (
                    SELECT id, thread_id, lower(from_email) AS email, body_text, sent_at
                    FROM email_messages WHERE id = :m AND tenant_id = :t
                )
                SELECT cur.thread_id, cur.body_text,
                       (SELECT preferred_language FROM contacts c WHERE c.tenant_id = :t AND c.email = cur.email) AS contact_language,
                       tm.language AS thread_language, tm.sentiment, tm.stage, tm.key_facts, tm.summary AS thread_summary,
                       tm.included_until_sent_at, (tm.id IS NOT NULL) AS has_thread_memory,
                       (SELECT count(*) FROM email_messages m2 WHERE m2.tenant_id = :t AND m2.thread_id = cur.thread_id
                          AND m2.sent_at < cur.sent_at
                          AND (tm.included_until_sent_at IS NULL OR m2.sent_at > tm.included_until_sent_at)) AS unsummarised,
                       (SELECT coalesce(json_agg(json_build_object('statement', c.statement, 'due_at', c.due_at)), '[]')
                          FROM commitments c WHERE c.tenant_id = :t AND c.thread_id = cur.thread_id AND c.status = 'open'
                           AND c.kind = 'commitment' AND c.owed_by = 'company' AND c.due_at < now()) AS overdue,
                       (SELECT coalesce(json_agg(c.statement), '[]') FROM commitments c
                          WHERE c.tenant_id = :t AND c.thread_id = cur.thread_id AND c.status = 'open') AS open_statements
                FROM cur LEFT JOIN thread_memories tm ON tm.tenant_id = :t AND tm.thread_id = cur.thread_id"""),
                {"t": tenant_id, "m": message_id})).mappings().first()
        if row is None:
            return {}
        d = dict(row)
        for k in ("overdue", "open_statements"):
            if isinstance(d.get(k), str):
                d[k] = json.loads(d[k])
        try:
            d["key_facts"] = json.loads(d["key_facts"]) if d.get("key_facts") else []
        except (ValueError, TypeError):
            d["key_facts"] = []
        return d

    async def assemble(self, package: Any) -> ContextBundle:
        """Retrieve, connect, check, score and budget all memory context. Never raises."""
        bundle = ContextBundle()
        t0 = time.perf_counter()
        try:
            fetchers = self._fetchers or self._default_fetchers()
            signals_loader = self._signals_loader or self._load_signals
            tasks = [self._timed(name, fn(package), MEMORY_TIMEOUT_SECONDS) for name, fn in fetchers.items()]
            tasks.append(self._timed("signals", signals_loader(package.tenant_id, package.message_id),
                                     SIGNALS_TIMEOUT_SECONDS))
            results = await asyncio.gather(*tasks)
            signals: Dict[str, Any] = {}
            for name, val, ms, ok in results:
                bundle.timings_ms[name] = ms
                if not ok:
                    bundle.failed.append(name)
                    continue
                if name == "signals":
                    signals = val or {}
                elif name == "org":
                    bundle.sections["org"] = getattr(val, "context", None)
                    bundle.situations = list(getattr(val, "situations", []) or [])
                    bundle.org_escalations = list(getattr(val, "escalations", []) or [])
                else:
                    bundle.sections[name] = val

            # Connect the dots across memories and evidence.
            now = datetime.now(timezone.utc)
            current = strip_quoted(signals.get("body_text"))
            bundle.customer_message = (current or "").strip()[:4000] or None
            facts = package_facts(package)
            stated = (list(signals.get("key_facts") or []) + list(signals.get("open_statements") or [])
                      + _SENTENCE.split(signals.get("thread_summary") or ""))
            risks: List[Risk] = []
            risks += check_outdated_facts(facts, now)
            risks += check_price_drift(facts, stated, current)
            risks += check_commitments(signals.get("overdue") or [], current, signals.get("sentiment"), now)
            risks += check_language(signals.get("contact_language"), signals.get("thread_language"))
            risks += check_sentiment(signals.get("sentiment"), signals.get("stage"))
            thread_mem = {"present": True} if signals.get("has_thread_memory") else None
            risks += check_memory_health(thread_mem, int(signals.get("unsummarised") or 0),
                                         [f for f in bundle.failed])
            bundle.risks = risks
            stale = [a for r in risks for a in r.stale_amounts]
            if stale:
                redacted = redact_stale_amounts(bundle.sections, stale)
                if redacted:
                    bundle.trimmed.append(f"redacted_stale_amounts:{redacted}")

            status = _enum_val(getattr(package, "package_status", ""))
            bundle.confidence, bundle.confidence_reasons = score_confidence(status, risks, bundle.failed)
            bundle.escalations = [r.message for r in risks if r.escalates]
            if bundle.org_escalations:
                bundle.escalations.append("Company practice requires human approval: "
                                          + "; ".join(e["title"] for e in bundle.org_escalations))
            if bundle.confidence < LOW_CONFIDENCE_ESCALATION and status not in ("NO_RETRIEVAL_REQUIRED",):
                bundle.escalations.append(f"Low context confidence ({bundle.confidence})")
            bundle.trimmed += apply_budget(bundle.sections)
        except Exception as exc:  # noqa: BLE001 — the engine itself must never break drafting
            logger.warning("context engine: assembly degraded", error=f"{type(exc).__name__}: {str(exc)[:300]}")
            bundle.failed.append("engine")
        bundle.timings_ms["total"] = int((time.perf_counter() - t0) * 1000)
        logger.info("context engine: assembled", package_id=getattr(package, "package_id", None),
                    **{k: v for k, v in bundle.metrics().items() if k in ("context_confidence", "context_risks",
                                                                         "memories_used", "memory_failed")},
                    total_ms=bundle.timings_ms["total"])
        return bundle


context_engine = ContextEngine()
