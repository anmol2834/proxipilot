"""Phase 8.6: AI-Ready Semantic Projection Engine.

Converts validated, persisted canonical knowledge (KnowledgeItem,
KnowledgeVersion, KnowledgeAttribute) into deterministic, category-aware
semantic documents and logical chunks for Phase 10 vector embedding.

Invariants:
- Deterministic projection: identical records produce byte-identical semantic documents.
- Multi-tenant isolation: documents and chunks carry tenant_id and strict metadata.
- No hallucinations: projection strictly renders verified persisted canonical facts.
- No embedding or LLM dependencies: pure deterministic transformation.
- High performance: zero DB roundtrips during document formatting.
"""

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.contracts.events import DomainEventEnvelope, EventNames
from app.contracts.knowledge import normalize_category_key
from app.contracts.semantic_projection import (
    ProjectionBatchSummaryDTO,
    SemanticChunkDTO,
    SemanticDocumentDTO,
    SemanticMetadataDTO,
)
from app.core.config import get_settings
from app.models.knowledge import (
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeSemanticChunk,
    KnowledgeVersion,
)
from app.services.semantic_chunker import SemanticChunker

logger = logging.getLogger("proxipilot.knowledge.projection")


def _format_value(val: Any) -> Optional[str]:
    """Format an attribute value cleanly without stringifying None or 'null', eliminating float noise."""
    if val is None:
        return None
    if isinstance(val, bool):
        return "Yes" if val else "No"
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, (float, Decimal)):
        try:
            d = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if d == d.to_integral():
                return f"{int(d)}"
            return f"{d:.2f}"
        except Exception:
            return str(val)
    if isinstance(val, list):
        items = [str(x).strip() for x in val if x is not None and str(x).strip()]
        if not items:
            return None
        if len(items) == 1:
            return items[0]
        return "\n".join(f"- {x}" for x in items)
    if isinstance(val, dict):
        # Format key-value pairs
        parts = [f"{k}: {v}" for k, v in val.items() if v is not None and str(v).strip()]
        return "\n".join(parts) if parts else None

    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "undefined", "n/a"):
        return None

    # Check for floating-point precision artifacts (e.g., 1511.1079999999997 or 1118.6399999999999)
    if re.match(r"^-?\d+\.\d{3,}$", s):
        try:
            d = Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if d == d.to_integral():
                return f"{int(d)}"
            return f"{d:.2f}"
        except Exception:
            pass

    return s


_CURRENCY_SYMBOLS: Dict[str, str] = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "AUD": "A$",
    "CAD": "C$",
    "SGD": "S$",
    "AED": "AED",
}

def _format_currency_amount(amount: Any, currency: Optional[str] = None) -> Optional[str]:
    """Format numeric amounts cleanly with exact 2-decimal precision, currency symbol, and ISO code."""
    if amount is None:
        return None
    amt_str = str(amount).strip()
    if not amt_str or amt_str.lower() in ("none", "null", "n/a", "undefined"):
        return None
    curr_clean = (currency or "").strip().upper() or "INR"
    sym = _CURRENCY_SYMBOLS.get(curr_clean, "₹" if curr_clean == "INR" else "")

    clean_digits = re.sub(r"[^\d.\-]", "", amt_str)
    if not clean_digits:
        return None
    try:
        d = Decimal(clean_digits).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        formatted_num = f"{d:,.2f}"
    except (InvalidOperation, ValueError):
        formatted_num = amt_str

    if sym and curr_clean:
        return f"{sym}{formatted_num} ({curr_clean})"
    elif curr_clean:
        return f"{curr_clean} {formatted_num}"
    elif sym:
        return f"{sym}{formatted_num}"
    return formatted_num


_INTERNAL_KEYS_TO_IGNORE: Set[str] = {
    "custom_attributes",
    "custom_attributes_json",
    "version",
    "external_identity_key",
    "record_id",
    "id",
    "source_id",
    "tenant_id",
    "organization_id",
    "knowledge_item_id",
    "knowledge_version_id",
    "created_at",
    "updated_at",
    "deleted_at",
    "pricing",
    "status",
    "is_active",
    "priority",
    "authority",
    "authority_level",
    "source_type",
    "projection_version",
    "change_summary",
    "published_at",
    "last_projected_at",
    "job_id",
    "import_job_id",
    "schema_fingerprint",
    "chunk_count",
    "semantic_version",
    "effective_from",
    "effective_until",
    "valid_from",
    "valid_until",
}


# =============================================================================
# Category-Specific Section Projectors
# =============================================================================


class _BaseCategoryProjector:
    """Base projector providing common formatting helpers."""

    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        raise NotImplementedError


class _ProductsServicesProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        if consumed_keys is None:
            consumed_keys = set()

        def get_val(*keys: str) -> Tuple[Optional[str], Optional[str]]:
            """Get first non-empty value from attrs or custom_attrs, and record consumed key."""
            for k in keys:
                v = attrs.get(k) if k in attrs else custom_attrs.get(k)
                fmt = _format_value(v)
                if fmt:
                    consumed_keys.add(k)
                    return fmt, k
            return None, None

        sections: List[Tuple[str, str]] = []

        # 1. Overview
        # Ordered by what customers ask about (name, category, type, brand, code): the
        # embedding and the drafter see the discriminating facts first, without boilerplate.
        overview_lines = [f"Product/Service: {item.title}"]
        prod_cat, _ = get_val("product_category", "category", "item_category", "product_group", "group")
        if prod_cat:
            overview_lines.append(f"Product Category: {prod_cat}")
        prod_type, _ = get_val("product_type", "item_type")
        if prod_type:
            overview_lines.append(f"Product Type: {prod_type}")
        code, _ = get_val("service_code", "sku", "model_number", "code", "item_code")
        if code:
            overview_lines.append(f"Catalog Code / SKU: {code}")
        cat_type, _ = get_val("category_type", "entity_type", "type")
        if cat_type:
            overview_lines.append(f"Commercial Type: {cat_type}")
        brand, _ = get_val("brand", "brand_scope", "manufacturer")
        if brand:
            overview_lines.append(f"Brand: {brand}")
        biz_cat, _ = get_val("service_category", "business_category")
        subcat, _ = get_val("service_subcategory", "sub_category", "subcategory")
        if biz_cat:
            overview_lines.append(f"Business Domain: {biz_cat}")
        if subcat:
            overview_lines.append(f"Subcategory: {subcat}")
        status_val = _format_value(version.status or attrs.get("status") or custom_attrs.get("status"))
        if status_val:
            consumed_keys.add("status")
            if status_val.lower() not in ("active", "published"):  # only unusual states are informative
                overview_lines.append(f"Status: {status_val.title()}")
        priority_val = _format_value(attrs.get("priority") or custom_attrs.get("priority"))
        if priority_val:
            overview_lines.append(f"Priority: {priority_val.title()}")
            consumed_keys.add("priority")
        if version.effective_from:
            overview_lines.append(f"Effective From: {version.effective_from.date().isoformat()}")
        if version.effective_until:
            overview_lines.append(f"Effective Until: {version.effective_until.date().isoformat()}")
        sections.append(("overview", "\n".join(overview_lines)))

        # 2. Description & Scope of Work
        desc, _ = get_val("description")
        desc_val = desc or _format_value(item.description)
        if desc_val:
            sections.append(("description", f"Description & Scope of Work:\n{desc_val}"))

        # 3. Issue Scope & Appliance Applicability
        appl_lines = []
        appliance, _ = get_val("appliance_type", "device_type", "appliance")
        if appliance:
            appl_lines.append(f"Appliance / Equipment: {appliance}")
        models, _ = get_val("model_applicability", "compatibility", "compatible_devices")
        if models:
            appl_lines.append(f"Model Applicability: {models}")
        issues, _ = get_val("issue_scope", "problem_type", "symptom", "scope_of_work")
        if issues:
            appl_lines.append(f"Issue / Problem Scope: {issues}")
        if appl_lines:
            sections.append(("applicability_scope", "\n".join(appl_lines)))

        # 4. Pricing & Financials (Comprehensive multi-dimensional enterprise pricing)
        pricing_data = attrs.get("pricing") if isinstance(attrs.get("pricing"), dict) else (custom_attrs.get("pricing") if isinstance(custom_attrs.get("pricing"), dict) else None)
        if pricing_data:
            consumed_keys.add("pricing")

        currency_val, _ = get_val("currency")
        if not currency_val and pricing_data:
            currency_val = pricing_data.get("currency")
        curr_str = currency_val or "INR"

        pricing_lines = []
        base_price, _ = get_val("base_price", "price", "unit_price", "list_price", "standard_rate", "rate", "cost", "mrp")
        if not base_price and pricing_data:
            base_price = pricing_data.get("base_price")
        def _is_zero(v: Any) -> bool:
            try:
                return float(str(v).replace(",", "").strip()) == 0.0
            except (TypeError, ValueError):
                return False

        if base_price and _is_zero(base_price):
            # 0 in a price sheet means "not listed", never "free".
            pricing_lines.append("- Price: not listed (price on request)")
            base_price = None
        elif base_price:
            pricing_lines.append(f"- Base Price: {_format_currency_amount(base_price, curr_str)}")

        # Multi-tier price lists. Tiers equal to the base price are folded into one line
        # (identical repeated lines only add noise to the embedding and the prompt);
        # tiers that differ are kept as separate, explicit facts.
        def _num(v: Any) -> Optional[float]:
            try:
                return round(float(str(v).replace(",", "").strip()), 2)
            except (TypeError, ValueError):
                return None

        tiers = []
        for label, keys in (("MRP", ("mrp",)), ("Retail Price", ("retail_price", "retail")),
                            ("Wholesale Price", ("wholesale_price", "wholesale")),
                            ("Distributor Price", ("distributor_price", "distributor")),
                            ("Export Price", ("export_price", "export")), ("ARC Price", ("arc_price", "arc"))):
            val, _ = get_val(*keys)
            if val and not _is_zero(val):
                tiers.append((label, val))
        base_num = _num(base_price) if base_price else None
        same = [label for label, val in tiers if base_num is not None and _num(val) == base_num]
        if same and pricing_lines:
            pricing_lines[-1] += " (same for " + ", ".join(lbl.replace(" Price", "") for lbl in same) + ")"
        for label, val in tiers:
            if label not in same:
                pricing_lines.append(f"- {label}: {_format_currency_amount(val, curr_str)}")

        visit_charge, _ = get_val("visit_charge", "inspection_fee", "diagnostic_fee", "callout_fee", "consultation_fee")
        if not visit_charge and pricing_data:
            visit_charge = pricing_data.get("visit_charge")
        if visit_charge:
            pricing_lines.append(f"- Visit / Diagnostic Charge: {_format_currency_amount(visit_charge, curr_str)}")

        parts_est, _ = get_val("parts_estimate", "parts_cost", "materials_cost", "hardware_cost")
        if not parts_est and pricing_data:
            parts_est = pricing_data.get("parts_cost_estimate")
        if parts_est:
            pricing_lines.append(f"- Estimated Parts Cost: {_format_currency_amount(parts_est, curr_str)}")

        labor, _ = get_val("labor_charge", "service_fee", "installation_charge", "labor_fee")
        if not labor and pricing_data:
            labor = pricing_data.get("labor_charge")
        if labor:
            pricing_lines.append(f"- Labor / Service Fee: {_format_currency_amount(labor, curr_str)}")

        disc_pct, _ = get_val("discount_percent")
        if not disc_pct and pricing_data:
            disc_pct = pricing_data.get("discount_percent")
        disc_amt, _ = get_val("discount_amount", "discount", "discount_price", "offer_price")
        if disc_pct:
            pricing_lines.append(f"- Discount: {disc_pct}%")
        elif disc_amt:
            pricing_lines.append(f"- Discount: {_format_currency_amount(disc_amt, curr_str)}")

        tax_pct, _ = get_val("tax_percent", "gst_percent", "vat_percent")
        if not tax_pct and pricing_data:
            tax_pct = pricing_data.get("tax_percent")
        tax_amt, _ = get_val("tax_amount", "tax_rate")
        if tax_pct:
            pricing_lines.append(f"- Applicable Tax: {tax_pct}%")
        elif tax_amt:
            pricing_lines.append(f"- Tax Amount: {_format_currency_amount(tax_amt, curr_str)}")

        final_price, _ = get_val("final_price", "total_price", "net_amount", "total_amount")
        if not final_price and pricing_data:
            final_price = pricing_data.get("estimated_total")

        # Controlled commercial price classification (fixed, estimate, starting_price, quote_required, not_specified)
        raw_cpt, _ = get_val("commercial_price_type", "price_type")
        if not raw_cpt and pricing_data:
            raw_cpt = pricing_data.get("commercial_price_type") or pricing_data.get("price_type")

        cpt = "not_specified"
        if raw_cpt:
            norm_cpt = str(raw_cpt).strip().lower().replace(" ", "_").replace("-", "_")
            if norm_cpt in ("fixed", "estimate", "starting_price", "quote_required", "not_specified"):
                cpt = norm_cpt
            elif "quote" in norm_cpt and "fixed" not in norm_cpt:
                cpt = "quote_required"
            elif "start" in norm_cpt:
                cpt = "starting_price"
            elif "fixed" in norm_cpt:
                cpt = "fixed"
            elif "est" in norm_cpt:
                cpt = "estimate"

        if cpt == "fixed":
            if final_price and not _is_zero(final_price):
                pricing_lines.append(f"- Final Total (Fixed Quote): {_format_currency_amount(final_price, curr_str)}")
            pricing_lines.append("- Commercial Price Type: Fixed")
        elif cpt == "estimate":
            if final_price and not _is_zero(final_price):
                pricing_lines.append(f"- Estimated Total: {_format_currency_amount(final_price, curr_str)}")
            pricing_lines.append("- Commercial Price Type: Estimate")
        elif cpt == "starting_price":
            if final_price and not _is_zero(final_price):
                pricing_lines.append(f"- Starting Price: {_format_currency_amount(final_price, curr_str)} (Starting from)")
            pricing_lines.append("- Commercial Price Type: Starting Price")
        elif cpt == "quote_required":
            pricing_lines.append("- Price: Custom Quote Required on Inspection")
            pricing_lines.append("- Commercial Price Type: Quote Required")
        else:
            if final_price and final_price != base_price and not _is_zero(final_price):
                pricing_lines.append(f"- Calculated Total: {_format_currency_amount(final_price, curr_str)}")
            if raw_cpt and cpt != "not_specified":
                pricing_lines.append(f"- Commercial Price Type: {cpt.replace('_', ' ').title()}")

        pricing_note, _ = get_val("pricing_note", "notes", "special_instructions")
        if not pricing_note and pricing_data:
            pricing_note = pricing_data.get("pricing_note")
        if pricing_note:
            pricing_lines.append(f"- Pricing Qualification & Notes: {pricing_note}")

        pricing_model, _ = get_val("pricing_model", "billing_cycle", "billing_period")
        if pricing_model:
            pricing_lines.append(f"- Pricing Model / Billing: {pricing_model}")

        # Mark all pricing keys as consumed so they never leak into Additional Attributes
        consumed_keys.update({
            "base_price", "price", "unit_price", "list_price", "standard_rate", "rate", "cost", "mrp",
            "retail_price", "retail", "wholesale_price", "wholesale", "distributor_price", "distributor",
            "export_price", "export", "arc_price", "arc",
            "visit_charge", "inspection_fee", "diagnostic_fee", "callout_fee", "consultation_fee",
            "parts_estimate", "parts_cost", "parts_cost_estimate", "materials_cost", "hardware_cost",
            "labor_charge", "service_fee", "installation_charge", "labor_fee",
            "discount_percent", "discount_amount", "discount", "discount_price", "offer_price",
            "tax_percent", "gst_percent", "vat_percent", "tax_amount", "tax_rate",
            "final_price", "total_price", "net_amount", "total_amount",
            "commercial_price_type", "price_type", "pricing_note", "pricing_model", "billing_cycle", "billing_period",
            "currency", "pricing", "product_category", "category", "item_category", "product_group",
            "group", "product_type", "item_type",
        })

        if pricing_lines:
            sections.append(("pricing", "Pricing:\n" + "\n".join(pricing_lines)))

        # 5. Operational Details & Service SLAs
        ops_lines = []
        svc_type, _ = get_val("service_type")
        if svc_type:
            ops_lines.append(f"- Service Type: {svc_type}")
        sla, _ = get_val("sla_hours", "sla", "response_time", "turnaround_time", "delivery_time")
        if sla:
            ops_lines.append(f"- SLA / Turnaround Time: {sla} Hours" if sla.isdigit() else f"- SLA / Turnaround Time: {sla}")
        duration, _ = get_val("estimated_duration_min", "estimated_time", "duration")
        if duration:
            ops_lines.append(f"- Estimated Duration: {duration} Minutes" if duration.isdigit() else f"- Estimated Duration: {duration}")
        warranty, _ = get_val("warranty_days", "warranty_period", "warranty")
        if warranty:
            ops_lines.append(f"- Warranty: {warranty} Days" if warranty.isdigit() else f"- Warranty: {warranty}")
        tech_lvl, _ = get_val("technician_level", "skill_level", "expertise_level")
        if tech_lvl:
            ops_lines.append(f"- Technician Expertise Level: {tech_lvl}")
        parts_inc, _ = get_val("parts_included", "tools_included", "materials_included")
        if parts_inc:
            ops_lines.append(f"- Parts Included: {parts_inc}")
        avail, _ = get_val("availability", "operating_hours")
        if avail:
            ops_lines.append(f"- Availability: {avail}")
        reqs, _ = get_val("customer_requirements", "prerequisites", "pre_conditions")
        if reqs:
            ops_lines.append(f"- Customer Requirements: {reqs}")
        notes, _ = get_val("notes", "special_instructions", "operational_notes")
        if notes:
            ops_lines.append(f"- Operational Notes: {notes}")
        if ops_lines:
            sections.append(("service_operations", "Operational Details & SLAs:\n" + "\n".join(ops_lines)))

        # 6. Service Area & Geographic Coverage
        area, _ = get_val("service_area", "region", "applies_to_region", "coverage_area", "city", "location")
        if area:
            sections.append(("regional", f"Service Area Coverage: {area}"))

        # 7. Features, Specifications & Variants
        feat_lines = []
        features, _ = get_val("features")
        if features:
            feat_lines.append(f"Features:\n{features}")
        specs, _ = get_val("specifications", "material", "fabric")
        if specs:
            feat_lines.append(f"Specifications:\n{specs}")
        variants, _ = get_val("variants", "sizes", "colors", "inventory")
        if variants:
            feat_lines.append(f"Variants & Options:\n{variants}")
        if feat_lines:
            sections.append(("features", "\n".join(feat_lines)))

        # 8. Keywords & Tags
        keywords, _ = get_val("keywords", "tags")
        if keywords:
            sections.append(("keywords", f"Keywords & Tags: {keywords}"))

        return sections


class _PoliciesProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        # 1. Overview
        lines = [f"Policy: {item.title}"]
        ptype = _format_value(attrs.get("policy_type"))
        if ptype:
            lines.append(f"Policy Type: {ptype}")
        sections.append(("overview", "\n".join(lines)))

        # 2. Summary
        summary = _format_value(attrs.get("summary") or item.description)
        if summary:
            sections.append(("summary", f"Policy Summary:\n{summary}"))

        # 3. Policy Content / Details
        body = _format_value(attrs.get("body") or attrs.get("policy_details") or attrs.get("content"))
        if body:
            sections.append(("policy_details", f"Policy Details:\n{body}"))

        # 4. Applicability & Temporal Bounds
        meta_lines = []
        region = _format_value(attrs.get("applies_to_region") or attrs.get("region"))
        if region:
            meta_lines.append(f"Applicable Region: {region}")
        eff_from = _format_value(version.effective_from or attrs.get("effective_date"))
        eff_until = _format_value(version.effective_until or attrs.get("expiration_date"))
        if eff_from or eff_until:
            meta_lines.append(f"Effective Period: {eff_from or 'Immediate'} to {eff_until or 'Indefinite'}")
        if meta_lines:
            sections.append(("applicability", "\n".join(meta_lines)))

        return sections


class _SupportFaqsProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        q = _format_value(attrs.get("question") or item.title)
        sections.append(("question", f"Question: {q}"))

        short_ans = _format_value(attrs.get("short_answer") or item.description)
        if short_ans:
            sections.append(("short_answer", f"Summary Answer:\n{short_ans}"))

        ans = _format_value(attrs.get("answer") or attrs.get("body"))
        if ans:
            sections.append(("answer", f"Detailed Answer:\n{ans}"))

        ctx_lines = []
        aud = _format_value(attrs.get("audience"))
        if aud:
            ctx_lines.append(f"Audience: {aud}")
        tag = _format_value(attrs.get("category_tag"))
        if tag:
            ctx_lines.append(f"Topic Tag: {tag}")
        if ctx_lines:
            sections.append(("context", "\n".join(ctx_lines)))

        return sections


class _ContactsProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Contact: {item.title}"]
        role = _format_value(attrs.get("role"))
        if role:
            lines.append(f"Role / Title: {role}")
        dept = _format_value(attrs.get("department"))
        if dept:
            lines.append(f"Department: {dept}")
        primary = _format_value(attrs.get("is_primary"))
        if primary == "Yes":
            lines.append("Primary Contact: Yes")
        sections.append(("overview", "\n".join(lines)))

        details = []
        email = _format_value(attrs.get("email"))
        if email:
            details.append(f"Email: {email}")
        phone = _format_value(attrs.get("phone"))
        if phone:
            details.append(f"Phone: {phone}")
        loc = _format_value(attrs.get("office_location"))
        if loc:
            details.append(f"Location: {loc}")
        if details:
            sections.append(("contact_details", "\n".join(details)))

        return sections


class _OffersPromotionsProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Offer / Promotion: {item.title}"]
        code = _format_value(attrs.get("promo_code"))
        if code:
            lines.append(f"Promo Code: {code}")
        sections.append(("overview", "\n".join(lines)))

        disc_lines = []
        val = _format_value(attrs.get("discount_value"))
        dtype = _format_value(attrs.get("discount_type"))
        if val or dtype:
            disc_lines.append(f"Discount: {val or ''} ({dtype or ''})".strip())
        apps = _format_value(attrs.get("applicable_products"))
        if apps:
            disc_lines.append(f"Applicable Products: {apps}")
        if disc_lines:
            sections.append(("discount_details", "\n".join(disc_lines)))

        terms = _format_value(attrs.get("terms_and_conditions") or item.description)
        if terms:
            sections.append(("terms", f"Terms & Conditions:\n{terms}"))

        val_lines = []
        vfrom = _format_value(version.effective_from or attrs.get("valid_from"))
        vuntil = _format_value(version.effective_until or attrs.get("valid_until"))
        if vfrom or vuntil:
            val_lines.append(f"Validity Window: {vfrom or 'Open'} to {vuntil or 'Indefinite'}")
        if val_lines:
            sections.append(("validity", "\n".join(val_lines)))

        return sections


class _CompanyInfoProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Company: {item.title}"]
        legal = _format_value(attrs.get("legal_name"))
        if legal:
            lines.append(f"Legal Registered Name: {legal}")
        ind = _format_value(attrs.get("industry"))
        if ind:
            lines.append(f"Industry: {ind}")
        sections.append(("overview", "\n".join(lines)))

        desc = _format_value(attrs.get("description") or item.description)
        if desc:
            sections.append(("description", f"Company Overview:\n{desc}"))

        contact_lines = []
        web = _format_value(attrs.get("website"))
        if web:
            contact_lines.append(f"Website: {web}")
        email = _format_value(attrs.get("support_email"))
        if email:
            contact_lines.append(f"Support Email: {email}")
        phone = _format_value(attrs.get("support_phone"))
        if phone:
            contact_lines.append(f"Phone: {phone}")
        hq = _format_value(attrs.get("headquarters"))
        if hq:
            contact_lines.append(f"Headquarters: {hq}")
        if contact_lines:
            sections.append(("company_facts", "\n".join(contact_lines)))

        return sections


class _OperationsProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Procedure: {item.title}"]
        ptype = _format_value(attrs.get("procedure_type"))
        if ptype:
            lines.append(f"Operation Type: {ptype}")
        sections.append(("overview", "\n".join(lines)))

        summary = _format_value(attrs.get("summary") or item.description)
        if summary:
            sections.append(("summary", f"Summary:\n{summary}"))

        steps = _format_value(attrs.get("steps") or attrs.get("details"))
        if steps:
            sections.append(("procedures", f"Operating Steps:\n{steps}"))

        sla_lines = []
        sla = _format_value(attrs.get("sla_hours"))
        if sla:
            sla_lines.append(f"SLA Target: {sla} hours")
        esc = _format_value(attrs.get("escalation_contact"))
        if esc:
            sla_lines.append(f"Escalation Contact: {esc}")
        if sla_lines:
            sections.append(("sla_escalation", "\n".join(sla_lines)))

        return sections


class _LocationsProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Location: {item.title}"]
        ltype = _format_value(attrs.get("location_type"))
        if ltype:
            lines.append(f"Location Type: {ltype}")
        sections.append(("overview", "\n".join(lines)))

        addr_parts = []
        for key in ("address_line1", "address_line2", "city", "state", "postal_code", "country"):
            v = _format_value(attrs.get(key))
            if v:
                addr_parts.append(v)
        if addr_parts:
            sections.append(("address", f"Address:\n{', '.join(addr_parts)}"))

        ops_lines = []
        hours = _format_value(attrs.get("operating_hours"))
        if hours:
            ops_lines.append(f"Operating Hours: {hours}")
        phone = _format_value(attrs.get("contact_phone"))
        if phone:
            ops_lines.append(f"Contact Phone: {phone}")
        if ops_lines:
            sections.append(("operations", "\n".join(ops_lines)))

        return sections


class _BrandCommunicationProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = []

        lines = [f"Brand Guidelines: {item.title}"]
        voice = _format_value(attrs.get("brand_voice"))
        if voice:
            lines.append(f"Brand Voice: {voice}")
        tone = _format_value(attrs.get("tone"))
        if tone:
            lines.append(f"Tone: {tone}")
        sections.append(("voice_and_tone", "\n".join(lines)))

        props = _format_value(attrs.get("key_value_propositions") or item.description)
        if props:
            sections.append(("key_messaging", f"Value Propositions:\n{props}"))

        appr = _format_value(attrs.get("approved_phrases"))
        if appr:
            sections.append(("approved_phrases", f"Approved Phrases:\n{appr}"))

        forbid = _format_value(attrs.get("forbidden_phrases"))
        if forbid:
            sections.append(("forbidden_phrases", f"Do Not Say / Forbidden Phrases:\n{forbid}"))

        guide = _format_value(attrs.get("writing_guidelines"))
        if guide:
            sections.append(("guidelines", f"Writing Guidelines:\n{guide}"))

        return sections


class _GenericProjector(_BaseCategoryProjector):
    def build_sections(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attrs: Dict[str, Any],
        custom_attrs: Dict[str, Any],
        consumed_keys: Optional[Set[str]] = None,
    ) -> List[Tuple[str, str]]:
        sections: List[Tuple[str, str]] = [
            ("overview", f"{item.category.replace('_', ' ').title()}: {item.title}")
        ]
        desc = _format_value(item.description)
        if desc:
            sections.append(("description", desc))
        return sections


_PROJECTORS: Dict[str, _BaseCategoryProjector] = {
    KnowledgeCategory.PRODUCTS_SERVICES.value: _ProductsServicesProjector(),
    "products-services": _ProductsServicesProjector(),
    KnowledgeCategory.POLICIES.value: _PoliciesProjector(),
    "policies": _PoliciesProjector(),
    KnowledgeCategory.SUPPORT_FAQS.value: _SupportFaqsProjector(),
    "support-faqs": _SupportFaqsProjector(),
    KnowledgeCategory.CONTACTS.value: _ContactsProjector(),
    "contacts": _ContactsProjector(),
    KnowledgeCategory.OFFERS_PROMOTIONS.value: _OffersPromotionsProjector(),
    "offers-promotions": _OffersPromotionsProjector(),
    KnowledgeCategory.COMPANY_INFO.value: _CompanyInfoProjector(),
    "company-info": _CompanyInfoProjector(),
    KnowledgeCategory.OPERATIONS.value: _OperationsProjector(),
    "operations": _OperationsProjector(),
    KnowledgeCategory.LOCATIONS.value: _LocationsProjector(),
    "locations": _LocationsProjector(),
    KnowledgeCategory.BRAND_COMMUNICATION.value: _BrandCommunicationProjector(),
    "brand-communication": _BrandCommunicationProjector(),
}


# =============================================================================
# KnowledgeProjectionService
# =============================================================================


class KnowledgeProjectionService:
    """Orchestrates deterministic semantic projection and chunk persistence."""

    def __init__(
        self,
        max_chars: Optional[int] = None,
        overlap_chars: Optional[int] = None,
        projection_version: Optional[int] = None,
    ):
        settings = get_settings()
        import_cfg = getattr(settings, "knowledge_import", None)

        self.max_chars = (
            max_chars
            if max_chars is not None
            else (import_cfg.semantic_max_chars if import_cfg else 2000)
        )
        self.overlap_chars = (
            overlap_chars
            if overlap_chars is not None
            else (import_cfg.semantic_overlap_chars if import_cfg else 100)
        )
        self.projection_version = (
            projection_version
            if projection_version is not None
            else (import_cfg.semantic_projection_version if import_cfg else 2)
        )

        self.chunker = SemanticChunker(
            max_chars=self.max_chars,
            overlap_chars=self.overlap_chars,
        )

    @staticmethod
    def compute_document_id(tenant_id: str, item_id: str, version_id: str) -> str:
        """Deterministic document ID generated from composite hierarchical keys."""
        raw = f"{tenant_id}:{item_id}:{version_id}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        return f"doc_{digest}"

    def project_item_version(
        self,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attributes: Optional[List[Any]] = None,
    ) -> SemanticDocumentDTO:
        """Synchronously projects a single KnowledgeVersion into a SemanticDocumentDTO.

        Pure Python, zero I/O.
        """
        # Resolve attributes dict from authoritative canonical_data JSONB
        attrs_dict: Dict[str, Any] = {}
        custom_attrs_dict: Dict[str, Any] = {}
        if version.canonical_data is not None:
            raw_data = dict(version.canonical_data)
            nested_custom = raw_data.pop("custom_attributes", None)
            if isinstance(nested_custom, dict):
                custom_attrs_dict = dict(nested_custom)
            attrs_dict = raw_data
        else:
            attrs_list = attributes if attributes is not None else (getattr(version, "attributes", None) or [])
            for attr in attrs_list:
                key = getattr(attr, "key", None)
                if key:
                    val_fn = getattr(attr, "resolved_value", None)
                    attrs_dict[key] = val_fn() if callable(val_fn) else getattr(attr, "value", None)

        # Build category sections
        consumed_keys: Set[str] = set()
        clean_cat = normalize_category_key(item.category) if item.category else KnowledgeCategory.PRODUCTS_SERVICES.value
        projector = _PROJECTORS.get(clean_cat) or _PROJECTORS.get(item.category, _GenericProjector())
        try:
            sections = projector.build_sections(
                item=item,
                version=version,
                attrs=attrs_dict,
                custom_attrs=custom_attrs_dict,
                consumed_keys=consumed_keys,
            )
        except TypeError:
            sections = projector.build_sections(
                item=item,
                version=version,
                attrs=attrs_dict,
                custom_attrs=custom_attrs_dict,
            )

        # Append any custom attributes or extra fields not rendered in canonical sections
        _MEDIA_FIELD_NAMES = {"product_image", "image", "img", "photo_url", "image_url", "thumbnail", "photo"}
        _LOW_INFO_FIELD_VALUES = {
            "product_remark": {"16", ""},
            "remark": {"16", ""},
            "remarks": {"16", ""},
            "custom_product_remark": {"16", ""},
            "model_no": {"16"},
            "custom_model_no": {"16"},
        }

        extra_lines = []
        for k, v in custom_attrs_dict.items():
            if k in consumed_keys or k in _INTERNAL_KEYS_TO_IGNORE:
                continue
            k_clean = k.lower().replace("-", "_").strip()
            if k_clean in _MEDIA_FIELD_NAMES:
                continue
            if k_clean in _LOW_INFO_FIELD_VALUES and str(v).strip() in _LOW_INFO_FIELD_VALUES[k_clean]:
                continue
            val_fmt = _format_value(v)
            if val_fmt:
                clean_k = re.sub(r'_\d+$', '', k)
                clean_k = re.sub(r'^custom_', '', clean_k)
                clean_label = clean_k.replace("_", " ").title()
                extra_lines.append(f"{clean_label}: {val_fmt}")

        for k, v in attrs_dict.items():
            if k in consumed_keys or k in _INTERNAL_KEYS_TO_IGNORE:
                continue
            k_clean = k.lower().replace("-", "_").strip()
            if k_clean in _MEDIA_FIELD_NAMES:
                continue
            if k_clean in _LOW_INFO_FIELD_VALUES and str(v).strip() in _LOW_INFO_FIELD_VALUES[k_clean]:
                continue
            if k not in (
                "name", "sku", "description", "category_type", "price", "currency",
                "pricing_model", "availability", "features", "specifications", "warranty_period",
                "title", "policy_type", "summary", "body", "effective_date", "expiration_date",
                "applies_to_region", "region", "question", "answer", "short_answer", "category_tag",
                "audience", "role", "department", "email", "phone", "office_location", "is_primary",
                "discount_type", "discount_value", "promo_code", "terms_and_conditions",
                "valid_from", "valid_until", "applicable_products", "company_name", "legal_name",
                "industry", "website", "support_email", "support_phone", "headquarters",
                "procedure_type", "steps", "sla_hours", "escalation_contact", "location_name",
                "location_type", "address_line1", "address_line2", "city", "state", "postal_code",
                "country", "operating_hours", "contact_phone", "brand_voice", "tone",
                "key_value_propositions", "approved_phrases", "forbidden_phrases", "writing_guidelines",
                "brand", "model_number", "code", "amount", "rate", "cost", "billing_cycle",
                "discount_price", "offer_price", "diagnostic_fee", "inspection_fee", "labor_charge",
                "service_fee", "sizes", "sizes_available", "size", "colors", "colors_available", "color",
                "quantity", "stock", "stock_quantity", "inventory", "variants", "services",
                "repair_services", "services_included", "turnaround_time", "estimated_time",
                "duration", "parts_included", "compatible_devices", "compatibility", "material",
                "fabric", "lead_time", "warranty", "service_code", "service_type", "base_price",
                "visit_charge", "parts_estimate", "discount_percent", "tax_percent", "final_price",
                "estimated_duration_min", "warranty_days", "technician_level", "customer_requirements",
                "notes", "service_category", "service_subcategory", "brand_scope", "appliance_type",
                "issue_scope", "model_applicability", "keywords", "appliance", "service_area",
            ):
                val_fmt = _format_value(v)
                if val_fmt:
                    clean_k = re.sub(r'_\d+$', '', k)
                    clean_k = re.sub(r'^custom_', '', clean_k)
                    clean_label = clean_k.replace("_", " ").title()
                    extra_lines.append(f"{clean_label}: {val_fmt}")

        if extra_lines:
            sections.append(("additional_attributes", "Additional Attributes:\n" + "\n".join(extra_lines)))

        # Assemble full text
        full_text = "\n\n".join(text for _, text in sections if text and text.strip())

        eff_from_str = version.effective_from.isoformat() if version.effective_from else None
        eff_until_str = version.effective_until.isoformat() if version.effective_until else None

        # Structured entity categories use entity-centric projection (1 cohesive context-rich unit)
        # Narrative categories (policies, long SOPs) retain section-aware chunking
        structured_categories = {
            KnowledgeCategory.PRODUCTS_SERVICES.value,
            "products-services",
            KnowledgeCategory.CONTACTS.value,
            "contacts",
            KnowledgeCategory.LOCATIONS.value,
            "locations",
            KnowledgeCategory.OFFERS_PROMOTIONS.value,
            "offers-promotions",
            KnowledgeCategory.SUPPORT_FAQS.value,
            "support-faqs",
        }
        if item.category in structured_categories or clean_cat in structured_categories or len(full_text) <= self.max_chars:
            sections_to_chunk = [("entity", full_text)]
        else:
            sections_to_chunk = sections

        chunks = self.chunker.chunk_sections(
            tenant_id=item.tenant_id,
            item_id=item.id,
            version_id=version.id,
            category=clean_cat,
            authority=version.authority_level,
            status=version.status,
            sections=sections_to_chunk,
            source_id=version.source_id,
            effective_from=eff_from_str,
            effective_until=eff_until_str,
        )

        doc_id = self.compute_document_id(item.tenant_id, item.id, version.id)
        metadata = SemanticMetadataDTO(
            source_id=version.source_id,
            source_type=item.source_type,
            authority=version.authority_level,
            status=version.status,
            effective_from=eff_from_str,
            effective_until=eff_until_str,
            region=_format_value(attrs_dict.get("region") or attrs_dict.get("applies_to_region")),
            language=_format_value(attrs_dict.get("language")),
            chunk_count=len(chunks),
        )

        return SemanticDocumentDTO(
            document_id=doc_id,
            organization_id=item.tenant_id,
            knowledge_item_id=item.id,
            knowledge_version_id=version.id,
            category=item.category,
            full_text=full_text,
            chunks=chunks,
            projection_version=self.projection_version,
            metadata=metadata,
        )

    async def project_version_in_db(
        self,
        db: AsyncSession,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        attributes: Optional[List[Any]] = None,
    ) -> SemanticDocumentDTO:
        """Projects a version and saves chunks and metadata into the database."""
        doc = self.project_item_version(item, version, attributes)

        now_utc = datetime.now(timezone.utc)

        # Update version columns
        version.content_text = doc.full_text
        version.chunk_count = len(doc.chunks)
        version.semantic_version = self.projection_version
        version.projection_status = "projected"
        version.last_projected_at = now_utc

        # Delete any previous chunks for idempotency
        await db.execute(
            delete(KnowledgeSemanticChunk).where(
                KnowledgeSemanticChunk.knowledge_version_id == version.id,
                KnowledgeSemanticChunk.tenant_id == item.tenant_id,
            )
        )

        # Bulk insert new chunks
        for c in doc.chunks:
            chunk_hash = hashlib.sha256(c.text.encode("utf-8")).hexdigest()
            chunk_row = KnowledgeSemanticChunk(
                id=c.chunk_id,
                tenant_id=c.organization_id,
                knowledge_item_id=c.knowledge_item_id,
                knowledge_version_id=c.knowledge_version_id,
                chunk_index=c.chunk_index,
                section=c.section,
                text=c.text,
                char_count=c.char_count,
                projection_version=self.projection_version,
                source_id=c.source_id,
                authority_level=c.authority,
                status=c.status,
                semantic_hash=chunk_hash,
                effective_from=version.effective_from,
                effective_until=version.effective_until,
            )
            db.add(chunk_row)

        await db.flush()
        return doc

    async def project_import_batch(
        self,
        db: AsyncSession,
        tenant_id: str,
        pairs: Sequence[Tuple[KnowledgeItem, KnowledgeVersion, Optional[List[Any]]]],
    ) -> Tuple[List[SemanticDocumentDTO], ProjectionBatchSummaryDTO]:
        """Projects and persists a batch of items and versions in PostgreSQL.

        Executes minimal SQL statements per batch for high throughput.
        """
        t0 = time.perf_counter()
        now_utc = datetime.now(timezone.utc)
        projected_docs: List[SemanticDocumentDTO] = []
        errors: List[str] = []
        all_chunk_rows: List[KnowledgeSemanticChunk] = []
        version_ids_to_clean: List[str] = []

        for item, version, attrs in pairs:
            try:
                doc = self.project_item_version(item, version, attrs)
                version.content_text = doc.full_text
                version.chunk_count = len(doc.chunks)
                version.semantic_version = self.projection_version
                version.projection_status = "projected"
                version.last_projected_at = now_utc

                version_ids_to_clean.append(version.id)
                for c in doc.chunks:
                    chunk_hash = hashlib.sha256(c.text.encode("utf-8")).hexdigest()
                    all_chunk_rows.append(
                        KnowledgeSemanticChunk(
                            id=c.chunk_id,
                            tenant_id=c.organization_id,
                            knowledge_item_id=c.knowledge_item_id,
                            knowledge_version_id=c.knowledge_version_id,
                            chunk_index=c.chunk_index,
                            section=c.section,
                            text=c.text,
                            char_count=c.char_count,
                            projection_version=self.projection_version,
                            source_id=c.source_id,
                            authority_level=c.authority,
                            status=c.status,
                            semantic_hash=chunk_hash,
                            effective_from=version.effective_from,
                            effective_until=version.effective_until,
                        )
                    )
                projected_docs.append(doc)
            except Exception as ex:
                err = f"Failed projecting item {item.id} version {version.id}: {str(ex)}"
                logger.error(err)
                errors.append(err)

        if version_ids_to_clean:
            # Clean previous chunks
            await db.execute(
                delete(KnowledgeSemanticChunk).where(
                    KnowledgeSemanticChunk.knowledge_version_id.in_(version_ids_to_clean),
                    KnowledgeSemanticChunk.tenant_id == tenant_id,
                )
            )

        if all_chunk_rows:
            db.add_all(all_chunk_rows)

        await db.flush()

        duration = round(time.perf_counter() - t0, 4)
        summary = ProjectionBatchSummaryDTO(
            total_projected=len(projected_docs),
            total_chunks=len(all_chunk_rows),
            duration_seconds=duration,
            projection_version=self.projection_version,
            errors=errors,
        )
        return projected_docs, summary
