"""Entity role, product family and requirement eligibility — business-agnostic.

Why this exists
---------------
Vector / keyword similarity says "these records talk about similar things". It cannot say
"this record is the kind of thing the customer asked for". The air-curtain incident showed
the gap: an enquiry to BUY an air curtain was answered with hand-dryer SPARE PARTS because
nothing in the pipeline compared what a candidate *is* (finished product vs part vs raw
material; which product family) with what the customer *wants*.

This module adds that comparison as a deterministic eligibility gate applied BEFORE
ranking, using only the tenant's own data:

* Candidate side (``classify_candidate``): role and family come from the record's own
  source fields — source category (role words such as "spare parts", "raw material",
  "packing material", "accessories"), product type / entity type, and explicit textual
  relations ("suitable for model X") — with provenance and confidence.
* Request side (``build_request_spec``): the requested family is resolved against the
  tenant's own category vocabulary (``TenantVocabulary``), never a global keyword list;
  the requested role comes from generic commerce role words ("spare", "part",
  "accessory", ...) and defaults to sellable items (finished products, services).
* Quantities (lengths, data sizes, power, weight, volume) are normalised with
  ``app.services.units`` and checked kind-for-kind; lengths are a soft "closest fit"
  preference with an explicit, customer-safe fit note (never a guaranteed fit); other
  capacity specs ("16GB RAM") are minimum constraints — unmet => ineligible, missing =>
  eligible but flagged unverified.

Nothing here names a business, brand, product family or SKU.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from app.services.units import LengthFit, Quantity, parse_quantities, primary_length_mm


class ProductRole(str, Enum):
    FINISHED = "FINISHED_GOOD"
    SERVICE = "SERVICE"
    PART = "SPARE_PART"
    ACCESSORY = "ACCESSORY"
    RAW_MATERIAL = "RAW_MATERIAL"
    PACKAGING = "PACKAGING"
    CONSUMABLE = "CONSUMABLE"
    BUNDLE = "BUNDLE"            # a set / kit / combo / multi-pack of finished items
    UNKNOWN = "UNKNOWN"


SELLABLE_ROLES = frozenset({ProductRole.FINISHED, ProductRole.SERVICE, ProductRole.BUNDLE})
# Multi-item offer cues in a record title ("Set of 2", "Pack of 6", "Combo", "Kit", "3 pcs").
_BUNDLE_RE = re.compile(r"\b(?:set of \d+|pack of \d+|(?:[2-9]|[1-9]\d+)\s*(?:pcs|pieces|pc)|combo|bundle|kit)\b", re.IGNORECASE)

# Generic commerce role vocabulary (language-level, not business-level). Order = priority.
_ROLE_CUES: Tuple[Tuple[ProductRole, Tuple[str, ...]], ...] = (
    (ProductRole.PACKAGING, ("packing material", "packaging material", "packaging", "packing")),
    (ProductRole.RAW_MATERIAL, ("raw material", "raw materials", "rawmaterial")),
    (ProductRole.PART, ("spare part", "spare parts", "spares", "replacement part", "replacement parts",
                        "component", "components")),
    (ProductRole.ACCESSORY, ("accessory", "accessories", "add-on", "add on", "addon")),
    (ProductRole.CONSUMABLE, ("consumable", "consumables", "refill", "refills", "cartridge")),
)
_ENTITY_TYPE_ROLE = {
    "PRODUCT": ProductRole.FINISHED, "PART": ProductRole.PART, "RAW_MATERIAL": ProductRole.RAW_MATERIAL,
    "ACCESSORY": ProductRole.ACCESSORY, "PACKAGE": ProductRole.PACKAGING, "SERVICE": ProductRole.SERVICE,
    "PLAN": ProductRole.SERVICE, "CONSUMABLE": ProductRole.CONSUMABLE,
}
# Words requesting a non-finished role. "part"/"spare" alone are enough.
_REQUEST_ROLE_WORDS: Tuple[Tuple[ProductRole, Tuple[str, ...]], ...] = (
    (ProductRole.PART, ("spare", "spares", "part", "parts", "component", "components", "replacement")),
    (ProductRole.ACCESSORY, ("accessory", "accessories", "add-on", "addon", "attachment")),
    (ProductRole.RAW_MATERIAL, ("raw material", "raw materials")),
    (ProductRole.PACKAGING, ("packing material", "packaging")),
    (ProductRole.CONSUMABLE, ("consumable", "consumables", "refill", "refills", "cartridge")),
)
# "single / individual piece": the customer wants one unit, not a set / kit / multi-pack.
_INDIVIDUAL_RE = re.compile(r"\b(?:single|individual|one piece|1 ?pc|per piece|loose)\b", re.IGNORECASE)
# Category words that describe a sales channel / grouping, not what the thing is.
_GENERIC_FAMILY_WORDS = frozenset({
    "product", "products", "item", "items", "goods", "finished", "finish", "series", "range", "collection",
    "other", "others", "misc", "miscellaneous", "general", "new", "e", "commerce", "ecommerce", "online",
    "catalog", "catalogue", "material", "materials", "inventory", "non", "type", "category", "and", "the",
    "of", "for", "with", "&", "unit", "units",
})
_REL_RE = re.compile(
    r"\b(?:suitable|compatible|fits?|meant|designed|used)\s+(?:for|with)\s+(?:the\s+)?(?:model|models|mod\.?)?\s*(?:no\.?)?\s*"
    r"([A-Z0-9][A-Z0-9\-/]{2,})", re.IGNORECASE)
_MODEL_CODE_RE = re.compile(r"\b(?=[A-Z0-9\-/]*\d)(?=[A-Z0-9\-/]*[A-Z])[A-Z0-9][A-Z0-9\-/]{3,}\b")
_TOKEN_RE = re.compile(r"[a-z0-9]+")
# "30-LITER", "40LTR", "800-ML", "0NLY" (a typo of "only") are quantities / words, not model codes.
_QUANTITY_LIKE_RE = re.compile(r"^[0-9]+(?:[.,][0-9]+)?[\s\-_/]?[A-Z]{1,6}$", re.IGNORECASE)


def singular(tok: str) -> str:
    if not tok.isalpha() or len(tok) <= 3:
        return tok
    if tok.endswith("ies") and len(tok) > 4:
        return tok[:-3] + "y"
    if tok.endswith(("sses", "shes", "ches", "xes", "zes")):
        return tok[:-2]
    if tok.endswith("s") and not tok.endswith(("ss", "us", "is")):
        return tok[:-1]
    return tok


def tokens(text: str) -> Set[str]:
    return {singular(t) for t in _TOKEN_RE.findall((text or "").lower())}


def _role_from_text(text: str) -> Optional[ProductRole]:
    low = f" {(text or '').lower()} "
    for role, cues in _ROLE_CUES:
        if any(f" {c} " in low or low.strip().endswith(c) for c in cues):
            return role
    return None


def family_label(category: Optional[str]) -> str:
    """Source category with role words removed: "Air Curtain Raw Material" -> "Air Curtain"."""
    label = f" {(category or '').strip()} "
    for _, cues in _ROLE_CUES:
        for c in sorted(cues, key=len, reverse=True):
            label = re.sub(rf"(?i)\b{re.escape(c)}\b", " ", label)
    return re.sub(r"\s+", " ", label).strip(" -–&/,")


_ROLE_WORD_TOKENS = frozenset(
    t for _, cues in _ROLE_CUES + _REQUEST_ROLE_WORDS for c in cues for t in tokens(c))


def family_tokens(label: str, brand_tokens: Iterable[str] = ()) -> Set[str]:
    """Identity tokens of a product family. Role words ("spare", "part", "accessory",
    "raw", "packing", ...) say what KIND of item something is, never which family."""
    brands = set(brand_tokens)
    return {t for t in tokens(label)
            if t not in _GENERIC_FAMILY_WORDS and t not in _ROLE_WORD_TOKENS and t not in brands and len(t) > 1}


# ---------------------------------------------------------------------------
# Candidate classification
# ---------------------------------------------------------------------------

@dataclass
class CandidateFacets:
    role: ProductRole
    role_source: str                      # source_category | product_type | entity_type | title_relation | default
    role_confidence: float
    category: Optional[str]               # source (tenant) category, e.g. "Air Curtain"
    family: str                           # role-stripped family label
    related_models: List[str] = field(default_factory=list)   # explicit "suitable for model X" targets
    text: str = ""                        # title + category + type, for token matching


def _custom(canonical: Dict[str, Any]) -> Dict[str, Any]:
    ca = canonical.get("custom_attributes")
    return ca if isinstance(ca, dict) else {}


def classify_candidate(canonical: Optional[Dict[str, Any]], title: Optional[str]) -> CandidateFacets:
    cd = canonical or {}
    ca = _custom(cd)
    category = ca.get("category") or cd.get("sub_category") or cd.get("category") or ca.get("product_category")
    ptype = ca.get("product_type") or cd.get("product_type") or ""
    name = title or cd.get("name") or ""
    related = [m.group(1).upper().rstrip("-/") for m in _REL_RE.finditer(name)]

    role, source, conf = None, "default", 0.5
    cat_role = _role_from_text(str(category or ""))
    if cat_role is not None:
        role, source, conf = cat_role, "source_category", 0.95
    else:
        pt_role = _role_from_text(str(ptype))
        if pt_role is None and ptype:
            low = str(ptype).lower()
            if any(w in low for w in ("finish", "goods", "inventory item", "hardware", "device")):
                pt_role = ProductRole.FINISHED
            elif "service" in low:
                pt_role = ProductRole.SERVICE
        if pt_role is not None:
            role, source, conf = pt_role, "product_type", 0.9
        else:
            et = str(cd.get("entity_type") or "").upper()
            if et in _ENTITY_TYPE_ROLE:
                role, source, conf = _ENTITY_TYPE_ROLE[et], "entity_type", 0.8
    # A record explicitly described as fitting another model is a part/accessory of it,
    # even when its source type says finished goods (common in real catalogues).
    if related and role in (None, ProductRole.FINISHED):
        role, source, conf = ProductRole.PART, "title_relation", 0.75
    # A sellable item offered as a set / kit / combo / multi-pack is a bundle, not a single unit.
    if role in (None, ProductRole.FINISHED) and _BUNDLE_RE.search(name or ""):
        role, source, conf = ProductRole.BUNDLE, "title_bundle", 0.8
    if role is None:
        role = ProductRole.UNKNOWN
    text = " ".join(str(x) for x in (name, category or "", ptype) if x)
    return CandidateFacets(role=role, role_source=source, role_confidence=conf, category=category,
                           family=family_label(category), related_models=related, text=text)


# ---------------------------------------------------------------------------
# Tenant vocabulary (families present in THIS tenant's knowledge)
# ---------------------------------------------------------------------------

@dataclass
class FamilyEntry:
    label: str
    tokens: frozenset
    item_count: int


@dataclass
class TenantVocabulary:
    families: List[FamilyEntry]
    brand_tokens: frozenset
    # Roles that actually occur in this tenant's catalogue (e.g. a services business has no
    # CONSUMABLE / PART items). Empty = unknown, so no role is ruled out.
    roles_present: frozenset = frozenset()
    loaded_at: float = field(default_factory=time.monotonic)


_VOCAB_CACHE: Dict[str, TenantVocabulary] = {}
VOCAB_TTL_SECONDS = 900.0  # invalidated explicitly when an import completes


async def load_tenant_vocabulary(db, tenant_id: str) -> TenantVocabulary:
    """Distinct product families (role-stripped source categories) for one tenant.
    One aggregate query, cached briefly per tenant (never shared across tenants)."""
    hit = _VOCAB_CACHE.get(tenant_id)
    if hit and time.monotonic() - hit.loaded_at < VOCAB_TTL_SECONDS:
        return hit
    from sqlalchemy import text as _t

    rows = (await db.execute(_t("""
        SELECT coalesce(v.canonical_data->'custom_attributes'->>'category',
                        v.canonical_data->>'sub_category') AS cat,
               v.canonical_data->>'brand' AS brand,
               coalesce(v.canonical_data->'custom_attributes'->>'product_type',
                        v.canonical_data->>'product_type') AS ptype,
               v.canonical_data->>'entity_type' AS etype,
               min(i.title) AS sample_title, count(*) AS n
        FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
        WHERE i.tenant_id = :t AND i.is_active
        GROUP BY 1, 2, 3, 4"""), {"t": tenant_id})).all()
    brand_tokens: Set[str] = set()
    for r in rows:
        brand_tokens |= tokens(r.brand or "")
    by_label: Dict[str, int] = {}
    display: Dict[str, str] = {}
    for r in rows:
        lab = family_label(r.cat)
        if lab:
            k = lab.lower()
            by_label[k] = by_label.get(k, 0) + int(r.n)
            display.setdefault(k, lab)
    fams = []
    for k, n in by_label.items():
        lab = display[k]
        ft = family_tokens(lab, brand_tokens)
        if ft:
            fams.append(FamilyEntry(label=lab, tokens=frozenset(ft), item_count=n))
    roles: Set[ProductRole] = set()
    for r in rows:
        cd = {"custom_attributes": {"category": r.cat, "product_type": r.ptype}, "entity_type": r.etype}
        roles.add(classify_candidate(cd, r.sample_title).role)
    vocab = TenantVocabulary(families=fams, brand_tokens=frozenset(brand_tokens), roles_present=frozenset(roles))
    _VOCAB_CACHE[tenant_id] = vocab
    return vocab


def invalidate_tenant_vocabulary(tenant_id: str) -> None:
    _VOCAB_CACHE.pop(tenant_id, None)


# ---------------------------------------------------------------------------
# Request specification
# ---------------------------------------------------------------------------

@dataclass
class MinConstraint:
    kind: str
    hint: str            # attribute word next to the number ("ram", "ssd", "storage")
    value: float
    original: str


@dataclass
class NominalConstraint:
    """A size the customer asked for ("30 liter") or ruled out ("not 40 liter"), same kind."""
    kind: str                     # volume | weight | power
    wanted: List[float]           # acceptable nominal values (base unit)
    excluded: List[float]         # values the customer explicitly ruled out
    original: str


@dataclass
class RequestSpec:
    wanted_roles: Optional[Set[ProductRole]]          # None = no role gate
    families: List[FamilyEntry]                       # resolved from tenant vocabulary (hard)
    family_tokens: Set[str]
    target_models: List[str]                          # "spare part for model X"
    length_mm: Optional[Quantity]                     # soft: closest-fit ranking + note
    min_constraints: List[MinConstraint]              # hard: >= value of same kind
    exact_keys: Set[str]
    request_text: str = ""
    nominal: List[NominalConstraint] = field(default_factory=list)   # hard: same-kind size must match
    # closest EXISTING codes offered for a requested code that does not exist (labelled suggestions)
    suggestion_keys: Set[str] = field(default_factory=set)

    @property
    def active(self) -> bool:
        return bool(self.wanted_roles or self.families or self.target_models or self.length_mm
                    or self.min_constraints or self.nominal)


_SELLABLE_INTENTS = {
    "product_discovery", "product_lookup", "price_query", "product_comparison", "availability_query",
    "catalogue_request", "more_options", "service_lookup", "service_comparison", "recommendation", "order",
}


_UNGATED_INTENTS = frozenset({"support_issue", "troubleshooting"})


def build_request_spec(plan: Any, vocab: Optional[TenantVocabulary]) -> RequestSpec:
    """Resolve what the customer is asking for, using only the plan + tenant vocabulary."""
    parts = [getattr(plan, "query_text", "") or ""]
    for e in getattr(plan, "entities", None) or []:
        parts.append(f"{getattr(e, 'canonical_value', '') or ''} {getattr(e, 'original_text', '') or ''}")
    for r in getattr(plan, "requirements", None) or []:
        if getattr(r, "category", "products_services") == "products_services":
            parts.append(getattr(r, "query_text", "") or "")
    text = " ".join(p for p in parts if p)
    low = f" {text.lower()} "
    req_tokens = tokens(text)

    # exact identifiers the customer typed (SKU / model codes)
    exact = {e.canonical_value.upper().strip() for e in getattr(plan, "entities", None) or []
             if getattr(e, "entity_type", "") in ("sku", "service_code", "product_code", "model_number")
             and getattr(e, "canonical_value", None)}
    codes = {m.group(0).upper() for m in _MODEL_CODE_RE.finditer(text.upper())
             if not _QUANTITY_LIKE_RE.match(m.group(0))}
    exact |= codes

    # requested role
    wanted: Optional[Set[ProductRole]] = None
    for role, words in _REQUEST_ROLE_WORDS:
        if any(re.search(rf"\b{re.escape(w)}\b", low) for w in words):
            wanted = (wanted or set()) | {role}
    target_models = [m.group(1).upper().rstrip("-/") for m in _REL_RE.finditer(text)]
    if wanted and (ProductRole.PART in wanted or ProductRole.ACCESSORY in wanted):
        wanted |= {ProductRole.PART, ProductRole.ACCESSORY}
    if wanted and vocab and vocab.roles_present and not (wanted & vocab.roles_present):
        # A role word ("refill", "spare", "packaging"...) can only restrict results to a role this
        # business actually has. "AC gas refill" at a services company names a SERVICE; treating
        # it as a CONSUMABLE request rejected every record (false NO_MATCH).
        wanted = None
    if wanted is None:
        intent = str(getattr(getattr(plan, "intent", None), "value", getattr(plan, "intent", "")) or "").lower()
        # Catalogue retrieval defaults to sellable items. An unknown / other intent must not
        # switch the gate off (that silently let parts and accessories back in); only an
        # explicit support / troubleshooting request is left ungated.
        if intent not in _UNGATED_INTENTS:
            wanted = set(SELLABLE_ROLES)
            if _INDIVIDUAL_RE.search(text):
                wanted.discard(ProductRole.BUNDLE)
    if wanted and wanted & {ProductRole.PART, ProductRole.ACCESSORY} and codes and not target_models:
        # "spare part for model X": X identifies the parent product, not the item wanted.
        target_models = sorted(codes)
    if target_models:
        if wanted:
            # "X for model Y" — Y's parts/accessories are what is being asked for
            wanted |= {ProductRole.PART, ProductRole.ACCESSORY}
        exact -= set(target_models)

    # requested family (tenant vocabulary, token containment, most specific wins)
    families: List[FamilyEntry] = []
    if vocab:
        req_compounds = req_tokens | _adjacent_compounds(text)
        matched = [f for f in vocab.families
                   if f.tokens and (f.tokens <= req_tokens or _family_compound(f.label) in req_compounds)]
        # drop a family whose tokens are a strict subset of another matched family
        families = [f for f in matched if not any(f.tokens < g.tokens for g in matched)]
    fam_tokens: Set[str] = set().union(*(f.tokens for f in families)) if families else set()

    qs = parse_quantities(text)
    nominal = _nominal_constraints(text, qs)
    length = next((q for q in qs if q.kind == "length"), None)
    mins = [MinConstraint(kind=q.kind, hint=q.context, value=q.value, original=q.original)
            for q in qs if q.kind in ("data_size",) and q.context]
    return RequestSpec(wanted_roles=wanted, families=families, family_tokens=fam_tokens,
                       target_models=target_models, length_mm=length, min_constraints=mins,
                       exact_keys=exact, request_text=text, nominal=nominal)


# ---------------------------------------------------------------------------
# Eligibility evaluation
# ---------------------------------------------------------------------------

@dataclass
class Eligibility:
    eligible: bool
    facets: CandidateFacets
    family_match: bool = False
    exact_match: bool = False
    satisfied: List[str] = field(default_factory=list)
    unmet: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)       # customer-safe caveats (fit, unverified spec)
    fit_bonus: float = 0.0


def _attr_text(canonical: Dict[str, Any]) -> str:
    ca = _custom(canonical)
    kv = [f"{k} {v}" for k, v in {**canonical, **ca}.items()
          if isinstance(v, (str, int, float)) and k not in ("custom_attributes", "pricing")]
    return " ".join(kv)


def evaluate(canonical: Optional[Dict[str, Any]], title: Optional[str], external_key: Optional[str],
             spec: RequestSpec) -> Eligibility:
    cd = canonical or {}
    facets = classify_candidate(cd, title)
    el = Eligibility(eligible=True, facets=facets)
    key = (external_key or cd.get("sku") or "").upper().strip()
    if key and key in spec.exact_keys:
        el.exact_match = True
        el.satisfied.append(f"exact_identifier_{key}")
        return el   # an explicitly requested identifier is always eligible

    # role gate
    if spec.wanted_roles and facets.role != ProductRole.UNKNOWN and facets.role not in spec.wanted_roles:
        el.eligible = False
        el.unmet.append(f"role_{facets.role.value.lower()}_not_requested")
    elif spec.wanted_roles and facets.role in spec.wanted_roles:
        el.satisfied.append(f"role_{facets.role.value.lower()}")

    # family gate (only when the family was resolved from the tenant's own vocabulary)
    if spec.families:
        cand_tokens = tokens(facets.family) | tokens(title or "")
        el.family_match = any(f.tokens <= cand_tokens for f in spec.families)
        if el.family_match:
            el.satisfied.append("family_" + "_".join(sorted(spec.family_tokens))[:60])
        else:
            el.eligible = False
            el.unmet.append(f"family_mismatch_{(facets.family or 'unknown').lower().replace(' ', '_')[:40]}")

    # compatibility with a requested model ("spare part for model X")
    if spec.target_models:
        rel = {m for m in facets.related_models}
        hay = (title or "").upper()
        if any(t in rel or t in hay for t in spec.target_models):
            el.satisfied.append("compatible_with_" + "_".join(spec.target_models)[:40])
        elif facets.role in (ProductRole.PART, ProductRole.ACCESSORY):
            el.eligible = False
            el.unmet.append("no_compatibility_evidence_for_" + "_".join(spec.target_models)[:40])

    # minimum capacity specs ("16GB RAM"): unmet -> ineligible, absent -> unverified
    if spec.min_constraints:
        hay = f"{title or ''} {_attr_text(cd)}"
        found = [q for q in parse_quantities(hay)]
        for c in spec.min_constraints:
            same = [q for q in found if q.kind == c.kind and (q.context == c.hint or c.hint in hay.lower()
                                                                  and q.context in ("", c.hint))]
            same = [q for q in same if q.context == c.hint] or same
            if not same:
                el.notes.append(f"{c.original} {c.hint} not stated in the catalogue record; unverified")
                el.unmet.append(f"unverified_{c.hint}_{c.original.replace(' ', '')}")
                continue
            best = max(q.value for q in same)
            if best + 1e-9 < c.value:
                el.eligible = False
                el.unmet.append(f"{c.hint}_{best:g}_below_{c.value:g}")
            else:
                el.satisfied.append(f"{c.hint}_{best:g}_meets_{c.value:g}")

    # nominal sizes ("30 liter", not "40 liter"): a record stating a different size of the same kind
    # is not what was asked for; a record that states no size stays, flagged unverified.
    if spec.nominal and el.eligible:
        hay = f"{title or ''} {_attr_text(cd)}"
        found = parse_quantities(hay)
        for nc in spec.nominal:
            vals = [q.value for q in found if q.kind == nc.kind]
            if not vals:
                el.notes.append(f"{nc.original} not stated in the catalogue record; unverified")
                continue
            if any(_close(v, x) for v in vals for x in nc.excluded):
                el.eligible = False
                el.unmet.append(f"{nc.kind}_excluded_by_customer")
            elif nc.wanted and not any(_close(v, w) for v in vals for w in nc.wanted):
                el.eligible = False
                el.unmet.append(f"{nc.kind}_{vals[0]:g}_not_requested")
            else:
                el.satisfied.append(f"{nc.kind}_matches_{nc.original.replace(' ', '')}")

    # length: soft preference with an explicit fit note — never a hard filter
    if spec.length_mm is not None and el.eligible:
        pl = primary_length_mm(title or "") or primary_length_mm(_attr_text(cd))
        if pl:
            fit = LengthFit(requested_mm=spec.length_mm.value, item_mm=pl[0], item_original=pl[1], unit_assumed=pl[2])
            el.fit_bonus = max(0.0, 1.0 - fit.rel_diff / 0.25)
            el.notes.append(fit.note)
            el.satisfied.append(f"size_nominal_{pl[0]:g}mm_vs_requested_{spec.length_mm.value:g}mm")
        else:
            el.notes.append(f"size for the requested {spec.length_mm.original} is not stated; confirm before ordering")
    return el


# ---------------------------------------------------------------------------
# Helpers: compound family names and nominal size constraints
# ---------------------------------------------------------------------------

_NOMINAL_KINDS = ("volume", "weight", "power")
# Negation around a quantity, within its own clause. English negates before the quantity
# ("do not send any 40 liter"); Hindi / Hinglish after it ("40 liter nahi", "40 liter wala mat bhejo").
_CLAUSE_BREAK = re.compile(r"[,.;!?]|\b(?:and|but|aur|lekin|par)\b", re.IGNORECASE)
_NEGATION_BEFORE = re.compile(
    r"\b(?:no|not|don'?t|do not|never|except|excluding|exclude|without|other than|instead of)\b",
    re.IGNORECASE,
)
_NEGATION_AFTER = re.compile(r"^\W*(?:\w+\W+)?(?:nahi|nahin|nahi chahiye|mat|not)\b", re.IGNORECASE)


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(1e-9, 0.02 * max(abs(a), abs(b)))


def _family_compound(label: str) -> str:
    """'Mini Bar' -> 'minibar' (singular), so 'minibars' in a request names the family."""
    return singular("".join(_TOKEN_RE.findall((label or "").lower())))


def _adjacent_compounds(text: str) -> Set[str]:
    """Adjacent request words joined ('mini bar' -> 'minibar'), for one-word family names."""
    words = _TOKEN_RE.findall((text or "").lower())
    return {singular(a + b) for a, b in zip(words, words[1:]) if a.isalpha() and b.isalpha()}


def _nominal_constraints(text: str, qs: List[Quantity]) -> List[NominalConstraint]:
    """Requested / ruled-out sizes per kind ('30 liter only, not 40 liter')."""
    by_kind: Dict[str, NominalConstraint] = {}
    low = text or ""
    for q in qs:
        if q.kind not in _NOMINAL_KINDS:
            continue
        idx = low.lower().find(q.original.lower())
        before = low[max(0, idx - 60):idx] if idx >= 0 else ""
        breaks = list(_CLAUSE_BREAK.finditer(before))
        if breaks:
            before = before[breaks[-1].end():]
        after = low[idx + len(q.original):idx + len(q.original) + 30] if idx >= 0 else ""
        negated = bool(_NEGATION_BEFORE.search(before) or _NEGATION_AFTER.search(after))
        c = by_kind.setdefault(q.kind, NominalConstraint(kind=q.kind, wanted=[], excluded=[], original=q.original))
        target = c.excluded if negated else c.wanted
        if not any(_close(q.value, v) for v in target):
            target.append(q.value)
    # a value both wanted and excluded (repeated in different clauses) counts as excluded
    for c in by_kind.values():
        c.wanted = [w for w in c.wanted if not any(_close(w, x) for x in c.excluded)]
        if c.wanted:
            c.original = " / ".join(f"{w:g}" for w in c.wanted)
    return [c for c in by_kind.values() if c.wanted or c.excluded]
