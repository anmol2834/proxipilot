"""Model-family-aware sampling / reasoning parameters for OpenAI chat completions.

Why one helper
--------------
Five services each guessed the parameters from a name prefix ("gpt-5", "o1"...). Newer models break
those guesses: gpt-6-luna (verified 2026-11-14 against the live API) is a reasoning model that
rejects ``temperature=0`` and rejects ``reasoning_effort="minimal"`` (supported: none, low, medium,
high, xhigh). Sending either returns HTTP 400, so every planner/draft call would silently fall back.

Effort levels used by callers:
  "minimal"  fastest setting for extraction / grounded drafting
  "low"      a little reasoning for memory summaries and mining
Each is mapped to the closest value the model actually supports.
"""

from __future__ import annotations

import re
from typing import Any, Dict

# Reasoning models: no custom temperature; they take ``reasoning_effort``.
_REASONING = re.compile(r"^(gpt-[5-9]|o[1-9])", re.IGNORECASE)
# The original GPT-5 family (incl. mini / nano / dated snapshots) is the only one with "minimal".
_HAS_MINIMAL = re.compile(r"^gpt-5(-mini|-nano)?(-\d{4}-\d{2}-\d{2})?$", re.IGNORECASE)
# o-series models have no "none" / "minimal": their lowest setting is "low".
_O_SERIES = re.compile(r"^o[1-9]", re.IGNORECASE)


def is_reasoning_model(model: str) -> bool:
    return bool(_REASONING.match((model or "").strip()))


def reasoning_effort_for(model: str, effort: str) -> str:
    """Closest supported ``reasoning_effort`` for ``model``."""
    m = (model or "").strip()
    if effort == "minimal":
        if _HAS_MINIMAL.match(m):
            return "minimal"
        return "low" if _O_SERIES.match(m) else "none"
    if effort == "none" and (_O_SERIES.match(m) or _HAS_MINIMAL.match(m)):
        return "low" if _O_SERIES.match(m) else "minimal"
    return effort


def completion_params(model: str, effort: str = "low") -> Dict[str, Any]:
    """Keyword arguments to add to ``chat.completions.create`` for ``model``."""
    if is_reasoning_model(model):
        return {"reasoning_effort": reasoning_effort_for(model, effort)}
    return {"temperature": 0.0}
