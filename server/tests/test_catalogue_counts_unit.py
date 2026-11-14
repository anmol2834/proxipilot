"""Unit tests: exact catalogue counts + variant-aware product identity (no data loss on import)."""
from types import SimpleNamespace

from app.algorithms.deduplication.category_identity import CategoryIdentityResolver
from app.services.context_engine import count_terms, format_catalogue_overview, requested_terms


def _key(canonical, custom=None):
    return CategoryIdentityResolver.resolve_identity_key("org_t", "products_services", canonical, custom, 1)


def test_count_terms_normalises_plurals_and_drops_filler():
    assert count_terms("Grab Bars") == ["grab", "bar"]
    assert count_terms("soap dispensers") == ["soap", "dispenser"]
    assert count_terms("batteries") == ["battery"]
    assert count_terms("towel rails 600mm") == ["towel", "rail", "600mm"]
    assert count_terms("glass") == ["glass"]          # 'ss' endings are not singularised
    assert count_terms("how many products do you have") == []


def test_requested_terms_dedupes_across_requirements():
    pkg = SimpleNamespace(requirements=[
        SimpleNamespace(target_entities=["Grab bar", "soap dispenser"]),
        SimpleNamespace(target_entities=["grab BAR", ""]),
    ])
    assert requested_terms(pkg) == ["Grab bar", "soap dispenser"]
    assert requested_terms(SimpleNamespace(requirements=None)) == []


def test_overview_reports_exact_term_counts_and_zero_matches():
    text = format_catalogue_overview(5101, [("products_services", 5101)], [("MARZEL", 125)], False,
                                     [("grab bar", 37), ("jacuzzi", 0)])
    assert "5,101" in text
    assert 'matching "grab bar": 37' in text
    assert 'matching "jacuzzi": 0' in text and "do not claim" in text
    assert "NOT recorded" in text
    assert format_catalogue_overview(0, [], [], False) is None


def test_variants_sharing_a_name_get_distinct_identities():
    a = _key({"name": "Grab Bar", "price": 500}, {"Size": "600 mm", "Finish": "Chrome"})
    b = _key({"name": "Grab Bar", "price": 700}, {"Size": "450 mm", "Finish": "Chrome"})
    assert a != b  # both rows are kept on import


def test_price_change_keeps_the_same_identity_so_reupload_updates():
    a = _key({"name": "Grab Bar", "price": 500}, {"Size": "600 mm", "Description": "old"})
    b = _key({"name": "Grab Bar", "price": 999}, {"Size": "600 mm", "Description": "new", "Stock Qty": 4})
    assert a == b


def test_sku_identity_unchanged_and_long_variants_bounded():
    assert _key({"name": "X", "sku": "A1"}).endswith(":ext:A1")
    long_key = _key({"name": "Panel"}, {f"size_{i}": "x" * 40 for i in range(20)})
    assert len(long_key) < 300 and "|var:h:" in long_key
