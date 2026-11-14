"""Retrieval Capability Catalogue Contracts.

Defines the trusted, versioned Retrieval Capability Catalogue used by the
Requirement & Intent Planner to understand:
- What categories and entity types can be queried.
- Which structured fields exist and their data types.
- Which fields are filterable, sortable, range-queryable, or search-queryable.
- Allowed operators per field (e.g. 'between', 'eq', 'lt', 'gt', 'in').
- Authoritative data sources ('postgresql' canonical_data vs 'qdrant' vector index).
- Safe query limits and result limits.
- Compact bounded representation for prompt injection.

Architectural invariants:
1. Strict server-side authority: Model CANNOT introduce arbitrary database fields or Qdrant filters.
2. Tenant-scoped custom attributes: Dynamically includes tenant custom fields without leaking across tenants.
3. Pricing invariant: Pricing is strictly embedded inside 'products_services'; no standalone pricing category.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field as PydanticField

from app.contracts.knowledge import (
    AttributeValueType,
    KnowledgeCategory,
    category_registry,
    normalize_category_key,
)
from app.models.knowledge import KnowledgeAttributeDefinition


class AuthoritativeSource(str, Enum):
    """Authoritative storage system for a knowledge fact."""

    POSTGRESQL = "postgresql"  # Canonical JSONB / structured table
    QDRANT = "qdrant"          # Semantic vector chunk index
    LIVE_API = "live_api"      # External real-time connector


class FilterOperator(str, Enum):
    """Allowed deterministic filter operators."""

    EQ = "eq"
    NE = "ne"
    LT = "lt"
    LTE = "lte"
    GT = "gt"
    GTE = "gte"
    BETWEEN = "between"
    IN = "in"
    CONTAINS = "contains"
    SEMANTIC_MATCH = "semantic_match"


# Map AttributeValueType to allowable filter operators
ALLOWED_OPERATORS_BY_TYPE: Dict[str, List[FilterOperator]] = {
    AttributeValueType.STRING.value: [
        FilterOperator.EQ,
        FilterOperator.NE,
        FilterOperator.IN,
        FilterOperator.CONTAINS,
    ],
    AttributeValueType.TEXT.value: [
        FilterOperator.CONTAINS,
        FilterOperator.SEMANTIC_MATCH,
    ],
    AttributeValueType.INTEGER.value: [
        FilterOperator.EQ,
        FilterOperator.NE,
        FilterOperator.LT,
        FilterOperator.LTE,
        FilterOperator.GT,
        FilterOperator.GTE,
        FilterOperator.BETWEEN,
        FilterOperator.IN,
    ],
    AttributeValueType.DECIMAL.value: [
        FilterOperator.EQ,
        FilterOperator.NE,
        FilterOperator.LT,
        FilterOperator.LTE,
        FilterOperator.GT,
        FilterOperator.GTE,
        FilterOperator.BETWEEN,
        FilterOperator.IN,
    ],
    AttributeValueType.CURRENCY.value: [
        FilterOperator.EQ,
        FilterOperator.NE,
        FilterOperator.IN,
    ],
    AttributeValueType.BOOLEAN.value: [
        FilterOperator.EQ,
    ],
    AttributeValueType.DATE.value: [
        FilterOperator.EQ,
        FilterOperator.LT,
        FilterOperator.LTE,
        FilterOperator.GT,
        FilterOperator.GTE,
        FilterOperator.BETWEEN,
    ],
    AttributeValueType.DATETIME.value: [
        FilterOperator.EQ,
        FilterOperator.LT,
        FilterOperator.LTE,
        FilterOperator.GT,
        FilterOperator.GTE,
        FilterOperator.BETWEEN,
    ],
    AttributeValueType.ENUM.value: [
        FilterOperator.EQ,
        FilterOperator.NE,
        FilterOperator.IN,
    ],
    AttributeValueType.ARRAY.value: [
        FilterOperator.CONTAINS,
        FilterOperator.IN,
    ],
}


class FieldCapability(BaseModel):
    """Capabilities and restrictions for a single knowledge field."""

    name: str
    field_type: str
    is_required: bool = False
    description: str = ""
    allowed_values: Optional[List[str]] = None
    allowed_operators: List[FilterOperator] = PydanticField(default_factory=list)
    is_filterable: bool = True
    is_range_queryable: bool = False
    is_sortable: bool = False
    authoritative_source: AuthoritativeSource = AuthoritativeSource.POSTGRESQL


class CategoryCapability(BaseModel):
    """Capabilities and restrictions for a knowledge category."""

    category: str
    display_name: str
    description: str
    entity_types: List[str] = PydanticField(default_factory=list)
    fields: Dict[str, FieldCapability] = PydanticField(default_factory=dict)
    retrieval_filter_fields: List[str] = PydanticField(default_factory=list)
    supports_temporal: bool = False
    supports_regional: bool = False


class RetrievalCapabilityCatalogue(BaseModel):
    """Trusted, versioned catalogue of all supported retrieval capabilities."""

    catalogue_version: str = "1.0"
    tenant_id: str
    embedding_profile_id: str = "emb_voyage_4_large_1024_v1"
    default_result_count: int = 5
    max_safe_result_limit: int = 20
    categories: Dict[str, CategoryCapability] = PydanticField(default_factory=dict)

    def is_field_allowed(self, category: str, field_name: str) -> bool:
        """Verify whether a field exists and is permitted for a category."""
        cat = self.categories.get(category)
        if not cat:
            return False
        return field_name in cat.fields

    def is_operator_allowed(self, category: str, field_name: str, operator: FilterOperator) -> bool:
        """Verify whether an operator is permitted for a field."""
        cat = self.categories.get(category)
        if not cat:
            return False
        f_cap = cat.fields.get(field_name)
        if not f_cap:
            return False
        return operator in f_cap.allowed_operators

    def get_field_capability(self, category: str, field_name: str) -> Optional[FieldCapability]:
        """Return the capability definition for a field."""
        cat = self.categories.get(category)
        if not cat:
            return None
        return cat.fields.get(field_name)

    def build_compact_prompt_summary(self) -> str:
        """Generate a compact, token-efficient capability description for LLM system prompts."""
        lines: List[str] = [
            f"### Authorized Retrieval Capabilities (v{self.catalogue_version})",
            f"- Default result count: {self.default_result_count}, Max safe limit: {self.max_safe_result_limit}",
            "- Authoritative price & commercial facts are in PostgreSQL; narrative/semantic facts in Qdrant.",
            "- Invariant: Pricing is embedded inside products_services; there is NO separate pricing category.",
            "",
            "#### Categories and Key Filterable Fields:",
        ]

        for cat_key, cat in sorted(self.categories.items()):
            field_summaries = []
            for f_name, f_cap in sorted(cat.fields.items()):
                if f_cap.is_filterable:
                    ops = ",".join(op.value for op in f_cap.allowed_operators[:4])
                    if f_cap.allowed_values:
                        enum_vals = "|".join(f_cap.allowed_values[:5])
                        field_summaries.append(f"{f_name}({f_cap.field_type}:[{enum_vals}],ops:[{ops}])")
                    elif f_cap.is_range_queryable:
                        field_summaries.append(f"{f_name}({f_cap.field_type}:range,ops:[{ops}])")
                    else:
                        field_summaries.append(f"{f_name}({f_cap.field_type},ops:[{ops}])")

            fields_str = "; ".join(field_summaries[:8])
            entities_str = ",".join(cat.entity_types) if cat.entity_types else "STANDARD"
            lines.append(f"- **{cat_key}** (Entities: {entities_str}): {fields_str}")

        return "\n".join(lines)


# =============================================================================
# Catalogue Builder Factory
# =============================================================================


def build_retrieval_capability_catalogue(
    tenant_id: str,
    custom_definitions: Optional[List[KnowledgeAttributeDefinition]] = None,
    embedding_profile_id: str = "emb_voyage_4_large_1024_v1",
) -> RetrievalCapabilityCatalogue:
    """Construct a trusted RetrievalCapabilityCatalogue for a tenant.

    Derives canonical capabilities from category_registry and augments with
    tenant-specific custom attributes strictly isolated to tenant_id.
    """
    categories: Dict[str, CategoryCapability] = {}

    for cat_enum in KnowledgeCategory:
        cat_def = category_registry.get(cat_enum.value)
        fields: Dict[str, FieldCapability] = {}

        for f_name, f_canon in cat_def.fields.items():
            f_type = f_canon.field_type.value
            allowed_ops = ALLOWED_OPERATORS_BY_TYPE.get(f_type, [FilterOperator.EQ])
            is_range = f_type in (
                AttributeValueType.INTEGER.value,
                AttributeValueType.DECIMAL.value,
                AttributeValueType.DATE.value,
                AttributeValueType.DATETIME.value,
            )
            is_sort = is_range or f_type == AttributeValueType.STRING.value

            # Price, availability, and SKU are authoritative in PostgreSQL
            auth_src = (
                AuthoritativeSource.POSTGRESQL
                if f_name in ("price", "currency", "availability", "sku", "commercial_price_type")
                else AuthoritativeSource.POSTGRESQL
            )

            fields[f_name] = FieldCapability(
                name=f_name,
                field_type=f_type,
                is_required=f_canon.is_required,
                description=f_canon.description,
                allowed_values=f_canon.allowed_values,
                allowed_operators=allowed_ops,
                is_filterable=f_canon.is_filter,
                is_range_queryable=is_range,
                is_sortable=is_sort,
                authoritative_source=auth_src,
            )

        categories[cat_enum.value] = CategoryCapability(
            category=cat_enum.value,
            display_name=cat_def.display_name,
            description=cat_def.description,
            entity_types=cat_def.entity_types,
            fields=fields,
            retrieval_filter_fields=cat_def.retrieval_filter_fields,
            supports_temporal=cat_def.supports_temporal,
            supports_regional=cat_def.supports_regional,
        )

    # Augment with tenant custom definitions if provided
    if custom_definitions:
        for c_def in custom_definitions:
            if c_def.tenant_id != tenant_id:
                # Enforce strict tenant isolation: discard any non-tenant definition
                continue
            cat_key = c_def.category
            if cat_key in categories:
                f_type = c_def.value_type
                allowed_ops = ALLOWED_OPERATORS_BY_TYPE.get(f_type, [FilterOperator.EQ])
                is_range = f_type in (
                    AttributeValueType.INTEGER.value,
                    AttributeValueType.DECIMAL.value,
                )
                categories[cat_key].fields[c_def.key] = FieldCapability(
                    name=c_def.key,
                    field_type=f_type,
                    is_required=c_def.is_required,
                    description=c_def.description or "",
                    allowed_operators=allowed_ops,
                    is_filterable=True,
                    is_range_queryable=is_range,
                    is_sortable=is_range,
                    authoritative_source=AuthoritativeSource.POSTGRESQL,
                )

    return RetrievalCapabilityCatalogue(
        catalogue_version="1.0",
        tenant_id=tenant_id,
        embedding_profile_id=embedding_profile_id,
        default_result_count=5,
        max_safe_result_limit=20,
        categories=categories,
    )
