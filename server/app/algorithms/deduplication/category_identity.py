"""Category-Aware Deterministic Identity Resolver for ProxiPilot Deduplication.

Computes stable, normalized identity keys tailored to the semantic structure of
each of the 6 canonical Knowledge categories.

Identity Rules:
- products_services: tenant + category + normalized SKU (if present) + normalized name
- policies: tenant + category + normalized policy_name + region (if present)
- support_faqs: tenant + category + normalized question
- offers_promotions: tenant + category + normalized promo_code (if present) OR offer_name
- company_info: tenant + category + normalized company_name
- processes_timelines: tenant + category + normalized process_name (+ applies_to, region)
- No identifying field at all: a CONTENT FINGERPRINT of the row's values (never its position), so
  reordering rows between uploads can never update the wrong item, and an identical row repeated
  in a file is merged. Serial-number style columns (S.No, Sr, #, index) are row positions in
  disguise and are excluded from the fingerprint.

Complexity:
- Time: O(K) where K is the length of the identity fields (sub-microsecond)
- Space: O(K) for normalized key representation
"""

import hashlib
import json
import re
from typing import Any, Dict, Optional

FINGERPRINT_PREFIX = "fp:"
EMPTY_FINGERPRINT = "fp:empty"

# Column keys that only carry a row's POSITION in the sheet (S.No, Sr No, Sl No, Serial, #, Row,
# Index, a spreadsheet's unnamed index column). Deliberately conservative: "Item No", "Number",
# "Position", "Line" can be real codes or data and are NOT treated as positional.
_POSITIONAL_KEY = re.compile(
    r"^(s_?n(o|um)?|sr_?(no|num)?|sl_?(no|num)?|serial(_?(no|num|number))?|row(_?(no|num|number))?|"
    r"index|idx|unnamed(_?\d+)?)$"
)


def is_positional_key(key: str) -> bool:
    """True for a column / attribute that is a row number in disguise (or has no name, e.g. "#")."""
    k = re.sub(r"[^a-z0-9]+", "_", str(key).lower()).strip("_")
    return not k or bool(_POSITIONAL_KEY.match(k))


_is_positional_key = is_positional_key  # backwards-compatible private alias


def content_fingerprint(canonical_data: Dict[str, Any], custom_attributes: Optional[Dict[str, Any]] = None) -> str:
    """Position-independent identity for a record that has no name, code or other key field.

    A stable hash of every non-empty value (keys and values normalised, order-independent),
    excluding positional columns. Same content -> same key wherever the row sits in the sheet.
    """
    parts: Dict[str, str] = {}
    for prefix, source in (("c", canonical_data or {}), ("x", custom_attributes or {})):
        if not isinstance(source, dict):
            continue
        for key, val in source.items():
            if _is_positional_key(key) or val is None:
                continue
            if isinstance(val, (dict, list)):
                norm = json.dumps(val, sort_keys=True, default=str, ensure_ascii=False)
            else:
                norm = _normalize_identity_token(val)
            if norm:
                parts[f"{prefix}.{str(key).lower()}"] = norm
    if not parts:
        return EMPTY_FINGERPRINT
    raw = json.dumps(parts, sort_keys=True, ensure_ascii=False)
    return FINGERPRINT_PREFIX + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def is_content_fingerprint(identity_key: Optional[str]) -> bool:
    """True when an identity key (full 'org:..:cat:<cat>:<body>' or stripped '<body>') is a content
    fingerprint rather than a business key (SKU, name, policy, question ...)."""
    if not identity_key:
        return False
    body = identity_key
    if ":cat:" in body:
        body = body.split(":cat:", 1)[1].split(":", 1)[-1]   # drop the category segment
    return body.startswith(FINGERPRINT_PREFIX)


def _normalize_identity_token(val: Any) -> str:
    """Normalize string token for identity comparison: lowercase, trim, collapse whitespace."""
    if val is None:
        return ""
    s = str(val).strip().lower()
    # Collapse multiple whitespace characters to a single space
    return re.sub(r"\s+", " ", s)


_VARIANT_KEY_PARTS = (
    "size", "colour", "color", "model", "variant", "finish", "material", "dimension", "capacity",
    "weight", "length", "width", "height", "depth", "diameter", "pack", "brand", "grade", "thickness",
    "volume", "wattage", "voltage", "edition", "style", "pattern", "shade",
)
_VARIANT_EXCLUDE_PARTS = ("price", "cost", "mrp", "stock", "qty", "quantity", "desc", "note", "image", "url", "discount")


def _variant_signature(canonical_data: Dict[str, Any], custom_attributes: Optional[Dict[str, Any]]) -> str:
    """Stable signature of the attributes that distinguish product variants sharing one name."""
    parts = {}
    for source in (canonical_data or {}, custom_attributes or {}):
        if not isinstance(source, dict):
            continue
        for key, val in source.items():
            k = re.sub(r"[^a-z0-9]+", "_", str(key).lower()).strip("_")
            if not k or any(x in k for x in _VARIANT_EXCLUDE_PARTS):
                continue
            if not any(x in k for x in _VARIANT_KEY_PARTS):
                continue
            if isinstance(val, (dict, list)) or val is None:
                continue
            v = _normalize_identity_token(val)
            if v and k not in parts:
                parts[k] = v
    sig = "|".join(f"{k}={parts[k]}" for k in sorted(parts))
    if len(sig) > 160:  # identity keys are stored in a String(512) column: keep them bounded
        import hashlib
        sig = "h:" + hashlib.sha1(sig.encode("utf-8")).hexdigest()
    return sig


class CategoryIdentityResolver:
    """Deterministic, category-specific identity key resolution engine."""

    @staticmethod
    def resolve_identity_key(
        tenant_id: str,
        category: str,
        canonical_data: Dict[str, Any],
        custom_attributes: Optional[Dict[str, Any]] = None,
        row_number: Optional[int] = None,
    ) -> str:
        """Construct a deterministic identity key for deduplication.

        Args:
            tenant_id: Organization identifier.
            category: Canonical KnowledgeCategory string.
            canonical_data: Dictionary of extracted/normalized canonical field values.
            custom_attributes: Optional tenant/custom attributes dictionary.
            row_number: Kept for signature compatibility; identity never depends on position.

        Returns:
            Normalized colon-separated deterministic identity string.
        """
        cat = category.strip().lower().replace("-", "_")
        org = tenant_id.strip()

        # Step 1: Check explicit external business identity fields first (Enterprise Stable Identity)
        # Guarantees that source identifiers (e.g. HA-001, service_code, record_id) are strictly preserved
        explicit_id = None
        for id_field in (
            "external_identity_key",
            "record_id",
            "service_code",
            "sku",
            "code",
            "id",
        ):
            cand = canonical_data.get(id_field)
            if not cand and custom_attributes:
                cand = custom_attributes.get(id_field)
            if cand is not None and str(cand).strip():
                explicit_id = str(cand).strip()
                break

        if explicit_id:
            # Preserve the exact stable business identifier supplied by the source dataset
            return f"org:{org}:cat:{cat}:ext:{explicit_id}"

        if cat == "products_services":
            name = _normalize_identity_token(canonical_data.get("name"))
            sku = _normalize_identity_token(canonical_data.get("sku"))
            if sku and name:
                key_body = f"sku:{sku}|name:{name}"
            elif sku:
                key_body = f"sku:{sku}"
            elif name:
                # Without a SKU the name alone is NOT unique in real catalogues (same product in
                # several sizes / colours / models). Include the variant attributes so variants are
                # kept as separate items instead of being dropped as "conflicting duplicates".
                # Price / stock / description are deliberately excluded: a changed price on
                # re-upload must UPDATE the item, not create a second one.
                variant = _variant_signature(canonical_data, custom_attributes)
                key_body = f"name:{name}|var:{variant}" if variant else f"name:{name}"
            else:
                key_body = content_fingerprint(canonical_data, custom_attributes)

        elif cat == "policies":
            p_name = _normalize_identity_token(canonical_data.get("policy_name"))
            region = _normalize_identity_token(canonical_data.get("region"))
            if p_name and region:
                key_body = f"policy:{p_name}|region:{region}"
            elif p_name:
                key_body = f"policy:{p_name}"
            else:
                key_body = content_fingerprint(canonical_data, custom_attributes)

        elif cat == "support_faqs":
            q = _normalize_identity_token(canonical_data.get("question"))
            if q:
                key_body = f"q:{q}"
            else:
                key_body = content_fingerprint(canonical_data, custom_attributes)

        elif cat == "offers_promotions":
            promo = _normalize_identity_token(canonical_data.get("promo_code"))
            offer = _normalize_identity_token(canonical_data.get("offer_name"))
            if promo:
                key_body = f"promo:{promo}"
            elif offer:
                key_body = f"offer:{offer}"
            else:
                key_body = content_fingerprint(canonical_data, custom_attributes)

        elif cat == "company_info":
            c_name = _normalize_identity_token(canonical_data.get("company_name"))
            key_body = f"co:{c_name}" if c_name else content_fingerprint(canonical_data, custom_attributes)

        elif cat == "processes_timelines":
            # The same process can have different timelines per product group, order size or
            # region ("PO confirmation - bulk orders" vs "- standard"): those stay separate items.
            p_name = _normalize_identity_token(canonical_data.get("process_name"))
            applies = _normalize_identity_token(canonical_data.get("applies_to"))
            region = _normalize_identity_token(canonical_data.get("region"))
            if p_name:
                key_body = f"proc:{p_name}"
                if applies:
                    key_body += f"|for:{applies}"
                if region:
                    key_body += f"|region:{region}"
            else:
                key_body = content_fingerprint(canonical_data, custom_attributes)

        else:
            # Generic / custom category with no explicit id: identify by the whole content. (Keying by
            # the first value alone merged different records that happened to share it.)
            key_body = content_fingerprint(canonical_data, custom_attributes)

        return f"org:{org}:cat:{cat}:{key_body}"
