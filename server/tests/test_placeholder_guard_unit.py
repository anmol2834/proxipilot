"""Replies must never contain template placeholders instead of verified values."""
from app.services.reply_planner.validator import _placeholders_in


def test_masked_prices_and_slots_are_caught():
    body = "Model: DACN000X\nUnit Price: ₹ XX,XXX + GST\nTotal: Rs. XXXX\nDelivery by [delivery date]. Price: [price]"
    found = _placeholders_in(body)
    assert any("XX,XXX" in f for f in found)
    assert any("XXXX" in f for f in found)
    assert "[delivery date]" in found and "[price]" in found


def test_real_values_and_codes_are_not_flagged():
    body = ("ABS Air Curtain With Remote Control - ₹24,790. Size XL, model DX-200, code XLR-45. "
            "Box of 10 (XX-Large fits).")
    assert _placeholders_in(body) == []
