"""Dashboard overview: every number on the overview screen, computed from the tenant's own data.

Nothing here is estimated or hardcoded. A metric with no underlying data is returned as ``None``
(the UI shows "—"), never as a placeholder value.

Windows: the last ``days`` days (default 7) and the ``days`` before that, for trends.
One SQL round trip for the counters (the database link is high latency), one for recent activity.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

# Same definition as the inbox / draft endpoints: what counts as a real customer conversation.
_BUSINESS = "coalesce(m.filter_reason, 'BUSINESS_CONVERSATION') IN ('BUSINESS_CONVERSATION', 'AMBIGUOUS', 'ACCEPT')"

_COUNTERS_SQL = text(f"""
WITH inbound AS (
    SELECT m.id, m.thread_id, m.sent_at
    FROM email_messages m
    WHERE m.tenant_id = :t AND m.direction = 'inbound' AND {_BUSINESS} AND m.sent_at >= :prev_start
),
first_reply AS (
    SELECT i.sent_at AS received_at,
           (SELECT min(o.sent_at) FROM email_messages o
             WHERE o.tenant_id = :t AND o.thread_id = i.thread_id AND o.direction = 'outbound'
               AND o.sent_at > i.sent_at) AS replied_at
    FROM inbound i WHERE i.sent_at >= :start
)
SELECT
    (SELECT count(*) FROM inbound WHERE sent_at >= :start)                                   AS inbound_now,
    (SELECT count(*) FROM inbound WHERE sent_at < :start)                                    AS inbound_prev,
    (SELECT count(*) FROM ai_responses r WHERE r.tenant_id = :t AND r.created_at >= :start)   AS drafts_now,
    (SELECT count(*) FROM ai_responses r WHERE r.tenant_id = :t AND r.approval_status = 'pending_review') AS pending_review,
    (SELECT count(*) FROM outbound_messages o WHERE o.tenant_id = :t AND nullif(o.sent_at, '')::timestamptz >= :start
        AND o.ai_response_id IS NOT NULL)                                                     AS ai_replies_sent,
    (SELECT count(*) FROM outbound_messages o WHERE o.tenant_id = :t AND nullif(o.sent_at, '')::timestamptz >= :start
        AND o.ai_response_id IS NOT NULL AND o.sent_by_user_id IS NULL)                       AS auto_sent,
    (SELECT avg(extract(epoch FROM (replied_at - received_at))) FROM first_reply
        WHERE replied_at IS NOT NULL)                                                         AS avg_first_reply_s,
    (SELECT count(*) FROM first_reply WHERE replied_at IS NOT NULL)                           AS replied_count,
    (SELECT avg(a.duration_ms) FROM ai_runs a WHERE a.tenant_id = :t AND a.created_at >= :start
        AND a.duration_ms IS NOT NULL AND a.duration_ms > 0)                                  AS avg_ai_ms,
    (SELECT count(*) FROM knowledge_items k WHERE k.tenant_id = :t AND k.is_active)          AS knowledge_items,
    -- Knowledge the business added itself, per category (the registration-built Company Info
    -- record is excluded; its editor facts are judged from company_info_profiles below).
    (SELECT coalesce(json_object_agg(x.category, x.n), '{{}}'::json) FROM (
        SELECT k.category, count(*) AS n FROM knowledge_items k
        WHERE k.tenant_id = :t AND k.is_active
          AND NOT (k.category = 'company_info' AND k.external_identity_key = 'company_profile')
        GROUP BY k.category) x)                                                               AS knowledge_by_category,
    (SELECT p.facts FROM company_info_profiles p WHERE p.tenant_id = :t)                      AS company_info_facts,
    (SELECT count(*) FROM connected_integration_accounts c WHERE c.tenant_id = :t
        AND c.status <> 'disconnected')                           AS mailboxes
""")

_RECENT_SQL = text(f"""
SELECT th.id AS thread_id, th.subject, th.sender_name, th.sender_email, th.latest_message_at,
       (SELECT r.approval_status FROM ai_responses r WHERE r.tenant_id = th.tenant_id AND r.thread_id = th.id
         ORDER BY r.created_at DESC LIMIT 1) AS draft_status,
       (SELECT max(m.sent_at) FROM email_messages m WHERE m.tenant_id = th.tenant_id AND m.thread_id = th.id
         AND m.direction = 'outbound') AS last_reply_at,
       (SELECT max(m.sent_at) FROM email_messages m WHERE m.tenant_id = th.tenant_id AND m.thread_id = th.id
         AND m.direction = 'inbound' AND {_BUSINESS}) AS last_inbound_at
FROM email_threads th
WHERE th.tenant_id = :t AND th.latest_message_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM email_messages m WHERE m.tenant_id = th.tenant_id AND m.thread_id = th.id
              AND m.direction = 'inbound' AND {_BUSINESS})
ORDER BY th.latest_message_at DESC
LIMIT :n
""")


# Business knowledge is "set up" once the catalogue is in and at least one more category has data:
# replies about products need the catalogue, and a catalogue alone cannot answer policy / process /
# company questions. Registration data alone never counts — the business must add its own.
KNOWLEDGE_REQUIRED_CATEGORY = "products_services"
KNOWLEDGE_MIN_CATEGORIES = 2
_COMPANY_FACT_DEFAULTS = {"visit_policy": "unknown"}


def _company_info_has_user_facts(facts: Any) -> bool:
    """True when the Company Info editor holds facts the business entered (not just defaults)."""
    if not isinstance(facts, dict):
        return False
    for key, value in facts.items():
        if key == "not_applicable" or _COMPANY_FACT_DEFAULTS.get(key) == value:
            continue
        if value not in (None, "", [], {}):
            return True
    return False


def knowledge_setup(by_category: Dict[str, int], company_info_facts: Any = None) -> Dict[str, Any]:
    """Setup state of the business's own knowledge (pure; the dashboard checklist reads this)."""
    items = {str(k): int(v) for k, v in (by_category or {}).items() if int(v or 0) > 0}
    counts = dict(items)
    if _company_info_has_user_facts(company_info_facts):
        counts["company_info"] = max(counts.get("company_info", 0), 1)
    filled = sorted(counts)
    has_required = counts.get(KNOWLEDGE_REQUIRED_CATEGORY, 0) > 0
    ready = has_required and len(filled) >= KNOWLEDGE_MIN_CATEGORIES
    if ready:
        next_step = None
    elif not has_required:
        next_step = "add_products_services"
    else:
        next_step = "add_another_category"
    return {
        "by_category": counts,
        "user_items": sum(items.values()),   # knowledge items the business added (rows, not flags)
        "categories_with_data": filled,
        "required_category": KNOWLEDGE_REQUIRED_CATEGORY,
        "has_required_category": has_required,
        "min_categories": KNOWLEDGE_MIN_CATEGORIES,
        "ready": ready,
        "next_step": next_step,
    }


def _pct_change(now: int, prev: int) -> Optional[float]:
    """Week-over-week change; None when there is no previous period to compare with."""
    if prev <= 0:
        return None
    return round((now - prev) / prev * 100.0, 1)


def _activity_status(row: Any) -> str:
    """Plain-language state of a conversation, derived from its messages and latest AI draft."""
    replied = row.last_reply_at is not None and (row.last_inbound_at is None or row.last_reply_at >= row.last_inbound_at)
    if replied:
        return "replied"
    if row.draft_status == "pending_review":
        return "draft_ready"
    if row.draft_status in ("auto_approved", "human_approved"):
        return "sending"
    if row.draft_status == "rejected":
        return "needs_reply"
    return "awaiting_ai"


async def build_overview(db: AsyncSession, tenant_id: str, days: int = 7, recent: int = 5) -> Dict[str, Any]:
    days = max(1, min(int(days), 90))
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    c = (await db.execute(_COUNTERS_SQL, {"t": tenant_id, "start": start, "prev_start": prev_start})).one()
    rows = (await db.execute(_RECENT_SQL, {"t": tenant_id, "n": max(1, min(recent, 20))})).all()

    # Draft approval: same definition as /feedback/metrics (reviewed drafts approved without edits).
    from app.services.feedback_memory import feedback_memory_service

    feedback = await feedback_memory_service.metrics(db, tenant_id, days)

    inbound_now, inbound_prev = int(c.inbound_now or 0), int(c.inbound_prev or 0)
    ai_replies = int(c.ai_replies_sent or 0)
    return {
        "window_days": days,
        "generated_at": now.isoformat(),
        "inbound": {"count": inbound_now, "previous": inbound_prev, "change_pct": _pct_change(inbound_now, inbound_prev)},
        "ai": {
            "drafts_generated": int(c.drafts_now or 0),
            "replies_sent": ai_replies,
            "auto_sent": int(c.auto_sent or 0),
            # Share of customer emails in the window answered with an AI-drafted reply.
            "reply_coverage_pct": round(ai_replies / inbound_now * 100.0, 1) if inbound_now else None,
            "approval_rate": feedback.get("approval_rate"),
            "edit_rate": feedback.get("edit_rate"),
            "drafts_reviewed": feedback.get("drafts_reviewed", 0),
            "avg_processing_seconds": round(float(c.avg_ai_ms) / 1000.0, 1) if c.avg_ai_ms else None,
            "model": get_settings().llm.openai_model,
        },
        "needs_attention": {"pending_review": int(c.pending_review or 0)},
        "response_time": {
            "avg_first_reply_minutes": round(float(c.avg_first_reply_s) / 60.0, 1) if c.avg_first_reply_s else None,
            "replied_conversations": int(c.replied_count or 0),
        },
        "workspace": {"knowledge_items": int(c.knowledge_items or 0), "mailboxes": int(c.mailboxes or 0)},
        "knowledge": knowledge_setup(dict(c.knowledge_by_category or {}), c.company_info_facts),
        "recent_activity": [
            {
                "thread_id": r.thread_id,
                "subject": r.subject or "(no subject)",
                "contact": r.sender_name or r.sender_email,
                "at": r.latest_message_at.isoformat() if hasattr(r.latest_message_at, "isoformat") else r.latest_message_at,
                "status": _activity_status(r),
            }
            for r in rows
        ],
    }
