"""Contact & Relationship Memory service (Memory 4).

Responsibilities
----------------
1. Interaction capture (deterministic, no LLM): every stored email updates the
   counterpart contacts in ONE idempotent ``INSERT … ON CONFLICT`` statement.
   Called only after the email row was newly inserted, so retries never double count.
2. Exact recomputation: ``rebuild_stats`` re-derives every contact's statistics from
   ``email_messages`` (the source of truth) — used for backfill and drift repair.
3. Fact memory with provenance: ``upsert_fact`` de-duplicates, supersedes older values
   of single-valued keys (keeping history) and applies source authority
   (employee > email > AI inference), so AI can never overwrite a human-confirmed fact.
4. AI insight capture: ``record_ai_insights`` stores intent / product interests /
   lead temperature from the AI pipeline's structured outputs (no extra model call).
5. Recall: ``get_profile`` (API) and ``build_prompt_context`` (reply drafting) return
   a bounded, ranked view of everything known about the contact.

Failure policy: memory capture is best-effort and must never block or fail email
ingestion or reply generation — every public capture/recall entry point catches,
logs, and returns a neutral value.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.logging import logger
from app.models.contact import (
    FACT_SOURCE_AUTHORITY,
    Contact,
    ContactFact,
    ContactFactSource,
    ContactFactStatus,
    ContactFactType,
    ContactType,
)

_EMAIL_RE = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
_ANGLE_RE = re.compile(r"<([^>]+)>")

# Automated senders never become relationship memory.
_SYSTEM_LOCALPARTS = frozenset({
    "no-reply", "noreply", "do-not-reply", "donotreply", "mailer-daemon", "postmaster",
    "notifications", "notification", "bounce", "bounces", "alerts", "newsletter",
})
# Free-mail domains are shared by unrelated people: never infer "internal" from them.
_PUBLIC_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
    "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
    "rediffmail.com", "zoho.com", "gmx.com", "yandex.com",
}

SINGLE_VALUED_TYPES = {ContactFactType.ATTRIBUTE.value, ContactFactType.PREFERENCE.value}
MAX_ACTIVE_MULTI_FACTS_PER_KEY = 25
PROMPT_CONTEXT_MAX_CHARS = 900


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------


def normalize_email(raw: Optional[str]) -> Optional[str]:
    """Lower-cased bare address, or None if invalid / automated."""
    if not raw:
        return None
    s = raw.strip()
    m = _ANGLE_RE.search(s)
    if m:
        s = m.group(1)
    s = s.strip().strip('"').lower()
    if len(s) > 320 or not _EMAIL_RE.match(s):
        return None
    local = s.split("@", 1)[0].split("+", 1)[0]
    # Automated if the whole local part, or any -._ separated segment of it, is a
    # system token: "noreply", "googleplay-noreply", "no.reply", "alerts_bot" …
    collapsed = re.sub(r"[-._]", "", local)
    segments = set(re.split(r"[-._]", local))
    if (
        local in _SYSTEM_LOCALPARTS
        or collapsed in {re.sub(r"[-._]", "", p) for p in _SYSTEM_LOCALPARTS}
        or segments & _SYSTEM_LOCALPARTS
    ):
        return None
    return s


def email_domain(email: str) -> str:
    return email.split("@", 1)[1] if "@" in email else ""


def normalize_value(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())[:512]


def _counterparts(
    direction: str,
    from_email: Optional[str],
    from_name: Optional[str],
    to_emails: Sequence[str],
    cc_emails: Sequence[str],
    own_emails: Iterable[str],
) -> List[Tuple[str, Optional[str]]]:
    """External parties of a message: sender for inbound, recipients for outbound."""
    own = {e for e in (normalize_email(x) for x in own_emails) if e}
    out: Dict[str, Optional[str]] = {}
    if direction == "inbound":
        e = normalize_email(from_email)
        if e and e not in own:
            out[e] = (from_name or None)
    else:
        for raw in list(to_emails or []) + list(cc_emails or []):
            e = normalize_email(raw)
            if e and e not in own and e not in out:
                out[e] = None
    return list(out.items())


def _initial_type(email: str, own_emails: Iterable[str]) -> str:
    domain = email_domain(email)
    own_domains = {email_domain(e.lower()) for e in own_emails if e and "@" in e}
    if domain and domain not in _PUBLIC_DOMAINS and domain in own_domains:
        return ContactType.INTERNAL.value
    return ContactType.UNKNOWN.value


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ContactMemoryService:
    PROMPT_CONTEXT_TIMEOUT_SECONDS = 6.0

    # -- 1. Interaction capture ------------------------------------------------

    async def record_message_interaction(
        self,
        tenant_id: str,
        direction: str,
        from_email: Optional[str],
        from_name: Optional[str],
        to_emails: Optional[Sequence[str]],
        cc_emails: Optional[Sequence[str]],
        sent_at: Optional[datetime],
        own_emails: Iterable[str] = (),
        db: Optional[AsyncSession] = None,
    ) -> int:
        """Upsert counterpart contacts for one newly stored message. Never raises."""
        try:
            own_list = [e for e in own_emails if e]
            parties = _counterparts(direction, from_email, from_name, to_emails or [], cc_emails or [], own_list)
            if not parties:
                return 0
            when = sent_at or datetime.now(timezone.utc)
            inbound = direction == "inbound"
            rows = [
                {
                    "tenant_id": tenant_id,
                    "email": email,
                    "display_name": (name or "")[:255] or None,
                    "domain": email_domain(email)[:255] or None,
                    "contact_type": _initial_type(email, own_list),
                    "inbound_count": 1 if inbound else 0,
                    "outbound_count": 0 if inbound else 1,
                    "first_interaction_at": when,
                    "last_interaction_at": when,
                    "last_inbound_at": when if inbound else None,
                    "last_outbound_at": None if inbound else when,
                }
                for email, name in parties
            ]
            stmt = pg_insert(Contact).values(rows)
            ex = stmt.excluded
            stmt = stmt.on_conflict_do_update(
                constraint="uq_contacts_tenant_email",
                set_={
                    "display_name": func.coalesce(ex.display_name, Contact.display_name),
                    "inbound_count": Contact.inbound_count + ex.inbound_count,
                    "outbound_count": Contact.outbound_count + ex.outbound_count,
                    "first_interaction_at": func.least(Contact.first_interaction_at, ex.first_interaction_at),
                    "last_interaction_at": func.greatest(Contact.last_interaction_at, ex.last_interaction_at),
                    "last_inbound_at": func.greatest(Contact.last_inbound_at, ex.last_inbound_at),
                    "last_outbound_at": func.greatest(Contact.last_outbound_at, ex.last_outbound_at),
                    "updated_at": func.now(),
                },
            )
            if db is not None:
                await db.execute(stmt)
            else:
                async with db_manager.session_factory() as own_db:
                    await own_db.execute(stmt)
                    await own_db.commit()
            return len(rows)
        except Exception as err:
            logger.warning(
                "contact_memory.interaction_capture_failed",
                tenant_id=tenant_id, direction=direction, error=str(err)[:300],
            )
            return 0

    # -- 2. Exact recomputation ------------------------------------------------

    async def rebuild_stats(self, tenant_id: str) -> Dict[str, int]:
        """Recompute every contact's statistics for a tenant from email_messages."""
        async with db_manager.session_factory() as db:
            own = (await db.execute(text(
                "SELECT email_address FROM connected_integration_accounts WHERE tenant_id = :t"
            ), {"t": tenant_id})).scalars().all()
            own_list = [e for e in own if e]

            inbound = (await db.execute(text("""
                SELECT lower(trim(from_email)) AS email,
                       (array_agg(from_name ORDER BY sent_at DESC) FILTER (WHERE from_name IS NOT NULL))[1] AS name,
                       count(*) AS n, min(sent_at) AS first_at, max(sent_at) AS last_at
                FROM email_messages
                WHERE tenant_id = :t AND direction = 'inbound'
                GROUP BY 1
            """), {"t": tenant_id})).all()
            outbound = (await db.execute(text("""
                SELECT lower(trim(addr)) AS email, count(*) AS n, min(sent_at) AS first_at, max(sent_at) AS last_at
                FROM email_messages m,
                     LATERAL jsonb_array_elements_text(
                         coalesce(m.to_emails, '[]')::jsonb || coalesce(m.cc_emails, '[]')::jsonb
                     ) AS addr
                WHERE m.tenant_id = :t AND m.direction = 'outbound'
                GROUP BY 1
            """), {"t": tenant_id})).all()

            agg: Dict[str, Dict[str, Any]] = {}
            own_norm = {normalize_email(e) for e in own_list}
            for r in inbound:
                e = normalize_email(r.email)
                if not e or e in own_norm:
                    continue
                a = agg.setdefault(e, {"name": None, "in": 0, "out": 0, "first": None, "last": None, "lin": None, "lout": None})
                a["name"], a["in"], a["lin"] = r.name, r.n, r.last_at
                a["first"], a["last"] = r.first_at, r.last_at
            for r in outbound:
                e = normalize_email(r.email)
                if not e or e in own_norm:
                    continue
                a = agg.setdefault(e, {"name": None, "in": 0, "out": 0, "first": None, "last": None, "lin": None, "lout": None})
                a["out"], a["lout"] = r.n, r.last_at
                a["first"] = min(x for x in (a["first"], r.first_at) if x) if (a["first"] or r.first_at) else None
                a["last"] = max(x for x in (a["last"], r.last_at) if x) if (a["last"] or r.last_at) else None

            if not agg:
                return {"contacts": 0}
            rows = [
                {
                    "tenant_id": tenant_id, "email": e, "display_name": (a["name"] or "")[:255] or None,
                    "domain": email_domain(e)[:255] or None, "contact_type": _initial_type(e, own_list),
                    "inbound_count": a["in"], "outbound_count": a["out"],
                    "first_interaction_at": a["first"], "last_interaction_at": a["last"],
                    "last_inbound_at": a["lin"], "last_outbound_at": a["lout"],
                }
                for e, a in agg.items()
            ]
            stmt = pg_insert(Contact).values(rows)
            ex = stmt.excluded
            stmt = stmt.on_conflict_do_update(
                constraint="uq_contacts_tenant_email",
                set_={  # exact values (not increments): recomputation is authoritative
                    "display_name": func.coalesce(Contact.display_name, ex.display_name),
                    "inbound_count": ex.inbound_count,
                    "outbound_count": ex.outbound_count,
                    "first_interaction_at": ex.first_interaction_at,
                    "last_interaction_at": ex.last_interaction_at,
                    "last_inbound_at": ex.last_inbound_at,
                    "last_outbound_at": ex.last_outbound_at,
                    "updated_at": func.now(),
                },
            )
            await db.execute(stmt)
            await db.commit()
            logger.info("contact_memory.rebuild_completed", tenant_id=tenant_id, contacts=len(rows))
            return {"contacts": len(rows)}

    # -- 3. Fact memory ----------------------------------------------------------

    async def upsert_fact(
        self,
        db: AsyncSession,
        tenant_id: str,
        contact_id: str,
        fact_type: str,
        key: str,
        value: str,
        source_type: str,
        confidence: float = 1.0,
        source_ref: Optional[str] = None,
        created_by_user_id: Optional[str] = None,
    ) -> Optional[ContactFact]:
        """Insert or reinforce a fact with de-duplication, supersession and authority.

        Returns the active fact representing this information (new or existing), or
        None when the new value was rejected because a higher-authority fact holds the key.
        Caller commits.
        """
        value = (value or "").strip()
        key = (key or "").strip().lower()[:128]
        if not value or not key:
            return None
        if fact_type not in {t.value for t in ContactFactType}:
            raise ValueError(f"Unknown contact fact_type '{fact_type}'")
        if source_type not in FACT_SOURCE_AUTHORITY:
            raise ValueError(f"Unknown contact fact source_type '{source_type}'")
        norm = normalize_value(value)
        now = datetime.now(timezone.utc)
        new_auth = FACT_SOURCE_AUTHORITY[source_type]

        active = list((await db.execute(
            select(ContactFact).where(
                ContactFact.tenant_id == tenant_id,
                ContactFact.contact_id == contact_id,
                ContactFact.key == key,
                ContactFact.status == ContactFactStatus.ACTIVE.value,
            ).order_by(ContactFact.observed_at.desc())
        )).scalars().all())

        same = next((f for f in active if f.value_normalized == norm), None)
        if same is not None:
            # Reinforcement: same information seen again.
            same.occurrences = (same.occurrences or 1) + 1
            same.observed_at = now
            same.confidence = max(same.confidence or 0.0, confidence)
            if new_auth > FACT_SOURCE_AUTHORITY.get(same.source_type, 0):
                same.source_type, same.source_ref = source_type, source_ref
                same.created_by_user_id = created_by_user_id or same.created_by_user_id
            return same

        fact = ContactFact(
            tenant_id=tenant_id, contact_id=contact_id, fact_type=fact_type, key=key,
            value=value[:4000], value_normalized=norm, confidence=confidence,
            source_type=source_type, source_ref=(source_ref or None) and source_ref[:128],
            status=ContactFactStatus.ACTIVE.value, observed_at=now, occurrences=1,
            created_by_user_id=created_by_user_id,
        )

        if fact_type in SINGLE_VALUED_TYPES:
            stronger = [f for f in active if FACT_SOURCE_AUTHORITY.get(f.source_type, 0) > new_auth]
            if stronger:
                logger.info(
                    "contact_memory.fact_rejected_lower_authority",
                    contact_id=contact_id, key=key, held_by=stronger[0].source_type, offered_by=source_type,
                )
                return None
            db.add(fact)
            await db.flush()
            for old in active:
                old.status = ContactFactStatus.SUPERSEDED.value
                old.superseded_by_id = fact.id
            return fact

        # Multi-valued (interest / need / issue / note): keep a bounded active set.
        db.add(fact)
        await db.flush()
        overflow = active[MAX_ACTIVE_MULTI_FACTS_PER_KEY - 1:]
        for old in overflow:
            if old.source_type != ContactFactSource.EMPLOYEE.value:
                old.status = ContactFactStatus.SUPERSEDED.value
                old.superseded_by_id = fact.id
        return fact

    async def get_or_create_contact(
        self, db: AsyncSession, tenant_id: str, email: str, display_name: Optional[str] = None
    ) -> Optional[Contact]:
        e = normalize_email(email)
        if not e:
            return None
        stmt = pg_insert(Contact).values(
            tenant_id=tenant_id, email=e, display_name=(display_name or "")[:255] or None,
            domain=email_domain(e)[:255] or None, contact_type=ContactType.UNKNOWN.value,
        ).on_conflict_do_nothing(constraint="uq_contacts_tenant_email")
        await db.execute(stmt)
        return (await db.execute(
            select(Contact).where(Contact.tenant_id == tenant_id, Contact.email == e)
        )).scalar_one_or_none()

    # -- 4. AI insight capture ----------------------------------------------------

    async def record_ai_insights(
        self,
        tenant_id: str,
        message_id: str,
        intent: Optional[str] = None,
        interests: Sequence[str] = (),
        lead_temperature: Optional[str] = None,
    ) -> int:
        """Store structured AI outputs about the sender of ``message_id``. Never raises."""
        try:
            async with db_manager.session_factory() as db:
                row = (await db.execute(text(
                    "SELECT from_email, from_name, direction FROM email_messages "
                    "WHERE id = :m AND tenant_id = :t"
                ), {"m": message_id, "t": tenant_id})).first()
                if row is None or row.direction != "inbound":
                    return 0
                contact = await self.get_or_create_contact(db, tenant_id, row.from_email, row.from_name)
                if contact is None:
                    return 0
                written = 0
                if intent:
                    contact.last_intent = intent[:64]
                    if await self.upsert_fact(
                        db, tenant_id, contact.id, ContactFactType.ATTRIBUTE.value, "last_intent",
                        intent, ContactFactSource.AI_INFERENCE.value, 0.8, message_id,
                    ):
                        written += 1
                if lead_temperature:
                    contact.lead_temperature = lead_temperature[:16]
                for title in list(dict.fromkeys(t for t in interests if t))[:5]:
                    if await self.upsert_fact(
                        db, tenant_id, contact.id, ContactFactType.INTEREST.value, "product_interest",
                        title, ContactFactSource.AI_INFERENCE.value, 0.7, message_id,
                    ):
                        written += 1
                if contact.contact_type == ContactType.UNKNOWN.value and not contact.type_locked and interests:
                    contact.contact_type = ContactType.PROSPECT.value
                await db.commit()
                return written
        except Exception as err:
            logger.warning(
                "contact_memory.ai_insight_capture_failed",
                tenant_id=tenant_id, message_id=message_id, error=str(err)[:300],
            )
            return 0

    # -- 5. Recall ----------------------------------------------------------------

    async def get_profile(
        self, db: AsyncSession, tenant_id: str, contact_id: Optional[str] = None, email: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        stmt = select(Contact).where(Contact.tenant_id == tenant_id)
        if contact_id:
            stmt = stmt.where(Contact.id == contact_id)
        elif email and normalize_email(email):
            stmt = stmt.where(Contact.email == normalize_email(email))
        else:
            return None
        contact = (await db.execute(stmt)).scalar_one_or_none()
        if contact is None:
            return None

        facts = list((await db.execute(
            select(ContactFact).where(
                ContactFact.tenant_id == tenant_id,
                ContactFact.contact_id == contact.id,
                ContactFact.status == ContactFactStatus.ACTIVE.value,
            ).order_by(ContactFact.observed_at.desc()).limit(200)
        )).scalars().all())
        threads = (await db.execute(text("""
            SELECT id, subject, latest_message_at, status
            FROM email_threads
            WHERE tenant_id = :t AND lower(sender_email) = :e
            ORDER BY latest_message_at DESC NULLS LAST
            LIMIT 5
        """), {"t": tenant_id, "e": contact.email})).all()
        thread_count = (await db.execute(text(
            "SELECT count(*) FROM email_threads WHERE tenant_id = :t AND lower(sender_email) = :e"
        ), {"t": tenant_id, "e": contact.email})).scalar() or 0

        def _rank(f: ContactFact) -> Tuple[int, float, int]:
            return (FACT_SOURCE_AUTHORITY.get(f.source_type, 0), f.confidence or 0.0, f.occurrences or 1)

        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for f in sorted(facts, key=_rank, reverse=True):
            grouped.setdefault(f.fact_type, []).append({
                "id": f.id, "key": f.key, "value": f.value, "confidence": f.confidence,
                "source_type": f.source_type, "occurrences": f.occurrences,
                "observed_at": f.observed_at.isoformat() if f.observed_at else None,
            })

        return {
            "id": contact.id,
            "email": contact.email,
            "display_name": contact.display_name,
            "domain": contact.domain,
            "contact_type": contact.contact_type,
            "type_locked": contact.type_locked,
            "company_name": contact.company_name,
            "job_title": contact.job_title,
            "phone": contact.phone,
            "preferred_language": contact.preferred_language,
            "tags": contact.tags,
            "lead_temperature": contact.lead_temperature,
            "last_intent": contact.last_intent,
            "is_blocked": contact.is_blocked,
            "stats": {
                "inbound_count": contact.inbound_count,
                "outbound_count": contact.outbound_count,
                "thread_count": int(thread_count),
                "first_interaction_at": contact.first_interaction_at.isoformat() if contact.first_interaction_at else None,
                "last_interaction_at": contact.last_interaction_at.isoformat() if contact.last_interaction_at else None,
                "last_inbound_at": contact.last_inbound_at.isoformat() if contact.last_inbound_at else None,
                "last_outbound_at": contact.last_outbound_at.isoformat() if contact.last_outbound_at else None,
            },
            "facts": grouped,
            "recent_threads": [
                {"id": t.id, "subject": t.subject, "status": t.status,
                 "latest_message_at": t.latest_message_at.isoformat() if t.latest_message_at else None}
                for t in threads
            ],
        }

    @staticmethod
    def format_prompt_context(profile: Dict[str, Any], now: Optional[datetime] = None) -> str:
        """Compact, bounded recipient context for the reply drafter."""
        now = now or datetime.now(timezone.utc)
        lines: List[str] = []
        who = profile.get("display_name") or profile["email"]
        ident = [f"Name: {who}"]
        if profile.get("contact_type") and profile["contact_type"] != ContactType.UNKNOWN.value:
            ident.append(f"Relationship: {profile['contact_type']}")
        if profile.get("company_name"):
            ident.append(f"Company: {profile['company_name']}")
        if profile.get("job_title"):
            ident.append(f"Role: {profile['job_title']}")
        lines.append("- " + " | ".join(ident))

        st = profile.get("stats") or {}
        total = (st.get("inbound_count") or 0) + (st.get("outbound_count") or 0)
        if total:
            first = (st.get("first_interaction_at") or "")[:10]
            history = f"- History: {total} emails exchanged across {st.get('thread_count', 0)} conversations"
            if first:
                history += f" since {first}"
            if total <= 1:
                history = "- History: first-time contact"
            lines.append(history)
        if profile.get("preferred_language"):
            lines.append(f"- Preferred language: {profile['preferred_language']}")

        facts = profile.get("facts") or {}
        labels = [
            (ContactFactType.PREFERENCE.value, "Preferences"),
            (ContactFactType.NEED.value, "Stated needs"),
            (ContactFactType.ISSUE.value, "Open issues"),
            (ContactFactType.INTEREST.value, "Previously asked about"),
            (ContactFactType.NOTE.value, "Team notes"),
        ]
        for ftype, label in labels:
            items = facts.get(ftype) or []
            if not items:
                continue
            vals = [
                (f"{i['key'].replace('_', ' ')}: {i['value']}" if ftype == ContactFactType.PREFERENCE.value else i["value"])
                for i in items[:5]
            ]
            lines.append(f"- {label}: " + "; ".join(v.strip()[:160] for v in vals))

        text_out = "\n".join(lines)
        if len(text_out) > PROMPT_CONTEXT_MAX_CHARS:
            text_out = text_out[: PROMPT_CONTEXT_MAX_CHARS - 3].rsplit("\n", 1)[0] + "\n..."
        return text_out

    async def build_prompt_context(self, tenant_id: str, message_id: str) -> Optional[str]:
        """Recipient context for drafting a reply to ``message_id``. Never raises; bounded time."""
        async def _load() -> Optional[str]:
            # Lean read path for the drafting hot path: 2 statements instead of 5.
            async with db_manager.session_factory() as db:
                c = (await db.execute(text("""
                    SELECT c.id, c.email, c.display_name, c.contact_type, c.company_name, c.job_title,
                           c.preferred_language, c.is_blocked, c.inbound_count, c.outbound_count,
                           c.first_interaction_at,
                           (SELECT count(*) FROM email_threads th
                             WHERE th.tenant_id = c.tenant_id AND lower(th.sender_email) = c.email) AS thread_count
                    FROM email_messages m
                    JOIN contacts c ON c.tenant_id = m.tenant_id AND c.email = lower(trim(m.from_email))
                    WHERE m.id = :m AND m.tenant_id = :t
                """), {"m": message_id, "t": tenant_id})).first()
                if c is None or c.is_blocked:
                    return None
                facts = (await db.execute(text("""
                    SELECT fact_type, key, value, source_type, confidence, occurrences
                    FROM contact_facts
                    WHERE tenant_id = :t AND contact_id = :c AND status = 'active'
                    ORDER BY observed_at DESC
                    LIMIT 60
                """), {"t": tenant_id, "c": c.id})).all()
            grouped: Dict[str, List[Dict[str, Any]]] = {}
            for f in sorted(
                facts,
                key=lambda f: (FACT_SOURCE_AUTHORITY.get(f.source_type, 0), f.confidence or 0.0, f.occurrences or 1),
                reverse=True,
            ):
                grouped.setdefault(f.fact_type, []).append({"key": f.key, "value": f.value})
            profile = {
                "email": c.email, "display_name": c.display_name, "contact_type": c.contact_type,
                "company_name": c.company_name, "job_title": c.job_title,
                "preferred_language": c.preferred_language, "facts": grouped,
                "stats": {
                    "inbound_count": c.inbound_count, "outbound_count": c.outbound_count,
                    "thread_count": int(c.thread_count or 0),
                    "first_interaction_at": c.first_interaction_at.isoformat() if c.first_interaction_at else None,
                },
            }
            return self.format_prompt_context(profile)

        try:
            return await asyncio.wait_for(_load(), timeout=self.PROMPT_CONTEXT_TIMEOUT_SECONDS)
        except Exception as err:
            logger.warning(
                "contact_memory.prompt_context_unavailable",
                tenant_id=tenant_id, message_id=message_id,
                error="timeout" if isinstance(err, asyncio.TimeoutError) else str(err)[:200],
            )
            return None


contact_memory_service = ContactMemoryService()
