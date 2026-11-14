"""Layer A: Deterministic Preprocessing Service.

High-throughput deterministic text normalization, multilingual detection,
and exact numeric/currency/unit/identifier preservation.

Design principles:
1. Fast & Non-destructive: Normalizes text without erasing meaningful product codes,
   decimals, currencies, or units.
2. Boundary-aware: Separates current incoming message text from quoted threads/signatures
   while retaining context references.
3. Multilingual & Hinglish: Classifies language hints across English, Hindi (Devanagari),
   and Hinglish (Latin-script colloquial Hindi business expressions).
4. Exact Numeric Extraction: Identifies prices, ranges, discounts, quantities, billing
   periods, and SKUs with source spans before LLM invocation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


# =============================================================================
# Extracted Entity & Constraint Models
# =============================================================================


@dataclass
class ExtractedSpan:
    """A matched textual element with character boundaries."""

    raw_text: str
    start_char: int
    end_char: int


@dataclass
class ExtractedPrice(ExtractedSpan):
    """An extracted monetary price or price limit."""

    amount: float
    currency: str = "INR"
    is_upper_bound: bool = False
    is_lower_bound: bool = False


@dataclass
class ExtractedRange(ExtractedSpan):
    """An extracted bounded or unbounded numeric range."""

    min_value: Optional[float] = None
    max_value: Optional[float] = None
    currency: Optional[str] = None
    unit: Optional[str] = None
    is_min_inclusive: bool = True
    is_max_inclusive: bool = True


@dataclass
class ExtractedCount(ExtractedSpan):
    """An extracted requested result count or ranking count."""

    count: int
    is_top_n: bool = False


@dataclass
class ExtractedIdentifier(ExtractedSpan):
    """An exact SKU, order code, or business identifier."""

    identifier: str
    kind: str = "sku"  # sku | order_id | service_code


@dataclass
class ExtractedDiscount(ExtractedSpan):
    """An extracted percentage discount or flat concession."""

    percentage: Optional[float] = None
    flat_amount: Optional[float] = None
    currency: Optional[str] = None


@dataclass
class ExtractedBillingPeriod(ExtractedSpan):
    """An extracted recurring billing period."""

    period: str  # monthly | annual | hourly | one_time


@dataclass
class PreprocessedEmail:
    """Result of deterministic Layer A preprocessing."""

    raw_text: str
    normalized_text: str
    cleaned_current_text: str
    quoted_history_text: Optional[str] = None
    detected_language: str = "en"  # en | hi | hinglish | mixed
    prices: List[ExtractedPrice] = field(default_factory=list)
    ranges: List[ExtractedRange] = field(default_factory=list)
    counts: List[ExtractedCount] = field(default_factory=list)
    identifiers: List[ExtractedIdentifier] = field(default_factory=list)
    discounts: List[ExtractedDiscount] = field(default_factory=list)
    billing_periods: List[ExtractedBillingPeriod] = field(default_factory=list)


# =============================================================================
# Regex Patterns
# =============================================================================

# Currency symbols and codes
_CURRENCY_SYMBOLS: Dict[str, str] = {
    "₹": "INR",
    "rs": "INR",
    "rs.": "INR",
    "inr": "INR",
    "$": "USD",
    "usd": "USD",
    "€": "EUR",
    "eur": "EUR",
    "£": "GBP",
    "gbp": "GBP",
}

# Quoted text patterns
_QUOTED_DELIMITERS = [
    re.compile(r"^On\s+.+?wrote:\s*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^From:\s+.+?$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^-{3,}\s*Original Message\s*-{3,}$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^Sent from my (?:iPhone|Android|Galaxy|iPad)", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^-{2,}\s*$", re.MULTILINE),  # standard sig dash
]

# Hinglish vocabulary indicators (Latin script Hindi colloquialisms)
_HINGLISH_TOKENS = {
    "ke", "under", "dikhao", "chahiye", "kya", "batao", "kaise", "kitna", "daam",
    "kimat", "rate", "beech", "sasta", "accha", "achha", "mein", "bhi", "hoga",
    "karo", "do", "kare", "hai", "hain", "nahi", "tha", "raha", "wali", "wale",
    "kitne", "wala", "mil", "sakta", "kripya", "dhanyawad",
}

# Range patterns: ₹500–₹1,500, between 500 and 1500 INR, 500 se 1500 ke beech
_RANGE_BETWEEN_PATTERN = re.compile(
    r"(?:between\s+|from\s+)?([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:[-–—]|to|and|se)\s*([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(inr|usd|eur|rs\.?|₹|\$|€|£)?(?:\s*ke\s+beech)?",
    re.IGNORECASE,
)

# Under / Less than / Below patterns: under ₹2,000, less than 1,500, ₹1500 ke under
_UNDER_PATTERN = re.compile(
    r"(?:under|less\s+than|below|up\s+to|no\s+more\s+than)\s*([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(inr|usd|eur|rs\.?|₹|\$|€|£)?",
    re.IGNORECASE,
)
_UNDER_POSTFIX_PATTERN = re.compile(
    r"([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(inr|usd|eur|rs\.?|₹|\$|€|£)?\s*(?:ke\s+under|se\s+kam)",
    re.IGNORECASE,
)

# Above / More than / At least patterns: above ₹500, at least 1,500
_ABOVE_PATTERN = re.compile(
    r"(?:above|more\s+than|greater\s+than|at\s+least)\s*([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(inr|usd|eur|rs\.?|₹|\$|€|£)?",
    re.IGNORECASE,
)

# Requested count patterns: top 3, top 5, at least 3 options, compare top 5, 3 products
_TOP_COUNT_PATTERN = re.compile(
    r"(?:top|first|best)\s+(\d{1,2})\b",
    re.IGNORECASE,
)
_OPTIONS_COUNT_PATTERN = re.compile(
    r"(?:show|give|need|send|compare|at\s+least)\s+(\d{1,2})\s+(?:options|products|items|services|plans|packages|results)\b",
    re.IGNORECASE,
)
_HINGLISH_COUNT_PATTERN = re.compile(
    r"(\d{1,2})\s+(?:options|products|items)\s+dikhao",
    re.IGNORECASE,
)

# Discount / Concession patterns: 10% discount, 20% off, flat 500 off
_DISCOUNT_PERCENT_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|concession)",
    re.IGNORECASE,
)
_DISCOUNT_FLAT_PATTERN = re.compile(
    r"flat\s+([₹$€£]|rs\.?\s*|inr\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:off|discount)",
    re.IGNORECASE,
)

# Billing period patterns: per month, /mo, monthly, per year, /yr, annual
_BILLING_PERIOD_PATTERN = re.compile(
    r"(?:per|\/)\s*(month|mo|year|yr|hour|hr|day|week)|(monthly|annually|yearly|hourly|daily)",
    re.IGNORECASE,
)

# SKU / Service code / Order ID patterns: HA-001, SKU-12345, ORD-98281, ABC123
_IDENTIFIER_PATTERN = re.compile(
    r"\b([A-Z]{2,4}-\d{3,6}|SKU-[A-Z0-9]{3,10}|ORD-\d{4,8}|[A-Z]{3,4}\d{3,4})\b",
)


# =============================================================================
# Layer A Preprocessor Implementation
# =============================================================================


class DeterministicPreprocessor:
    """High-throughput deterministic text preprocessor and feature extractor."""

    def preprocess(self, raw_text: str, subject: Optional[str] = None) -> PreprocessedEmail:
        """Run complete deterministic preprocessing on incoming email content."""
        if not raw_text:
            return PreprocessedEmail(raw_text="", normalized_text="", cleaned_current_text="")

        # 1. Unicode & whitespace normalization
        norm_text = self.normalize_text(raw_text)

        # 2. Quoted text boundary isolation
        cleaned_text, quoted_text = self.isolate_quoted_history(norm_text)

        # 3. Multilingual identification
        detected_lang = self.detect_language(cleaned_text)

        # Combine subject and cleaned body for entity extraction
        search_target = f"{subject or ''}\n{cleaned_text}"

        # 4. Exact numeric, range, count, and identifier extraction
        ranges, prices = self.extract_ranges_and_prices(search_target)
        counts = self.extract_counts(search_target)
        identifiers = self.extract_identifiers(search_target)
        discounts = self.extract_discounts(search_target)
        billing_periods = self.extract_billing_periods(search_target)

        return PreprocessedEmail(
            raw_text=raw_text,
            normalized_text=norm_text,
            cleaned_current_text=cleaned_text,
            quoted_history_text=quoted_text,
            detected_language=detected_lang,
            prices=prices,
            ranges=ranges,
            counts=counts,
            identifiers=identifiers,
            discounts=discounts,
            billing_periods=billing_periods,
        )

    @staticmethod
    def normalize_text(text: str) -> str:
        """Apply NFKC Unicode normalization, standardize line endings, and strip excess whitespace."""
        # Fast path: only run C unicodedata normalization if non-ASCII characters exist
        normalized = text if text.isascii() else unicodedata.normalize("NFKC", text)
        if "\r" in normalized:
            normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse horizontal whitespace
        if "  " in normalized or "\t" in normalized:
            normalized = re.sub(r"[ \t]+", " ", normalized)
        # Collapse 3+ newlines to 2
        if "\n\n\n" in normalized:
            normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    @staticmethod
    def isolate_quoted_history(text: str) -> Tuple[str, Optional[str]]:
        """Isolate current email text from quoted reply history and signatures."""
        for pattern in _QUOTED_DELIMITERS:
            match = pattern.search(text)
            if match:
                split_idx = match.start()
                cleaned = text[:split_idx].strip()
                quoted = text[split_idx:].strip()
                if cleaned:
                    return cleaned, quoted
        return text, None

    @staticmethod
    def detect_language(text: str) -> str:
        """Classify message language as 'en', 'hi', 'hinglish', or 'mixed'."""
        if not text:
            return "en"

        is_ascii = text.isascii()
        # Check for Devanagari script (Unicode range \u0900 - \u097F)
        if not is_ascii:
            devanagari_chars = sum(1 for c in text if "\u0900" <= c <= "\u097F")
            if devanagari_chars >= 5:
                return "hi"

        # Check for Hinglish lexical markers in Latin script
        lower_text = text.lower()
        hinglish_match_count = 0
        for token in lower_text.split():
            clean_token = token.strip(".,!?:;\"'()[]{}")
            if clean_token in _HINGLISH_TOKENS:
                hinglish_match_count += 1
                if hinglish_match_count >= 2:
                    return "hinglish"

        if hinglish_match_count == 1:
            return "mixed"

        return "en"

    @classmethod
    def _resolve_currency(cls, prefix: Optional[str], suffix: Optional[str]) -> str:
        """Determine ISO currency code from prefix or suffix tokens."""
        for token in (prefix, suffix):
            if token:
                cleaned = token.strip().lower()
                if cleaned in _CURRENCY_SYMBOLS:
                    return _CURRENCY_SYMBOLS[cleaned]
        return "INR"  # Default ProxiPilot deployment currency

    def extract_ranges_and_prices(self, text: str) -> Tuple[List[ExtractedRange], List[ExtractedPrice]]:
        """Extract explicit numeric ranges and price boundaries."""
        ranges: List[ExtractedRange] = []
        prices: List[ExtractedPrice] = []

        # Fast exit if no digits in text
        if not any(c.isdigit() for c in text):
            return ranges, prices

        # 1. Check for 'between X and Y' or 'X - Y' ranges
        for m in _RANGE_BETWEEN_PATTERN.finditer(text):
            p1, val1_str, p2, val2_str, sfx = m.groups()
            try:
                val1 = float(val1_str.replace(",", ""))
                val2 = float(val2_str.replace(",", ""))
                curr = self._resolve_currency(p1 or p2, sfx)
                low = min(val1, val2)
                high = max(val1, val2)

                ranges.append(
                    ExtractedRange(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        min_value=low,
                        max_value=high,
                        currency=curr,
                    )
                )
            except (ValueError, TypeError):
                continue

        # 2. Check for 'under X' or 'less than X'
        for m in _UNDER_PATTERN.finditer(text):
            prefix, val_str, suffix = m.groups()
            try:
                val = float(val_str.replace(",", ""))
                curr = self._resolve_currency(prefix, suffix)
                prices.append(
                    ExtractedPrice(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        amount=val,
                        currency=curr,
                        is_upper_bound=True,
                    )
                )
                ranges.append(
                    ExtractedRange(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        max_value=val,
                        currency=curr,
                        is_max_inclusive=False,
                    )
                )
            except (ValueError, TypeError):
                continue

        # 3. Check for postfix 'ke under' / 'se kam' (Hinglish)
        for m in _UNDER_POSTFIX_PATTERN.finditer(text):
            prefix, val_str, suffix = m.groups()
            try:
                val = float(val_str.replace(",", ""))
                curr = self._resolve_currency(prefix, suffix)
                prices.append(
                    ExtractedPrice(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        amount=val,
                        currency=curr,
                        is_upper_bound=True,
                    )
                )
                ranges.append(
                    ExtractedRange(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        max_value=val,
                        currency=curr,
                        is_max_inclusive=False,
                    )
                )
            except (ValueError, TypeError):
                continue

        # 4. Check for 'above X' or 'at least X' (Price context)
        for m in _ABOVE_PATTERN.finditer(text):
            prefix, val_str, suffix = m.groups()
            # If followed by 'options' or 'products', this is a count, not a price
            sub_after = text[m.end():m.end() + 20].lower()
            if any(w in sub_after for w in ("options", "products", "items", "results")):
                continue

            try:
                val = float(val_str.replace(",", ""))
                curr = self._resolve_currency(prefix, suffix)
                prices.append(
                    ExtractedPrice(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        amount=val,
                        currency=curr,
                        is_lower_bound=True,
                    )
                )
                ranges.append(
                    ExtractedRange(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        min_value=val,
                        currency=curr,
                        is_min_inclusive=True,
                    )
                )
            except (ValueError, TypeError):
                continue

        return ranges, prices

    def extract_counts(self, text: str) -> List[ExtractedCount]:
        """Extract explicit user requested result or ranking counts."""
        counts: List[ExtractedCount] = []
        if not any(c.isdigit() for c in text):
            return counts

        # 'top 3', 'first 5'
        for m in _TOP_COUNT_PATTERN.finditer(text):
            try:
                val = int(m.group(1))
                counts.append(
                    ExtractedCount(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        count=val,
                        is_top_n=True,
                    )
                )
            except ValueError:
                continue

        # 'show 3 options', 'compare 5 products'
        for m in _OPTIONS_COUNT_PATTERN.finditer(text):
            try:
                val = int(m.group(1))
                counts.append(
                    ExtractedCount(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        count=val,
                        is_top_n=False,
                    )
                )
            except ValueError:
                continue

        # Hinglish '3 options dikhao'
        for m in _HINGLISH_COUNT_PATTERN.finditer(text):
            try:
                val = int(m.group(1))
                counts.append(
                    ExtractedCount(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        count=val,
                        is_top_n=False,
                    )
                )
            except ValueError:
                continue

        return counts

    def extract_identifiers(self, text: str) -> List[ExtractedIdentifier]:
        """Extract exact product codes, SKUs, and service identifiers."""
        identifiers: List[ExtractedIdentifier] = []
        if not any(c.isupper() for c in text):
            return identifiers

        for m in _IDENTIFIER_PATTERN.finditer(text):
            raw = m.group(1).upper()
            kind = "order_id" if raw.startswith("ORD-") else "sku"
            identifiers.append(
                ExtractedIdentifier(
                    raw_text=m.group(0),
                    start_char=m.start(),
                    end_char=m.end(),
                    identifier=raw,
                    kind=kind,
                )
            )
        return identifiers

    def extract_discounts(self, text: str) -> List[ExtractedDiscount]:
        """Extract percentage discounts or flat price concessions."""
        discounts: List[ExtractedDiscount] = []
        lower_t = text.lower()
        if "%" not in text and "discount" not in lower_t and "off" not in lower_t:
            return discounts

        for m in _DISCOUNT_PERCENT_PATTERN.finditer(text):
            try:
                pct = float(m.group(1))
                discounts.append(
                    ExtractedDiscount(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        percentage=pct,
                    )
                )
            except ValueError:
                continue

        for m in _DISCOUNT_FLAT_PATTERN.finditer(text):
            prefix, amt_str = m.groups()
            try:
                amt = float(amt_str.replace(",", ""))
                curr = self._resolve_currency(prefix, None)
                discounts.append(
                    ExtractedDiscount(
                        raw_text=m.group(0),
                        start_char=m.start(),
                        end_char=m.end(),
                        flat_amount=amt,
                        currency=curr,
                    )
                )
            except ValueError:
                continue

        return discounts

    def extract_billing_periods(self, text: str) -> List[ExtractedBillingPeriod]:
        """Extract recurring billing frequency (monthly, annual)."""
        periods: List[ExtractedBillingPeriod] = []
        for m in _BILLING_PERIOD_PATTERN.finditer(text):
            token = (m.group(1) or m.group(2) or "").lower()
            period_val = "monthly"
            if token in ("month", "mo", "monthly"):
                period_val = "monthly"
            elif token in ("year", "yr", "yearly", "annually"):
                period_val = "annual"
            elif token in ("hour", "hr", "hourly"):
                period_val = "hourly"
            elif token in ("day", "daily"):
                period_val = "daily"

            periods.append(
                ExtractedBillingPeriod(
                    raw_text=m.group(0),
                    start_char=m.start(),
                    end_char=m.end(),
                    period=period_val,
                )
            )
        return periods


# Singleton preprocessor instance
deterministic_preprocessor = DeterministicPreprocessor()
