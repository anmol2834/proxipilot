"""Reply closing: team sign-off + company name, composed by the server (no placeholders)."""

import time

from app.services.reply_planner.closing import DEFAULT_SIGN_OFF, apply_closing, make_closing

CO = "Dolphy India"


def _tail(text: str, n: int = 2):
    return [ln for ln in text.splitlines() if ln.strip()][-n:]


def test_placeholder_closing_from_the_model_is_replaced():
    body = ("Hi Anmol,\n\nBelow are air curtain models for a 4 ft door.\n\n"
            "If you want recommendations narrowed by budget, tell me.\n\nRegards,\n[Your name]\nSales Team")
    out = apply_closing(body, make_closing("Thanks & Regards,", CO))
    assert "[Your name]" not in out and "Sales Team" not in out and "Regards,\n[" not in out
    assert _tail(out) == ["Thanks & Regards,", CO]
    assert "narrowed by budget, tell me." in out


def test_default_sign_off_when_team_has_none():
    out = apply_closing("Hi,\n\nThe price is ₹1,200.", make_closing(None, CO))
    assert _tail(out) == [DEFAULT_SIGN_OFF, CO]


def test_no_model_closing_just_appends_and_is_idempotent():
    closing = make_closing("Warm regards,", CO)
    once = apply_closing("Hi,\n\nYes, it is in stock.", closing)
    assert apply_closing(once, closing) == once
    assert once.count("Warm regards,") == 1 and once.count(CO) == 1


def test_various_model_closings_are_removed():
    closing = make_closing("Thanks & Regards,", CO)
    for ending in ("Best regards,\nCustomer Support Team", "Thanks and regards\nRavi\nSales Manager",
                   "Sincerely,\n[Your Name]\n[Your Title]", "[Your name]", "Kind regards,\nTeam Dolphy"):
        out = apply_closing(f"Hello,\n\nYour order ships Monday.\n\n{ending}", closing)
        assert _tail(out) == ["Thanks & Regards,", CO], (ending, out)
        assert "[" not in out and "Your order ships Monday." in out


def test_content_after_a_thanks_line_is_not_cut():
    long_line = "We will also send the installation guide and the warranty card with the delivery tomorrow."
    out = apply_closing(f"Hi,\n\nThank you!\n{long_line}", make_closing(None, CO))
    assert long_line in out


def test_placeholders_inside_body_never_reach_the_customer():
    out = apply_closing("Hi,\n\nThis is [Your Name] from [Company Name]; call [phone number].", make_closing(None, CO))
    assert "[" not in out and f"from {CO}" in out


def test_sign_off_that_already_names_the_company_is_not_duplicated():
    out = apply_closing("Hi,\n\nDone.", make_closing("Regards, Team Dolphy India", CO))
    assert out.count(CO) == 1


def test_bad_or_missing_inputs_degrade_safely():
    assert make_closing("[Your name]", CO).sign_off == DEFAULT_SIGN_OFF
    assert _tail(apply_closing("Hi,\n\nOk.", make_closing("", None)), 1) == [DEFAULT_SIGN_OFF]
    assert apply_closing("", make_closing(None, CO)) == f"{DEFAULT_SIGN_OFF}\n{CO}"


def test_is_fast():
    body = "Hi,\n\n" + "\n".join(f"- Item {i} — ₹{i * 100}" for i in range(40)) + "\n\nRegards,\n[Your name]"
    closing = make_closing("Thanks & Regards,", CO)
    t = time.perf_counter()
    for _ in range(1000):
        apply_closing(body, closing)
    assert (time.perf_counter() - t) / 1000 < 0.002  # well under 2 ms per reply
