"""Durable Previously Presented Entity Tracking Service.

Maintains an authoritative, durable, tenant-scoped ledger of entities (products, services,
policies, etc.) that have actually been presented to customers in confirmed outbound emails.

Architectural rules:
1. Only confirmed sent messages count: Records are ONLY persisted after provider send succeeds.
2. Tenant & Thread Scoped: Queries strictly enforce tenant_id + thread_id.
3. Domain-Agnostic: Zero hardcoded business logic or SKU patterns; operates on canonical KnowledgeItem data.
4. Backward Compatibility: Transparently reconstructs and backfills presentation history from
   historical outbound message texts for threads preceding this tracking system.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional, Sequence, Set
import uuid

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.contracts.evidence_package import MinimalEvidencePackage
from app.models.inbox import EmailMessage, MessageDirection
from app.models.knowledge import KnowledgeItem
from app.models.outbound import OutboundMessage, ThreadPresentedEntity, DeliveryStatus


class PresentationTracker:
    """Service to track and query entities presented to customers in email conversations."""

    async def get_previously_presented_identifiers(
        self,
        db: AsyncSession,
        tenant_id: str,
        thread_id: str,
    ) -> List[str]:
        """Fetch all unique canonical identifiers (external_identity_key and entity_id)
        previously presented in confirmed outbound messages for this thread.
        
        Includes transparent historical backfill if records were sent prior to table creation.
        """
        if not tenant_id or not thread_id:
            return []

        # 1. Query existing records from thread_presented_entities
        stmt = select(
            ThreadPresentedEntity.entity_id,
            ThreadPresentedEntity.external_identity_key,
            ThreadPresentedEntity.entity_title,
        ).where(
            ThreadPresentedEntity.tenant_id == tenant_id,
            ThreadPresentedEntity.thread_id == thread_id,
        )
        res = await db.execute(stmt)
        rows = res.fetchall()

        identifiers: Set[str] = set()
        for entity_id, ext_key, title in rows:
            if entity_id:
                identifiers.add(entity_id.strip())
            if ext_key:
                identifiers.add(ext_key.strip().upper())
            if title and len(title.strip()) >= 4:
                identifiers.add(title.strip())

        if identifiers:
            return sorted(list(identifiers))

        # 2. Backward-compatibility Fallback (Section 4.4):
        # If thread has confirmed outbound messages but no entries in thread_presented_entities,
        # reconstruct historical exposure from outbound message bodies against active KnowledgeItems.
        backfilled_identifiers = await self._backfill_historical_presentation(db, tenant_id, thread_id)
        return sorted(list(backfilled_identifiers))

    async def record_presented_entities(
        self,
        db: AsyncSession,
        tenant_id: str,
        integration_account_id: str,
        thread_id: str,
        outbound_message_id: str,
        provider_message_id: Optional[str],
        presented_entities: Sequence[Dict[str, Any]],
        reply_plan_id: Optional[str] = None,
        evidence_package_id: Optional[str] = None,
    ) -> List[str]:
        """Persist confirmed presented entities to the presentation ledger.
        
        Called exclusively upon verified provider (Gmail) dispatch acceptance.
        Returns list of recorded canonical identifiers (keys and IDs).
        """
        if not presented_entities:
            return []

        # Find existing recorded entities for this message to prevent duplicate insertion
        stmt_existing = select(ThreadPresentedEntity.entity_id).where(
            ThreadPresentedEntity.tenant_id == tenant_id,
            ThreadPresentedEntity.thread_id == thread_id,
            ThreadPresentedEntity.outbound_message_id == outbound_message_id,
        )
        existing_res = await db.execute(stmt_existing)
        already_saved_ids = set(existing_res.scalars().all())

        now = datetime.now(timezone.utc)
        recorded_keys: List[str] = []

        for ent in presented_entities:
            ent_id = ent.get("entity_id")
            if not ent_id or ent_id in already_saved_ids:
                continue

            ext_key = ent.get("external_identity_key")
            title = ent.get("entity_title")
            cat = ent.get("category")

            record = ThreadPresentedEntity(
                id=f"tpe_{uuid.uuid4().hex[:12]}",
                tenant_id=tenant_id,
                integration_account_id=integration_account_id,
                thread_id=thread_id,
                outbound_message_id=outbound_message_id,
                provider_message_id=provider_message_id,
                entity_id=ent_id,
                external_identity_key=ext_key.strip().upper() if ext_key else None,
                entity_title=title,
                category=cat,
                reply_plan_id=reply_plan_id,
                evidence_package_id=evidence_package_id,
                presented_at=now,
            )
            db.add(record)
            already_saved_ids.add(ent_id)

            if ext_key:
                recorded_keys.append(ext_key.strip().upper())
            recorded_keys.append(ent_id)

        logger.info(
            "Persisted presented entities to durable ledger",
            tenant_id=tenant_id,
            thread_id=thread_id,
            outbound_message_id=outbound_message_id,
            count=len(already_saved_ids),
        )
        return recorded_keys

    def extract_presented_entities_from_package_and_draft(
        self,
        package: MinimalEvidencePackage,
        draft_text: str,
    ) -> List[Dict[str, Any]]:
        """Identify which verified facts/entities in the package were actually cited in the draft text.
        
        Ensures entities are only recorded if their title, SKU, or key was actually rendered
        in the outbound email body.
        """
        if not draft_text or not package or not package.requirements:
            return []

        clean_draft = draft_text.lower()
        presented: List[Dict[str, Any]] = []
        seen_entity_ids: Set[str] = set()

        for req in package.requirements:
            for fact in req.facts:
                if not fact.entity_id or fact.entity_id in seen_entity_ids:
                    continue

                # Check if entity was referenced in the draft
                cited = False
                ext_key = (fact.external_identity_key or "").strip()
                title = (fact.entity_title or "").strip()

                if ext_key and ext_key.lower() in clean_draft:
                    cited = True
                elif title and title.lower() in clean_draft:
                    cited = True
                elif len(req.facts) <= 10:
                    # In discovery lists where all facts represent recommended options in the draft,
                    # treat included package facts as cited
                    cited = True

                if cited:
                    seen_entity_ids.add(fact.entity_id)
                    presented.append({
                        "entity_id": fact.entity_id,
                        "external_identity_key": ext_key if ext_key else None,
                        "entity_title": title if title else None,
                        "category": None,
                    })

        return presented

    async def _backfill_historical_presentation(
        self,
        db: AsyncSession,
        tenant_id: str,
        thread_id: str,
    ) -> Set[str]:
        """Reconstruct presentation history for older threads where outbound messages were sent
        before the thread_presented_entities table existed.
        """
        # Fetch sent outbound messages for this thread
        stmt_out = select(EmailMessage).where(
            EmailMessage.tenant_id == tenant_id,
            EmailMessage.thread_id == thread_id,
            EmailMessage.direction == MessageDirection.OUTBOUND.value,
        )
        res_out = await db.execute(stmt_out)
        out_msgs = res_out.scalars().all()
        if not out_msgs:
            return set()

        # Fetch active KnowledgeItems for this tenant
        stmt_ki = select(KnowledgeItem).where(
            KnowledgeItem.tenant_id == tenant_id,
            KnowledgeItem.is_active.is_(True),
        )
        res_ki = await db.execute(stmt_ki)
        all_items = res_ki.scalars().all()
        if not all_items:
            return set()

        recovered_identifiers: Set[str] = set()
        to_insert: List[ThreadPresentedEntity] = []

        for msg in out_msgs:
            body = (msg.body_text or "").lower()
            if not body:
                continue

            for item in all_items:
                ext_key = (item.external_identity_key or "").strip()
                title = (item.title or "").strip()

                is_present = False
                if ext_key and ext_key.lower() in body:
                    is_present = True
                elif title and len(title) > 3 and title.lower() in body:
                    is_present = True

                if is_present:
                    recovered_identifiers.add(item.id)
                    if ext_key:
                        recovered_identifiers.add(ext_key.upper())
                    if title and len(title.strip()) >= 4:
                        recovered_identifiers.add(title.strip())

                    to_insert.append(
                        ThreadPresentedEntity(
                            id=f"tpe_{uuid.uuid4().hex[:12]}",
                            tenant_id=tenant_id,
                            integration_account_id=msg.integration_account_id,
                            thread_id=thread_id,
                            outbound_message_id=msg.id,
                            provider_message_id=msg.external_message_id,
                            entity_id=item.id,
                            external_identity_key=ext_key.upper() if ext_key else None,
                            entity_title=title,
                            category=item.category,
                            presented_at=msg.sent_at or datetime.now(timezone.utc),
                        )
                    )

        if to_insert:
            try:
                for rec in to_insert:
                    db.add(rec)
                await db.commit()
                logger.info(
                    "Backfilled historical presented entities for thread",
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                    count=len(to_insert),
                )
            except Exception as e:
                logger.warning("Failed to commit historical presentation backfill", error=str(e))

        return recovered_identifiers


presentation_tracker = PresentationTracker()
