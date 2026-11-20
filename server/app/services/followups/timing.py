"""Pure calendar arithmetic for follow-ups (no I/O, fully unit-tested).

* Time zones: IANA names, legacy workspace strings such as "Asia/Kolkata (GMT +5:30)", explicit
  offsets ("GMT+5:30", "UTC-04:00") and a short list of unambiguous zone abbreviations. An
  abbreviation that means different zones in different places (e.g. "CST") is NOT guessed.
* Local wall time -> UTC with DST handling: a time inside a spring-forward gap moves forward by
  the gap; a repeated (fall-back) wall time takes the first occurrence. Both are reported.
* Business days use the tenant workweek. A customer-promised date is never silently moved off a
  weekend; an AI-proposed window or a cadence step lands on a workday.
* Due time and team-notice time are separate instants. Advance notice = N business days before
  the due date at the configured local time; merged into the due notice when they coincide; sent
  once, immediately, when the commitment arrives inside the notice window.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Dict, FrozenSet, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc
DEFAULT_TENANT_TZ = "Asia/Kolkata"     # same documented fallback as commitment memory
MAX_HORIZON = timedelta(days=400)

# Only abbreviations with one dominant meaning. Ambiguous ones (CST, BST in some regions, AST...)
# are deliberately absent: an unknown zone holds exact external contact for review.
_ABBREVIATIONS: Dict[str, str] = {
    "UTC": "UTC", "GMT": "UTC", "Z": "UTC", "IST": "Asia/Kolkata", "SGT": "Asia/Singapore",
    "JST": "Asia/Tokyo", "HKT": "Asia/Hong_Kong", "PKT": "Asia/Karachi", "NPT": "Asia/Kathmandu",
    "AEST": "Australia/Sydney", "AEDT": "Australia/Sydney", "CET": "Europe/Paris", "CEST": "Europe/Paris",
    "EET": "Europe/Athens", "EEST": "Europe/Athens", "WET": "Europe/Lisbon",
    "EST": "America/New_York", "EDT": "America/New_York", "PST": "America/Los_Angeles",
    "PDT": "America/Los_Angeles", "MST": "America/Denver", "MDT": "America/Denver",
    "GST": "Asia/Dubai",
}
_IANA_TOKEN = re.compile(r"[A-Za-z]+(?:/[A-Za-z0-9_+\-]+)+")
_OFFSET = re.compile(r"(?:UTC|GMT)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\b", re.IGNORECASE)


@dataclass(frozen=True)
class Zone:
    tz: tzinfo
    name: str            # IANA name or "UTC+05:30"


def resolve_zone(value: Optional[str]) -> Optional[Zone]:
    """Normalise a zone string. Returns None when it cannot be resolved unambiguously."""
    if not value or not str(value).strip():
        return None
    s = str(value).strip()
    for cand in [s] + _IANA_TOKEN.findall(s):
        try:
            return Zone(ZoneInfo(cand), cand)
        except (ZoneInfoNotFoundError, ValueError, KeyError):
            continue
    head = re.sub(r"[^A-Za-z]", "", s.split("(")[0].split()[0]) if s.split() else ""
    if head.upper() in _ABBREVIATIONS and not _OFFSET.search(s[len(head):] or ""):
        name = _ABBREVIATIONS[head.upper()]
        return Zone(ZoneInfo(name), name)
    m = _OFFSET.search(s)
    if m and (re.match(r"^\s*(UTC|GMT)", s, re.IGNORECASE) or re.match(r"^\s*[+-]\d", s)):
        sign = 1 if m.group(1) == "+" else -1
        hours, minutes = int(m.group(2)), int(m.group(3) or 0)
        if hours <= 14 and minutes < 60:
            delta = sign * timedelta(hours=hours, minutes=minutes)
            label = f"UTC{'+' if sign > 0 else '-'}{hours:02d}:{minutes:02d}"
            return Zone(timezone(delta), label)
    return None


def tenant_zone(*candidates: Optional[str]) -> Zone:
    for c in candidates:
        z = resolve_zone(c)
        if z:
            return z
    return Zone(ZoneInfo(DEFAULT_TENANT_TZ), DEFAULT_TENANT_TZ)


def parse_hhmm(value: Optional[str], default: time) -> time:
    try:
        hh, mm = (value or "").split(":")
        return time(int(hh), int(mm))
    except (ValueError, AttributeError):
        return default


@dataclass(frozen=True)
class Calendar:
    zone: Zone
    workdays: FrozenSet[int] = frozenset({0, 1, 2, 3, 4})       # Monday = 0
    default_time: time = time(10, 0)
    window_start: time = time(9, 0)
    window_end: time = time(18, 0)

    @classmethod
    def from_policy(cls, policy, org_timezone: Optional[str]) -> "Calendar":
        days = frozenset(int(x) for x in re.findall(r"\d", getattr(policy, "workdays", "") or "") if int(x) < 7)
        return cls(
            zone=tenant_zone(getattr(policy, "timezone", None), org_timezone),
            workdays=days or frozenset({0, 1, 2, 3, 4}),
            default_time=parse_hhmm(getattr(policy, "default_local_time", None), time(10, 0)),
            window_start=parse_hhmm(getattr(policy, "send_window_start", None), time(9, 0)),
            window_end=parse_hhmm(getattr(policy, "send_window_end", None), time(18, 0)),
        )


def local_instant(d: date, t: time, zone: Zone) -> Tuple[datetime, Optional[str]]:
    """Wall time in ``zone`` -> aware UTC instant. Returns (instant, note) where note is
    'dst_gap_shifted' / 'dst_fold_first' when the wall time does not exist / occurs twice."""
    naive = datetime.combine(d, t)
    a = naive.replace(tzinfo=zone.tz, fold=0).astimezone(UTC)
    b = naive.replace(tzinfo=zone.tz, fold=1).astimezone(UTC)
    if a == b:
        return a, None
    if a.astimezone(zone.tz).replace(tzinfo=None) == naive and b.astimezone(zone.tz).replace(tzinfo=None) == naive:
        return min(a, b), "dst_fold_first"
    return max(a, b), "dst_gap_shifted"


def is_workday(d: date, cal: Calendar) -> bool:
    return d.weekday() in cal.workdays


def next_workday(d: date, cal: Calendar) -> date:
    for _ in range(14):
        if is_workday(d, cal):
            return d
        d += timedelta(days=1)
    return d


def add_business_days(d: date, n: int, cal: Calendar) -> date:
    step = 1 if n >= 0 else -1
    remaining = abs(n)
    for _ in range(abs(n) * 7 + 14):
        if remaining == 0:
            break
        d += timedelta(days=step)
        if is_workday(d, cal):
            remaining -= 1
    return d


def next_slot(after: datetime, cal: Calendar) -> datetime:
    """First workday default-time slot strictly after ``after`` (tenant calendar)."""
    local = after.astimezone(cal.zone.tz)
    d = local.date()
    for _ in range(15):
        if is_workday(d, cal):
            inst, _ = local_instant(d, cal.default_time, cal.zone)
            if inst > after:
                return inst
        d += timedelta(days=1)
    return after + timedelta(days=1)


def in_send_window(at: datetime, cal: Calendar) -> bool:
    local = at.astimezone(cal.zone.tz)
    return is_workday(local.date(), cal) and cal.window_start <= local.time() < cal.window_end


def next_send_window(at: datetime, cal: Calendar) -> datetime:
    if in_send_window(at, cal):
        return at
    local = at.astimezone(cal.zone.tz)
    d = local.date()
    for _ in range(15):
        if is_workday(d, cal):
            start, _ = local_instant(d, cal.window_start, cal.zone)
            if start >= at:
                return start
        d += timedelta(days=1)
    return at + timedelta(days=1)


@dataclass
class DueResolution:
    due_at: Optional[datetime] = None
    zone_name: str = "UTC"
    precision: str = "unknown"            # instant | date | window | unknown
    source: str = "none"                  # user | customer_date | team_deadline | ai_window | cadence | none
    phrase: Optional[str] = None
    external_ok: bool = False             # exact & unambiguous enough to contact the customer at due_at
    review_reason: Optional[str] = None
    alternatives: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


_SOURCE_BY_KIND = {"customer_commitment": "customer_date", "customer_request": "customer_date",
                   "team_deadline": "team_deadline", "ai_window": "ai_window"}


def resolve_due(timing, *, cal: Calendar, anchor: datetime, now: datetime, decision: str,
                temperature: str, cadence_days: Dict[str, int]) -> DueResolution:
    """Turn AI #2 timing evidence into an instant. Priority among AI sources: a customer-stated
    date/time, then a team deadline / AI contextual window, then the tenant cadence (only when the
    decision itself warrants follow-up). Explicit user scheduling is applied by the engine on top."""
    res = DueResolution(zone_name=cal.zone.name, phrase=getattr(timing, "phrase", None))
    kind = getattr(timing, "kind", "none")

    if getattr(timing, "ambiguous", False):
        res.review_reason = "ambiguous_date"
        res.alternatives = list(getattr(timing, "alternatives", []) or [])
        return res

    if kind in _SOURCE_BY_KIND and timing.local_date is not None:
        zone = cal.zone
        if timing.timezone:
            z = resolve_zone(timing.timezone)
            if z is None:
                res.notes.append("timezone_unrecognized")
                res.review_reason = "unrecognized_timezone"
            else:
                zone = z
        else:
            res.notes.append("tenant_timezone_assumed")
        d = timing.local_date
        source = _SOURCE_BY_KIND[kind]
        if not is_workday(d, cal):
            if source == "customer_date":
                res.notes.append("non_workday_kept")         # never silently move a promised date
            else:
                d = next_workday(d, cal)
                res.notes.append("moved_to_workday")
        t = timing.local_time or cal.default_time
        if timing.local_time is None:
            res.notes.append("default_local_time")
        due, note = local_instant(d, t, zone)
        if note:
            res.notes.append(note)
        res.due_at, res.zone_name, res.source = due, zone.name, source
        res.precision = "instant" if timing.local_time else ("window" if timing.window_end_date else "date")
        res.external_ok = res.review_reason is None
        if due < anchor - timedelta(days=1):
            res.review_reason, res.external_ok = "date_before_message", False
        elif due < now - timedelta(hours=12):
            res.review_reason, res.external_ok = "date_in_past", False
        elif due - anchor > MAX_HORIZON:
            res.review_reason, res.external_ok = "date_beyond_horizon", False
        return res

    if kind == "cadence" or (decision in ("schedule", "defer") and kind in ("none",) + tuple(_SOURCE_BY_KIND)):
        n = int(cadence_days.get(temperature) or cadence_days.get("warm") or 3)
        base = anchor.astimezone(cal.zone.tz).date()
        d = add_business_days(base, max(1, n), cal)
        due, note = local_instant(d, cal.default_time, cal.zone)
        if note:
            res.notes.append(note)
        if due <= now:                       # late processing: next slot, never a retrospective burst
            due = next_slot(now, cal)
            res.notes.append("rolled_forward")
        res.due_at, res.precision, res.source, res.external_ok = due, "date", "cadence", True
        return res
    return res


def compute_notice(due_at: Optional[datetime], *, cal: Calendar, notice_days: int,
                   now: datetime) -> Tuple[Optional[datetime], str]:
    """Team advance-notice instant. Returns (notice_at, mode) with mode one of:
    'advance' (scheduled), 'timely' (inside the window: notify now, once), 'merged' (no separate
    advance notice; the due notice covers it)."""
    if due_at is None or notice_days <= 0 or due_at <= now:
        return None, "merged"
    due_local = due_at.astimezone(cal.zone.tz).date()
    nd = add_business_days(due_local, -notice_days, cal)
    notice, _ = local_instant(nd, cal.default_time, cal.zone)
    if notice >= due_at:
        return None, "merged"
    if notice <= now:
        return now, "timely"
    return notice, "advance"


def fmt_local(at: Optional[datetime], zone: Zone) -> str:
    if at is None:
        return ""
    local = at.astimezone(zone.tz)
    return local.strftime("%a %d %b %Y, %H:%M ") + zone.name
