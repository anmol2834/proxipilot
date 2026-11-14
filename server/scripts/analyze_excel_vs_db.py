"""Deep analysis of Excel sheet vs PostgreSQL knowledge tables vs Qdrant."""
import asyncio
import json
import openpyxl
import httpx
from sqlalchemy import text
from app.core.database import db_manager

async def main():
    excel_path = r"C:\Users\anmol\Downloads\ProxiPilot_Home_Appliance_Service_Enterprise_Dataset.xlsx"
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    sheet = wb["Home_Appliance_Services"]
    rows = list(sheet.iter_rows(values_only=True))
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    
    excel_records = {}
    for r in rows[1:]:
        row_dict = dict(zip(headers, r))
        name = row_dict.get("service_name")
        if name:
            excel_records[name] = row_dict

    print(f"=== EXCEL DATASET ANALYSIS ===")
    print(f"Total Rows: {len(excel_records)}")
    print(f"Total Columns: {len(headers)}")
    print(f"Columns: {headers}\n")

    async with db_manager.session_factory() as session:
        res = await session.execute(text("""
            SELECT ki.id, ki.title, ki.category, kv.canonical_data, kv.content_text 
            FROM knowledge_items ki 
            JOIN knowledge_versions kv ON ki.current_version_id = kv.id
            ORDER BY ki.title
        """))
        db_items = res.fetchall()

        # Check import_jobs metadata
        res_job = await session.execute(text("SELECT id, metadata_json FROM import_jobs"))
        for jid, meta in res_job.fetchall():
            print(f"\n=== IMPORT JOB {jid} METADATA ===")
            if isinstance(meta, str):
                meta = json.loads(meta)
            plan = meta.get("mapping_plan") if meta else None
            if plan:
                print("Field Mappings in Compiled Plan:")
                for fm in plan.get("field_mappings", []):
                    print(f"  {fm.get('source_column')} -> {fm.get('target_field')} (kind={fm.get('target_kind')}, norm={fm.get('normalization_rule')})")
                print("Unmapped columns in Plan:", plan.get("unmapped_columns"))
            else:
                print("Metadata keys:", list(meta.keys()) if meta else None)

    print(f"=== POSTGRESQL DATABASE ANALYSIS ===")
    print(f"Total Live Items: {len(db_items)}")

    # Check missing columns on a representative record
    sample_title = "AC General Service"
    excel_sample = excel_records.get(sample_title, {})
    db_sample = next((item for item in db_items if item[1] == sample_title), db_items[0] if db_items else None)

    if db_sample:
        title, cat, cdata, content = db_sample[1], db_sample[2], db_sample[3], db_sample[4]
        print(f"\nComparing '{title}':")
        
        db_flat = {}
        if isinstance(cdata, dict):
            for k, v in cdata.items():
                if k == "custom_attributes" and isinstance(v, dict):
                    for ck, cv in v.items():
                        db_flat[f"custom:{ck}"] = cv
                else:
                    db_flat[f"canonical:{k}"] = v
                    
        # Check mapping of all Excel headers
        missing_columns = []
        present_columns = {}
        for h in headers:
            # check if h or mapped key exists in db_flat
            found_key = None
            for dbk in db_flat.keys():
                clean_dbk = dbk.split(":", 1)[1]
                if clean_dbk == h or (clean_dbk == "name" and h == "service_name") or (clean_dbk == "price" and h == "base_price"):
                    found_key = dbk
                    break
            if found_key:
                present_columns[h] = (found_key, db_flat[found_key], excel_sample.get(h))
            else:
                missing_columns.append((h, excel_sample.get(h)))

        print(f"\n1. Columns Present in PostgreSQL ({len(present_columns)}):")
        for h, (dbk, dbv, exv) in present_columns.items():
            print(f"   [FOUND] {h} -> [{dbk}] DB='{dbv}' | Excel='{exv}'")

        print(f"\n2. Columns Completely Missing in PostgreSQL ({len(missing_columns)}):")
        for h, exv in missing_columns:
            print(f"   [MISSING] {h} | Excel='{exv}'")

    # Qdrant Analysis
    print(f"\n=== QDRANT VECTOR DATABASE ANALYSIS ===")
    async with httpx.AsyncClient() as client:
        r = await client.post("http://localhost:6333/collections/proxipilot_knowledge/points/scroll", json={
            "limit": 3,
            "with_payload": True,
            "with_vector": False
        })
        pts = r.json().get("result", {}).get("points", [])
        print(f"Total fetched sample points: {len(pts)}")
        for pt in pts:
            payload = pt.get("payload", {})
            print(f"\n--- Point: {pt.get('id')} ---")
            print(f"Title in payload: {payload.get('title')}")
            print(f"Category: {payload.get('category')}")
            print(f"Section: {payload.get('section')}")
            print(f"Text content:\n{payload.get('text')}")

if __name__ == "__main__":
    asyncio.run(main())
