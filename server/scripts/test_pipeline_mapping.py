"""Run DatasetProfiler and ColumnMappingService on the actual Excel dataset to see full mapping."""
import asyncio
from pathlib import Path
from app.core.database import db_manager
from app.services.dataset_profiler import DatasetProfiler
from app.services.column_mapping_service import ColumnMappingService

async def main():
    excel_path = Path(r"C:\Users\anmol\Downloads\ProxiPilot_Home_Appliance_Service_Enterprise_Dataset.xlsx")
    profiler = DatasetProfiler()
    profile = profiler.profile_file(excel_path, "xlsx")

    print(f"Total rows profiled: {profile.quality_summary.total_rows}")
    print(f"Total columns profiled: {len(profile.columns)}")

    mapping_service = ColumnMappingService()
    async with db_manager.session_factory() as session:
        plan = await mapping_service.detect_and_compile_mapping(
            db=session,
            tenant_id="test_tenant",
            category="products_services",
            profile=profile,
            source_type="xlsx",
        )

    print("\n=== COMPILED COLUMN MAPPINGS ===")
    for col in plan.columns:
        print(f"[{col.source_column:25}] -> target={str(col.target_field):22} | kind={col.target_kind.value:18} | reason={col.reason.value}")

if __name__ == "__main__":
    asyncio.run(main())
