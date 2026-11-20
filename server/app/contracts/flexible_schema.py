"""Phase 7.2 — Flexible Schema & Typed Attribute Normalization Contracts.

Defines the enterprise normalization engine contracts:
- Category-aware canonical field alias registry (O(1) in-memory lookup)
- Controlled transformation pipeline (strictly no eval/exec)
- Safe type coercion, strict null semantics, and bounds enforcement
- Deterministic schema fingerprinting
- Immutable CompiledSchemaPlan for high-throughput batch normalization
- Structured error and warning reporting
- Pydantic DTOs for API endpoints
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
import hashlib
import json
import re
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, Field

from app.models.knowledge import AttributeValueType, KnowledgeCategory


# =============================================================================
# Domain Enums & Error Constants
# =============================================================================


class MappingTargetKind(str, Enum):
    """Classification target for an incoming source column."""

    CANONICAL = "canonical"                # Maps to frozen canonical category field
    CUSTOM_ATTRIBUTE = "custom_attribute"  # Maps to tenant-scoped custom attribute
    UNMAPPED = "unmapped"                  # Known neither to canonical nor tenant custom definitions
    IGNORED = "ignored"                    # Explicitly discarded by user/mapping rule


class TransformationOp(str, Enum):
    """Safe, controlled transformation operations (strictly no eval/exec)."""

    NONE = "none"
    TRIM = "trim"
    LOWERCASE = "lowercase"
    UPPERCASE = "uppercase"
    NORMALIZE_WHITESPACE = "normalize_whitespace"
    PARSE_INTEGER = "parse_integer"
    PARSE_DECIMAL = "parse_decimal"
    PARSE_DATE = "parse_date"
    PARSE_DATETIME = "parse_datetime"
    NORMALIZE_BOOLEAN = "normalize_boolean"
    NORMALIZE_EMAIL = "normalize_email"
    NORMALIZE_URL = "normalize_url"
    NORMALIZE_PHONE = "normalize_phone"
    SPLIT_ARRAY = "split_array"


class RowValidationSeverity(str, Enum):
    """Severity classification for normalization issues."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


# Validation error codes
ERR_MISSING_REQUIRED = "MISSING_REQUIRED_FIELD"
ERR_INVALID_DECIMAL = "INVALID_DECIMAL"
ERR_INVALID_INTEGER = "INVALID_INTEGER"
ERR_INVALID_BOOLEAN = "INVALID_BOOLEAN"
ERR_INVALID_DATE = "INVALID_DATE"
ERR_AMBIGUOUS_DATE = "AMBIGUOUS_DATE"
ERR_INVALID_EMAIL = "INVALID_EMAIL"
ERR_INVALID_URL = "INVALID_URL"
ERR_INVALID_ENUM = "INVALID_ENUM_VALUE"
ERR_INVALID_ARRAY = "INVALID_ARRAY"
ERR_ARRAY_SIZE_EXCEEDED = "ARRAY_SIZE_EXCEEDED"
ERR_OBJECT_DEPTH_EXCEEDED = "OBJECT_DEPTH_EXCEEDED"
ERR_OBJECT_KEYS_EXCEEDED = "OBJECT_KEYS_EXCEEDED"
ERR_STRING_LENGTH_EXCEEDED = "STRING_LENGTH_EXCEEDED"
ERR_INVALID_IDENTIFIER = "INVALID_IDENTIFIER"
ERR_MALICIOUS_INPUT = "MALICIOUS_INPUT_DETECTED"


# Limits & Guardrails
MAX_STRING_LENGTH = 4096
MAX_TEXT_LENGTH = 65536
MAX_ARRAY_ITEMS = 250
MAX_OBJECT_DEPTH = 3
MAX_OBJECT_KEYS = 50
MAX_SERIALIZED_OBJECT_SIZE = 16384  # 16 KB


# =============================================================================
# Regex & Identifier Validation
# =============================================================================

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_CLEAN_REGEX = re.compile(r"[\s\-\(\)\.]")
_ISO_CURRENCY_REGEX = re.compile(r"^[A-Z]{3}$")
_IDENTIFIER_REGEX = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
_URL_REGEX = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)
_CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def sanitize_attribute_key(key: str) -> str:
    """Normalize input column or attribute key to a safe, deterministic snake_case comparison key."""
    if not key or not isinstance(key, str):
        raise ValueError("Attribute key must be a non-empty string.")
    
    # Strip dangerous control characters
    cleaned = _CONTROL_CHAR_REGEX.sub("", key).strip()
    # Normalize separators (spaces, dashes, dots, camelCase boundary)
    cleaned = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", cleaned)
    cleaned = re.sub(r"[\s\-\.\/]+", "_", cleaned).lower()
    cleaned = re.sub(r"[^a-z0-9_]", "", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")

    if not cleaned:
        raise ValueError(f"Attribute key '{key}' contains no valid identifier characters.")
    if len(cleaned) > 64:
        cleaned = cleaned[:64].rstrip("_")
    return cleaned


def compute_schema_fingerprint(columns: List[str], category: str) -> str:
    """Compute a deterministic SHA-256 fingerprint for a dataset schema.
    
    Independent of row count or row data values.
    Two files with the same columns in any order produce the exact same fingerprint.
    """
    normalized_cols = sorted({sanitize_attribute_key(col) for col in columns if col and col.strip()})
    payload = f"cat:{category.strip().lower()}|cols:{','.join(normalized_cols)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# =============================================================================
# Category-Aware Canonical Field Alias Registry
# =============================================================================

# Contextual dictionary: (category, normalized_alias) -> canonical_field_name
# Precomputed for O(1) in-memory lookup
CATEGORY_CANONICAL_ALIASES: Dict[Tuple[str, str], str] = {
    # -------------------------------------------------------------------------
    # 1. products_services
    # -------------------------------------------------------------------------
    ("products_services", "name"): "name",
    ("products_services", "product_name"): "name",
    ("products_services", "product_title"): "name",
    ("products_services", "service_name"): "name",
    ("products_services", "service_title"): "name",
    ("products_services", "title"): "name",
    ("products_services", "item_name"): "name",
    ("products_services", "item_title"): "name",
    ("products_services", "package_name"): "name",

    ("products_services", "entity_type"): "entity_type",
    ("products_services", "type"): "entity_type",
    ("products_services", "service_type"): "entity_type",
    ("products_services", "item_type"): "entity_type",
    ("products_services", "offering_type"): "entity_type",

    ("products_services", "price"): "price",
    ("products_services", "cost"): "price",
    ("products_services", "mrp"): "price",
    ("products_services", "amount"): "price",
    ("products_services", "rate"): "price",
    ("products_services", "fee"): "price",
    ("products_services", "selling_price"): "price",
    ("products_services", "unit_price"): "price",
    ("products_services", "base_price"): "price",
    ("products_services", "price_inr"): "price",

    ("products_services", "commercial_price_type"): "commercial_price_type",
    ("products_services", "price_type"): "commercial_price_type",
    ("products_services", "pricing_type"): "commercial_price_type",
    ("products_services", "quote_type"): "commercial_price_type",

    ("products_services", "currency"): "currency",
    ("products_services", "curr"): "currency",
    ("products_services", "currency_code"): "currency",
    ("products_services", "iso_currency"): "currency",

    ("products_services", "sku"): "sku",
    ("products_services", "product_sku"): "sku",
    ("products_services", "item_sku"): "sku",
    ("products_services", "product_code"): "sku",
    ("products_services", "item_code"): "sku",
    ("products_services", "service_code"): "sku",
    ("products_services", "record_id"): "sku",
    ("products_services", "external_identity_key"): "sku",
    ("products_services", "part_number"): "sku",
    ("products_services", "model_number"): "sku",

    ("products_services", "availability"): "availability",
    ("products_services", "available"): "availability",
    ("products_services", "stock_status"): "availability",
    ("products_services", "in_stock"): "availability",
    ("products_services", "is_available"): "availability",

    ("products_services", "service_area"): "service_area",
    ("products_services", "coverage_area"): "service_area",
    ("products_services", "region"): "region",
    ("products_services", "city"): "region",
    ("products_services", "location"): "region",
    ("products_services", "area"): "region",
    ("products_services", "zone"): "region",
    ("products_services", "state"): "region",

    ("products_services", "description"): "description",
    ("products_services", "details"): "description",
    ("products_services", "summary"): "description",
    ("products_services", "product_description"): "description",
    ("products_services", "notes"): "description",

    ("products_services", "features"): "features",
    ("products_services", "feature_list"): "features",
    ("products_services", "highlights"): "features",
    ("products_services", "specifications"): "features",

    # -------------------------------------------------------------------------
    # 2. company_info
    # -------------------------------------------------------------------------
    ("company_info", "company_name"): "company_name",
    ("company_info", "name"): "company_name",
    ("company_info", "trade_name"): "company_name",
    ("company_info", "brand_name"): "company_name",
    ("company_info", "legal_name"): "legal_name",
    ("company_info", "organization_name"): "legal_name",
    ("company_info", "business_name"): "legal_name",
    ("company_info", "website"): "website",
    ("company_info", "primary_website"): "website",
    ("company_info", "url"): "website",
    ("company_info", "site"): "website",
    ("company_info", "description"): "description",
    ("company_info", "overview"): "description",
    ("company_info", "about"): "description",
    ("company_info", "tagline"): "description",
    ("company_info", "slogan"): "description",
    ("company_info", "founded_year"): "founded_year",
    ("company_info", "established"): "founded_year",
    ("company_info", "year_established"): "founded_year",
    ("company_info", "founded"): "founded_year",
    ("company_info", "headquarters"): "headquarters",
    ("company_info", "hq"): "headquarters",
    ("company_info", "office"): "headquarters",
    ("company_info", "location"): "headquarters",
    ("company_info", "email"): "email",
    ("company_info", "general_email"): "email",
    ("company_info", "phone"): "phone",
    ("company_info", "telephone"): "phone",
    ("company_info", "contact_number"): "phone",
    ("company_info", "support_email"): "support_email",
    ("company_info", "customer_support_email"): "support_email",
    ("company_info", "help_email"): "support_email",
    ("company_info", "sales_email"): "sales_email",
    ("company_info", "sales_desk"): "sales_email",
    ("company_info", "industry"): "industry",
    ("company_info", "company_size"): "company_size",
    ("company_info", "address"): "address",
    ("company_info", "office_address"): "address",
    ("company_info", "registered_address"): "address",
    ("company_info", "full_address"): "address",
    ("company_info", "business_address"): "address",
    ("company_info", "factory_address"): "address",
    ("company_info", "business_hours"): "business_hours",
    ("company_info", "working_hours"): "business_hours",
    ("company_info", "office_hours"): "business_hours",
    ("company_info", "operating_hours"): "business_hours",
    ("company_info", "timings"): "business_hours",

    # -------------------------------------------------------------------------
    # 3. policies
    # -------------------------------------------------------------------------
    ("policies", "policy_name"): "policy_name",
    ("policies", "title"): "policy_name",
    ("policies", "name"): "policy_name",
    ("policies", "policy_title"): "policy_name",
    ("policies", "policy_type"): "policy_type",
    ("policies", "type"): "policy_type",
    ("policies", "category"): "policy_type",
    ("policies", "details"): "details",
    ("policies", "policy_text"): "details",
    ("policies", "content"): "details",
    ("policies", "terms"): "details",
    ("policies", "text"): "details",
    ("policies", "policy_details"): "details",
    ("policies", "summary"): "summary",
    ("policies", "overview"): "summary",
    ("policies", "short_description"): "summary",
    ("policies", "scope"): "scope",
    ("policies", "product_scope"): "scope",
    ("policies", "service_scope"): "scope",
    ("policies", "applicability"): "applicability",
    ("policies", "prerequisites"): "applicability",
    ("policies", "eligibility"): "applicability",
    ("policies", "region"): "region",
    ("policies", "effective_from"): "effective_from",
    ("policies", "valid_from"): "effective_from",
    ("policies", "start_date"): "effective_from",
    ("policies", "effective_until"): "effective_until",
    ("policies", "valid_until"): "effective_until",
    ("policies", "end_date"): "effective_until",
    ("policies", "expiry_date"): "effective_until",

    # -------------------------------------------------------------------------
    # 4. support_faqs
    # -------------------------------------------------------------------------
    ("support_faqs", "question"): "question",
    ("support_faqs", "faq_question"): "question",
    ("support_faqs", "query"): "question",
    ("support_faqs", "issue"): "question",
    ("support_faqs", "problem"): "question",
    ("support_faqs", "answer"): "answer",
    ("support_faqs", "faq_answer"): "answer",
    ("support_faqs", "solution"): "answer",
    ("support_faqs", "resolution"): "answer",
    ("support_faqs", "steps"): "answer",
    ("support_faqs", "short_answer"): "short_answer",
    ("support_faqs", "quick_answer"): "short_answer",
    ("support_faqs", "category_tag"): "category_tag",
    ("support_faqs", "topic"): "category_tag",
    ("support_faqs", "tag"): "category_tag",
    ("support_faqs", "faq_category"): "category_tag",
    ("support_faqs", "related_service"): "related_service",
    ("support_faqs", "product"): "related_service",
    ("support_faqs", "model"): "related_service",
    ("support_faqs", "appliance"): "related_service",
    ("support_faqs", "audience"): "audience",
    ("support_faqs", "target_audience"): "audience",
    ("support_faqs", "region"): "region",

    # -------------------------------------------------------------------------
    # 5. offers_promotions
    # -------------------------------------------------------------------------
    ("offers_promotions", "offer_name"): "offer_name",
    ("offers_promotions", "title"): "offer_name",
    ("offers_promotions", "offer_title"): "offer_name",
    ("offers_promotions", "promo_name"): "offer_name",
    ("offers_promotions", "name"): "offer_name",
    ("offers_promotions", "campaign_name"): "offer_name",
    ("offers_promotions", "description"): "description",
    ("offers_promotions", "offer_type"): "offer_type",
    ("offers_promotions", "type"): "offer_type",
    ("offers_promotions", "discount_value"): "discount_value",
    ("offers_promotions", "cost"): "discount_value",
    ("offers_promotions", "discount"): "discount_value",
    ("offers_promotions", "discount_amount"): "discount_value",
    ("offers_promotions", "saving"): "discount_value",
    ("offers_promotions", "discount_type"): "discount_type",
    ("offers_promotions", "currency"): "currency",
    ("offers_promotions", "promo_code"): "promo_code",
    ("offers_promotions", "discount_code"): "promo_code",
    ("offers_promotions", "coupon_code"): "promo_code",
    ("offers_promotions", "coupon"): "promo_code",
    ("offers_promotions", "code"): "promo_code",
    ("offers_promotions", "applicable_products"): "applicable_products",
    ("offers_promotions", "applicable_services"): "applicable_services",
    ("offers_promotions", "customer_segment"): "customer_segment",
    ("offers_promotions", "start_at"): "start_at",
    ("offers_promotions", "start_date"): "start_at",
    ("offers_promotions", "valid_from"): "start_at",
    ("offers_promotions", "end_at"): "end_at",
    ("offers_promotions", "end_date"): "end_at",
    ("offers_promotions", "valid_until"): "end_at",
    ("offers_promotions", "expiry_date"): "end_at",
    ("offers_promotions", "terms"): "terms",
    ("offers_promotions", "terms_conditions"): "terms",
    ("offers_promotions", "conditions"): "terms",
    ("offers_promotions", "exclusions"): "terms",
    ("offers_promotions", "status"): "status",

    # -------------------------------------------------------------------------
    # 6. processes_timelines
    # -------------------------------------------------------------------------
    ("processes_timelines", "process_name"): "process_name",
    ("processes_timelines", "process"): "process_name",
    ("processes_timelines", "name"): "process_name",
    ("processes_timelines", "title"): "process_name",
    ("processes_timelines", "workflow"): "process_name",
    ("processes_timelines", "operation_name"): "process_name",
    ("processes_timelines", "procedure_name"): "process_name",
    ("processes_timelines", "stage"): "stage",
    ("processes_timelines", "phase"): "stage",
    ("processes_timelines", "step_type"): "stage",
    ("processes_timelines", "journey_stage"): "stage",
    ("processes_timelines", "trigger"): "trigger",
    ("processes_timelines", "starts_after"): "trigger",
    ("processes_timelines", "start_event"): "trigger",
    ("processes_timelines", "timeline"): "timeline",
    ("processes_timelines", "timelines"): "timeline",
    ("processes_timelines", "duration"): "timeline",
    ("processes_timelines", "lead_time"): "timeline",
    ("processes_timelines", "leadtime"): "timeline",
    ("processes_timelines", "turnaround"): "timeline",
    ("processes_timelines", "turnaround_time"): "timeline",
    ("processes_timelines", "tat"): "timeline",
    ("processes_timelines", "processing_time"): "timeline",
    ("processes_timelines", "confirmation_time"): "timeline",
    ("processes_timelines", "dispatch_time"): "timeline",
    ("processes_timelines", "delivery_time"): "timeline",
    ("processes_timelines", "time_taken"): "timeline",
    ("processes_timelines", "eta"): "timeline",
    ("processes_timelines", "sla"): "timeline",
    ("processes_timelines", "sla_target"): "timeline",
    ("processes_timelines", "completion_time"): "timeline",
    ("processes_timelines", "timeframe"): "timeline",
    ("processes_timelines", "time_frame"): "timeline",
    ("processes_timelines", "steps"): "steps",
    ("processes_timelines", "procedure"): "steps",
    ("processes_timelines", "instructions"): "steps",
    ("processes_timelines", "process_steps"): "steps",
    ("processes_timelines", "how_it_works"): "steps",
    ("processes_timelines", "workflow_steps"): "steps",
    ("processes_timelines", "description"): "description",
    ("processes_timelines", "overview"): "description",
    ("processes_timelines", "summary"): "description",
    ("processes_timelines", "details"): "description",
    ("processes_timelines", "conditions"): "conditions",
    ("processes_timelines", "exceptions"): "conditions",
    ("processes_timelines", "notes"): "conditions",
    ("processes_timelines", "remarks"): "conditions",
    ("processes_timelines", "terms"): "conditions",
    ("processes_timelines", "customer_action"): "customer_action",
    ("processes_timelines", "customer_requirements"): "customer_action",
    ("processes_timelines", "documents_required"): "customer_action",
    ("processes_timelines", "requirements"): "customer_action",
    ("processes_timelines", "prerequisites"): "customer_action",
    ("processes_timelines", "applies_to"): "applies_to",
    ("processes_timelines", "applicable_to"): "applies_to",
    ("processes_timelines", "product"): "applies_to",
    ("processes_timelines", "products"): "applies_to",
    ("processes_timelines", "order_type"): "applies_to",
    ("processes_timelines", "customer_type"): "applies_to",
    ("processes_timelines", "working_hours"): "working_hours",
    ("processes_timelines", "business_hours"): "working_hours",
    ("processes_timelines", "working_days"): "working_hours",
    ("processes_timelines", "operating_hours"): "working_hours",
    ("processes_timelines", "owner"): "owner",
    ("processes_timelines", "department"): "owner",
    ("processes_timelines", "team"): "owner",
    ("processes_timelines", "responsible_team"): "owner",
    ("processes_timelines", "region"): "region",
    ("processes_timelines", "location"): "region",
    ("processes_timelines", "territory"): "region",
    ("processes_timelines", "zone"): "region",
}


# Known ambiguous columns that should never be blindly auto-mapped
AMBIGUOUS_COLUMNS: Set[str] = {
    "value",
    "data",
    "info",
    "custom",
    "temp",
    "field",
    "col",
    "column",
    "misc",
    "extra",
    "other",
    "param",
    "attribute",
    "val",
    "prop",
    "property",
}


# =============================================================================
# Controlled Value Transformations & Coercions
# =============================================================================


def transform_trim(value: Any) -> Optional[str]:
    """Trim leading/trailing whitespace."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def transform_lowercase(value: Any) -> Optional[str]:
    """Trim and lowercase string."""
    s = transform_trim(value)
    return s.lower() if s else None


def transform_uppercase(value: Any) -> Optional[str]:
    """Trim and uppercase string."""
    s = transform_trim(value)
    return s.upper() if s else None


def transform_normalize_whitespace(value: Any) -> Optional[str]:
    """Normalize internal multiple spaces/newlines to single space."""
    s = transform_trim(value)
    if not s:
        return None
    return re.sub(r"\s+", " ", s)


def coerce_integer(value: Any) -> int:
    """Safely coerce value to integer with exact precision checking."""
    if value is None or value == "":
        raise ValueError("Cannot coerce empty value to integer.")
    if isinstance(value, bool):
        raise ValueError("Boolean cannot be coerced to integer.")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not value.is_integer():
            raise ValueError(f"Float '{value}' contains non-zero decimal part.")
        return int(value)
    if isinstance(value, Decimal):
        if value % 1 != 0:
            raise ValueError(f"Decimal '{value}' contains non-zero decimal part.")
        return int(value)
    
    # String parsing
    s = str(value).strip()
    # If contains decimal point, test if float is integer
    if "." in s:
        try:
            f = float(re.sub(r"[^\d\.\-]", "", s))
            if not f.is_integer():
                raise ValueError(f"String '{value}' contains decimal part, cannot coerce to integer.")
            return int(f)
        except ValueError:
            raise ValueError(f"Invalid integer representation: '{value}'")

    # Strip currency symbols and commas (e.g. "₹5,000" -> "5000")
    cleaned = re.sub(r"[^\d\-]", "", s)
    if not cleaned or cleaned == "-":
        raise ValueError(f"Invalid integer representation: '{value}'")
    try:
        return int(cleaned)
    except ValueError:
        raise ValueError(f"Invalid integer representation: '{value}'")


def coerce_decimal(value: Any) -> Decimal:
    """Safely parse value into an exact Decimal representation."""
    if value is None or value == "":
        raise ValueError("Cannot coerce empty value to decimal.")
    if isinstance(value, bool):
        raise ValueError("Boolean cannot be coerced to decimal.")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    
    s = str(value).strip()
    # Strip currency symbols, commas, and extraneous spaces (e.g. "₹9,999.50" -> "9999.50")
    cleaned = re.sub(r"[^\d\.\-]", "", s)
    if not cleaned or cleaned == "-" or cleaned == ".":
        raise ValueError(f"Invalid decimal representation: '{value}'")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        raise ValueError(f"Invalid decimal representation: '{value}'")


def coerce_boolean(value: Any) -> bool:
    """Coerce boolean strictly from recognized tokens."""
    if value is None or value == "":
        raise ValueError("Cannot coerce empty value to boolean.")
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"true", "1", "yes", "y", "t", "active", "enabled"}:
        return True
    if s in {"false", "0", "no", "n", "f", "inactive", "disabled"}:
        return False
    raise ValueError(f"Cannot coerce '{value}' to boolean. Supported tokens: true/false, yes/no, 1/0, active/inactive.")


def coerce_date(value: Any) -> date:
    """Parse strict ISO-8601 date (YYYY-MM-DD). Ambiguous dates trigger ValueError."""
    if value is None or value == "":
        raise ValueError("Cannot parse empty date.")
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    
    s = str(value).strip()
    # Reject ambiguous dates like "01/02/26"
    if "/" in s:
        raise ValueError(f"Ambiguous date format '{value}'. ProxiPilot requires ISO-8601 'YYYY-MM-DD'.")
    try:
        dt = date.fromisoformat(s)
        return dt
    except ValueError:
        raise ValueError(f"Invalid date format '{value}'. Expected ISO-8601 'YYYY-MM-DD'.")


def coerce_datetime(value: Any) -> datetime:
    """Parse strict ISO-8601 timezone-aware datetime. Ambiguous formats trigger ValueError."""
    if value is None or value == "":
        raise ValueError("Cannot parse empty datetime.")
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    
    s = str(value).strip()
    if "/" in s:
        raise ValueError(f"Ambiguous datetime format '{value}'. Expected ISO-8601 format.")
    try:
        iso_str = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        raise ValueError(f"Invalid datetime format '{value}'. Expected ISO-8601 (e.g. '2026-06-01T12:00:00Z').")


def coerce_array(value: Any, max_items: int = MAX_ARRAY_ITEMS) -> List[Any]:
    """Parse array from JSON string, comma-separated string, or existing list."""
    if value is None or value == "":
        return []
    if isinstance(value, list):
        if len(value) > max_items:
            raise ValueError(f"Array length {len(value)} exceeds maximum allowed limit ({max_items}).")
        return value
    
    s = str(value).strip()
    if s.startswith("[") and s.endswith("]"):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                if len(parsed) > max_items:
                    raise ValueError(f"Array length {len(parsed)} exceeds maximum allowed limit ({max_items}).")
                return parsed
        except json.JSONDecodeError:
            pass

    # Delimited string split (semicolon or comma)
    delimiter = ";" if ";" in s else ","
    items = [item.strip() for item in s.split(delimiter) if item.strip()]
    if len(items) > max_items:
        raise ValueError(f"Array item count {len(items)} exceeds maximum allowed limit ({max_items}).")
    return items


def validate_and_constrain_object(
    obj: Any,
    max_depth: int = MAX_OBJECT_DEPTH,
    max_keys: int = MAX_OBJECT_KEYS,
    current_depth: int = 1,
) -> Dict[str, Any]:
    """Validate that an object attribute does not violate depth or key limits (preventing unbounded document bloat)."""
    if obj is None:
        return {}
    if isinstance(obj, str):
        try:
            obj = json.loads(obj)
        except json.JSONDecodeError:
            raise ValueError("Malformed JSON object string.")
    
    if not isinstance(obj, dict):
        raise ValueError(f"Expected dictionary object, got {type(obj).__name__}.")
    
    if len(obj) > max_keys:
        raise ValueError(f"Object key count ({len(obj)}) exceeds maximum limit of {max_keys}.")
    
    if current_depth > max_depth:
        raise ValueError(f"Object nesting depth ({current_depth}) exceeds maximum limit of {max_depth}.")
    
    # Check serialized size
    serialized = json.dumps(obj)
    if len(serialized) > MAX_SERIALIZED_OBJECT_SIZE:
        raise ValueError(f"Serialized object size ({len(serialized)} bytes) exceeds limit ({MAX_SERIALIZED_OBJECT_SIZE} bytes).")
    
    sanitized: Dict[str, Any] = {}
    for k, v in obj.items():
        if not isinstance(k, str):
            raise ValueError("Object keys must be strings.")
        if isinstance(v, dict):
            sanitized[k] = validate_and_constrain_object(v, max_depth, max_keys, current_depth + 1)
        elif isinstance(v, (list, tuple)):
            if len(v) > MAX_ARRAY_ITEMS:
                raise ValueError(f"Nested array length {len(v)} exceeds limit.")
            sanitized[k] = list(v)
        else:
            sanitized[k] = v
            
    return sanitized


# =============================================================================
# Execution Plan Models (Immutable Dataclasses for $O(R \times F)$ Batch Processing)
# =============================================================================


@dataclass(frozen=True)
class FieldMapping:
    """User-approved or auto-detected mapping specification for one source column."""

    source_field: str
    normalized_source_field: str
    target_kind: MappingTargetKind
    target_field: Optional[str] = None
    target_type: Optional[str] = None
    transformation_op: TransformationOp = TransformationOp.NONE
    confidence: float = 1.0
    is_required: bool = False
    default_value: Optional[Any] = None
    allowed_values: Optional[List[str]] = None
    validation_regex: Optional[str] = None


@dataclass(frozen=True)
class CompiledFieldPlan:
    """Pre-bound execution specification for a mapped field in the compiled schema plan.
    
    Eliminates all dynamic lookups and dictionary scans inside the per-row processing loop.
    """

    source_field: str
    target_kind: MappingTargetKind
    target_field: str
    target_type: str
    transformation_op: TransformationOp
    is_required: bool
    default_value: Optional[Any]
    allowed_values: Optional[Set[str]]
    validation_regex: Optional[re.Pattern]
    min_value: Optional[float]
    max_value: Optional[float]


@dataclass(frozen=True)
class CompiledSchemaPlan:
    """Immutable compiled execution plan for high-throughput batch normalization.
    
    Compiled ONCE per dataset schema fingerprint.
    Rows are normalized against this in-memory plan with ZERO database roundtrips.
    """

    tenant_id: str
    category: str
    schema_fingerprint: str
    version: int
    source_columns: List[str]
    canonical_mappings: Dict[str, CompiledFieldPlan]   # target_field -> plan
    custom_mappings: Dict[str, CompiledFieldPlan]      # target_field -> plan
    source_to_plan: Dict[str, CompiledFieldPlan]       # source_field -> plan
    unmapped_columns: List[str]
    ignored_columns: List[str]
    required_canonical_missing: List[str]
    required_custom_missing: List[str]

    def is_executable(self) -> bool:
        """A plan is executable if all required canonical and custom fields are accounted for."""
        return len(self.required_canonical_missing) == 0 and len(self.required_custom_missing) == 0


@dataclass
class RowValidationError:
    """Structured, machine-readable validation error for a row field."""

    row_index: int
    field: str
    source_field: str
    error_code: str
    message: str
    value: Any
    severity: RowValidationSeverity = RowValidationSeverity.ERROR


@dataclass
class NormalizedRecordResult:
    """Output of single-row normalization."""

    row_index: int
    is_valid: bool
    canonical_data: Dict[str, Any]
    custom_attributes: Dict[str, Any]
    warnings: List[RowValidationError]
    errors: List[RowValidationError]


@dataclass
class BatchNormalizationResult:
    """Aggregated output of batch normalization over R rows."""

    total_rows: int
    valid_rows_count: int
    error_rows_count: int
    warning_rows_count: int
    normalized_records: List[NormalizedRecordResult]
    errors_summary: Dict[str, int]  # error_code -> count


# =============================================================================
# API Request & Response DTOs (Pydantic V2)
# =============================================================================


class SchemaDetectRequestDTO(BaseModel):
    """Payload to detect column mappings and confidence scores from source headers and samples."""

    category: str = Field(..., description="Target category key (e.g. 'products_services')")
    source_columns: List[str] = Field(..., description="Original dataset column headers")
    sample_rows: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional sample data rows (up to 10) to improve type detection",
    )


class FieldMappingDTO(BaseModel):
    """Mapping descriptor for a single column."""

    source_field: str
    normalized_source_field: str
    target_kind: str
    target_field: Optional[str] = None
    target_type: Optional[str] = None
    transformation_op: str = TransformationOp.NONE.value
    confidence: float
    is_required: bool = False
    default_value: Optional[Any] = None
    allowed_values: Optional[List[str]] = None


class SchemaDetectResponseDTO(BaseModel):
    """Result of schema detection and proposed mapping plan."""

    category: str
    schema_fingerprint: str
    field_mappings: List[FieldMappingDTO]
    unmapped_columns: List[str]
    missing_required_canonical: List[str]
    missing_required_custom: List[str]
    is_ready_to_compile: bool


class CompilePlanRequestDTO(BaseModel):
    """Payload to compile approved field mappings into an immutable plan."""

    category: str
    mappings: List[FieldMappingDTO]


class CompilePlanResponseDTO(BaseModel):
    """Summary of compiled schema plan."""

    tenant_id: str
    category: str
    schema_fingerprint: str
    is_executable: bool
    canonical_fields_count: int
    custom_attributes_count: int
    unmapped_count: int
    missing_required_canonical: List[str]
    missing_required_custom: List[str]


class NormalizePreviewRequestDTO(BaseModel):
    """Preview request to normalize up to 20 sample rows using an approved mapping."""

    category: str
    mappings: List[FieldMappingDTO]
    sample_rows: List[Dict[str, Any]] = Field(..., max_length=50)


class RowValidationErrorDTO(BaseModel):
    row_index: int
    field: str
    source_field: str
    error_code: str
    message: str
    severity: str


class NormalizedRecordPreviewDTO(BaseModel):
    row_index: int
    is_valid: bool
    canonical_data: Dict[str, Any]
    custom_attributes: Dict[str, Any]
    errors: List[RowValidationErrorDTO]
    warnings: List[RowValidationErrorDTO]


class NormalizePreviewResponseDTO(BaseModel):
    total_rows: int
    valid_rows_count: int
    error_rows_count: int
    records: List[NormalizedRecordPreviewDTO]


class SchemaProfileCreateDTO(BaseModel):
    """Payload to persist a reusable schema mapping profile."""

    category: str
    name: str = Field(..., min_length=2, max_length=255, description="Profile label (e.g. 'Vendor A Price Sheet')")
    source_type: str = Field(default="csv", description="csv | xlsx | api | connector")
    mappings: List[FieldMappingDTO]


class SchemaProfileResponseDTO(BaseModel):
    id: str
    tenant_id: str
    category: str
    name: str
    fingerprint: str
    source_type: str
    version: int
    is_active: bool
    mappings: List[FieldMappingDTO]
    created_at: str
