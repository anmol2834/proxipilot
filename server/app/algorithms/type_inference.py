"""Streaming Type Inference and Pattern Profiling Engine (Phase 8.2).

Specification:
- Purpose: Classify cell values into candidate types with confidence metrics and pattern detection.
- Supported Types: STRING, TEXT, INTEGER, DECIMAL, CURRENCY, BOOLEAN, DATE, DATETIME, EMAIL, URL.
- Guardrails:
  - Strings with leading zeros (e.g., '00100') are classified as STRING (identifier preservation).
  - Plausible ambiguous date formats (e.g., '03/04/2024' where both parts <= 12) are flagged as ambiguous.
  - Currency values retain symbol and separator profiles without premature mutation.
  - O(1) state per cell evaluation, using precompiled regular expressions.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Set, Tuple


class DataType(str, Enum):
    INTEGER = "INTEGER"
    DECIMAL = "DECIMAL"
    CURRENCY = "CURRENCY"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    DATETIME = "DATETIME"
    EMAIL = "EMAIL"
    URL = "URL"
    TEXT = "TEXT"
    STRING = "STRING"
    ENUM = "ENUM"


@dataclass(frozen=True)
class CellTypeObservation:
    """Result of analyzing a single cell value."""

    primary_type: DataType
    candidate_types: Tuple[DataType, ...]
    is_ambiguous_date: bool = False
    date_pattern: Optional[str] = None
    currency_symbol: Optional[str] = None
    numeric_value: Optional[float] = None
    has_leading_zero: bool = False
    length: int = 0


class TypeInferenceEngine:
    """Deterministic pattern matcher for cell-level and column-level type inference."""

    # Precompiled regex patterns for bounded execution speed
    _RE_BOOLEAN = re.compile(r"^(?:true|false|yes|no|y|n|t|f)$", re.IGNORECASE)
    _RE_EMAIL = re.compile(
        r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )
    _RE_URL = re.compile(
        r"^(?:https?://|www\.)[^\s/$.?#].[^\s]*$", re.IGNORECASE
    )

    # ISO Datetime: e.g. 2024-03-15T14:30:00, 2024-03-15 14:30:00Z
    _RE_ISO_DATETIME = re.compile(
        r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$"
    )
    # ISO Date: 2024-03-15
    _RE_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    # Slash / Dash / Dot Date: e.g. 15/03/2024 or 03/15/2024
    _RE_SLASHDOT_DATE = re.compile(r"^(\d{1,2})([/.-])(\d{1,2})[/.-](\d{4})$")

    # Pure Integer: optionally signed digits
    _RE_INTEGER = re.compile(r"^[+-]?\d+$")

    # Pure Decimal: standard decimal dot or comma
    _RE_DECIMAL_DOT = re.compile(r"^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d+$")
    _RE_DECIMAL_COMMA = re.compile(r"^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d+$")

    # Currency regex: begins or ends with currency symbols ($ € £ ¥ ₹) or standard code prefix
    _RE_CURRENCY_PREFIX = re.compile(
        r"^([$€£¥₹]|USD|EUR|GBP|INR)\s*([+-]?(?:\d{1,3}(?:[,.\s]\d{3})*|\d+)(?:[.,]\d+)?)$",
        re.IGNORECASE,
    )
    _RE_CURRENCY_SUFFIX = re.compile(
        r"^([+-]?(?:\d{1,3}(?:[,.\s]\d{3})*|\d+)(?:[.,]\d+)?)\s*([$€£¥₹]|USD|EUR|GBP|INR)$",
        re.IGNORECASE,
    )

    @classmethod
    def infer_cell(cls, raw_val: str) -> CellTypeObservation:
        """Infer candidate types and characteristics for a single non-empty string cell."""
        length = len(raw_val)
        val = raw_val.strip()

        if not val:
            return CellTypeObservation(
                primary_type=DataType.STRING,
                candidate_types=(DataType.STRING,),
                length=length,
            )

        # 1. Text check: long content or multiline strings
        if length > 255 or "\n" in val:
            return CellTypeObservation(
                primary_type=DataType.TEXT,
                candidate_types=(DataType.TEXT, DataType.STRING),
                length=length,
            )

        # 2. Boolean check
        if cls._RE_BOOLEAN.match(val):
            return CellTypeObservation(
                primary_type=DataType.BOOLEAN,
                candidate_types=(DataType.BOOLEAN, DataType.STRING),
                length=length,
            )

        # 3. Email check
        if cls._RE_EMAIL.match(val):
            return CellTypeObservation(
                primary_type=DataType.EMAIL,
                candidate_types=(DataType.EMAIL, DataType.STRING),
                length=length,
            )

        # 4. URL check
        if cls._RE_URL.match(val):
            return CellTypeObservation(
                primary_type=DataType.URL,
                candidate_types=(DataType.URL, DataType.STRING),
                length=length,
            )

        # 5. Datetime / Date checks
        if cls._RE_ISO_DATETIME.match(val):
            return CellTypeObservation(
                primary_type=DataType.DATETIME,
                candidate_types=(DataType.DATETIME, DataType.STRING),
                date_pattern="YYYY-MM-DDTHH:mm:ss",
                length=length,
            )

        if cls._RE_ISO_DATE.match(val):
            return CellTypeObservation(
                primary_type=DataType.DATE,
                candidate_types=(DataType.DATE, DataType.STRING),
                date_pattern="YYYY-MM-DD",
                length=length,
            )

        m_date = cls._RE_SLASHDOT_DATE.match(val)
        if m_date:
            part1 = int(m_date.group(1))
            sep = m_date.group(2)
            part2 = int(m_date.group(3))

            if part1 > 12 and part2 <= 12:
                # Definitely DD/MM/YYYY
                return CellTypeObservation(
                    primary_type=DataType.DATE,
                    candidate_types=(DataType.DATE, DataType.STRING),
                    date_pattern=f"DD{sep}MM{sep}YYYY",
                    is_ambiguous_date=False,
                    length=length,
                )
            elif part1 <= 12 and part2 > 12:
                # Definitely MM/DD/YYYY
                return CellTypeObservation(
                    primary_type=DataType.DATE,
                    candidate_types=(DataType.DATE, DataType.STRING),
                    date_pattern=f"MM{sep}DD{sep}YYYY",
                    is_ambiguous_date=False,
                    length=length,
                )
            elif part1 <= 12 and part2 <= 12:
                # Plausible ambiguous date: could be DD/MM/YYYY or MM/DD/YYYY
                return CellTypeObservation(
                    primary_type=DataType.DATE,
                    candidate_types=(DataType.DATE, DataType.STRING),
                    date_pattern=f"DD{sep}MM{sep}YYYY | MM{sep}DD{sep}YYYY",
                    is_ambiguous_date=True,
                    length=length,
                )

        # 6. Currency check
        m_curr_pre = cls._RE_CURRENCY_PREFIX.match(val)
        if m_curr_pre:
            symbol = m_curr_pre.group(1)
            num_str = m_curr_pre.group(2).replace(",", "").replace(" ", "")
            try:
                num = float(num_str)
                return CellTypeObservation(
                    primary_type=DataType.CURRENCY,
                    candidate_types=(DataType.CURRENCY, DataType.DECIMAL, DataType.STRING),
                    currency_symbol=symbol,
                    numeric_value=num,
                    length=length,
                )
            except ValueError:
                pass

        m_curr_suf = cls._RE_CURRENCY_SUFFIX.match(val)
        if m_curr_suf:
            num_str = m_curr_suf.group(1).replace(",", "").replace(" ", "")
            symbol = m_curr_suf.group(2)
            try:
                num = float(num_str)
                return CellTypeObservation(
                    primary_type=DataType.CURRENCY,
                    candidate_types=(DataType.CURRENCY, DataType.DECIMAL, DataType.STRING),
                    currency_symbol=symbol,
                    numeric_value=num,
                    length=length,
                )
            except ValueError:
                pass

        # 7. Integer check (with leading zero guardrail)
        if cls._RE_INTEGER.match(val):
            # Guardrail: Leading zero like "00100" or "01" (excluding standalone "0")
            # Must be preserved as STRING/identifier.
            if len(val) > 1 and val.startswith("0"):
                return CellTypeObservation(
                    primary_type=DataType.STRING,
                    candidate_types=(DataType.STRING, DataType.INTEGER),
                    has_leading_zero=True,
                    length=length,
                )
            try:
                num = float(int(val))
                return CellTypeObservation(
                    primary_type=DataType.INTEGER,
                    candidate_types=(DataType.INTEGER, DataType.DECIMAL, DataType.STRING),
                    numeric_value=num,
                    length=length,
                )
            except ValueError:
                pass

        # 8. Decimal check (dot or comma format)
        if cls._RE_DECIMAL_DOT.match(val):
            clean_str = val.replace(",", "")
            try:
                num = float(clean_str)
                return CellTypeObservation(
                    primary_type=DataType.DECIMAL,
                    candidate_types=(DataType.DECIMAL, DataType.STRING),
                    numeric_value=num,
                    length=length,
                )
            except ValueError:
                pass

        if cls._RE_DECIMAL_COMMA.match(val):
            clean_str = val.replace(".", "").replace(",", ".")
            try:
                num = float(clean_str)
                return CellTypeObservation(
                    primary_type=DataType.DECIMAL,
                    candidate_types=(DataType.DECIMAL, DataType.STRING),
                    numeric_value=num,
                    length=length,
                )
            except ValueError:
                pass

        # 9. Fallback: STRING
        return CellTypeObservation(
            primary_type=DataType.STRING,
            candidate_types=(DataType.STRING,),
            length=length,
        )
