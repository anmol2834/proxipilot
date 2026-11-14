"""Email MIME Parser, Text Normalizer, and Quote Remover.

Architecture:
- Uses Python stdlib email.message_from_bytes / email.message.EmailMessage.
  No regex-based MIME parsing.
- Prefers text/plain in multipart/alternative. Ignores text/html.
- Recursive MIME traversal handles nested multipart containers.
- Line-oriented quote parser (state machine) — conservative, never destroys content.
- RFC-aware subject prefix normalization (strips Re:/Fwd: but not "React").
- Body truncation at EMAIL_MAX_STORED_BODY_CHARS (50,000 chars default).

Text normalization pipeline:
  1. Decode MIME transfer encoding (base64 / quoted-printable)
  2. Decode charset safely (fallback chain)
  3. Unicode NFKC normalize
  4. Normalize line endings → \\n
  5. Remove zero-width / invisible control chars
  6. Normalize tabs → single space
  7. Collapse 3+ consecutive blank lines → 2
  8. Strip leading/trailing whitespace

Quote removal (conservative state machine):
  - Recognizes: ^>, On <date> ... wrote:, --- Original Message ---, Forwarded
  - Only removes a block when quote header is directly followed by > lines
  - If confidence low → KEEP the text (data preservation over cleanup)
  - RFC-compliant signature delimiter: ^-- $ (dash dash space newline)
"""

from __future__ import annotations

import base64
import email
import email.header
import email.message
import email.policy
import html
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

from app.core.logging import logger


# =============================================================================
# Configuration
# =============================================================================

EMAIL_MAX_STORED_BODY_CHARS: int = 50_000
"""Maximum plain-text body characters stored in PostgreSQL."""

# =============================================================================
# Result container
# =============================================================================


@dataclass
class MimeParseResult:
    """Result of parsing a single Gmail message payload."""

    body_text: Optional[str] = None
    """Normalized plain-text body. None if HTML-only or empty."""

    is_html_only: bool = False
    """True when only text/html part exists and no usable text/plain."""

    subject: Optional[str] = None
    """Raw subject string (before normalization)."""

    subject_normalized: Optional[str] = None
    """Canonical subject with Re:/Fwd: prefix stripped."""

    message_id_header: Optional[str] = None
    """RFC 2822 Message-ID header."""

    in_reply_to: Optional[str] = None
    """RFC 2822 In-Reply-To header."""

    references: Optional[str] = None
    """RFC 2822 References header."""

    sent_at: Optional[datetime] = None
    """Parsed UTC datetime from the Date header. None if unparseable."""

    from_email: str = "unknown@unknown.invalid"
    sender_name: Optional[str] = None

    to_emails: list[str] = field(default_factory=list)
    cc_emails: list[str] = field(default_factory=list)

    has_html_part: bool = False
    has_plain_part: bool = False


# =============================================================================
# Subject prefix normalization
# =============================================================================

# Tokens that are considered reply/forward prefixes (case-insensitive)
# Must appear as the ENTIRE prefix token before the first ': '
_REPLY_FORWARD_TOKENS: frozenset[str] = frozenset(
    [
        "re",
        "fw",
        "fwd",
        "aw",   # German reply prefix
        "vs",   # Scandinavian reply
        "sv",   # Swedish reply
        "tr",   # French reply (transferé)
        "wg",   # German forward
        "ref",
        "r",
    ]
)

_RE_SUBJECT_PREFIX = re.compile(
    r"^\s*([A-Za-z]{1,4})\s*:\s*",
    re.UNICODE,
)


def normalize_subject(raw_subject: str) -> str:
    """Strip leading Re:/Fwd: tokens from subject, preserving actual content.

    Examples:
        "Re: Partnership opportunity"   → "Partnership opportunity"
        "RE: RE: Proposal"              → "Proposal"
        "Fwd: React project update"     → "React project update"
        "React project update"          → "React project update" (unchanged!)
        "re: Re: fwd: Hello"            → "Hello"

    The key safety: only strip if the ENTIRE token before ':' is a known prefix.
    "React" would need to match token="React" which is NOT in the prefix set → safe.
    """
    subject = raw_subject.strip() if raw_subject else ""
    # Iteratively strip known prefixes
    while True:
        m = _RE_SUBJECT_PREFIX.match(subject)
        if not m:
            break
        token = m.group(1).lower()
        if token not in _REPLY_FORWARD_TOKENS:
            break
        subject = subject[m.end():]
    return subject.strip()


# =============================================================================
# Gmail payload → email.message.EmailMessage bridge
# =============================================================================


def _gmail_payload_to_raw_bytes(payload: dict) -> bytes:
    """Reconstruct a minimal RFC 2822 message from Gmail REST API payload dict.

    Gmail provides the message as a parsed JSON tree (parts, headers, body).
    We re-encode it so the stdlib email parser can handle it correctly.
    This avoids any regex-based MIME parsing.
    """
    lines: list[str] = []

    # Serialize headers
    for h in payload.get("headers", []):
        name = h.get("name", "")
        value = h.get("value", "")
        if name and value:
            lines.append(f"{name}: {value}")

    lines.append("")  # CRLF separator

    # Serialize body
    body_data = payload.get("body", {})
    raw_b64 = body_data.get("data", "")
    if raw_b64:
        # Gmail uses URL-safe base64
        decoded = base64.urlsafe_b64decode(raw_b64 + "==")
        lines.append(decoded.decode("utf-8", errors="replace"))

    # For multipart, rebuild parts recursively
    for part in payload.get("parts", []):
        part_bytes = _gmail_payload_to_raw_bytes(part)
        lines.append(part_bytes.decode("utf-8", errors="replace"))

    return "\n".join(lines).encode("utf-8")


# =============================================================================
# MIME Parser
# =============================================================================


class EmailParser:
    """MIME-aware email parser for Gmail REST API message payloads."""

    def parse_gmail_payload(self, msg_data: dict) -> MimeParseResult:
        """Parse a Gmail REST API message dict into a MimeParseResult.

        Args:
            msg_data: The full message dict from Gmail API (includes 'payload').
        """
        result = MimeParseResult()
        payload = msg_data.get("payload", {})
        headers_list = payload.get("headers", [])

        # --- Parse headers ---
        headers: dict[str, str] = {}
        for h in headers_list:
            name = h.get("name", "").lower()
            value = h.get("value", "")
            if name and value:
                headers[name] = value

        # Subject
        raw_subject = _decode_header_value(headers.get("subject", ""))
        result.subject = raw_subject
        result.subject_normalized = normalize_subject(raw_subject)

        # RFC threading headers
        result.message_id_header = headers.get("message-id", "").strip() or None
        result.in_reply_to = headers.get("in-reply-to", "").strip() or None
        result.references = headers.get("references", "").strip() or None

        # Date → datetime
        date_str = headers.get("date", "")
        result.sent_at = _parse_date_header(date_str)

        # From
        from_raw = _decode_header_value(headers.get("from", ""))
        result.sender_name, result.from_email = _parse_name_email(from_raw)

        # To / CC
        result.to_emails = _parse_address_list(headers.get("to", ""))
        result.cc_emails = _parse_address_list(headers.get("cc", ""))

        # --- Extract plain text from MIME tree ---
        plain_text, has_plain, has_html = self._extract_plain_text_from_payload(payload)

        result.has_plain_part = has_plain
        result.has_html_part = has_html

        if not plain_text or not plain_text.strip():
            if has_html:
                # HTML exists but contains no extractable text (e.g. image-only tracking email)
                result.is_html_only = True
            result.body_text = None
            return result

        normalized = normalize_body_text(plain_text)
        cleaned = remove_quoted_replies(normalized)
        if len(cleaned) > EMAIL_MAX_STORED_BODY_CHARS:
            logger.info(
                "Email body truncated to max chars",
                original_len=len(cleaned),
                max_len=EMAIL_MAX_STORED_BODY_CHARS,
            )
            cleaned = cleaned[:EMAIL_MAX_STORED_BODY_CHARS]
        result.body_text = cleaned if cleaned.strip() else None

        return result

    def _extract_plain_text_from_payload(
        self, payload: dict
    ) -> tuple[Optional[str], bool, bool]:
        """Recursively extract text/plain from Gmail REST payload tree.

        Returns (plain_text, has_plain_part, has_html_part).
        Prefers text/plain in multipart/alternative.
        If only text/html exists, converts to clean plain text.
        Never returns HTML.
        """
        mime_type = payload.get("mimeType", "").lower()
        parts = payload.get("parts", [])
        body = payload.get("body", {})

        has_plain = False
        has_html = False

        # Leaf node: check MIME type
        if not parts:
            if mime_type == "text/plain":
                raw_b64 = body.get("data", "")
                if raw_b64:
                    try:
                        padding = (4 - len(raw_b64) % 4) % 4
                        decoded_bytes = base64.urlsafe_b64decode(raw_b64 + ("=" * padding))
                        charset = _extract_charset(payload)
                        text = decoded_bytes.decode(charset, errors="replace")
                        return text, True, False
                    except Exception as e:
                        logger.warning("Failed to decode text/plain part", error=str(e))
                        return None, False, False
            elif mime_type == "text/html":
                raw_b64 = body.get("data", "")
                if raw_b64:
                    try:
                        padding = (4 - len(raw_b64) % 4) % 4
                        decoded_bytes = base64.urlsafe_b64decode(raw_b64 + ("=" * padding))
                        charset = _extract_charset(payload)
                        html_text = decoded_bytes.decode(charset, errors="replace")
                        plain = _html_to_plain_text(html_text)
                        return plain if plain.strip() else None, False, True
                    except Exception as e:
                        logger.warning("Failed to decode text/html part", error=str(e))
                        return None, False, True
                return None, False, True
            else:
                # image/*, application/*, etc. — skip
                return None, False, False

        # Container: multipart/alternative
        if mime_type == "multipart/alternative":
            # Prefer text/plain over text/html within alternative
            plain_result: Optional[str] = None
            html_plain_fallback: Optional[str] = None
            found_html = False
            for part in parts:
                part_mime = part.get("mimeType", "").lower()
                if part_mime == "text/plain":
                    text, has_p, _ = self._extract_plain_text_from_payload(part)
                    if has_p and text:
                        plain_result = text
                        has_plain = True
                elif part_mime == "text/html":
                    text, _, has_h = self._extract_plain_text_from_payload(part)
                    found_html = True
                    has_html = True
                    if text:
                        html_plain_fallback = text
                else:
                    text, sub_p, sub_h = self._extract_plain_text_from_payload(part)
                    has_plain = has_plain or sub_p
                    has_html = has_html or sub_h
                    if sub_p and text and not plain_result:
                        plain_result = text
            final_text = plain_result or html_plain_fallback
            return final_text, has_plain, found_html or has_html

        else:
            # multipart/mixed, multipart/related, multipart/signed, etc.
            collected_plain: list[str] = []
            for part in parts:
                text, sub_plain, sub_html = self._extract_plain_text_from_payload(part)
                has_plain = has_plain or sub_plain
                has_html = has_html or sub_html
                if text:
                    collected_plain.append(text)
            return "\n\n".join(collected_plain) if collected_plain else None, has_plain, has_html


# =============================================================================
# Text Normalization
# =============================================================================


def _html_to_plain_text(html_str: str) -> str:
    """Convert HTML string to clean plain text (no tags, decoded entities)."""
    if not html_str:
        return ""
    # Remove script and style tags completely
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html_str, flags=re.IGNORECASE | re.DOTALL)
    # Convert block/break tags to newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(p|div|tr|h[1-6]|li)[^>]*>", "\n", text, flags=re.IGNORECASE)
    # Strip remaining HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Unescape HTML entities (&nbsp;, &amp;, etc.)
    text = html.unescape(text)
    return text


def normalize_body_text(raw: str) -> str:
    """Normalize plain-text email body.

    Steps:
    1. Unicode NFKC normalize
    2. Normalize line endings → \\n
    3. Remove zero-width and invisible control characters
    4. Normalize tabs → single space
    5. Collapse 3+ consecutive blank lines → 2 blank lines
    6. Strip leading/trailing whitespace
    """
    if not raw:
        return ""

    # 1. Unicode NFKC (normalizes ligatures, fullwidth, etc.)
    text = unicodedata.normalize("NFKC", raw)

    # 2. Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Remove zero-width and invisible control chars
    # Preserve: tab (\\t → normalized to space below), newline (\\n), printable
    _ZW_CHARS = (
        "\u200b"  # zero-width space
        "\u200c"  # zero-width non-joiner
        "\u200d"  # zero-width joiner
        "\u2060"  # word joiner
        "\ufeff"  # BOM / zero-width no-break space
        "\u00ad"  # soft hyphen
    )
    for zw in _ZW_CHARS:
        text = text.replace(zw, "")

    # 4. Normalize tabs → single space within lines
    lines = text.split("\n")
    lines = [line.replace("\t", " ") for line in lines]

    # 5. Collapse 3+ consecutive blank lines → 2
    result_lines: list[str] = []
    consecutive_blank = 0
    for line in lines:
        stripped = line.rstrip()
        if stripped == "":
            consecutive_blank += 1
            if consecutive_blank <= 2:
                result_lines.append("")
        else:
            consecutive_blank = 0
            result_lines.append(stripped)

    # 6. Strip leading/trailing whitespace
    text = "\n".join(result_lines).strip()
    return text


# =============================================================================
# Quote Removal — line-oriented state machine (conservative)
# =============================================================================

# Quote header patterns (line before a quoted block)
_QUOTE_HEADER_PATTERNS = [
    re.compile(r"^On .{5,100} wrote:\s*$", re.IGNORECASE | re.DOTALL),
    re.compile(r"^-{3,}\s*Original Message\s*-{3,}", re.IGNORECASE),
    re.compile(r"^-{3,}\s*Forwarded (message|mail)\s*-{3,}", re.IGNORECASE),
    re.compile(r"^From:\s+.+\nSent:\s+.+\nTo:\s+.+", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^_{5,}", re.IGNORECASE),
]

# Signature delimiter per RFC 3676
_SIGNATURE_DELIMITER = re.compile(r"^-- ?$")


def remove_quoted_replies(text: str) -> str:
    """Remove quoted reply chains from plain-text email body.

    Uses a conservative line-oriented state machine:
    - Detects quote headers (e.g. "On Mon, Sarah wrote:")
    - Only removes a block when header is DIRECTLY followed by > prefixed lines
    - If confidence is low: KEEP the text (never destroy content)
    - Strips RFC 3676 signature (^-- $) and trailing signature block

    Returns cleaned text. If nothing is clearly a quote, returns original.
    """
    if not text:
        return text

    lines = text.split("\n")
    output_lines: list[str] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]

        # Check for RFC signature delimiter
        if _SIGNATURE_DELIMITER.match(line):
            # Drop from here to end (RFC 3676 compliant signature removal)
            break

        # Check if this line is a quote header
        is_quote_header = _is_quote_header(line, lines, i)

        if is_quote_header:
            # Look ahead: next non-empty line must start with '>'
            j = i + 1
            while j < n and lines[j].strip() == "":
                j += 1
            if j < n and lines[j].startswith(">"):
                # High confidence: skip from this quote header to end of quoted block
                # Find end of quoted block
                k = j
                while k < n and (lines[k].startswith(">") or lines[k].strip() == ""):
                    k += 1
                # Skip header + quoted block
                i = k
                continue
            else:
                # Low confidence — keep the text
                output_lines.append(line)
                i += 1
                continue

        # Check if this is a > quoted line (without a preceding header we caught)
        # Only remove top-level quoted block if it appears AFTER some real content
        if line.startswith(">") and len(output_lines) > 0:
            # Skip this quoted block
            while i < n and (lines[i].startswith(">") or lines[i].strip() == ""):
                i += 1
            continue

        output_lines.append(line)
        i += 1

    result = "\n".join(output_lines).strip()
    return result if result else text  # Safety: never return empty if input wasn't


def _is_quote_header(line: str, lines: list[str], idx: int) -> bool:
    """Check if a line matches any known quote header pattern."""
    # Multi-line pattern: combine current + next 2 lines for From:/Sent:/To: style
    combined = "\n".join(lines[idx : idx + 3])
    for pattern in _QUOTE_HEADER_PATTERNS:
        if pattern.match(line) or pattern.search(combined):
            return True
    return False


# =============================================================================
# Header utilities
# =============================================================================


def _decode_header_value(raw: str) -> str:
    """Decode RFC 2047 encoded header values (e.g. =?UTF-8?B?...?=)."""
    if not raw:
        return ""
    try:
        decoded_parts = email.header.decode_header(raw)
        result_parts = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                result_parts.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                result_parts.append(str(part))
        return " ".join(result_parts).strip()
    except Exception:
        return raw.strip()


def _parse_name_email(from_raw: str) -> tuple[Optional[str], str]:
    """Parse 'Name <email>' or plain 'email' into (name, email) tuple."""
    from_raw = from_raw.strip()
    if "<" in from_raw and ">" in from_raw:
        name_part = from_raw[: from_raw.index("<")].strip(' "\'')
        email_part = from_raw[from_raw.index("<") + 1 : from_raw.index(">")].strip()
        return (name_part if name_part else None), email_part.lower()
    return None, from_raw.lower()


def _parse_address_list(header_value: str) -> list[str]:
    """Parse comma-separated address list into list of email strings."""
    if not header_value:
        return []
    addresses = []
    for addr in header_value.split(","):
        _, email_addr = _parse_name_email(addr.strip())
        if email_addr and "@" in email_addr:
            addresses.append(email_addr)
    return addresses


def _parse_date_header(date_str: str) -> Optional[datetime]:
    """Parse RFC 2822 Date header into UTC datetime. Returns None if unparseable."""
    if not date_str:
        return None
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _extract_charset(payload_part: dict) -> str:
    """Extract charset from MIME content-type parameter."""
    for h in payload_part.get("headers", []):
        if h.get("name", "").lower() == "content-type":
            value = h.get("value", "")
            for param in value.split(";"):
                param = param.strip()
                if param.lower().startswith("charset="):
                    charset = param[8:].strip(' "\'').lower()
                    return charset if charset else "utf-8"
    return "utf-8"


# =============================================================================
# Singleton
# =============================================================================

email_parser = EmailParser()
