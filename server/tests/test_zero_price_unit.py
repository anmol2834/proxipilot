"""A 0 / blank catalogue price means "not listed": never evidence, never quoted, never "₹0" text."""
from types import SimpleNamespace

from app.models.knowledge import KnowledgeItem, KnowledgeVersion
from app.services.hybrid_retrieval import _has_real_price
from app.services.knowledge_projection import KnowledgeProjectionService


def test_has_real_price():
    assert _has_real_price(95, 95)
    assert _has_real_price(0, 120)          # total present
    assert not _has_real_price(0, 0)
    assert not _has_real_price(None, None)
    assert not _has_real_price("0.00", "0")
    assert not _has_real_price("abc", None)


def _project(price):
    cd = {"sku": "M4-NUT", "name": "Ms Nut Zinc-4mm", "price": price, "currency": "INR", "base_price": price,
          "final_price": price, "pricing": {"currency": "INR", "base_price": price, "estimated_total": price},
          "custom_attributes": {"category": "Raw Material", "retail_price": str(price), "mrp": str(price)}}
    item = KnowledgeItem(id="ki", tenant_id="t", title=cd["name"], category="products_services", source_id="s")
    ver = KnowledgeVersion(id="kv", knowledge_item_id="ki", tenant_id="t", version_number=1, status="active",
                           canonical_data=cd, authority_level="imported_data")
    return KnowledgeProjectionService().project_item_version(item, ver).full_text


def test_projection_never_writes_zero_price():
    text = _project(0.0)
    assert "price on request" in text
    assert "₹0" not in text and "0.00" not in text
    assert "₹95.00" in _project(95.0)


def test_validator_rejects_zero_price_quote():
    from app.contracts.evidence_package import EvidenceFactType
    from app.services.reply_planner.validator import DeterministicReplyValidator

    issues = []
    draft = SimpleNamespace(body_text="The price of Ms Nut Zinc-4mm is ₹0.00.")
    # A 0-valued numeric fact (e.g. a 0% discount) must not make a "₹0" quote look grounded.
    package = SimpleNamespace(requirements=[SimpleNamespace(facts=[
        SimpleNamespace(attribute_name="discount", fact_type=EvidenceFactType.STRUCTURED_NUMERIC, typed_value=0)])])
    DeterministicReplyValidator()._verify_exact_prices(draft, package, issues)
    assert any(i.issue_code == "PRICE_MISMATCH" and "price of 0" in i.description for i in issues)

    ok_issues = []
    DeterministicReplyValidator()._verify_exact_prices(
        SimpleNamespace(body_text="It costs ₹95.00."),
        SimpleNamespace(requirements=[SimpleNamespace(facts=[
            SimpleNamespace(attribute_name="price", fact_type=None, typed_value=95)])]),
        ok_issues)
    assert not ok_issues
