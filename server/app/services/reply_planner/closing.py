"""Deterministic reply closing: the team's sign-off followed by the company name.

Why
---
The language model was asked to write the sign-off itself. With no person's name to use it
produced placeholders such as "Regards, [Your name] / Sales Team". A customer-facing email
must never contain a placeholder, and the closing is not something a model should guess.

So the closing is composed by the server, from data, in microseconds:

    <sign-off line>          employee setting > learned from the team's sent emails > "Regards,"
    <company name>           the organisation's registered name

``apply_closing`` removes whatever closing the model wrote (sign-off line, names, titles,
placeholders) and appends the composed one. It is pure and idempotent, so it is safe to run on
every draft, including repaired drafts and deterministic fallbacks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

DEFAULT_SIGN_OFF = "Regards,"

# A closing line ("Regards,", "Thanks & Regards", "Best wishes", "Dhanyavaad", ...).
_SIGN_OFF_LINE = re.compile(
    r"^(?:(?:many\s+)?(?:thanks?|thank\s+you)(?:\s+(?:again|so\s+much))?(?:\s*(?:&|and)\s*(?:best\s+|warm\s+|kind\s+)?regards)?"
    r"|(?:best|warm|warmest|kind|kindest|with\s+(?:best|warm|kind)?|many)?\s*regards"
    r"|best(?:\s+wishes)?|cheers|sincerely|yours\s+(?:truly|sincerely|faithfully)|thanking\s+you"
    r"|dhanyavaa?d|shukriya)[\s,.!:;\-–—]*$",  # "Thanks —", "Regards -", "Thanks:"
    re.IGNORECASE,
)
# Placeholders a model invents when it has no real value: [Your name], [Company Name], <Name> ...
_PLACEHOLDER = re.compile(
    r"[\[<{]\s*(?:your|sender|company|business|agent|employee|my|insert)?\s*"
    r"(?:full\s+)?(?:name|company(?:\s+name)?|business(?:\s+name)?|title|designation|position|role|"
    r"signature|contact(?:\s+(?:details|info(?:rmation)?|number))?|phone(?:\s+number)?|email(?:\s+address)?)"
    r"\s*[\]>}]",
    re.IGNORECASE,
)
# How far from the end a closing block may start (in non-empty lines).
_TAIL_LINES = 6
_TAIL_LINE_MAX_CHARS = 60


@dataclass(frozen=True)
class ReplyClosing:
    sign_off: str
    company_name: Optional[str]

    def lines(self) -> List[str]:
        out = [self.sign_off.strip() or DEFAULT_SIGN_OFF]
        name = (self.company_name or "").strip()
        # A sign-off that already names the company ("Regards, Team Dolphy India") is complete.
        if name and name.lower() not in out[0].lower():
            out.append(name)
        return out


def make_closing(sign_off: Optional[str], company_name: Optional[str]) -> ReplyClosing:
    so = " ".join((sign_off or "").split())
    if not so or _PLACEHOLDER.search(so):
        so = DEFAULT_SIGN_OFF
    return ReplyClosing(sign_off=so, company_name=" ".join((company_name or "").split()) or None)


def _strip_closing(lines: List[str]) -> List[str]:
    """Drop the model-written closing block (sign-off line and everything after it)."""
    nonempty = [i for i, ln in enumerate(lines) if ln.strip()]
    tail = nonempty[-_TAIL_LINES:]
    for i in tail:
        if _SIGN_OFF_LINE.match(lines[i].strip()):
            # Only a closing if what follows is short name/title lines, not more content.
            after = [lines[j].strip() for j in nonempty if j > i]
            if len(after) <= 4 and all(len(a) <= _TAIL_LINE_MAX_CHARS for a in after):
                return lines[:i]
    # No sign-off line, but trailing placeholder lines ("[Your name]") still must go.
    while lines and (not lines[-1].strip() or _PLACEHOLDER.fullmatch(lines[-1].strip())):
        lines = lines[:-1]
    return lines


def apply_closing(body_text: str, closing: ReplyClosing) -> str:
    """Return ``body_text`` ending with exactly one closing: sign-off + company name."""
    text = (body_text or "").replace("\r\n", "\n").rstrip()
    lines = _strip_closing(text.split("\n"))
    # Placeholders left inside the body: a name / company placeholder becomes the company name
    # (when known); any other kind (title, phone, ...) is dropped - never invent a value.
    name = closing.company_name or ""

    def _fill(m: "re.Match[str]") -> str:
        return name if re.search(r"name|company|business", m.group(0), re.IGNORECASE) else ""

    body = "\n".join(lines).rstrip()
    body = _PLACEHOLDER.sub(_fill, body)
    body = re.sub(r"[ \t]{2,}", " ", body)
    body = re.sub(r"\n{3,}", "\n\n", body).rstrip()
    closing_text = "\n".join(closing.lines())
    return f"{body}\n\n{closing_text}" if body else closing_text
