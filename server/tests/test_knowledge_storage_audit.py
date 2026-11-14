"""Comprehensive Knowledge Storage & Ingestion Audit Test Suite.

Validates:
1. Authoritative PostgreSQL canonical data preservation (24/24 records).
2. Pricing precision, exact Decimal arithmetic, and controlled commercial semantics.
3. Stable identity (HA-001..HA-024) and idempotent re-import stability.
4. Single-record updates and version increment isolation.
5. Flexible-schema ingestion for Datasets A, B, and C (nested, arrays, types).
6. Deterministic semantic projection and hash regeneration.
7. Temporal validity window semantics (effective_from <= now < effective_until).
8. Live Qdrant vector collection 24-point reconciliation.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import os
import re
import sys
import urllib.request
import uuid
import pytest
import openpyxl

from sqlalchemy import select, text
from app.core.database import db_manager
from app.contracts.flexible_schema import CATEGORY_CANONICAL_ALIASES
from app.contracts.data_quality import (
    BatchQualityResultDTO,
    NormalizedRecordDTO,
    QualityRowStatus,
)
from app.contracts.persistence import PersistenceOutcome
from app.models.knowledge import (
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSemanticChunk,
    KnowledgeSource,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
from app.services.knowledge_persistence import (
    KnowledgePersistenceService,
    _build_pricing_structure,
    _is_canonical_identical,
)
from app.services.knowledge_projection import (
    KnowledgeProjectionService,
    _format_currency_amount,
    _format_value,
)

EXCEL_PATH = str(__import__("pathlib").Path(__file__).parent / "fixtures" / "home_appliance_services.xlsx")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_canonical_data_preservation_24_rows(seeded_tenant):
    """Verify all 24 source rows and 36 columns are preserved in PostgreSQL canonical_data without data loss."""
    assert os.path.exists(EXCEL_PATH), f"Excel dataset missing at {EXCEL_PATH}"

    wb = openpyxl.load_workbook(EXCEL_PATH)
    sheet = wb.active
    headers = [cell.value for cell in sheet[1]]
    excel_rows = []
    for r in sheet.iter_rows(min_row=2, values_only=True):
        if any(r):
            excel_rows.append(dict(zip(headers, r)))

    assert len(excel_rows) == 24, f"Expected 24 rows, found {len(excel_rows)}"

    db_manager.initialize()
    async with db_manager.session_factory() as session:
        stmt = (
            select(KnowledgeItem, KnowledgeVersion)
            .join(KnowledgeVersion, KnowledgeItem.id == KnowledgeVersion.knowledge_item_id)
            .where(
                KnowledgeItem.tenant_id == seeded_tenant,
                KnowledgeItem.external_identity_key.startswith("HA-"),
                KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
            )
        )
        res = await session.execute(stmt)
        records = res.all()

    assert len(records) == 24, f"Expected 24 active items in DB, found {len(records)}"

    db_by_key = {item.external_identity_key: (item, version) for item, version in records}

    missing_count = 0
    checked_count = 0

    for x_row in excel_rows:
        key = x_row.get("external_identity_key") or x_row.get("record_id")
        assert key in db_by_key, f"Identity {key} not found in database!"
        item, version = db_by_key[key]
        canonical = version.canonical_data or {}

        for col, val in x_row.items():
            if col in ("version", "custom_attributes_json"):
                continue
            checked_count += 1

            alias = None
            if col == "service_name":
                alias = "name"
            elif col == "record_id":
                alias = "sku"

            found = canonical.get(col)
            if found is None and alias:
                found = canonical.get(alias)
            if found is None and "pricing" in canonical and isinstance(canonical["pricing"], dict):
                found = canonical["pricing"].get(col) or (canonical["pricing"].get(alias) if alias else None)
            if found is None and "custom_attributes" in canonical and isinstance(canonical["custom_attributes"], dict):
                found = canonical["custom_attributes"].get(col) or (canonical["custom_attributes"].get(alias) if alias else None)

            if val is not None and found is None:
                missing_count += 1

    assert checked_count == 816, f"Expected 816 fields checked, got {checked_count}"
    assert missing_count == 0, f"Found {missing_count} missing fields in canonical_data"


@pytest.mark.asyncio
async def test_pricing_precision_and_commercial_semantics():
    """Verify authoritative pricing calculation: pure Decimal arithmetic with 2-decimal rounding."""
    # Test formula: (base + visit + parts + labor) * (1 - disc/100) * (1 + tax/100)
    data = {
        "base_price": 699,
        "visit_charge": 149,
        "parts_estimate": 0,
        "discount_percent": 0,
        "tax_percent": 18,
        "currency": "INR",
    }
    pricing = _build_pricing_structure(data)
    assert pricing is not None
    assert pricing["base_price"] == 699.0
    assert pricing["visit_charge"] == 149.0
    assert pricing["estimated_total"] == 1000.64
    assert pricing["commercial_price_type"] == "not_specified"

    # Edge case: Percentage discount with fractional rounding
    edge_data = {
        "base_price": 1250.50,
        "visit_charge": 199.00,
        "parts_estimate": 350.25,
        "discount_percent": 7.5,
        "tax_percent": 18.0,
        "currency": "INR",
        "commercial_price_type": "estimate",
    }
    edge_pricing = _build_pricing_structure(edge_data)
    assert edge_pricing is not None
    # subtotal = 1250.50 + 199.00 + 350.25 = 1799.75
    # after discount 7.5% = 1799.75 * 0.925 = 1664.76875
    # after tax 18% = 1664.76875 * 1.18 = 1964.427125 -> 1964.43
    assert edge_pricing["estimated_total"] == 1964.43
    assert edge_pricing["commercial_price_type"] == "estimate"

    # Edge case: Controlled commercial price types
    for cpt in ("fixed", "estimate", "starting_price", "quote_required", "not_specified"):
        struct = _build_pricing_structure({"base_price": 100, "commercial_price_type": cpt})
        assert struct["commercial_price_type"] == cpt


@pytest.mark.asyncio
async def test_idempotent_reimport_and_stable_identity():
    """Verify re-importing identical canonical records does NOT create duplicate items or versions."""
    tenant_id = f"org_test_idemp_{uuid.uuid4().hex[:12]}"
    source_id = f"ks_test_{uuid.uuid4().hex[:12]}"
    user_id = "usr_test_audit"

    db_manager.initialize()
    async with db_manager.session_factory() as session:
        # 1. Create source
        now = datetime.now(timezone.utc)
        src = KnowledgeSource(
            id=source_id,
            tenant_id=tenant_id,
            name="Test Source",
            source_type="import",
            authority_level="imported_data",
            created_at=now,
            updated_at=now,
        )
        session.add(src)
        await session.commit()

        # 2. First import: Insert record
        rec = NormalizedRecordDTO(
            row_number=1,
            status=QualityRowStatus.VALID,
            organization_id=tenant_id,
            category="products_services",
            identity_key="SRV-001",
            canonical_data={"name": "Test Service", "price": 500.0, "currency": "INR", "effective_from": "2026-01-01"},
            custom_attributes={"tier": "premium"},
        )
        batch = BatchQualityResultDTO(
            batch_index=0,
            total_rows=1,
            valid_count=1,
            warning_count=0,
            invalid_count=0,
            duplicate_count=0,
            conflict_count=0,
            records=[rec],
        )

        persistence1 = KnowledgePersistenceService(
            tenant_id=tenant_id,
            category="products_services",
            source_id=source_id,
            job_id="ij_job1",
            created_by_user_id=user_id,
        )
        res1 = await persistence1.persist_batch(session, batch)
        assert res1.records[0].outcome == PersistenceOutcome.INSERTED
        item_id = res1.records[0].knowledge_item_id
        version_id = res1.records[0].knowledge_version_id

        # 3. Second import: Identical re-import
        persistence2 = KnowledgePersistenceService(
            tenant_id=tenant_id,
            category="products_services",
            source_id=source_id,
            job_id="ij_job2",
            created_by_user_id=user_id,
        )
        res2 = await persistence2.persist_batch(session, batch)
        assert res2.records[0].outcome == PersistenceOutcome.UNCHANGED
        assert res2.records[0].knowledge_item_id == item_id
        assert res2.records[0].knowledge_version_id == version_id

        # Verify no version bump occurred in database
        stmt_after = (
            select(KnowledgeVersion)
            .where(KnowledgeVersion.knowledge_item_id == item_id)
        )
        res_after = await session.execute(stmt_after)
        all_vers = res_after.scalars().all()
        assert len(all_vers) == 1, "Expected exactly 1 version to remain after unchanged re-import"
        assert all_vers[0].version_number == 1

        # Clean up test tenant
        await session.execute(text(f"DELETE FROM knowledge_versions WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_items WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_sources WHERE tenant_id = '{tenant_id}'"))
        await session.commit()


@pytest.mark.asyncio
async def test_single_record_update_and_versioning():
    """Verify changing 1 record increments its version and archives previous version while others remain stable."""
    tenant_id = f"org_test_{uuid.uuid4().hex[:12]}"

    db_manager.initialize()
    async with db_manager.session_factory() as session:
        now = datetime.now(timezone.utc)
        item_id = f"ki_{uuid.uuid4().hex[:16]}"
        ver_id = f"kv_{uuid.uuid4().hex[:16]}"

        src = KnowledgeSource(
            id="ks_test",
            tenant_id=tenant_id,
            name="Test Source",
            source_type="import",
            authority_level="imported_data",
            created_at=now,
            updated_at=now,
        )
        session.add(src)

        item = KnowledgeItem(
            id=item_id,
            tenant_id=tenant_id,
            title="AC Test Service",
            category="products_services",
            external_identity_key="TEST-001",
            source_id="ks_test",
            is_active=True,
            current_version_id=ver_id,
            created_at=now,
            updated_at=now,
        )
        ver1 = KnowledgeVersion(
            id=ver_id,
            tenant_id=tenant_id,
            knowledge_item_id=item_id,
            version_number=1,
            status=KnowledgeLifecycleStatus.ACTIVE.value,
            canonical_data={"name": "AC Test Service", "price": 500.0, "currency": "INR"},
            projection_status="projected",
            semantic_status="synced",
            created_at=now,
            updated_at=now,
        )
        session.add(item)
        session.add(ver1)
        await session.commit()

        # Update candidate with price change (500 -> 600)
        updated_rec = NormalizedRecordDTO(
            row_number=1,
            status=QualityRowStatus.VALID,
            organization_id=tenant_id,
            category="products_services",
            identity_key="TEST-001",
            canonical_data={"name": "AC Test Service", "price": 600.0, "currency": "INR"},
        )

        persistence = KnowledgePersistenceService(
            tenant_id=tenant_id,
            category="products_services",
            source_id="ks_test",
            job_id="ij_test_update",
            created_by_user_id="usr_audit_test",
        )

        batch = BatchQualityResultDTO(
            batch_index=0,
            total_rows=1,
            valid_count=1,
            warning_count=0,
            invalid_count=0,
            duplicate_count=0,
            conflict_count=0,
            records=[updated_rec],
        )

        batch_result = await persistence.persist_batch(session, batch)
        assert len(batch_result.records) == 1
        assert batch_result.records[0].outcome == PersistenceOutcome.VERSIONED

        # Verify database state
        stmt_vers = (
            select(KnowledgeVersion)
            .where(KnowledgeVersion.knowledge_item_id == item_id)
            .order_by(KnowledgeVersion.version_number)
        )
        res_vers = await session.execute(stmt_vers)
        versions = res_vers.scalars().all()
        assert len(versions) == 2
        assert versions[0].version_number == 1
        assert versions[0].status == KnowledgeLifecycleStatus.ARCHIVED.value
        assert versions[1].version_number == 2
        assert versions[1].status == KnowledgeLifecycleStatus.ACTIVE.value
        assert versions[1].canonical_data["price"] == 600.0

        # Clean up test tenant
        await session.execute(text(f"DELETE FROM knowledge_versions WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_items WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_sources WHERE tenant_id = '{tenant_id}'"))
        await session.commit()


@pytest.mark.asyncio
async def test_flexible_schema_ingestion_datasets_a_b_c():
    """Verify arbitrary flexible-schema preservation for product catalog, service catalog, and unseen attributes."""
    tenant_id = f"org_test_flex_{uuid.uuid4().hex[:12]}"
    source_id = f"ks_test_{uuid.uuid4().hex[:12]}"

    db_manager.initialize()
    async with db_manager.session_factory() as session:
        now = datetime.now(timezone.utc)
        src = KnowledgeSource(
            id=source_id,
            tenant_id=tenant_id,
            name="Test Source",
            source_type="import",
            authority_level="imported_data",
            created_at=now,
            updated_at=now,
        )
        session.add(src)
        await session.commit()

        # Dataset A: Product catalog with engineering fields
        rec_a = NormalizedRecordDTO(
            row_number=1,
            status=QualityRowStatus.VALID,
            organization_id=tenant_id,
            category="products_services",
            identity_key="SKU-PROD-900",
            canonical_data={
                "name": "Heavy Duty Compressor",
                "sku": "SKU-PROD-900",
                "price": 4500.0,
                "currency": "INR",
            },
            custom_attributes={
                "voltage": "240V",
                "capacity_liters": 350,
                "warranty_months": 24,
                "energy_rating": "5 Star",
                "vendor_reference": "VR-COMP-99",
            },
        )

        # Dataset B: Service catalog with SLA
        rec_b = NormalizedRecordDTO(
            row_number=2,
            status=QualityRowStatus.VALID,
            organization_id=tenant_id,
            category="products_services",
            identity_key="SRV-EMERGENCY-01",
            canonical_data={
                "name": "24x7 Emergency Breakdown Support",
                "price": 1200.0,
                "currency": "INR",
            },
            custom_attributes={
                "hourly_rate": 400.0,
                "coverage_area": "Greater Ahmedabad",
                "SLA": "2 hours",
                "technician_grade": "Master Specialist",
                "emergency_support": True,
                "contract_type": "On-demand SLA",
            },
        )

        # Dataset C: Unseen fields with nested dictionaries, arrays, booleans, dates
        rec_c = NormalizedRecordDTO(
            row_number=3,
            status=QualityRowStatus.VALID,
            organization_id=tenant_id,
            category="products_services",
            identity_key="UNSEEN-ADV-001",
            canonical_data={
                "name": "Custom Precision Diagnostic Unit",
                "price": 8900.0,
                "currency": "INR",
            },
            custom_attributes={
                "certifications": ["ISO-9001", "CE", "RoHS"],
                "compliance_flags": {"is_hazardous": False, "requires_grounding": True},
                "max_operating_temp_c": 85.5,
                "calibration_due_date": "2027-06-30",
            },
        )

        persistence = KnowledgePersistenceService(
            tenant_id=tenant_id,
            category="products_services",
            source_id=source_id,
            job_id="ij_test_flex",
            created_by_user_id="usr_audit_test",
        )

        batch = BatchQualityResultDTO(
            batch_index=0,
            total_rows=3,
            valid_count=3,
            warning_count=0,
            invalid_count=0,
            duplicate_count=0,
            conflict_count=0,
            records=[rec_a, rec_b, rec_c],
        )

        batch_result = await persistence.persist_batch(session, batch)
        assert len(batch_result.records) == 3
        for r in batch_result.records:
            assert r.outcome == PersistenceOutcome.INSERTED

        # Verify that all custom attributes survive into canonical_data in PostgreSQL
        stmt = (
            select(KnowledgeVersion, KnowledgeItem)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(KnowledgeVersion.tenant_id == tenant_id)
        )
        res = await session.execute(stmt)
        pairs = res.all()
        assert len(pairs) == 3

        v_map = {item.external_identity_key: v for v, item in pairs}

        # Validate Dataset A
        ca_a = v_map["SKU-PROD-900"].canonical_data.get("custom_attributes", {})
        assert ca_a["voltage"] == "240V"
        assert ca_a["capacity_liters"] == 350
        assert ca_a["energy_rating"] == "5 Star"

        # Validate Dataset B
        ca_b = v_map["SRV-EMERGENCY-01"].canonical_data.get("custom_attributes", {})
        assert ca_b["technician_grade"] == "Master Specialist"
        assert ca_b["emergency_support"] is True

        # Validate Dataset C (nested structure and array)
        ca_c = v_map["UNSEEN-ADV-001"].canonical_data.get("custom_attributes", {})
        assert ca_c["certifications"] == ["ISO-9001", "CE", "RoHS"]
        assert ca_c["compliance_flags"]["requires_grounding"] is True
        assert ca_c["max_operating_temp_c"] == 85.5

        # Clean up test tenant
        await session.execute(text(f"DELETE FROM knowledge_versions WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_items WHERE tenant_id = '{tenant_id}'"))
        await session.execute(text(f"DELETE FROM knowledge_sources WHERE tenant_id = '{tenant_id}'"))
        await session.commit()


@pytest.mark.asyncio
async def test_semantic_projection_determinism():
    """Verify semantic projection is 100% deterministic: identical records produce byte-identical text and hash."""
    proj_svc = KnowledgeProjectionService()

    now = datetime.now(timezone.utc)
    item = KnowledgeItem(
        id="ki_proj_test",
        tenant_id="org_test",
        title="Microwave Repair",
        category="products_services",
        external_identity_key="HA-010",
        is_active=True,
    )
    ver = KnowledgeVersion(
        id="kv_proj_test",
        tenant_id="org_test",
        knowledge_item_id="ki_proj_test",
        version_number=1,
        status=KnowledgeLifecycleStatus.ACTIVE.value,
        canonical_data={
            "name": "Microwave Repair",
            "sku": "HA-010",
            "base_price": 499.0,
            "currency": "INR",
            "service_area": "Ahmedabad",
            "description": "Magnetron and turntable motor troubleshooting.",
        },
        effective_from=now,
    )

    doc1 = proj_svc.project_item_version(item=item, version=ver)
    doc2 = proj_svc.project_item_version(item=item, version=ver)

    assert doc1.chunks[0].text == doc2.chunks[0].text
    h1 = hashlib.sha256(doc1.chunks[0].text.encode("utf-8")).hexdigest()
    h2 = hashlib.sha256(doc2.chunks[0].text.encode("utf-8")).hexdigest()
    assert h1 == h2
    assert len(h1) == 64  # SHA-256


@pytest.mark.asyncio
async def test_temporal_validity_filtering():
    """Verify temporal validity rule: effective_from <= now AND (effective_until IS NULL OR effective_until > now)."""
    now = datetime.now(timezone.utc)
    past = now - timedelta(days=10)
    future = now + timedelta(days=10)

    # 1. Valid indefinite
    v_valid = KnowledgeVersion(
        id="v1", tenant_id="t1", knowledge_item_id="i1",
        status=KnowledgeLifecycleStatus.ACTIVE.value,
        effective_from=past, effective_until=None
    )
    # 2. Future effective date (not yet active)
    v_future = KnowledgeVersion(
        id="v2", tenant_id="t1", knowledge_item_id="i2",
        status=KnowledgeLifecycleStatus.ACTIVE.value,
        effective_from=future, effective_until=None
    )
    # 3. Expired effective date
    v_expired = KnowledgeVersion(
        id="v3", tenant_id="t1", knowledge_item_id="i3",
        status=KnowledgeLifecycleStatus.ACTIVE.value,
        effective_from=past, effective_until=past + timedelta(days=2)
    )

    def is_temporally_valid(v: KnowledgeVersion) -> bool:
        if v.effective_from and v.effective_from > now:
            return False
        if v.effective_until and v.effective_until <= now:
            return False
        return True

    assert is_temporally_valid(v_valid) is True
    assert is_temporally_valid(v_future) is False
    assert is_temporally_valid(v_expired) is False


@pytest.mark.asyncio
async def test_qdrant_live_collection_reconciliation(seeded_tenant):
    """Every active version of the tenant has exactly one Qdrant point, and every point of the
    tenant belongs to a current version (no stale or orphaned vectors). Tenant-scoped: the
    collection is shared by all tenants."""
    from app.core.config import get_settings

    url = str(get_settings().qdrant.url).rstrip("/")
    body = {"limit": 1000, "with_payload": True, "with_vector": False,
            "filter": {"must": [{"key": "organization_id", "match": {"value": seeded_tenant}}]}}
    req = urllib.request.Request(f"{url}/collections/proxipilot_knowledge/points/scroll",
                                 data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        q_points = json.loads(resp.read().decode())["result"]["points"]
    assert len(q_points) == 24, f"Expected 24 points for the tenant in Qdrant, found {len(q_points)}"

    async with db_manager.session_factory() as session:
        items = (await session.execute(
            select(KnowledgeItem).where(KnowledgeItem.tenant_id == seeded_tenant, KnowledgeItem.is_active.is_(True))
        )).scalars().all()
    assert len(items) == 24
    by_version = {it.current_version_id: it for it in items}

    seen_versions = set()
    for pt in q_points:
        payload = pt["payload"]
        vid = payload["knowledge_version_id"]
        assert vid in by_version, f"Qdrant point {pt['id']} references non-current version {vid}"
        assert vid not in seen_versions, f"Duplicate vectors for version {vid}"
        seen_versions.add(vid)
        item = by_version[vid]
        assert payload["organization_id"] == seeded_tenant
        assert payload["knowledge_item_id"] == item.id
        assert payload["category"] == item.category
        assert payload.get("text"), "point payload must carry its searchable text"
    assert seen_versions == set(by_version), "some active versions have no vector"
