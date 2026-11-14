"""Enterprise Multi-Category Ingestion & 10+ Requirement RAG Benchmark Suite.

Benchmarks:
1. 5,000-row Enterprise Ingestion Pipeline:
   - Streaming/Batch Parsing & Profiling
   - Category-Aware Column Mapping with Media Auto-Ignore
   - Row Quality & Type Validation (Zero Silent Loss)
   - PostgreSQL Batch Persistence (Canonical + JSONB Custom Attributes)
   - Category-Aware Semantic Projection Generation
2. 10+ Requirement Complex Multi-Category Email Retrieval:
   - Intent Decomposition (10 independent requirements)
   - Requirement Routing across Categories (Products, Policies, Contacts, FAQs, Operations, Locations, Offers)
   - Hybrid Retrieval (Authoritative PostgreSQL + Semantic Qdrant)
   - Candidate Evidence Fusion & Verification
   - Minimal Evidence Package Generation with Token & Byte Metrics
"""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import os
import time
from typing import Any, Dict, List
import uuid

import pytest
from sqlalchemy import select, text

from app.contracts.column_mapping import MappingReason, MappingTargetKind
from app.contracts.data_quality import BatchQualityResultDTO, QualityRowStatus
from app.contracts.evidence_package import MinimalEvidencePackage
from app.contracts.flexible_schema import CATEGORY_CANONICAL_ALIASES
from app.contracts.requirement_plan import (
    IntentType,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedRequirement,
    PlannedResultCount,
    RequirementPlan,
    RetrievalStrategy,
)
from app.core.database import db_manager
from app.contracts.knowledge import category_registry
from app.models.knowledge import (
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSemanticChunk,
    KnowledgeSource,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
import csv
from pathlib import Path
import tempfile

from app.services.column_mapping_service import ColumnMappingService
from app.services.dataset_profiler import DatasetProfiler
from app.services.evidence_fusion.service import EvidenceFusionService
from app.services.evidence_package.service import evidence_package_service
from app.services.knowledge_persistence import KnowledgePersistenceService
from app.services.knowledge_projection import KnowledgeProjectionService
from app.services.requirement_planner.decomposer import MultiIntentDecomposer
from app.services.retrieval_router import retrieval_router_service
from app.services.row_quality_service import RowQualityService


@pytest.mark.asyncio
async def test_run_comprehensive_enterprise_benchmarks():
    """Run real benchmarks and print verified metrics for documentation."""
    print("\n" + "=" * 80)
    print("PROXIPILOT ENTERPRISE KNOWLEDGE INGESTION & MULTI-CATEGORY RAG BENCHMARK")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # BENCHMARK 1: 5,000-ROW DATASET PARSING, MAPPING & ROW VALIDATION
    # -------------------------------------------------------------------------
    print("\n[BENCHMARK 1] 5,000-Row Dataset Ingestion & Validation Pipeline...")
    
    # Generate 5,000 realistic product records with flexible columns and media
    headers = [
        "Product_SKU", "Item_Title", "Price_INR", "Tax_Rate",
        "Category_Name", "Warranty_Period", "Product_Image_URL",
        "Thumbnail_Path", "User_Manual_Link", "Support_URL",
        "Stock_Status", "Manufacturer_Origin", "Power_Consumption_Watts"
    ]
    
    raw_rows = []
    for i in range(1, 5001):
        raw_rows.append([
            f"PROD-{i:05d}",
            f"Enterprise Smart Device Pro Model-{i}",
            f"{15000 + (i % 50000)}",
            "18.0",
            "Electronics",
            "2 Years Comprehensive",
            f"https://cdn.retailer.com/products/img_{i}.jpg",
            f"/images/thumbs/thumb_{i}.png",
            f"https://docs.retailer.com/manuals/manual_{i}.pdf",
            f"https://support.retailer.com/help/{i}",
            "In Stock" if i % 10 != 0 else "Backorder",
            "India",
            f"{45 + (i % 200)}"
        ])
    
    # Write to a temporary CSV file for streaming parser benchmark
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="", encoding="utf-8") as tf:
        writer = csv.writer(tf)
        writer.writerow(headers)
        writer.writerows(raw_rows)
        temp_csv_path = Path(tf.name)

    try:
        # 1.1 Parsing & Profiling via streaming DatasetProfilerService
        t0 = time.perf_counter()
        profiler = DatasetProfiler()
        profile = profiler.profile_file(file_path=temp_csv_path, file_type="csv")
        t_parse = time.perf_counter() - t0
    finally:
        if temp_csv_path.exists():
            os.remove(temp_csv_path)
    
    # 1.2 Column Mapping with Media Auto-Ignore
    t0 = time.perf_counter()
    mapping_service = ColumnMappingService()
    db_manager.initialize()
    async with db_manager.session_factory() as session:
        mapping_plan = await mapping_service.detect_and_compile_mapping(
            db=session,
            tenant_id="tenant_bench_001",
            category="products_services",
            profile=profile,
        )
    t_mapping = time.perf_counter() - t0
    
    # Verify media ignoring
    image_col = next(c for c in mapping_plan.columns if c.source_column == "Product_Image_URL")
    thumb_col = next(c for c in mapping_plan.columns if c.source_column == "Thumbnail_Path")
    manual_col = next(c for c in mapping_plan.columns if c.source_column == "User_Manual_Link")
    support_col = next(c for c in mapping_plan.columns if c.source_column == "Support_URL")
    
    assert image_col.target_kind == MappingTargetKind.IGNORED
    assert image_col.reason == MappingReason.MEDIA_IGNORED
    assert thumb_col.target_kind == MappingTargetKind.IGNORED
    assert thumb_col.reason == MappingReason.MEDIA_IGNORED
    assert manual_col.target_kind != MappingTargetKind.IGNORED  # Preserved!
    assert support_col.target_kind != MappingTargetKind.IGNORED  # Preserved!

    # 1.3 Row Quality Validation
    t0 = time.perf_counter()
    quality_service = RowQualityService(
        tenant_id="tenant_bench_001",
        category="products_services",
        mapping_plan=mapping_plan,
        headers=headers,
    )
    normalized_records = []
    for idx, row in enumerate(raw_rows, start=1):
        rec = quality_service.process_row(row_number=idx, row_values=row)
        normalized_records.append(rec)
    t_validation = time.perf_counter() - t0

    assert len(normalized_records) == 5000
    valid_records = [r for r in normalized_records if r.status in (QualityRowStatus.VALID, QualityRowStatus.WARNING)]
    assert len(valid_records) == 5000, f"Expected 5000 valid records, found {len(valid_records)}. Sample issue: {normalized_records[0].issues}"

    print(f"  - Parse & Profile Time (5,000 rows)     : {t_parse*1000:.2f} ms ({5000/t_parse:.0f} rows/sec)")
    print(f"  - Column Mapping & Media Ignore Time    : {t_mapping*1000:.2f} ms")
    print(f"  - Row Quality Validation Time (5,000 r) : {t_validation*1000:.2f} ms ({5000/t_validation:.0f} rows/sec)")
    print(f"  - Total Ingestion Prep Time (5,000 rows): {(t_parse + t_mapping + t_validation)*1000:.2f} ms")

    # -------------------------------------------------------------------------
    # BENCHMARK 2: POSTGRESQL CANONICAL PERSISTENCE
    # -------------------------------------------------------------------------
    print("\n[BENCHMARK 2] PostgreSQL Canonical Persistence Batch Benchmark...")
    batch_size = 500
    test_tenant = f"org_bench_{uuid.uuid4().hex[:10]}"
    source_id = f"ks_bench_{uuid.uuid4().hex[:10]}"
    
    batch_records = valid_records[:batch_size]
    batch = BatchQualityResultDTO(
        batch_index=0,
        total_rows=len(batch_records),
        valid_count=len(batch_records),
        warning_count=0,
        invalid_count=0,
        duplicate_count=0,
        conflict_count=0,
        records=batch_records,
    )

    t0 = time.perf_counter()
    async with db_manager.session_factory() as session:
        now = datetime.now(timezone.utc)
        src = KnowledgeSource(
            id=source_id,
            tenant_id=test_tenant,
            name="Bench Source",
            source_type="import",
            authority_level="imported_data",
            created_at=now,
            updated_at=now,
        )
        session.add(src)
        await session.commit()

        persistence = KnowledgePersistenceService(
            tenant_id=test_tenant,
            category="products_services",
            source_id=source_id,
            job_id="job_bench_01",
            created_by_user_id="bench_user",
        )
        persist_result = await persistence.persist_batch(session, batch)
    t_persist = time.perf_counter() - t0

    print(f"  - DB Batch Insert Time ({batch_size} records)       : {t_persist*1000:.2f} ms ({batch_size/t_persist:.0f} records/sec)")
    print(f"  - Extrapolated Structured-Ready (5,000 r): {(t_persist * (5000/batch_size)):.2f} seconds")

    # -------------------------------------------------------------------------
    # BENCHMARK 3: CATEGORY-AWARE SEMANTIC PROJECTION BENCHMARK
    # -------------------------------------------------------------------------
    print("\n[BENCHMARK 3] Category-Aware Semantic Projection Generation Benchmark...")
    projection_service = KnowledgeProjectionService()

    t0 = time.perf_counter()
    projections = []
    for rec in batch_records:
        item = KnowledgeItem(
            id=f"ki_{rec.identity_key}",
            tenant_id=test_tenant,
            title=rec.canonical_data.get("name", "Product"),
            category="products_services",
            external_identity_key=rec.identity_key,
            is_active=True,
        )
        ver = KnowledgeVersion(
            id=f"kv_{rec.identity_key}",
            tenant_id=test_tenant,
            knowledge_item_id=item.id,
            version_number=1,
            status=KnowledgeLifecycleStatus.ACTIVE.value,
            canonical_data=rec.canonical_data,
            effective_from=datetime.now(timezone.utc),
        )
        doc = projection_service.project_item_version(item=item, version=ver)
        projections.append(doc)
    t_projection = time.perf_counter() - t0

    sample_proj_text = projections[0].chunks[0].text
    # Ensure projected text does NOT contain ignored image URLs
    assert "cdn.retailer.com" not in sample_proj_text
    assert "thumb" not in sample_proj_text

    print(f"  - Projection Generation Time ({batch_size} items)   : {t_projection*1000:.2f} ms ({batch_size/t_projection:.0f} items/sec)")
    print(f"  - Extrapolated Projection Time (5,000 r) : {(t_projection * (5000/batch_size)):.2f} seconds")

    # -------------------------------------------------------------------------
    # BENCHMARK 4: 10+ REQUIREMENT MULTI-INTENT EMAIL RAG BENCHMARK
    # -------------------------------------------------------------------------
    print("\n[BENCHMARK 4] 10+ Requirement Multi-Intent RAG Retrieval Benchmark...")
    complex_email = (
        "I am considering your laptop products. Share the best eligible models under \u20b970,000, "
        "compare warranty, explain the return policy, tell me delivery timelines to Mumbai, "
        "share the retailer contact for bulk orders, check whether an offer applies, "
        "explain the overheating issue, provide the service-center location, "
        "and tell me the installation process."
    )

    # 4.1 Multi-Intent Decomposition
    t0 = time.perf_counter()
    requirements = MultiIntentDecomposer.decompose(text=complex_email)
    t_decomp = time.perf_counter() - t0

    print(f"  - 10-Intent Decomposition Latency        : {t_decomp*1000:.2f} ms")
    print(f"  - Independent Requirements Preserved     : {len(requirements)}")
    for r in requirements:
        print(f"    * [{r.requirement_id}] cat={r.category:18s} intent={r.intent.value:20s} deps={r.dependencies}")

    # 4.2 Requirement Plan Compilation
    plan = RequirementPlan(
        plan_id=f"plan_{uuid.uuid4().hex[:12]}",
        tenant_id="org_31d214d315c84be29023395466af2f28",
        integration_account_id="int_bench_01",
        thread_id="th_bench_01",
        message_id="msg_bench_01",
        context_revision=1,
        intent=IntentType.PRODUCT_DISCOVERY,
        retrieval_strategy=RetrievalStrategy.HYBRID,
        query_text=complex_email,
        requirements=requirements,
    )

    # 4.3 Hybrid Multi-Category Retrieval Execution
    t0 = time.perf_counter()
    retrieval_result = await retrieval_router_service.route_and_retrieve(
        tenant_id="org_31d214d315c84be29023395466af2f28",
        plan=plan,
        dispatch_event=False,
    )
    t_retrieval = time.perf_counter() - t0

    print(f"  - Hybrid Retrieval Latency (10 Reqs)     : {t_retrieval*1000:.2f} ms")
    print(f"  - Retrieved Items Total Count            : {len(retrieval_result.results)}")
    print(f"  - Retrieval Overall Status               : {retrieval_result.status.value}")

    # 4.4 Evidence Fusion & Grouping
    t0 = time.perf_counter()
    fusion_service = EvidenceFusionService()
    verified_evidence = await fusion_service.fuse_and_verify(
        tenant_id="org_31d214d315c84be29023395466af2f28",
        plan=plan,
        retrieval_result=retrieval_result,
        envelope=None,
        dispatch_event=False,
    )
    t_fusion = time.perf_counter() - t0

    print(f"  - Evidence Fusion Latency                : {t_fusion*1000:.2f} ms")
    print(f"  - Fusion Groups Preserved                : {len(verified_evidence.requirements)}")
    for g in verified_evidence.requirements:
        print(f"    * Group [{g.requirement_id}] req={g.requirement_type.value:18s} status={g.status.value:12s} candidates={len(g.verified_candidates)}")

    # 4.5 Minimal Evidence Package Assembling
    t0 = time.perf_counter()
    package = await evidence_package_service.build_package(
        tenant_id="org_31d214d315c84be29023395466af2f28",
        fusion_result=verified_evidence,
        envelope=None,
        plan=plan,
        dispatch_event=False,
    )
    t_package = time.perf_counter() - t0

    raw_json_len = len(retrieval_result.model_dump_json())
    mep_json_len = len(package.model_dump_json())
    payload_reduction = ((raw_json_len - mep_json_len) / raw_json_len) * 100.0

    print(f"  - Minimal Evidence Package Assembly Time : {t_package*1000:.2f} ms")
    print(f"  - Package Status                         : {package.package_status.value}")
    print(f"  - Estimated Token Count                  : {package.budget_metrics.estimated_tokens}")
    print(f"  - Raw Payload Size                       : {raw_json_len} bytes")
    print(f"  - Minimal Evidence Package Size          : {mep_json_len} bytes ({payload_reduction:.1f}% reduction)")
    
    total_rag_latency = (t_decomp + t_retrieval + t_fusion + t_package) * 1000.0
    print(f"  - TOTAL 10-INTENT END-TO-END RAG LATENCY : {total_rag_latency:.2f} ms (avg {total_rag_latency/len(requirements):.2f} ms/requirement)")
    print("=" * 80 + "\n")

    # Cleanup temporary test tenant
    try:
        async with db_manager.session_factory() as session:
            await session.execute(text(f"DELETE FROM knowledge_versions WHERE tenant_id = '{test_tenant}'"))
            await session.execute(text(f"DELETE FROM knowledge_items WHERE tenant_id = '{test_tenant}'"))
            await session.execute(text(f"DELETE FROM knowledge_sources WHERE tenant_id = '{test_tenant}'"))
            await session.commit()
    except Exception as e:
        print(f"Note: Cleanup encountered harmless transient issue: {e}")
