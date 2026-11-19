"""Email Filter Service — Enterprise Multi-Signal Relevance & Classification Engine.

Phase 10.1 Specifications:
- Distinguishes message category from the final storage/processing disposition.
- 7 Categories: BUSINESS_CONVERSATION, PROMOTIONAL_BULK, NON_CONVERSATIONAL_NOTIFICATION,
  SECURITY_OR_FINANCIAL_NOTICE, AUTOMATED_REPLY, SUSPICIOUS_OR_SPAM, AMBIGUOUS.
- 4 Dispositions: STORE_AND_RESOLVE_CONTEXT, SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
  STORE_WITHOUT_CONVERSATION_PROCESSING, REVIEW_OR_HOLD.
- Pre-persistence relevance gating: Suppressed messages NEVER enter `email_messages`.
- Multi-signal scoring with score carry-over from metadata to body classification.
- Strong protection for short human messages ("Hyyy", "Helloooooooo") and catalogue/pricing enquiries.
- Tenant-scoped allowlist and thread context awareness.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.services import mail_authenticity


# =============================================================================
# Categorization & Disposition Vocabulary (Phase 10.1 Contract)
# =============================================================================


class EmailCategory(str, Enum):
    """Categorical classification of the incoming message."""

    BUSINESS_CONVERSATION = "BUSINESS_CONVERSATION"
    PROMOTIONAL_BULK = "PROMOTIONAL_BULK"
    NON_CONVERSATIONAL_NOTIFICATION = "NON_CONVERSATIONAL_NOTIFICATION"
    SECURITY_OR_FINANCIAL_NOTICE = "SECURITY_OR_FINANCIAL_NOTICE"
    AUTOMATED_REPLY = "AUTOMATED_REPLY"
    SUSPICIOUS_OR_SPAM = "SUSPICIOUS_OR_SPAM"
    AMBIGUOUS = "AMBIGUOUS"


class EmailDisposition(str, Enum):
    """Actionable processing decision for the pipeline."""

    STORE_AND_RESOLVE_CONTEXT = "STORE_AND_RESOLVE_CONTEXT"
    SUPPRESS_BEFORE_EMAIL_PERSISTENCE = "SUPPRESS_BEFORE_EMAIL_PERSISTENCE"
    STORE_WITHOUT_CONVERSATION_PROCESSING = "STORE_WITHOUT_CONVERSATION_PROCESSING"
    REVIEW_OR_HOLD = "REVIEW_OR_HOLD"


# Backward-compatible enum mapping to support existing callers
class FilterDecision(str, Enum):
    """Canonical filter decision enum (mapped directly to disposition)."""

    ACCEPT = "ACCEPT"
    BLOCK_SPAM = "BLOCK_SPAM"
    BLOCK_PROMOTION = "BLOCK_PROMOTION"
    BLOCK_ADVERTISEMENT = "BLOCK_ADVERTISEMENT"
    BLOCK_TRANSACTIONAL = "BLOCK_TRANSACTIONAL"
    BLOCK_SECURITY_OR_FINANCIAL = "BLOCK_SECURITY_OR_FINANCIAL"
    BLOCK_AUTOMATED_REPLY = "BLOCK_AUTOMATED_REPLY"
    BLOCK_HTML_ONLY = "BLOCK_HTML_ONLY"
    BLOCK_EMPTY_BODY = "BLOCK_EMPTY_BODY"
    SKIP_TRASH = "SKIP_TRASH"
    SKIP_DELETED = "SKIP_DELETED"
    SKIP_DUPLICATE = "SKIP_DUPLICATE"
    MESSAGE_UNAVAILABLE = "MESSAGE_UNAVAILABLE"


@dataclass
class ClassificationResult:
    """Full, transparent classification outcome for an email message."""

    category: EmailCategory
    disposition: EmailDisposition
    confidence: float
    reasons: List[str] = field(default_factory=list)
    score: int = 0
    rule_version: str = "2026.10-v1"
    is_trusted: bool = False

    @property
    def should_store(self) -> bool:
        """Return True if message is permitted to be persisted in email_messages."""
        return self.disposition in (
            EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
            EmailDisposition.STORE_WITHOUT_CONVERSATION_PROCESSING,
        )

    @property
    def filter_decision(self) -> FilterDecision:
        """Map disposition/category to legacy FilterDecision for database columns."""
        if self.disposition == EmailDisposition.STORE_AND_RESOLVE_CONTEXT:
            return FilterDecision.ACCEPT
        if self.category == EmailCategory.SUSPICIOUS_OR_SPAM:
            return FilterDecision.BLOCK_SPAM
        if self.category == EmailCategory.SECURITY_OR_FINANCIAL_NOTICE:
            return FilterDecision.BLOCK_SECURITY_OR_FINANCIAL
        if self.category == EmailCategory.AUTOMATED_REPLY:
            return FilterDecision.BLOCK_AUTOMATED_REPLY
        if self.category == EmailCategory.NON_CONVERSATIONAL_NOTIFICATION:
            return FilterDecision.BLOCK_TRANSACTIONAL
        return FilterDecision.BLOCK_PROMOTION


# =============================================================================
# Signal Lexicons & Pattern Matching Rules
# =============================================================================

# System labels
_HARD_BLOCK_LABELS: frozenset[str] = frozenset(
    ["SPAM", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "CATEGORY_UPDATES"]
)
_TRASH_LABELS: frozenset[str] = frozenset(["TRASH"])

# High-confidence promotional / mailing list headers
_PROMOTIONAL_HEADERS: frozenset[str] = frozenset(
    ["list-unsubscribe", "list-id", "list-post", "list-help", "list-archive", "list-subscribe"]
)
_BULK_PRECEDENCE_VALUES: frozenset[str] = frozenset(["bulk", "list", "junk"])

# Sender domain patterns for financial/security notices
_FINANCIAL_SECURITY_DOMAINS: frozenset[str] = frozenset(
    [
        "bankofbaroda.bank.in",
        "bankofbaroda.com",
        "hdfcbank.net",
        "hdfcbank.com",
        "icicibank.com",
        "sbi.co.in",
        "axisbank.com",
        "notifications.heroku.com",
        "rentok.com",
        "stripe.com",
        "razorpay.com",
        "paypal.com",
    ]
)

# Known marketing, job alerts, digests, and notification domains
_PROMOTIONAL_JOB_DIGEST_DOMAINS: frozenset[str] = frozenset(
    [
        # Recruitment & Job platforms
        "indeed.com",
        "jobalert.indeed.com",
        "linkedin.com",
        "e.linkedin.com",
        "m.linkedin.com",
        "naukri.com",
        "shine.com",
        "monster.com",
        "glassdoor.com",
        "internshala.com",
        "hirist.com",
        "instahyre.com",
        "apna.co",
        # Social & Digest platforms
        "quora.com",
        "digest.quora.com",
        "reddit.com",
        "medium.com",
        # Changelogs & Marketing newsletters
        "neon.tech",
        "changelog.neon.tech",
        "otterly.ai",
        "otterlyai.com",
        "propeers.in",
        "crio.in",
        "mailchimp.com",
        "sendgrid.net",
    ]
)

_PRODUCT_NOTIFICATION_DOMAINS: frozenset[str] = frozenset(
    [
        "mail.cursor.com",
        "cursor.com",
    ]
)

_LOGISTICS_ECOMMERCE_DOMAINS: frozenset[str] = frozenset(
    [
        "shiprocket.in",
        "net.shiprocket.in",
        "delhivery.com",
        "bluedart.com",
        "dtdc.in",
        "xpressbees.com",
        "shadowfax.in",
        "myntra.com",
        "flipkart.com",
        "amazon.com",
        "amazon.in",
        "swiggy.in",
        "zomato.com",
        "thedermaco.com",
    ]
)

# Automated sender prefixes
_AUTOMATED_SENDER_PREFIXES: frozenset[str] = frozenset(
    [
        "noreply", "no-reply", "donotreply", "do-not-reply",
        "notifications", "notification", "alerts", "alert",
        "updates", "update", "digest", "jobs", "jobalert", "job-alert",
        "newsletter", "newsletters", "tracking", "shipping",
        "orders", "order", "delivery", "dispatch", "otp",
        "estatement", "statement", "bot",
    ]
)

# Subject patterns
_JOB_ALERT_PATTERNS = re.compile(
    r"(job\s*alert|vacancies\s*in|new\s*job\s*matches|new\s*fresher|hiring|job\s*for\s*student|developer\s*at)",
    re.IGNORECASE,
)

_DIGEST_NEWSLETTER_PATTERNS = re.compile(
    r"(top\s*stories\s*for|weekly\s*digest|newsletter|changelog|what\s*is\s*the\s*dark\s*side|how\s*much\s*does|access\s*your\s*learning)",
    re.IGNORECASE,
)

_PROMOTIONAL_CAMPAIGN_PATTERNS = re.compile(
    r"(webinar|bootcamp|new\s*launch|final\s*call|lowest\s*price|limited\s*time\s*offer|sale\s*ends|discount\s*code|promo\s*code|471%\s*hike|39\s*lpa|students\s*hired|taking\s*dev\s*jobs|exclusive\s*deal)",
    re.IGNORECASE,
)

_SHIPPING_DELIVERY_PATTERNS = re.compile(
    r"(has\s*been\s*delivered|out\s*for\s*delivery|arriving\s*early|arriving\s*today|reached\s*your\s*city|shipment\s*from\s*order|package\s*has\s*been\s*delivered)",
    re.IGNORECASE,
)

_FINANCIAL_SECURITY_PATTERNS = re.compile(
    r"(statement\s*of\s*your\s*account|e-statement|bank\s*statement|upi\s*payments|payment\s*receipt|tax\s*invoice|register\s*a\s*backup\s*mfa|mfa\s*verification|two-factor|security\s*alert|password\s*reset|otp|mdr\s*on)",
    re.IGNORECASE,
)

_PRODUCT_NOTIFICATION_PATTERNS = re.compile(
    r"(we\s*reset\s*your\s*.*usage|fast\s*request\s*quota|quota\s*has\s*been\s*reset|usage\s*reset|account\s*data\s*will\s*be\s*deleted|system\s*notification)",
    re.IGNORECASE,
)

_AUTOMATED_REPLY_PATTERNS = re.compile(
    r"(out\s*of\s*office|automatic\s*reply|undelivered\s*mail|delivery\s*status\s*notification)",
    re.IGNORECASE,
)

# Human enquiry & conversation signals (HIGH PRIORITY PROTECTION)
_INQUIRY_PATTERNS = re.compile(
    r"(catalogue|catalog|price\s*list|quotation|quote|pricing|inquiry|enquiry|proposal|ready\s*to\s*proceed|contract\s*discussion|thank\s*you\s*for\s*the\s*update|interested\s*in|can\s*you\s*share|please\s*send)",
    re.IGNORECASE,
)

_HUMAN_GREETINGS = re.compile(
    r"^(hyyy+|helloooooo+|hello+|hi+|hey+|dear\s+[a-z]+|good\s+morning|good\s+afternoon|good\s+evening)[\s,!.]*$",
    re.IGNORECASE,
)


# =============================================================================
# Classification Engine Implementation
# =============================================================================


class EmailFilterService:
    """Enterprise-grade multi-signal email relevance and classification service."""

    async def classify_metadata(
        self,
        label_ids: List[str],
        headers: Dict[str, str],
        db: Optional[AsyncSession],
        tenant_id: str,
        is_existing_conversation: bool = False,
        own_domain: str = "",
    ) -> ClassificationResult:
        """Stage 1: Evaluate metadata and headers before fetching full email body.
        
        Returns ClassificationResult. If disposition is SUPPRESS, caller skips Phase 2 body fetch entirely.
        """
        from_raw = headers.get("from", "").lower()
        sender_email = _extract_email_addr(from_raw)
        sender_domain = _extract_domain(sender_email)

        # 1. Allowlist / Trusted Senders check (tenant-scoped)
        if db is not None:
            is_trusted = await self._check_allowlist(sender_email, sender_domain, tenant_id, db)
            if is_trusted:
                return ClassificationResult(
                    category=EmailCategory.BUSINESS_CONVERSATION,
                    disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
                    confidence=1.0,
                    reasons=["sender_in_tenant_allowlist"],
                    score=0,
                    is_trusted=True,
                )

        return self.classify_metadata_sync(
            label_ids=label_ids,
            headers=headers,
            tenant_id=tenant_id,
            is_existing_conversation=is_existing_conversation,
            own_domain=own_domain,
        )

    def classify_metadata_sync(
        self,
        label_ids: List[str],
        headers: Dict[str, str],
        tenant_id: str,
        is_existing_conversation: bool = False,
        own_domain: str = "",
    ) -> ClassificationResult:
        """Synchronous multi-signal metadata evaluator (in-memory deterministic signals)."""
        score = 0
        reasons: List[str] = []

        from_raw = headers.get("from", "").lower()
        sender_email = _extract_email_addr(from_raw)
        sender_domain = _extract_domain(sender_email)
        subject_raw = headers.get("subject", "")

        # 2. System Labels
        label_set = set(label_ids)
        if "SPAM" in label_set:
            return ClassificationResult(
                category=EmailCategory.SUSPICIOUS_OR_SPAM,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=1.0,
                reasons=["gmail_label:SPAM"],
                score=100,
            )
        if label_set & _TRASH_LABELS:
            return ClassificationResult(
                category=EmailCategory.SUSPICIOUS_OR_SPAM,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=1.0,
                reasons=["gmail_label:TRASH"],
                score=100,
            )

        # 3. Existing Conversation Thread Continuity
        # If the thread already contains a verified human/business conversation, give strong preference
        if is_existing_conversation:
            score -= 40
            reasons.append("existing_active_conversation_thread")

        # 4. Check Financial & Security Notifications
        if _is_domain_match(sender_domain, _FINANCIAL_SECURITY_DOMAINS) or _FINANCIAL_SECURITY_PATTERNS.search(subject_raw):
            return ClassificationResult(
                category=EmailCategory.SECURITY_OR_FINANCIAL_NOTICE,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.95,
                reasons=["financial_or_security_notice_detected"],
                score=90,
            )

        # 5. Check Automated Replies
        lower_headers = {k.lower(): v.lower() for k, v in headers.items()}
        auto_submitted = lower_headers.get("auto-submitted", "")
        if auto_submitted in ("auto-replied", "auto-generated") or _AUTOMATED_REPLY_PATTERNS.search(subject_raw):
            return ClassificationResult(
                category=EmailCategory.AUTOMATED_REPLY,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.90,
                reasons=[f"automated_reply_detected:{auto_submitted or 'subject'}"],
                score=85,
            )

        # 6. Check Product Usage Announcements & System Notifications
        if _is_domain_match(sender_domain, _PRODUCT_NOTIFICATION_DOMAINS) or _PRODUCT_NOTIFICATION_PATTERNS.search(subject_raw):
            return ClassificationResult(
                category=EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.95,
                reasons=["product_usage_notification_detected"],
                score=85,
            )

        # 7. Check Job Alerts & Digests
        if _is_domain_match(sender_domain, _PROMOTIONAL_JOB_DIGEST_DOMAINS) or _JOB_ALERT_PATTERNS.search(subject_raw) or _DIGEST_NEWSLETTER_PATTERNS.search(subject_raw):
            return ClassificationResult(
                category=EmailCategory.PROMOTIONAL_BULK,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.95,
                reasons=["job_alert_or_digest_detected"],
                score=85,
            )

        # 7. Check Logistics / Shipping & E-commerce Notifications
        if _is_domain_match(sender_domain, _LOGISTICS_ECOMMERCE_DOMAINS) or _SHIPPING_DELIVERY_PATTERNS.search(subject_raw):
            # Check if this is an active customer support thread (e.g. Freshdesk query regarding an order)
            if "freshdesk.com" in sender_domain or "zendesk.com" in sender_domain or "ticket" in subject_raw.lower():
                # Support conversation regarding an order -> Preserve for triage
                score -= 20
                reasons.append("support_desk_order_ticket")
            else:
                return ClassificationResult(
                    category=EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
                    disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                    confidence=0.95,
                    reasons=["shipping_or_delivery_notification_detected"],
                    score=85,
                )

        # 8. Check Promotional Subject Patterns
        if _PROMOTIONAL_CAMPAIGN_PATTERNS.search(subject_raw):
            return ClassificationResult(
                category=EmailCategory.PROMOTIONAL_BULK,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.95,
                reasons=["promotional_campaign_subject_matched"],
                score=80,
            )

        # 8b. Hard evidence of machine-sent mail (RFC 3834 auto-submitted, no-reply senders,
        # verification / login / security codes, bulk precedence, Gmail Promotions/Social/Forums).
        auth = mail_authenticity.assess(labels=label_ids, headers=headers, subject=subject_raw,
                                        existing_conversation=is_existing_conversation, own_domain=own_domain)
        if auth.hard_reason:
            return _rejected(auth)

        # 9. Header Signals (Accumulate into score for Stage 2)
        if any(h in lower_headers for h in _PROMOTIONAL_HEADERS):
            score += 35
            reasons.append("promotional_list_headers_present")

        precedence = lower_headers.get("precedence", "")
        if precedence in _BULK_PRECEDENCE_VALUES:
            score += 35
            reasons.append(f"precedence:{precedence}")

        sender_local = sender_email.split("@")[0] if "@" in sender_email else ""
        if any(sender_local == p or sender_local.startswith(p + "-") or sender_local.startswith(p + ".") for p in _AUTOMATED_SENDER_PREFIXES):
            score += 25
            reasons.append(f"automated_sender_localpart:{sender_local}")

        # Check explicit customer inquiries in subject
        if _INQUIRY_PATTERNS.search(subject_raw):
            score -= 50
            reasons.append("customer_inquiry_intent_in_subject")

        # Threshold check for metadata stage
        if score >= 60:
            return ClassificationResult(
                category=EmailCategory.PROMOTIONAL_BULK,
                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                confidence=0.85,
                reasons=reasons,
                score=score,
            )

        # Pass to Phase 2 (fetch full body) with accumulated score
        return ClassificationResult(
            category=EmailCategory.AMBIGUOUS,
            disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
            confidence=0.50,
            reasons=reasons,
            score=score,
        )

    def classify_body(
        self,
        body_text: str,
        subject: str,
        from_header: str,
        metadata_result: Optional[ClassificationResult] = None,
        headers: Optional[Dict[str, str]] = None,
        label_ids: Optional[List[str]] = None,
        is_existing_conversation: bool = False,
        own_domain: str = "",
    ) -> ClassificationResult:
        """Stage 2: decide from the full message whether a PERSON wrote it to the business.

        Order matters: a metadata-stage rejection is final (no keyword can resurrect it), hard
        automation evidence rejects, and only mail with human evidence is a business conversation.
        Mail the signals cannot decide is returned as AMBIGUOUS for the caller's second opinion.
        """
        reasons = list(metadata_result.reasons) if metadata_result else []
        clean_body = (body_text or "").strip()
        subject = subject or ""

        # 1. A rejection from the metadata stage is final.
        if metadata_result is not None and not metadata_result.should_store:
            return metadata_result
        if metadata_result is not None and metadata_result.is_trusted:
            return metadata_result

        hdrs = dict(headers or {})
        hdrs.setdefault("from", from_header or "")
        hdrs.setdefault("subject", subject)
        auth = mail_authenticity.assess(labels=label_ids or [], headers=hdrs, subject=subject, body=clean_body,
                                        existing_conversation=is_existing_conversation, own_domain=own_domain)
        # Legacy protections count as human evidence (they no longer override automation evidence).
        if _HUMAN_GREETINGS.match(clean_body) or _HUMAN_GREETINGS.match(subject.lower()):
            auth.human += 25
            auth.reasons.append("human_greeting_detected")
        if _INQUIRY_PATTERNS.search(clean_body) or _INQUIRY_PATTERNS.search(subject):
            auth.human += 25
            auth.reasons.append("customer_inquiry_or_order_language")
        reasons += auth.reasons
        verdict = auth.verdict

        if verdict == "REJECT":
            return _rejected(auth, reasons)

        if verdict != "HUMAN":
            # Legacy notification rules decide the obvious remaining cases.
            for pattern, category, why in (
                (_FINANCIAL_SECURITY_PATTERNS, EmailCategory.SECURITY_OR_FINANCIAL_NOTICE, "body_financial_or_security_markers"),
                (_SHIPPING_DELIVERY_PATTERNS, EmailCategory.NON_CONVERSATIONAL_NOTIFICATION, "shipping_delivery_markers"),
                (_PRODUCT_NOTIFICATION_PATTERNS, EmailCategory.NON_CONVERSATIONAL_NOTIFICATION, "body_product_notification_markers"),
                (_PROMOTIONAL_CAMPAIGN_PATTERNS, EmailCategory.PROMOTIONAL_BULK, "promotional_campaign_subject_matched"),
                (_JOB_ALERT_PATTERNS, EmailCategory.PROMOTIONAL_BULK, "job_alert_subject_matched"),
                (_DIGEST_NEWSLETTER_PATTERNS, EmailCategory.PROMOTIONAL_BULK, "digest_newsletter_subject_matched"),
            ):
                if pattern.search(subject) or (pattern is not _JOB_ALERT_PATTERNS and pattern.search(clean_body)):
                    reasons.append(why)
                    return ClassificationResult(category=category,
                                                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                                                confidence=0.85, reasons=reasons, score=auth.automation)

        if verdict == "HUMAN":
            return ClassificationResult(
                category=EmailCategory.BUSINESS_CONVERSATION,
                disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
                confidence=0.9,
                reasons=reasons,
                score=auth.automation,
            )
        # Undecided: the caller asks the small classifier before anything is stored.
        return ClassificationResult(
            category=EmailCategory.AMBIGUOUS,
            disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
            confidence=0.5,
            reasons=reasons + [f"unsure:human={auth.human},automation={auth.automation}"],
            score=auth.automation,
        )

    async def _check_allowlist(
        self,
        sender_email: str,
        sender_domain: str,
        tenant_id: str,
        db: AsyncSession,
    ) -> bool:
        """Check if sender email or domain is in the org-level trusted_senders table."""
        try:
            from app.models.inbox import TrustedSender
            from sqlalchemy import or_

            stmt = select(TrustedSender).where(
                TrustedSender.tenant_id == tenant_id,
                or_(
                    TrustedSender.email == sender_email,
                    TrustedSender.domain == sender_domain,
                ),
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none() is not None
        except Exception as exc:
            logger.warning("Allowlist check failed, defaulting to no trust", error=str(exc))
            return False


# =============================================================================
# Helper Utilities
# =============================================================================


_HARD_KIND_CATEGORY = {
    "security": EmailCategory.SECURITY_OR_FINANCIAL_NOTICE,
    "automated_reply": EmailCategory.AUTOMATED_REPLY,
    "promotional": EmailCategory.PROMOTIONAL_BULK,
    "bulk": EmailCategory.PROMOTIONAL_BULK,
    "notification": EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
}


def _rejected(auth: "mail_authenticity.Authenticity", reasons: Optional[List[str]] = None) -> ClassificationResult:
    """Never stored, never answered."""
    category = _HARD_KIND_CATEGORY.get(auth.hard_kind, EmailCategory.PROMOTIONAL_BULK)
    if not auth.hard_kind and any(r.startswith(("gmail_tab", "transactional")) for r in auth.reasons):
        category = EmailCategory.NON_CONVERSATIONAL_NOTIFICATION
    return ClassificationResult(
        category=category,
        disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
        confidence=0.95 if auth.hard_reason else 0.85,
        reasons=list(reasons if reasons is not None else auth.reasons),
        score=max(auth.automation, 90 if auth.hard_reason else 0),
    )


def _extract_email_addr(from_header: str) -> str:
    """Extract clean email address from 'Name <email>' format."""
    from_header = from_header.strip().lower()
    if "<" in from_header and ">" in from_header:
        start = from_header.index("<") + 1
        end = from_header.index(">")
        return from_header[start:end].strip()
    return from_header


def _extract_domain(email_addr: str) -> str:
    """Extract domain part from email address."""
    if "@" in email_addr:
        return email_addr.split("@", 1)[1].strip()
    return ""


def _is_domain_match(sender_domain: str, domain_set: frozenset[str]) -> bool:
    """Check exact match or subdomain suffix match."""
    if not sender_domain:
        return False
    for blocked in domain_set:
        if sender_domain == blocked or sender_domain.endswith("." + blocked):
            return True
    return False


email_filter = EmailFilterService()
