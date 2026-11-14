"""Phase 8.4 — Row Quality, Typed Normalization & Validation Service.

Processes raw dataset rows into clean, typed, and normalized canonical records
using the Phase 8.3 CompiledMappingPlan and Phase 7.1 Category Definitions.

Guarantees:
- Zero per-row database queries (all metadata compiled upfront)
- Null/empty semantic preservation (missing vs 0 vs false vs empty string)
- Structured machine-readable diagnostic error codes
- Category-aware constraint validation and typed coercion
"""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from app.contracts.column_mapping import CompiledMappingPlanDTO, MappingTargetKind
from app.contracts.data_quality import (
    NormalizedRecordDTO,
    QualityRowStatus,
    RowQualityErrorCode,
    RowQualityIssueDTO,
    RowQualitySeverity,
)
from app.contracts.knowledge import (
    AttributeValueType,
    CanonicalFieldDefinition,
    CategoryDefinition,
    category_registry,
)
from app.models.knowledge import KnowledgeAttributeDefinition
from app.algorithms.deduplication.category_identity import CategoryIdentityResolver
from app.services.deduplication_engine import DeduplicationEngine

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
_URL_REGEX = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)
_ISO_CURRENCY_REGEX = re.compile(r"^[A-Z]{3}$")
_PHONE_CLEAN_REGEX = re.compile(r"[^\d+]")


DEFAULT_CANONICAL_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "contacts": {"contact_type": "general"},
    "offers_promotions": {"offer_type": "percentage_discount"},
    "locations": {"location_type": "branch_office"},
    "brand_communication": {"voice": "professional"},
    "policies": {"policy_type": "general"},
}


class CompiledRowExtractor:
    """Precomputed header indexer for O(mapped fields) raw row extraction."""

    def __init__(self, headers: Sequence[str], mapping_plan: CompiledMappingPlanDTO):
        self.headers = list(headers)
        # column_index -> (target_kind, target_field, target_type, source_column)
        self.column_extractors: Dict[int, Tuple[MappingTargetKind, str, str, str]] = {}
        
        # Build mapping from source column name to plan column
        plan_cols: Dict[str, Any] = {}
        for c in mapping_plan.columns:
            plan_cols[c.source_column] = c
            plan_cols[c.normalized_column] = c

        for idx, h in enumerate(self.headers):
            h_clean = h.strip()
            h_norm = h_clean.lower().replace(" ", "_").replace("-", "_")
            
            mapping = plan_cols.get(h_clean) or plan_cols.get(h_norm)
            if mapping and mapping.target_field:
                if mapping.target_kind in (MappingTargetKind.CANONICAL_FIELD, MappingTargetKind.CUSTOM_ATTRIBUTE):
                    self.column_extractors[idx] = (
                        mapping.target_kind,
                        mapping.target_field,
                        mapping.target_type or "string",
                        mapping.source_column,
                    )


class RowQualityService:
    """Enterprise row validation, normalization, and quality grading service."""

    def __init__(
        self,
        tenant_id: str,
        category: str,
        mapping_plan: CompiledMappingPlanDTO,
        headers: Sequence[str],
        custom_attributes: Optional[List[KnowledgeAttributeDefinition]] = None,
        dedup_engine: Optional[DeduplicationEngine] = None,
    ):
        self.tenant_id = tenant_id
        self.category = category
        self.mapping_plan = mapping_plan
        self.cat_def: CategoryDefinition = category_registry.get(category)
        self.extractor = CompiledRowExtractor(headers, mapping_plan)
        
        # Tenant custom attribute definitions map: attr_key -> KnowledgeAttributeDefinition
        self.custom_defs: Dict[str, KnowledgeAttributeDefinition] = {
            attr.key: attr for attr in (custom_attributes or [])
        }
        
        # In-memory deduplication engine
        self.dedup_engine = dedup_engine or DeduplicationEngine(tenant_id, category)

        # Precompute required canonical fields for category
        self.required_canonical_fields: Set[str] = {
            f_name for f_name, f_def in self.cat_def.fields.items() if f_def.is_required
        }

        # Precompute required custom attributes for tenant
        self.required_custom_fields: Set[str] = {
            k for k, c_def in self.custom_defs.items() if getattr(c_def, "is_required", False)
        }

    @staticmethod
    def infer_products_services_entity_type(
        raw_canonical: Dict[str, Any],
        raw_custom: Dict[str, Any],
    ) -> str:
        """Deterministically infer entity type from structured source fields rather than defaulting to SERVICE.
        
        Inspects product_type, category, sub_category, and name before defaulting to PRODUCT.
        """
        # 1. Direct explicit product_type / type check
        ptype = str(raw_custom.get("product_type") or raw_custom.get("type") or "").strip().lower()
        if ptype:
            if any(term in ptype for term in ("spare", "part", "component")):
                return "PART"
            if any(term in ptype for term in ("raw", "material")):
                return "RAW_MATERIAL"
            if any(term in ptype for term in ("finish", "finished", "goods", "inventory", "hardware", "device")):
                return "PRODUCT"
            if any(term in ptype for term in ("accessory", "accessories")):
                return "ACCESSORY"
            if any(term in ptype for term in ("service", "maintenance", "repair", "labor", "consulting")):
                return "SERVICE"

        # 2. Check canonical entity_type if valid and non-default
        c_type = str(raw_canonical.get("entity_type") or "").strip().upper()
        if c_type in ("PART", "RAW_MATERIAL", "ACCESSORY", "PACKAGE", "PLAN", "PRODUCT"):
            return c_type

        # 3. Text inspection of sub_category, category, and name
        descriptive_candidates = [
            raw_canonical.get("sub_category"),
            raw_custom.get("category"),
            raw_canonical.get("name"),
        ]
        combined_text = " ".join(str(c).strip().lower() for c in descriptive_candidates if c is not None)

        if not combined_text:
            return "PRODUCT"

        # Check in order of specificity:
        # A. Spare Parts / Components
        if any(term in combined_text for term in ("spare part", "spare_part", "spares", "component", "nozzle", "pump", "heater", "valve", "cable", "screw", "spring", "filter", "key", "blade", "switch", "motor", "bracket")):
            return "PART"

        # B. Raw Materials
        if any(term in combined_text for term in ("raw material", "raw_material", "rawmaterial")):
            return "RAW_MATERIAL"

        # C. Accessories
        if any(term in combined_text for term in ("accessory", "accessories")):
            return "ACCESSORY"

        # D. Services / Labor / Maintenance
        if any(term in combined_text for term in ("maintenance", "service", "installation", "repair", "consulting", "subscription", "audit", "labor", "inspection")):
            return "SERVICE"

        # E. Packages / Plans
        if any(term in combined_text for term in ("package", "bundle", "combo")):
            return "PACKAGE"
        if any(term in combined_text for term in ("plan", "membership", "tier")):
            return "PLAN"

        # Default for commercial goods / catalog items in products_services
        return "PRODUCT"

    _infer_products_services_entity_type = infer_products_services_entity_type

    def process_row(self, row_number: int, row_values: Sequence[str]) -> NormalizedRecordDTO:
        """Process, normalize, validate, and deduplicate a single raw data row."""
        issues: List[RowQualityIssueDTO] = []
        raw_canonical: Dict[str, Any] = {}
        raw_custom: Dict[str, Any] = {}
        source_field_tracker: Dict[str, str] = {}
        normalized_canonical: Dict[str, Any] = {}

        # 1. Extract values using precompiled header index
        for col_idx, (target_kind, target_field, target_type, src_col) in self.extractor.column_extractors.items():
            if col_idx < len(row_values):
                val = row_values[col_idx]
                source_field_tracker[target_field] = src_col
                if target_kind == MappingTargetKind.CANONICAL_FIELD:
                    raw_canonical[target_field] = val
                elif target_kind == MappingTargetKind.CUSTOM_ATTRIBUTE:
                    raw_custom[target_field] = val

        # 2. Check Required Canonical Fields
        for req_field in self.required_canonical_fields:
            raw_val = raw_canonical.get(req_field)
            if raw_val is None or str(raw_val).strip() == "":
                # Dynamic category-level inference for products_services entity_type
                if self.category == "products_services" and req_field == "entity_type":
                    inferred_type = self._infer_products_services_entity_type(raw_canonical, raw_custom)
                    normalized_canonical[req_field] = inferred_type
                    continue

                # Check for category-level sensible fallback
                cat_defaults = DEFAULT_CANONICAL_DEFAULTS.get(self.category, {})
                if req_field in cat_defaults:
                    normalized_canonical[req_field] = cat_defaults[req_field]
                    continue

                issues.append(
                    RowQualityIssueDTO(
                        row_number=row_number,
                        field=req_field,
                        source_field=source_field_tracker.get(req_field),
                        error_code=RowQualityErrorCode.REQUIRED_FIELD_MISSING.value,
                        severity=RowQualitySeverity.ERROR.value,
                        message=f"Required canonical field '{req_field}' is missing or empty.",
                        invalid_value=None,
                    )
                )

        # 3. Check Required Custom Fields
        for req_custom in self.required_custom_fields:
            raw_val = raw_custom.get(req_custom)
            if raw_val is None or str(raw_val).strip() == "":
                issues.append(
                    RowQualityIssueDTO(
                        row_number=row_number,
                        field=req_custom,
                        source_field=source_field_tracker.get(req_custom),
                        error_code=RowQualityErrorCode.REQUIRED_FIELD_MISSING.value,
                        severity=RowQualitySeverity.ERROR.value,
                        message=f"Required custom attribute '{req_custom}' is missing or empty.",
                        invalid_value=None,
                    )
                )

        # 4. Normalize & Validate Canonical Fields
        for f_name, raw_val in raw_canonical.items():
            if raw_val is None or str(raw_val).strip() == "":
                continue  # Null / empty semantics: preserved as omitted / None

            f_def = self.cat_def.fields.get(f_name)
            if not f_def:
                continue

            norm_val, norm_issue = self._normalize_canonical_field(
                row_number=row_number,
                field_def=f_def,
                raw_val=str(raw_val),
                source_col=source_field_tracker.get(f_name),
            )
            if norm_issue:
                issues.append(norm_issue)
            elif norm_val is not None:
                normalized_canonical[f_name] = norm_val

        # 5. Normalize & Validate Custom Attributes
        normalized_custom: Dict[str, Any] = {}
        for attr_key, raw_val in raw_custom.items():
            if raw_val is None or str(raw_val).strip() == "":
                continue

            c_def = self.custom_defs.get(attr_key)
            norm_val, norm_issue = self._normalize_custom_attribute(
                row_number=row_number,
                attr_key=attr_key,
                c_def=c_def,
                raw_val=str(raw_val),
                source_col=source_field_tracker.get(attr_key),
            )
            if norm_issue:
                issues.append(norm_issue)
            elif norm_val is not None:
                normalized_custom[attr_key] = norm_val

        # 6. Deduplication & Conflict Detection
        identity_key = CategoryIdentityResolver.resolve_identity_key(
            tenant_id=self.tenant_id,
            category=self.category,
            canonical_data=normalized_canonical,
            custom_attributes=normalized_custom,
            row_number=row_number,
        )

        is_dup, is_conf, dup_row, conf_details = self.dedup_engine.evaluate_record(
            row_number=row_number,
            identity_key=identity_key,
            canonical_data=normalized_canonical,
            custom_attributes=normalized_custom,
        )

        # Same product code, DIFFERENT product name => two different products that were given
        # one code by mistake in the sheet (seen in real catalogues). Dropping the second row
        # silently lost a real product. Keep it under a stable code+name identity instead
        # (deterministic, so re-uploading the same sheet updates rather than duplicates it).
        if is_conf and conf_details and "name" in conf_details:
            name_tok = re.sub(r"\s+", " ", str(normalized_canonical.get("name") or "").strip().lower())
            if name_tok:
                alt_key = f"{identity_key}|name:{name_tok}"[:480]
                alt_dup, alt_conf, alt_row, alt_details = self.dedup_engine.evaluate_record(
                    row_number=row_number,
                    identity_key=alt_key,
                    canonical_data=normalized_canonical,
                    custom_attributes=normalized_custom,
                )
                issues.append(
                    RowQualityIssueDTO(
                        row_number=row_number,
                        field="identity",
                        source_field=None,
                        error_code=RowQualityErrorCode.CONFLICTING_DUPLICATE.value,
                        severity=RowQualitySeverity.INFO.value,
                        message=(f"Product code also used by row {dup_row} for a different product name; "
                                 f"kept as a separate product."),
                        invalid_value=str(normalized_canonical.get("sku") or identity_key)[:200],
                    )
                )
                identity_key = alt_key
                is_dup, is_conf, dup_row, conf_details = alt_dup, alt_conf, alt_row, alt_details

        if is_dup:
            issues.append(
                RowQualityIssueDTO(
                    row_number=row_number,
                    field="identity",
                    source_field=None,
                    error_code=RowQualityErrorCode.DUPLICATE_RECORD.value,
                    severity=RowQualitySeverity.WARNING.value,
                    message=f"Duplicate record matching identity of row {dup_row}.",
                    invalid_value=identity_key,
                )
            )
        elif is_conf:
            issues.append(
                RowQualityIssueDTO(
                    row_number=row_number,
                    field="identity",
                    source_field=None,
                    error_code=RowQualityErrorCode.CONFLICTING_DUPLICATE.value,
                    severity=RowQualitySeverity.WARNING.value,
                    message=f"Conflicting duplicate of row {dup_row}: field mismatches observed.",
                    invalid_value=str(conf_details),
                )
            )

        # 7. Final Quality Status Determination
        has_error = any(i.severity == RowQualitySeverity.ERROR.value for i in issues)
        has_warning = any(i.severity == RowQualitySeverity.WARNING.value for i in issues)

        if has_error:
            status = QualityRowStatus.INVALID
        elif has_warning:
            status = QualityRowStatus.WARNING
        else:
            status = QualityRowStatus.VALID

        return NormalizedRecordDTO(
            row_number=row_number,
            status=status,
            organization_id=self.tenant_id,
            category=self.category,
            identity_key=identity_key,
            canonical_data=normalized_canonical,
            custom_attributes=normalized_custom,
            issues=issues,
            is_duplicate=is_dup,
            duplicate_of_row=dup_row,
            is_conflict=is_conf,
            conflict_details=conf_details,
        )

    def _normalize_canonical_field(
        self,
        row_number: int,
        field_def: CanonicalFieldDefinition,
        raw_val: str,
        source_col: Optional[str],
    ) -> Tuple[Any, Optional[RowQualityIssueDTO]]:
        """Normalize canonical value according to CanonicalFieldDefinition."""
        cleaned = raw_val.strip()
        f_type = field_def.field_type

        # Email normalization
        if field_def.normalization == "email":
            lowered = cleaned.lower()
            if not _EMAIL_REGEX.match(lowered):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_EMAIL.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Email address '{cleaned}' does not match standard RFC format.",
                    invalid_value=cleaned,
                )
            return lowered, None

        # Phone normalization
        if field_def.normalization == "phone":
            cleaned_phone = _PHONE_CLEAN_REGEX.sub("", cleaned)
            return cleaned_phone, None

        # Currency code (ISO-4217)
        if field_def.normalization == "currency":
            curr_code = cleaned.upper()
            if not _ISO_CURRENCY_REGEX.match(curr_code):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_CURRENCY.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Currency '{cleaned}' is not a valid 3-letter ISO-4217 code (e.g. USD, INR).",
                    invalid_value=cleaned,
                )
            return curr_code, None

        # String / Text
        if f_type in (AttributeValueType.STRING, AttributeValueType.TEXT):
            if field_def.validation_regex and not re.match(field_def.validation_regex, cleaned):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.REGEX_MISMATCH.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value '{cleaned}' does not match required pattern.",
                    invalid_value=cleaned,
                )
            # Check length if max_value specified as length limit
            if field_def.max_value and len(cleaned) > field_def.max_value:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.OUT_OF_BOUNDS.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"String length ({len(cleaned)}) exceeds maximum allowed ({int(field_def.max_value)}).",
                    invalid_value=cleaned,
                )
            return cleaned, None

        # Decimal / Currency Amount
        elif f_type in (AttributeValueType.DECIMAL, AttributeValueType.CURRENCY):
            # Clean commas and currency symbols
            s_num = re.sub(r"[^\d.\-]", "", cleaned)
            try:
                d_val = Decimal(s_num).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                val_float = float(d_val)
            except (InvalidOperation, ValueError, TypeError):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_DECIMAL.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Cannot parse '{cleaned}' as a valid decimal number.",
                    invalid_value=cleaned,
                )
            # Bounds check
            if field_def.min_value is not None and val_float < field_def.min_value:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.OUT_OF_BOUNDS.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value {val_float} is less than minimum allowed ({field_def.min_value}).",
                    invalid_value=str(val_float),
                )
            if field_def.max_value is not None and val_float > field_def.max_value:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.OUT_OF_BOUNDS.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value {val_float} is greater than maximum allowed ({field_def.max_value}).",
                    invalid_value=str(val_float),
                )
            return val_float, None

        # Integer
        elif f_type == AttributeValueType.INTEGER:
            s_num = re.sub(r"[^\d\-]", "", cleaned)
            try:
                val_int = int(s_num)
            except (ValueError, TypeError):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_INTEGER.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Cannot parse '{cleaned}' as a valid integer.",
                    invalid_value=cleaned,
                )
            if field_def.min_value is not None and val_int < field_def.min_value:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.OUT_OF_BOUNDS.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value {val_int} is less than minimum ({int(field_def.min_value)}).",
                    invalid_value=str(val_int),
                )
            if field_def.max_value is not None and val_int > field_def.max_value:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.OUT_OF_BOUNDS.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value {val_int} is greater than maximum ({int(field_def.max_value)}).",
                    invalid_value=str(val_int),
                )
            return val_int, None

        # Currency code (ISO-4217)
        elif field_def.normalization == "currency":
            curr_code = cleaned.upper()
            if not _ISO_CURRENCY_REGEX.match(curr_code):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_CURRENCY.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Currency '{cleaned}' is not a valid 3-letter ISO-4217 code (e.g. USD, INR).",
                    invalid_value=cleaned,
                )
            return curr_code, None

        # Boolean
        elif f_type == AttributeValueType.BOOLEAN or field_def.normalization == "boolean":
            lowered = cleaned.lower()
            if lowered in {"true", "1", "yes", "y", "t", "active", "available"}:
                return True, None
            if lowered in {"false", "0", "no", "n", "f", "inactive", "disabled"}:
                return False, None
            return None, RowQualityIssueDTO(
                row_number=row_number,
                field=field_def.name,
                source_field=source_col,
                error_code=RowQualityErrorCode.INVALID_BOOLEAN.value,
                severity=RowQualitySeverity.ERROR.value,
                message=f"Cannot parse '{cleaned}' as a boolean value.",
                invalid_value=cleaned,
            )

        # Enum
        elif f_type == AttributeValueType.ENUM:
            lowered = cleaned.lower().replace(" ", "_").replace("-", "_")
            allowed = field_def.allowed_values or []
            # Match case-insensitively against allowed values
            for opt in allowed:
                if lowered == opt.lower():
                    return opt, None

            # Common commercial synonym normalizations for entity_type
            if field_def.name == "entity_type":
                if lowered in ("finish_goods", "finished_goods", "goods", "item", "hardware", "product"):
                    return "PRODUCT", None
                if lowered in ("spare_parts", "spare_part", "part", "component", "spares"):
                    return "PART", None
                if lowered in ("raw_material", "raw_materials", "rawmaterial"):
                    return "RAW_MATERIAL", None
                if lowered in ("accessories", "accessory"):
                    return "ACCESSORY", None
                if lowered in ("services", "service", "labor", "maintenance", "repair", "installation"):
                    return "SERVICE", None
                if lowered in ("packages", "package", "bundle"):
                    return "PACKAGE", None
                if lowered in ("plans", "plan"):
                    return "PLAN", None

            return None, RowQualityIssueDTO(
                row_number=row_number,
                field=field_def.name,
                source_field=source_col,
                error_code=RowQualityErrorCode.INVALID_ENUM.value,
                severity=RowQualitySeverity.ERROR.value,
                message=f"Value '{cleaned}' is not a valid enum option. Allowed: {', '.join(allowed)}",
                invalid_value=cleaned,
            )

        # Email
        elif field_def.normalization == "email":
            lowered = cleaned.lower()
            if not _EMAIL_REGEX.match(lowered):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_EMAIL.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Email address '{cleaned}' does not match standard RFC format.",
                    invalid_value=cleaned,
                )
            return lowered, None

        # Date / Datetime
        elif f_type in (AttributeValueType.DATE, AttributeValueType.DATETIME):
            # Attempt parsing ISO formats
            try:
                clean_iso = cleaned.replace("Z", "+00:00").replace("/", "-")
                dt = datetime.fromisoformat(clean_iso)
                return (dt.date().isoformat() if f_type == AttributeValueType.DATE else dt.isoformat()), None
            except ValueError:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=field_def.name,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_DATE.value if f_type == AttributeValueType.DATE else RowQualityErrorCode.INVALID_DATETIME.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Cannot parse '{cleaned}' as a valid ISO date/datetime.",
                    invalid_value=cleaned,
                )

        # Array
        elif f_type == AttributeValueType.ARRAY or field_def.normalization == "array":
            items = [item.strip() for item in cleaned.split(",") if item.strip()]
            return items, None

        # Fallback
        return cleaned, None

    def _normalize_custom_attribute(
        self,
        row_number: int,
        attr_key: str,
        c_def: Optional[KnowledgeAttributeDefinition],
        raw_val: str,
        source_col: Optional[str],
    ) -> Tuple[Any, Optional[RowQualityIssueDTO]]:
        """Normalize tenant-defined custom attribute value."""
        cleaned = raw_val.strip()
        if not c_def:
            # Permissive string if no strict definition
            return cleaned, None

        v_type = (c_def.value_type or "string").lower()

        if v_type in ("string", "text"):
            return cleaned, None

        elif v_type in ("decimal", "currency"):
            s_num = re.sub(r"[^\d.\-]", "", cleaned)
            try:
                d_val = Decimal(s_num).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                return float(d_val), None
            except (InvalidOperation, ValueError, TypeError):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=attr_key,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_DECIMAL.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Custom attribute '{attr_key}' requires decimal, got '{cleaned}'.",
                    invalid_value=cleaned,
                )

        elif v_type == "integer":
            s_num = re.sub(r"[^\d\-]", "", cleaned)
            try:
                return int(s_num), None
            except (ValueError, TypeError):
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=attr_key,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_INTEGER.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Custom attribute '{attr_key}' requires integer, got '{cleaned}'.",
                    invalid_value=cleaned,
                )

        elif v_type == "boolean":
            lowered = cleaned.lower()
            if lowered in {"true", "1", "yes", "y", "t"}:
                return True, None
            if lowered in {"false", "0", "no", "n", "f"}:
                return False, None
            return None, RowQualityIssueDTO(
                row_number=row_number,
                field=attr_key,
                source_field=source_col,
                error_code=RowQualityErrorCode.INVALID_BOOLEAN.value,
                severity=RowQualitySeverity.ERROR.value,
                message=f"Custom attribute '{attr_key}' requires boolean, got '{cleaned}'.",
                invalid_value=cleaned,
            )

        elif v_type == "enum":
            lowered = cleaned.lower().replace(" ", "_")
            allowed = []
            if hasattr(c_def, "allowed_values") and c_def.allowed_values:
                allowed = [opt.lower() for opt in c_def.allowed_values]
            elif hasattr(c_def, "allowed_values_json") and c_def.allowed_values_json:
                import json
                try:
                    raw_opts = json.loads(c_def.allowed_values_json)
                    allowed = [opt.lower() for opt in raw_opts]
                except Exception:
                    pass
            if allowed and lowered not in allowed:
                return None, RowQualityIssueDTO(
                    row_number=row_number,
                    field=attr_key,
                    source_field=source_col,
                    error_code=RowQualityErrorCode.INVALID_ENUM.value,
                    severity=RowQualitySeverity.ERROR.value,
                    message=f"Value '{cleaned}' not in allowed options: {', '.join(allowed)}",
                    invalid_value=cleaned,
                )
            return cleaned, None

        return cleaned, None
