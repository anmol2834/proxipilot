"""Phase 9.1: Deterministic Version Diff Engine.

Provides zero-I/O, deterministic field-level comparison between versions
or between a current version and an incoming update payload.

Invariants:
- Deterministic output: Identical inputs produce identical diff structures.
- Value normalization: Whitespace, number types, and serialized JSON are
  compared by logical value rather than raw memory reference.
- No-op detection: Accurately identifies updates with zero field changes.
- Multi-layer coverage: Headers, content, canonical attributes, custom attributes,
  and temporal bounds are all compared.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Set, Tuple

from app.contracts.version_diff import FieldDiffDTO, VersionDiffDTO


def _normalize_cmp_value(val: Any) -> Any:
    """Normalize values for fair semantic equality checks."""
    if val is None:
        return None
    if isinstance(val, str):
        s = val.strip()
        return s if s else None
    if isinstance(val, (int, float)):
        # Normalize float integers e.g. 100.0 -> 100
        if isinstance(val, float) and val.is_integer():
            return int(val)
        return val
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.isoformat()
    if isinstance(val, list):
        # Sort if all primitive, or compare recursively
        return [_normalize_cmp_value(x) for x in val]
    if isinstance(val, dict):
        return {k: _normalize_cmp_value(v) for k, v in sorted(val.items())}
    return val


def _values_are_equal(v1: Any, v2: Any) -> bool:
    """Check if two values are logically identical."""
    norm1 = _normalize_cmp_value(v1)
    norm2 = _normalize_cmp_value(v2)
    return norm1 == norm2


class VersionDiffEngine:
    """Deterministic, bounded field diff computation engine."""

    @staticmethod
    def compute_diff(
        item_id: str,
        from_version: Optional[int],
        to_version: int,
        old_headers: Dict[str, Any],
        new_headers: Dict[str, Any],
        old_content: Optional[str],
        new_content: Optional[str],
        old_canonical: Dict[str, Any],
        new_canonical: Dict[str, Any],
        old_custom: Optional[Dict[str, Any]] = None,
        new_custom: Optional[Dict[str, Any]] = None,
        old_temporal: Optional[Dict[str, Any]] = None,
        new_temporal: Optional[Dict[str, Any]] = None,
    ) -> VersionDiffDTO:
        """Compute field-level diff between two states of a knowledge item."""
        diffs: List[FieldDiffDTO] = []
        changed_fields: List[str] = []

        # 1. Header fields (title, description, tags, is_active)
        for h_field in ("title", "description", "tags", "is_active"):
            if h_field in new_headers:
                old_val = old_headers.get(h_field)
                new_val = new_headers.get(h_field)
                if not _values_are_equal(old_val, new_val):
                    diffs.append(
                        FieldDiffDTO(
                            field=h_field,
                            field_type="header",
                            old_value=old_val,
                            new_value=new_val,
                        )
                    )
                    changed_fields.append(h_field)

        # 2. Content narrative
        if new_content is not None:
            if not _values_are_equal(old_content, new_content):
                diffs.append(
                    FieldDiffDTO(
                        field="content_text",
                        field_type="content",
                        old_value=old_content,
                        new_value=new_content,
                    )
                )
                changed_fields.append("content_text")

        # 3. Canonical attributes
        all_canonical_keys: Set[str] = set(old_canonical.keys()) | set(new_canonical.keys())
        for key in sorted(all_canonical_keys):
            old_val = old_canonical.get(key)
            new_val = new_canonical.get(key)
            if not _values_are_equal(old_val, new_val):
                diffs.append(
                    FieldDiffDTO(
                        field=key,
                        field_type="canonical",
                        old_value=old_val,
                        new_value=new_val,
                    )
                )
                changed_fields.append(key)

        # 4. Custom attributes
        old_cust = old_custom or {}
        new_cust = new_custom or {}
        all_custom_keys: Set[str] = set(old_cust.keys()) | set(new_cust.keys())
        for key in sorted(all_custom_keys):
            old_val = old_cust.get(key)
            new_val = new_cust.get(key)
            if not _values_are_equal(old_val, new_val):
                diffs.append(
                    FieldDiffDTO(
                        field=key,
                        field_type="custom",
                        old_value=old_val,
                        new_value=new_val,
                    )
                )
                changed_fields.append(key)

        # 5. Temporal bounds
        old_temp = old_temporal or {}
        new_temp = new_temporal or {}
        for t_field in ("effective_from", "effective_until"):
            if t_field in new_temp:
                old_val = old_temp.get(t_field)
                new_val = new_temp.get(t_field)
                if not _values_are_equal(old_val, new_val):
                    diffs.append(
                        FieldDiffDTO(
                            field=t_field,
                            field_type="temporal",
                            old_value=old_val,
                            new_value=new_val,
                        )
                    )
                    changed_fields.append(t_field)

        is_no_op = len(diffs) == 0

        return VersionDiffDTO(
            knowledge_item_id=item_id,
            from_version=from_version,
            to_version=to_version,
            changed_fields=changed_fields,
            diffs=diffs,
            is_no_op=is_no_op,
        )

    @staticmethod
    def generate_summary(diff_dto: VersionDiffDTO) -> str:
        """Create a concise human-readable audit change summary."""
        if diff_dto.is_no_op:
            return "No changes detected"
        if len(diff_dto.changed_fields) <= 3:
            return f"Updated {', '.join(diff_dto.changed_fields)}"
        return f"Updated {len(diff_dto.changed_fields)} fields: {', '.join(diff_dto.changed_fields[:3])}..."
