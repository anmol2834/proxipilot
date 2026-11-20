"""Conversation intelligence & follow-up API.

GET    /followups/threads/{id}             effective decision, controls, timing, history   (inbox.read)
PATCH  /followups/threads/{id}/controls    temperature / planning / assessment / snooze / complete /
                                           customer email permission (version-fenced)      (inbox.reply;
                                           customer email permission and recipient need inbox.send)
POST   /followups/threads/{id}/schedule    explicit user schedule (local date-time + zone)  (inbox.reply)
DELETE /followups/threads/{id}/schedule    release the manual schedule                       (inbox.reply)
DELETE /followups/suppressions/{id}        lift a do-not-contact restriction                 (settings.update)
GET    /followups/policy                   workspace timing defaults                         (settings.read)
PATCH  /followups/policy                   update defaults (version-fenced)                  (settings.update)
GET    /followups/leads                    paginated Leads queue with distinct filters      (inbox.read)

Every query is scoped by the caller's tenant; thread participants are validated server-side.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.followup import (
    ContactSuppression, FollowupNoticeDelivery, FollowupOccurrence, FollowupPolicy, MessageAssessment,
    ThreadFollowupControl, ThreadFollowupState,
)
from app.models.inbox import EmailThread
from app.models.integration import ConnectedIntegrationAccount
from app.services.audit import audit_service
from app.services.followups import engine
from app.services.followups import timing as tm
from app.services.followups.flags import get_flags

router = APIRouter(prefix="/followups", tags=["Follow-ups"])

LEAD_FILTERS = ("active", "open_unconfirmed", "scheduled", "due", "deferred", "waiting_team", "needs_review", "closed")
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt) -> Optional[str]:
    return _utc(dt).isoformat() if dt else None


async def _thread(db: AsyncSession, ctx: TenantContext, thread_id: str) -> EmailThread:
    th = await db.get(EmailThread, thread_id)
    if th is None or th.tenant_id != ctx.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return th


async def _audit(db, ctx: TenantContext, action: str, thread_id: str, meta: Dict[str, Any]) -> None:
    await audit_service.record(db=db, action=action, resource_type="email_thread", resource_id=thread_id,
                               organization_id=ctx.organization_id, actor_user_id=ctx.user_id, metadata=meta)


# ---------------------------------------------------------------------------
# Thread panel
# ---------------------------------------------------------------------------

async def _panel(db: AsyncSession, ctx: TenantContext, thread: EmailThread) -> Dict[str, Any]:
    tid, now = ctx.organization_id, datetime.now(timezone.utc)
    policy = await engine.load_policy(db, tid)
    cal = await engine.load_calendar(db, tid, policy)
    state = await db.get(ThreadFollowupState, thread.id)
    control = await db.get(ThreadFollowupControl, thread.id)
    assess_on, planning_on = engine.effective_switches(policy, control)
    participants = await engine.thread_participants(db, tid, thread.id)
    sups = await engine.active_suppressions(db, tid, participants, now)
    account = await db.get(ConnectedIntegrationAccount, thread.integration_account_id)
    supported = bool(account and account.tenant_id == tid and (account.provider or "").lower() == "gmail")
    last_asm = await db.get(MessageAssessment, state.last_assessment_id) if state and state.last_assessment_id else None
    occs = (await db.execute(select(FollowupOccurrence).where(
        FollowupOccurrence.tenant_id == tid, FollowupOccurrence.thread_id == thread.id,
    ).order_by(FollowupOccurrence.created_at.desc()).limit(10))).scalars().all()
    occ_ids = [o.id for o in occs]
    notice_rows = (await db.execute(select(
        FollowupNoticeDelivery.occurrence_id, FollowupNoticeDelivery.notice_type, FollowupNoticeDelivery.status,
        func.count()).where(FollowupNoticeDelivery.occurrence_id.in_(occ_ids)).group_by(
        FollowupNoticeDelivery.occurrence_id, FollowupNoticeDelivery.notice_type, FollowupNoticeDelivery.status,
    ))).all() if occ_ids else []
    notices: Dict[str, Dict[str, Dict[str, int]]] = {}
    for oid, kind, st, n in notice_rows:
        notices.setdefault(oid, {}).setdefault(kind, {})[st] = int(n)
    history = (await db.execute(select(MessageAssessment).where(
        MessageAssessment.tenant_id == tid, MessageAssessment.thread_id == thread.id,
    ).order_by(MessageAssessment.created_at.desc()).limit(10))).scalars().all()
    flags = get_flags()

    def local(dt, zone_name=None):
        if not dt:
            return None
        z = tm.resolve_zone(zone_name) or cal.zone
        return tm.fmt_local(_utc(dt), z)

    return {
        "thread_id": thread.id,
        "revision": state.revision if state else 0,
        "version": control.version if control else 1,      # a new control row starts at version 1
        "temperature": {
            "effective": (state.effective_temperature if state else None) or (thread.lead_intent or "unknown"),
            "suggested": state.suggested_temperature if state else None,
            "source": (state.temperature_source if state else None) or ("legacy" if (thread.lead_intent or "unknown") != "unknown" else None),
            "reason": state.temperature_reason if state else None,
            "label_confidence": last_asm.label_confidence if last_asm else None,
            "buying_interest": last_asm.buying_interest if last_asm else None,
        },
        "status": state.status if state else "none",
        "outcome": state.outcome if state else None,
        "decision": state.decision if state else None,
        "next_actor": state.next_actor if state else None,
        "next_action": state.next_action if state else None,
        "opportunities": (state.opportunities or []) if state else [],
        "due": {
            "at": _iso(state.due_at) if state else None, "local": local(state.due_at, state.due_tz) if state else None,
            "timezone": state.due_tz if state else None, "precision": state.due_precision if state else None,
            "source": state.due_source if state else None, "phrase": state.due_phrase if state else None,
        },
        "notice": {"at": _iso(state.notice_at) if state else None,
                   "local": local(state.notice_at) if state else None},
        "needs_review": bool(state.needs_review) if state else False,
        "review_reason": state.review_reason if state else None,
        "stale": bool(state.stale) if state else False,
        "stale_reason": state.stale_reason if state else None,
        "attempts_used": state.attempts_used if state else 0,
        "controls": {
            "assessment_enabled": assess_on, "assessment_override": control.assessment_enabled if control else None,
            "planning_enabled": planning_on, "planning_override": control.planning_enabled if control else None,
            "customer_email_enabled": bool(control and control.customer_email_enabled),
            "customer_recipient_email": control.customer_recipient_email if control else None,
            "manual_temperature": control.manual_temperature if control else None,
            "manual_due_at": _iso(control.manual_due_at) if control else None,
            "manual_due_local": local(control.manual_due_at, control.manual_due_tz) if control else None,
            "manual_interval_days": control.manual_interval_days if control else None,
            "manual_max_attempts": control.manual_max_attempts if control else None,
            "manual_notice_days": control.manual_notice_days if control else None,
            "snoozed_until": _iso(control.snoozed_until) if control else None,
            "completed": bool(control and control.completed),
        },
        "participants": participants,
        "suppressions": [{"id": s.id, "recipient_email": s.recipient_email, "scope": s.scope,
                          "until_at": _iso(s.until_at), "quote": s.quote, "created_at": _iso(s.created_at)} for s in sups],
        "capabilities": {
            "customer_email_supported": supported,
            "mailbox_automation_enabled": bool(account and account.automation_enabled),
            "customer_send_globally_enabled": flags.customer_send_enabled,
            "reminders_enabled": flags.reminders_enabled,
            "can_edit": ctx.has_permission("inbox.reply"),
            "can_send": ctx.has_permission("inbox.send"),
            "can_manage_settings": ctx.has_permission("settings.update"),
            "workspace_timezone": cal.zone.name,
        },
        "occurrences": [{
            "id": o.id, "origin": o.origin, "status": o.status, "due_at": _iso(o.due_at), "due_local": local(o.due_at, o.tz),
            "notice_at": _iso(o.notice_at), "notice_local": local(o.notice_at), "advance_status": o.advance_status,
            "due_notice_status": o.due_notice_status, "customer_status": o.customer_status,
            "hold_reason": o.hold_reason, "reason": o.reason, "step": o.step, "notices": notices.get(o.id, {}),
        } for o in occs],
        "history": [{
            "id": a.id, "message_id": a.message_id, "created_at": _iso(a.created_at), "status": a.status,
            "temperature": a.suggested_temperature, "decision": a.decision, "outcome": a.outcome,
            "next_actor": a.next_actor, "explanation": a.explanation, "applied": a.applied,
            "not_applied_reason": a.not_applied_reason,
        } for a in history],
    }


@router.get("/threads/{thread_id}")
async def get_thread_followup(thread_id: str, db: AsyncSession = Depends(get_db),
                              ctx: TenantContext = Depends(require_permission("inbox.read"))) -> Dict[str, Any]:
    return await _panel(db, ctx, await _thread(db, ctx, thread_id))


class ControlsPatch(BaseModel):
    version: int = Field(..., ge=0)
    assessment_enabled: Optional[bool] = None
    planning_enabled: Optional[bool] = None
    customer_email_enabled: Optional[bool] = None
    customer_recipient_email: Optional[str] = Field(default=None, max_length=320)
    manual_temperature: Optional[str] = None
    completed: Optional[bool] = None
    snoozed_until: Optional[datetime] = None
    manual_interval_days: Optional[int] = Field(default=None, ge=1, le=90)
    manual_max_attempts: Optional[int] = Field(default=None, ge=1, le=10)
    manual_notice_days: Optional[int] = Field(default=None, ge=0, le=10)


@router.patch("/threads/{thread_id}/controls")
async def patch_controls(thread_id: str, body: ControlsPatch, db: AsyncSession = Depends(get_db),
                         ctx: TenantContext = Depends(require_permission("inbox.reply"))) -> Dict[str, Any]:
    thread = await _thread(db, ctx, thread_id)
    fields = body.model_fields_set - {"version"}
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to change")
    now = datetime.now(timezone.utc)
    tid = ctx.organization_id
    control = await engine.get_or_create_control(db, tid, thread.id)
    if body.version != control.version:
        raise HTTPException(status_code=409, detail="This conversation's follow-up settings changed; refresh and retry")

    send_fields = {"customer_email_enabled", "customer_recipient_email"} & fields
    if send_fields and not (body.customer_email_enabled is False and fields <= {"customer_email_enabled"}):
        if not ctx.has_permission("inbox.send"):
            raise HTTPException(status_code=403, detail="Only members with send authority can change customer email")
    if "manual_temperature" in fields:
        mt = (body.manual_temperature or "").lower() or None
        if mt not in (None, *engine.MANUAL_TEMPS):
            raise HTTPException(status_code=422, detail="manual_temperature must be hot, warm, cold or null")
        control.manual_temperature = mt
        control.manual_temperature_by = ctx.user_id if mt else None
        control.manual_temperature_at = now if mt else None
    if "assessment_enabled" in fields:
        control.assessment_enabled = body.assessment_enabled
    if "planning_enabled" in fields:
        control.planning_enabled = body.planning_enabled
    if "completed" in fields:
        control.completed = bool(body.completed)
        control.completed_by = ctx.user_id if body.completed else None
    if "snoozed_until" in fields:
        control.snoozed_until = _utc(body.snoozed_until)
    for f in ("manual_interval_days", "manual_max_attempts", "manual_notice_days"):
        if f in fields:
            setattr(control, f, getattr(body, f))
    if send_fields:
        participants = await engine.thread_participants(db, tid, thread.id)
        recipient = engine.norm_email(body.customer_recipient_email) if "customer_recipient_email" in fields \
            else engine.norm_email(control.customer_recipient_email)
        enable = body.customer_email_enabled if "customer_email_enabled" in fields else control.customer_email_enabled
        if enable:
            if not recipient:
                raise HTTPException(status_code=422, detail="Choose the customer participant to email")
            if recipient not in participants:
                raise HTTPException(status_code=422, detail="That address is not a participant who wrote in this conversation")
            account = await db.get(ConnectedIntegrationAccount, thread.integration_account_id)
            if account is None or (account.provider or "").lower() != "gmail":
                raise HTTPException(status_code=409, detail="Automatic customer email is supported for Gmail mailboxes only")
            r = engine.restriction_for(await engine.active_suppressions(db, tid, [recipient], now), recipient)
            if r.blocks_email:
                raise HTTPException(status_code=409, detail="This customer asked not to be contacted by email")
            control.customer_email_enabled_by, control.customer_email_enabled_at = ctx.user_id, now
        else:
            control.customer_email_enabled_by = control.customer_email_enabled_at = None
        control.customer_email_enabled = bool(enable)
        control.customer_recipient_email = recipient or None
    control.version = (control.version or 0) + 1

    # Re-derive effective state from the stored decision so overrides take effect immediately.
    out = await engine.reapply_latest(db, tenant_id=tid, thread_id=thread.id, now=now)
    if out is None:
        state = await engine.lock_state(db, tid, thread.id)
        if control.manual_temperature:
            state.effective_temperature, state.temperature_source = control.manual_temperature, "manual"
            thread.lead_intent = control.manual_temperature
        elif "manual_temperature" in fields:
            state.effective_temperature = state.suggested_temperature
            state.temperature_source = "ai" if state.suggested_temperature else None
        if control.completed or control.planning_enabled is False:
            for o in await engine.live_occurrences(db, thread.id):
                if control.completed or o.origin != "user":
                    engine._retire(o, "cancelled", "closed_by_user" if control.completed else "planning_off")
            state.status = "closed" if control.completed else "stopped"
    if not control.customer_email_enabled:
        await engine.hold_customer_sends(db, thread.id, "customer_email_turned_off")
    await _audit(db, ctx, "FOLLOWUP_CONTROLS_CHANGED", thread.id, {"fields": sorted(fields)})
    await db.commit()
    return await _panel(db, ctx, thread)


class ScheduleBody(BaseModel):
    version: int = Field(..., ge=0)
    local_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    local_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    timezone: Optional[str] = Field(default=None, max_length=64)


@router.post("/threads/{thread_id}/schedule")
async def schedule(thread_id: str, body: ScheduleBody, db: AsyncSession = Depends(get_db),
                   ctx: TenantContext = Depends(require_permission("inbox.reply"))) -> Dict[str, Any]:
    from datetime import date as _date

    thread = await _thread(db, ctx, thread_id)
    tid, now = ctx.organization_id, datetime.now(timezone.utc)
    control = await engine.get_or_create_control(db, tid, thread.id)
    if body.version != control.version:
        raise HTTPException(status_code=409, detail="This conversation's follow-up settings changed; refresh and retry")
    cal = await engine.load_calendar(db, tid)
    zone = tm.resolve_zone(body.timezone) if body.timezone else cal.zone
    if zone is None:
        raise HTTPException(status_code=422, detail="Unrecognised time zone")
    hh, mm = body.local_time.split(":")
    due, _note = tm.local_instant(_date.fromisoformat(body.local_date), datetime.min.time().replace(
        hour=int(hh), minute=int(mm)), zone)
    if due <= now:
        raise HTTPException(status_code=422, detail="Choose a time in the future")
    control.manual_due_at, control.manual_due_tz, control.manual_due_by = due, zone.name, ctx.user_id
    control.version = (control.version or 0) + 1
    out = await engine.reapply_latest(db, tenant_id=tid, thread_id=thread.id, now=now)
    if out is None or out.occurrence_id is None:
        # No AI decision yet (or it does not plan): an explicit, clearly identified manual task.
        state = await engine.lock_state(db, tid, thread.id)
        for o in await engine.live_occurrences(db, thread.id):
            engine._retire(o, "superseded", "replaced_by_user_schedule")
        policy = await engine.load_policy(db, tid)
        notice_days = control.manual_notice_days if control.manual_notice_days is not None else policy.advance_notice_days
        notice_at, _ = tm.compute_notice(due, cal=cal, notice_days=notice_days, now=now)
        occ = await engine.upsert_occurrence(db, tenant_id=tid, thread_id=thread.id, anchor=f"user:{control.version}",
                                             step=0, values=dict(
            origin="user", scheduled_by=ctx.user_id, due_at=due, notice_at=notice_at, tz=zone.name,
            reason="Follow-up scheduled by a teammate", customer_status="not_applicable", status="scheduled",
            due_notice_status="pending", state_revision=state.revision, lease_until=None))
        if notice_at is None:
            occ.advance_status = "skipped"
        if state.status in ("none", "open", "closed", "stopped"):
            state.status = "waiting_team"
        state.due_at, state.due_tz, state.due_source, state.due_precision = due, zone.name, "user", "instant"
        state.notice_at = notice_at
    await _audit(db, ctx, "FOLLOWUP_SCHEDULED", thread.id, {"due_at": due.isoformat(), "tz": zone.name})
    await db.commit()
    return await _panel(db, ctx, thread)


@router.delete("/threads/{thread_id}/schedule")
async def clear_schedule(thread_id: str, version: int = Query(..., ge=0), db: AsyncSession = Depends(get_db),
                         ctx: TenantContext = Depends(require_permission("inbox.reply"))) -> Dict[str, Any]:
    thread = await _thread(db, ctx, thread_id)
    tid, now = ctx.organization_id, datetime.now(timezone.utc)
    control = await engine.get_or_create_control(db, tid, thread.id)
    if version != control.version:
        raise HTTPException(status_code=409, detail="This conversation's follow-up settings changed; refresh and retry")
    control.manual_due_at = control.manual_due_tz = control.manual_due_by = None
    control.version = (control.version or 0) + 1
    for o in await engine.live_occurrences(db, thread.id):
        if o.origin == "user":
            engine._retire(o, "cancelled", "manual_schedule_released")
    out = await engine.reapply_latest(db, tenant_id=tid, thread_id=thread.id, now=now)
    if out is None:
        state = await engine.lock_state(db, tid, thread.id)
        state.due_at = state.notice_at = state.due_tz = state.due_source = state.due_precision = None
        if state.status == "waiting_team":
            state.status = "none"
    await _audit(db, ctx, "FOLLOWUP_SCHEDULE_CLEARED", thread.id, {})
    await db.commit()
    return await _panel(db, ctx, thread)


@router.delete("/suppressions/{suppression_id}")
async def lift_suppression(suppression_id: str, db: AsyncSession = Depends(get_db),
                           ctx: TenantContext = Depends(require_permission("settings.update"))) -> Dict[str, Any]:
    sup = await db.get(ContactSuppression, suppression_id)
    if sup is None or sup.tenant_id != ctx.organization_id:
        raise HTTPException(status_code=404, detail="Restriction not found")
    if sup.lifted_at is None:
        sup.lifted_at, sup.lifted_by = datetime.now(timezone.utc), ctx.user_id
        await audit_service.record(db=db, action="FOLLOWUP_SUPPRESSION_LIFTED", resource_type="contact_suppression",
                                   resource_id=sup.id, organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
                                   metadata={"scope": sup.scope})
        await db.commit()
    return {"id": sup.id, "lifted": True}


# ---------------------------------------------------------------------------
# Workspace policy
# ---------------------------------------------------------------------------

def _policy_dto(p: FollowupPolicy, cal: tm.Calendar) -> Dict[str, Any]:
    return {
        "version": p.version, "assessment_enabled": p.assessment_enabled, "planning_enabled": p.planning_enabled,
        "cadence_hot_days": p.cadence_hot_days, "cadence_warm_days": p.cadence_warm_days,
        "cadence_cold_days": p.cadence_cold_days, "workdays": [int(x) for x in p.workdays.split(",") if x.strip().isdigit()],
        "send_window_start": p.send_window_start, "send_window_end": p.send_window_end,
        "default_local_time": p.default_local_time, "advance_notice_days": p.advance_notice_days,
        "max_attempts": p.max_attempts, "min_spacing_hours": p.min_spacing_hours,
        "timezone": p.timezone, "effective_timezone": cal.zone.name,
    }


@router.get("/policy")
async def get_policy(db: AsyncSession = Depends(get_db),
                     ctx: TenantContext = Depends(require_permission("settings.read"))) -> Dict[str, Any]:
    p = await engine.load_policy(db, ctx.organization_id)
    return _policy_dto(p, await engine.load_calendar(db, ctx.organization_id, p))


class PolicyPatch(BaseModel):
    version: int = Field(..., ge=0)
    assessment_enabled: Optional[bool] = None
    planning_enabled: Optional[bool] = None
    cadence_hot_days: Optional[int] = Field(default=None, ge=1, le=60)
    cadence_warm_days: Optional[int] = Field(default=None, ge=1, le=60)
    cadence_cold_days: Optional[int] = Field(default=None, ge=1, le=90)
    workdays: Optional[List[int]] = None
    send_window_start: Optional[str] = None
    send_window_end: Optional[str] = None
    default_local_time: Optional[str] = None
    advance_notice_days: Optional[int] = Field(default=None, ge=0, le=10)
    max_attempts: Optional[int] = Field(default=None, ge=1, le=10)
    min_spacing_hours: Optional[int] = Field(default=None, ge=1, le=720)
    timezone: Optional[str] = Field(default=None, max_length=64)


@router.patch("/policy")
async def patch_policy(body: PolicyPatch, db: AsyncSession = Depends(get_db),
                       ctx: TenantContext = Depends(require_permission("settings.update"))) -> Dict[str, Any]:
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    tid, now = ctx.organization_id, datetime.now(timezone.utc)
    await db.execute(pg_insert(FollowupPolicy).values(
        id=f"fpol_{tid[-40:]}", tenant_id=tid, version=0, created_at=now, updated_at=now,
    ).on_conflict_do_nothing(index_elements=["tenant_id"]))
    p = (await db.execute(select(FollowupPolicy).where(FollowupPolicy.tenant_id == tid).with_for_update()
                          .execution_options(populate_existing=True))).scalar_one()
    if body.version != p.version:
        raise HTTPException(status_code=409, detail="Follow-up settings changed; refresh and retry")
    fields = body.model_fields_set - {"version"}
    for f in ("send_window_start", "send_window_end", "default_local_time"):
        if f in fields and not _HHMM.match(getattr(body, f) or ""):
            raise HTTPException(status_code=422, detail=f"{f} must be HH:MM")
    if "workdays" in fields:
        days = sorted({d for d in (body.workdays or []) if 0 <= d <= 6})
        if not days:
            raise HTTPException(status_code=422, detail="Choose at least one working day")
        p.workdays = ",".join(str(d) for d in days)
    if "timezone" in fields and body.timezone:
        z = tm.resolve_zone(body.timezone)
        if z is None:
            raise HTTPException(status_code=422, detail="Unrecognised time zone")
        p.timezone = z.name
    elif "timezone" in fields:
        p.timezone = None
    for f in ("assessment_enabled", "planning_enabled", "cadence_hot_days", "cadence_warm_days", "cadence_cold_days",
              "send_window_start", "send_window_end", "default_local_time", "advance_notice_days", "max_attempts",
              "min_spacing_hours"):
        if f in fields and getattr(body, f) is not None:
            setattr(p, f, getattr(body, f))
    if p.send_window_start >= p.send_window_end:
        raise HTTPException(status_code=422, detail="The send window must end after it starts")
    p.version, p.updated_by = (p.version or 0) + 1, ctx.user_id
    await audit_service.record(db=db, action="FOLLOWUP_POLICY_UPDATED", resource_type="followup_policy",
                               resource_id=p.id, organization_id=tid, actor_user_id=ctx.user_id,
                               metadata={"fields": sorted(fields)})
    await db.commit()
    return _policy_dto(p, await engine.load_calendar(db, tid, p))


# ---------------------------------------------------------------------------
# Leads queue
# ---------------------------------------------------------------------------

def _filter_clause(name: str, now: datetime):
    S = ThreadFollowupState
    actionable = S.status.in_(engine.ACTIVE_STATUSES)
    return {
        "active": actionable,
        "open_unconfirmed": and_(actionable, S.outcome == "open_unconfirmed"),
        "scheduled": and_(S.status.in_(("scheduled", "waiting_team")), S.due_at.is_not(None), S.due_at > now),
        "due": and_(S.status.in_(("scheduled", "deferred", "waiting_team")), S.due_at.is_not(None), S.due_at <= now),
        "deferred": S.status == "deferred",
        "waiting_team": S.status == "waiting_team",
        "needs_review": and_(S.needs_review.is_(True), S.status.not_in(("suppressed", "stopped", "closed"))),
        "closed": S.status == "closed",
    }[name]


@router.get("/leads")
async def leads(filter: str = Query("active"), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                temperature: Optional[str] = Query(None), db: AsyncSession = Depends(get_db),
                ctx: TenantContext = Depends(require_permission("inbox.read"))) -> Dict[str, Any]:
    if filter not in LEAD_FILTERS:
        raise HTTPException(status_code=422, detail=f"filter must be one of {', '.join(LEAD_FILTERS)}")
    tid, now = ctx.organization_id, datetime.now(timezone.utc)
    S, T = ThreadFollowupState, EmailThread
    base = and_(S.tenant_id == tid, T.tenant_id == tid, _filter_clause(filter, now))
    if temperature in ("hot", "warm", "cold", "unknown"):
        base = and_(base, S.effective_temperature == temperature)
    total = (await db.execute(select(func.count()).select_from(S).join(T, T.id == S.thread_id).where(base))).scalar_one()
    rows = (await db.execute(
        select(S, T.subject, T.sender_name, T.sender_email, T.latest_message_at).join(T, T.id == S.thread_id)
        .where(base).order_by(S.due_at.asc().nullslast(), S.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size))).all()
    counts: Dict[str, int] = {}
    for name in LEAD_FILTERS:
        counts[name] = (await db.execute(select(func.count()).select_from(S).join(T, T.id == S.thread_id).where(
            S.tenant_id == tid, T.tenant_id == tid, _filter_clause(name, now)))).scalar_one()
    cal = await engine.load_calendar(db, tid)
    return {
        "filter": filter, "page": page, "page_size": page_size, "total": total, "counts": counts,
        "items": [{
            "thread_id": s.thread_id, "subject": subject, "sender_name": sname, "sender_email": semail,
            "latest_message_at": _iso(latest), "temperature": s.effective_temperature,
            "temperature_source": s.temperature_source, "status": s.status, "outcome": s.outcome,
            "next_actor": s.next_actor, "next_action": s.next_action, "due_at": _iso(s.due_at),
            "due_local": tm.fmt_local(_utc(s.due_at), tm.resolve_zone(s.due_tz) or cal.zone) if s.due_at else None,
            "notice_at": _iso(s.notice_at), "needs_review": s.needs_review, "review_reason": s.review_reason,
            "stale": s.stale,
        } for s, subject, sname, semail, latest in rows],
    }
