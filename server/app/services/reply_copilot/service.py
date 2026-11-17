"""AI Reply Copilot orchestration (one conversation, one instruction -> one validated proposal).

    instruction ──► AI #1 decide (rules first; ≤1 model call)
                     ├─ WRITING_ONLY ─────────────────────────────┐   no retrieval, no embedding
                     ├─ CLARIFY ──► question back to the user      │
                     └─ fact requests (≤3, concurrent)             │
                          L1 context records (re-read, current)    │
                          L2 exact identity cache (+version check) │
                          L3 planner→retrieval→fusion→package      │
                                                                   ▼
                  AI #2 compose (reviews/rejects evidence) ──► ≤1 extra search ──► recompose
                                                                   ▼
                  deterministic validation ──► ≤1 targeted repair ──► revalidate
                                                                   ▼
                  proposal (+ facts used, gaps, issues, metrics); apply_allowed only when clean

Never sends email and never writes the editor: the client applies the proposal only if the editor
still holds the draft revision the proposal was based on.
"""

from __future__ import annotations

import asyncio
import contextlib
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.core.database import db_manager
from app.core.logging import logger
from app.services.reply_copilot import composer as composer_mod
from app.services.reply_copilot import decision as decision_mod
from app.services.reply_copilot import evidence as ev_mod
from app.services.reply_copilot.contracts import (
    CopilotDecision, CopilotFact, CopilotIssue, CopilotOperation, CopilotRequest, CopilotResult, EvidenceSet,
    FactRequest,
)

MAX_EXTRA_RETRIEVALS = 1
MAX_REPAIRS = 1
REQUEST_TIMEOUT_S = 150.0


class ThreadNotFound(LookupError):
    pass


def merge_evidence(parts: List[EvidenceSet]) -> EvidenceSet:
    out = EvidenceSet()
    seen = set()
    for ev in parts:
        for f in ev.facts:
            k = (f.entity_code or f.entity_id, f.attribute.lower(), f.value)
            if k not in seen:
                seen.add(k)
                out.facts.append(f)
        out.unresolved += [u for u in ev.unresolved if u not in out.unresolved]
        out.unknown_codes += [u for u in ev.unknown_codes if u not in out.unknown_codes]
        out.search_incomplete = out.search_incomplete or ev.search_incomplete
        out.sources_used += [s for s in ev.sources_used if s not in out.sources_used]
    return out


MAX_VERBATIM_TURNS = 6

# The instruction points at items already in the conversation ("this one", "the same", a code).
_REFERS = re.compile(r"\b(this|that|these|those|same|above|selected|previous|mentioned|aforesaid|said)\b",
                     re.IGNORECASE)
# The instruction asks to look something up: worth starting retrieval while AI #1 is still deciding.
_SEARCH = re.compile(r"\b(find|search|look\s*up|check|suggest|recommend|show|list|options?|alternatives?|cheapest|"
                     r"lowest|most expensive|price of|prices? for|which|available|availability|compare|best|similar)\b",
                     re.IGNORECASE)


def refers_to_context(instruction: str) -> bool:
    return bool(decision_mod.codes_in(instruction) or _REFERS.search(instruction))


def scoped_request(r: FactRequest, instruction: str) -> FactRequest:
    """A request may reuse thread items only when the instruction refers to them; a new search
    ("find the hand dispenser") must not be answered with an item that merely appears in the thread."""
    if refers_to_context(instruction):
        return r
    named = set(decision_mod.codes_in(instruction))
    return r.model_copy(update={"entity_codes": [c for c in r.entity_codes if c in named], "about_context_items": False})


def session_context(req: CopilotRequest) -> str:
    """Bounded session memory for both AI steps (like a chat assistant's context window):
    a compact summary of older turns + the last few turns verbatim (instruction -> what changed),
    and where the working draft came from. Hard-capped; never includes customer content."""
    lines: List[str] = []
    if req.session_summary.strip():
        lines.append("Earlier (summarised): " + req.session_summary.strip()[:1200])
    for t in req.history[-MAX_VERBATIM_TURNS:]:
        line = "- " + t.instruction.strip()[:300]
        if t.summary:
            line += " -> " + t.summary.strip()[:200]
        if t.applied:
            line += " [applied to the editor]"
        lines.append(line)
    if req.draft_source == "proposal":
        lines.append("(The WORKING DRAFT is the copilot's previous suggestion; the employee is refining it.)")
    return "\n".join(lines)[:2500]


def absence_claim_codes(text: str) -> List[str]:
    """Codes the working draft says do not exist / were not found (verified before rewriting)."""
    from app.services.reply_planner.validator import _unsupported_absence_claims
    return _unsupported_absence_claims(text, None)


def employee_text(req: CopilotRequest) -> str:
    """The employee's own words this session (instructions only, never customer text): they may authorize
    statements such as a discount, which the validator then accepts."""
    return " ".join([req.instruction] + [t.instruction for t in req.history] + [req.session_summary])


def _norm(s: str) -> str:
    import re as _re
    return _re.sub(r"\s+", " ", (s or "").strip().lower())


def _thread_brief(snap: ev_mod.ThreadSnapshot) -> str:
    lines = []
    for m in snap.messages[:-1][-4:]:
        who = "Customer" if m["direction"] == "inbound" else "Us"
        lines.append(f"{who}: {(m['body_text'] or '').strip()[:500]}")
    return "\n".join(lines)


def _evidence_status(op: CopilotOperation, levels: List[str], n_facts: int) -> str:
    if op == CopilotOperation.WRITING_ONLY:
        return "Writing only: no knowledge search needed"
    parts = []
    if "L1_reuse" in levels:
        parts.append("re-read items already in this conversation")
    if "L2_cache_hit" in levels:
        parts.append("reused a verified search from this conversation")
    if "L3_retrieval" in levels:
        parts.append("searched the knowledge base")
    if "L3_error" in levels:
        parts.append("knowledge search unavailable")
    return f"{n_facts} verified fact{'s' if n_facts != 1 else ''} · " + ", ".join(parts) if parts else "No facts found"


class ReplyCopilotService:
    def __init__(self, decide=None, compose=None, resolve=None, load_thread=None, context_records=None,
                 session_factory=None, answer=None):
        self._answer = answer or composer_mod.answer
        self._session = session_factory or (lambda: db_manager.session_factory())
        self._decide = decide or decision_mod.decide
        self._compose = compose or composer_mod.compose
        self._resolve = resolve or ev_mod.resolve_request
        self._load_thread = load_thread or ev_mod.load_thread
        self._context_records = context_records or ev_mod.context_records

    async def _resolve_one(self, tenant_id: str, snap, req: FactRequest, ctx_facts) -> Tuple[EvidenceSet, Dict[str, Any]]:
        async with self._session() as db:     # one session per concurrent request
            ev, m = await self._resolve(db, tenant_id, snap, req, ctx_facts)
            return ev, m

    async def refine(self, tenant_id: str, thread_id: str, req: CopilotRequest, user_id: Optional[str] = None) -> CopilotResult:
        return await asyncio.wait_for(self._refine(tenant_id, thread_id, req, user_id), REQUEST_TIMEOUT_S)

    async def _refine(self, tenant_id: str, thread_id: str, req: CopilotRequest, user_id: Optional[str]) -> CopilotResult:
        t0 = time.perf_counter()
        rid = f"cop_{uuid.uuid4().hex[:12]}"
        metrics: Dict[str, Any] = {"request_id": rid, "llm_calls": 0, "retrieval_calls": 0, "extra_retrievals": 0,
                                   "repairs": 0, "levels": []}
        async with self._session() as db:
            snap = await self._load_thread(db, tenant_id, thread_id)
            if snap is None:
                raise ThreadNotFound("conversation not found")
            customer_msg = ((snap.latest_inbound or {}).get("body_text") or "").strip()
            ctx_codes = list(dict.fromkeys(
                decision_mod.codes_in(req.draft_text) + decision_mod.codes_in(customer_msg)
                + [c.upper() for _, c, _ in snap.presented if c]))
            titles = {(c or "").upper(): t or "" for _, c, t in snap.presented if c}
            metrics["context_ms"] = round((time.perf_counter() - t0) * 1000, 1)

            # ---- speculative retrieval: a search-type instruction ("find X and its price") almost always
            # needs one primary search; start it now so it overlaps the decision call. Discarded if the
            # decision says otherwise (only costs one planner call in that case).
            spec_task: Optional[asyncio.Task] = None
            if (decision_mod.rule_decision(req.instruction, req.draft_text) is None and _SEARCH.search(req.instruction)
                    and not refers_to_context(req.instruction)):
                spec_req = FactRequest(request=req.instruction[:400], entity_codes=decision_mod.codes_in(req.instruction)[:10])
                spec_task = asyncio.create_task(self._resolve_one(tenant_id, snap, spec_req, {}))

            # ---- AI #1
            decision, dm = await self._decide(req.instruction, req.draft_text, customer_msg,
                                              [(c, titles.get(c, "")) for c in ctx_codes],
                                              session_context(req).splitlines())
            metrics.update(dm)
            metrics["llm_calls"] += dm.get("decision_llm_calls", 0)
            metrics["decided_by"] = decision.decided_by
            decision = decision.model_copy(update={
                "fact_requests": [scoped_request(r, req.instruction) for r in decision.fact_requests]})
            use_spec = bool(spec_task and len(decision.fact_requests) == 1
                            and not decision.fact_requests[0].entity_codes)
            if spec_task and not use_spec:
                spec_task.cancel()
                with contextlib.suppress(BaseException):
                    await spec_task
                metrics["speculative"] = "discarded"
            if decision.operation == CopilotOperation.CLARIFY:
                return self._finish(rid, thread_id, decision.operation, req, metrics, t0,
                                    clarification=decision.clarification_question or "Could you say a bit more about what to change?")
            if decision.operation == CopilotOperation.CHAT:
                # Small talk / a question about the copilot: reply in the chat; the draft is untouched.
                return self._finish(rid, thread_id, decision.operation, req, metrics, t0,
                                    message=decision.reply or "How can I help with this reply?",
                                    status="Chat")

            # ---- evidence (only for fact requests)
            ev = EvidenceSet()
            if decision.fact_requests:
                need_ctx = any(r.entity_codes or r.about_context_items for r in decision.fact_requests)
                ctx_facts: Dict[str, List[CopilotFact]] = {}
                if need_ctx:
                    wanted = list(dict.fromkeys([c for r in decision.fact_requests for c in r.entity_codes] + ctx_codes))
                    ctx_facts, _missing = await self._context_records(
                        db, tenant_id, wanted, [p[0] for p in snap.presented])
                t1 = time.perf_counter()
                if use_spec and spec_task is not None:
                    results = [await spec_task]
                    metrics["speculative"] = "used"
                else:
                    results = await asyncio.gather(*[self._resolve_one(tenant_id, snap, r, ctx_facts)
                                                     for r in decision.fact_requests])
                metrics["evidence_ms"] = round((time.perf_counter() - t1) * 1000, 1)
                ev = merge_evidence([e for e, _ in results])
                for _, m in results:
                    metrics["levels"].append(m.get("level"))
                    metrics["retrieval_calls"] += 1 if m.get("level") == "L3_retrieval" else 0
                    metrics.setdefault("evidence_detail", []).append({k: v for k, v in m.items() if k != "level"})

            # The working draft may say "code X is not in our catalogue". Check it with an exact-code
            # lookup (B-tree, milliseconds); if X exists, give its current record to AI #2 so the
            # false sentence is corrected instead of polished.
            claimed_missing = [c for c in absence_claim_codes(req.draft_text)
                               if c not in {(f.entity_code or "").upper() for f in ev.facts}]
            if claimed_missing:
                found, _ = await self._context_records(db, tenant_id, claimed_missing, [])
                if found:
                    ev = merge_evidence([ev, EvidenceSet(facts=[f for fs in found.values() for f in fs],
                                                         sources_used=["context_record"])])
                    metrics["levels"].append("L1_reuse")
                    metrics["corrected_absence_claims"] = sorted(found)

        if decision.operation == CopilotOperation.ANSWER:
            return await self._answer_flow(rid, thread_id, tenant_id, req, decision, snap, customer_msg, ev, metrics, t0)

        op = self._final_operation(decision, metrics["levels"])
        if metrics.get("corrected_absence_claims") and op == CopilotOperation.WRITING_ONLY:
            op = CopilotOperation.MIXED
        session = session_context(req)
        grounding = "\n".join([req.instruction] + [m["body_text"] or "" for m in snap.messages])
        brief = _thread_brief(snap)

        # ---- AI #2 (+ one bounded extra search it may ask for)
        data, cm = await self._compose(tenant_id, req.instruction, req.draft_text, customer_msg, brief, ev,
                                       session=session, goal=decision.writing_goal)
        self._count(metrics, cm)
        extra = composer_mod.extra_request(data)
        if extra is not None and op != CopilotOperation.WRITING_ONLY and metrics["extra_retrievals"] < MAX_EXTRA_RETRIEVALS:
            metrics["extra_retrievals"] += 1
            async with self._session() as db2:
                more, m2 = await self._resolve(db2, tenant_id, snap, extra, {})
            metrics["levels"].append(m2.get("level"))
            metrics["retrieval_calls"] += 1 if m2.get("level") == "L3_retrieval" else 0
            ev = merge_evidence([ev, more])
            data, cm = await self._compose(tenant_id, req.instruction, req.draft_text, customer_msg, brief, ev,
                                       session=session, goal=decision.writing_goal)
            self._count(metrics, cm)

        proposal = str(data.get("revised_draft") or "").strip()
        issues = self._check(proposal, req, ev, grounding)
        if issues and metrics["repairs"] < MAX_REPAIRS:
            metrics["repairs"] += 1
            fix = "\n".join(f"- {i.code}: {i.detail}" for i in issues)
            data2, cm = await self._compose(tenant_id, req.instruction, req.draft_text, customer_msg, brief, ev,
                                            repair=fix, session=session, goal=decision.writing_goal)
            self._count(metrics, cm)
            p2 = str(data2.get("revised_draft") or "").strip()
            issues2 = self._check(p2, req, ev, grounding)
            if len(issues2) < len(issues) or not issues2:
                data, proposal, issues = data2, p2, issues2

        if not req.draft_text.strip() and proposal:
            proposal = await self._with_closing(tenant_id, snap, proposal)

        used_ids = set(map(str, data.get("used_fact_ids") or []))
        facts_used = [f for f in ev.facts if f.fact_id in used_ids][:40]
        unresolved = list(dict.fromkeys([str(u)[:300] for u in (data.get("unresolved") or [])] + ev.unresolved))[:10]
        metrics["rejected_evidence"] = len(data.get("rejected_evidence") or [])
        note = str(data.get("assistant_message") or "").strip()[:1200]
        if note and composer_mod.validate_proposal(note, req.draft_text, ev, grounding, employee_text(req)):
            note = ""                      # a note to the employee must be as grounded as the email itself
        return self._finish(rid, thread_id, op, req, metrics, t0, proposal=proposal, message=note,
                            summary=str(data.get("changes_summary") or "")[:300], facts_used=facts_used,
                            unresolved=unresolved, issues=issues,
                            status=_evidence_status(op, metrics["levels"], len(ev.facts)))

    async def _answer_flow(self, rid: str, thread_id: str, tenant_id: str, req: CopilotRequest, decision: CopilotDecision,
                           snap, customer_msg: str, ev: EvidenceSet, metrics: Dict[str, Any], t0: float) -> CopilotResult:
        """ANSWER: the employee asked or told the copilot something. Answer in the chat from the
        evidence; the draft is never touched (no proposal, nothing to apply)."""
        session = session_context(req)
        grounding = "\n".join([req.instruction] + [m["body_text"] or "" for m in snap.messages])
        data, cm = await self._answer(tenant_id, req.instruction, req.draft_text, customer_msg, ev, session=session)
        self._count(metrics, cm)
        text = str(data.get("answer") or "").strip()
        issues = composer_mod.validate_proposal(text, req.draft_text, ev, grounding, employee_text(req))
        if issues and metrics["repairs"] < MAX_REPAIRS:
            metrics["repairs"] += 1
            fix = "\n".join(f"- {i.code}: {i.detail}" for i in issues)
            data2, cm = await self._answer(tenant_id, req.instruction, req.draft_text, customer_msg, ev,
                                           session=session, repair=fix)
            self._count(metrics, cm)
            t2 = str(data2.get("answer") or "").strip()
            issues2 = composer_mod.validate_proposal(t2, req.draft_text, ev, grounding, employee_text(req))
            if len(issues2) < len(issues) or not issues2:
                data, text, issues = data2, t2, issues2
        if issues:   # never show an unverified fact, even in the chat
            text = "I couldn't verify that against your catalogue, so I won't quote it. Could you rephrase or name the product?"
        used_ids = set(map(str, data.get("used_fact_ids") or []))
        unresolved = list(dict.fromkeys([str(u)[:300] for u in (data.get("unresolved") or [])] + ev.unresolved))[:10]
        return self._finish(rid, thread_id, CopilotOperation.ANSWER, req, metrics, t0, message=text,
                            facts_used=[f for f in ev.facts if f.fact_id in used_ids][:40], unresolved=unresolved,
                            status=_evidence_status(CopilotOperation.ANSWER, metrics["levels"], len(ev.facts)))

    @staticmethod
    def _check(proposal: str, req: CopilotRequest, ev: EvidenceSet, grounding: str) -> List[CopilotIssue]:
        issues = composer_mod.validate_proposal(proposal, req.draft_text, ev, grounding, employee_text(req))
        if req.draft_text.strip() and _norm(proposal) == _norm(req.draft_text):
            issues.append(CopilotIssue(code="UNCHANGED", detail="The suggestion is identical to the current draft."))
        return issues

    @staticmethod
    def _count(metrics: Dict[str, Any], cm: Dict[str, Any]) -> None:
        metrics["llm_calls"] += cm.get("compose_llm_calls", 0)
        metrics["compose_ms"] = round(metrics.get("compose_ms", 0) + cm.get("compose_ms", 0), 1)
        tok = cm.get("compose_tokens")
        if tok:
            agg = metrics.setdefault("compose_tokens", {"prompt": 0, "completion": 0})
            agg["prompt"] += tok.get("prompt") or 0
            agg["completion"] += tok.get("completion") or 0

    @staticmethod
    def _final_operation(decision: CopilotDecision, levels: List[str]) -> CopilotOperation:
        if not decision.fact_requests:
            return CopilotOperation.WRITING_ONLY
        if levels and all(lv == "L1_reuse" for lv in levels):
            return CopilotOperation.MIXED if decision.operation == CopilotOperation.MIXED else CopilotOperation.EVIDENCE_REUSE
        return decision.operation if decision.operation in (CopilotOperation.MIXED, CopilotOperation.NEW_RETRIEVAL) \
            else CopilotOperation.NEW_RETRIEVAL

    @staticmethod
    async def _with_closing(tenant_id: str, snap, proposal: str) -> str:
        try:
            from app.services.reply_planner.closing import apply_closing
            from app.services.reply_planner.service import ReplyPlannerService
            closing = await ReplyPlannerService._resolve_closing(tenant_id, (snap.latest_inbound or {}).get("id") or "")
            return apply_closing(proposal, closing)
        except Exception:  # noqa: BLE001 - the sign-off must never fail a proposal
            return proposal

    @staticmethod
    def _finish(rid: str, thread_id: str, op: CopilotOperation, req: CopilotRequest, metrics: Dict[str, Any],
                t0: float, proposal: str = "", summary: str = "", facts_used=None, unresolved=None, issues=None,
                status: str = "", clarification: Optional[str] = None, message: str = "") -> CopilotResult:
        metrics["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        issues = issues or []
        result = CopilotResult(
            request_id=rid, thread_id=thread_id, operation=op, proposal=proposal, message=message, changes_summary=summary,
            base_draft_revision=req.draft_revision, apply_allowed=bool(proposal) and not issues,
            facts_used=facts_used or [], unresolved=unresolved or [], issues=issues,
            clarification_question=clarification, evidence_status=status or ("Needs clarification" if clarification else ""),
            metrics=metrics)
        # Observability without private content: ids, decisions, counts and timings only.
        logger.info("copilot request completed", request_id=rid, thread_id=thread_id, operation=op.value,
                    decided_by=metrics.get("decided_by"), levels=metrics.get("levels"), llm_calls=metrics["llm_calls"],
                    retrieval_calls=metrics["retrieval_calls"], extra_retrievals=metrics["extra_retrievals"],
                    repairs=metrics["repairs"], issues=[i.code for i in issues], apply_allowed=result.apply_allowed,
                    total_ms=metrics["total_ms"])
        return result


reply_copilot_service = ReplyCopilotService()
