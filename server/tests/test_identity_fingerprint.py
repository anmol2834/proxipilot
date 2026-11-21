"""Identity never depends on a row's position.

Rows with no name / code / other key field are identified by a fingerprint of their content
(serial-number columns excluded). Reordering rows between uploads must never update the wrong item,
identical rows in one file are merged, and such rows are flagged so the business can add a key column.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.algorithms.deduplication.category_identity import (
    CategoryIdentityResolver,
    content_fingerprint,
    is_content_fingerprint,
)
from app.contracts.column_mapping import (
    ColumnMappingDTO,
    CompiledMappingPlanDTO,
    MappingReason,
    MappingTargetKind,
)
from app.contracts.data_quality import BatchQualityResultDTO, QualityRowStatus, RowQualityErrorCode
from app.services.row_quality_service import RowQualityService
from conftest import REMOTE_DATABASE_BLOCKED

needs_db = pytest.mark.skipif(REMOTE_DATABASE_BLOCKED, reason="needs the local throwaway database")
T = "org_fp_test"


# ---------------------------------------------------------------------------------------------
# Resolver
# ---------------------------------------------------------------------------------------------

@pytest.mark.parametrize("category", ["products_services", "policies", "support_faqs", "offers_promotions",
                                      "processes_timelines", "company_info", "some_custom_category"])
def test_identifier_less_rows_get_a_position_independent_key(category):
    row_a = {"description": "Steel wall bracket", "price": 120}
    key_r4 = CategoryIdentityResolver.resolve_identity_key(T, category, dict(row_a), {"s_no": 4, "colour": "grey"}, 4)
    key_r19 = CategoryIdentityResolver.resolve_identity_key(T, category, dict(row_a), {"colour": "grey", "s_no": 19}, 19)
    changed = CategoryIdentityResolver.resolve_identity_key(T, category, {**row_a, "price": 125}, {"colour": "grey"}, 4)
    assert key_r4 == key_r19, "same content in another row (and another serial number) must keep its identity"
    assert key_r4 != changed, "different content is a different record"
    assert ":row:" not in key_r4 and is_content_fingerprint(key_r4)


def test_business_keys_are_unchanged_and_never_flagged():
    sku = CategoryIdentityResolver.resolve_identity_key(T, "products_services", {"name": "Bracket", "sku": "BR-1"}, {}, 3)
    name = CategoryIdentityResolver.resolve_identity_key(T, "products_services", {"name": "Bracket"}, {"size": "L"}, 3)
    policy = CategoryIdentityResolver.resolve_identity_key(T, "policies", {"policy_name": "Returns"}, {}, 3)
    assert sku.endswith(":ext:BR-1") and name.endswith("name:bracket|var:size=l") and policy.endswith("policy:returns")
    assert not any(is_content_fingerprint(k) for k in (sku, name, policy))


@pytest.mark.parametrize("positional", ["S.No", "sr_no", "Sl No", "#", "Index", "row", "serial number", "Unnamed: 0"])
def test_serial_number_columns_do_not_change_the_fingerprint(positional):
    assert content_fingerprint({"description": "x"}, {positional: 1}) == content_fingerprint({"description": "x"},
                                                                                             {positional: 99})


@pytest.mark.parametrize("meaningful", ["Item No", "Model No", "Part No", "Number", "Position", "No of units"])
def test_code_like_columns_are_data_not_positions(meaningful):
    assert content_fingerprint({"description": "x"}, {meaningful: 1}) != content_fingerprint({"description": "x"},
                                                                                             {meaningful: 2})


def test_positional_columns_are_ignored_by_column_mapping_and_codes_are_kept():
    from app.contracts.column_mapping import MappingReason as MR
    from app.services.column_mapping_service import ColumnMappingService
    from app.services.column_mapping_index import ColumnMappingIndex
    from app.contracts.dataset_profile import ColumnProfileDTO

    svc = ColumnMappingService()
    index = ColumnMappingIndex(tenant_id=T, category="products_services", custom_attributes=[])

    def resolve(name):
        norm = name.strip().lower().replace(" ", "_").replace(".", "_").strip("_")
        col = ColumnProfileDTO(original_name=name, normalized_name=norm, column_index=0, row_count_observed=10,
                               non_empty_count=10, empty_count=0, empty_ratio=0.0, candidate_types=["string"],
                               dominant_type="string", type_confidence=1.0, samples=["1", "2"], max_length=6,
                               approx_unique_count=10, approx_unique_ratio=1.0)
        return svc._resolve_column_mapping(col, index, {}, {})

    assert resolve("S.No").reason == MR.POSITIONAL_IGNORED
    assert resolve("Index").reason == MR.POSITIONAL_IGNORED
    assert resolve("Item No").reason != MR.POSITIONAL_IGNORED


def test_empty_rows_have_no_identity():
    assert CategoryIdentityResolver.resolve_identity_key(T, "policies", {}, {"s_no": 3}, 3).endswith("fp:empty")


# ---------------------------------------------------------------------------------------------
# Row quality: merge identical rows, flag missing identifiers
# ---------------------------------------------------------------------------------------------

def _plan_and_headers(with_name: bool):
    def col(src, kind, field, typ):
        return ColumnMappingDTO(source_column=src, normalized_column=src, target_kind=kind, target_field=field,
                                target_type=typ, confidence=1.0,
                                reason=(MappingReason.CUSTOM_ATTRIBUTE_KEY if kind == MappingTargetKind.CUSTOM_ATTRIBUTE
                                        else MappingReason.EXACT_CANONICAL))
    cols = [col("s_no", MappingTargetKind.CUSTOM_ATTRIBUTE, "s_no", "string")]
    if with_name:
        cols += [col("name", MappingTargetKind.CANONICAL_FIELD, "name", "string"),
                 col("sku", MappingTargetKind.CANONICAL_FIELD, "sku", "string")]
    cols += [col("description", MappingTargetKind.CANONICAL_FIELD, "description", "text"),
             col("finish", MappingTargetKind.CUSTOM_ATTRIBUTE, "finish", "string")]
    plan = CompiledMappingPlanDTO(schema_fingerprint="fp_identity_test", category="products_services", columns=cols,
                                  mapped_count=len(cols), unmapped_count=0, needs_review_count=0, ignored_count=0,
                                  total_columns=len(cols))
    return plan, [c.source_column for c in cols]


def _service(tenant: str, with_name: bool) -> RowQualityService:
    plan, headers = _plan_and_headers(with_name)
    return RowQualityService(tenant_id=tenant, category="products_services", mapping_plan=plan, headers=headers)


def test_a_repeated_row_with_a_different_serial_number_is_a_duplicate_not_a_conflict():
    svc = _service(T, with_name=True)
    rows = [["1", "Wall bracket", "WB-1", "Zinc bracket", "matte"],
            ["2", "Shelf pin", "SP-9", "Brass pin", "polished"],
            ["7", "Wall bracket", "WB-1", "Zinc bracket", "matte"]]     # same record, another S.No
    recs = [svc.process_row(i + 1, r) for i, r in enumerate(rows)]
    assert recs[2].is_duplicate and not recs[2].is_conflict, recs[2].conflict_details
    assert recs[2].status != QualityRowStatus.INVALID


def test_identifier_less_rows_are_flagged_merged_and_never_keyed_by_position():
    svc = _service(T, with_name=False)
    svc.required_canonical_fields = {"entity_type"}     # a category / tenant setup where no key field is required
    rows = [["1", "Wall bracket, zinc", "matte"], ["2", "Shelf pin, brass", "polished"],
            ["3", "Wall bracket, zinc", "matte"]]
    recs = [svc.process_row(i + 1, r) for i, r in enumerate(rows)]
    assert recs[0].identity_key == recs[2].identity_key != recs[1].identity_key
    assert ":row:" not in recs[0].identity_key
    assert recs[2].is_duplicate and not recs[0].is_duplicate
    assert RowQualityErrorCode.MISSING_IDENTIFIER.value in {i.error_code for i in recs[1].issues}
    assert recs[1].status != QualityRowStatus.INVALID


# ---------------------------------------------------------------------------------------------
# Persistence: a reordered re-upload updates nothing and duplicates nothing
# ---------------------------------------------------------------------------------------------

@needs_db
async def test_reordered_reupload_keeps_every_item_and_changes_nothing():
    from app.contracts.data_quality import NormalizedRecordDTO
    from app.core.database import db_manager
    from app.models.knowledge import KnowledgeSource
    from app.services.knowledge_persistence import KnowledgePersistenceService, PersistenceOutcome

    tenant = f"org_fp_{uuid.uuid4().hex[:10]}"
    source_id = f"ks_fp_{uuid.uuid4().hex[:10]}"
    contents = {"a": ("Wall bracket, zinc", "matte"), "b": ("Shelf pin, brass", "polished"),
                "c": ("Cable tie, nylon", "black")}

    def batch(order):
        recs = []
        for pos, k in enumerate(order, start=1):
            desc, finish = contents[k]
            canon, custom = {"description": desc, "entity_type": "PRODUCT"}, {"s_no": str(pos), "finish": finish}
            recs.append(NormalizedRecordDTO(
                row_number=pos, status=QualityRowStatus.VALID, organization_id=tenant, category="products_services",
                identity_key=CategoryIdentityResolver.resolve_identity_key(tenant, "products_services", canon, custom, pos),
                canonical_data=canon, custom_attributes=custom))
        return BatchQualityResultDTO(batch_index=0, total_rows=len(recs), valid_count=len(recs), warning_count=0,
                                     invalid_count=0, duplicate_count=0, conflict_count=0, records=recs)

    def svc(job):
        return KnowledgePersistenceService(tenant_id=tenant, category="products_services", source_id=source_id,
                                           job_id=job, created_by_user_id="usr_fp_test")

    db_manager.initialize()
    async with db_manager.session_factory() as db:
        now = datetime.now(timezone.utc)
        db.add(KnowledgeSource(id=source_id, tenant_id=tenant, name="FP Source", source_type="import",
                               authority_level="imported_data", created_at=now, updated_at=now))
        await db.commit()
        try:
            r1 = await svc("ij_fp1").persist_batch(db, batch(["a", "b", "c"]))
            assert {r.outcome for r in r1.records} == {PersistenceOutcome.INSERTED}
            item_of = {k: r.knowledge_item_id for k, r in zip(["a", "b", "c"], r1.records)}

            # Same rows, new order (and therefore new S.No): nothing changes, nothing is duplicated.
            r2 = await svc("ij_fp2").persist_batch(db, batch(["c", "a", "b"]))
            assert {r.outcome for r in r2.records} == {PersistenceOutcome.UNCHANGED}
            assert [r.knowledge_item_id for r in r2.records] == [item_of["c"], item_of["a"], item_of["b"]]
            n_items = (await db.execute(text("SELECT count(*) FROM knowledge_items WHERE tenant_id=:t"),
                                        {"t": tenant})).scalar()
            n_versions = (await db.execute(text("SELECT count(*) FROM knowledge_versions WHERE tenant_id=:t"),
                                           {"t": tenant})).scalar()
            assert (n_items, n_versions) == (3, 3)
        finally:
            await db.rollback()
            await db.execute(text("DELETE FROM knowledge_versions WHERE tenant_id=:t"), {"t": tenant})
            await db.execute(text("DELETE FROM knowledge_items WHERE tenant_id=:t"), {"t": tenant})
            await db.execute(text("DELETE FROM knowledge_sources WHERE tenant_id=:t"), {"t": tenant})
            await db.commit()
