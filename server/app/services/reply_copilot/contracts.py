"""Typed contracts of the AI Reply Copilot (an isolated drafting workspace for one conversation).

The Copilot never sends email: it returns a *proposal* the user can apply to the editor; sending
stays the editor's explicit Send action (``/feedback/drafts/{id}/send`` or ``/threads/{id}/reply``).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CopilotOperation(str, Enum):
    WRITING_ONLY = "WRITING_ONLY"          # tone / grammar / length / translation: no business retrieval
    EVIDENCE_REUSE = "EVIDENCE_REUSE"      # facts come from items already in this conversation (re-read)
    NEW_RETRIEVAL = "NEW_RETRIEVAL"        # new facts through the existing retrieval pipeline
    MIXED = "MIXED"                        # writing change + some reused and/or newly retrieved facts
    CLARIFY = "CLARIFY"                    # the instruction itself is ambiguous: ask the user


class EvidenceSource(str, Enum):
    CONTEXT_RECORD = "context_record"      # L1: current version of an item already in the thread
    CACHE = "cache"                        # L2: exact identity cache hit (re-verified by fusion)
    RETRIEVAL = "retrieval"                # L3: primary retrieval (PostgreSQL index + Qdrant + keyword)


class CopilotTurn(BaseModel):
    """A previous instruction in this Copilot session (the user's own words; no customer content)."""
    instruction: str = Field(max_length=2000)
    applied: bool = False


class CopilotRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=2000)
    draft_text: str = Field(default="", max_length=20000)
    # Opaque revision of the editor text the proposal is based on; echoed back so the client can
    # refuse to apply a proposal over newer editor content (optimistic concurrency).
    draft_revision: Optional[str] = Field(default=None, max_length=128)
    history: List[CopilotTurn] = Field(default_factory=list, max_length=8)


class FactRequest(BaseModel):
    """One piece of business information the instruction needs (validated AI #1 output)."""
    request: str = Field(max_length=400, description="Standalone customer-style question for retrieval")
    attributes: List[str] = Field(default_factory=list, max_length=8)
    entity_codes: List[str] = Field(default_factory=list, max_length=10)
    about_context_items: bool = False


class CopilotDecision(BaseModel):
    """AI #1 output after backend validation (allowlisted fields only; no SQL / filters / tenant IDs)."""
    operation: CopilotOperation
    writing_goal: str = ""
    fact_requests: List[FactRequest] = Field(default_factory=list, max_length=3)
    clarification_question: Optional[str] = None
    decided_by: str = "rules"            # rules | llm | fallback


class CopilotFact(BaseModel):
    fact_id: str
    entity_id: Optional[str] = None
    entity_code: Optional[str] = None
    entity_title: Optional[str] = None
    attribute: str
    value: str
    source: EvidenceSource
    authority: str = "verified catalogue record"
    version_id: Optional[str] = None


class EvidenceSet(BaseModel):
    facts: List[CopilotFact] = Field(default_factory=list)
    unresolved: List[str] = Field(default_factory=list)          # honest gaps (never filled by the model)
    unknown_codes: List[Dict[str, Any]] = Field(default_factory=list)   # {requested, suggestions}
    search_incomplete: bool = False
    sources_used: List[str] = Field(default_factory=list)


class CopilotIssue(BaseModel):
    code: str
    detail: str


class CopilotResult(BaseModel):
    request_id: str
    thread_id: str
    operation: CopilotOperation
    proposal: str = ""
    changes_summary: str = ""
    base_draft_revision: Optional[str] = None
    apply_allowed: bool = False
    facts_used: List[CopilotFact] = Field(default_factory=list)
    unresolved: List[str] = Field(default_factory=list)
    issues: List[CopilotIssue] = Field(default_factory=list)
    clarification_question: Optional[str] = None
    evidence_status: str = ""            # human-readable: "No retrieval needed", "Reused 3 verified facts"...
    metrics: Dict[str, Any] = Field(default_factory=dict)
