"""AI Reply Copilot against a real (isolated, seeded) tenant: tenant isolation of the thread snapshot,
L1 re-read of current records, and live end-to-end runs (OpenAI) for writing-only, add-a-price and
compose-from-empty. Uses only the seeded test tenant (never business data); never sends email."""

import os

import pytest

from app.core.database import db_manager
from app.services.reply_copilot import evidence
from app.services.reply_copilot.contracts import CopilotOperation, CopilotRequest
from app.services.reply_copilot.service import ReplyCopilotService

pytestmark = pytest.mark.asyncio(loop_scope="session")

LIVE = bool(os.getenv("OPENAI_API_KEY", "").startswith("sk-") and not os.getenv("OPENAI_API_KEY", "").startswith("sk-dummy"))


@pytest.fixture(autouse=True)
def _never_send(monkeypatch):
    from app.services.reply_planner import delivery

    async def forbidden(*a, **k):
        raise AssertionError("Copilot must never send email")
    for name in ("send_draft", "send_manual_reply", "deliver_reply"):
        monkeypatch.setattr(delivery.outbound_delivery_service, name, forbidden)


async def test_thread_snapshot_is_tenant_scoped(seeded_conversation):
    ids = seeded_conversation
    async with db_manager.session_factory() as db:
        own = await evidence.load_thread(db, ids["tenant_id"], ids["thread_id"])
        foreign = await evidence.load_thread(db, "org_someone_else_entirely", ids["thread_id"])
    assert own is not None and own.latest_inbound and "more service options" in own.latest_inbound["body_text"]
    assert foreign is None


async def test_context_records_reread_current_versions(seeded_conversation):
    ids = seeded_conversation
    async with db_manager.session_factory() as db:
        facts, missing = await evidence.context_records(db, ids["tenant_id"], ["HA-001", "ZZ-99999"], [])
        other, _ = await evidence.context_records(db, "org_someone_else_entirely", ["HA-001"], [])
        assert await evidence.versions_still_current(db, ids["tenant_id"], facts["HA-001"])
    assert "HA-001" in facts and any(f.attribute == "price" for f in facts["HA-001"])
    assert missing == ["ZZ-99999"] and other == {}


@pytest.mark.skipif(not LIVE, reason="needs a real OpenAI key")
async def test_live_writing_only_makes_no_retrieval(seeded_conversation):
    ids = seeded_conversation
    draft = "hi,\n\nthanks for asking. we have more services, let me know which one you want\n\nRegards,\nSupport"
    res = await ReplyCopilotService().refine(ids["tenant_id"], ids["thread_id"], CopilotRequest(
        instruction="Make it more professional and fix the grammar", draft_text=draft, draft_revision="r-test"))
    print("\nWRITING_ONLY", res.metrics)
    assert res.operation == CopilotOperation.WRITING_ONLY and res.metrics["retrieval_calls"] == 0
    assert res.metrics["decision_llm_calls"] == 0 and res.proposal and res.base_draft_revision == "r-test"
    assert res.apply_allowed, res.issues


@pytest.mark.skipif(not LIVE, reason="needs a real OpenAI key")
async def test_live_add_price_uses_verified_record(seeded_conversation):
    ids = seeded_conversation
    async with db_manager.session_factory() as db:
        facts, _ = await evidence.context_records(db, ids["tenant_id"], ["HA-001"], [])
    price = next(f.value for f in facts["HA-001"] if f.attribute == "price")
    draft = "Hello,\n\nHA-001 is one of the services we can offer you.\n\nRegards,\nSupport"
    res = await ReplyCopilotService().refine(ids["tenant_id"], ids["thread_id"], CopilotRequest(
        instruction="Add the price of HA-001", draft_text=draft))
    print("\nADD_PRICE", res.operation, res.evidence_status, res.metrics)
    assert res.operation in (CopilotOperation.EVIDENCE_REUSE, CopilotOperation.NEW_RETRIEVAL, CopilotOperation.MIXED)
    assert res.apply_allowed, res.issues
    whole = price.split(".")[0]
    assert whole in res.proposal.replace(",", ""), res.proposal


@pytest.mark.skipif(not LIVE, reason="needs a real OpenAI key")
async def test_live_compose_from_empty_draft_is_grounded(seeded_conversation):
    ids = seeded_conversation
    res = await ReplyCopilotService().refine(ids["tenant_id"], ids["thread_id"], CopilotRequest(
        instruction="Write a reply to the customer", draft_text=""))
    print("\nCOMPOSE", res.operation, res.evidence_status, res.metrics)
    assert res.proposal and res.operation != CopilotOperation.WRITING_ONLY
    assert res.issues == [] or not res.apply_allowed           # never applicable with unverified facts
