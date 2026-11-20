"""Atomic, revision-fenced application of AI #2 decisions and manual controls.

Everything here runs inside the caller's database transaction (no model or provider calls), so a
decision, its suppression, its occurrences and the new revision commit together or not at all.

Invariants
----------
* Fence: only the assessment of the newest known message of a thread may change effective state.
  A late / reverse-order model result is stored as history with ``not_applied_reason``.
* A new message bumps the revision (see ``triggers.fence``); every occurrence carries the revision
  it was planned under, so outreach planned before the new message can never pass the send gate.
* Manual temperature and manual timing survive model output until released.
* A durable do-not-contact suppression overrides every label, schedule and retry, across threads.
* Customer email permission is only ever granted by a user (controls); nothing here enables it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.followup import (
    ContactSuppression, FollowupOccurrence, FollowupPolicy, MessageAssessment, ThreadFollowupControl,
    ThreadFollowupState,
)
from app.models.inbox import EmailMessage, EmailThread, MessageDirection
from app.models.organization import Organization
from app.services.followups import timing as tm
from app.services.followups.contracts import Assessment

ACTIVE_STATUSES = ("open", "scheduled", "deferred", "waiting_team", "needs_review")
PURSUIT_STATUSES = ("scheduled", "deferred")
LIVE_OCCURRENCE = ("scheduled", "held")
MANUAL_TEMPS = ("hot", "warm", "cold")


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def norm_email(addr: Optional[str]) -> str:
    return (addr or "").strip().lower()


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------

def default_policy(tenant_id: str) -> FollowupPolicy:
    return FollowupPolicy(
        tenant_id=tenant_id, assessment_enabled=True, planning_enabled=True, cadence_hot_days=1,
        cadence_warm_days=3, cadence_cold_days=7, workdays="0,1,2,3,4", send_window_start="09:00",
        send_window_end="18:00", default_local_time="10:00", advance_notice_days=1, max_attempts=3,
        min_spacing_hours=24, timezone=None, version=0,
    )


async def load_policy(db: AsyncSession, tenant_id: str) -> FollowupPolicy:
    row = (await db.execute(select(FollowupPolicy).where(FollowupPolicy.tenant_id == tenant_id))).scalar_one_or_none()
    return row or default_policy(tenant_id)


async def load_calendar(db: AsyncSession, tenant_id: str, policy: Optional[FollowupPolicy] = None) -> tm.Calendar:
    policy = policy or await load_policy(db, tenant_id)
    org_tz = (await db.execute(select(Organization.timezone).where(Organization.id == tenant_id))).scalar_one_or_none()
    return tm.Calendar.from_policy(policy, org_tz)


def cadence_days(policy: FollowupPolicy) -> Dict[str, int]:
    return {"hot": policy.cadence_hot_days, "warm": policy.cadence_warm_days, "cold": policy.cadence_cold_days,
            "unknown": policy.cadence_warm_days}


def effective_switches(policy: FollowupPolicy, control: Optional[ThreadFollowupControl]) -> Tuple[bool, bool]:
    a = policy.assessment_enabled if control is None or control.assessment_enabled is None else control.assessment_enabled
    p = policy.planning_enabled if control is None or control.planning_enabled is None else control.planning_enabled
    return bool(a), bool(p)


async def lock_state(db: AsyncSession, tenant_id: str, thread_id: str) -> ThreadFollowupState:
    now = datetime.now(timezone.utc)
    await db.execute(pg_insert(ThreadFollowupState).values(
        thread_id=thread_id, tenant_id=tenant_id, revision=0, status="none", needs_review=False, stale=False,
        attempts_used=0, created_at=now, updated_at=now,
    ).on_conflict_do_nothing(index_elements=["thread_id"]))
    state = (await db.execute(
        select(ThreadFollowupState).where(ThreadFollowupState.thread_id == thread_id).with_for_update()
        .execution_options(populate_existing=True)
    )).scalar_one()
    if state.tenant_id != tenant_id:
        raise PermissionError("thread belongs to another tenant")
    return state


async def get_or_create_control(db: AsyncSession, tenant_id: str, thread_id: str) -> ThreadFollowupControl:
    now = datetime.now(timezone.utc)
    await db.execute(pg_insert(ThreadFollowupControl).values(
        thread_id=thread_id, tenant_id=tenant_id, customer_email_enabled=False, completed=False, version=1,
        created_at=now, updated_at=now,
    ).on_conflict_do_nothing(index_elements=["thread_id"]))
    ctl = (await db.execute(
        select(ThreadFollowupControl).where(ThreadFollowupControl.thread_id == thread_id).with_for_update()
        .execution_options(populate_existing=True)
    )).scalar_one()
    if ctl.tenant_id != tenant_id:
        raise PermissionError("thread belongs to another tenant")
    return ctl


async def thread_participants(db: AsyncSession, tenant_id: str, thread_id: str) -> List[str]:
    """Verified customer participants: addresses that actually wrote INTO this thread."""
    rows = (await db.execute(select(EmailMessage.from_email, EmailMessage.reply_to_email).where(
        EmailMessage.tenant_id == tenant_id, EmailMessage.thread_id == thread_id,
        EmailMessage.direction == MessageDirection.INBOUND.value,
    ).order_by(EmailMessage.sent_at.desc().nullslast()))).all()
    out: List[str] = []
    for r in rows:
        for a in (r.from_email, r.reply_to_email):
            a = norm_email(a)
            if a and "@" in a and a not in out:
                out.append(a)
    return out


async def latest_inbound(db: AsyncSession, tenant_id: str, thread_id: str) -> Optional[EmailMessage]:
    return (await db.execute(select(EmailMessage).where(
        EmailMessage.tenant_id == tenant_id, EmailMessage.thread_id == thread_id,
        EmailMessage.direction == MessageDirection.INBOUND.value,
    ).order_by(EmailMessage.sent_at.desc().nullslast()).limit(1))).scalar_one_or_none()


async def active_suppressions(db: AsyncSession, tenant_id: str, emails: Iterable[str],
                              now: datetime) -> List[ContactSuppression]:
    emails = [norm_email(e) for e in emails if e]
    if not emails:
        return []
    return list((await db.execute(select(ContactSuppression).where(
        ContactSuppression.tenant_id == tenant_id,
        ContactSuppression.recipient_email.in_(emails),
        ContactSuppression.lifted_at.is_(None),
        or_(ContactSuppression.scope != "until", ContactSuppression.until_at.is_(None),
            ContactSuppression.until_at > now),
    ))).scalars().all())


@dataclass
class Restriction:
    blocks_all: bool = False         # no contact at all (incl. team pursuit reminders)
    blocks_email: bool = False       # no automatic customer email
    until: Optional[datetime] = None
    reason: Optional[str] = None


def restriction_for(sups: Sequence[ContactSuppression], email: Optional[str]) -> Restriction:
    r = Restriction()
    e = norm_email(email)
    for s in sups:
        if norm_email(s.recipient_email) != e:
            continue
        if s.scope == "all":
            r.blocks_all, r.blocks_email, r.reason = True, True, "do_not_contact"
        elif s.scope == "email":
            r.blocks_email = True
            r.reason = r.reason or "no_email"
        elif s.scope == "until":
            r.blocks_email = True
            if s.until_at is None:
                r.blocks_all, r.reason = True, "do_not_contact_until_unclear"
            else:
                r.until = max(r.until, _utc(s.until_at)) if r.until else _utc(s.until_at)
                r.reason = r.reason or "not_before_date"
    return r


# ---------------------------------------------------------------------------
# Occurrence helpers
# ---------------------------------------------------------------------------

async def live_occurrences(db: AsyncSession, thread_id: str) -> List[FollowupOccurrence]:
    return list((await db.execute(select(FollowupOccurrence).where(
        FollowupOccurrence.thread_id == thread_id, FollowupOccurrence.status.in_(LIVE_OCCURRENCE),
    ).order_by(FollowupOccurrence.due_at).with_for_update())).scalars().all())


def _retire(occ: FollowupOccurrence, status: str, reason: str) -> None:
    occ.status = status
    occ.hold_reason = reason
    if occ.customer_status in ("pending", "held"):
        occ.customer_status = "not_applicable" if status != "held" else "held"
    occ.lease_until = None


async def upsert_occurrence(db: AsyncSession, *, tenant_id: str, thread_id: str, anchor: str, step: int,
                            values: Dict[str, Any]) -> FollowupOccurrence:
    """Idempotent per (thread, anchor, step): a replay updates/revives instead of duplicating."""
    existing = (await db.execute(select(FollowupOccurrence).where(
        FollowupOccurrence.thread_id == thread_id, FollowupOccurrence.anchor_message_id == anchor,
        FollowupOccurrence.step == step).with_for_update())).scalar_one_or_none()
    if existing is not None:
        if existing.status == "done":
            return existing
        moved = _utc(existing.due_at) != values.get("due_at")
        for k, v in values.items():
            setattr(existing, k, v)
        existing.status = values.get("status", "scheduled")
        if moved and existing.advance_status == "done":
            existing.advance_status = "pending"
        return existing
    occ = FollowupOccurrence(tenant_id=tenant_id, thread_id=thread_id, anchor_message_id=anchor, step=step,
                             **values)
    db.add(occ)
    await db.flush()
    return occ


# ---------------------------------------------------------------------------
# Decision application
# ---------------------------------------------------------------------------

@dataclass
class ApplyOutcome:
    applied: bool
    reason: Optional[str] = None
    status: Optional[str] = None
    occurrence_id: Optional[str] = None


def _merge_opportunities(prior: Optional[List[Dict[str, Any]]], new: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_key: Dict[str, Dict[str, Any]] = {o["key"]: dict(o) for o in (prior or []) if isinstance(o, dict) and o.get("key")}
    for o in new:
        by_key[o["key"]] = {**by_key.get(o["key"], {}), **o}
    return list(by_key.values())[:12]


def _status_for(result: Assessment, *, opportunities: List[Dict[str, Any]]) -> str:
    d = result.decision
    if d == "suppress":
        return "suppressed"
    if d == "needs_review":
        return "needs_review"
    if d in ("schedule", "defer") and result.constraints.uncertainty == "high":
        return "needs_review"
    if d == "wait_team":
        return "waiting_team"
    if d == "defer":
        return "deferred"
    if d == "schedule":
        return "scheduled"
    open_opps = [o for o in opportunities if o.get("status") in ("open", "deferred", "unknown")]
    if result.outcome in ("completed", "declined") and not open_opps:
        return "closed"
    if result.sales_relevance != "sales" and not open_opps:
        return "none"
    if result.outcome == "open_unconfirmed" or open_opps:
        return "open"
    return "none"


async def _ensure_suppression(db: AsyncSession, *, tenant_id: str, thread_id: str, msg: EmailMessage,
                              result: Assessment, cal: tm.Calendar) -> Optional[ContactSuppression]:
    c = result.constraints
    scope = {"all_contact": "all", "email_only": "email", "until": "until"}.get(c.refusal_scope)
    if scope is None and result.decision == "suppress":
        scope = "all"
    if scope is None or msg.direction != MessageDirection.INBOUND.value:
        return None
    recipient = norm_email(msg.reply_to_email or msg.from_email)
    if not recipient:
        return None
    until_at = None
    if scope == "until" and c.refusal_until_date:
        until_at, _ = tm.local_instant(c.refusal_until_date, time(0, 0), cal.zone)
    existing = (await db.execute(select(ContactSuppression).where(
        ContactSuppression.tenant_id == tenant_id, ContactSuppression.recipient_email == recipient,
        ContactSuppression.scope == scope, ContactSuppression.lifted_at.is_(None)).with_for_update())).scalar_one_or_none()
    if existing is not None:
        if scope == "until":
            existing.until_at = until_at
        existing.source_message_id, existing.quote, existing.thread_id = msg.id, (c.refusal_quote or "")[:300], thread_id
        return existing
    sup = ContactSuppression(tenant_id=tenant_id, recipient_email=recipient, scope=scope, until_at=until_at,
                             thread_id=thread_id, source_message_id=msg.id, quote=(c.refusal_quote or "")[:300])
    db.add(sup)
    await db.flush()
    logger.info("followup suppression recorded", tenant_id=tenant_id, thread_id=thread_id, scope=scope)
    return sup


async def apply_assessment(db: AsyncSession, *, tenant_id: str, row: MessageAssessment, result: Assessment,
                           now: Optional[datetime] = None) -> ApplyOutcome:
    """Apply one validated decision. Caller commits. Never calls a model or provider."""
    now = now or datetime.now(timezone.utc)
    state = await lock_state(db, tenant_id, row.thread_id)
    msg = await db.get(EmailMessage, row.message_id)
    thread = await db.get(EmailThread, row.thread_id)
    if msg is None or thread is None or msg.tenant_id != tenant_id or thread.tenant_id != tenant_id:
        row.applied, row.not_applied_reason = False, "message_missing"
        return ApplyOutcome(False, "message_missing")
    msg_at = _utc(msg.sent_at)

    # ---- revision fence -------------------------------------------------
    if state.last_message_id and state.last_message_id != msg.id and _utc(state.last_message_at) \
            and _utc(state.last_message_at) > msg_at:
        row.applied, row.not_applied_reason = False, "superseded_by_newer_message"
        return ApplyOutcome(False, "superseded_by_newer_message")
    if state.last_assessment_id and state.last_assessment_id != row.id:
        cur = await db.get(MessageAssessment, state.last_assessment_id)
        if cur is not None and _utc(cur.message_sent_at) and _utc(cur.message_sent_at) > msg_at:
            row.applied, row.not_applied_reason = False, "older_than_current_decision"
            return ApplyOutcome(False, "older_than_current_decision")
    if state.last_message_id is None or (_utc(state.last_message_at) or msg_at) <= msg_at:
        state.last_message_id, state.last_message_at = msg.id, msg_at

    policy = await load_policy(db, tenant_id)
    cal = await load_calendar(db, tenant_id, policy)
    control = await db.get(ThreadFollowupControl, thread.id)
    _, planning_on = effective_switches(policy, control)

    # ---- temperature: AI suggestion vs manual / legacy label ------------
    if (control is None or control.manual_temperature is None) and state.temperature_source is None \
            and (thread.lead_intent or "").lower() in MANUAL_TEMPS:
        control = await get_or_create_control(db, tenant_id, thread.id)
        control.manual_temperature, control.manual_temperature_by = thread.lead_intent.lower(), "legacy"
        control.manual_temperature_at = now
    manual = control.manual_temperature if control is not None else None
    state.suggested_temperature = result.temperature
    state.effective_temperature = manual or result.temperature
    state.temperature_source = ("legacy" if control.manual_temperature_by == "legacy" else "manual") if manual else "ai"
    state.temperature_reason = result.explanation
    thread.lead_intent = state.effective_temperature
    thread.lead_intent_score = result.buying_interest

    # ---- opportunities (close only the matched one) ---------------------
    opportunities = _merge_opportunities(state.opportunities, result.opportunities)
    state.opportunities = opportunities

    # ---- durable suppression + restriction for the customer recipient ---
    await _ensure_suppression(db, tenant_id=tenant_id, thread_id=thread.id, msg=msg, result=result, cal=cal)
    parts = await thread_participants(db, tenant_id, thread.id)
    primary = norm_email(control.customer_recipient_email) if control is not None and control.customer_recipient_email \
        else (parts[0] if parts else None)
    sups = await active_suppressions(db, tenant_id, parts, now)
    restr = restriction_for(sups, primary)
    other_blocked = [s for s in sups if norm_email(s.recipient_email) != primary and s.scope == "all"]

    # ---- status ----------------------------------------------------------
    status = _status_for(result, opportunities=opportunities)
    review: List[str] = []
    if result.constraints.conflicting_evidence:
        review.append("conflicting_evidence")
    if restr.blocks_all:
        status = "suppressed"
    elif control is not None and control.completed:
        status = "closed"
    elif not planning_on:
        status = "stopped"

    # ---- sequence anchor -------------------------------------------------
    if msg.direction == MessageDirection.INBOUND.value:
        if state.sequence_anchor_message_id != msg.id:
            state.sequence_anchor_message_id, state.attempts_used = msg.id, 0
    elif not state.sequence_anchor_message_id:
        state.sequence_anchor_message_id = msg.id

    # ---- timing ------------------------------------------------------------
    due_res = tm.resolve_due(result.timing, cal=cal, anchor=msg_at, now=now, decision=result.decision,
                             temperature=state.effective_temperature or "unknown", cadence_days=cadence_days(policy))
    if due_res.review_reason:
        review.append(due_res.review_reason)
    live = await live_occurrences(db, thread.id)
    manual_due = _utc(control.manual_due_at) if control is not None and control.manual_due_at else None
    plan_occ: Optional[FollowupOccurrence] = None
    origin, due_at, zone_name, external_ok = None, None, cal.zone.name, False

    if status in ("suppressed", "closed", "stopped", "none", "open"):
        for o in live:
            if status == "stopped" and o.origin == "user":
                continue                                       # clearly identified manual tasks survive
            _retire(o, "cancelled", f"state_{status}")
    else:
        if manual_due and manual_due > now:
            origin, due_at, zone_name, external_ok = "user", manual_due, control.manual_due_tz or cal.zone.name, True
        elif due_res.due_at is not None:
            origin = {"customer_date": "customer_date", "cadence": "cadence"}.get(due_res.source, "ai")
            due_at, zone_name, external_ok = due_res.due_at, due_res.zone_name, due_res.external_ok
        elif status in PURSUIT_STATUSES and due_res.review_reason:
            status = "needs_review"           # pursuit warranted but the date is unusable: hold for the team
        # A neutral message never blindly resets a still-valid customer date or user schedule.
        keep = None
        if not result.constraints.changed_date and origin in (None, "ai", "cadence"):
            keep = next((o for o in live if o.origin in ("customer_date", "user") and _utc(o.due_at) > now), None)
        if keep is not None:
            plan_occ = keep
            origin, due_at, zone_name = keep.origin, _utc(keep.due_at), keep.tz
        # Customer "not before" restriction: contact moves after it; an internal task may stay earlier.
        if restr.until and due_at and due_at < restr.until and status in PURSUIT_STATUSES:
            if origin == "user":
                review.append("manual_time_before_customer_restriction")
                external_ok = False
            else:
                due_at = tm.next_slot(restr.until - timedelta(seconds=1), cal)
        for o in live:
            if plan_occ is not None and o.id == plan_occ.id:
                continue
            _retire(o, "superseded", "replaced_by_newer_decision")
        if due_at is not None and plan_occ is None:
            pursuit = status in PURSUIT_STATUSES
            max_attempts = (control.manual_max_attempts if control and control.manual_max_attempts else policy.max_attempts)
            if pursuit and state.attempts_used >= max_attempts:
                review.append("sequence_exhausted")
                status = "open"
            else:
                notice_days = control.manual_notice_days if control and control.manual_notice_days is not None \
                    else policy.advance_notice_days
                notice_at, _mode = tm.compute_notice(due_at, cal=cal, notice_days=notice_days, now=now)
                cust_ok = bool(pursuit and control is not None and control.customer_email_enabled and external_ok
                               and not restr.blocks_email and not other_blocked and status != "needs_review")
                hold = None
                if pursuit and control is not None and control.customer_email_enabled and not cust_ok:
                    hold = restr.reason or ("other_participant_restricted" if other_blocked else
                                            (due_res.review_reason or "not_exact_enough_for_customer_email"))
                anchor = msg.id if origin != "user" else f"user:{control.version}"
                step = (state.attempts_used + 1) if pursuit else 0
                plan_occ = await upsert_occurrence(db, tenant_id=tenant_id, thread_id=thread.id, anchor=anchor,
                                                   step=step, values=dict(
                    origin=origin, scheduled_by=control.manual_due_by if origin == "user" and control else None,
                    due_at=due_at, notice_at=notice_at, tz=zone_name,
                    reason=(result.timing.internal_reminder_note or result.next_action or "")[:500],
                    customer_status="pending" if cust_ok else ("held" if hold else "not_applicable"),
                    hold_reason=hold, recipient_email=primary if pursuit else None, status="scheduled",
                    due_notice_status="pending", lease_until=None,
                ))
                if notice_at is None:
                    plan_occ.advance_status = "skipped"

    if plan_occ is not None and plan_occ.customer_status == "pending" and (restr.blocks_email or other_blocked):
        plan_occ.customer_status, plan_occ.hold_reason = "held", restr.reason or "other_participant_restricted"
    if other_blocked and status in PURSUIT_STATUSES:
        review.append("another_participant_refused_contact")

    # ---- persist effective state --------------------------------------------
    state.revision = (state.revision or 0) + 1
    if plan_occ is not None:
        plan_occ.state_revision = state.revision
    state.outcome, state.next_actor = result.outcome, result.next_actor
    state.next_action, state.decision = result.next_action, result.decision
    state.status = status if not (status in PURSUIT_STATUSES and "sequence_exhausted" in review) else "open"
    if plan_occ is not None and plan_occ.status == "scheduled":
        state.due_at, state.due_tz, state.notice_at = _utc(plan_occ.due_at), plan_occ.tz, _utc(plan_occ.notice_at)
        state.due_source = plan_occ.origin
        state.due_precision = due_res.precision if plan_occ.origin not in ("user",) else "instant"
        state.due_phrase = due_res.phrase if plan_occ.origin not in ("user",) else None
    else:
        state.due_at = state.notice_at = None
        state.due_tz = state.due_source = state.due_precision = None
        state.due_phrase = due_res.phrase if due_res.review_reason else None
    state.needs_review = state.status == "needs_review" or bool(review)
    state.review_reason = ", ".join(dict.fromkeys(review))[:500] or None
    if due_res.alternatives:
        state.review_reason = ((state.review_reason or "") + f" (alternatives: {', '.join(due_res.alternatives)})")[:500]
    state.stale, state.stale_reason = False, None
    state.last_assessment_id = row.id
    state.updated_at = now
    row.applied, row.not_applied_reason = True, None
    return ApplyOutcome(True, status=state.status, occurrence_id=plan_occ.id if plan_occ is not None else None)


async def reapply_latest(db: AsyncSession, *, tenant_id: str, thread_id: str,
                         now: Optional[datetime] = None) -> Optional[ApplyOutcome]:
    """Re-derive effective state from the stored latest decision (after a manual control change)."""
    from app.services.followups.contracts import from_json

    state = await lock_state(db, tenant_id, thread_id)
    if not state.last_assessment_id:
        return None
    row = await db.get(MessageAssessment, state.last_assessment_id)
    if row is None or row.status != "valid" or not row.result:
        return None
    return await apply_assessment(db, tenant_id=tenant_id, row=row, result=from_json(row.result), now=now)


async def hold_customer_sends(db: AsyncSession, thread_id: str, reason: str) -> int:
    res = await db.execute(update(FollowupOccurrence).where(
        FollowupOccurrence.thread_id == thread_id, FollowupOccurrence.status == "scheduled",
        FollowupOccurrence.customer_status == "pending",
    ).values(customer_status="held", hold_reason=reason))
    return int(res.rowcount or 0)
