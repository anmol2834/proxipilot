"""Enterprise Multi-Category Ingestion & Multi-Intent RAG Optimization Test Suite.

Validates:
1. Universal Category Schema Mapping across all 6 dashboard categories:
   - company_info, products_services, policies, support_faqs,
     offers_promotions, processes_timelines.
2. Token-aware Media Detection and Auto-Ignore:
   - Auto-classifies 'product_image', 'photo_url', 'thumbnail' as IGNORED (MEDIA_IGNORED).
   - Preserves essential business data ('website', 'tracking_url', 'manual_url', 'policy_document_url').
3. Multi-Intent Planning with 10+ independent requirements:
   - Decomposes complex multi-category email into 10 distinct PlannedRequirement objects.
   - Preserves price limits (<= 70,000 INR), category routing, dependencies, and entity extraction.
4. Evidence Fusion Grouping:
   - Preserves distinct requirement groups without collapsing into a single flat intent.
5. Ingestion and Zero-Silent-Loss Integrity:
   - Row quality service correctly ignores media fields while preserving typed custom attributes.
"""

from decimal import Decimal
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.contracts.column_mapping import (
    ColumnMappingDTO,
    CompiledMappingPlanDTO,
    MappingReason,
    MappingTargetKind,
)
from app.contracts.dataset_profile import (
    ColumnProfileDTO,
    DatasetProfileDTO,
    FileParserMetadataDTO,
    QualitySummaryDTO,
)
from app.contracts.flexible_schema import CATEGORY_CANONICAL_ALIASES
from app.contracts.knowledge import (
    CanonicalFieldDefinition,
    category_registry,
    normalize_category_key,
)
from app.contracts.requirement_plan import (
    IntentType,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedRequirement,
    RequirementPlan,
    RetrievalStrategy,
)
from app.contracts.evidence_fusion import (
    CandidateRole,
    RequirementType,
)
from app.services.column_mapping_service import ColumnMappingService
from app.services.evidence_fusion.grouper import RequirementGrouper
from app.services.requirement_planner.decomposer import MultiIntentDecomposer
from app.services.row_quality_service import RowQualityService


ALL_CATEGORIES = [
    "company_info",
    "products_services",
    "policies",
    "support_faqs",
    "offers_promotions",
    "processes_timelines",
]


class TestUniversalCategoryMapping:
    """Tests schema mapping across all 6 dashboard categories."""

    @pytest.mark.parametrize("category", ALL_CATEGORIES)
    def test_category_registry_has_canonical_fields(self, category: str):
        """Verify each category has registered canonical fields in KnowledgeCategoryRegistry."""
        cat_def = category_registry.get(category)
        assert cat_def is not None, f"Category {category} missing from category_registry"
        assert len(cat_def.fields) > 0, f"Category {category} has no canonical fields defined"

    @pytest.mark.parametrize("category", ALL_CATEGORIES)
    def test_category_canonical_aliases_valid_targets(self, category: str):
        """Verify every alias in CATEGORY_CANONICAL_ALIASES points to a real canonical field."""
        cat_def = category_registry.get(category)
        cat_field_names = {k.lower() for k in cat_def.fields.keys()}

        for (cat_key, alias), target_field in CATEGORY_CANONICAL_ALIASES.items():
            if cat_key == category:
                assert target_field.lower() in cat_field_names, (
                    f"Invalid alias target '{target_field}' for category '{category}' and alias '{alias}'"
                )

    @pytest.mark.asyncio
    @pytest.mark.parametrize("category", ALL_CATEGORIES)
    async def test_column_mapping_canonical_match(self, category: str):
        """Verify ColumnMappingService correctly maps canonical fields for all 6 categories."""
        cat_def = category_registry.get(category)
        service = ColumnMappingService()

        def get_sample_value(f_def):
            t = f_def.field_type.value
            if t == "decimal":
                return ["100.50"]
            elif t == "integer":
                return ["5"]
            elif t == "boolean":
                return ["true"]
            elif t == "currency":
                return ["INR"]
            elif t in ("datetime", "date"):
                return ["2026-01-01T00:00:00Z"]
            elif t == "array":
                return ["value1, value2"]
            elif t == "enum" and f_def.allowed_values:
                return [f_def.allowed_values[0]]
            elif f_def.normalization == "email":
                return ["info@example.com"]
            elif f_def.normalization == "phone":
                return ["+919876543210"]
            return ["Sample Text Value"]

        # Build columns matching canonical names
        test_cols = []
        for idx, (field_name, field_def) in enumerate(cat_def.fields.items()):
            samples = get_sample_value(field_def)
            test_cols.append(
                ColumnProfileDTO(
                    original_name=field_name,
                    normalized_name=field_name.lower(),
                    column_index=idx,
                    row_count_observed=10,
                    non_empty_count=10,
                    empty_count=0,
                    empty_ratio=0.0,
                    approx_unique_count=10,
                    approx_unique_ratio=1.0,
                    candidate_types=[field_def.field_type.value],
                    dominant_type=field_def.field_type.value,
                    type_confidence=1.0,
                    samples=samples,
                    max_length=50,
                )
            )

        profile = DatasetProfileDTO(
            schema_fingerprint=f"fp_{category}_test",
            file_metadata=FileParserMetadataDTO(file_type="csv"),
            quality_summary=QualitySummaryDTO(
                total_rows=10,
                total_columns=len(test_cols),
                empty_column_count=0,
            ),
            columns=test_cols,
        )

        mock_db = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        plan = await service.detect_and_compile_mapping(
            db=mock_db,
            tenant_id="tenant_universal_test",
            category=category,
            profile=profile,
        )

        assert plan.category == category
        assert plan.mapped_count == len(test_cols)
        assert plan.unmapped_count == 0
        for col_plan in plan.columns:
            assert col_plan.target_kind == MappingTargetKind.CANONICAL_FIELD
            assert col_plan.reason in (MappingReason.EXACT_CANONICAL, MappingReason.CATEGORY_ALIAS)


class TestMediaDetectionAndEssentialUrls:
    """Tests token-aware media auto-ignore while preserving essential business URLs."""

    @pytest.mark.asyncio
    async def test_product_image_and_thumbnails_are_ignored(self):
        """Verify media columns are classified as IGNORED (MEDIA_IGNORED) with 0.95 confidence."""
        service = ColumnMappingService()

        media_columns = [
            ("product_image", ["https://cdn.example.com/products/img_01.jpg"]),
            ("thumbnail_url", ["https://cdn.example.com/thumb/t1.png"]),
            ("front_image", ["https://cdn.example.com/front.webp"]),
            ("back_image", ["https://cdn.example.com/back.jpeg"]),
            ("photo_url", ["https://cdn.example.com/photo.svg"]),
            ("item_pic", ["data:image/png;base64,iVBORw0KGgo..."]),
        ]

        test_cols = []
        for idx, (col_name, samples) in enumerate(media_columns):
            test_cols.append(
                ColumnProfileDTO(
                    original_name=col_name,
                    normalized_name=col_name.lower(),
                    column_index=idx,
                    row_count_observed=10,
                    non_empty_count=10,
                    empty_count=0,
                    empty_ratio=0.0,
                    approx_unique_count=10,
                    approx_unique_ratio=1.0,
                    candidate_types=["string"],
                    dominant_type="string",
                    type_confidence=1.0,
                    samples=samples,
                    max_length=50,
                )
            )

        profile = DatasetProfileDTO(
            schema_fingerprint="fp_media_test",
            file_metadata=FileParserMetadataDTO(file_type="csv"),
            quality_summary=QualitySummaryDTO(
                total_rows=10,
                total_columns=len(test_cols),
                empty_column_count=0,
            ),
            columns=test_cols,
        )

        mock_db = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        plan = await service.detect_and_compile_mapping(
            db=mock_db,
            tenant_id="tenant_media_test",
            category="products_services",
            profile=profile,
        )

        assert plan.ignored_count == len(media_columns)
        for col_plan in plan.columns:
            assert col_plan.target_kind == MappingTargetKind.IGNORED
            assert col_plan.reason == MappingReason.MEDIA_IGNORED
            assert col_plan.confidence == 0.95

    @pytest.mark.asyncio
    async def test_essential_business_urls_are_preserved(self):
        """Verify essential business data ending in _url or file are preserved, NEVER ignored."""
        service = ColumnMappingService()

        essential_columns = [
            ("website", ["https://www.company.com"]),
            ("tracking_url", ["https://ship.courier.com/track/12345"]),
            ("manual_url", ["https://docs.company.com/laptop_manual.pdf"]),
            ("policy_document_url", ["https://legal.company.com/warranty_terms.pdf"]),
            ("support_link", ["https://support.company.com/ticket"]),
            ("location_map_url", ["https://maps.google.com/?q=mumbai"]),
        ]

        test_cols = []
        for idx, (col_name, samples) in enumerate(essential_columns):
            test_cols.append(
                ColumnProfileDTO(
                    original_name=col_name,
                    normalized_name=col_name.lower(),
                    column_index=idx,
                    row_count_observed=10,
                    non_empty_count=10,
                    empty_count=0,
                    empty_ratio=0.0,
                    approx_unique_count=10,
                    approx_unique_ratio=1.0,
                    candidate_types=["string"],
                    dominant_type="string",
                    type_confidence=1.0,
                    samples=samples,
                    max_length=60,
                )
            )

        profile = DatasetProfileDTO(
            schema_fingerprint="fp_essential_urls_test",
            file_metadata=FileParserMetadataDTO(file_type="csv"),
            quality_summary=QualitySummaryDTO(
                total_rows=10,
                total_columns=len(test_cols),
                empty_column_count=0,
            ),
            columns=test_cols,
        )

        mock_db = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        plan = await service.detect_and_compile_mapping(
            db=mock_db,
            tenant_id="tenant_urls_test",
            category="products_services",
            profile=profile,
        )

        # Essential URLs must NOT be ignored
        assert plan.ignored_count == 0
        for col_plan in plan.columns:
            assert col_plan.target_kind in (MappingTargetKind.CANONICAL_FIELD, MappingTargetKind.CUSTOM_ATTRIBUTE)
            assert col_plan.target_kind != MappingTargetKind.IGNORED


class TestMultiIntentDecomposition:
    """Tests multi-intent planning with 10+ independent requirements spanning multiple categories."""

    def test_ten_requirement_complex_email_decomposition(self):
        """Test the exact 10-question enterprise email from the specification."""
        email_text = (
            "I am considering your laptop products. Share the best eligible models under ₹70,000, "
            "compare warranty, explain the return policy, tell me delivery timelines to Mumbai, "
            "share the retailer contact for bulk orders, check whether an offer applies, "
            "explain the overheating issue, provide the service-center location, "
            "and tell me the installation process."
        )

        requirements = MultiIntentDecomposer.decompose(text=email_text)

        # Must extract at least 9-10 distinct independent requirements
        assert len(requirements) >= 9, f"Expected >= 9 requirements, got {len(requirements)}"

        # Check category representation
        categories_extracted = {r.category for r in requirements}
        assert "products_services" in categories_extracted
        assert "policies" in categories_extracted
        assert "processes_timelines" in categories_extracted   # delivery timelines, installation process
        assert "company_info" in categories_extracted          # retailer contact, service-center location
        assert "offers_promotions" in categories_extracted
        assert "support_faqs" in categories_extracted

        # Verify numeric constraint (price <= 70,000 INR) on products_services requirement
        prod_req = next(r for r in requirements if r.category == "products_services" and r.range_semantics is not None)
        assert prod_req.range_semantics is not None
        assert prod_req.range_semantics.max_value == 70000.0
        assert prod_req.range_semantics.currency == "INR"

        # Verify location entity ("Mumbai") on delivery requirement
        ops_req = next(r for r in requirements if "mumbai" in (r.description or "").lower() or r.category == "processes_timelines")
        assert any(e.canonical_value == "Mumbai" for e in ops_req.entities)

        # Verify dependencies: policies/offers depend on products requirement
        dep_reqs = [r for r in requirements if prod_req.requirement_id in r.dependencies]
        assert len(dep_reqs) > 0, "Expected downstream requirements to depend on product requirement"

    def test_evidence_fusion_grouper_preserves_all_requirements(self):
        """Test RequirementGrouper preserves every PlannedRequirement as a distinct group."""
        reqs = [
            PlannedRequirement(
                requirement_id="req_1_prod",
                intent=IntentType.PRODUCT_DISCOVERY,
                category="products_services",
                description="Eligible laptop models under 70000",
                range_semantics=PlannedRange(field="price", max_value=70000.0, currency="INR"),
            ),
            PlannedRequirement(
                requirement_id="req_2_warr",
                intent=IntentType.WARRANTY_QUESTION,
                category="policies",
                description="Compare warranty terms",
            ),
            PlannedRequirement(
                requirement_id="req_3_ret",
                intent=IntentType.POLICY_QUESTION,
                category="policies",
                description="Return and replacement policy",
            ),
            PlannedRequirement(
                requirement_id="req_4_ship",
                intent=IntentType.ORDER_OR_DELIVERY_QUESTION,
                category="processes_timelines",
                description="Delivery timelines to Mumbai",
            ),
            PlannedRequirement(
                requirement_id="req_5_cont",
                intent=IntentType.SERVICE_LOOKUP,
                category="company_info",
                description="Retailer contact for bulk orders",
            ),
            PlannedRequirement(
                requirement_id="req_6_offr",
                intent=IntentType.PRICE_QUERY,
                category="offers_promotions",
                description="Check applicable promo discounts",
            ),
            PlannedRequirement(
                requirement_id="req_7_supp",
                intent=IntentType.SUPPORT_ISSUE,
                category="support_faqs",
                description="Overheating issue troubleshooting",
            ),
            PlannedRequirement(
                requirement_id="req_8_loc",
                intent=IntentType.SERVICE_LOOKUP,
                category="company_info",
                description="Service center location in Mumbai",
            ),
            PlannedRequirement(
                requirement_id="req_9_oper",
                intent=IntentType.SUPPORT_ISSUE,
                category="processes_timelines",
                description="Installation process and work schedule",
            ),
            PlannedRequirement(
                requirement_id="req_10_comp",
                intent=IntentType.CATALOGUE_REQUEST,
                category="company_info",
                description="Official company credentials and website",
            ),
        ]

        plan = RequirementPlan(
            tenant_id="tenant_multi_intent_test",
            integration_account_id="int_001",
            thread_id="th_001",
            message_id="msg_001",
            context_revision=1,
            intent=IntentType.PRODUCT_DISCOVERY,
            requirements=reqs,
        )

        groups = RequirementGrouper.decompose_requirements(plan=plan)

        assert len(groups) == 10, f"Expected exactly 10 groups, got {len(groups)}"
        group_req_ids = [g.requirement_id for g in groups]
        for req in reqs:
            assert req.requirement_id in group_req_ids


class TestRowQualityZeroSilentLoss:
    """Tests row-level validation ignores media columns while maintaining zero silent loss."""

    def test_ignored_media_is_not_extracted_into_custom_attributes(self):
        """Verify media columns marked IGNORED are skipped by CompiledRowExtractor."""
        cols = [
            ColumnMappingDTO(
                source_column="sku",
                normalized_column="sku",
                target_kind=MappingTargetKind.CANONICAL_FIELD,
                target_field="sku",
                target_type="string",
                confidence=1.0,
                reason=MappingReason.EXACT_CANONICAL,
            ),
            ColumnMappingDTO(
                source_column="name",
                normalized_column="name",
                target_kind=MappingTargetKind.CANONICAL_FIELD,
                target_field="name",
                target_type="string",
                confidence=1.0,
                reason=MappingReason.EXACT_CANONICAL,
            ),
            ColumnMappingDTO(
                source_column="product_image",
                normalized_column="product_image",
                target_kind=MappingTargetKind.IGNORED,
                target_field="product_image",
                target_type="media_ignored",
                confidence=0.95,
                reason=MappingReason.MEDIA_IGNORED,
            ),
            ColumnMappingDTO(
                source_column="tracking_url",
                normalized_column="tracking_url",
                target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
                target_field="tracking_url",
                target_type="string",
                confidence=0.90,
                reason=MappingReason.CUSTOM_ATTRIBUTE_KEY,
            ),
        ]

        plan = CompiledMappingPlanDTO(
            schema_fingerprint="fp_quality_test",
            category="products_services",
            columns=cols,
            mapped_count=3,
            unmapped_count=0,
            needs_review_count=0,
            ignored_count=1,
            total_columns=4,
        )

        headers = ["sku", "name", "product_image", "tracking_url"]
        quality_service = RowQualityService(
            tenant_id="tenant_test",
            category="products_services",
            mapping_plan=plan,
            headers=headers,
        )

        # CompiledRowExtractor must have extractors for sku (0), name (1), tracking_url (3), but NOT product_image (2)
        extractors = quality_service.extractor.column_extractors
        assert 0 in extractors
        assert 1 in extractors
        assert 3 in extractors
        assert 2 not in extractors, "Ignored media column must NOT be in column extractors"
