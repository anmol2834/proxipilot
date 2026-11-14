"""Model-family parameters: only values the live OpenAI API accepts (probed 2026-11-14)."""

from app.core.llm_params import completion_params, is_reasoning_model, reasoning_effort_for


def test_gpt6_luna_never_gets_temperature_or_minimal():
    # Live API: gpt-6-luna rejects temperature=0 and reasoning_effort="minimal" (400).
    assert completion_params("gpt-6-luna", "minimal") == {"reasoning_effort": "none"}
    assert completion_params("gpt-6-luna", "low") == {"reasoning_effort": "low"}
    assert "temperature" not in completion_params("gpt-6-luna")


def test_original_gpt5_family_keeps_minimal():
    for m in ("gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-mini-2025-08-07"):
        assert completion_params(m, "minimal") == {"reasoning_effort": "minimal"}, m


def test_newer_gpt5_point_releases_use_none():
    assert reasoning_effort_for("gpt-5.4-mini", "minimal") == "none"
    assert reasoning_effort_for("gpt-6.1-sol", "minimal") == "none"


def test_o_series_lowest_is_low():
    assert reasoning_effort_for("o3", "minimal") == "low"
    assert reasoning_effort_for("o4-mini", "none") == "low"


def test_non_reasoning_models_get_deterministic_temperature():
    assert not is_reasoning_model("gpt-4o-mini")
    assert completion_params("gpt-4.1", "minimal") == {"temperature": 0.0}
