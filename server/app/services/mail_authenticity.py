"""Is this inbound email written by a person who expects a business reply?

ProxiPilot must only store and answer genuine, human-written business mail. Verification codes,
login alerts, receipts, newsletters, promotions, drip "follow-ups" from sales tools, mailing lists
and anything sent by a machine are rejected BEFORE persistence (never stored, never answered).

Why not Rspamd: Rspamd scores *spam*. A verification code from a legitimate company is ham to a
spam scorer, so it would pass; Gmail already provides spam filtering (SPAM label). What we need is
the automated-vs-human distinction, which these signals capture:

  * hard evidence of automation (RFC 3834 Auto-Submitted, Precedence bulk/list, no-reply senders,
    one-time-code / verification content, Gmail Promotions/Social/Forums tabs)
  * soft automation evidence (bulk-ESP fingerprints, list headers, Gmail Updates tab, "do not
    reply / unsubscribe / view in browser" footers, cold-outreach & drip follow-up phrasing, links)
  * human evidence (sent from a personal mail client, greeting, question/request, first person,
    few links, an existing conversation in which the business already replied)

Pure functions only (unit-tested). Business-agnostic: no tenant, product or brand words.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

# --------------------------------------------------------------------------- vocabularies

# Senders that never read replies. Mail from them is never stored, and replies are never sent to them.
NO_REPLY_LOCALPARTS = re.compile(
    r"^(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|noreply[-_.].*|.*[-_.]no[-_.]?reply|mailer[-_.]?daemon|"
    r"postmaster|bounces?|bounce[-_.].*|.*[-_.]bounces?|auto[-_.]?(reply|responder|mail)|system|robot|bot)$",
    re.IGNORECASE)

AUTOMATED_LOCALPARTS = re.compile(
    r"^(notifications?|notify|alerts?|updates?|digest|news|newsletters?|marketing|promo(tions?)?|offers?|deals?|"
    r"jobs?|job[-_.]?alerts?|careers|hr[-_.]?ops|tracking|shipping|orders?|delivery|dispatch|otp|verify|"
    r"verification|security|accounts?|billing|invoices?|receipts?|statements?|estatement|feedback|survey|"
    r"events?|webinars?|community|team|info[-_.]?mail|mailer|mailers|campaigns?)([-_.].*)?$",
    re.IGNORECASE)

# Bulk / transactional email platforms add these headers. Their presence means a machine sent it.
ESP_HEADER_PREFIXES = (
    "x-sg-", "x-sendgrid", "x-ses-", "x-amz-", "x-mailgun", "x-mg-", "x-mc-", "x-mailchimp", "x-mandrill",
    "x-campaign", "x-campaignid", "x-marketo", "x-mkto", "x-hubspot", "x-hs-", "x-pardot", "x-sfmc",
    "x-sendinblue", "x-sib-", "x-mailjet", "x-mj-", "x-pm-", "x-postmark", "x-klaviyo", "x-braze",
    "x-iterable", "x-clevertap", "x-moengage", "x-netcore", "x-pepipost", "x-zeptomail", "x-zoho-campaign",
    "x-msys-", "x-sparkpost", "x-customerio", "x-intercom", "x-mailerlite", "x-convertkit", "x-activecampaign",
    "x-lemlist", "x-instantly", "x-smartlead", "x-apollo", "x-outreach", "x-mailshake", "x-woodpecker",
    "x-mailer-recptid", "x-rpcampaign", "x-report-abuse", "x-csa-complaints", "x-feedback-id",
)
ESP_HEADERS_EXACT = ("feedback-id", "list-unsubscribe-post", "x-abuse-reports-to", "x-sfdc-lk", "x-entity-ref-id")
ESP_MESSAGE_ID_DOMAINS = re.compile(
    r"@(?:[\w.-]*\.)?(sendgrid\.net|amazonses\.com|mailgun\.(?:org|net)|mandrillapp\.com|mcsv\.net|mcdlv\.net|"
    r"rsgsv\.net|sparkpostmail\.com|mailjet\.com|sendinblue\.com|brevo\.com|pmta|hubspot(?:email)?\.net|"
    r"exacttarget\.com|mktomail\.com|klaviyomail\.com|customeriomail\.com|postmarkapp\.com|zeptomail\.com|"
    r"netcorecloud\.net|pepipost\.net|mailerlite\.com|createsend\.com|cmail\d*\.com)>?$", re.IGNORECASE)

# Personal mail clients (people typing in Gmail / Outlook / Apple Mail / Yahoo / Zoho Mail).
HUMAN_MESSAGE_ID_DOMAINS = re.compile(
    r"@(mail\.gmail\.com|[\w-]+\.(?:\w+\.)?prod\.outlook\.com|[\w.-]*outlook\.com|[\w.-]*hotmail\.com|"
    r"icloud\.com|me\.com|mac\.com|mail\.yahoo\.com|[\w.-]*yahoo\.com|zoho\.com|zohomail\.\w+|[\w.-]*\.zoho\.in)>?$",
    re.IGNORECASE)
HUMAN_MAILERS = re.compile(r"(microsoft outlook|apple mail|iphone mail|thunderbird|zoho mail|android|"
                           r"samsung|yahoo mail|airmail|spark|superhuman|front)", re.IGNORECASE)

# One-time codes, verification, sign-in / security notices: always machine-sent, never answered.
OTP_SUBJECT = re.compile(
    r"(verification\s*code|verify\s*(your|this)?\s*(e-?mail|account|identity|address|sign[- ]?in)|"
    r"confirm\s*(your)?\s*(e-?mail|account|address|sign[- ]?up|registration)|one[- ]time\s*(pass(code|word)?|code|pin)|"
    r"\botp\b|login\s*code|log-?in\s*code|sign[- ]?in\s*code|security\s*code|access\s*code|auth(entication)?\s*code|"
    r"\b\d{4,8}\b\s*(is|was)\s*your\b|your\s*(temporary|one[- ]time)?\s*(login|sign[- ]?in|verification)\s*(code|link)|"
    r"password\s*(reset|change|recovery)|reset\s*your\s*password|two[- ]?(factor|step)|\b2fa\b|\bmfa\b|"
    r"new\s*(sign[- ]?in|login)\b|suspicious\s*(sign[- ]?in|log-?in|activity)|security\s*alert|"
    r"account\s*(activity|alert|verification|recovery)|magic\s*link)",
    re.IGNORECASE)
OTP_BODY = re.compile(
    r"(verification\s*code|one[- ]time\s*(pass(code|word)?|code|pin)|\botp\b|your\s*(login|sign[- ]?in|"
    r"security|access|confirmation)\s*code|enter\s*(this|the)\s*(temporary\s*)?(verification\s*)?code|"
    r"use\s*this\s*code|code\s*(expires|is\s*valid)|expires?\s*in\s*\d+\s*(minutes?|mins?|hours?)|"
    r"never\s*share\s*(this|the|your)\s*code|do\s*not\s*share\s*(this|the|your)\s*(code|otp)|"
    r"if\s*you\s*did(n[’']?t|\s*not)\s*(request|try|attempt|sign|initiate)|verify\s*your\s*(e-?mail|account)|"
    r"confirm\s*your\s*(e-?mail|account|address)|reset\s*your\s*password|suspicious\s*(log-?in|sign[- ]?in))",
    re.IGNORECASE)
OTP_CODE_NEAR = re.compile(r"\b(code|otp|pin)\b[^.\n]{0,40}?(?<![\w,.])\d[\d -]{2,8}\d(?![\w,.])|"
                           r"(?<![\w,.])\d[\d -]{2,8}\d(?![\w,.])[^.\n]{0,40}?\b(code|otp)\b", re.IGNORECASE)

TRANSACTIONAL_SUBJECT = re.compile(
    r"(order\s*(#|no\.?|number)?\s*\w*\s*(confirmed|placed|shipped|delivered|cancel+ed)|your\s*order|"
    r"receipt\s*(for|from)|payment\s*(received|successful|confirmation|failed|due)|invoice\s*#?\s*\d|"
    r"subscription\s*(renew|expir|cancel|confirm)|trial\s*(ends|expir|is\s*ending)|welcome\s*to\s*\w+|"
    r"thanks?\s*for\s*(signing\s*up|subscribing|registering|joining|your\s*(order|purchase|payment))|"
    r"(account|profile)\s*(created|updated|deleted)|your\s*\w+\s*(statement|summary|report)\s*(is\s*ready|for)|"
    r"(weekly|monthly|daily)\s*(digest|summary|report|update|newsletter)|newsletter|webinar|"
    r"(new|recommended)\s*(jobs?|matches|for\s*you)|has\s*(shared|invited|mentioned|commented)|"
    r"(invitation|invited\s*you)\s*to|calendar\s*(invitation|event)|reminder:)",
    re.IGNORECASE)

AUTOMATED_FOOTER = re.compile(
    r"(do\s*not\s*reply|don[’']?t\s*reply|please\s*do\s*not\s*respond|this\s*(is\s*an?|was\s*an?)\s*automated|"
    r"automatically\s*generated|auto-?generated|this\s*mailbox\s*is\s*(not|un)monitored|unmonitored|"
    r"unsubscribe|manage\s*(your\s*)?(e-?mail\s*)?preferences|update\s*(your\s*)?preferences|"
    r"view\s*(this\s*e-?mail\s*)?in\s*(your\s*)?browser|you\s*(are\s*)?receiv(ed|ing)\s*this|"
    r"you\s*were\s*sent\s*this|sent\s*to\s*\S+@\S+\s*because|no\s*longer\s*(wish|want)\s*to\s*receive|"
    r"opt[- ]?out|all\s*rights\s*reserved|privacy\s*policy\s*\|?\s*terms|©\s*\d{4})",
    re.IGNORECASE)

PROMO_BODY = re.compile(
    r"(limited\s*time|offer\s*ends|sale\s*ends|\d+\s*%\s*off|coupon|promo\s*code|discount\s*code|free\s*shipping|"
    r"shop\s*now|buy\s*now|order\s*now|register\s*now|sign\s*up\s*(now|today|free)|reserve\s*your\s*(spot|seat)|"
    r"claim\s*your|exclusive\s*(deal|offer|access)|early\s*bird|best\s*price\s*guaranteed|act\s*now|"
    r"don[’']?t\s*miss|last\s*chance|final\s*call|new\s*arrivals?|flash\s*sale)",
    re.IGNORECASE)

# Sales-tool sequences pretending to be personal ("just following up", "book a call").
COLD_OUTREACH = re.compile(
    r"(calendly\.com|cal\.com/|hubspot\.com/meetings|book\s*a\s*(call|demo|meeting|time|slot)|"
    r"schedule\s*a\s*(call|demo|meeting)|(\d{2}|fifteen|thirty)[- ]?min(ute)?s?\s*(call|chat|meeting)|"
    r"quick\s*(call|chat)\s*(this|next)\s*week|i\s*help\s*(companies|businesses|brands|teams|founders)|"
    r"we\s*help\s*(companies|businesses|brands|teams|founders)|worth\s*a\s*(quick\s*)?(chat|call)|"
    r"open\s*to\s*a\s*(quick\s*)?(chat|call|conversation)|reply\s*[\"“']?(yes|stop|interested)[\"”']?)",
    re.IGNORECASE)
DRIP_FOLLOW_UP = re.compile(
    r"(just\s*(following|checking)\s*(up|in)|bumping\s*(this|my)|circling\s*back|floating\s*this|"
    r"following\s*up\s*on\s*my\s*(last|previous|earlier)\s*(e-?mail|note|message)|"
    r"did\s*you\s*(get|have)\s*a\s*chance|any\s*thoughts\s*on\s*my\s*(last|previous)|"
    r"haven[’']?t\s*heard\s*back|last\s*attempt|closing\s*the\s*loop|break-?up\s*e-?mail)",
    re.IGNORECASE)

GREETING = re.compile(r"^\s*(hi+|hello+|hey+|hyy+|dear\s+\w+|good\s*(morning|afternoon|evening)|namaste|"
                      r"greetings|respected\s+\w+)\b", re.IGNORECASE)
REQUEST = re.compile(
    r"(\?|\b(please|kindly|pls|plz|need|require|want|looking\s*for|interested\s*in|could\s*you|can\s*you|"
    r"would\s*you|share|send|quote|quotation|price|pricing|rate|order|enquir|inquir|availability|catalogu?e|"
    r"sample|delivery|dispatch|invoice|payment|meeting|discuss|call\s*me|let\s*me\s*know)\b)",
    re.IGNORECASE)
FIRST_PERSON = re.compile(r"\b(i|i'm|i am|we|we're|we are|my|our|me|us|mujhe|humein|hume|hum)\b", re.IGNORECASE)
LINK = re.compile(r"https?://\S+", re.IGNORECASE)

HARD_BLOCK_TABS = frozenset({"CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"})


# --------------------------------------------------------------------------- verdict

@dataclass
class Authenticity:
    hard_reason: Optional[str] = None      # set => never store, never answer
    hard_kind: str = ""                    # security | automated_reply | promotional | notification | bulk
    automation: int = 0                    # soft automation evidence
    human: int = 0                         # human-written evidence
    reasons: List[str] = field(default_factory=list)

    @property
    def verdict(self) -> str:
        """REJECT | HUMAN | UNSURE (UNSURE => ask the small classifier)."""
        if self.hard_reason:
            return "REJECT"
        if self.automation >= 45 and self.automation >= self.human + 15:
            return "REJECT"
        if self.human >= 25 and self.automation < 25:
            return "HUMAN"
        return "UNSURE"


def _addr(from_header: str) -> str:
    m = re.search(r"[\w.+'-]+@[\w.-]+\.\w+", from_header or "")
    return m.group(0).lower() if m else (from_header or "").strip().lower()


def is_no_reply_address(address: str) -> bool:
    """Replies must never be sent to these (nobody reads them)."""
    local = _addr(address).split("@")[0].split("+")[0]      # bounces+tag@ -> bounces
    return bool(local) and bool(NO_REPLY_LOCALPARTS.match(local))


def _group_forward(h: Dict[str, str], own_domain: str) -> bool:
    """Google Groups / collaborative inboxes add list headers to genuine mail sent to sales@ etc."""
    if "x-google-group-id" in h or "mailing-list" in h and "google" in h.get("mailing-list", ""):
        return True
    list_id = h.get("list-id", "")
    return bool(own_domain) and own_domain in list_id


def assess(
    *,
    labels: Iterable[str] = (),
    headers: Optional[Dict[str, str]] = None,
    subject: str = "",
    body: str = "",
    existing_conversation: bool = False,
    own_domain: str = "",
) -> Authenticity:
    """Score one inbound message. Works with headers only (metadata stage) or with the body too."""
    h = {k.lower(): (v or "") for k, v in (headers or {}).items()}
    a = Authenticity()
    label_set = set(labels or ())
    sender = _addr(h.get("from", ""))
    local = sender.split("@")[0].split("+")[0] if "@" in sender else ""
    subj = subject or h.get("subject", "")
    text = body or ""

    def hard(reason: str, kind: str) -> Authenticity:
        a.hard_reason, a.hard_kind = reason, kind
        a.reasons.append(reason)
        return a

    # ---- hard evidence (independent of the conversation: a code or an auto-reply is never a customer)
    auto_sub = h.get("auto-submitted", "").strip().lower()
    if auto_sub and auto_sub != "no":
        return hard(f"auto_submitted:{auto_sub}", "automated_reply")
    if local and NO_REPLY_LOCALPARTS.match(local):
        return hard(f"no_reply_sender:{local}", "notification")
    if OTP_SUBJECT.search(subj):
        return hard("verification_or_security_subject", "security")
    if text:
        phrases = {m.group(0).lower() for m in OTP_BODY.finditer(text)}
        if len(phrases) >= 2 or (phrases and OTP_CODE_NEAR.search(text)):
            return hard("verification_or_security_body", "security")
    group = _group_forward(h, own_domain)
    prec = h.get("precedence", "").strip().lower()
    if prec in ("bulk", "junk", "auto_reply") or (prec == "list" and not group):
        return hard(f"precedence:{prec}", "bulk")
    if label_set & HARD_BLOCK_TABS and not existing_conversation:
        return hard("gmail_tab:" + ",".join(sorted(label_set & HARD_BLOCK_TABS)), "promotional")

    # ---- soft automation evidence
    def auto(points: int, reason: str) -> None:
        a.automation += points
        a.reasons.append(reason)

    if "CATEGORY_UPDATES" in label_set and not existing_conversation:
        auto(40, "gmail_tab:CATEGORY_UPDATES")
    if not group and any(k in h for k in ("list-id", "list-unsubscribe", "list-post", "list-help", "list-archive")):
        auto(40, "mailing_list_headers")
    esp = [k for k in h if k.startswith(ESP_HEADER_PREFIXES) or k in ESP_HEADERS_EXACT]
    if esp:
        auto(40, f"bulk_sender_headers:{esp[0]}")
    msg_id = h.get("message-id", "")
    if ESP_MESSAGE_ID_DOMAINS.search(msg_id):
        auto(35, "bulk_sender_message_id")
    if "x-auto-response-suppress" in h and h["x-auto-response-suppress"].strip().lower() not in ("", "none"):
        auto(25, "x_auto_response_suppress")
    if local and AUTOMATED_LOCALPARTS.match(local):
        auto(30, f"automated_sender:{local}")
    if TRANSACTIONAL_SUBJECT.search(subj):
        auto(35, "transactional_or_digest_subject")
    if text:
        footers = len({m.group(0).lower() for m in AUTOMATED_FOOTER.finditer(text)})
        if footers:
            auto(min(60, 20 * footers), f"automated_footer:{footers}")
        promos = len({m.group(0).lower() for m in PROMO_BODY.finditer(text)})
        if promos >= 2:
            auto(30, f"promotional_body:{promos}")
        elif promos == 1:
            auto(10, "promotional_body:1")
        if not existing_conversation:
            if COLD_OUTREACH.search(text):
                auto(35, "cold_outreach")
            if DRIP_FOLLOW_UP.search(text):
                auto(25, "drip_follow_up")
        links = len(LINK.findall(text))
        if links > 5:
            auto(20, f"many_links:{links}")

    # ---- human evidence
    def human(points: int, reason: str) -> None:
        a.human += points
        a.reasons.append(reason)

    if existing_conversation:
        human(35, "existing_conversation")
    if HUMAN_MESSAGE_ID_DOMAINS.search(msg_id):
        human(20, "personal_mail_client")
    elif HUMAN_MAILERS.search(h.get("x-mailer", "") + " " + h.get("user-agent", "")):
        human(15, "personal_mail_client")
    if text:
        stripped = text.strip()
        if GREETING.search(stripped) or GREETING.search(subj):
            human(10, "greeting")
        if REQUEST.search(stripped) or REQUEST.search(subj):
            human(15, "question_or_request")
        if len(FIRST_PERSON.findall(stripped[:1500])) >= 1:
            human(5, "first_person")
        if len(stripped) <= 2500 and len(LINK.findall(stripped)) <= 2:
            human(5, "short_plain_message")
    return a
