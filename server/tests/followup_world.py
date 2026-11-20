"""Synthetic world for follow-up integration tests (no real tenant, no real provider, no real model).

Every test gets its own throwaway organisation + users + Gmail mailbox and removes them afterwards.
AI #2 output is scripted per message id (``World.script``); the model client, Gmail dispatch and
transactional email are replaced by spies that count calls, so "zero customer emails" is measured.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, text

from app.core.database import db_manager
from app.models.followup import FollowupOccurrence, ThreadFollowupState
from app.models.inbox import EmailMessage, EmailThread, ThreadStatus
from app.models.integration import ConnectedIntegrationAccount
from app.models.organization import Organization, OrganizationMember, Role, User
from app.services.followups import triggers

UTC = timezone.utc


def is_local_database() -> bool:
    url = os.environ.get("DATABASE_URL", "")
    return "@localhost" in url or "@127.0.0.1" in url


def R(**over) -> Dict[str, Any]:
    """A complete AI #2 result; override any field (timing / constraints merge)."""
    d: Dict[str, Any] = {
        "temperature": "warm", "label_confidence": 0.8, "buying_interest": 0.5, "sales_relevance": "sales",
        "reason_codes": [], "explanation": "test", "evidence_message_ids": [], "outcome": "open_unconfirmed",
        "next_actor": "customer", "next_action": "Check in", "decision": "none", "matched_opportunity_key": None,
        "opportunities": [],
        "timing": {"kind": "none", "phrase": None, "source_message_id": None, "local_date": None, "local_time": None,
                   "window_end_date": None, "timezone": None, "timezone_evidence": None, "precision": "unknown",
                   "ambiguous": False, "alternatives": [], "internal_reminder_note": None, "cadence_reason": None},
        "constraints": {"refusal_scope": "none", "refusal_until_date": None, "refusal_quote": None,
                        "changed_date": False, "possible_completion": False, "conflicting_evidence": False,
                        "missing_context": False, "uncertainty": "low"},
    }
    for k, v in over.items():
        if k in ("timing", "constraints"):
            d[k] = {**d[k], **v}
        else:
            d[k] = v
    return d


@dataclass
class Spies:
    model_calls: List[str] = field(default_factory=list)
    compose_calls: int = 0
    gmail_calls: List[Dict[str, Any]] = field(default_factory=list)
    team_mail: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class World:
    tenant_id: str
    account_id: str
    mailbox: str
    users: Dict[str, str]                      # label -> user id
    emails: Dict[str, str]                     # label -> email
    scripts: Dict[str, Any] = field(default_factory=dict)
    spies: Spies = field(default_factory=Spies)
    _seq: int = 0

    def script(self, message_id: str, result: Dict[str, Any]) -> None:
        # A correct model cites the message it judged; tests that check the guard pass ids explicitly.
        if isinstance(result, dict) and not result.get("evidence_message_ids"):
            result = {**result, "evidence_message_ids": [message_id]}
        self.scripts[message_id] = result

    async def thread(self, subject: str = "Enquiry", customer: str = "buyer@client.example") -> str:
        tid = f"thr_fu_{uuid.uuid4().hex[:16]}"
        async with db_manager.session_factory() as db:
            db.add(EmailThread(id=tid, tenant_id=self.tenant_id, integration_account_id=self.account_id,
                               external_thread_id=f"ext_{tid}", subject=subject, sender_email=customer,
                               sender_name="Customer", status=ThreadStatus.PENDING_TRIAGE.value, message_count=0,
                               unread_count=0, is_read=False, lead_intent="unknown"))
            await db.commit()
        return tid

    async def msg(self, thread_id: str, direction: str, body: str, at: datetime, *,
                  sender: Optional[str] = None, now: Optional[datetime] = None, trigger: bool = True) -> str:
        """Store a message and run the production ingestion trigger in the SAME transaction."""
        self._seq += 1
        mid = f"msg_fu_{uuid.uuid4().hex[:20]}"
        frm = sender or ("buyer@client.example" if direction == "inbound" else self.mailbox)
        async with db_manager.session_factory() as db:
            db.add(EmailMessage(id=mid, tenant_id=self.tenant_id, thread_id=thread_id,
                                integration_account_id=self.account_id, external_message_id=f"ext_{mid}",
                                direction=direction, from_email=frm, from_name="Someone", to_emails="[]",
                                body_text=body, sent_at=at, filter_reason="ACCEPT",
                                message_id_header=f"<{mid}@test.example>"))
            if trigger:
                await triggers.on_message_stored(db, tenant_id=self.tenant_id, account_id=self.account_id,
                                                 thread_id=thread_id, message_id=mid, sent_at=at, direction=direction,
                                                 from_email=frm, now=now or at + timedelta(minutes=1))
            await db.commit()
        return mid

    async def assess(self, message_id: str, thread_id: str, now: datetime) -> str:
        from app.services.followups.service import process_assessment

        return await process_assessment(tenant_id=self.tenant_id, thread_id=thread_id, message_id=message_id, now=now)

    async def say(self, thread_id: str, direction: str, body: str, at: datetime, result: Dict[str, Any], *,
                  sender: Optional[str] = None) -> str:
        mid = await self.msg(thread_id, direction, body, at, sender=sender)
        self.script(mid, result)
        out = await self.assess(mid, thread_id, at + timedelta(minutes=1))
        assert out.startswith("applied") or out.startswith("not_applied"), out
        return mid

    async def state(self, thread_id: str) -> ThreadFollowupState:
        async with db_manager.session_factory() as db:
            return await db.get(ThreadFollowupState, thread_id)

    async def occurrences(self, thread_id: str) -> List[FollowupOccurrence]:
        async with db_manager.session_factory() as db:
            return list((await db.execute(select(FollowupOccurrence).where(
                FollowupOccurrence.thread_id == thread_id).order_by(FollowupOccurrence.created_at))).scalars().all())

    async def live(self, thread_id: str) -> List[FollowupOccurrence]:
        return [o for o in await self.occurrences(thread_id) if o.status == "scheduled"]

    async def sql(self, q: str, **params) -> List[Any]:
        async with db_manager.session_factory() as db:
            return list((await db.execute(text(q), params)).all())


async def build_world(tag: str, *, org_tz: str = "Asia/Kolkata (GMT +5:30)", mode: str = "active",
                      customer_email_allowed: bool = True) -> World:
    from app.core.rbac_seed import ensure_system_rbac

    db_manager.initialize()
    tenant = f"org_fu_{tag}"
    account = f"int_fu_{tag}"
    mailbox = f"sales-{tag}@seller.example"
    users: Dict[str, str] = {}
    emails: Dict[str, str] = {}
    async with db_manager.session_factory() as db:
        await ensure_system_rbac(db)
        await db.commit()
        roles = {r.name: r.id for r in (await db.execute(select(Role).where(Role.is_system_role.is_(True)))).scalars()}
        viewer_role = f"rol_fu_view_{tag}"
        db.add(Organization(id=tenant, name=f"Followup Test {tag}", slug=f"fu-{tag}", timezone=org_tz))
        await db.flush()
        db.add(Role(id=viewer_role, name="Viewer (no inbox)", is_system_role=False, organization_id=tenant))
        for label, role, status in (("owner", "OWNER", "ACTIVE"), ("admin", "ADMIN", "ACTIVE"),
                                    ("member", "MEMBER", "ACTIVE"), ("viewer", None, "ACTIVE"),
                                    ("removed", "MEMBER", "REMOVED"), ("invited", "MEMBER", "INVITED"),
                                    ("suspended", "MEMBER", "SUSPENDED")):
            uid = f"usr_fu_{label}_{tag}"
            email = f"{label}-{tag}@team.example"
            users[label], emails[label] = uid, email
            db.add(User(id=uid, email=email, hashed_password="x", full_name=label.title(), is_active=True,
                        is_verified=True))
            await db.flush()
            db.add(OrganizationMember(organization_id=tenant, user_id=uid,
                                      role_id=roles[role] if role else viewer_role, status=status))
        from app.models.followup import FollowupPolicy
        db.add(FollowupPolicy(tenant_id=tenant, mode=mode, customer_email_allowed=customer_email_allowed))
        db.add(ConnectedIntegrationAccount(id=account, tenant_id=tenant, provider="gmail", email_address=mailbox,
                                           display_name="Sales", status="active", connection_status="healthy",
                                           sync_enabled=False, automation_enabled=True))
        await db.commit()
    return World(tenant_id=tenant, account_id=account, mailbox=mailbox, users=users, emails=emails)


async def destroy_world(w: World) -> None:
    from tests.conftest import purge_tenant

    await purge_tenant(w.tenant_id)
    async with db_manager.session_factory() as db:
        await db.execute(text("DELETE FROM organization_members WHERE organization_id = :t"), {"t": w.tenant_id})
        await db.execute(text("DELETE FROM roles WHERE organization_id = :t"), {"t": w.tenant_id})
        await db.execute(text("DELETE FROM organizations WHERE id = :t"), {"t": w.tenant_id})
        await db.execute(text("DELETE FROM users WHERE id = ANY(:u)"), {"u": list(w.users.values())})
        await db.commit()
