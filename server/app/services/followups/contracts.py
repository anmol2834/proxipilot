"""AI #2 assessment-mode decision contract (strict JSON schema + application-side validation).

The model decides what the latest message MEANS. This module only checks that the answer is
well-formed and grounded: enums, ranges, ISO dates, evidence IDs that exist in the supplied
context, quotes that really occur in a customer message. There is no keyword list, no business
vocabulary and no rule such as "price = Warm" anywhere in this file.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, time
from typing import Any, Dict, List, Optional, Sequence

from app.models.followup import PROMPT_VERSION  # noqa: E402,F401 - single source of the version

TEMPERATURES = ("hot", "warm", "cold", "unknown")
RELEVANCE = ("sales", "support", "service", "administrative", "unrelated")
OUTCOMES = ("open_unconfirmed", "completed", "declined", "deferred", "unknown")
NEXT_ACTORS = ("customer", "team", "third_party", "unclear")
DECISIONS = ("schedule", "defer", "wait_team", "none", "suppress", "needs_review")
TIMING_KINDS = ("none", "customer_commitment", "customer_request", "team_deadline", "ai_window", "cadence")
PRECISIONS = ("instant", "date", "window", "unknown")
REFUSAL_SCOPES = ("none", "all_contact", "email_only", "until", "opportunity_only")
UNCERTAINTY = ("none", "low", "high")
OPP_STATUSES = ("open", "completed", "declined", "deferred", "unknown")
REASON_CODES = (
    "explicit_purchase_intent", "requested_quote_or_proposal", "comparing_options", "asked_specific_question",
    "low_or_no_current_intent", "decision_pending_internal", "timing_given_by_customer", "purchase_confirmed",
    "service_completed", "explicit_decline", "contact_refusal", "support_or_service_issue", "courtesy_reply",
    "team_owes_action", "team_sent_information", "date_changed", "ambiguous_reference", "conflicting_signals",
    "insufficient_context", "other",
)

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _nullable(t: str) -> List[str]:
    return [t, "null"]


_OPP_SCHEMA: Dict[str, Any] = {
    "type": "object", "additionalProperties": False,
    "required": ["key", "subject", "status", "temperature", "evidence_message_ids"],
    "properties": {
        "key": {"type": "string", "description": "Stable short slug for this opportunity; reuse prior keys."},
        "subject": {"type": "string", "description": "What is being discussed, in the conversation's own words."},
        "status": {"type": "string", "enum": list(OPP_STATUSES)},
        "temperature": {"type": "string", "enum": list(TEMPERATURES)},
        "evidence_message_ids": {"type": "array", "items": {"type": "string"}},
    },
}

SCHEMA: Dict[str, Any] = {
    "name": "followup_assessment",
    "strict": True,
    "schema": {
        "type": "object", "additionalProperties": False,
        "required": ["temperature", "label_confidence", "buying_interest", "sales_relevance", "reason_codes",
                     "explanation", "evidence_message_ids", "outcome", "next_actor", "next_action", "decision",
                     "matched_opportunity_key", "opportunities", "timing", "constraints"],
        "properties": {
            "temperature": {"type": "string", "enum": list(TEMPERATURES)},
            "label_confidence": {"type": "number", "description": "0..1 confidence in the temperature label."},
            "buying_interest": {"type": "number", "description": "0..1 degree of buying interest shown."},
            "sales_relevance": {"type": "string", "enum": list(RELEVANCE)},
            "reason_codes": {"type": "array", "items": {"type": "string", "enum": list(REASON_CODES)}},
            "explanation": {"type": "string", "description": "<= 2 short sentences citing observable evidence."},
            "evidence_message_ids": {"type": "array", "items": {"type": "string"}},
            "outcome": {"type": "string", "enum": list(OUTCOMES)},
            "next_actor": {"type": "string", "enum": list(NEXT_ACTORS)},
            "next_action": {"type": "string", "description": "The next concrete step, <= 1 sentence."},
            "decision": {"type": "string", "enum": list(DECISIONS)},
            "matched_opportunity_key": {"type": _nullable("string")},
            "opportunities": {"type": "array", "items": _OPP_SCHEMA},
            "timing": {
                "type": "object", "additionalProperties": False,
                "required": ["kind", "phrase", "source_message_id", "local_date", "local_time", "window_end_date",
                             "timezone", "timezone_evidence", "precision", "ambiguous", "alternatives",
                             "internal_reminder_note", "cadence_reason"],
                "properties": {
                    "kind": {"type": "string", "enum": list(TIMING_KINDS)},
                    "phrase": {"type": _nullable("string")},
                    "source_message_id": {"type": _nullable("string")},
                    "local_date": {"type": _nullable("string"), "description": "YYYY-MM-DD in the stated/assumed zone."},
                    "local_time": {"type": _nullable("string"), "description": "HH:MM 24h, only if stated."},
                    "window_end_date": {"type": _nullable("string")},
                    "timezone": {"type": _nullable("string"), "description": "IANA zone or stated abbreviation."},
                    "timezone_evidence": {"type": _nullable("string")},
                    "precision": {"type": "string", "enum": list(PRECISIONS)},
                    "ambiguous": {"type": "boolean"},
                    "alternatives": {"type": "array", "items": {"type": "string"}},
                    "internal_reminder_note": {"type": _nullable("string")},
                    "cadence_reason": {"type": _nullable("string")},
                },
            },
            "constraints": {
                "type": "object", "additionalProperties": False,
                "required": ["refusal_scope", "refusal_until_date", "refusal_quote", "changed_date",
                             "possible_completion", "conflicting_evidence", "missing_context", "uncertainty"],
                "properties": {
                    "refusal_scope": {"type": "string", "enum": list(REFUSAL_SCOPES)},
                    "refusal_until_date": {"type": _nullable("string")},
                    "refusal_quote": {"type": _nullable("string")},
                    "changed_date": {"type": "boolean"},
                    "possible_completion": {"type": "boolean"},
                    "conflicting_evidence": {"type": "boolean"},
                    "missing_context": {"type": "boolean"},
                    "uncertainty": {"type": "string", "enum": list(UNCERTAINTY)},
                },
            },
        },
    },
}


class ContractError(ValueError):
    """The model output violates the contract (retry / keep last valid decision)."""


@dataclass
class Timing:
    kind: str = "none"
    phrase: Optional[str] = None
    source_message_id: Optional[str] = None
    local_date: Optional[date] = None
    local_time: Optional[time] = None
    window_end_date: Optional[date] = None
    timezone: Optional[str] = None
    timezone_evidence: Optional[str] = None
    precision: str = "unknown"
    ambiguous: bool = False
    alternatives: List[str] = field(default_factory=list)
    internal_reminder_note: Optional[str] = None
    cadence_reason: Optional[str] = None


@dataclass
class Constraints:
    refusal_scope: str = "none"
    refusal_until_date: Optional[date] = None
    refusal_quote: Optional[str] = None
    quote_verified: bool = False
    changed_date: bool = False
    possible_completion: bool = False
    conflicting_evidence: bool = False
    missing_context: bool = False
    uncertainty: str = "none"


@dataclass
class Assessment:
    temperature: str
    label_confidence: float
    buying_interest: float
    sales_relevance: str
    reason_codes: List[str]
    explanation: str
    evidence_message_ids: List[str]
    outcome: str
    next_actor: str
    next_action: str
    decision: str
    matched_opportunity_key: Optional[str]
    opportunities: List[Dict[str, Any]]
    timing: Timing
    constraints: Constraints
    warnings: List[str] = field(default_factory=list)

    def to_json(self) -> Dict[str, Any]:
        t, c = self.timing, self.constraints
        return {
            "temperature": self.temperature, "label_confidence": self.label_confidence,
            "buying_interest": self.buying_interest, "sales_relevance": self.sales_relevance,
            "reason_codes": self.reason_codes, "explanation": self.explanation,
            "evidence_message_ids": self.evidence_message_ids, "outcome": self.outcome,
            "next_actor": self.next_actor, "next_action": self.next_action, "decision": self.decision,
            "matched_opportunity_key": self.matched_opportunity_key, "opportunities": self.opportunities,
            "timing": {
                "kind": t.kind, "phrase": t.phrase, "source_message_id": t.source_message_id,
                "local_date": t.local_date.isoformat() if t.local_date else None,
                "local_time": t.local_time.strftime("%H:%M") if t.local_time else None,
                "window_end_date": t.window_end_date.isoformat() if t.window_end_date else None,
                "timezone": t.timezone, "timezone_evidence": t.timezone_evidence, "precision": t.precision,
                "ambiguous": t.ambiguous, "alternatives": t.alternatives,
                "internal_reminder_note": t.internal_reminder_note, "cadence_reason": t.cadence_reason,
            },
            "constraints": {
                "refusal_scope": c.refusal_scope,
                "refusal_until_date": c.refusal_until_date.isoformat() if c.refusal_until_date else None,
                "refusal_quote": c.refusal_quote, "quote_verified": c.quote_verified,
                "changed_date": c.changed_date, "possible_completion": c.possible_completion,
                "conflicting_evidence": c.conflicting_evidence, "missing_context": c.missing_context,
                "uncertainty": c.uncertainty,
            },
            "warnings": self.warnings,
        }


def from_json(d: Dict[str, Any]) -> Assessment:
    """Rebuild a validated Assessment from its stored normalised form (deterministic re-derivation)."""
    t, c = d.get("timing") or {}, d.get("constraints") or {}

    def _d(v):
        return date.fromisoformat(v) if v else None

    def _t(v):
        return time(int(v[:2]), int(v[3:5])) if v else None

    return Assessment(
        temperature=d["temperature"], label_confidence=float(d.get("label_confidence") or 0),
        buying_interest=float(d.get("buying_interest") or 0), sales_relevance=d["sales_relevance"],
        reason_codes=list(d.get("reason_codes") or []), explanation=d.get("explanation") or "",
        evidence_message_ids=list(d.get("evidence_message_ids") or []), outcome=d["outcome"],
        next_actor=d["next_actor"], next_action=d.get("next_action") or "", decision=d["decision"],
        matched_opportunity_key=d.get("matched_opportunity_key"), opportunities=list(d.get("opportunities") or []),
        timing=Timing(
            kind=t.get("kind", "none"), phrase=t.get("phrase"), source_message_id=t.get("source_message_id"),
            local_date=_d(t.get("local_date")), local_time=_t(t.get("local_time")),
            window_end_date=_d(t.get("window_end_date")), timezone=t.get("timezone"),
            timezone_evidence=t.get("timezone_evidence"), precision=t.get("precision", "unknown"),
            ambiguous=bool(t.get("ambiguous")), alternatives=list(t.get("alternatives") or []),
            internal_reminder_note=t.get("internal_reminder_note"), cadence_reason=t.get("cadence_reason"),
        ),
        constraints=Constraints(
            refusal_scope=c.get("refusal_scope", "none"), refusal_until_date=_d(c.get("refusal_until_date")),
            refusal_quote=c.get("refusal_quote"), quote_verified=bool(c.get("quote_verified")),
            changed_date=bool(c.get("changed_date")), possible_completion=bool(c.get("possible_completion")),
            conflicting_evidence=bool(c.get("conflicting_evidence")),
            missing_context=bool(c.get("missing_context")), uncertainty=c.get("uncertainty", "none"),
        ),
        warnings=list(d.get("warnings") or []),
    )


def _enum(value: Any, allowed: Sequence[str], name: str) -> str:
    if value not in allowed:
        raise ContractError(f"{name}={value!r} not in {list(allowed)}")
    return value


def _unit(value: Any, name: str) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError) as exc:
        raise ContractError(f"{name} is not a number") from exc
    if not 0.0 <= v <= 1.0:
        raise ContractError(f"{name}={v} outside 0..1")
    return round(v, 3)


def _iso_date(value: Any, name: str, warnings: List[str]) -> Optional[date]:
    if value in (None, ""):
        return None
    s = str(value).strip()
    if not _ISO_DATE.match(s):
        warnings.append(f"{name}_not_iso")
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        warnings.append(f"{name}_invalid")
        return None


def _hhmm(value: Any, warnings: List[str]) -> Optional[time]:
    if value in (None, ""):
        return None
    s = str(value).strip()
    if not _HHMM.match(s):
        warnings.append("local_time_invalid")
        return None
    hh, mm = s.split(":")
    return time(int(hh), int(mm))


def _norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def _clip(s: Any, n: int) -> str:
    return str(s or "").strip()[:n]


def validate(
    data: Dict[str, Any],
    *,
    known_message_ids: Sequence[str],
    latest_message_id: str,
    customer_texts: Sequence[str],
    latest_is_outbound: bool,
    prior_ai_temperature: Optional[str] = None,
) -> Assessment:
    """Validate and normalise a raw model result. Raises ContractError on structural violations;
    soft problems (unknown evidence IDs, non-ISO dates, unverifiable quotes) become warnings and are
    neutralised so they can never invent a date, identity or refusal scope."""
    if not isinstance(data, dict):
        raise ContractError("result is not an object")
    warnings: List[str] = []
    known = set(known_message_ids)

    def _ids(seq: Any, name: str) -> List[str]:
        out = []
        for i in (seq or [])[:12]:
            if i in known:
                out.append(i)
            else:
                warnings.append(f"{name}_unknown_id")
        return list(dict.fromkeys(out))

    temperature = _enum(data.get("temperature"), TEMPERATURES, "temperature")
    decision = _enum(data.get("decision"), DECISIONS, "decision")
    outcome = _enum(data.get("outcome"), OUTCOMES, "outcome")
    next_actor = _enum(data.get("next_actor"), NEXT_ACTORS, "next_actor")
    relevance = _enum(data.get("sales_relevance"), RELEVANCE, "sales_relevance")
    reason_codes = [c for c in (data.get("reason_codes") or []) if c in REASON_CODES][:6]

    # An outbound (team) message can change who owes the next action; on its own it cannot prove
    # stronger customer interest. Never let it raise the temperature above the prior AI value.
    rank = {"unknown": 0, "cold": 1, "warm": 2, "hot": 3}
    if latest_is_outbound and prior_ai_temperature in rank and rank[temperature] > rank[prior_ai_temperature]:
        warnings.append("outbound_cannot_raise_temperature")
        temperature = prior_ai_temperature

    raw_t = data.get("timing") or {}
    if not isinstance(raw_t, dict):
        raise ContractError("timing is not an object")
    timing = Timing(
        kind=_enum(raw_t.get("kind"), TIMING_KINDS, "timing.kind"),
        phrase=_clip(raw_t.get("phrase"), 300) or None,
        source_message_id=raw_t.get("source_message_id") if raw_t.get("source_message_id") in known else None,
        local_date=_iso_date(raw_t.get("local_date"), "local_date", warnings),
        local_time=_hhmm(raw_t.get("local_time"), warnings),
        window_end_date=_iso_date(raw_t.get("window_end_date"), "window_end_date", warnings),
        timezone=_clip(raw_t.get("timezone"), 64) or None,
        timezone_evidence=_clip(raw_t.get("timezone_evidence"), 200) or None,
        precision=_enum(raw_t.get("precision"), PRECISIONS, "timing.precision"),
        ambiguous=bool(raw_t.get("ambiguous")),
        alternatives=[_clip(a, 80) for a in (raw_t.get("alternatives") or [])[:4] if a],
        internal_reminder_note=_clip(raw_t.get("internal_reminder_note"), 300) or None,
        cadence_reason=_clip(raw_t.get("cadence_reason"), 300) or None,
    )
    if raw_t.get("source_message_id") and timing.source_message_id is None:
        warnings.append("timing_source_unknown_id")
    # A dated kind without a usable date is not a date: never invent one.
    if timing.kind in ("customer_commitment", "customer_request", "team_deadline", "ai_window") \
            and timing.local_date is None and not timing.ambiguous:
        warnings.append("timing_without_date")
        timing.precision = "unknown"
    if timing.ambiguous:
        timing.local_time = timing.local_time if timing.local_date else None

    raw_c = data.get("constraints") or {}
    if not isinstance(raw_c, dict):
        raise ContractError("constraints is not an object")
    cons = Constraints(
        refusal_scope=_enum(raw_c.get("refusal_scope"), REFUSAL_SCOPES, "refusal_scope"),
        refusal_until_date=_iso_date(raw_c.get("refusal_until_date"), "refusal_until_date", warnings),
        refusal_quote=_clip(raw_c.get("refusal_quote"), 300) or None,
        changed_date=bool(raw_c.get("changed_date")),
        possible_completion=bool(raw_c.get("possible_completion")),
        conflicting_evidence=bool(raw_c.get("conflicting_evidence")),
        missing_context=bool(raw_c.get("missing_context")),
        uncertainty=_enum(raw_c.get("uncertainty"), UNCERTAINTY, "uncertainty"),
    )
    if cons.refusal_quote:
        q = _norm_text(cons.refusal_quote)
        cons.quote_verified = bool(q) and any(q in _norm_text(t) for t in customer_texts)
        if not cons.quote_verified:
            warnings.append("refusal_quote_not_found")
    if cons.refusal_scope == "until" and cons.refusal_until_date is None:
        warnings.append("until_without_date")

    opportunities: List[Dict[str, Any]] = []
    for o in (data.get("opportunities") or [])[:8]:
        if not isinstance(o, dict):
            continue
        key = re.sub(r"[^a-z0-9_\-]", "", _clip(o.get("key"), 48).lower().replace(" ", "_"))
        if not key or o.get("status") not in OPP_STATUSES or o.get("temperature") not in TEMPERATURES:
            warnings.append("opportunity_dropped")
            continue
        opportunities.append({
            "key": key, "subject": _clip(o.get("subject"), 160), "status": o["status"],
            "temperature": o["temperature"], "evidence_message_ids": _ids(o.get("evidence_message_ids"), "opp"),
        })
    matched = data.get("matched_opportunity_key")
    matched = re.sub(r"[^a-z0-9_\-]", "", str(matched).lower().replace(" ", "_")) if matched else None
    if matched and matched not in {o["key"] for o in opportunities}:
        warnings.append("matched_opportunity_unknown")

    return Assessment(
        temperature=temperature,
        label_confidence=_unit(data.get("label_confidence"), "label_confidence"),
        buying_interest=_unit(data.get("buying_interest"), "buying_interest"),
        sales_relevance=relevance, reason_codes=reason_codes,
        explanation=_clip(data.get("explanation"), 400),
        evidence_message_ids=_ids(data.get("evidence_message_ids"), "evidence"),
        outcome=outcome, next_actor=next_actor, next_action=_clip(data.get("next_action"), 300),
        decision=decision, matched_opportunity_key=matched, opportunities=opportunities,
        timing=timing, constraints=cons, warnings=warnings,
    )
