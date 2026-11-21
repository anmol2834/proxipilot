"""In-Memory Category-Aware Deduplication Engine (Phase 8.4).

Maintains an indexed hash map of seen canonical records for the active dataset,
distinguishing between:
1. First-seen unique records (O(1) insertion)
2. Compatible duplicates (identical attributes or non-conflicting subset)
3. Conflicting duplicates (differing attribute values, e.g. price $999 vs $1499)

Complexity:
- Average Lookup / Insertion: O(1)
- Record Comparison: O(F) where F is the number of mapped fields
- Overall Dataset: O(N) for N rows
- Space: O(U * F) where U is the count of unique records
"""

from app.algorithms.deduplication.category_identity import EMPTY_FINGERPRINT, _is_positional_key
from typing import Any, Dict, Optional, Tuple


def _are_values_equivalent(val1: Any, val2: Any) -> bool:
    """Compare two normalized field values for semantic equivalence."""
    if val1 is None and val2 is None:
        return True
    if val1 is None or val2 is None:
        return False

    # Numeric comparison with floating point tolerance
    if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
        return abs(float(val1) - float(val2)) < 1e-6

    # String comparison normalized
    if isinstance(val1, str) and isinstance(val2, str):
        return val1.strip().lower() == val2.strip().lower()

    # Generic equality
    return val1 == val2


class DeduplicationEngine:
    """In-memory dataset duplicate tracking and conflict detection."""

    def __init__(self, tenant_id: str, category: str):
        self.tenant_id = tenant_id
        self.category = category
        # identity_key -> (first_row_num, canonical_data, custom_attributes)
        self._seen: Dict[str, Tuple[int, Dict[str, Any], Dict[str, Any]]] = {}

    def evaluate_record(
        self,
        row_number: int,
        identity_key: str,
        canonical_data: Dict[str, Any],
        custom_attributes: Dict[str, Any],
    ) -> Tuple[bool, bool, Optional[int], Optional[Dict[str, Any]]]:
        """Evaluate a normalized record against previously observed records in this dataset.

        Returns:
            Tuple of:
            - is_duplicate (bool): True if compatible duplicate
            - is_conflict (bool): True if conflicting duplicate
            - duplicate_of_row (Optional[int]): Row number of first occurrence
            - conflict_details (Optional[Dict[str, Any]]): Field-level discrepancy report
        """
        # Rows with no content at all have nothing to compare (they are rejected by validation).
        # Content-fingerprint keys DO take part: two rows with identical content are one record.
        if identity_key.endswith(EMPTY_FINGERPRINT) or (
            "row:" in identity_key and ("unnamed" in identity_key or f"row:{row_number}" in identity_key)
        ):
            return False, False, None, None

        if identity_key not in self._seen:
            # First time seeing this identity
            self._seen[identity_key] = (row_number, canonical_data, custom_attributes)
            return False, False, None, None

        # Existing record found
        first_row, first_canon, first_custom = self._seen[identity_key]

        conflicts: Dict[str, Any] = {}

        # Check canonical fields for conflicts. Positional columns (S.No, Sr, #, index ...) differ on
        # every row by definition: they never make two copies of the same record "conflicting".
        all_canon_keys = {k for k in set(canonical_data.keys()) | set(first_canon.keys()) if not _is_positional_key(k)}
        for k in all_canon_keys:
            v_curr = canonical_data.get(k)
            v_orig = first_canon.get(k)
            if v_curr is not None and v_orig is not None:
                if not _are_values_equivalent(v_curr, v_orig):
                    conflicts[k] = {"original": v_orig, "current": v_curr}

        # Check custom attributes for conflicts
        all_custom_keys = {k for k in set(custom_attributes.keys()) | set(first_custom.keys()) if not _is_positional_key(k)}
        for k in all_custom_keys:
            v_curr = custom_attributes.get(k)
            v_orig = first_custom.get(k)
            if v_curr is not None and v_orig is not None:
                if not _are_values_equivalent(v_curr, v_orig):
                    conflicts[f"custom:{k}"] = {"original": v_orig, "current": v_curr}

        if conflicts:
            return False, True, first_row, conflicts

        # Compatible duplicate (identical fields or no contradiction)
        return True, False, first_row, None

    def clear(self) -> None:
        """Clear indexed records."""
        self._seen.clear()

    @property
    def unique_count(self) -> int:
        return len(self._seen)
