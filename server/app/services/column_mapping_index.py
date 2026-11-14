"""Phase 8.3 — Precomputed Canonical & Custom Alias Index (O(1) Lookup).

Specification:
- Purpose: Index category canonical fields, category-scoped aliases, and tenant-scoped custom attributes.
- Complexity:
  - Construction: O(F_cat + A_cat + C_tenant) once per dataset mapping session.
  - Resolution: O(1) average dictionary lookup per column.
- Invariants:
  - Canonical fields strictly take precedence over custom attributes (Section 5).
  - Multi-tenant isolation: Only the requesting tenant's custom attributes are indexed (Section 4).
"""

from typing import Dict, List, Optional, Tuple
from app.contracts.flexible_schema import (
    CATEGORY_CANONICAL_ALIASES,
    sanitize_attribute_key,
)
from app.contracts.knowledge import (
    CanonicalFieldDefinition,
    CategoryDefinition,
    category_registry,
    normalize_category_key,
)
from app.models.knowledge import KnowledgeAttributeDefinition


class ColumnMappingIndex:
    """In-memory resolution index precompiled once per dataset mapping context."""

    def __init__(
        self,
        tenant_id: str,
        category: str,
        custom_attributes: Optional[List[KnowledgeAttributeDefinition]] = None,
    ) -> None:
        self.tenant_id = tenant_id
        self.category = normalize_category_key(category)
        self.cat_def: CategoryDefinition = category_registry.get(self.category)

        # 1. Canonical exact fields index: name -> CanonicalFieldDefinition
        self.canonical_fields: Dict[str, CanonicalFieldDefinition] = {
            k.lower(): v for k, v in self.cat_def.fields.items()
        }

        # 2. Canonical aliases index: normalized_alias -> CanonicalFieldDefinition
        self.alias_index: Dict[str, CanonicalFieldDefinition] = {}
        for (cat, alias), target_field_name in CATEGORY_CANONICAL_ALIASES.items():
            if cat == self.category and target_field_name.lower() in self.canonical_fields:
                self.alias_index[alias.lower()] = self.canonical_fields[target_field_name.lower()]

        # 3. Tenant custom attributes index (key & display_name)
        # Collision protection: a custom attribute can NEVER override a canonical field
        self.custom_key_index: Dict[str, KnowledgeAttributeDefinition] = {}
        self.custom_display_index: Dict[str, KnowledgeAttributeDefinition] = {}

        if custom_attributes:
            for attr in custom_attributes:
                # Verify strict tenant scoping
                if attr.tenant_id != self.tenant_id or attr.category != self.category:
                    continue

                try:
                    clean_key = sanitize_attribute_key(attr.key)
                    if clean_key not in self.canonical_fields:
                        self.custom_key_index[clean_key] = attr
                except ValueError:
                    pass

                if attr.display_name:
                    try:
                        clean_disp = sanitize_attribute_key(attr.display_name)
                        if clean_disp not in self.canonical_fields:
                            self.custom_display_index[clean_disp] = attr
                    except ValueError:
                        pass

    def get_canonical_by_exact_name(self, normalized_name: str) -> Optional[CanonicalFieldDefinition]:
        """O(1) lookup for exact canonical field match."""
        return self.canonical_fields.get(normalized_name.lower())

    def get_canonical_by_alias(self, normalized_name: str) -> Optional[CanonicalFieldDefinition]:
        """O(1) lookup for category-aware canonical alias match."""
        return self.alias_index.get(normalized_name.lower())

    def get_custom_attribute(self, normalized_name: str) -> Optional[KnowledgeAttributeDefinition]:
        """O(1) lookup for tenant custom attribute by key or display name."""
        name = normalized_name.lower()
        return self.custom_key_index.get(name) or self.custom_display_index.get(name)
