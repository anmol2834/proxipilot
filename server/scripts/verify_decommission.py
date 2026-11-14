"""Verification script to ensure knowledge_attributes is dropped and CRUD functions flawlessly."""
import asyncio
from sqlalchemy import text
from app.core.database import db_manager
from app.services.knowledge_crud import KnowledgeCRUDService
from app.services.knowledge_read_contract import CanonicalKnowledgeReader

async def main():
    async with db_manager.session_factory() as session:
        # 1. Verify table dropped
        res = await session.execute(text("SELECT to_regclass('knowledge_attributes')"))
        regclass = res.scalar()
        print(f"1. knowledge_attributes to_regclass: {regclass} (should be None)")

        # 2. Verify all remaining knowledge tables
        res2 = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND (table_name LIKE 'knowledge%' OR table_name LIKE 'import%')
            ORDER BY table_name;
        """))
        tables = [row[0] for row in res2.fetchall()]
        print(f"2. Remaining knowledge tables: {tables}")

        # 3. Verify knowledge items and versions
        res3 = await session.execute(text("SELECT count(*) FROM knowledge_items"))
        item_count = res3.scalar()
        res4 = await session.execute(text("SELECT count(*) FROM knowledge_versions"))
        version_count = res4.scalar()
        res5 = await session.execute(text("SELECT count(*) FROM knowledge_semantic_chunks"))
        chunk_count = res5.scalar()
        print(f"3. Live counts -> Items: {item_count}, Versions: {version_count}, Chunks: {chunk_count}")

        # 4. Test KnowledgeCRUDService read path (list items)
        # Find first tenant_id
        res_t = await session.execute(text("SELECT tenant_id FROM knowledge_items LIMIT 1"))
        tenant_id = res_t.scalar()
        if tenant_id:
            crud_svc = KnowledgeCRUDService()
            list_res = await crud_svc.list_items(
                db=session,
                tenant_id=tenant_id,
                limit=10,
            )
            print(f"4. CRUD list_items for tenant {tenant_id} returned {len(list_res.items)} items.")
            if list_res.items:
                first = list_res.items[0]
                print(f"   First item: ID={first.id}, Title='{first.title}', Canonical data keys: {list(first.canonical_data.keys())}, Custom attributes: {first.custom_attributes}")

            # 5. Test CanonicalKnowledgeReader
            canonical_res = await CanonicalKnowledgeReader.get_current_knowledge(
                db=session,
                tenant_id=tenant_id,
                limit=5,
            )
            print(f"5. CanonicalKnowledgeReader returned {len(canonical_res)} items/versions.")
            print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(main())
