"""Company Info editor contract — one shared, industry-neutral schema for every workspace.

Two kinds of facts:
* SHARED facts are owned by ``organizations`` / ``business_profiles`` (entered at signup). The editor
  edits them through the same owners, so signup data and Company Info never diverge.
* COMPANY facts are owned by ``company_info_profiles.facts`` (contact routes, branches, hours, ...).

Repeated records (contact routes, branches, hours, enquiry links) carry stable ids so they can be
added, edited and removed independently. Every value is validated server-side; user text is data
(control characters stripped, lengths bounded) and never interpreted as instructions.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------------------------
# Normalizers
# ---------------------------------------------------------------------------------------------

_CONTROL = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def clean_text(value: Any, max_len: int) -> Optional[str]:
    """Trim, strip control characters and collapse runs of spaces. Empty -> None."""
    if value is None:
        return None
    text = _CONTROL.sub("", str(value)).replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        return None
    if len(text) > max_len:
        raise ValueError(f"must be at most {max_len} characters")
    return text


def normalize_url(value: Any) -> Optional[str]:
    text = clean_text(value, 2048)
    if text is None:
        return None
    if not re.match(r"^https?://", text, re.IGNORECASE):
        text = "https://" + text
    host = re.sub(r"^https?://", "", text, flags=re.IGNORECASE).split("/")[0].split("?")[0]
    if " " in text or "." not in host or len(host) < 4:
        raise ValueError("must be a valid web address, e.g. https://example.com")
    return text


def normalize_email(value: Any) -> Optional[str]:
    text = clean_text(value, 254)
    if text is None:
        return None
    text = text.lower()
    if not _EMAIL.match(text):
        raise ValueError("must be a valid email address")
    return text


def normalize_phone(value: Any) -> Optional[str]:
    """Jurisdiction-neutral: keep the user's formatting, require 6-20 digits and allowed symbols."""
    text = clean_text(value, 40)
    if text is None:
        return None
    if not re.fullmatch(r"\+?[\d\s().\-/]+(\s*(ext\.?|x)\s*\d{1,6})?", text, re.IGNORECASE):
        raise ValueError("must be a phone number (digits, spaces, + - ( ) only)")
    digits = re.sub(r"\D", "", text.split("x")[0].split("ext")[0])
    if not 6 <= len(digits) <= 20:
        raise ValueError("must contain 6-20 digits")
    return text


def normalize_timezone(value: Any) -> Optional[str]:
    text = clean_text(value, 64)
    if text is None:
        return None
    try:
        ZoneInfo(text)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("must be a time zone such as Asia/Kolkata or Europe/London")
    return text


def new_record_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------------------------


class ContactPurpose(str, Enum):
    GENERAL = "general"
    SALES = "sales"
    SUPPORT = "support"
    BOOKING = "booking"
    BILLING = "billing"
    OTHER = "other"


class ContactChannel(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    WHATSAPP = "whatsapp"
    FORM = "form"
    LINK = "link"


class BranchKind(str, Enum):
    OFFICE = "office"
    STORE = "store"
    WAREHOUSE = "warehouse"
    SERVICE_CENTER = "service_center"
    FACTORY = "factory"
    OTHER = "other"


class VisitPolicy(str, Enum):
    WALK_IN = "walk_in"                  # walk-ins welcome
    APPOINTMENT_ONLY = "appointment_only"
    NO_VISITS = "no_visits"              # e.g. no walk-ins / not open to the public
    UNKNOWN = "unknown"


class HoursScope(str, Enum):
    OPENING = "opening"
    SUPPORT = "support"
    OTHER = "other"


class ServiceMode(str, Enum):
    ONLINE = "online"
    IN_PERSON = "in_person"
    ON_SITE = "on_site"
    HYBRID = "hybrid"


class EnquiryKind(str, Enum):
    BOOKING = "booking"
    DEMO = "demo"
    QUOTE = "quote"
    OTHER = "other"


# Sections a workspace can mark "not applicable" (distinct from "not filled in yet").
NOT_APPLICABLE_SECTIONS = ("branches", "hours", "coverage", "enquiry_links", "contact_routes", "languages")

SHARED_FIELDS = ("company_name", "website", "industry", "description", "industries_served",
                 "offerings_summary", "customer_types")


# ---------------------------------------------------------------------------------------------
# Repeated records
# ---------------------------------------------------------------------------------------------


class _Record(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)


class ContactRoute(_Record):
    id: Optional[str] = Field(default=None, max_length=40)
    purpose: ContactPurpose = ContactPurpose.GENERAL
    label: Optional[str] = None
    channel: ContactChannel
    value: str
    branch_id: Optional[str] = Field(default=None, max_length=40)
    note: Optional[str] = None

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v):
        return clean_text(v, 60)

    @field_validator("note", mode="before")
    @classmethod
    def _note(cls, v):
        return clean_text(v, 200)

    @model_validator(mode="after")
    def _value_for_channel(self):
        ch = self.channel
        if ch == ContactChannel.EMAIL.value:
            v = normalize_email(self.value)
        elif ch in (ContactChannel.PHONE.value,):
            v = normalize_phone(self.value)
        elif ch == ContactChannel.WHATSAPP.value:
            v = normalize_url(self.value) if re.search(r"[a-z]{2,}\.", str(self.value), re.I) else normalize_phone(self.value)
        else:
            v = normalize_url(self.value)
        if not v:
            raise ValueError("contact value is required")
        self.value = v
        self.id = self.id or new_record_id("cr")
        return self


class Branch(_Record):
    id: Optional[str] = Field(default=None, max_length=40)
    name: str
    kind: BranchKind = BranchKind.OFFICE
    address: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    map_url: Optional[str] = None
    timezone: Optional[str] = None
    hours_note: Optional[str] = None
    visit_policy: VisitPolicy = VisitPolicy.UNKNOWN
    pickup_note: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        out = clean_text(v, 80)
        if not out:
            raise ValueError("branch name is required")
        return out

    @field_validator("address", "pickup_note", "hours_note", mode="before")
    @classmethod
    def _long(cls, v):
        return clean_text(v, 300)

    @field_validator("city", "region", "country", mode="before")
    @classmethod
    def _short(cls, v):
        return clean_text(v, 80)

    @field_validator("postal_code", mode="before")
    @classmethod
    def _postal(cls, v):
        return clean_text(v, 20)

    @field_validator("map_url", mode="before")
    @classmethod
    def _map(cls, v):
        return normalize_url(v)

    @field_validator("timezone", mode="before")
    @classmethod
    def _tz(cls, v):
        return normalize_timezone(v)

    @model_validator(mode="after")
    def _id(self):
        self.id = self.id or new_record_id("br")
        return self


class HoursEntry(_Record):
    id: Optional[str] = Field(default=None, max_length=40)
    scope: HoursScope = HoursScope.OPENING
    label: Optional[str] = None
    days: str
    open: Optional[str] = None
    close: Optional[str] = None
    closed: bool = False
    branch_id: Optional[str] = Field(default=None, max_length=40)
    note: Optional[str] = None

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v):
        return clean_text(v, 60)

    @field_validator("days", mode="before")
    @classmethod
    def _days(cls, v):
        out = clean_text(v, 40)
        if not out:
            raise ValueError("days are required, e.g. Mon-Fri")
        return out

    @field_validator("note", mode="before")
    @classmethod
    def _note(cls, v):
        return clean_text(v, 120)

    @model_validator(mode="after")
    def _times(self):
        if not self.closed:
            for t in (self.open, self.close):
                if t is None or not _HHMM.match(t):
                    raise ValueError("opening and closing times must be HH:MM (24-hour), or mark the day closed")
        else:
            self.open = self.close = None
        self.id = self.id or new_record_id("hr")
        return self


class EnquiryLink(_Record):
    id: Optional[str] = Field(default=None, max_length=40)
    kind: EnquiryKind = EnquiryKind.OTHER
    label: Optional[str] = None
    url: str

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v):
        return clean_text(v, 60)

    @field_validator("url", mode="before")
    @classmethod
    def _url(cls, v):
        out = normalize_url(v)
        if not out:
            raise ValueError("link is required")
        return out

    @model_validator(mode="after")
    def _id(self):
        self.id = self.id or new_record_id("lk")
        return self


# ---------------------------------------------------------------------------------------------
# Company-Info-owned facts
# ---------------------------------------------------------------------------------------------


class CompanyFacts(_Record):
    """Facts owned by Company Info. Every key is optional; a partial update replaces only the keys
    it sends (lists are replaced as a whole)."""

    public_name: Optional[str] = None
    legal_name: Optional[str] = None
    founded_year: Optional[int] = None
    timezone: Optional[str] = None
    hours: List[HoursEntry] = Field(default_factory=list, max_length=21)
    holiday_note: Optional[str] = None
    visit_policy: VisitPolicy = VisitPolicy.UNKNOWN
    appointment_note: Optional[str] = None
    service_modes: List[ServiceMode] = Field(default_factory=list, max_length=4)
    coverage_areas: List[str] = Field(default_factory=list, max_length=60)
    coverage_note: Optional[str] = None
    shipping_note: Optional[str] = None
    languages: List[str] = Field(default_factory=list, max_length=15)
    contact_routes: List[ContactRoute] = Field(default_factory=list, max_length=40)
    branches: List[Branch] = Field(default_factory=list, max_length=60)
    enquiry_links: List[EnquiryLink] = Field(default_factory=list, max_length=10)
    not_applicable: List[str] = Field(default_factory=list, max_length=len(NOT_APPLICABLE_SECTIONS))

    @field_validator("public_name", "legal_name", mode="before")
    @classmethod
    def _names(cls, v):
        return clean_text(v, 160)

    @field_validator("holiday_note", "appointment_note", "coverage_note", "shipping_note", mode="before")
    @classmethod
    def _notes(cls, v):
        return clean_text(v, 400)

    @field_validator("timezone", mode="before")
    @classmethod
    def _tz(cls, v):
        return normalize_timezone(v)

    @field_validator("founded_year")
    @classmethod
    def _year(cls, v):
        if v is not None and not 1700 <= v <= datetime.now(timezone.utc).year:
            raise ValueError("must be a valid year")
        return v

    @field_validator("coverage_areas", "languages", mode="before")
    @classmethod
    def _str_list(cls, v):
        out: List[str] = []
        seen = set()
        for item in v or []:
            text = clean_text(item, 80)
            if text and text.lower() not in seen:
                seen.add(text.lower())
                out.append(text)
        return out

    @field_validator("not_applicable", mode="before")
    @classmethod
    def _na(cls, v):
        out = []
        for item in v or []:
            if item not in NOT_APPLICABLE_SECTIONS:
                raise ValueError(f"unknown section '{item}'")
            if item not in out:
                out.append(item)
        return out

    @model_validator(mode="after")
    def _references(self):
        branch_ids = {b.id for b in self.branches}
        if len(branch_ids) != len(self.branches):
            raise ValueError("branch ids must be unique")
        for rec in list(self.contact_routes) + list(self.hours):
            if rec.branch_id and rec.branch_id not in branch_ids:
                raise ValueError("a contact route or hours entry refers to a branch that does not exist")
        for name, items in (("contact routes", self.contact_routes), ("hours", self.hours),
                            ("enquiry links", self.enquiry_links)):
            ids = [r.id for r in items]
            if len(ids) != len(set(ids)):
                raise ValueError(f"{name} ids must be unique")
        return self


# ---------------------------------------------------------------------------------------------
# Shared facts (owned by organizations / business_profiles)
# ---------------------------------------------------------------------------------------------


class SharedFactsUpdate(_Record):
    company_name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    industries_served: Optional[str] = None
    offerings_summary: Optional[str] = None
    customer_types: Optional[List[str]] = None

    @field_validator("company_name", mode="before")
    @classmethod
    def _name(cls, v):
        return clean_text(v, 255)

    @field_validator("website", mode="before")
    @classmethod
    def _site(cls, v):
        return normalize_url(v)

    @field_validator("industry", "industries_served", mode="before")
    @classmethod
    def _short(cls, v):
        return clean_text(v, 255)

    @field_validator("description", "offerings_summary", mode="before")
    @classmethod
    def _long(cls, v):
        return clean_text(v, 4000)

    @field_validator("customer_types", mode="before")
    @classmethod
    def _types(cls, v):
        if v is None:
            return None
        out: List[str] = []
        for item in v:
            text = clean_text(item, 60)
            if text and text not in out:
                out.append(text)
        return out


class CompanyInfoUpdateRequest(BaseModel):
    """Partial save. ``revision`` must equal the revision the editor loaded (else 409)."""

    model_config = ConfigDict(extra="forbid")

    revision: int = Field(..., ge=0)
    shared: Optional[SharedFactsUpdate] = None
    facts: Optional[Dict[str, Any]] = None
    share: Optional[Dict[str, bool]] = None

    @field_validator("share")
    @classmethod
    def _share_keys(cls, v):
        if v is None:
            return v
        unknown = set(v) - set(SHARED_FIELDS)
        if unknown:
            raise ValueError(f"unknown share keys: {sorted(unknown)}")
        return v

    @field_validator("facts")
    @classmethod
    def _fact_keys(cls, v):
        if v is None:
            return v
        unknown = set(v) - set(CompanyFacts.model_fields)
        if unknown:
            raise ValueError(f"unknown Company Info fields: {sorted(unknown)}")
        return v
