"""Phase 7.1 — Knowledge Taxonomy & Centralized Category Registry.

Defines the canonical enterprise data model for all 9 knowledge categories:
1. company_info
2. products_services (includes all pricing; no standalone pricing category)
3. contacts
4. policies
5. support_faqs
6. offers_promotions
7. operations
8. locations
9. brand_communication

Provides:
- Strict canonical field definitions per category
- Deterministic data type checking
- Normalization (email, phone, currency, string trimming)
- Validation engine for UI authoring and Phase 8 bulk imports
- Tenant-scoped custom attribute validation
- Retrieval filter metadata hints for future Phase 10 semantic projection
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, Field

from app.models.knowledge import AttributeValueType, KnowledgeCategory


# =============================================================================
# Domain Errors
# =============================================================================


class KnowledgeCategoryError(Exception):
    """Base error for knowledge taxonomy and category schema violations."""

    pass


class KnowledgeInvalidCategoryError(KnowledgeCategoryError):
    """Raised when an unknown or invalid category key is requested."""

    pass


class KnowledgeValidationError(KnowledgeCategoryError):
    """Raised when record data fails canonical or custom attribute validation."""

    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors


# =============================================================================
# Normalization Utilities
# =============================================================================


_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_CLEAN_REGEX = re.compile(r"[\s\-\(\)\.]")
_ISO_CURRENCY_REGEX = re.compile(r"^[A-Z]{3}$")
_IDENTIFIER_REGEX = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


CATEGORY_ALIASES: Dict[str, KnowledgeCategory] = {
    # 1. company_info (Company Info)
    "company_info": KnowledgeCategory.COMPANY_INFO,
    "company_profile": KnowledgeCategory.COMPANY_INFO,
    "company": KnowledgeCategory.COMPANY_INFO,
    "about_us": KnowledgeCategory.COMPANY_INFO,
    # 2. products_services (Products & Services / Pricing Plans)
    "products_services": KnowledgeCategory.PRODUCTS_SERVICES,
    "pricing_plans": KnowledgeCategory.PRODUCTS_SERVICES,
    "products": KnowledgeCategory.PRODUCTS_SERVICES,
    "services": KnowledgeCategory.PRODUCTS_SERVICES,
    "catalog": KnowledgeCategory.PRODUCTS_SERVICES,
    "catalogue": KnowledgeCategory.PRODUCTS_SERVICES,
    # 3. contacts (Contacts / Team Directory)
    "contacts": KnowledgeCategory.CONTACTS,
    "team_directory": KnowledgeCategory.CONTACTS,
    "team": KnowledgeCategory.CONTACTS,
    "directory": KnowledgeCategory.CONTACTS,
    "staff": KnowledgeCategory.CONTACTS,
    # 4. policies (Policies)
    "policies": KnowledgeCategory.POLICIES,
    "legal_policies": KnowledgeCategory.POLICIES,
    "terms": KnowledgeCategory.POLICIES,
    # 5. support_faqs (Support & FAQs / Troubleshooting Guides)
    "support_faqs": KnowledgeCategory.SUPPORT_FAQS,
    "troubleshooting_guides": KnowledgeCategory.SUPPORT_FAQS,
    "faqs": KnowledgeCategory.SUPPORT_FAQS,
    "faq": KnowledgeCategory.SUPPORT_FAQS,
    "support": KnowledgeCategory.SUPPORT_FAQS,
    "troubleshooting": KnowledgeCategory.SUPPORT_FAQS,
    # 6. offers_promotions (Offers & Promotions)
    "offers_promotions": KnowledgeCategory.OFFERS_PROMOTIONS,
    "promotions": KnowledgeCategory.OFFERS_PROMOTIONS,
    "discounts": KnowledgeCategory.OFFERS_PROMOTIONS,
    "coupons": KnowledgeCategory.OFFERS_PROMOTIONS,
    "deals": KnowledgeCategory.OFFERS_PROMOTIONS,
    # 7. operations (Operations)
    "operations": KnowledgeCategory.OPERATIONS,
    "operational_procedures": KnowledgeCategory.OPERATIONS,
    "sop": KnowledgeCategory.OPERATIONS,
    "sops": KnowledgeCategory.OPERATIONS,
    "procedures": KnowledgeCategory.OPERATIONS,
    # 8. locations (Locations / Facilities)
    "locations": KnowledgeCategory.LOCATIONS,
    "locations_facilities": KnowledgeCategory.LOCATIONS,
    "facilities": KnowledgeCategory.LOCATIONS,
    "branches": KnowledgeCategory.LOCATIONS,
    "offices": KnowledgeCategory.LOCATIONS,
    # 9. brand_communication (Brand & Communication / General Reference)
    "brand_communication": KnowledgeCategory.BRAND_COMMUNICATION,
    "general_reference": KnowledgeCategory.BRAND_COMMUNICATION,
    "brand_guidelines": KnowledgeCategory.BRAND_COMMUNICATION,
    "communication_guidelines": KnowledgeCategory.BRAND_COMMUNICATION,
    "brand": KnowledgeCategory.BRAND_COMMUNICATION,
}


def normalize_category_key(key: str) -> str:
    """Normalize input category key to canonical snake_case.
    
    Accepts kebab-case (e.g. 'company-info'), snake_case ('company_info'),
    UI display names ('Company Info', 'Products & Services'), or backend aliases
    ('company_profile', 'pricing_plans', 'team_directory') and maps deterministically
    to the 9 frozen domain categories.
    """
    if not key or not isinstance(key, str):
        raise KnowledgeInvalidCategoryError("Category key must be a non-empty string.")

    cleaned = key.strip().lower().replace("-", "_").replace(" ", "_")
    cleaned = cleaned.replace("&", "").replace("__", "_").strip("_")
    
    if cleaned in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[cleaned].value

    valid_keys = {c.value for c in KnowledgeCategory}
    if cleaned not in valid_keys:
        raise KnowledgeInvalidCategoryError(
            f"Invalid category '{key}'. Must be one of: {', '.join(sorted(valid_keys))}."
        )
    return cleaned


def normalize_string(value: Any) -> Optional[str]:
    """Trim whitespace and collapse multiple internal spaces."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def normalize_email(value: Any) -> Optional[str]:
    """Normalize email address to lowercase and validate basic syntax."""
    s = normalize_string(value)
    if not s:
        return None
    lowered = s.lower()
    if not _EMAIL_REGEX.match(lowered):
        raise ValueError(f"Invalid email address format: '{value}'")
    return lowered


def normalize_currency(value: Any) -> Optional[str]:
    """Normalize currency to 3-letter uppercase ISO-4217 code."""
    s = normalize_string(value)
    if not s:
        return None
    upper = s.upper()
    if not _ISO_CURRENCY_REGEX.match(upper):
        raise ValueError(f"Invalid currency code '{value}'. Must be a 3-letter ISO code (e.g. INR, USD, EUR).")
    return upper


def normalize_phone(value: Any) -> Optional[str]:
    """Clean phone number by stripping formatting artifacts."""
    s = normalize_string(value)
    if not s:
        return None
    return _PHONE_CLEAN_REGEX.sub("", s)


def normalize_number(value: Any) -> Optional[float]:
    """Coerce numeric values to float."""
    if value is None or value == "":
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, Decimal):
            return float(value)
        # Strip currency symbols if present
        clean_str = re.sub(r"[^\d\.\-]", "", str(value))
        return float(clean_str)
    except (ValueError, TypeError):
        raise ValueError(f"Cannot parse '{value}' as a valid number.")


def normalize_boolean(value: Any) -> Optional[bool]:
    """Coerce boolean values from strings, ints, or bools."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"true", "1", "yes", "y", "t"}:
        return True
    if s in {"false", "0", "no", "n", "f"}:
        return False
    raise ValueError(f"Cannot parse '{value}' as a boolean.")


# =============================================================================
# Canonical Field & Category Definitions
# =============================================================================


@dataclass(frozen=True)
class CanonicalFieldDefinition:
    """Contract specification for a single canonical field within a category."""

    name: str
    field_type: AttributeValueType
    is_required: bool = False
    description: str = ""
    allowed_values: Optional[List[str]] = None
    validation_regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    is_semantic: bool = False  # Contributes to future AI semantic projection text
    is_filter: bool = True     # Retained as structured SQL / vector filter
    normalization: Optional[str] = None  # 'string', 'email', 'currency', 'phone', 'number', 'boolean'


@dataclass
class ValidationResult:
    """Outcome of category record validation."""

    is_valid: bool
    errors: List[str]
    cleaned_canonical_data: Dict[str, Any]
    cleaned_custom_attributes: Dict[str, Any]


class CategoryDefinition:
    """Encapsulates the canonical schema and validation contract for a category."""

    def __init__(
        self,
        category: KnowledgeCategory,
        display_name: str,
        description: str,
        purpose: str,
        entity_types: List[str],
        fields: List[CanonicalFieldDefinition],
        retrieval_filter_fields: List[str],
        supports_temporal: bool = False,
        supports_regional: bool = False,
    ):
        self.category = category
        self.display_name = display_name
        self.description = description
        self.purpose = purpose
        self.entity_types = entity_types
        self.fields: Dict[str, CanonicalFieldDefinition] = {f.name: f for f in fields}
        self.retrieval_filter_fields = retrieval_filter_fields
        self.supports_temporal = supports_temporal
        self.supports_regional = supports_regional

    def validate_and_normalize(
        self,
        record: Dict[str, Any],
        custom_definitions: Optional[Dict[str, Any]] = None,
        strict_custom: bool = False,
    ) -> ValidationResult:
        """Validate and normalize a data dictionary against canonical and custom rules.
        
        Args:
            record: Raw input dictionary containing field values.
            custom_definitions: Dict of custom attribute specifications defined by the tenant.
            strict_custom: If True, reject unknown custom keys not in custom_definitions.
        """
        errors: List[str] = []
        cleaned_canonical: Dict[str, Any] = {}
        cleaned_custom: Dict[str, Any] = {}
        custom_defs = custom_definitions or {}

        # 1. Validate Canonical Fields
        for field_name, field_def in self.fields.items():
            raw_val = record.get(field_name)

            # Check required
            if field_def.is_required and (raw_val is None or raw_val == ""):
                errors.append(f"Field '{field_name}' is required for category '{self.category.value}'.")
                continue

            if raw_val is None or raw_val == "":
                continue

            # Normalize and type check
            try:
                norm_val = self._normalize_field(raw_val, field_def)
            except ValueError as val_err:
                errors.append(f"Field '{field_name}': {str(val_err)}")
                continue

            # Validate allowed enum values
            if field_def.allowed_values and norm_val not in field_def.allowed_values:
                errors.append(
                    f"Field '{field_name}' has invalid value '{norm_val}'. "
                    f"Allowed options: {', '.join(field_def.allowed_values)}"
                )
                continue

            # Validate range
            if isinstance(norm_val, (int, float)):
                if field_def.min_value is not None and norm_val < field_def.min_value:
                    errors.append(f"Field '{field_name}' must be >= {field_def.min_value}.")
                if field_def.max_value is not None and norm_val > field_def.max_value:
                    errors.append(f"Field '{field_name}' must be <= {field_def.max_value}.")

            # Validate regex
            if field_def.validation_regex and isinstance(norm_val, str):
                if not re.match(field_def.validation_regex, norm_val):
                    errors.append(f"Field '{field_name}' does not match required pattern.")

            cleaned_canonical[field_name] = norm_val

        # 2. Check for Required Custom Attributes
        for custom_key, custom_def in custom_defs.items():
            is_req = getattr(custom_def, "is_required", False)
            if is_req and (custom_key not in record or record[custom_key] is None or record[custom_key] == ""):
                errors.append(f"Custom attribute '{custom_key}' is required by organization schema.")

        # 3. Process Custom Attributes (fields not in canonical schema)
        canonical_keys = set(self.fields.keys())
        for raw_key, raw_val in record.items():
            if raw_key in canonical_keys:
                continue

            # Check identifier format
            cleaned_key = raw_key.strip().lower()
            if not _IDENTIFIER_REGEX.match(cleaned_key):
                errors.append(
                    f"Custom attribute key '{raw_key}' is invalid. "
                    "Must be snake_case alphanumeric starting with a letter (e.g. 'warranty_period')."
                )
                continue

            # If tenant has defined custom definition, validate against it
            if cleaned_key in custom_defs:
                c_def = custom_defs[cleaned_key]
                v_type = getattr(c_def, "value_type", AttributeValueType.STRING.value)
                allowed = getattr(c_def, "allowed_values", None)

                # Type check
                try:
                    c_norm = self._coerce_custom_type(raw_val, v_type)
                    if allowed and c_norm not in allowed:
                        errors.append(
                            f"Custom attribute '{cleaned_key}' has invalid value '{c_norm}'. "
                            f"Allowed options: {', '.join(allowed)}"
                        )
                        continue
                    cleaned_custom[cleaned_key] = c_norm
                except ValueError as err:
                    errors.append(f"Custom attribute '{cleaned_key}': {str(err)}")
            elif strict_custom:
                errors.append(f"Unknown custom attribute '{raw_key}' is not defined for this organization.")
            else:
                # Permissive typed custom attribute
                cleaned_custom[cleaned_key] = raw_val

        return ValidationResult(
            is_valid=(len(errors) == 0),
            errors=errors,
            cleaned_canonical_data=cleaned_canonical,
            cleaned_custom_attributes=cleaned_custom,
        )

    def _normalize_field(self, val: Any, field_def: CanonicalFieldDefinition) -> Any:
        """Apply normalization logic according to field contract."""
        norm_type = field_def.normalization or field_def.field_type.value

        if norm_type in {"string", "text", "enum"}:
            s = normalize_string(val)
            if s is None:
                raise ValueError("String cannot be blank.")
            return s
        elif norm_type == "email":
            return normalize_email(val)
        elif norm_type == "currency":
            return normalize_currency(val)
        elif norm_type == "phone":
            return normalize_phone(val)
        elif norm_type in {"integer", "decimal", "currency_amount", "number"}:
            num = normalize_number(val)
            if field_def.field_type == AttributeValueType.INTEGER and num is not None:
                return int(num)
            return num
        elif norm_type == "boolean":
            return normalize_boolean(val)
        elif norm_type in {"date", "datetime"}:
            if isinstance(val, (datetime, date)):
                return val
            # Attempt to parse ISO string
            try:
                return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
            except ValueError:
                raise ValueError(f"Invalid ISO datetime format: '{val}'. Expected 'YYYY-MM-DD' or ISO-8601 string.")
        elif norm_type == "array":
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                return [s.strip() for s in val.split(",") if s.strip()]
            raise ValueError(f"Expected list of values, got {type(val).__name__}.")
        return val

    def _coerce_custom_type(self, val: Any, value_type: str) -> Any:
        """Coerce and validate custom attribute values against defined types."""
        if val is None:
            return None
        if value_type in {AttributeValueType.STRING.value, AttributeValueType.TEXT.value, AttributeValueType.ENUM.value}:
            return str(val).strip()
        elif value_type in {AttributeValueType.INTEGER.value, AttributeValueType.DECIMAL.value, AttributeValueType.CURRENCY.value}:
            num = normalize_number(val)
            if value_type == AttributeValueType.INTEGER.value:
                return int(num) if num is not None else None
            return num
        elif value_type == AttributeValueType.BOOLEAN.value:
            return normalize_boolean(val)
        elif value_type in {AttributeValueType.DATE.value, AttributeValueType.DATETIME.value}:
            if isinstance(val, (datetime, date)):
                return val
            return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        elif value_type == AttributeValueType.ARRAY.value:
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                return [s.strip() for s in val.split(",") if s.strip()]
            raise ValueError("Must be a list or comma-separated string.")
        return val

    def to_client_dto(self) -> Dict[str, Any]:
        """Serialize for external API exposure."""
        return {
            "key": self.category.value,
            "displayName": self.display_name,
            "description": self.description,
            "purpose": self.purpose,
            "entityTypes": self.entity_types,
            "supportsTemporal": self.supports_temporal,
            "supportsRegional": self.supports_regional,
            "retrievalFilterFields": self.retrieval_filter_fields,
            "fields": [
                {
                    "name": f.name,
                    "type": f.field_type.value,
                    "required": f.is_required,
                    "description": f.description,
                    "allowedValues": f.allowed_values,
                    "isSemantic": f.is_semantic,
                    "isFilter": f.is_filter,
                    "minValue": f.min_value,
                    "maxValue": f.max_value,
                }
                for f in self.fields.values()
            ],
        }


# =============================================================================
# KnowledgeCategoryRegistry — Singleton Enterprise Registry
# =============================================================================


class KnowledgeCategoryRegistry:
    """Centralized, immutable registry for all 9 ProxiPilot Knowledge Categories."""

    def __init__(self):
        self._categories: Dict[str, CategoryDefinition] = {}
        self._initialize_registry()

    def _initialize_registry(self):
        """Construct the frozen canonical definitions for all 9 categories."""

        # ---------------------------------------------------------------------
        # 1. company_info
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.COMPANY_INFO,
                display_name="Company Info",
                description="Identity, corporate facts, registration details, and executive overview.",
                purpose="Establish canonical organization identity facts for authoritative AI grounding.",
                entity_types=["ORGANIZATION", "BRANCH", "LEGAL_ENTITY"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["company_name", "industry", "headquarters"],
                fields=[
                    CanonicalFieldDefinition(
                        name="company_name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Canonical business or brand name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="legal_name",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Official registered corporate legal entity name.",
                    ),
                    CanonicalFieldDefinition(
                        name="description",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Comprehensive narrative company overview and mission.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="industry",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Primary business industry sector.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="website",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Official website URL.",
                    ),
                    CanonicalFieldDefinition(
                        name="founded_year",
                        field_type=AttributeValueType.INTEGER,
                        is_required=False,
                        description="Year the company was founded.",
                        min_value=1800,
                        max_value=2100,
                    ),
                    CanonicalFieldDefinition(
                        name="company_size",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Total employee headcount band.",
                        allowed_values=["1-10", "11-50", "51-200", "201-500", "500+"],
                    ),
                    CanonicalFieldDefinition(
                        name="headquarters",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Primary headquarters city or state.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="email",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="General inquiry email address.",
                        normalization="email",
                    ),
                    CanonicalFieldDefinition(
                        name="phone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Main switchboard contact number.",
                        normalization="phone",
                    ),
                    CanonicalFieldDefinition(
                        name="support_email",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Dedicated customer support email.",
                        normalization="email",
                    ),
                    CanonicalFieldDefinition(
                        name="sales_email",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Dedicated commercial sales desk email.",
                        normalization="email",
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 2. products_services (INCLUDES ALL PRICING)
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.PRODUCTS_SERVICES,
                display_name="Products & Services",
                description="Commercial catalog items, service offerings, packages, specifications, and pricing facts.",
                purpose="Drive commercial negotiation, quote generation, and product information retrieval.",
                entity_types=["PRODUCT", "SERVICE", "PACKAGE", "PLAN", "PART", "RAW_MATERIAL", "ACCESSORY"],
                supports_temporal=True,
                supports_regional=True,
                retrieval_filter_fields=["entity_type", "sku", "availability", "region", "price", "currency", "brand"],
                fields=[
                    CanonicalFieldDefinition(
                        name="name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Official product, plan, or service offering name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="entity_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Classification of commercial offering.",
                        allowed_values=["PRODUCT", "SERVICE", "PACKAGE", "PLAN", "PART", "RAW_MATERIAL", "ACCESSORY"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="description",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Full narrative description, scope of work, and customer benefits.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="short_description",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="1-2 sentence concise product summary.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="sku",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Stock Keeping Unit or internal catalog code.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="brand",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Brand or manufacturer name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="sub_category",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Organizational sub-classification (e.g. 'HVAC Maintenance', 'SaaS Subscriptions').",
                        is_filter=True,
                    ),
                    # PRICING FIELDS (RULE 11 & 12: PRICING BELONGS STRICTLY HERE)
                    CanonicalFieldDefinition(
                        name="price",
                        field_type=AttributeValueType.DECIMAL,
                        is_required=False,
                        description="Exact commercial price amount.",
                        min_value=0.0,
                        is_filter=True,
                        normalization="number",
                    ),
                    CanonicalFieldDefinition(
                        name="commercial_price_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Controlled commercial price commitment type.",
                        allowed_values=["fixed", "estimate", "starting_price", "quote_required", "not_specified"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="currency",
                        field_type=AttributeValueType.CURRENCY,
                        is_required=False,
                        description="ISO 4217 3-letter currency code (e.g. INR, USD, EUR).",
                        normalization="currency",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="billing_period",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Recurring billing cycle.",
                        allowed_values=["one_time", "hourly", "daily", "weekly", "monthly", "quarterly", "annual"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="availability",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Current fulfillment / order state.",
                        allowed_values=["in_stock", "available", "out_of_stock", "discontinued", "by_appointment"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="region",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Geographic region where this offering or pricing applies.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="warranty",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Standard warranty period and terms.",
                    ),
                    CanonicalFieldDefinition(
                        name="unit",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Unit of measurement (e.g. 'seat', 'license', 'hour', 'box').",
                    ),
                    CanonicalFieldDefinition(
                        name="minimum_quantity",
                        field_type=AttributeValueType.INTEGER,
                        is_required=False,
                        description="Minimum order quantity.",
                        min_value=1,
                    ),
                    CanonicalFieldDefinition(
                        name="features",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="Key feature bullet points.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="service_area",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Coverage territory for field operations.",
                        is_filter=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 3. contacts
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.CONTACTS,
                display_name="Contacts",
                description="Key personnel, department points of contact, support desks, and escalation numbers.",
                purpose="Ground communication routing, escalation, and contact info delivery.",
                entity_types=["PERSON", "DEPARTMENT", "HOTLINE"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["contact_type", "department", "location"],
                fields=[
                    CanonicalFieldDefinition(
                        name="name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Name of contact person, desk, or department.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="contact_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Functional category of contact endpoint.",
                        allowed_values=["sales", "support", "billing", "operations", "emergency", "general"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="role",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Job title or functional responsibility.",
                    ),
                    CanonicalFieldDefinition(
                        name="department",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Corporate department.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="email",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Direct or desk email address.",
                        normalization="email",
                    ),
                    CanonicalFieldDefinition(
                        name="phone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Direct telephone or mobile number.",
                        normalization="phone",
                    ),
                    CanonicalFieldDefinition(
                        name="alternate_phone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Backup or after-hours telephone number.",
                        normalization="phone",
                    ),
                    CanonicalFieldDefinition(
                        name="location",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Physical desk, floor, or branch location.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="availability",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Working hours or on-call schedule.",
                    ),
                    CanonicalFieldDefinition(
                        name="notes",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Additional instructions for routing or escalation.",
                        is_semantic=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 4. policies
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.POLICIES,
                display_name="Policies",
                description="Formal business rules, refund guidelines, service level agreements (SLAs), and compliance standards.",
                purpose="Enforce binding business logic and accurate policy answers in negotiations.",
                entity_types=["POLICY", "AGREEMENT", "STANDARD"],
                supports_temporal=True,
                supports_regional=True,
                retrieval_filter_fields=["policy_type", "region", "effective_from", "effective_until"],
                fields=[
                    CanonicalFieldDefinition(
                        name="policy_name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Title of policy (e.g. 'Standard 30-Day Refund Policy').",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="policy_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Classification of business policy.",
                        allowed_values=[
                            "refund",
                            "cancellation",
                            "privacy",
                            "terms_of_service",
                            "warranty",
                            "sla",
                            "shipping",
                            "compliance",
                            "general",
                        ],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="summary",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Concise 1-2 sentence summary of the rule.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="details",
                        field_type=AttributeValueType.TEXT,
                        is_required=True,
                        description="Full legal or operational text of the policy.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="scope",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Client or product scope to which this policy applies.",
                    ),
                    CanonicalFieldDefinition(
                        name="applicability",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Specific preconditions triggering the policy.",
                    ),
                    CanonicalFieldDefinition(
                        name="region",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Jurisdiction or territory.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="effective_from",
                        field_type=AttributeValueType.DATETIME,
                        is_required=False,
                        description="Date/time when policy takes legal effect.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="effective_until",
                        field_type=AttributeValueType.DATETIME,
                        is_required=False,
                        description="Date/time when policy expires.",
                        is_filter=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 5. support_faqs
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.SUPPORT_FAQS,
                display_name="Support FAQs",
                description="Common customer questions and canonical, verified answers.",
                purpose="Resolve repetitive inquiries and provide prompt evidence-based grounding.",
                entity_types=["FAQ", "HOW_TO", "TROUBLESHOOTING"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["category_tag", "related_service", "audience", "region"],
                fields=[
                    CanonicalFieldDefinition(
                        name="question",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Canonical customer inquiry or prompt.",
                        is_semantic=True,
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="answer",
                        field_type=AttributeValueType.TEXT,
                        is_required=True,
                        description="Authoritative verified response.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="short_answer",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="1-sentence quick reply.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="category_tag",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Topic grouping (e.g. 'billing', 'installation', 'account').",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="related_service",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Specific product or service this FAQ addresses.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="audience",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Target audience.",
                        allowed_values=["all", "prospective_clients", "existing_customers", "internal_staff"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="region",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Regional applicability.",
                        is_filter=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 6. offers_promotions
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.OFFERS_PROMOTIONS,
                display_name="Offers & Promotions",
                description="Time-sensitive commercial offers, discounts, bundles, and seasonal coupon campaigns.",
                purpose="Empower agent to offer valid deals without quoting expired promotions.",
                entity_types=["DISCOUNT", "PROMO_CODE", "BUNDLE", "SEASONAL"],
                supports_temporal=True,
                supports_regional=True,
                retrieval_filter_fields=["offer_type", "promo_code", "customer_segment", "status", "start_at", "end_at"],
                fields=[
                    CanonicalFieldDefinition(
                        name="offer_name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Promotional campaign name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="description",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Complete promotional offer details and customer incentives.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="offer_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Structure of discount.",
                        allowed_values=["percentage_discount", "flat_discount", "bundle_deal", "free_trial", "seasonal_special"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="discount_value",
                        field_type=AttributeValueType.DECIMAL,
                        is_required=False,
                        description="Numerical magnitude of discount (e.g. 20.0 for 20% or 500 for $500).",
                        min_value=0.0,
                    ),
                    CanonicalFieldDefinition(
                        name="discount_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Type of discount value.",
                        allowed_values=["percent", "fixed_amount"],
                    ),
                    CanonicalFieldDefinition(
                        name="currency",
                        field_type=AttributeValueType.CURRENCY,
                        is_required=False,
                        description="Currency applicable for fixed amount discount.",
                        normalization="currency",
                    ),
                    CanonicalFieldDefinition(
                        name="promo_code",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Voucher or checkout promotional code.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="applicable_products",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="List of product SKUs or names eligible for this offer.",
                    ),
                    CanonicalFieldDefinition(
                        name="applicable_services",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="List of service offerings eligible for this offer.",
                    ),
                    CanonicalFieldDefinition(
                        name="customer_segment",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Audience segment eligible for redemption.",
                        allowed_values=["all", "new_customers", "returning_customers", "enterprise"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="start_at",
                        field_type=AttributeValueType.DATETIME,
                        is_required=False,
                        description="Timestamp when offer becomes active.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="end_at",
                        field_type=AttributeValueType.DATETIME,
                        is_required=False,
                        description="Timestamp when offer strictly expires.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="terms",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Terms, conditions, and exclusions.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="status",
                        field_type=AttributeValueType.ENUM,
                        is_required=False,
                        description="Campaign availability state.",
                        allowed_values=["active", "expired", "upcoming", "draft"],
                        is_filter=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 7. operations
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.OPERATIONS,
                display_name="Operations",
                description="Standard Operating Procedures (SOPs), turnaround schedules, escalation rules, and logistics.",
                purpose="Inform realistic commitments on turnaround times, field logistics, and SLAs.",
                entity_types=["SOP", "PROCESS", "WORKFLOW"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["department", "region"],
                fields=[
                    CanonicalFieldDefinition(
                        name="operation_name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Name of operational procedure or workflow.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="description",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Overview of procedure objective.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="procedure",
                        field_type=AttributeValueType.TEXT,
                        is_required=True,
                        description="Step-by-step operational instructions.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="owner",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Responsible person or team lead.",
                    ),
                    CanonicalFieldDefinition(
                        name="department",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Operating unit.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="business_hours",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Operational hours for this procedure.",
                    ),
                    CanonicalFieldDefinition(
                        name="turnaround_time",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Guaranteed or expected completion time window.",
                    ),
                    CanonicalFieldDefinition(
                        name="sla",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Service Level Agreement target.",
                    ),
                    CanonicalFieldDefinition(
                        name="escalation_rules",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Criteria and contacts for ticket or incident escalation.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="region",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Territory where procedure applies.",
                        is_filter=True,
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 8. locations
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.LOCATIONS,
                display_name="Locations",
                description="Physical branch offices, facilities, service centers, and geographic coverage zones.",
                purpose="Ground geographic dispatch, branch address inquiries, and localized availability.",
                entity_types=["OFFICE", "WAREHOUSE", "BRANCH", "STORE"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["location_type", "city", "state", "country", "postal_code", "service_area"],
                fields=[
                    CanonicalFieldDefinition(
                        name="name",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Location identifier or branch name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="location_type",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Type of physical facility.",
                        allowed_values=["headquarters", "branch_office", "warehouse", "service_center", "retail_store", "remote_area"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="address_line_1",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Street address line 1.",
                    ),
                    CanonicalFieldDefinition(
                        name="address_line_2",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Suite, floor, or building unit.",
                    ),
                    CanonicalFieldDefinition(
                        name="city",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="City name.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="state",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="State or province.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="country",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Country name or ISO code.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="postal_code",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Postal or ZIP code.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="latitude",
                        field_type=AttributeValueType.DECIMAL,
                        is_required=False,
                        description="GPS latitude coordinate (-90 to +90).",
                        min_value=-90.0,
                        max_value=90.0,
                    ),
                    CanonicalFieldDefinition(
                        name="longitude",
                        field_type=AttributeValueType.DECIMAL,
                        is_required=False,
                        description="GPS longitude coordinate (-180 to +180).",
                        min_value=-180.0,
                        max_value=180.0,
                    ),
                    CanonicalFieldDefinition(
                        name="phone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Branch direct telephone.",
                        normalization="phone",
                    ),
                    CanonicalFieldDefinition(
                        name="email",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Branch local email.",
                        normalization="email",
                    ),
                    CanonicalFieldDefinition(
                        name="business_hours",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Operating hours for walk-ins or service.",
                    ),
                    CanonicalFieldDefinition(
                        name="service_area",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Operational radius or geographic regions covered.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="timezone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Local timezone identifier (e.g. 'Asia/Kolkata', 'America/New_York').",
                    ),
                ],
            )
        )

        # ---------------------------------------------------------------------
        # 9. brand_communication
        # ---------------------------------------------------------------------
        self._register(
            CategoryDefinition(
                category=KnowledgeCategory.BRAND_COMMUNICATION,
                display_name="Brand & Communication",
                description="Brand voice, communication persona, preferred terminology, and forbidden phrases.",
                purpose="Govern the tone and style of AI-generated responses.",
                entity_types=["VOICE_GUIDE", "MESSAGING", "STYLE_SHEET"],
                supports_temporal=False,
                supports_regional=True,
                retrieval_filter_fields=["voice"],
                fields=[
                    CanonicalFieldDefinition(
                        name="title",
                        field_type=AttributeValueType.STRING,
                        is_required=True,
                        description="Guideline document title.",
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="voice",
                        field_type=AttributeValueType.ENUM,
                        is_required=True,
                        description="Primary conversational voice persona.",
                        allowed_values=["professional", "friendly", "formal", "consultative", "casual", "empathetic"],
                        is_filter=True,
                    ),
                    CanonicalFieldDefinition(
                        name="tone",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Tone descriptors (e.g. 'Helpful, reassuring, direct').",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="style",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Narrative communication guidelines and rules.",
                        is_semantic=True,
                    ),
                    CanonicalFieldDefinition(
                        name="greeting_style",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Standardized email/message opening style.",
                    ),
                    CanonicalFieldDefinition(
                        name="closing_style",
                        field_type=AttributeValueType.STRING,
                        is_required=False,
                        description="Standardized sign-off / sign-out closing style.",
                    ),
                    CanonicalFieldDefinition(
                        name="language_preferences",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="Supported languages or dialect codes (e.g. ['en-US', 'en-IN']).",
                    ),
                    CanonicalFieldDefinition(
                        name="preferred_phrases",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="Recommended brand vocabulary to incorporate in responses.",
                    ),
                    CanonicalFieldDefinition(
                        name="do_not_say",
                        field_type=AttributeValueType.ARRAY,
                        is_required=False,
                        description="Forbidden or taboo terms that AI must strictly avoid.",
                    ),
                    CanonicalFieldDefinition(
                        name="example_responses",
                        field_type=AttributeValueType.TEXT,
                        is_required=False,
                        description="Few-shot exemplary responses illustrating ideal brand expression.",
                        is_semantic=True,
                    ),
                ],
            )
        )

    def _register(self, definition: CategoryDefinition):
        self._categories[definition.category.value] = definition

    def get(self, category: Union[str, KnowledgeCategory]) -> CategoryDefinition:
        """Retrieve category definition with sub-millisecond in-memory lookup."""
        key = category.value if isinstance(category, KnowledgeCategory) else normalize_category_key(category)
        if key not in self._categories:
            raise KnowledgeInvalidCategoryError(f"Category '{key}' is not registered.")
        return self._categories[key]

    def list_all(self) -> List[CategoryDefinition]:
        """Return all 9 registered category definitions."""
        return list(self._categories.values())

    def validate_record(
        self,
        category: Union[str, KnowledgeCategory],
        record: Dict[str, Any],
        custom_definitions: Optional[Dict[str, Any]] = None,
        strict_custom: bool = False,
    ) -> ValidationResult:
        """Convenience method to validate a record against the registry."""
        cat_def = self.get(category)
        return cat_def.validate_and_normalize(
            record=record,
            custom_definitions=custom_definitions,
            strict_custom=strict_custom,
        )


# Global singleton instance
category_registry = KnowledgeCategoryRegistry()


# =============================================================================
# API Request & Response Contracts (Pydantic V2)
# =============================================================================


class CustomAttributeCreateDTO(BaseModel):
    """Payload to define a new custom attribute for a category within a tenant."""

    key: str = Field(..., min_length=2, max_length=128, description="Normalized snake_case attribute key")
    display_name: str = Field(..., min_length=1, max_length=255, description="User-facing form label")
    value_type: str = Field(
        default=AttributeValueType.STRING.value,
        description="string | text | integer | decimal | boolean | date | datetime | currency | enum | array",
    )
    is_required: bool = Field(default=False, description="Whether the attribute is mandatory for this tenant")
    allowed_values: Optional[List[str]] = Field(default=None, description="Allowed enum values if value_type == enum")
    validation_regex: Optional[str] = Field(default=None, max_length=512, description="Optional regex constraint")
    description: Optional[str] = Field(default=None, max_length=512, description="Field help text")


class CustomAttributeResponseDTO(BaseModel):
    """Response descriptor for a tenant-scoped custom attribute definition."""

    id: str
    tenant_id: str
    category: str
    key: str
    display_name: str
    value_type: str
    is_required: bool
    allowed_values: Optional[List[str]] = None
    validation_regex: Optional[str] = None
    description: Optional[str] = None
    created_at: str


class ValidateRecordRequestDTO(BaseModel):
    """Payload to test or validate a record before creating a KnowledgeItem or importing."""

    category: str = Field(..., description="Target category key (snake_case or kebab-case)")
    data: Dict[str, Any] = Field(..., description="Record fields to validate")
    strict_custom: bool = Field(default=False, description="If true, reject custom attributes not defined for tenant")


class ValidateRecordResponseDTO(BaseModel):
    """Validation outcome report."""

    is_valid: bool
    category: str
    errors: List[str]
    cleaned_canonical_data: Dict[str, Any]
    cleaned_custom_attributes: Dict[str, Any]


class CategoryFieldSchemaDTO(BaseModel):
    name: str
    type: str
    required: bool
    description: str
    allowed_values: Optional[List[str]] = None
    is_semantic: bool
    is_filter: bool
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class CategorySummaryDTO(BaseModel):
    key: str
    display_name: str
    description: str
    purpose: str
    entity_types: List[str]
    supports_temporal: bool
    supports_regional: bool
    retrieval_filter_fields: List[str]
    fields: List[CategoryFieldSchemaDTO]

