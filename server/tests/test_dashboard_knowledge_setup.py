"""Dashboard "Add business knowledge" step: done only when the business has added Products &
Services and at least one more category of its own. Registration data never counts."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text

from app.services.dashboard_overview import knowledge_setup
from conftest import REMOTE_DATABASE_BLOCKED

needs_db = pytest.mark.skipif(REMOTE_DATABASE_BLOCKED, reason="needs the local throwaway database")


@pytest.mark.parametrize("by_category,facts,ready,next_step", [
    ({}, None, False, "add_products_services"),                                     # just registered
    ({"policies": 3}, None, False, "add_products_services"),                        # no catalogue
    ({"policies": 3, "support_faqs": 9}, None, False, "add_products_services"),     # 2 categories, no catalogue
    ({"products_services": 40}, None, False, "add_another_category"),               # catalogue only
    ({"products_services": 40, "policies": 2}, None, True, None),
    ({"products_services": 40}, {"contact_routes": [{"value": "a@b.example"}]}, True, None),  # editor facts count
    ({"products_services": 40}, {"visit_policy": "unknown", "hours": [], "not_applicable": ["branches"],
                                 "public_name": None}, False, "add_another_category"),  # defaults don't
    ({"products_services": 0, "policies": 1}, None, False, "add_products_services"),  # zero rows ignored
])
def test_rule(by_category, facts, ready, next_step):
    out = knowledge_setup(by_category, facts)
    assert out["ready"] is ready and out["next_step"] == next_step
    assert out["required_category"] == "products_services" and out["min_categories"] == 2


def test_user_items_counts_rows_not_the_company_info_flag():
    out = knowledge_setup({"products_services": 5}, {"languages": ["English"]})
    assert out["user_items"] == 5 and "company_info" in out["categories_with_data"]


@needs_db
async def test_fresh_registration_is_not_ready_then_becomes_ready():
    """End to end on the local DB: the registration-built Company Info record is ignored."""
    from app.contracts.knowledge_crud import KnowledgeItemCreateDTO
    from app.core.database import db_manager
    from app.services import company_info as ci
    from app.services.dashboard_overview import build_overview
    from app.services.knowledge_crud import knowledge_crud_service
    from tests.followup_world import build_world, destroy_world

    w = await build_world(f"ks{uuid.uuid4().hex[:8]}")
    try:
        async with db_manager.session_factory() as db:          # registration-style managed record
            await ci.refresh(db, w.tenant_id, w.users["owner"], "registration")
            await db.commit()
            n = (await db.execute(text("SELECT count(*) FROM knowledge_items WHERE tenant_id=:t"),
                                  {"t": w.tenant_id})).scalar()
            ov = await build_overview(db, w.tenant_id)
        assert n == 1 and ov["workspace"]["knowledge_items"] == 1
        assert ov["knowledge"]["ready"] is False and ov["knowledge"]["user_items"] == 0
        assert ov["knowledge"]["next_step"] == "add_products_services"

        owner = w.users["owner"]
        for cat, title, data in (
            ("products-services", "RO purifier", {"name": "RO purifier", "entity_type": "PRODUCT", "price": 12000}),
            ("policies", "Warranty", {"policy_name": "Warranty", "policy_type": "warranty", "details": "1 year"}),
        ):
            async with db_manager.session_factory() as db:
                await knowledge_crud_service.create_item(db, w.tenant_id, owner, KnowledgeItemCreateDTO(
                    category=cat, title=title, canonical_data=data))
            async with db_manager.session_factory() as db:
                ov = await build_overview(db, w.tenant_id)
            if cat == "products-services":
                assert ov["knowledge"]["next_step"] == "add_another_category" and not ov["knowledge"]["ready"]
        assert ov["knowledge"]["ready"] is True and ov["knowledge"]["user_items"] == 2
    finally:
        await destroy_world(w)
