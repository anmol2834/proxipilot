"""Conversation selection state: which already-presented item the customer has chosen.

Why
---
After the system lists options, customers pick one ("okay, I want the automatic industrial jet hand
dryer") and then continue about it ("how do I order?", "5 qty and best discount"). Without an explicit
selection the planner treated the pick as "more options" (excluding every presented item, including
the chosen one) and every follow-up re-ran catalogue discovery, so replies kept listing other products.

How (business-agnostic)
-----------------------
The items already sent to this customer are recorded per thread (``ThreadPresentedEntity``). A
customer message selects item X when it names X by its *distinguishing* words: the title tokens that
are not shared by every presented item ("automatic industrial" vs "black abs" vs "mini"), or by its
exact code. Words common to all options ("hand dryer") select nothing. No product, category or phrase
is hardcoded: the vocabulary comes from what this tenant's own replies presented.

The active selection is the latest customer message (current one included) that selects an item.
Asking for alternatives in a message that names no presented item clears it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import text

from app.core.logging import logger

_WORD = re.compile(r"[a-z0-9]+(?:[-/.][a-z0-9]+)*")
_STOP = set(
    "a an and any are as at be by can could do does for from get give have i if in into is it its me my "
    "of on or our please send so some that the this to us we what which with would you your want need "
    "okay ok yes no also just only one ones show tell know about like".split()
)
MIN_DISTINCT_TOKENS = 2


@dataclass(frozen=True)
class PresentedItem:
    entity_id: str
    external_key: Optional[str]
    title: str
    presented_at: Optional[datetime] = None      # when our reply showed it
    outbound_message_id: Optional[str] = None    # which reply showed it (one list per reply)


@dataclass(frozen=True)
class Selection:
    item: PresentedItem
    message_index: int          # index into the customer-message list (last = current message)
    named_in_current: bool      # True when the current message itself names the item


def _norm(tok: str) -> str:
    if tok.isalpha() and len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
        return tok[:-1]
    return tok


def _tokens(s: str) -> set:
    return {_norm(t) for t in _WORD.findall((s or "").lower()) if t not in _STOP and len(t) > 1}


def match_presented_item(message: str, items: Sequence[PresentedItem]) -> Optional[PresentedItem]:
    """The single presented item this message names, or None (pure, unit-tested)."""
    if not items or not (message or "").strip():
        return None
    upper = (message or "").upper()
    # 1. Exact code typed by the customer.
    coded = [it for it in items if it.external_key and re.search(
        rf"(?<![A-Z0-9]){re.escape(it.external_key.upper())}(?![A-Z0-9])", upper)]
    if len(coded) == 1:
        return coded[0]
    if len(items) == 1:
        # Only one option was ever offered: it is selected only when the message names it clearly.
        only = items[0]
        overlap = _tokens(message) & _tokens(only.title)
        return only if len(overlap) >= MIN_DISTINCT_TOKENS else None
    # 2. Distinguishing title words.
    tok_sets = {it.entity_id: _tokens(it.title) for it in items}
    common = set.intersection(*tok_sets.values()) if tok_sets else set()
    msg = _tokens(message)
    scored = sorted(((len(msg & (tok_sets[it.entity_id] - common)), it) for it in items),
                    key=lambda p: -p[0])
    best_score, best = scored[0]
    runner_up = scored[1][0] if len(scored) > 1 else 0
    if best_score >= MIN_DISTINCT_TOKENS and best_score > runner_up:
        return best
    return None


def _as_dt(v) -> Optional[datetime]:
    if v is None or isinstance(v, datetime):
        return v if (v is None or v.tzinfo) else v.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _sort_dt(v) -> datetime:
    return _as_dt(v) or _EPOCH


def resolve_selection(customer_messages: Sequence[str], items: Sequence[PresentedItem],
                      current_requests_alternatives: bool = False,
                      message_times: Optional[Sequence[object]] = None) -> Optional[Selection]:
    """Active selection across the conversation (oldest -> newest customer message).

    A message can only select an item that had already been shown when it was written: the
    customer's opening request ("all 30 litre minibars") is the question, not a choice among
    answers that did not exist yet. ``message_times`` (same order as the messages; None for the
    current message = now) enables that check.
    """
    active: Optional[Selection] = None
    last = len(customer_messages) - 1
    for i, msg in enumerate(customer_messages):
        visible = items
        if message_times is not None and i < len(message_times):
            at = _as_dt(message_times[i])
            if at is not None:
                visible = [it for it in items if it.presented_at is None or _sort_dt(it.presented_at) <= at]
        hit = match_presented_item(msg, visible)
        if hit is not None:
            active = Selection(item=hit, message_index=i, named_in_current=(i == last))
    if current_requests_alternatives and (active is None or not active.named_in_current):
        return None
    return active


async def load_presented_items(db, tenant_id: str, thread_id: str, limit: int = 60) -> List[PresentedItem]:
    """Items already sent to the customer in this thread (tenant-scoped), newest first."""
    try:
        rows = (await db.execute(text("""
            SELECT DISTINCT ON (entity_id) entity_id, external_identity_key, entity_title, created_at,
                   outbound_message_id
            FROM thread_presented_entities
            WHERE tenant_id = :t AND thread_id = :th AND coalesce(entity_title, '') <> ''
            ORDER BY entity_id, created_at DESC"""), {"t": tenant_id, "th": thread_id})).all()
    except Exception as exc:  # noqa: BLE001 - selection is an enhancement, never a failure
        logger.warning("selection: presented items unavailable", error=f"{type(exc).__name__}: {str(exc)[:160]}")
        return []
    rows = sorted(rows, key=lambda r: r.created_at or 0, reverse=True)[:limit]
    return [PresentedItem(entity_id=r.entity_id, external_key=r.external_identity_key, title=r.entity_title,
                          presented_at=r.created_at, outbound_message_id=r.outbound_message_id)
            for r in rows]


# Plural back-references to what we just listed (English + common Hinglish function words; language,
# not business vocabulary). Used as a deterministic safety net under AI #1's reference_scope.
_BACK_REFERENCE = re.compile(
    r"\b(these|those|them|the above|above (?:items|products|models|services|ones|options)|all of (?:them|these|those)"
    r"|each of (?:them|these)|ye sab|yeh sab|ye sabhi|yeh sabhi|in sab|in sabhi|inke|inka|inki|unke|unka|unki)\b",
    re.IGNORECASE,
)


def refers_to_listed_items(message: str) -> bool:
    """True when the message points back at the items of our last reply ("codes of these")."""
    return bool(_BACK_REFERENCE.search(message or ""))


def latest_presented_list(items: Sequence[PresentedItem]) -> List[PresentedItem]:
    """The items shown in our most recent reply that listed anything (what "these" refers to)."""
    dated = [it for it in items if it.presented_at is not None]
    if not dated:
        return list(items)
    newest = max(dated, key=lambda it: _sort_dt(it.presented_at))
    if newest.outbound_message_id:
        return [it for it in items if it.outbound_message_id == newest.outbound_message_id]
    return [it for it in dated if _sort_dt(it.presented_at) == _sort_dt(newest.presented_at)]


def customer_texts(envelope) -> List[str]:
    """Customer-written text of the thread, oldest first, current message last (quotes stripped)."""
    return [t for t, _at in customer_messages_with_times(envelope)]


def customer_messages_with_times(envelope) -> List[Tuple[str, Optional[str]]]:
    """(text, sent_at) of the customer's messages, oldest first; the current message last with
    sent_at None (it is answered now, after everything already presented)."""
    from app.services.feedback_memory import strip_quoted

    msgs: List[Tuple[str, Optional[str]]] = []
    for m in sorted(getattr(envelope, "relevant_previous_messages", None) or [], key=lambda m: m.sent_at or ""):
        if (m.direction or "").lower() == "inbound":
            msgs.append((strip_quoted(m.body_text or "") or "", m.sent_at))
    cur = getattr(envelope, "current_message", None)
    msgs.append((strip_quoted(getattr(cur, "body_text", "") or "") or "", None))
    return msgs


def selection_summary(sel: Selection) -> Dict[str, Optional[str]]:
    return {"entity_id": sel.item.entity_id, "external_key": sel.item.external_key, "title": sel.item.title}
