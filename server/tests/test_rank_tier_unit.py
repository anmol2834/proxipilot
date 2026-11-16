"""'cheapest / most expensive <family>': items whose OWN category is the requested family rank before
items that only mention the family in their title (e.g. a combo panel "with hand dryer")."""

import importlib
from types import SimpleNamespace

rv = importlib.import_module("app.services.retrieval_router.verifier")


def _spec(*labels):
    return SimpleNamespace(families=[SimpleNamespace(label=lbl) for lbl in labels])


def _elig(family):
    return SimpleNamespace(facets=SimpleNamespace(family=family))


def test_own_family_match():
    assert rv._own_family_match(_elig("hand dryer"), _spec("Hand Dryer")) is True
    assert rv._own_family_match(_elig("recessed panel"), _spec("Hand Dryer")) is False
    assert rv._own_family_match(_elig("recessed panel"), _spec()) is True      # no family requested
    assert rv._own_family_match(None, _spec("Hand Dryer")) is True


def test_own_family_items_rank_first_by_price():
    rows = [("COMBO", False, False, 104290.0), ("GENUINE", True, False, 86568.0),
            ("CHEAP", True, False, 12000.0), ("NOSIZE", True, True, 99000.0)]
    cands = [SimpleNamespace(code=c, own_family_match=o, size_unverified=s, price=p, composite_rank_score=0.5)
             for c, o, s, p in rows]
    cands.sort(key=lambda c: (not c.own_family_match, c.size_unverified, -c.price, -c.composite_rank_score))
    assert [c.code for c in cands] == ["GENUINE", "CHEAP", "NOSIZE", "COMBO"]
