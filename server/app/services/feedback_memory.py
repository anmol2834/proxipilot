"""Feedback & Outcome Memory (Memory 7).

Learns from what employees do with AI drafts and from how customers react to replies.

Capture (all best-effort, never block email or drafting):
  * Explicit review   — POST /feedback/drafts/{id}/review: approve / edit / reject + reason.
  * Implicit review   — a human-sent Gmail reply in a thread that had an AI draft is diffed
                        against the draft: near-identical => approved, similar => edited,
                        different => replaced_by_human. No AI draft => human_reply.
  * Outcome           — the customer's next inbound message after any reply is classified
                        (positive / negative / follow-up question / neutral). Exactly one
                        outcome per sent message (unique constraint).

Learning:
  * Derived lessons   — recurring rejection reasons and consistent edit-length patterns become
                        tenant drafting rules (idempotent upsert on derived_key). They switch
                        off automatically when the pattern disappears; an employee override
                        (status set by a person) is never undone by the deriver.
  * Employee lessons  — written directly by authorised employees.
  * Gold examples     — approved / edited / human-written replies for the same intent.

Recall: ``build_prompt_guidance`` returns a bounded prompt section (lessons + up to two
examples) in one round trip, cached briefly per tenant and invalidated on every write.
"""

from __future__ import annotations

import asyncio
import difflib
import json
import re
import time
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.logging import logger
from app.models.ai import AIResponse
from app.models.feedback import (
    DraftFeedback,
    FeedbackAction,
    FeedbackLesson,
    FeedbackReason,
    LessonStatus,
    OutcomeType,
    ResponseOutcome,
)
from app.models.review import HumanReview, ReviewStatus

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

APPROVED_SIMILARITY = 0.92        # >= : human sent the draft essentially unchanged
EDITED_SIMILARITY = 0.45          # >= : human edited the draft; below => replaced it
IMPLICIT_DRAFT_WINDOW = timedelta(days=7)
OUTCOME_WINDOW = timedelta(days=30)
IMPLICIT_CAPTURE_DELAY_SECONDS = 30   # let AI delivery commit its provider id first
MAX_COMPARE_WORDS = 1500

LESSON_MIN_EVIDENCE = 3
LESSON_MIN_SHARE = 0.25
LENGTH_MIN_EVIDENCE = 5
LESSON_LOOKBACK = timedelta(days=90)

GUIDANCE_MAX_CHARS = 1600
GUIDANCE_MAX_LESSONS = 8
GUIDANCE_EXAMPLE_CHARS = 550
GUIDANCE_TIMEOUT_SECONDS = 5.0
GUIDANCE_CACHE_TTL_SECONDS = 60.0

REVIEW_ACTIONS = {FeedbackAction.APPROVED.value, FeedbackAction.EDITED.value, FeedbackAction.REJECTED.value}
GOLD_ACTIONS = (
    FeedbackAction.APPROVED.value,
    FeedbackAction.EDITED.value,
    FeedbackAction.REPLACED_BY_HUMAN.value,
    FeedbackAction.HUMAN_REPLY.value,
)
OPEN_REVIEW_STATUSES = (ReviewStatus.OPEN.value, ReviewStatus.ASSIGNED.value, ReviewStatus.IN_REVIEW.value)

REASON_LESSONS: Dict[str, str] = {
    FeedbackReason.WRONG_FACTS.value: "Double-check every product detail, price and spec against the verified facts; never infer or round numbers.",
    FeedbackReason.MISSING_INFO.value: "Answer every question the customer asked; if a detail is unavailable, say so explicitly and offer to confirm it.",
    FeedbackReason.WRONG_TONE.value: "Match the team's tone: polite, warm and professional; avoid sounding robotic or overly salesy.",
    FeedbackReason.TOO_LONG.value: "Keep replies short and scannable: lead with the answer, at most a few short paragraphs.",
    FeedbackReason.TOO_SHORT.value: "Give complete answers: include the relevant specifications, options and a clear next step.",
    FeedbackReason.OFF_TOPIC.value: "Stay strictly on what the customer asked; do not add unrelated products or upsell.",
    FeedbackReason.POLICY.value: "Never make commitments on pricing, discounts, delivery dates or warranty beyond the verified company policy.",
}

# ---------------------------------------------------------------------------
# Pure helpers (unit-tested)
# ---------------------------------------------------------------------------

_QUOTE_HEADER = re.compile(
    r"^\s*(on\s.{3,200}?wrote:|-{2,}\s*original message\s*-{2,}|from:\s.+|sent from my\s.+)\s*$",
    re.IGNORECASE,
)
_WORD = re.compile(r"[a-z0-9ऀ-ॿ]+(?:[.'][a-z0-9]+)*", re.IGNORECASE)


def strip_quoted(body: Optional[str]) -> str:
    """Return only the newly written part of an email body (drops quoted history)."""
    if not body:
        return ""
    kept: List[str] = []
    for line in body.replace("\r\n", "\n").split("\n"):
        if _QUOTE_HEADER.match(line):
            break
        if line.lstrip().startswith(">"):
            continue
        kept.append(line.rstrip())
    return "\n".join(kept).strip()


def _words(value: str) -> List[str]:
    return [w.lower() for w in _WORD.findall(value or "")][:MAX_COMPARE_WORDS]


def text_similarity(a: Optional[str], b: Optional[str]) -> float:
    """Word-level similarity in [0, 1]; robust to whitespace / formatting changes."""
    wa, wb = _words(a or ""), _words(b or "")
    if not wa and not wb:
        return 1.0
    if not wa or not wb:
        return 0.0
    return round(difflib.SequenceMatcher(None, wa, wb, autojunk=False).ratio(), 4)


def length_ratio(original: Optional[str], final: Optional[str]) -> Optional[float]:
    n_orig = len(_words(original or ""))
    if n_orig == 0:
        return None
    return round(len(_words(final or "")) / n_orig, 3)


def classify_edit(similarity: float) -> str:
    if similarity >= APPROVED_SIMILARITY:
        return FeedbackAction.APPROVED.value
    if similarity >= EDITED_SIMILARITY:
        return FeedbackAction.EDITED.value
    return FeedbackAction.REPLACED_BY_HUMAN.value


_NEGATIVE_CUES = [
    r"not (?:happy|satisfied|what i (?:asked|wanted|need(?:ed)?))", r"disappoint", r"unacceptable",
    r"\bworst\b", r"\bpathetic\b", r"\bterrible\b", r"\bpoor (?:service|response|quality)\b",
    r"\bcomplain", r"\brefund\b", r"\bcancel", r"\bwrong\b", r"\bincorrect\b", r"\bmistake\b",
    r"(?:didn'?t|did not|doesn'?t|does not) (?:answer|help|work)", r"still waiting", r"no (?:response|reply) yet",
    r"\bfrustrat", r"\bannoy", r"\bnot interested\b", r"\btoo (?:expensive|costly|high)\b", r"\bbekar\b",
]
_POSITIVE_CUES = [
    r"\bthanks?\b", r"\bthank you\b", r"\bgreat\b", r"\bperfect\b", r"\bexcellent\b", r"\bawesome\b",
    r"\bappreciate", r"\bhelpful\b", r"sounds good", r"\blooks good\b",
    r"\binterested\b", r"\bdhanyavad\b", r"\bshukriya\b", r"\bnoted\b",
]
# Buying / commitment signals: positive even when phrased as a request.
_CONVERSION_CUES = [
    r"\bplease (?:proceed|go ahead|send (?:the |a |your )?(?:quotation|quote|invoice|proforma|pi)\b)",
    r"\b(?:place|placing|confirm(?:ing)?) (?:the |an |my |our |this )?order\b",
    r"\bwe(?:'ll| will| would like to) (?:take|order|buy|purchase|go ahead)\b",
    r"\bconfirm(?:ed)?\b", r"\bpayment (?:done|sent|made)\b",
]
_QUESTION_CUES = [
    r"\?", r"\bcan you\b", r"\bcould you\b", r"\bwhat about\b", r"\bhow much\b", r"\bdo you have\b",
    r"\bis (?:it|there)\b", r"\bwhen will\b", r"\bplease (?:share|send|tell|let me know)\b",
]
_NEG = [re.compile(p, re.IGNORECASE) for p in _NEGATIVE_CUES]
_POS = [re.compile(p, re.IGNORECASE) for p in _POSITIVE_CUES]
_QUE = [re.compile(p, re.IGNORECASE) for p in _QUESTION_CUES]
_CONV = [re.compile(p, re.IGNORECASE) for p in _CONVERSION_CUES]


def classify_outcome(body: Optional[str]) -> Tuple[str, float, List[str]]:
    """Classify a customer reaction. Negative beats positive ("thanks but this is wrong")."""
    fresh = strip_quoted(body)[:4000]
    if not fresh:
        return OutcomeType.NEUTRAL.value, 0.3, []
    neg = [p.pattern for p in _NEG if p.search(fresh)]
    pos = [p.pattern for p in _POS if p.search(fresh)]
    que = [p.pattern for p in _QUE if p.search(fresh)]
    if r"\bnot interested\b" in neg and r"\binterested\b" in pos:
        pos.remove(r"\binterested\b")
    conv = [p.pattern for p in _CONV if p.search(fresh)]
    if neg:
        conf = min(0.95, 0.6 + 0.12 * (len(neg) - 1) - (0.1 if (pos or conv) else 0.0))
        return OutcomeType.NEGATIVE.value, round(conf, 2), neg[:6]
    if conv:
        return OutcomeType.POSITIVE.value, round(min(0.95, 0.75 + 0.05 * len(conv + pos)), 2), (conv + pos)[:6]
    if que:
        return OutcomeType.FOLLOW_UP_QUESTION.value, round(min(0.9, 0.55 + 0.1 * len(que)), 2), (que + pos)[:6]
    if pos:
        return OutcomeType.POSITIVE.value, round(min(0.95, 0.6 + 0.1 * len(pos)), 2), pos[:6]
    return OutcomeType.NEUTRAL.value, 0.4, []


def primary_intent(package: Any) -> Optional[str]:
    reqs = getattr(package, "requirements", None) or []
    for req in reqs:
        intent = getattr(req, "intent", None)
        if intent:
            return str(intent)[:64]
    return None


def intent_from_response(ai_resp: Optional[AIResponse]) -> Optional[str]:
    raw = getattr(ai_resp, "generation_instructions", None) if ai_resp is not None else None
    if not raw:
        return None
    try:
        val = json.loads(raw).get("intent")
        return str(val)[:64] if val else None
    except (ValueError, AttributeError, TypeError):
        return None


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def derive_lesson_candidates(rows: Sequence[Tuple[str, Optional[str], Optional[float]]]) -> Dict[str, Tuple[str, int]]:
    """rows = (action, reason_code, length_ratio) of reviewed drafts.

    Returns {derived_key: (instruction, evidence_count)} for patterns that currently hold.
    """
    reviewed = [r for r in rows if r[0] in (REVIEW_ACTIONS | {FeedbackAction.REPLACED_BY_HUMAN.value})]
    total = len(reviewed)
    out: Dict[str, Tuple[str, int]] = {}
    if total == 0:
        return out
    reason_counts: Dict[str, int] = {}
    for action, reason, _ in reviewed:
        if reason and reason in REASON_LESSONS and action != FeedbackAction.APPROVED.value:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
    for reason, count in reason_counts.items():
        if count >= LESSON_MIN_EVIDENCE and count / total >= LESSON_MIN_SHARE:
            out[f"reason:{reason}"] = (REASON_LESSONS[reason], count)

    ratios = [r[2] for r in reviewed if r[0] == FeedbackAction.EDITED.value and r[2]]
    if len(ratios) >= LENGTH_MIN_EVIDENCE:
        med = median(ratios)
        if med <= 0.7:
            out["length:shorter"] = (
                f"The team usually trims drafts to about {int(round(med * 100))}% of their length: be more concise.",
                len(ratios),
            )
        elif med >= 1.4:
            out["length:longer"] = (
                "The team usually expands drafts substantially: include more detail and a clear next step.",
                len(ratios),
            )
    return out


def format_guidance(lessons: Sequence[str], examples: Sequence[str]) -> Optional[str]:
    parts: List[str] = []
    if lessons:
        parts.append("TEAM LESSONS (learned from employee feedback — follow as style rules):")
        parts.extend(f"- {ln.strip()[:240]}" for ln in lessons[:GUIDANCE_MAX_LESSONS])
    if examples:
        parts.append("APPROVED REPLY EXAMPLES (tone & structure reference only — never copy facts, prices or names):")
        for ex in examples:
            snippet = ex.strip()[:GUIDANCE_EXAMPLE_CHARS]
            parts.append("---\n" + snippet)
    if not parts:
        return None
    out = "\n".join(parts)
    return out[:GUIDANCE_MAX_CHARS]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

_BACKGROUND: Set[asyncio.Task] = set()


def _spawn(coro) -> None:
    try:
        task = asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        return
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


class FeedbackMemoryService:
    def __init__(self) -> None:
        self._guidance_cache: Dict[Tuple[str, Optional[str]], Tuple[float, Optional[str]]] = {}
        self._inflight: Dict[Tuple[str, Optional[str]], asyncio.Task] = {}

    # ------------------------------------------------------------------ cache
    def invalidate(self, tenant_id: str) -> None:
        for key in [k for k in self._guidance_cache if k[0] == tenant_id]:
            self._guidance_cache.pop(key, None)

    # ------------------------------------------------------------------ explicit review
    async def review_draft(
        self,
        db: AsyncSession,
        tenant_id: str,
        ai_response_id: str,
        action: str,
        reviewer_user_id: Optional[str],
        final_text: Optional[str] = None,
        reason_code: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> DraftFeedback:
        """Record an employee's decision on a draft. Commits. Raises ValueError/LookupError."""
        if action not in REVIEW_ACTIONS:
            raise ValueError(f"action must be one of {sorted(REVIEW_ACTIONS)}")
        if reason_code is not None and reason_code not in {r.value for r in FeedbackReason}:
            raise ValueError("invalid reason_code")
        if action == FeedbackAction.REJECTED.value and not (reason_code or (comment or "").strip()):
            raise ValueError("a reason_code or comment is required when rejecting a draft")
        if action == FeedbackAction.EDITED.value and not (final_text or "").strip():
            raise ValueError("final_text is required for an edited draft")

        ai_resp = (await db.execute(
            select(AIResponse).where(AIResponse.id == ai_response_id, AIResponse.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if ai_resp is None:
            raise LookupError("draft not found")
        if ai_resp.approval_status == "sent":
            raise ValueError("draft has already been sent; it can no longer be reviewed")

        original = ai_resp.draft_body_plain or ""
        final = (final_text or "").strip() if action == FeedbackAction.EDITED.value else (
            original if action == FeedbackAction.APPROVED.value else None
        )
        sim = text_similarity(original, final) if final is not None else None
        if action == FeedbackAction.EDITED.value and sim is not None and sim >= 0.999:
            action = FeedbackAction.APPROVED.value  # "edit" with no change is an approval

        stmt = pg_insert(DraftFeedback).values(
            tenant_id=tenant_id, ai_response_id=ai_resp.id, thread_id=ai_resp.thread_id, message_id=None,
            action=action, channel="review_api", reviewer_user_id=reviewer_user_id, reason_code=reason_code,
            comment=(comment or None), intent=intent_from_response(ai_resp), original_text=original,
            final_text=final, similarity=sim, length_ratio=length_ratio(original, final) if final else None,
        )
        # Latest decision wins for the explicit channel (message_id NULL never conflicts in PG,
        # so replace the previous explicit row ourselves).
        await db.execute(
            DraftFeedback.__table__.delete().where(
                DraftFeedback.tenant_id == tenant_id,
                DraftFeedback.ai_response_id == ai_resp.id,
                DraftFeedback.channel == "review_api",
            )
        )
        await db.execute(stmt)

        now_iso = _iso_now()
        ai_resp.approval_status = (
            "human_rejected" if action == FeedbackAction.REJECTED.value else "human_approved"
        )
        ai_resp.reviewed_by_user_id = reviewer_user_id
        ai_resp.reviewed_at = now_iso
        ai_resp.reviewer_notes = comment or ai_resp.reviewer_notes

        review_status = {
            FeedbackAction.APPROVED.value: ReviewStatus.APPROVED.value,
            FeedbackAction.EDITED.value: ReviewStatus.APPROVED.value,
            FeedbackAction.REJECTED.value: ReviewStatus.REJECTED.value,
        }[action]
        await db.execute(
            update(HumanReview)
            .where(
                HumanReview.tenant_id == tenant_id,
                HumanReview.ai_response_id == ai_resp.id,
                HumanReview.status.in_(OPEN_REVIEW_STATUSES),
            )
            .values(
                status=review_status, reviewed_by_user_id=reviewer_user_id, reviewer_notes=comment,
                override_body=final if action == FeedbackAction.EDITED.value else None, resolved_at=now_iso,
            )
        )
        await db.commit()
        row = (await db.execute(
            select(DraftFeedback).where(
                DraftFeedback.tenant_id == tenant_id,
                DraftFeedback.ai_response_id == ai_resp.id,
                DraftFeedback.channel == "review_api",
            )
        )).scalar_one()
        self.invalidate(tenant_id)
        _spawn(self.refresh_derived_lessons(tenant_id))
        return row

    # ------------------------------------------------------------------ implicit capture
    def schedule_human_outbound(self, tenant_id: str, thread_id: str, message_id: str,
                                external_message_id: str, body_text: Optional[str],
                                sent_at: datetime, delay: float = IMPLICIT_CAPTURE_DELAY_SECONDS) -> None:
        async def _run() -> None:
            if delay > 0:
                await asyncio.sleep(delay)
            await self.capture_human_outbound(tenant_id, thread_id, message_id, external_message_id,
                                              body_text, sent_at)

        _spawn(_run())

    async def capture_human_outbound(
        self, tenant_id: str, thread_id: str, message_id: str, external_message_id: str,
        body_text: Optional[str], sent_at: datetime, db: Optional[AsyncSession] = None,
    ) -> Optional[str]:
        """Learn from a reply an employee sent from Gmail. Returns the action or None. Never raises."""
        try:
            if db is not None:
                return await self._capture_human_outbound(db, tenant_id, thread_id, message_id,
                                                          external_message_id, body_text, sent_at)
            async with db_manager.session_factory() as session:
                return await self._capture_human_outbound(session, tenant_id, thread_id, message_id,
                                                          external_message_id, body_text, sent_at)
        except Exception as exc:  # noqa: BLE001 — capture must never break ingestion
            logger.warning("feedback: implicit capture failed", tenant_id=tenant_id,
                           thread_id=thread_id, error=str(exc)[:300])
            return None

    async def _capture_human_outbound(self, db, tenant_id, thread_id, message_id, external_message_id,
                                      body_text, sent_at) -> Optional[str]:
        # Sent by the AI delivery pipeline (Gmail echo) => not human feedback.
        ai_sent = (await db.execute(text(
            "SELECT 1 FROM outbound_messages WHERE tenant_id = :t AND provider_message_id = :p LIMIT 1"),
            {"t": tenant_id, "p": external_message_id})).first()
        if ai_sent:
            return None
        final = strip_quoted(body_text)
        if not final:
            return None
        sent_at = sent_at or datetime.now(timezone.utc)
        ai_resp = (await db.execute(
            select(AIResponse)
            .where(
                AIResponse.tenant_id == tenant_id,
                AIResponse.thread_id == thread_id,
                AIResponse.approval_status != "sent",
                AIResponse.created_at <= sent_at + timedelta(minutes=1),
                AIResponse.created_at >= sent_at - IMPLICIT_DRAFT_WINDOW,
            )
            .order_by(AIResponse.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        if ai_resp is None:
            action, original, sim, lr, intent = FeedbackAction.HUMAN_REPLY.value, None, None, None, None
        else:
            original = ai_resp.draft_body_plain or ""
            sim = text_similarity(original, final)
            action = classify_edit(sim)
            lr = length_ratio(original, final)
            intent = intent_from_response(ai_resp)

        res = await db.execute(
            pg_insert(DraftFeedback).values(
                tenant_id=tenant_id, ai_response_id=ai_resp.id if ai_resp else None, thread_id=thread_id,
                message_id=message_id, action=action, channel="gmail_implicit", intent=intent,
                original_text=original, final_text=final[:20000], similarity=sim, length_ratio=lr,
            ).on_conflict_do_nothing(constraint="uq_draft_feedback_response_message")
        )
        if ai_resp is not None and ai_resp.approval_status in ("pending_review", "auto_approved"):
            now_iso = _iso_now()
            ai_resp.approval_status = (
                "human_rejected" if action == FeedbackAction.REPLACED_BY_HUMAN.value else "human_approved"
            )
            ai_resp.reviewed_at = now_iso
            await db.execute(
                update(HumanReview)
                .where(HumanReview.tenant_id == tenant_id, HumanReview.ai_response_id == ai_resp.id,
                       HumanReview.status.in_(OPEN_REVIEW_STATUSES))
                .values(
                    status=ReviewStatus.OVERRIDDEN.value if action == FeedbackAction.REPLACED_BY_HUMAN.value
                    else ReviewStatus.APPROVED.value,
                    override_body=None if action == FeedbackAction.APPROVED.value else final[:20000],
                    resolved_at=now_iso,
                )
            )
        await db.commit()
        if getattr(res, "rowcount", 1):
            self.invalidate(tenant_id)
            if ai_resp is not None:
                _spawn(self.refresh_derived_lessons(tenant_id))
        logger.info("feedback: implicit capture", tenant_id=tenant_id, thread_id=thread_id,
                    action=action, similarity=sim)
        return action

    # ------------------------------------------------------------------ outcomes
    async def capture_outcome(
        self, tenant_id: str, thread_id: str, customer_message_id: str, body_text: Optional[str],
        received_at: datetime, db: Optional[AsyncSession] = None,
    ) -> Optional[str]:
        """Classify the customer's reaction to the latest reply in the thread. Never raises."""
        try:
            if db is not None:
                return await self._capture_outcome(db, tenant_id, thread_id, customer_message_id,
                                                   body_text, received_at)
            async with db_manager.session_factory() as session:
                return await self._capture_outcome(session, tenant_id, thread_id, customer_message_id,
                                                   body_text, received_at)
        except Exception as exc:  # noqa: BLE001
            logger.warning("feedback: outcome capture failed", tenant_id=tenant_id,
                           thread_id=thread_id, error=str(exc)[:300])
            return None

    async def _capture_outcome(self, db, tenant_id, thread_id, customer_message_id, body_text,
                               received_at) -> Optional[str]:
        received_at = received_at or datetime.now(timezone.utc)
        prev = (await db.execute(text("""
            SELECT m.id, m.sent_at, o.ai_response_id
            FROM email_messages m
            LEFT JOIN outbound_messages o
              ON o.tenant_id = m.tenant_id AND o.provider_message_id = m.external_message_id
            WHERE m.tenant_id = :t AND m.thread_id = :th AND m.direction = 'outbound'
              AND m.sent_at < :r AND m.sent_at >= :since
            ORDER BY m.sent_at DESC LIMIT 1"""),
            {"t": tenant_id, "th": thread_id, "r": received_at, "since": received_at - OUTCOME_WINDOW},
        )).first()
        if prev is None:
            return None
        outcome, confidence, signals = classify_outcome(body_text)
        latency = int((received_at - prev.sent_at).total_seconds()) if prev.sent_at else None
        res = await db.execute(
            pg_insert(ResponseOutcome).values(
                tenant_id=tenant_id, thread_id=thread_id, sent_message_id=prev.id,
                customer_message_id=customer_message_id, sent_by="ai" if prev.ai_response_id else "human",
                ai_response_id=prev.ai_response_id, outcome=outcome, confidence=confidence,
                signals=json.dumps(signals) if signals else None, response_latency_seconds=latency,
            ).on_conflict_do_nothing(constraint="uq_response_outcomes_sent_message")
        )
        await db.commit()
        if not getattr(res, "rowcount", 1):
            return None  # an earlier customer message already decided this reply's outcome
        logger.info("feedback: outcome captured", tenant_id=tenant_id, thread_id=thread_id,
                    outcome=outcome, sent_by="ai" if prev.ai_response_id else "human")
        return outcome

    # ------------------------------------------------------------------ learning
    async def refresh_derived_lessons(self, tenant_id: str) -> int:
        """Recompute derived lessons from recent feedback. Idempotent; never raises."""
        try:
            async with db_manager.session_factory() as db:
                rows = (await db.execute(
                    select(DraftFeedback.action, DraftFeedback.reason_code, DraftFeedback.length_ratio)
                    .where(DraftFeedback.tenant_id == tenant_id,
                           DraftFeedback.ai_response_id.is_not(None),
                           DraftFeedback.created_at >= datetime.now(timezone.utc) - LESSON_LOOKBACK)
                )).all()
                candidates = derive_lesson_candidates([tuple(r) for r in rows])
                existing = {
                    l.derived_key: l for l in (await db.execute(
                        select(FeedbackLesson).where(FeedbackLesson.tenant_id == tenant_id,
                                                     FeedbackLesson.origin == "derived")
                    )).scalars().all()
                }
                changed = 0
                for key, (instruction, evidence) in candidates.items():
                    lesson = existing.get(key)
                    if lesson is None:
                        db.add(FeedbackLesson(tenant_id=tenant_id, instruction=instruction, origin="derived",
                                              derived_key=key, evidence_count=evidence,
                                              status=LessonStatus.ACTIVE.value, priority=40))
                        changed += 1
                    else:
                        lesson.evidence_count = evidence
                        lesson.instruction = instruction
                        # Re-activate only lessons that were auto-disabled, never employee-disabled.
                        if lesson.status == LessonStatus.DISABLED.value and not lesson.created_by_user_id:
                            lesson.status = LessonStatus.ACTIVE.value
                            changed += 1
                for key, lesson in existing.items():
                    if key not in candidates and lesson.status == LessonStatus.ACTIVE.value \
                            and not lesson.created_by_user_id:
                        lesson.status = LessonStatus.DISABLED.value  # pattern no longer holds
                        changed += 1
                await db.commit()
            if changed:
                self.invalidate(tenant_id)
                logger.info("feedback: derived lessons refreshed", tenant_id=tenant_id, changed=changed)
            return changed
        except Exception as exc:  # noqa: BLE001
            logger.warning("feedback: lesson refresh failed", tenant_id=tenant_id, error=str(exc)[:300])
            return 0

    # ------------------------------------------------------------------ recall
    async def build_prompt_guidance(self, tenant_id: str, intent: Optional[str]) -> Optional[str]:
        """Bounded prompt section with active lessons + gold examples. Never raises."""
        key = (tenant_id, intent)
        hit = self._guidance_cache.get(key)
        if hit and time.monotonic() - hit[0] < GUIDANCE_CACHE_TTL_SECONDS:
            return hit[1]
        task = self._inflight.get(key)
        if task is None or task.done():
            task = asyncio.get_running_loop().create_task(self._load_and_cache(key))
            self._inflight[key] = task
            _BACKGROUND.add(task)
            task.add_done_callback(_BACKGROUND.discard)
        try:
            # shield: on timeout the load keeps running and warms the cache for the next draft
            return await asyncio.wait_for(asyncio.shield(task), GUIDANCE_TIMEOUT_SECONDS)
        except Exception as exc:  # noqa: BLE001 — includes TimeoutError
            logger.warning("feedback: guidance unavailable", tenant_id=tenant_id,
                           error=type(exc).__name__ + ": " + str(exc)[:200])
            return hit[1] if hit else None  # stale-on-error

    async def _load_and_cache(self, key: Tuple[str, Optional[str]]) -> Optional[str]:
        try:
            result = await self._load_guidance(*key)
            self._guidance_cache[key] = (time.monotonic(), result)
            return result
        finally:
            self._inflight.pop(key, None)

    async def _load_guidance(self, tenant_id: str, intent: Optional[str]) -> Optional[str]:
        async with db_manager.session_factory() as db:
            rows = (await db.execute(text("""
                (SELECT 'lesson' AS kind, instruction AS body, priority AS rank, created_at
                   FROM feedback_lessons
                  WHERE tenant_id = :t AND status = 'active'
                    AND (scope_intent IS NULL OR scope_intent = :intent)
                  ORDER BY priority DESC, created_at DESC LIMIT :nl)
                UNION ALL
                (SELECT 'example', f.final_text, 0, f.created_at
                   FROM draft_feedback f
                  WHERE f.tenant_id = :t AND CAST(:intent AS varchar) IS NOT NULL AND f.intent = :intent
                    AND f.action = ANY(:gold) AND f.final_text IS NOT NULL AND length(f.final_text) > 40
                    AND NOT EXISTS (SELECT 1 FROM response_outcomes o
                                     WHERE o.tenant_id = f.tenant_id AND o.thread_id = f.thread_id
                                       AND o.outcome = 'negative')
                  ORDER BY f.created_at DESC LIMIT 2)"""),
                {"t": tenant_id, "intent": intent, "nl": GUIDANCE_MAX_LESSONS, "gold": list(GOLD_ACTIONS)},
            )).all()
        lessons = [r.body for r in rows if r.kind == "lesson"]
        examples = [r.body for r in rows if r.kind == "example"]
        return format_guidance(lessons, examples)

    # ------------------------------------------------------------------ analytics
    async def metrics(self, db: AsyncSession, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        since = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))
        actions = dict((await db.execute(
            select(DraftFeedback.action, func.count()).where(
                DraftFeedback.tenant_id == tenant_id, DraftFeedback.created_at >= since
            ).group_by(DraftFeedback.action)
        )).all())
        reasons = dict((await db.execute(
            select(DraftFeedback.reason_code, func.count()).where(
                DraftFeedback.tenant_id == tenant_id, DraftFeedback.created_at >= since,
                DraftFeedback.reason_code.is_not(None),
            ).group_by(DraftFeedback.reason_code)
        )).all())
        outcome_rows = (await db.execute(
            select(ResponseOutcome.sent_by, ResponseOutcome.outcome, func.count()).where(
                ResponseOutcome.tenant_id == tenant_id, ResponseOutcome.created_at >= since
            ).group_by(ResponseOutcome.sent_by, ResponseOutcome.outcome)
        )).all()
        outcomes: Dict[str, Dict[str, int]] = {}
        for sent_by, outcome, n in outcome_rows:
            outcomes.setdefault(sent_by, {})[outcome] = n
        reviewed = sum(actions.get(a, 0) for a in (
            FeedbackAction.APPROVED.value, FeedbackAction.EDITED.value,
            FeedbackAction.REJECTED.value, FeedbackAction.REPLACED_BY_HUMAN.value))

        def rate(n: int) -> Optional[float]:
            return round(n / reviewed, 3) if reviewed else None

        def positive_rate(by: str) -> Optional[float]:
            d = outcomes.get(by) or {}
            total = sum(d.values())
            return round(d.get(OutcomeType.POSITIVE.value, 0) / total, 3) if total else None

        return {
            "window_days": days,
            "drafts_reviewed": reviewed,
            "actions": actions,
            "approval_rate": rate(actions.get(FeedbackAction.APPROVED.value, 0)),
            "edit_rate": rate(actions.get(FeedbackAction.EDITED.value, 0)),
            "rejection_rate": rate(actions.get(FeedbackAction.REJECTED.value, 0)
                                   + actions.get(FeedbackAction.REPLACED_BY_HUMAN.value, 0)),
            "rejection_reasons": reasons,
            "outcomes": outcomes,
            "positive_outcome_rate": {"ai": positive_rate("ai"), "human": positive_rate("human")},
        }


feedback_memory_service = FeedbackMemoryService()
