"""Novelty-Aware Conversational Continuation Pipeline Regression Tests.

Validates:
1. Presentation Tracker backfill and lookup for confirmed outbound recommendations.
2. Context Resolver populating `previously_presented_entity_ids` and discovery scope.
3. Requirement Planner fast-path continuation recognition (`MORE_OPTIONS` / `DIFFERENT_OPTIONS`)
   preserving category/constraints and injecting exclusions.
4. Novelty-Aware Retrieval Router (PostgreSQL & Qdrant) excluding all previously presented entities
   and utilizing adaptive over-fetching to eliminate top-K exhaustion.
5. Evidence Fusion & Minimal Evidence Package carrying continuation metadata and verified novelty.
6. Reply Drafter & Deterministic Pre-Send Validator guaranteeing zero repeated entity leakage.
"""

import pytest

from app.core.database import db_manager
from app.services.context_resolver import context_resolver as conversation_context_resolver
from app.services.requirement_planner import requirement_planner_service
from app.services.retrieval_router import retrieval_router_service
from app.services.evidence_fusion import evidence_fusion_service
from app.services.evidence_package import evidence_package_service
from app.services.reply_planner import reply_planner_service
from app.services.presentation_tracker import presentation_tracker
from app.contracts.requirement_plan import IntentType


FIRST_TEN_SERVICES = {
    "HA-001", "HA-020", "HA-009", "HA-018", "HA-023",
    "HA-010", "HA-022", "HA-019", "HA-007", "HA-004",
}


@pytest.mark.asyncio
async def test_end_to_end_novelty_aware_continuation_pipeline(seeded_conversation):
    """Execute complete 6-stage regression against a seeded thread and PostgreSQL catalogue."""
    TENANT_ID = seeded_conversation["tenant_id"]
    ACCOUNT_ID = seeded_conversation["account_id"]
    THREAD_ID = seeded_conversation["thread_id"]
    FOLLOW_UP_MSG_ID = seeded_conversation["follow_up_id"]
    db_manager.initialize()

    # Step 1: Presentation Tracker lookup and historical backfill
    async with db_manager.session_factory() as db:
        presented_ids = await presentation_tracker.get_previously_presented_identifiers(
            db=db,
            tenant_id=TENANT_ID,
            thread_id=THREAD_ID,
        )

    found_keys = {k for k in presented_ids if k in FIRST_TEN_SERVICES}
    assert len(found_keys) >= 5, "Presentation tracker failed to recover initial presented services!"

    # Step 2: Context Resolver for Follow-up Message
    envelope = await conversation_context_resolver.resolve_context(
        tenant_id=TENANT_ID,
        integration_account_id=ACCOUNT_ID,
        thread_id=THREAD_ID,
        current_message_id=FOLLOW_UP_MSG_ID,
    )
    assert len(envelope.previously_presented_entity_ids) > 0, "Envelope must have previously presented IDs!"

    # Step 3: Requirement & Intent Planner for Continuation
    plan = await requirement_planner_service.plan_requirements(
        envelope=envelope,
        dispatch_event=False,
    )
    assert plan.intent in (IntentType.MORE_OPTIONS, IntentType.PRODUCT_DISCOVERY)
    assert plan.is_continuation is True, "Plan must be marked as continuation!"
    assert len(plan.excluded_entity_ids) > 0, "Plan must carry excluded entity IDs!"
    assert plan.validation_status.value == "ready_for_retrieval"

    # Step 4: Novelty-Aware Retrieval Router
    retrieval_res = await retrieval_router_service.route_and_retrieve(
        tenant_id=TENANT_ID,
        plan=plan,
        dispatch_event=False,
    )
    retrieved_keys = []
    for item in retrieval_res.results:
        key = item.external_identity_key or item.entity_id
        retrieved_keys.append(key)

    # CRITICAL INVARIANT: ZERO duplicate services from first ten!
    duplicates = set(retrieved_keys).intersection(FIRST_TEN_SERVICES)
    assert len(duplicates) == 0, f"REGRESSION FAILED: Retrieved duplicates from first list: {duplicates}"
    assert len(retrieval_res.results) > 0, "Retrieval returned 0 results!"

    # Step 5: Candidate Fusion & Minimal Evidence Package
    fusion_res = await evidence_fusion_service.fuse_and_verify(
        tenant_id=TENANT_ID,
        plan=plan,
        retrieval_result=retrieval_res,
        dispatch_event=False,
    )
    assert len(fusion_res.verified_facts) > 0

    package_res = await evidence_package_service.build_package(
        tenant_id=TENANT_ID,
        fusion_result=fusion_res,
        plan=plan,
        dispatch_event=False,
    )
    assert package_res.is_continuation is True
    assert package_res.action_context.safe_response_strategy == "continuation_discovery"

    # Step 6: Reply Planner & Deterministic Validator
    reply_plan = await reply_planner_service.plan_and_draft_reply(
        tenant_id=TENANT_ID,
        package=package_res,
        dispatch_event=False,
    )
    assert reply_plan.validation_report.validation_passed is True
    assert reply_plan.validation_report.is_sendable is True

    # Check for duplicate entity leakage in draft text
    for old_sku in FIRST_TEN_SERVICES:
        assert old_sku not in reply_plan.draft.body_text, f"Draft body leaked old SKU {old_sku}!"
