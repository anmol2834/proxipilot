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
    UNKNOWN = "UNKNOWN"


SELLABLE_ROLES = frozenset({ProductRole.FINISHED, ProductRole.SERVICE})

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
               v.canonical_data->>'brand' AS brand, count(*) AS n
        FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
        WHERE i.tenant_id = :t AND i.is_active
        GROUP BY 1, 2"""), {"t": tenant_id})).all()
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
    vocab = TenantVocabulary(families=fams, brand_tokens=frozenset(brand_tokens))
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
class RequestSpec:
    wanted_roles: Optional[Set[ProductRole]]          # None = no role gate
    families: List[FamilyEntry]                       # resolved from tenant vocabulary (hard)
    family_tokens: Set[str]
    target_models: List[str]                          # "spare part for model X"
    length_mm: Optional[Quantity]                     # soft: closest-fit ranking + note
    min_constraints: List[MinConstraint]              # hard: >= value of same kind
    exact_keys: Set[str]
    request_text: str = ""

    @property
    def active(self) -> bool:
        return bool(self.wanted_roles or self.families or self.target_models or self.length_mm or self.min_constraints)


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
    codes = {m.group(0).upper() for m in _MODEL_CODE_RE.finditer(text.upper())}
    exact |= codes

    # requested role
    wanted: Optional[Set[ProductRole]] = None
    for role, words in _REQUEST_ROLE_WORDS:
        if any(re.search(rf"\b{re.escape(w)}\b", low) for w in words):
            wanted = (wanted or set()) | {role}
    target_models = [m.group(1).upper().rstrip("-/") for m in _REL_RE.finditer(text)]
    if wanted and (ProductRole.PART in wanted or ProductRole.ACCESSORY in wanted):
        wanted |= {ProductRole.PART, ProductRole.ACCESSORY}
    if wanted is None:
        intent = str(getattr(getattr(plan, "intent", None), "value", getattr(plan, "intent", "")) or "").lower()
        # Catalogue retrieval defaults to sellable items. An unknown / other intent must not
        # switch the gate off (that silently let parts and accessories back in); only an
        # explicit support / troubleshooting request is left ungated.
        if intent not in _UNGATED_INTENTS:
            wanted = set(SELLABLE_ROLES)
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
        matched = [f for f in vocab.families if f.tokens and f.tokens <= req_tokens]
        # drop a family whose tokens are a strict subset of another matched family
        families = [f for f in matched if not any(f.tokens < g.tokens for g in matched)]
    fam_tokens: Set[str] = set().union(*(f.tokens for f in families)) if families else set()

    qs = parse_quantities(text)
    length = next((q for q in qs if q.kind == "length"), None)
    mins = [MinConstraint(kind=q.kind, hint=q.context, value=q.value, original=q.original)
            for q in qs if q.kind in ("data_size",) and q.context]
    return RequestSpec(wanted_roles=wanted, families=families, family_tokens=fam_tokens,
                       target_models=target_models, length_mm=length, min_constraints=mins,
                       exact_keys=exact, request_text=text)


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
