"""Internal team notices: one individual transactional email per active workspace member.

* Recipients are re-read at delivery time: ACTIVE membership of an active user only (removed /
  invited / suspended users are excluded), deduplicated by registered address. The scheduling user
  is included through the same rule, so an owner who scheduled gets exactly one notice per stage.
* One ``FollowupNoticeDelivery`` row per (occurrence, notice type, address): a failure for one member
  retries only that member; already-accepted recipients are never emailed again.
* Log mode (EMAIL_DELIVERY=log) is recorded as ``logged`` and NEVER as accepted. A connection-level
  failure whose acceptance is unknowable is recorded ``unknown`` and not blindly retried.
* Members whose role cannot read the inbox get a generic notice without conversation details.
"""

from __future__ import annotations

import html
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import logger
from app.models.followup import FollowupNoticeDelivery, FollowupOccurrence, ThreadFollowupState
from app.models.inbox import EmailThread
from app.models.organization import OrganizationMember, Permission, RolePermission, User
from app.services.followups import timing as tm

MAX_NOTICE_ATTEMPTS = 3
TERMINAL = ("accepted", "logged", "unknown", "skipped")


@dataclass
class Recipient:
    user_id: str
    email: str
    can_view: bool


async def team_recipients(db: AsyncSession, tenant_id: str) -> List[Recipient]:
    rows = (await db.execute(
        select(User.id, User.email, OrganizationMember.role_id).join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == tenant_id, OrganizationMember.status == "ACTIVE",
               User.is_active.is_(True))
    )).all()
    viewer_roles = set((await db.execute(
        select(RolePermission.role_id).join(Permission, Permission.id == RolePermission.permission_id)
        .where(Permission.key == "inbox.read"))).scalars().all())
    out: Dict[str, Recipient] = {}
    for uid, email, role_id in rows:
        key = (email or "").strip().lower()
        if key and "@" in key and key not in out:
            out[key] = Recipient(uid, key, role_id in viewer_roles)
    return list(out.values())


async def is_active_member(db: AsyncSession, tenant_id: str, user_id: str) -> bool:
    row = (await db.execute(
        select(OrganizationMember.id).join(User, User.id == OrganizationMember.user_id).where(
            OrganizationMember.organization_id == tenant_id, OrganizationMember.user_id == user_id,
            OrganizationMember.status == "ACTIVE", User.is_active.is_(True)).limit(1)
    )).scalar_one_or_none()
    return row is not None


def customer_line(occ: FollowupOccurrence) -> str:
    s = occ.customer_status
    if s == "sent":
        return "ProxiPilot emailed the customer for this follow-up."
    if s in ("pending", "sending"):
        return "Automatic customer email is permitted; ProxiPilot will email the customer only after its final safety checks."
    if s == "held":
        return f"The customer has NOT been emailed (held: {occ.hold_reason or 'review needed'})."
    if s in ("unknown", "failed"):
        return "A customer email attempt is being verified; it may not have been delivered."
    return "The customer has NOT been emailed. Automatic customer email is off for this conversation."


def render(kind: str, *, occ: FollowupOccurrence, thread: EmailThread, state: Optional[ThreadFollowupState],
           cal: tm.Calendar, can_view: bool) -> tuple[str, str, str]:
    base = get_settings().frontend_url.rstrip("/")
    link = f"{base}/dashboard/inbox?conversation={thread.id}"
    due_local = tm.fmt_local(occ.due_at, cal.zone)
    if not can_view:
        subject = "Follow-up reminder in your ProxiPilot workspace"
        text = (f"A conversation follow-up is {'coming up' if kind == 'advance' else 'due'} ({due_local}).\n"
                f"Ask a teammate with inbox access to review it, or sign in: {base}/dashboard/leads")
        return subject, text, f"<p>{html.escape(text)}</p>"
    who = thread.sender_name or thread.sender_email or "a customer"
    subj = (thread.subject or "(no subject)")[:120]
    action = (occ.reason or (state.next_action if state else "") or "Review the conversation and decide the next step.")
    if kind == "advance":
        subject = f"Upcoming follow-up: {subj} — due {due_local}"
        lead = f"A follow-up with {who} is due {due_local}."
    else:
        subject = f"Follow-up due now: {subj}"
        lead = f"The follow-up with {who} is due now ({due_local})."
    lines = [lead, f"Next step: {action}", customer_line(occ) if kind == "due" else
             "This is an internal reminder; nothing has been sent to the customer.", f"Open the conversation: {link}"]
    text = "\n\n".join(lines)
    html_body = "".join(f"<p>{html.escape(line)}</p>" for line in lines[:-1]) + \
        f'<p><a href="{html.escape(link)}">Open the conversation</a></p>'
    return subject, text, html_body


def classify_error(exc: Exception) -> str:
    """'failed' when the provider definitely did not accept; 'unknown' when acceptance is unknowable."""
    msg = str(exc)
    definite = ("rejected", "Refused", "SMTPDataError", "SMTPAuthenticationError", "ConnectionRefusedError",
                "gaierror", "needs SMTP_HOST", "needs TWILIO")
    return "failed" if any(d in msg for d in definite) else "unknown"


async def deliver(db: AsyncSession, *, occ: FollowupOccurrence, kind: str, thread: EmailThread,
                  state: Optional[ThreadFollowupState], cal: tm.Calendar,
                  now: Optional[datetime] = None) -> bool:
    """Fan out one notice stage. Returns True when the stage is complete (every row terminal)."""
    from app.services import transactional_email

    now = now or datetime.now(timezone.utc)
    recipients = await team_recipients(db, occ.tenant_id)
    current = {r.email: r for r in recipients}
    for r in recipients:
        await db.execute(pg_insert(FollowupNoticeDelivery).values(
            id=f"fnd_{uuid.uuid4().hex}", tenant_id=occ.tenant_id,
            occurrence_id=occ.id, notice_type=kind, user_id=r.user_id, email=r.email, status="pending", attempts=0,
            created_at=now, updated_at=now,
        ).on_conflict_do_nothing(index_elements=["occurrence_id", "notice_type", "email"]))
    await db.commit()
    rows = (await db.execute(select(FollowupNoticeDelivery).where(
        FollowupNoticeDelivery.occurrence_id == occ.id, FollowupNoticeDelivery.notice_type == kind,
    ))).scalars().all()
    for row in rows:
        if row.status in TERMINAL or (row.status == "failed" and row.attempts >= MAX_NOTICE_ATTEMPTS):
            continue
        r = current.get(row.email)
        if r is not None and not await is_active_member(db, occ.tenant_id, r.user_id):
            r = None                                   # re-checked right before THIS send
        if r is None:                                  # membership removed during fan-out
            row.status, row.last_error = "skipped", "no_longer_active_member"
            await db.commit()
            continue
        row.attempts = (row.attempts or 0) + 1
        await db.commit()
        subject, text, html_body = render(kind, occ=occ, thread=thread, state=state, cal=cal, can_view=r.can_view)
        try:
            handed = await transactional_email.send_email(r.email, subject, text, html_body)
            row.status = "accepted" if handed else "logged"
            row.sent_at, row.last_error = datetime.now(timezone.utc), None
        except Exception as exc:  # noqa: BLE001 - one member never blocks the batch
            row.status = classify_error(exc)
            row.last_error = f"{type(exc).__name__}: {str(exc)[:300]}"
            logger.warning("followup notice delivery problem", occurrence_id=occ.id, kind=kind, status=row.status)
        await db.commit()
    rows = (await db.execute(select(FollowupNoticeDelivery.status, FollowupNoticeDelivery.attempts).where(
        FollowupNoticeDelivery.occurrence_id == occ.id, FollowupNoticeDelivery.notice_type == kind))).all()
    return all(s in TERMINAL or (s == "failed" and a >= MAX_NOTICE_ATTEMPTS) for s, a in rows)
