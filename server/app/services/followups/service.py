"""Worker-side processing of one ``followup.assess`` event.

Order of work (no database transaction is open while the model runs):
  1. short read: tenant/thread/message checks, switches, dedupe row, fence check
  2. build as-of-message context (read only), close the session
  3. AI #2 call (bounded retries inside; durable retry via the stream on failure)
  4. validate, then one short transaction: store the assessment + atomic revision-fenced apply
On invalid output / provider failure the last valid decision stays in force with ``stale`` set,
customer outreach stays fenced, and the event is retried (then dead-lettered, visible in metrics).
"""

from __future__ import annotations

import time as _time
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from app.core.database import db_manager
from app.core.logging import logger
from app.models.followup import PROMPT_VERSION, MessageAssessment, ThreadFollowupControl, ThreadFollowupState
from app.models.inbox import EmailMessage, EmailThread
from app.services.followups import assessor, contracts, engine
from app.services.followups.flags import get_flags

MAX_ATTEMPTS = 5


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _existing(db, thread_id: str, message_id: str) -> Optional[MessageAssessment]:
    return (await db.execute(select(MessageAssessment).where(
        MessageAssessment.thread_id == thread_id, MessageAssessment.message_id == message_id,
        MessageAssessment.prompt_version == PROMPT_VERSION).with_for_update()
        .execution_options(populate_existing=True))).scalar_one_or_none()


async def _keep_latest_only(db, row: MessageAssessment, is_current: bool) -> None:
    """A conversation keeps ONE assessment: its latest. When ``row`` became the current decision,
    every older row of the thread is deleted (a newer in-flight row is left alone); when it was not
    applied (a newer message won the revision fence) ``row`` itself is deleted. Bounded storage:
    at most the current assessment plus one in-flight row per thread."""
    if is_current:
        await db.execute(delete(MessageAssessment).where(
            MessageAssessment.thread_id == row.thread_id, MessageAssessment.id != row.id,
            or_(MessageAssessment.message_sent_at.is_(None),
                MessageAssessment.message_sent_at <= row.message_sent_at)))
    else:
        await db.delete(row)


async def _row(db, *, tenant_id: str, thread_id: str, msg: EmailMessage) -> MessageAssessment:
    now = datetime.now(timezone.utc)
    await db.execute(pg_insert(MessageAssessment).values(
        id=f"asm_{uuid.uuid4().hex}", tenant_id=tenant_id, thread_id=thread_id,
        message_id=msg.id, message_sent_at=_utc(msg.sent_at), prompt_version=PROMPT_VERSION, status="pending",
        applied=False, attempts=0, created_at=now, updated_at=now,
    ).on_conflict_do_nothing(index_elements=["thread_id", "message_id", "prompt_version"]))
    return (await db.execute(select(MessageAssessment).where(
        MessageAssessment.thread_id == thread_id, MessageAssessment.message_id == msg.id,
        MessageAssessment.prompt_version == PROMPT_VERSION).with_for_update()
        .execution_options(populate_existing=True))).scalar_one()


async def process_assessment(*, tenant_id: str, thread_id: str, message_id: str,
                             now: Optional[datetime] = None) -> str:
    """Returns a short outcome label (for logs/tests). Raises to request a durable retry."""
    flags = get_flags()
    async with db_manager.session_factory() as db:
        thread = await db.get(EmailThread, thread_id)
        msg = await db.get(EmailMessage, message_id)
        if thread is None or msg is None or thread.tenant_id != tenant_id or msg.tenant_id != tenant_id \
                or msg.thread_id != thread_id:
            return "not_found"
        policy = await engine.load_policy(db, tenant_id)
        control = await db.get(ThreadFollowupControl, thread_id)
        assess_on, _ = engine.effective_switches(policy, control)
        existing = await _existing(db, thread_id, msg.id)

        if not flags.assessment_enabled or not assess_on:
            # Frozen label. The new message still fences outreach: hold pending customer email for review.
            state = await engine.lock_state(db, tenant_id, thread_id)
            if state.last_message_id in (None, msg.id):
                state.stale, state.stale_reason = False, None
                held = await engine.hold_customer_sends(db, thread_id, "new_message_not_assessed")
                if held:
                    state.needs_review, state.review_reason = True, "new message arrived; automatic assessment is off"
            if existing is not None and existing.status != "valid":
                await db.delete(existing)                 # nothing to keep: no assessment will be made
            await db.commit()
            return "assessment_disabled"

        if existing is not None and existing.status == "valid":
            if existing.applied or existing.not_applied_reason:
                await db.commit()
                return "duplicate"
            out = await engine.apply_assessment(db, tenant_id=tenant_id, row=existing,
                                                result=contracts.from_json(existing.result), now=now)
            await _keep_latest_only(db, existing, out.applied)
            await db.commit()
            return "applied" if out.applied else f"not_applied:{out.reason}"

        state = await db.get(ThreadFollowupState, thread_id)
        if state is not None and state.last_message_id and state.last_message_id != msg.id \
                and _utc(state.last_message_at) and _utc(state.last_message_at) > _utc(msg.sent_at):
            # A newer message exists; its assessment reads this one as context. Skip the model call and
            # store nothing (only the latest assessment of a conversation is ever kept).
            if existing is not None:
                await db.delete(existing)
            await db.commit()
            return "superseded"

        if existing is not None and existing.attempts >= MAX_ATTEMPTS:
            await db.commit()
            return "dead"
        row = existing or await _row(db, tenant_id=tenant_id, thread_id=thread_id, msg=msg)

        policy_cal = await engine.load_calendar(db, tenant_id, policy)
        ctx = await assessor.build_context(db, tenant_id=tenant_id, thread_id=thread_id, message_id=message_id,
                                           cal=policy_cal)
        row.attempts = (row.attempts or 0) + 1
        row.model = assessor.model_name()
        await db.commit()                              # no transaction stays open across the model call
    if ctx is None:
        return "not_found"

    t0 = _time.monotonic()
    error: Optional[str] = None
    status = "valid"
    result: Optional[contracts.Assessment] = None
    try:
        raw = await assessor.call_model(ctx)
        result = contracts.validate(raw, known_message_ids=ctx.known_ids, latest_message_id=ctx.message_id,
                                    customer_texts=ctx.customer_texts, latest_is_outbound=ctx.latest_is_outbound,
                                    prior_ai_temperature=ctx.prior_ai_temperature)
    except contracts.ContractError as exc:
        status, error = "invalid", str(exc)[:500]
    except Exception as exc:  # noqa: BLE001 - provider failure: retry durably
        status, error = "failed", f"{type(exc).__name__}: {str(exc)[:400]}"
    latency = int((_time.monotonic() - t0) * 1000)

    for attempt in range(2):
        try:
            async with db_manager.session_factory() as db:
                row = (await db.execute(select(MessageAssessment).where(
                    MessageAssessment.thread_id == thread_id, MessageAssessment.message_id == message_id,
                    MessageAssessment.prompt_version == PROMPT_VERSION).with_for_update())).scalar_one()
                row.latency_ms, row.status, row.error = latency, status, error
                if result is None:
                    st = await db.get(ThreadFollowupState, thread_id)
                    if st is not None and st.last_message_id == message_id:
                        st.stale, st.stale_reason = True, f"assessment_{status}"
                    await db.commit()
                    logger.warning("followup assessment failed", thread_id=thread_id, message_id=message_id,
                                   status=status, attempts=row.attempts, error=error)
                    raise RuntimeError(f"followup assessment {status}: {error}")
                row.suggested_temperature, row.label_confidence = result.temperature, result.label_confidence
                row.buying_interest, row.outcome = result.buying_interest, result.outcome
                row.next_actor, row.decision = result.next_actor, result.decision
                row.explanation, row.result = result.explanation, result.to_json()
                if engine.observe_only(policy):
                    row.not_applied_reason = "shadow_mode"
                    st = await db.get(ThreadFollowupState, thread_id)
                    if st is not None and st.last_message_id == message_id:
                        st.stale, st.stale_reason = False, None
                        # A set follow-up time stays locked, but a different evidenced time is surfaced.
                        await engine.note_time_suggestion(db, tenant_id=tenant_id, thread_id=thread_id,
                                                          message_id=message_id, result=result, now=now)
                    await _keep_latest_only(db, row, True)
                    await db.commit()
                    return "shadow"
                out = await engine.apply_assessment(db, tenant_id=tenant_id, row=row, result=result, now=now)
                await _keep_latest_only(db, row, out.applied)
                await db.commit()
                logger.info("followup assessment applied" if out.applied else "followup assessment stored",
                            thread_id=thread_id, message_id=message_id, decision=result.decision,
                            status=out.status, reason=out.reason, latency_ms=latency, warnings=result.warnings)
                return "applied" if out.applied else f"not_applied:{out.reason}"
        except IntegrityError:
            if attempt:
                raise
            continue
    return "retry_exhausted"
