"""Regression (QA audit 2026-11-15): evidence fusion must not query the tenant's configured
categories on every call (one extra DB session per email; it also made the 10k fusion burst
benchmark DB-bound and time out). Cached per tenant, invalidated on import completion."""

import asyncio

from app.services.evidence_fusion import service as fusion_mod


class _Rows:
    def __init__(self, cats):
        self._cats = cats

    def fetchall(self):
        return [(c,) for c in self._cats]


class _Db:
    def __init__(self, cats):
        self.cats = cats
        self.queries = 0

    async def execute(self, _stmt):
        self.queries += 1
        return _Rows(self.cats)


def test_cached_per_tenant_and_invalidated(monkeypatch):
    fusion_mod._CONFIGURED_CATEGORIES.clear()
    db = _Db(["products_services", "policies", None])

    async def run():
        a = await fusion_mod.configured_categories_for("t_a", db)
        b = await fusion_mod.configured_categories_for("t_a", db)
        assert a == b == {"products_services", "policies"}
        assert db.queries == 1                      # second call served from cache

        await fusion_mod.configured_categories_for("t_b", db)
        assert db.queries == 2                      # never shared across tenants

        db.cats = ["products_services", "policies", "processes_timelines"]
        fusion_mod.invalidate_configured_categories("t_a")
        assert "processes_timelines" in await fusion_mod.configured_categories_for("t_a", db)

        monkeypatch.setattr(fusion_mod, "CONFIGURED_CATEGORIES_TTL_S", 0.0)
        await fusion_mod.configured_categories_for("t_a", db)
        assert db.queries == 4                      # expired entries are reloaded

    asyncio.run(run())


def test_failure_is_not_cached():
    fusion_mod._CONFIGURED_CATEGORIES.clear()

    class Broken:
        async def execute(self, _stmt):
            raise ConnectionError("db down")

    async def run():
        assert await fusion_mod.configured_categories_for("t_x", Broken()) == set()
        assert "t_x" not in fusion_mod._CONFIGURED_CATEGORIES

    asyncio.run(run())
