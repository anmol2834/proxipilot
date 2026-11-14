"""Phase 7.2 — Flexible Schema & Typed Attribute Normalization Service.

Encapsulates:
- High-performance, category-aware field detection and alias resolution
- CompiledSchemaPlan creation and tenant-scoped in-memory cache
- High-speed row batch normalization (zero DB queries inside normalization loop)
- Strict tenant-scoped schema profile persistence and retrieval
- Collision prevention, strict null semantics, and error isolation
"""

from datetime import datetime, timezone
from decimal import Decimal
import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.flexible_schema import (
    AMBIGUOUS_COLUMNS,
    CATEGORY_CANONICAL_ALIASES,
    ERR_ARRAY_SIZE_EXCEEDED,
    ERR_INVALID_ARRAY,
    ERR_INVALID_BOOLEAN,
    ERR_INVALID_DATE,
    ERR_INVALID_DECIMAL,
    ERR_INVALID_EMAIL,
    ERR_INVALID_ENUM,
    ERR_INVALID_INTEGER,
    ERR_INVALID_URL,
    ERR_MALICIOUS_INPUT,
    ERR_MISSING_REQUIRED,
    ERR_OBJECT_DEPTH_EXCEEDED,
    ERR_OBJECT_KEYS_EXCEEDED,
    ERR_STRING_LENGTH_EXCEEDED,
    MAX_STRING_LENGTH,
    MAX_TEXT_LENGTH,
    BatchNormalizationResult,
    CompilePlanRequestDTO,
    CompilePlanResponseDTO,
    CompiledFieldPlan,
    CompiledSchemaPlan,
    FieldMapping,
    FieldMappingDTO,
    MappingTargetKind,
    NormalizedRecordPreviewDTO,
    NormalizedRecordResult,
    NormalizePreviewRequestDTO,
    NormalizePreviewResponseDTO,
    RowValidationError,
    RowValidationErrorDTO,
    RowValidationSeverity,
    SchemaDetectRequestDTO,
    SchemaDetectResponseDTO,
    SchemaProfileCreateDTO,
    SchemaProfileResponseDTO,
    TransformationOp,
    _EMAIL_REGEX,
    _IDENTIFIER_REGEX,
    _URL_REGEX,
    coerce_array,
    coerce_boolean,
    coerce_date,
    coerce_datetime,
    coerce_decimal,
    coerce_integer,
    compute_schema_fingerprint,
    sanitize_attribute_key,
    transform_lowercase,
    transform_normalize_whitespace,
    transform_trim,
    transform_uppercase,
    validate_and_constrain_object,
)
from app.contracts.knowledge import (
    AttributeValueType,
    KnowledgeInvalidCategoryError,
    category_registry,
    normalize_category_key,
)
from app.core.logging import logger
from app.models.audit import AuditAction
from app.models.knowledge import (
    KnowledgeAttributeDefinition,
    KnowledgeSchemaProfile,
)
from app.services.audit import audit_service


class FlexibleSchemaEngine:
    """Enterprise multi-tenant schema detection, mapping compiler, and batch normalization engine."""

    def __init__(self):
        # Tenant-aware compiled plan cache: (tenant_id, category, fingerprint) -> CompiledSchemaPlan
        self._plan_cache: Dict[Tuple[str, str, str], CompiledSchemaPlan] = {}

    # =========================================================================
    # 1. Schema Detection & Alias Resolution
    # =========================================================================

    def detect_schema(
        self,
        tenant_id: str,
        category_key: str,
        source_columns: List[str],
        custom_definitions: Dict[str, Any],
        sample_rows: Optional[List[Dict[str, Any]]] = None,
    ) -> SchemaDetectResponseDTO:
        """Inspect source dataset column headers and propose deterministic field mappings.
        
        Resolution hierarchy:
        1. Exact canonical field name in target category (Confidence 1.0)
        2. Category-aware canonical alias match in target category (Confidence 0.95)
        3. Tenant-scoped custom attribute key match (Confidence 0.90)
        4. Tenant-scoped custom attribute display_name match (Confidence 0.85)
        5. Ambiguous keywords -> UNMAPPED (Confidence 0.0)
        6. Unmatched -> UNMAPPED (Confidence 0.0)
        """
        canonical_category = normalize_category_key(category_key)
        cat_def = category_registry.get(canonical_category)
        canonical_fields = cat_def.fields

        field_mappings: List[FieldMappingDTO] = []
        unmapped_columns: List[str] = []
        mapped_canonical_targets: Set[str] = set()
        mapped_custom_targets: Set[str] = set()

        # Build custom attribute reverse index by display_name
        custom_display_map: Dict[str, Tuple[str, Any]] = {}
        for c_key, c_def in custom_definitions.items():
            disp = getattr(c_def, "display_name", None)
            if disp:
                try:
                    norm_disp = sanitize_attribute_key(disp)
                    custom_display_map[norm_disp] = (c_key, c_def)
                except ValueError:
                    pass

        for raw_col in source_columns:
            if not raw_col or not str(raw_col).strip():
                continue
            
            raw_str = str(raw_col).strip()
            try:
                norm_col = sanitize_attribute_key(raw_str)
            except ValueError:
                unmapped_columns.append(raw_str)
                field_mappings.append(
                    FieldMappingDTO(
                        source_field=raw_str,
                        normalized_source_field="",
                        target_kind=MappingTargetKind.UNMAPPED.value,
                        target_field=None,
                        target_type=None,
                        confidence=0.0,
                    )
                )
                continue

            # Check if ambiguous column
            if norm_col in AMBIGUOUS_COLUMNS:
                unmapped_columns.append(raw_str)
                field_mappings.append(
                    FieldMappingDTO(
                        source_field=raw_str,
                        normalized_source_field=norm_col,
                        target_kind=MappingTargetKind.UNMAPPED.value,
                        target_field=None,
                        target_type=None,
                        confidence=0.0,
                    )
                )
                continue

            # 1. Exact Canonical Match
            if norm_col in canonical_fields:
                c_field = canonical_fields[norm_col]
                mapped_canonical_targets.add(norm_col)
                field_mappings.append(
                    FieldMappingDTO(
                        source_field=raw_str,
                        normalized_source_field=norm_col,
                        target_kind=MappingTargetKind.CANONICAL.value,
                        target_field=c_field.name,
                        target_type=c_field.field_type.value,
                        transformation_op=TransformationOp.TRIM.value,
                        confidence=1.0,
                        is_required=c_field.is_required,
                        allowed_values=c_field.allowed_values,
                    )
                )
                continue

            # 2. Category-Aware Canonical Alias Match
            alias_key = (canonical_category, norm_col)
            if alias_key in CATEGORY_CANONICAL_ALIASES:
                target_canonical_name = CATEGORY_CANONICAL_ALIASES[alias_key]
                if target_canonical_name in canonical_fields:
                    c_field = canonical_fields[target_canonical_name]
                    mapped_canonical_targets.add(target_canonical_name)
                    field_mappings.append(
                        FieldMappingDTO(
                            source_field=raw_str,
                            normalized_source_field=norm_col,
                            target_kind=MappingTargetKind.CANONICAL.value,
                            target_field=c_field.name,
                            target_type=c_field.field_type.value,
                            transformation_op=TransformationOp.TRIM.value,
                            confidence=0.95,
                            is_required=c_field.is_required,
                            allowed_values=c_field.allowed_values,
                        )
                    )
                    continue

            # 3. Tenant-Scoped Custom Attribute Key Match
            if norm_col in custom_definitions:
                cust_def = custom_definitions[norm_col]
                mapped_custom_targets.add(norm_col)
                field_mappings.append(
                    FieldMappingDTO(
                        source_field=raw_str,
                        normalized_source_field=norm_col,
                        target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE.value,
                        target_field=norm_col,
                        target_type=getattr(cust_def, "value_type", AttributeValueType.STRING.value),
                        transformation_op=TransformationOp.TRIM.value,
                        confidence=0.90,
                        is_required=getattr(cust_def, "is_required", False),
                        allowed_values=getattr(cust_def, "allowed_values", None),
                    )
                )
                continue

            # 4. Tenant-Scoped Custom Attribute Display Name Match
            if norm_col in custom_display_map:
                c_key, cust_def = custom_display_map[norm_col]
                mapped_custom_targets.add(c_key)
                field_mappings.append(
                    FieldMappingDTO(
                        source_field=raw_str,
                        normalized_source_field=norm_col,
                        target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE.value,
                        target_field=c_key,
                        target_type=getattr(cust_def, "value_type", AttributeValueType.STRING.value),
                        transformation_op=TransformationOp.TRIM.value,
                        confidence=0.85,
                        is_required=getattr(cust_def, "is_required", False),
                        allowed_values=getattr(cust_def, "allowed_values", None),
                    )
                )
                continue

            # 5. Unmapped Column
            unmapped_columns.append(raw_str)
            field_mappings.append(
                FieldMappingDTO(
                    source_field=raw_str,
                    normalized_source_field=norm_col,
                    target_kind=MappingTargetKind.UNMAPPED.value,
                    target_field=None,
                    target_type=None,
                    confidence=0.0,
                )
            )

        # Check for missing required canonical fields
        missing_canonical: List[str] = [
            f.name
            for f in canonical_fields.values()
            if f.is_required and f.name not in mapped_canonical_targets
        ]

        # Check for missing required custom attributes
        missing_custom: List[str] = [
            k
            for k, c in custom_definitions.items()
            if getattr(c, "is_required", False) and k not in mapped_custom_targets
        ]

        fingerprint = compute_schema_fingerprint(source_columns, canonical_category)

        return SchemaDetectResponseDTO(
            category=canonical_category,
            schema_fingerprint=fingerprint,
            field_mappings=field_mappings,
            unmapped_columns=unmapped_columns,
            missing_required_canonical=missing_canonical,
            missing_required_custom=missing_custom,
            is_ready_to_compile=(len(missing_canonical) == 0 and len(missing_custom) == 0),
        )

    # =========================================================================
    # 2. Plan Compilation
    # =========================================================================

    def compile_plan(
        self,
        tenant_id: str,
        category_key: str,
        mappings: List[FieldMappingDTO],
        custom_definitions: Dict[str, Any],
        version: int = 1,
    ) -> CompiledSchemaPlan:
        """Compile approved mappings into an immutable, high-speed execution plan.
        
        Pre-binds all transformations, validators, regex patterns, and type coercers.
        Cache key: (tenant_id, category, fingerprint).
        """
        canonical_category = normalize_category_key(category_key)
        cat_def = category_registry.get(canonical_category)
        canonical_fields = cat_def.fields

        source_columns: List[str] = []
        canonical_mappings: Dict[str, CompiledFieldPlan] = {}
        custom_mappings: Dict[str, CompiledFieldPlan] = {}
        source_to_plan: Dict[str, CompiledFieldPlan] = {}
        unmapped_columns: List[str] = []
        ignored_columns: List[str] = []

        mapped_canonical_names: Set[str] = set()
        mapped_custom_keys: Set[str] = set()

        for m in mappings:
            src = m.source_field.strip()
            source_columns.append(src)

            if m.target_kind == MappingTargetKind.IGNORED.value:
                ignored_columns.append(src)
                continue

            if m.target_kind == MappingTargetKind.UNMAPPED.value or not m.target_field:
                # Zero Data Loss: promote unmapped column to dynamic custom attribute
                target_name = m.target_field.strip() if m.target_field else sanitize_attribute_key(src)
                if not target_name or target_name in canonical_fields:
                    target_name = f"attr_{sanitize_attribute_key(src)}"
                m.target_kind = MappingTargetKind.CUSTOM_ATTRIBUTE.value
            else:
                target_name = m.target_field.strip()

            trans_op = TransformationOp(m.transformation_op) if m.transformation_op in TransformationOp._value2member_map_ else TransformationOp.NONE

            # Canonical mapping
            if m.target_kind == MappingTargetKind.CANONICAL.value:
                if target_name not in canonical_fields:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Target canonical field '{target_name}' does not exist in category '{canonical_category}'.",
                    )
                c_field = canonical_fields[target_name]
                compiled_field = CompiledFieldPlan(
                    source_field=src,
                    target_kind=MappingTargetKind.CANONICAL,
                    target_field=target_name,
                    target_type=c_field.field_type.value,
                    transformation_op=trans_op,
                    is_required=c_field.is_required,
                    default_value=m.default_value,
                    allowed_values=set(c_field.allowed_values) if c_field.allowed_values else None,
                    validation_regex=re.compile(c_field.validation_regex) if c_field.validation_regex else None,
                    min_value=c_field.min_value,
                    max_value=c_field.max_value,
                )
                canonical_mappings[target_name] = compiled_field
                source_to_plan[src] = compiled_field
                mapped_canonical_names.add(target_name)

            # Custom Attribute mapping
            elif m.target_kind == MappingTargetKind.CUSTOM_ATTRIBUTE.value:
                # Collision protection: Custom attribute cannot shadow canonical field
                if target_name in canonical_fields:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Custom attribute '{target_name}' collides with canonical field in category '{canonical_category}'.",
                    )
                
                cust_def = custom_definitions.get(target_name)
                val_type = getattr(cust_def, "value_type", m.target_type or AttributeValueType.STRING.value)
                is_req = getattr(cust_def, "is_required", m.is_required)
                allowed = getattr(cust_def, "allowed_values", m.allowed_values)
                v_regex = getattr(cust_def, "validation_regex", None)

                compiled_field = CompiledFieldPlan(
                    source_field=src,
                    target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
                    target_field=target_name,
                    target_type=val_type,
                    transformation_op=trans_op,
                    is_required=is_req,
                    default_value=m.default_value,
                    allowed_values=set(allowed) if allowed else None,
                    validation_regex=re.compile(v_regex) if v_regex else None,
                    min_value=None,
                    max_value=None,
                )
                custom_mappings[target_name] = compiled_field
                source_to_plan[src] = compiled_field
                mapped_custom_keys.add(target_name)

        # Missing required canonical fields
        missing_canonical = [
            f.name
            for f in canonical_fields.values()
            if f.is_required and f.name not in mapped_canonical_names
        ]

        # Missing required custom attributes
        missing_custom = [
            k
            for k, c in custom_definitions.items()
            if getattr(c, "is_required", False) and k not in mapped_custom_keys
        ]

        fingerprint = compute_schema_fingerprint(source_columns, canonical_category)

        plan = CompiledSchemaPlan(
            tenant_id=tenant_id,
            category=canonical_category,
            schema_fingerprint=fingerprint,
            version=version,
            source_columns=source_columns,
            canonical_mappings=canonical_mappings,
            custom_mappings=custom_mappings,
            source_to_plan=source_to_plan,
            unmapped_columns=unmapped_columns,
            ignored_columns=ignored_columns,
            required_canonical_missing=missing_canonical,
            required_custom_missing=missing_custom,
        )

        # Store in tenant-aware memory cache
        cache_key = (tenant_id, canonical_category, fingerprint)
        self._plan_cache[cache_key] = plan

        return plan

    def get_cached_plan(self, tenant_id: str, category_key: str, fingerprint: str) -> Optional[CompiledSchemaPlan]:
        """Retrieve pre-compiled schema plan from in-memory cache."""
        return self._plan_cache.get((tenant_id, category_key, fingerprint))

    def invalidate_cache(self, tenant_id: str, category_key: Optional[str] = None):
        """Invalidate compiled plans when custom attribute definitions change."""
        keys_to_remove = [
            k
            for k in self._plan_cache.keys()
            if k[0] == tenant_id and (category_key is None or k[1] == category_key)
        ]
        for k in keys_to_remove:
            self._plan_cache.pop(k, None)

    # =========================================================================
    # 3. High-Speed Row & Batch Normalization ($O(R \times F)$ CPU Only)
    # =========================================================================

    def normalize_record(
        self,
        row: Dict[str, Any],
        plan: CompiledSchemaPlan,
        row_index: int = 0,
    ) -> NormalizedRecordResult:
        """Normalize a single data row against the compiled plan with fault isolation."""
        canonical_data: Dict[str, Any] = {}
        custom_attributes: Dict[str, Any] = {}
        errors: List[RowValidationError] = []
        warnings: List[RowValidationError] = []

        # 1. Process all mapped source columns
        for src_col, field_plan in plan.source_to_plan.items():
            raw_val = row.get(src_col)

            # Missing / Null handling
            if raw_val is None or raw_val == "":
                if field_plan.default_value is not None:
                    raw_val = field_plan.default_value
                elif field_plan.is_required:
                    errors.append(
                        RowValidationError(
                            row_index=row_index,
                            field=field_plan.target_field,
                            source_field=src_col,
                            error_code=ERR_MISSING_REQUIRED,
                            message=f"Mandatory field '{field_plan.target_field}' is missing or empty.",
                            value=raw_val,
                        )
                    )
                    continue
                else:
                    # Optional empty value: preserve null semantics, do not invent values
                    continue

            # Apply transformation
            try:
                val = self._apply_transformation(raw_val, field_plan.transformation_op)
            except Exception as e:
                errors.append(
                    RowValidationError(
                        row_index=row_index,
                        field=field_plan.target_field,
                        source_field=src_col,
                        error_code="TRANSFORMATION_FAILED",
                        message=f"Transformation error: {str(e)}",
                        value=raw_val,
                    )
                )
                continue

            if val is None or val == "":
                if field_plan.is_required:
                    errors.append(
                        RowValidationError(
                            row_index=row_index,
                            field=field_plan.target_field,
                            source_field=src_col,
                            error_code=ERR_MISSING_REQUIRED,
                            message=f"Field '{field_plan.target_field}' became empty after transformation.",
                            value=raw_val,
                        )
                    )
                continue

            # Type Coercion & Validation
            coerced_val, field_err = self._coerce_and_validate_field(val, field_plan, row_index, src_col)
            if field_err:
                errors.append(field_err)
                continue

            if field_plan.target_kind == MappingTargetKind.CANONICAL:
                canonical_data[field_plan.target_field] = coerced_val
            else:
                custom_attributes[field_plan.target_field] = coerced_val

        # 2. Check for missing required canonical fields in plan
        for req_can in plan.required_canonical_missing:
            errors.append(
                RowValidationError(
                    row_index=row_index,
                    field=req_can,
                    source_field="",
                    error_code=ERR_MISSING_REQUIRED,
                    message=f"Required canonical field '{req_can}' has no column mapped in dataset.",
                    value=None,
                )
            )

        # 3. Check for missing required custom fields in plan
        for req_cust in plan.required_custom_missing:
            errors.append(
                RowValidationError(
                    row_index=row_index,
                    field=req_cust,
                    source_field="",
                    error_code=ERR_MISSING_REQUIRED,
                    message=f"Required custom attribute '{req_cust}' has no column mapped in dataset.",
                    value=None,
                )
            )

        return NormalizedRecordResult(
            row_index=row_index,
            is_valid=(len(errors) == 0),
            canonical_data=canonical_data,
            custom_attributes=custom_attributes,
            warnings=warnings,
            errors=errors,
        )

    def normalize_batch(
        self,
        rows: List[Dict[str, Any]],
        plan: CompiledSchemaPlan,
        batch_size: int = 500,
    ) -> BatchNormalizationResult:
        """Batch-normalize a list of rows with memory bounding and aggregated diagnostics."""
        results: List[NormalizedRecordResult] = []
        valid_count = 0
        error_count = 0
        warning_count = 0
        error_summary: Dict[str, int] = {}

        for idx, row in enumerate(rows):
            res = self.normalize_record(row=row, plan=plan, row_index=idx)
            results.append(res)

            if res.is_valid:
                valid_count += 1
            else:
                error_count += 1
                for err in res.errors:
                    error_summary[err.error_code] = error_summary.get(err.error_code, 0) + 1

            if res.warnings:
                warning_count += len(res.warnings)

        return BatchNormalizationResult(
            total_rows=len(rows),
            valid_rows_count=valid_count,
            error_rows_count=error_count,
            warning_rows_count=warning_count,
            normalized_records=results,
            errors_summary=error_summary,
        )

    # =========================================================================
    # 4. Helper Transformations & Type Coercers
    # =========================================================================

    def _apply_transformation(self, value: Any, op: TransformationOp) -> Any:
        """Apply controlled transformation op without dynamic evaluation."""
        if op == TransformationOp.NONE:
            return value
        elif op == TransformationOp.TRIM:
            return transform_trim(value)
        elif op == TransformationOp.LOWERCASE:
            return transform_lowercase(value)
        elif op == TransformationOp.UPPERCASE:
            return transform_uppercase(value)
        elif op == TransformationOp.NORMALIZE_WHITESPACE:
            return transform_normalize_whitespace(value)
        elif op == TransformationOp.PARSE_INTEGER:
            return coerce_integer(value)
        elif op == TransformationOp.PARSE_DECIMAL:
            return coerce_decimal(value)
        elif op == TransformationOp.PARSE_DATE:
            return coerce_date(value)
        elif op == TransformationOp.PARSE_DATETIME:
            return coerce_datetime(value)
        elif op == TransformationOp.NORMALIZE_BOOLEAN:
            return coerce_boolean(value)
        elif op == TransformationOp.SPLIT_ARRAY:
            return coerce_array(value)
        return value

    def _coerce_and_validate_field(
        self,
        val: Any,
        plan: CompiledFieldPlan,
        row_index: int,
        source_field: str,
    ) -> Tuple[Any, Optional[RowValidationError]]:
        """Validate and coerce value to its target typed representation."""
        v_type = plan.target_type
        target_name = plan.target_field

        try:
            # String / Text
            if v_type in {AttributeValueType.STRING.value, "string"}:
                s = str(val).strip()
                if len(s) > MAX_STRING_LENGTH:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code=ERR_STRING_LENGTH_EXCEEDED,
                        message=f"String length exceeds maximum limit of {MAX_STRING_LENGTH} chars.",
                        value=s[:32] + "...",
                    )
                if plan.validation_regex and not plan.validation_regex.match(s):
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code="REGEX_MISMATCH",
                        message=f"Field '{target_name}' does not match required format.",
                        value=s,
                    )
                return s, None

            elif v_type in {AttributeValueType.TEXT.value, "text"}:
                s = str(val).strip()
                if len(s) > MAX_TEXT_LENGTH:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code=ERR_STRING_LENGTH_EXCEEDED,
                        message=f"Text length exceeds maximum limit of {MAX_TEXT_LENGTH} chars.",
                        value=s[:32] + "...",
                    )
                return s, None

            # Integer
            elif v_type in {AttributeValueType.INTEGER.value, "integer"}:
                num_int = coerce_integer(val)
                if plan.min_value is not None and num_int < plan.min_value:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code="RANGE_BELOW_MIN",
                        message=f"Value {num_int} is below minimum allowed {plan.min_value}.",
                        value=num_int,
                    )
                if plan.max_value is not None and num_int > plan.max_value:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code="RANGE_ABOVE_MAX",
                        message=f"Value {num_int} is above maximum allowed {plan.max_value}.",
                        value=num_int,
                    )
                return num_int, None

            # Decimal / Currency Amount
            elif v_type in {AttributeValueType.DECIMAL.value, "decimal", AttributeValueType.CURRENCY.value, "currency"}:
                num_dec = coerce_decimal(val)
                f_val = float(num_dec)
                if plan.min_value is not None and f_val < plan.min_value:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code="RANGE_BELOW_MIN",
                        message=f"Value {num_dec} is below minimum allowed {plan.min_value}.",
                        value=str(num_dec),
                    )
                if plan.max_value is not None and f_val > plan.max_value:
                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code="RANGE_ABOVE_MAX",
                        message=f"Value {num_dec} is above maximum allowed {plan.max_value}.",
                        value=str(num_dec),
                    )
                return float(num_dec), None

            # Boolean
            elif v_type in {AttributeValueType.BOOLEAN.value, "boolean"}:
                return coerce_boolean(val), None

            # Date
            elif v_type in {AttributeValueType.DATE.value, "date"}:
                d = coerce_date(val)
                return d.isoformat(), None

            # Datetime
            elif v_type in {AttributeValueType.DATETIME.value, "datetime"}:
                dt = coerce_datetime(val)
                return dt.isoformat(), None

            # Enum
            elif v_type in {AttributeValueType.ENUM.value, "enum"}:
                s = str(val).strip()
                if plan.allowed_values:
                    if s in plan.allowed_values:
                        return s, None
                    # Case-insensitive match (e.g. "product" -> "PRODUCT")
                    upper_match = next((opt for opt in plan.allowed_values if opt.upper() == s.upper()), None)
                    if upper_match:
                        return upper_match, None
                    lower_match = next((opt for opt in plan.allowed_values if opt.lower() == s.lower()), None)
                    if lower_match:
                        return lower_match, None

                    # Boolean token mapping for availability
                    s_lower = s.lower()
                    if s_lower in {"true", "1", "yes", "active"}:
                        for pref in ["in_stock", "available"]:
                            matched = next((opt for opt in plan.allowed_values if opt.lower() == pref), None)
                            if matched:
                                return matched, None
                    elif s_lower in {"false", "0", "no", "inactive"}:
                        for pref in ["out_of_stock", "unavailable", "discontinued"]:
                            matched = next((opt for opt in plan.allowed_values if opt.lower() == pref), None)
                            if matched:
                                return matched, None

                    return None, RowValidationError(
                        row_index=row_index,
                        field=target_name,
                        source_field=source_field,
                        error_code=ERR_INVALID_ENUM,
                        message=f"Value '{s}' is invalid. Allowed: {', '.join(sorted(plan.allowed_values))}.",
                        value=s,
                    )
                return s, None

            # Array
            elif v_type in {AttributeValueType.ARRAY.value, "array"}:
                arr = coerce_array(val)
                return arr, None

            # Bounded Object
            elif v_type in {"object"}:
                obj = validate_and_constrain_object(val)
                return obj, None

            # Fallback string
            return str(val).strip(), None

        except ValueError as ve:
            err_msg = str(ve)
            code = ERR_INVALID_DECIMAL if "decimal" in err_msg.lower() else (
                ERR_INVALID_INTEGER if "integer" in err_msg.lower() else (
                    ERR_INVALID_BOOLEAN if "boolean" in err_msg.lower() else (
                        ERR_INVALID_DATE if "date" in err_msg.lower() else "INVALID_VALUE"
                    )
                )
            )
            return None, RowValidationError(
                row_index=row_index,
                field=target_name,
                source_field=source_field,
                error_code=code,
                message=err_msg,
                value=val,
            )

    # =========================================================================
    # 5. Persistent Schema Profiles (Database Operations)
    # =========================================================================

    async def save_profile(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        payload: SchemaProfileCreateDTO,
    ) -> SchemaProfileResponseDTO:
        """Persist an approved schema mapping profile for future recurring ingestion."""
        canonical_category = normalize_category_key(payload.category)
        
        # Extract source columns and compute fingerprint
        source_cols = [m.source_field for m in payload.mappings]
        fingerprint = compute_schema_fingerprint(source_cols, canonical_category)

        # Check existing version
        stmt = (
            select(KnowledgeSchemaProfile)
            .where(
                KnowledgeSchemaProfile.tenant_id == tenant_id,
                KnowledgeSchemaProfile.category == canonical_category,
                KnowledgeSchemaProfile.fingerprint == fingerprint,
            )
            .order_by(KnowledgeSchemaProfile.version.desc())
        )
        res = await db.execute(stmt)
        existing = res.scalars().first()
        next_version = (existing.version + 1) if existing else 1

        mappings_serialized = json.dumps([m.model_dump() for m in payload.mappings])

        profile = KnowledgeSchemaProfile(
            tenant_id=tenant_id,
            category=canonical_category,
            fingerprint=fingerprint,
            name=payload.name.strip(),
            source_type=payload.source_type,
            mappings_json=mappings_serialized,
            version=next_version,
            is_active=True,
            created_by_user_id=user_id,
        )
        db.add(profile)

        try:
            await db.commit()
            await db.refresh(profile)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A schema profile with this version and fingerprint already exists.",
            )

        # Emit audit event
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_UPDATED,
            resource_type="knowledge_schema_profile",
            resource_id=profile.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "category": canonical_category,
                "name": profile.name,
                "fingerprint": fingerprint,
                "version": next_version,
            },
        )

        return SchemaProfileResponseDTO(
            id=profile.id,
            tenant_id=profile.tenant_id,
            category=profile.category,
            name=profile.name,
            fingerprint=profile.fingerprint,
            source_type=profile.source_type,
            version=profile.version,
            is_active=profile.is_active,
            mappings=payload.mappings,
            created_at=profile.created_at.isoformat() if profile.created_at else "",
        )

    async def list_profiles(
        self,
        db: AsyncSession,
        tenant_id: str,
        category_key: Optional[str] = None,
    ) -> List[SchemaProfileResponseDTO]:
        """List tenant-scoped schema mapping profiles."""
        stmt = select(KnowledgeSchemaProfile).where(
            KnowledgeSchemaProfile.tenant_id == tenant_id,
            KnowledgeSchemaProfile.is_active == True,
        )
        if category_key:
            canonical_cat = normalize_category_key(category_key)
            stmt = stmt.where(KnowledgeSchemaProfile.category == canonical_cat)
        
        stmt = stmt.order_by(KnowledgeSchemaProfile.created_at.desc())
        res = await db.execute(stmt)
        profiles = res.scalars().all()

        results: List[SchemaProfileResponseDTO] = []
        for p in profiles:
            raw_mappings = json.loads(p.mappings_json) if p.mappings_json else []
            dto_mappings = [FieldMappingDTO(**m) for m in raw_mappings]
            results.append(
                SchemaProfileResponseDTO(
                    id=p.id,
                    tenant_id=p.tenant_id,
                    category=p.category,
                    name=p.name,
                    fingerprint=p.fingerprint,
                    source_type=p.source_type,
                    version=p.version,
                    is_active=p.is_active,
                    mappings=dto_mappings,
                    created_at=p.created_at.isoformat() if p.created_at else "",
                )
            )
        return results

    async def get_profile(
        self,
        db: AsyncSession,
        tenant_id: str,
        profile_id: str,
    ) -> SchemaProfileResponseDTO:
        """Fetch a specific schema profile strictly within tenant boundary."""
        stmt = select(KnowledgeSchemaProfile).where(
            KnowledgeSchemaProfile.id == profile_id,
            KnowledgeSchemaProfile.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        profile = res.scalars().first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schema profile '{profile_id}' not found for this organization.",
            )

        raw_mappings = json.loads(profile.mappings_json) if profile.mappings_json else []
        dto_mappings = [FieldMappingDTO(**m) for m in raw_mappings]

        return SchemaProfileResponseDTO(
            id=profile.id,
            tenant_id=profile.tenant_id,
            category=profile.category,
            name=profile.name,
            fingerprint=profile.fingerprint,
            source_type=profile.source_type,
            version=profile.version,
            is_active=profile.is_active,
            mappings=dto_mappings,
            created_at=profile.created_at.isoformat() if profile.created_at else "",
        )


# Global singleton instance
flexible_schema_engine = FlexibleSchemaEngine()
