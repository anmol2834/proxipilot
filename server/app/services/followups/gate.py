"""The authoritative customer-send gate, evaluated on FRESH state right before any provider call
(first dispatch, scheduler retry and background-reconciler resend alike).

Every condition must hold; anything uncertain holds the send (never "probably fine"):
  kill switch on | occurrence due & scheduled | effective state current (revision) & not stale |
  latest AI #2 decision supports contact | explicit thread + recipient permission by a user who still
  has send authority | recipient is a verified participant AND the address the threaded reply goes to |
  no active suppression for that recipient in this tenant | workspace active | Gmail mailbox connected,
  healthy, automation enabled | no newer unassessed message | attempts left | min spacing | send window.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.followup import FollowupOccurrence, ThreadFollowupControl, ThreadFollowupState
from app.models.inbox import EmailMessage, EmailThread, MessageDirection
from app.models.integration import ConnectedIntegrationAccount
from app.models.organization import OrganizationMember, Organization, Permission, RolePermission
from app.services.followups import engine
from app.services.followups import timing as tm
from app.services.followups.flags import get_flags

HEALTHY_STATUSES = {"active", "connected", "syncing"}
HEALTHY_CONNECTION = {"healthy", "syncing"}


@dataclass
class GateResult:
    ok: bool
    reason: Optional[str] = None
    retry_at: Optional[datetime] = None      # set when the only blocker is the send window
    recipient: Optional[str] = None


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def user_has_permission(db: AsyncSession, tenant_id: str, user_id: Optional[str], key: str) -> bool:
    if not user_id:
        return False
    row = (await db.execute(
        select(Permission.key).join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(OrganizationMember, OrganizationMember.role_id == RolePermission.role_id)
        .where(OrganizationMember.organization_id == tenant_id, OrganizationMember.user_id == user_id,
               OrganizationMember.status == "ACTIVE", Permission.key == key).limit(1)
    )).scalar_one_or_none()
    return row is not None


def reply_recipient(parent: Optional[EmailMessage]) -> Optional[str]:
    """Exactly the address ``_deliver_in_thread`` would send to (never reply-all, never inferred)."""
    if parent is None:
        return None
    m = re.search(r"[\w\.\+-]+@[\w\.-]+", parent.reply_to_email or parent.from_email or "")
    return (m.group(0) if m else (parent.from_email or "")).strip().lower() or None


async def _fresh(db: AsyncSession, model, key):
    """Re-read from the database even if the session already holds the object (never trust a cache
    at the send boundary: another transaction may have fenced or revoked since)."""
    pk = list(model.__table__.primary_key.columns)[0]
    return (await db.execute(select(model).where(pk == key).execution_options(populate_existing=True))).scalar_one_or_none()


async def evaluate(db: AsyncSession, occ: FollowupOccurrence, now: Optional[datetime] = None,
                   *, check_window: bool = True, for_resend: bool = False) -> GateResult:
    now = now or datetime.now(timezone.utc)
    flags = get_flags()
    if not flags.customer_send_enabled:
        return GateResult(False, "customer_send_kill_switch")
    occ = await _fresh(db, FollowupOccurrence, occ.id) or occ
    if not for_resend:
        if occ.status != "scheduled":
            return GateResult(False, f"occurrence_{occ.status}")
        if _utc(occ.due_at) > now:
            return GateResult(False, "not_due")
    thread = await _fresh(db, EmailThread, occ.thread_id)
    if thread is None or thread.tenant_id != occ.tenant_id:
        return GateResult(False, "thread_missing")
    state = await _fresh(db, ThreadFollowupState, occ.thread_id)
    if state is None or state.tenant_id != occ.tenant_id:
        return GateResult(False, "no_state")
    if state.stale:
        return GateResult(False, "awaiting_assessment_of_new_message")
    if state.revision != occ.state_revision:
        return GateResult(False, "state_revision_changed")
    if state.status not in engine.PURSUIT_STATUSES or state.decision not in ("schedule", "defer"):
        return GateResult(False, f"decision_does_not_support_contact:{state.status}/{state.decision}")
    if state.needs_review:
        return GateResult(False, "needs_review")
    if state.suggested_due_at is not None:
        # A different time is waiting for a person: never email the customer at the old time meanwhile.
        return GateResult(False, "new_time_suggested_pending_review")
    control = await _fresh(db, ThreadFollowupControl, occ.thread_id)
    if control is None or not control.customer_email_enabled or not control.customer_recipient_email:
        return GateResult(False, "customer_email_not_permitted")
    if control.completed:
        return GateResult(False, "marked_completed")
    if control.snoozed_until and _utc(control.snoozed_until) > now:
        return GateResult(False, "snoozed")
    ws_policy = await engine.load_policy(db, occ.tenant_id)
    _, planning_on = engine.effective_switches(ws_policy, control)
    if not planning_on:
        return GateResult(False, "planning_off")
    if not ws_policy.customer_email_allowed:
        return GateResult(False, "workspace_disallows_customer_email")
    if engine.observe_only(ws_policy):
        return GateResult(False, "workspace_observe_only")
    if not await user_has_permission(db, occ.tenant_id, control.customer_email_enabled_by, "inbox.send"):
        return GateResult(False, "permitting_user_lacks_send_authority")
    recipient = engine.norm_email(control.customer_recipient_email)
    if occ.recipient_email and engine.norm_email(occ.recipient_email) != recipient:
        return GateResult(False, "recipient_changed")
    participants = await engine.thread_participants(db, occ.tenant_id, occ.thread_id)
    if recipient not in participants:
        return GateResult(False, "recipient_not_verified_participant")
    parent = await engine.latest_inbound(db, occ.tenant_id, occ.thread_id)
    if reply_recipient(parent) != recipient:
        return GateResult(False, "threaded_reply_would_go_to_another_participant")
    sups = await engine.active_suppressions(db, occ.tenant_id, participants, now)
    r = engine.restriction_for(sups, recipient)
    if r.blocks_email or r.blocks_all:
        return GateResult(False, f"suppressed:{r.reason}")
    if any(s.scope == "all" for s in sups):
        return GateResult(False, "another_participant_refused_contact")
    org_status = (await db.execute(select(Organization.status).where(Organization.id == occ.tenant_id))).scalar_one_or_none()
    if str(getattr(org_status, "value", org_status) or "").upper() != "ACTIVE":
        return GateResult(False, "workspace_inactive")
    account = await _fresh(db, ConnectedIntegrationAccount, thread.integration_account_id)
    if account is None or account.tenant_id != occ.tenant_id:
        return GateResult(False, "mailbox_missing")
    if (account.provider or "").lower() != "gmail":
        return GateResult(False, "provider_not_supported_for_customer_email")
    if (account.status or "").lower() not in HEALTHY_STATUSES or \
            (account.connection_status or "").lower() not in HEALTHY_CONNECTION:
        return GateResult(False, "mailbox_unhealthy")
    if not account.automation_enabled:
        return GateResult(False, "mailbox_automation_disabled")
    newer = (await db.execute(select(EmailMessage.id).where(
        EmailMessage.tenant_id == occ.tenant_id, EmailMessage.thread_id == occ.thread_id,
        EmailMessage.sent_at > _utc(state.last_message_at)).limit(1))).scalar_one_or_none() \
        if state.last_message_at else None
    if newer and not for_resend:
        return GateResult(False, "newer_message_not_assessed")
    max_attempts = control.manual_max_attempts or (await engine.load_policy(db, occ.tenant_id)).max_attempts
    if not for_resend and (state.attempts_used or 0) >= max_attempts:
        return GateResult(False, "attempts_exhausted")
    policy = await engine.load_policy(db, occ.tenant_id)
    last_out = (await db.execute(select(EmailMessage.sent_at).where(
        EmailMessage.tenant_id == occ.tenant_id, EmailMessage.thread_id == occ.thread_id,
        EmailMessage.direction == MessageDirection.OUTBOUND.value,
    ).order_by(EmailMessage.sent_at.desc().nullslast()).limit(1))).scalar_one_or_none()
    if not for_resend and last_out and now - _utc(last_out) < timedelta(hours=policy.min_spacing_hours):
        return GateResult(False, "min_spacing")
    if check_window:
        cal = await engine.load_calendar(db, occ.tenant_id, policy)
        if not tm.in_send_window(now, cal) and occ.origin not in ("customer_date", "user"):
            return GateResult(False, "outside_send_window", retry_at=tm.next_send_window(now, cal), recipient=recipient)
    return GateResult(True, recipient=recipient)
