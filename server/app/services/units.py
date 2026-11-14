"""Typed quantity / unit normalisation (business-agnostic).

Parses measurements out of free text — customer emails and catalogue titles — into typed
quantities with a canonical base unit, keeping the original wording and the conversion
basis so downstream code can (a) compare like with like and (b) explain itself.

    "4 feet"            -> length  1219.2 mm   (1 ft = 304.8 mm)
    "48 inches"         -> length  1219.2 mm
    "1.2 m"             -> length  1200 mm
    "1200 x 230 x 220"  -> dimensions (1200, 230, 220) mm, unit ASSUMED (no unit written)
    "16GB RAM"          -> data_size 16 GB  (context word "ram")
    "500W" / "2 kW"     -> power     500 W / 2000 W
    "8kg"               -> weight    8000 g
    "1.2 L"             -> volume    1200 ml

Quantities of different kinds are never comparable. Nothing here is specific to any
business, product family or catalogue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

_NUM = r"(\d+(?:[.,]\d+)?)"

# unit token -> (kind, factor to base unit, canonical unit label)
_UNITS = {
    # length (base: mm)
    "mm": ("length", 1.0, "mm"), "millimeter": ("length", 1.0, "mm"), "millimetre": ("length", 1.0, "mm"),
    "cm": ("length", 10.0, "cm"), "centimeter": ("length", 10.0, "cm"), "centimetre": ("length", 10.0, "cm"),
    "m": ("length", 1000.0, "m"), "mtr": ("length", 1000.0, "m"), "meter": ("length", 1000.0, "m"),
    "metre": ("length", 1000.0, "m"), "meters": ("length", 1000.0, "m"), "metres": ("length", 1000.0, "m"),
    "in": ("length", 25.4, "in"), "inch": ("length", 25.4, "in"), "inches": ("length", 25.4, "in"), '"': ("length", 25.4, "in"),
    "ft": ("length", 304.8, "ft"), "feet": ("length", 304.8, "ft"), "foot": ("length", 304.8, "ft"), "'": ("length", 304.8, "ft"),
    # data size (base: GB)
    "gb": ("data_size", 1.0, "GB"), "tb": ("data_size", 1024.0, "TB"), "mb": ("data_size", 1 / 1024.0, "MB"),
    # power (base: W)
    "w": ("power", 1.0, "W"), "watt": ("power", 1.0, "W"), "watts": ("power", 1.0, "W"), "kw": ("power", 1000.0, "kW"),
    # weight (base: g)
    "g": ("weight", 1.0, "g"), "gm": ("weight", 1.0, "g"), "kg": ("weight", 1000.0, "kg"), "kgs": ("weight", 1000.0, "kg"),
    # volume (base: ml)
    "ml": ("volume", 1.0, "ml"), "l": ("volume", 1000.0, "L"), "ltr": ("volume", 1000.0, "L"), "litre": ("volume", 1000.0, "L"),
    "liter": ("volume", 1000.0, "L"), "litres": ("volume", 1000.0, "L"), "liters": ("volume", 1000.0, "L"),
}
_UNIT_ALT = "|".join(sorted((re.escape(u) for u in _UNITS), key=len, reverse=True))
_QTY_RE = re.compile(rf"{_NUM}\s*-?\s*({_UNIT_ALT})(?![a-z])", re.IGNORECASE)
# W x H (x D) with an optional trailing unit: "1200 x 230 x 220", "900X230X212mm", "1500 × 230 × 212 mm"
_DIMS_RE = re.compile(
    rf"(?<![\w.]){_NUM}\s*[x×*]\s*{_NUM}(?:\s*[x×*]\s*{_NUM})?\s*({_UNIT_ALT})?(?![a-z])", re.IGNORECASE)


def _f(s: str) -> float:
    return float(s.replace(",", "."))


@dataclass(frozen=True)
class Quantity:
    kind: str                 # length | data_size | power | weight | volume
    value: float              # in the base unit (mm, GB, W, g, ml)
    unit: str                 # canonical unit as written (mm, ft, GB, ...)
    original: str             # exact source text
    context: str = ""         # nearest preceding/following word (e.g. "ram", "width")
    assumed_unit: bool = False  # True when the unit was inferred, not written

    @property
    def basis(self) -> str:
        return f"{self.original} -> {self.value:g} {BASE_UNIT[self.kind]}"


BASE_UNIT = {"length": "mm", "data_size": "GB", "power": "W", "weight": "g", "volume": "ml"}


@dataclass
class Dimensions:
    values_mm: Tuple[float, ...]
    original: str
    assumed_unit: bool

    @property
    def primary_mm(self) -> float:
        """First dimension = nominal width/length in catalogue conventions (W x H x D)."""
        return self.values_mm[0]


def _context_word(text: str, start: int, end: int) -> str:
    after = re.match(r"\s*([a-z]{2,})", text[end:end + 20], re.IGNORECASE)
    before = re.search(r"([a-z]{2,})\s*$", text[max(0, start - 20):start], re.IGNORECASE)
    if after:
        return after.group(1).lower()
    return before.group(1).lower() if before else ""


def parse_quantities(text: str) -> List[Quantity]:
    """All single quantities with an explicit unit, in order of appearance."""
    out: List[Quantity] = []
    if not text:
        return out
    spans_dims = [m.span() for m in _DIMS_RE.finditer(text)]
    for m in _QTY_RE.finditer(text):
        # skip the trailing unit of a W x H x D group; parse_dimensions handles those
        if any(s <= m.start() < e for s, e in spans_dims):
            continue
        num, unit_tok = m.group(1), m.group(2).lower()
        kind, factor, label = _UNITS[unit_tok]
        # "in" is also an ordinary word ("5 in stock"), and quote marks are punctuation:
        # accept them only when attached to the number ("48in", 4').
        raw = m.group(0)
        if unit_tok in ("in", "'", '"') and re.search(r"\d\s+" + re.escape(unit_tok) + r"$", raw, re.I):
            continue
        out.append(Quantity(kind=kind, value=_f(num) * factor, unit=label, original=raw.strip(),
                            context=_context_word(text, m.start(), m.end())))
    return out


def parse_dimensions(text: str, default_length_unit: str = "mm") -> List[Dimensions]:
    """W x H (x D) groups. Without a written unit the catalogue default (mm) is assumed and
    flagged, so callers can treat the value as nominal rather than exact."""
    out: List[Dimensions] = []
    for m in _DIMS_RE.finditer(text or ""):
        nums = [g for g in m.groups()[:3] if g]
        unit_tok = (m.group(4) or "").lower()
        if unit_tok and _UNITS.get(unit_tok, ("",))[0] != "length":
            continue
        factor = _UNITS[unit_tok][1] if unit_tok else _UNITS[default_length_unit][1]
        out.append(Dimensions(values_mm=tuple(_f(n) * factor for n in nums), original=m.group(0).strip(),
                              assumed_unit=not unit_tok))
    return out


def lengths_mm(text: str) -> List[Quantity]:
    return [q for q in parse_quantities(text) if q.kind == "length"]


def primary_length_mm(text: str) -> Optional[Tuple[float, str, bool]]:
    """Best single nominal length of an item described by ``text``:
    (value_mm, original_text, unit_assumed). Prefers a W x H x D group, else a lone length."""
    dims = parse_dimensions(text)
    if dims:
        d = dims[0]
        return d.primary_mm, d.original, d.assumed_unit
    ls = lengths_mm(text)
    if ls:
        return ls[0].value, ls[0].original, False
    return None


@dataclass
class LengthFit:
    requested_mm: float
    item_mm: float
    item_original: str
    unit_assumed: bool
    rel_diff: float = field(init=False)

    def __post_init__(self) -> None:
        self.rel_diff = abs(self.item_mm - self.requested_mm) / self.requested_mm if self.requested_mm else 1.0

    @property
    def note(self) -> str:
        """Customer-safe statement: never claims a guaranteed fit."""
        same = self.rel_diff < 0.005
        rel = "matches" if same else ("is close to" if self.rel_diff <= 0.10 else "differs from")
        return (f"listed size {self.item_original} (nominal {self.item_mm:g} mm"
                f"{', unit assumed' if self.unit_assumed else ''}) {rel} the requested "
                f"{self.requested_mm:g} mm; exact fit/installation clearance must be confirmed")
