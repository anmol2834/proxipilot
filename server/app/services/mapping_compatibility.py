"""Phase 8.3 — Type & Sample Compatibility Evaluator.

Specification:
- Purpose: Cross-reference Phase 8.2 profiled types and samples against target canonical and custom attribute constraints.
- Prevents: Incompatible mapping assignments (e.g. mapping a DATE column to a DECIMAL price field).
- Output: Compatibility score modifier (0.0 to 1.0), recommended TransformationOp, and advisory validation notes.
"""

from dataclasses import dataclass
from typing import List, Optional, Set, Union
from app.algorithms.type_inference import DataType
from app.contracts.dataset_profile import ColumnProfileDTO
from app.contracts.flexible_schema import TransformationOp
from app.models.knowledge import AttributeValueType


@dataclass(frozen=True)
class CompatibilityEvaluation:
    """Outcome of verifying type and sample compatibility between source and target."""

    is_compatible: bool
    confidence_factor: float  # Multiplier between 0.0 and 1.0
    recommended_op: str
    advisory_note: Optional[str] = None


class MappingCompatibilityEvaluator:
    """Deterministic matrix verifying type compatibility and sample values."""

    # Explicit allowed mappings: target_type -> set of compatible source types
    _COMPATIBLE_TYPES = {
        AttributeValueType.STRING.value: {
            DataType.STRING.value,
            DataType.TEXT.value,
            DataType.INTEGER.value,
            DataType.DECIMAL.value,
            DataType.CURRENCY.value,
            DataType.BOOLEAN.value,
            DataType.DATE.value,
            DataType.DATETIME.value,
            DataType.EMAIL.value,
            DataType.URL.value,
            DataType.ENUM.value,
        },
        AttributeValueType.TEXT.value: {
            DataType.TEXT.value,
            DataType.STRING.value,
            DataType.DATE.value,
            DataType.DATETIME.value,
        },
        AttributeValueType.INTEGER.value: {
            DataType.INTEGER.value,
        },
        AttributeValueType.DECIMAL.value: {
            DataType.DECIMAL.value,
            DataType.INTEGER.value,
            DataType.CURRENCY.value,
        },
        AttributeValueType.CURRENCY.value: {
            DataType.CURRENCY.value,
            DataType.DECIMAL.value,
            DataType.INTEGER.value,
            DataType.STRING.value,
            DataType.ENUM.value,
        },
        AttributeValueType.BOOLEAN.value: {
            DataType.BOOLEAN.value,
        },
        AttributeValueType.DATE.value: {
            DataType.DATE.value,
            DataType.DATETIME.value,
        },
        AttributeValueType.DATETIME.value: {
            DataType.DATETIME.value,
            DataType.DATE.value,
        },
        AttributeValueType.ENUM.value: {
            DataType.ENUM.value,
            DataType.STRING.value,
        },
        AttributeValueType.ARRAY.value: {
            DataType.STRING.value,
            DataType.TEXT.value,
            "ARRAY",
        },
    }

    @classmethod
    def evaluate(
        cls,
        source_col: ColumnProfileDTO,
        target_type: str,
        allowed_values: Optional[List[str]] = None,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
    ) -> CompatibilityEvaluation:
        """Evaluate whether source column profile is compatible with target field specification."""
        clean_target_type = target_type.lower().strip()
        src_dominant = (source_col.dominant_type or "STRING").upper().strip()
        src_candidates = {t.upper().strip() for t in source_col.candidate_types}

        # 1. Check strict type matrix
        allowed_src_types = cls._COMPATIBLE_TYPES.get(clean_target_type, {DataType.STRING.value})

        # Special case: String source into Integer/Decimal target if candidate_types contains numeric
        if src_dominant in (DataType.STRING.value, DataType.TEXT.value):
            if clean_target_type in (AttributeValueType.INTEGER.value, AttributeValueType.DECIMAL.value):
                if DataType.INTEGER.value in src_candidates or DataType.DECIMAL.value in src_candidates:
                    # Coercion plausible
                    return CompatibilityEvaluation(
                        is_compatible=True,
                        confidence_factor=0.75,
                        recommended_op=(
                            TransformationOp.PARSE_INTEGER.value
                            if clean_target_type == AttributeValueType.INTEGER.value
                            else TransformationOp.PARSE_DECIMAL.value
                        ),
                        advisory_note=f"Column profiled as string; requires {clean_target_type} parsing in Phase 8.4.",
                    )
                else:
                    # Incompatible: pure string cannot map to numeric field
                    return CompatibilityEvaluation(
                        is_compatible=False,
                        confidence_factor=0.0,
                        recommended_op=TransformationOp.NONE.value,
                        advisory_note=f"Type mismatch: string column cannot populate numeric {clean_target_type} field.",
                    )

        if src_dominant not in allowed_src_types:
            return CompatibilityEvaluation(
                is_compatible=False,
                confidence_factor=0.0,
                recommended_op=TransformationOp.NONE.value,
                advisory_note=f"Type incompatibility: source {src_dominant} incompatible with target {clean_target_type}.",
            )

        # 2. ENUM allowed_values sample validation
        if allowed_values:
            target_set = {v.lower().strip() for v in allowed_values if v}
            samples = source_col.samples
            if samples:
                matching_samples = [s for s in samples if s.lower().strip() in target_set]
                match_ratio = len(matching_samples) / len(samples)

                if match_ratio == 1.0:
                    return CompatibilityEvaluation(
                        is_compatible=True,
                        confidence_factor=1.0,
                        recommended_op=TransformationOp.TRIM.value,
                        advisory_note="All observed sample values match target enum options.",
                    )
                elif match_ratio > 0.0:
                    return CompatibilityEvaluation(
                        is_compatible=True,
                        confidence_factor=0.85,
                        recommended_op=TransformationOp.TRIM.value,
                        advisory_note=f"Partial enum match: {len(matching_samples)}/{len(samples)} samples matched allowed values.",
                    )
                else:
                    # 0 samples matched allowed values!
                    return CompatibilityEvaluation(
                        is_compatible=False,
                        confidence_factor=0.3,
                        recommended_op=TransformationOp.TRIM.value,
                        advisory_note="None of the observed sample values matched allowed enum options.",
                    )

        # 3. Numeric bounds validation
        if min_value is not None or max_value is not None:
            if source_col.min_numeric is not None and min_value is not None and source_col.min_numeric < min_value:
                return CompatibilityEvaluation(
                    is_compatible=True,
                    confidence_factor=0.8,
                    recommended_op=TransformationOp.PARSE_DECIMAL.value,
                    advisory_note=f"Observed minimum ({source_col.min_numeric}) violates target min bound ({min_value}).",
                )
            if source_col.max_numeric is not None and max_value is not None and source_col.max_numeric > max_value:
                return CompatibilityEvaluation(
                    is_compatible=True,
                    confidence_factor=0.8,
                    recommended_op=TransformationOp.PARSE_DECIMAL.value,
                    advisory_note=f"Observed maximum ({source_col.max_numeric}) violates target max bound ({max_value}).",
                )

        # 4. Standard compatible resolution with recommended transformation operation
        rec_op = TransformationOp.TRIM.value
        if clean_target_type == AttributeValueType.INTEGER.value:
            rec_op = TransformationOp.PARSE_INTEGER.value
        elif clean_target_type == AttributeValueType.DECIMAL.value:
            rec_op = TransformationOp.PARSE_DECIMAL.value
        elif clean_target_type == AttributeValueType.CURRENCY.value:
            rec_op = TransformationOp.UPPERCASE.value
        elif clean_target_type == AttributeValueType.DATE.value:
            rec_op = TransformationOp.PARSE_DATE.value
        elif clean_target_type == AttributeValueType.DATETIME.value:
            rec_op = TransformationOp.PARSE_DATETIME.value
        elif clean_target_type == AttributeValueType.BOOLEAN.value:
            rec_op = TransformationOp.NORMALIZE_BOOLEAN.value

        return CompatibilityEvaluation(
            is_compatible=True,
            confidence_factor=1.0,
            recommended_op=rec_op,
        )
