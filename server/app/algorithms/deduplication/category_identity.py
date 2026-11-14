"""Category-Aware Deterministic Identity Resolver for ProxiPilot Deduplication.

Computes stable, normalized identity keys tailored to the semantic structure of
each of the 9 canonical Knowledge categories.

Identity Rules:
- products_services: tenant + category + normalized SKU (if present) + normalized name
- contacts: tenant + category + normalized email (if present) OR phone OR name + contact_type
- policies: tenant + category + normalized policy_name + region (if present)
- support_faqs: tenant + category + normalized question
- offers_promotions: tenant + category + normalized promo_code (if present) OR offer_name
- locations: tenant + category + normalized name + postal_code (if present) OR address_line_1
- company_info: tenant + category + normalized company_name
- operations: tenant + category + normalized operation_name
- brand_communication: tenant + category + normalized title

Complexity:
- Time: O(K) where K is the length of the identity fields (sub-microsecond)
- Space: O(K) for normalized key representation
"""

import re
from typing import Any, Dict, Optional


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
            row_number: Optional row number fallback if identity fields are completely absent.

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
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "contacts":
            email = _normalize_identity_token(canonical_data.get("email"))
            phone = _normalize_identity_token(canonical_data.get("phone"))
            name = _normalize_identity_token(canonical_data.get("name"))
            ctype = _normalize_identity_token(canonical_data.get("contact_type"))
            if email:
                key_body = f"email:{email}"
            elif phone:
                key_body = f"phone:{phone}"
            elif name and ctype:
                key_body = f"name:{name}|type:{ctype}"
            elif name:
                key_body = f"name:{name}"
            else:
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "policies":
            p_name = _normalize_identity_token(canonical_data.get("policy_name"))
            region = _normalize_identity_token(canonical_data.get("region"))
            if p_name and region:
                key_body = f"policy:{p_name}|region:{region}"
            elif p_name:
                key_body = f"policy:{p_name}"
            else:
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "support_faqs":
            q = _normalize_identity_token(canonical_data.get("question"))
            if q:
                key_body = f"q:{q}"
            else:
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "offers_promotions":
            promo = _normalize_identity_token(canonical_data.get("promo_code"))
            offer = _normalize_identity_token(canonical_data.get("offer_name"))
            if promo:
                key_body = f"promo:{promo}"
            elif offer:
                key_body = f"offer:{offer}"
            else:
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "locations":
            name = _normalize_identity_token(canonical_data.get("name"))
            postal = _normalize_identity_token(canonical_data.get("postal_code"))
            addr = _normalize_identity_token(canonical_data.get("address_line_1"))
            if name and postal:
                key_body = f"loc:{name}|postal:{postal}"
            elif name and addr:
                key_body = f"loc:{name}|addr:{addr}"
            elif name:
                key_body = f"loc:{name}"
            else:
                key_body = f"row:{row_number or 'unnamed'}"

        elif cat == "company_info":
            c_name = _normalize_identity_token(canonical_data.get("company_name"))
            key_body = f"co:{c_name}" if c_name else f"row:{row_number or 'unnamed'}"

        elif cat == "operations":
            op_name = _normalize_identity_token(canonical_data.get("operation_name"))
            key_body = f"op:{op_name}" if op_name else f"row:{row_number or 'unnamed'}"

        elif cat == "brand_communication":
            title = _normalize_identity_token(canonical_data.get("title"))
            key_body = f"brand:{title}" if title else f"row:{row_number or 'unnamed'}"

        else:
            # Fallback for generic or custom category
            first_val = ""
            for v in canonical_data.values():
                if v:
                    first_val = _normalize_identity_token(v)
                    break
            key_body = f"generic:{first_val}" if first_val else f"row:{row_number or 'unnamed'}"

        return f"org:{org}:cat:{cat}:{key_body}"
