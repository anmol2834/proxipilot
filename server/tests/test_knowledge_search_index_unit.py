"""Indexed retrieval projection: facet derivation (same classifiers as retrieval) and the SQL the
indexed candidate fetch issues (every hard constraint in SQL; exact top-N for price order;
exhaustion reported when matches exceed the budget)."""

import asyncio
from types import SimpleNamespace

from app.services import knowledge_search_index as ksi
import importlib

sr = importlib.import_module("app.services.retrieval_router.structured_retriever")
from app.services.retrieval_router.entity_eligibility import NominalConstraint


def test_compute_facets_uses_retrieval_classifiers():
    f = ksi.compute_facets("ki_1", "t1", "products_services", "Glass Door Thermo Electric Mini Bar 30 LTR", "dmbr0009",
                           {"custom_attributes": {"category": "Mini Bar", "product_type": "Finish Goods"},
                            "pricing": {"base_price": 19570.0}, "brand": "ACME"})
    assert f.family == "mini bar" and f.item_role == "FINISHED_GOOD" and f.code_upper == "DMBR0009"
    assert float(f.price) == 19570.0 and f.volume_ml == 30000.0
    part = ksi.compute_facets("ki_2", "t1", "products_services", "Thermostat Suitable For Model DMBR0008", "X1",
                              {"custom_attributes": {"category": "Mini Bar Spare Parts", "product_type": "Spare Parts"}})
    assert part.item_role == "SPARE_PART" and part.price is None
    bundle = ksi.compute_facets("ki_3", "t1", "products_services", "Soap Dispenser Set of 2 300ML", "S2",
                                {"custom_attributes": {"category": "Soap Dispenser", "product_type": "Finish Goods"},
                                 "price": 1180})
    assert bundle.item_role == "BUNDLE" and bundle.volume_ml == 300.0


class _Db:
    def __init__(self, total, ids):
        self.sql, self.params, self.total, self.ids = [], [], total, ids

    async def execute(self, stmt, params=None):
        q = str(stmt)
        self.sql.append(q)
        self.params.append(dict(params or {}))
        if "count(*)" in q:
            return SimpleNamespace(scalar=lambda: self.total)
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: self.ids))


def _fetch(monkeypatch, total, ids, **kw):
    async def batch(db, tenant_id, item_ids, as_of=None):
        return {i: (SimpleNamespace(id=i), SimpleNamespace()) for i in item_ids}
    monkeypatch.setattr(sr.CanonicalKnowledgeReader, "get_current_items_batch", staticmethod(batch))
    db = _Db(total, ids)
    res = asyncio.run(sr.StructuredRetriever().fetch_indexed_candidates(db=db, tenant_id="t1", **kw))
    return res, db


def test_cheapest_is_exact_over_whole_catalogue(monkeypatch):
    nominal = [NominalConstraint(kind="volume", wanted=[30000.0], excluded=[40000.0], original="30 liter")]
    (items, exhaustive, total), db = _fetch(monkeypatch, 5000, ["ki_a", "ki_b"], families=["Mini Bar"],
                                            roles=["FINISHED_GOOD"], nominal=nominal, price_order="asc", top_n=1)
    q = db.sql[-1]
    assert "family = ANY(:fams)" in q and "item_role = ANY(:roles)" in q and "volume_ml BETWEEN" in q
    assert "NOT (volume_ml BETWEEN" in q and "ORDER BY price ASC NULLS LAST" in q
    assert db.params[-1]["fams"] == ["mini bar"] and exhaustive is True and total == 5000
    assert [i.id for i, _ in items] == ["ki_a", "ki_b"]


def test_budget_overflow_is_reported_not_hidden(monkeypatch):
    (items, exhaustive, total), db = _fetch(monkeypatch, 12000, ["ki_x"], families=["Hand Dryer"], budget=2000)
    assert exhaustive is False and total == 12000 and db.params[-1]["lim"] == 2000
    (items, exhaustive, total), db = _fetch(monkeypatch, 800, ["ki_y"], families=["Hand Dryer"], budget=2000)
    assert exhaustive is True and db.params[-1]["lim"] == 800


def test_no_match_is_exhaustive_and_cheap(monkeypatch):
    (items, exhaustive, total), db = _fetch(monkeypatch, 0, [], families=["Hand Dryer"])
    assert items == [] and exhaustive is True and total == 0 and len(db.sql) == 1   # count only


def test_falls_back_when_index_table_is_missing():
    class Broken:
        async def execute(self, *_a, **_k):
            raise RuntimeError('relation "knowledge_search_index" does not exist')
    ksi._presence.clear()
    assert asyncio.run(ksi.is_available(Broken(), "t_missing")) is False
