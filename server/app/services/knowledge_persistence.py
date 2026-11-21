"""Phase 8.5 — Enterprise Bulk Knowledge Persistence Service.

Converts Phase 8.4 normalized, validated, and deduplicated records into durable
canonical PostgreSQL knowledge data via controlled batched transactions.

Design Invariants
-----------------
1. BULK-ONLY writes — never INSERT one row per transaction.
2. N+1 protected — one bulk SELECT per batch; O(1) in-memory matching thereafter.
3. Bounded memory — batches are processed and released; no full dataset accumulation.
4. Idempotent — external_identity_key DB uniqueness + in-batch deduplication guard
   make the operation safe to retry after worker crash.
5. Tenant security — tenant_id, source_id, and job_id are derived from the
   authoritative ImportJob DB record; NormalizedRecordDTO.organization_id is only
   used for assertion, never trusted for writes.
6. Controlled transactions — one COMMIT per batch; failed batch rolls back without
   corrupting already-committed batches.
7. Source lineage preserved — every KnowledgeVersion links to the ImportJob's
   KnowledgeSource with full authority_level, source_id, and temporal metadata.

Batch algorithm
---------------
For each batch of NormalizedRecordDTO:

    1. Filter: drop INVALID records and pure compatible duplicates (configurable).
    2. Extract the external_identity_key for every candidate record.
    3. Single bulk SELECT: load all existing KnowledgeItems in this
       (tenant_id, category) matching the batch's identity keys.
    4. Build O(1) in-memory lookup dict: identity_key → KnowledgeItem.
    5. Partition batch into: new_records | update_records | conflict_records.
    6. Bulk INSERT new KnowledgeItems (one executemany call).
    7. flush() — get assigned IDs without committing.
    8. Bulk INSERT KnowledgeVersions for both new and updated items.
    9. flush() — get version IDs.
    10. Bulk INSERT KnowledgeAttributes (one executemany call per typed slot).
    11. Bulk UPDATE KnowledgeItem.current_version_id for updated items.
    12. COMMIT — atomic, durable.
    13. Yield BatchPersistenceResultDTO.

Database round trips per batch: ~6–8 regardless of batch size.
"""

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, Generator, List, Optional, Tuple
import uuid

from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.data_quality import (
    BatchQualityResultDTO,
    NormalizedRecordDTO,
    QualityRowStatus,
)
from app.contracts.persistence import (
    BatchPersistenceResultDTO,
    ImportPersistenceSummaryDTO,
    PersistenceBatchConfig,
    PersistenceOutcome,
    RecordPersistenceResultDTO,
)
from app.core.logging import logger
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeSemanticChunk,
    KnowledgeLifecycleStatus,
    KnowledgeSource,
    KnowledgeSourceType,
    KnowledgeVersion,
    SourceAuthorityLevel,
)

_log = logging.getLogger(__name__)


from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from datetime import date
from app.contracts.knowledge import normalize_category_key

# ---------------------------------------------------------------------------
# Identity Key Helpers
# ---------------------------------------------------------------------------

_IDENTITY_PREFIX = "org:"


def _without_positional(data: Any) -> Any:
    """Copy of a canonical dict without row-position attributes (top level and custom_attributes)."""
    from app.algorithms.deduplication.category_identity import is_positional_key

    if not isinstance(data, dict):
        return data
    out = {k: v for k, v in data.items() if not is_positional_key(k)}
    if isinstance(out.get("custom_attributes"), dict):
        out["custom_attributes"] = {k: v for k, v in out["custom_attributes"].items() if not is_positional_key(k)}
    return out


def _strip_identity_key(full_key: str) -> str:
    """Extract the stable business identity key.

    If full_key is 'org:{org}:cat:{cat}:ext:{ext_key}', extracts '{ext_key}'.
    Otherwise strips leading org:{org}:cat:{cat}: to preserve category-scoped fallback.
    """
    if not full_key:
        return full_key
    ext_pos = full_key.find(":ext:")
    if ext_pos >= 0:
        return full_key[ext_pos + 5:]
    cat_pos = full_key.find(":cat:")
    if cat_pos >= 0:
        rest = full_key[cat_pos + 5:]
        colon_pos = rest.find(":")
        if colon_pos >= 0:
            return rest[colon_pos + 1:]
        return rest
    return full_key


def _normalize_val_for_comparison(val: Any) -> Any:
    """Deterministic normalizer for deep canonical payload equivalence checks."""
    if isinstance(val, dict):
        return {str(k): _normalize_val_for_comparison(v) for k, v in val.items() if v is not None}
    if isinstance(val, list):
        return [_normalize_val_for_comparison(v) for v in val]
    if isinstance(val, (int, float, Decimal)):
        try:
            return str(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        except Exception:
            return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if val is None:
        return None
    s = str(val).strip()
    return s.lower() if s else None


_COMPARISON_IGNORED_KEYS = frozenset({"custom_attributes_json"})


def _is_canonical_identical(d1: Optional[Dict[str, Any]], d2: Optional[Dict[str, Any]]) -> bool:
    """Check if two canonical data payloads are semantically identical."""
    if d1 is None and d2 is None:
        return True
    if d1 is None or d2 is None:
        return False
    # Legacy rows carry a redundant "custom_attributes_json" copy that is no longer
    # written; ignore it so re-imports of unchanged rows stay UNCHANGED.
    d1 = _without_positional({k: v for k, v in d1.items() if k not in _COMPARISON_IGNORED_KEYS})
    d2 = _without_positional({k: v for k, v in d2.items() if k not in _COMPARISON_IGNORED_KEYS})
    norm1 = _normalize_val_for_comparison(d1)
    norm2 = _normalize_val_for_comparison(d2)
    return bool(norm1 == norm2)


def _parse_datetime_field(val: Any) -> Optional[datetime]:
    """Parse various date/datetime inputs into UTC datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time(), tzinfo=timezone.utc)
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "blank", "nan", ""):
        return None
    try:
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    return None


def _extract_tags(rec: NormalizedRecordDTO) -> Optional[str]:
    """Extract and normalize tags/keywords into a valid JSON array string."""
    raw = (
        rec.canonical_data.get("tags")
        or rec.canonical_data.get("keywords")
        or (rec.custom_attributes.get("tags") if rec.custom_attributes else None)
        or (rec.custom_attributes.get("keywords") if rec.custom_attributes else None)
    )
    if not raw:
        return None
    if isinstance(raw, list):
        items = [str(x).strip() for x in raw if x is not None and str(x).strip()]
        return json.dumps(items) if items else None
    if isinstance(raw, str):
        items = [x.strip() for x in raw.split(",") if x.strip()]
        return json.dumps(items) if items else None
    return None


def _build_pricing_structure(
    canonical_data: Dict[str, Any],
    custom_attributes: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Build authoritative commercial pricing breakdown with exact 2-decimal precision (Problem 8)."""
    custom = custom_attributes or {}

    def _to_decimal(val: Any) -> Optional[float]:
        if val is None:
            return None
        s = re.sub(r"[^\d.\-]", "", str(val))
        if not s:
            return None
        try:
            d = Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return float(d)
        except (InvalidOperation, ValueError):
            return None

    base_price = _to_decimal(
        canonical_data.get("base_price") or canonical_data.get("price") or custom.get("base_price")
    )
    visit_charge = _to_decimal(canonical_data.get("visit_charge") or custom.get("visit_charge"))
    parts_est = _to_decimal(
        canonical_data.get("parts_estimate")
        or canonical_data.get("parts_cost_estimate")
        or custom.get("parts_estimate")
    )
    labor = _to_decimal(canonical_data.get("labor_charge") or custom.get("labor_charge"))
    disc_pct = _to_decimal(canonical_data.get("discount_percent") or custom.get("discount_percent"))
    tax_pct = _to_decimal(canonical_data.get("tax_percent") or custom.get("tax_percent"))
    final_price = _to_decimal(canonical_data.get("final_price") or custom.get("final_price"))

    if base_price is None and final_price is None and visit_charge is None:
        return None

    currency = canonical_data.get("currency") or custom.get("currency") or "INR"
    notes = str(canonical_data.get("notes") or custom.get("notes") or "").strip()

    # Controlled commercial price classification (fixed, estimate, starting_price, quote_required, not_specified)
    raw_cpt = (
        canonical_data.get("commercial_price_type")
        or canonical_data.get("price_type")
        or custom.get("commercial_price_type")
        or custom.get("price_type")
    )
    commercial_price_type = "not_specified"
    if raw_cpt:
        cpt_norm = str(raw_cpt).strip().lower().replace(" ", "_").replace("-", "_")
        if cpt_norm in ("fixed", "estimate", "starting_price", "quote_required", "not_specified"):
            commercial_price_type = cpt_norm
        elif "quote" in cpt_norm and "fixed" not in cpt_norm:
            commercial_price_type = "quote_required"
        elif "start" in cpt_norm:
            commercial_price_type = "starting_price"
        elif "fixed" in cpt_norm:
            commercial_price_type = "fixed"
        elif "est" in cpt_norm:
            commercial_price_type = "estimate"

    # Deterministic spreadsheet formula calculation if final total missing (pure Decimal arithmetic)
    if final_price is None and base_price is not None:
        d_base = Decimal(str(base_price)) if base_price is not None else Decimal("0.00")
        d_visit = Decimal(str(visit_charge)) if visit_charge is not None else Decimal("0.00")
        d_parts = Decimal(str(parts_est)) if parts_est is not None else Decimal("0.00")
        d_labor = Decimal(str(labor)) if labor is not None else Decimal("0.00")
        d_disc = Decimal(str(disc_pct)) if disc_pct is not None else Decimal("0.00")
        d_tax = Decimal(str(tax_pct)) if tax_pct is not None else Decimal("0.00")

        subtotal = d_base + d_visit + d_parts + d_labor
        disc_factor = Decimal("1.00") - (d_disc / Decimal("100.00"))
        tax_factor = Decimal("1.00") + (d_tax / Decimal("100.00"))
        calc_total = (subtotal * disc_factor * tax_factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        final_price = float(calc_total)

    pricing_obj = {
        "currency": currency,
        "base_price": base_price,
        "visit_charge": visit_charge,
        "parts_cost_estimate": parts_est,
        "labor_charge": labor,
        "discount_percent": disc_pct if disc_pct is not None else 0.0,
        "tax_percent": tax_pct if tax_pct is not None else 0.0,
        "estimated_total": final_price,
        "commercial_price_type": commercial_price_type,
        "price_type": commercial_price_type,
        "pricing_note": notes or None,
    }
    return {k: v for k, v in pricing_obj.items() if v is not None}



# ---------------------------------------------------------------------------
# Batch write helpers
# ---------------------------------------------------------------------------

_MONEY_KEYS = frozenset({
    "final_price", "base_price", "price", "visit_charge", "parts_estimate",
    "parts_cost", "labor_charge", "tax_amount", "discount_amount",
})

_TRANSIENT_ERROR_MARKERS = (
    "connection was closed",
    "connection is closed",
    "connectiondoesnotexisterror",
    "connection reset",
    "server closed the connection",
    "terminating connection",
    "timeout",
    "timed out",
    "cannot perform operation: another operation is in progress",
    "ssl",
)


def _is_transient_db_error(err: BaseException) -> bool:
    """Classify DB errors that are safe to retry on a fresh connection."""
    import asyncio
    from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
    from sqlalchemy.exc import TimeoutError as PoolTimeoutError

    # PoolTimeoutError: "QueuePool limit ... timed out" — every connection was busy on a slow
    # link for pool_timeout seconds. Transient by nature; it used to fail a finished import.
    if isinstance(err, (ConnectionError, asyncio.TimeoutError, TimeoutError, OSError, PoolTimeoutError)):
        return True
    if isinstance(err, (OperationalError, InterfaceError)):
        return True
    if isinstance(err, DBAPIError) and getattr(err, "connection_invalidated", False):
        return True
    text_l = f"{type(err).__name__} {err}".lower()
    return any(marker in text_l for marker in _TRANSIENT_ERROR_MARKERS)


async def _safe_rollback(db: AsyncSession) -> None:
    try:
        await db.rollback()
    except Exception:
        # Connection already dead — nothing to roll back; the pool discards it.
        pass


def _build_version_payload(
    rec: NormalizedRecordDTO,
) -> Tuple[str, Dict[str, Any], Optional[datetime], Optional[datetime]]:
    """Build (content_text, canonical_data, effective_from, effective_until) for a record."""
    custom = rec.custom_attributes or {}
    content_text = _build_content_text(rec)
    canonical_dict = dict(rec.canonical_data)
    if custom:
        canonical_dict["custom_attributes"] = dict(custom)

    pricing_struct = _build_pricing_structure(rec.canonical_data, custom)
    if pricing_struct:
        canonical_dict["pricing"] = pricing_struct
        if canonical_dict.get("price") is None:
            canonical_dict["price"] = pricing_struct.get("base_price") or pricing_struct.get("estimated_total")
        if "base_price" in pricing_struct:
            canonical_dict["base_price"] = pricing_struct["base_price"]
        if "final_price" in canonical_dict or "estimated_total" in pricing_struct:
            canonical_dict["final_price"] = pricing_struct.get("estimated_total")
        if "currency" in pricing_struct:
            canonical_dict["currency"] = pricing_struct["currency"]
        if "commercial_price_type" in pricing_struct:
            canonical_dict["commercial_price_type"] = pricing_struct["commercial_price_type"]

    # Sanitize monetary fields to eliminate raw float artifacts
    for m_k in _MONEY_KEYS:
        if canonical_dict.get(m_k) is not None:
            try:
                d_c = Decimal(re.sub(r"[^\d.\-]", "", str(canonical_dict[m_k]))).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                canonical_dict[m_k] = float(d_c)
            except Exception:
                pass

    # Commercial entity typing, derived once at write time. This mirrors the rule the
    # reconciliation used to apply with a full-table JSONB UPDATE on every import.
    entity_type = canonical_dict.get("entity_type")
    if not entity_type or str(entity_type).upper() == "SERVICE":
        product_type = str(custom.get("product_type") or "").lower()
        if "spare" in product_type:
            canonical_dict["entity_type"] = "PART"
        elif "raw" in product_type:
            canonical_dict["entity_type"] = "RAW_MATERIAL"
        elif "service" in product_type:
            canonical_dict["entity_type"] = "SERVICE"
        elif "accessory" in product_type:
            canonical_dict["entity_type"] = "ACCESSORY"
        else:
            canonical_dict["entity_type"] = "PRODUCT"

    eff_from = _parse_datetime_field(
        rec.canonical_data.get("effective_from")
        or custom.get("effective_from")
        or rec.canonical_data.get("valid_from")
        or custom.get("valid_from")
    )
    eff_until = _parse_datetime_field(
        rec.canonical_data.get("effective_until")
        or custom.get("effective_until")
        or rec.canonical_data.get("valid_until")
        or custom.get("valid_until")
    )
    return content_text, canonical_dict, eff_from, eff_until



# ---------------------------------------------------------------------------
# Binary COPY bulk loader
# ---------------------------------------------------------------------------
#
# SQLAlchemy's ORM bulk INSERT over asyncpg measured ~3-4x slower than the raw wire
# speed on a remote database (500 versions: ~9.5s vs ~2.5s). PostgreSQL's binary COPY
# protocol streams all rows in one message flow with minimal per-row framing, so a
# batch costs roughly its byte size divided by the link bandwidth.


async def _asyncpg_driver(db: AsyncSession):
    """Return the asyncpg connection behind this session's CURRENT transaction, or None.

    Must be called after at least one statement has run in the session, so that the
    SQLAlchemy-managed transaction is already open on the connection; COPY then runs
    inside that same transaction and is committed / rolled back with it.
    """
    try:
        conn = await db.connection()
        raw = await conn.get_raw_connection()
        drv = getattr(raw, "driver_connection", None)
        return drv if hasattr(drv, "copy_records_to_table") else None
    except Exception:
        return None


def _copy_columns(table, rows: List[Dict[str, Any]]):
    """Columns to COPY: every key provided plus NOT NULL columns that have a Python default."""
    provided = set().union(*(r.keys() for r in rows))
    cols = []
    for col in table.columns:
        if col.name in provided:
            cols.append(col)
        elif not col.nullable and col.server_default is None:
            if col.default is None:
                raise ValueError(f"COPY into {table.name}: missing required column {col.name}")
            cols.append(col)
    return cols


def _copy_value(col, row: Dict[str, Any]) -> Any:
    from sqlalchemy.types import JSON

    if col.name in row:
        val = row[col.name]
    elif col.default is not None:
        arg = col.default.arg
        val = arg(None) if callable(arg) else arg
    else:
        val = None
    if val is not None and isinstance(col.type, JSON):
        # asyncpg's json/jsonb codecs take the document as text.
        return json.dumps(val, default=str)
    return val


async def _bulk_insert(db: AsyncSession, model: Any, rows: List[Dict[str, Any]]) -> None:
    """Insert rows with binary COPY when on asyncpg; ORM bulk INSERT otherwise."""
    if not rows:
        return
    drv = await _asyncpg_driver(db)
    if drv is None:
        await db.execute(insert(model), rows)
        return
    table = model.__table__
    cols = _copy_columns(table, rows)
    records = [tuple(_copy_value(c, r) for c in cols) for r in rows]
    await drv.copy_records_to_table(
        table.name,
        records=records,
        columns=[c.name for c in cols],
    )


# ---------------------------------------------------------------------------
# KnowledgePersistenceService
# ---------------------------------------------------------------------------


class KnowledgePersistenceService:
    """Enterprise bulk canonical persistence engine for Phase 8.5.

    Consumes BatchQualityResultDTO batches from Phase 8.4 and persists them
    to PostgreSQL as KnowledgeItem + KnowledgeVersion + KnowledgeAttribute records.

    Usage
    -----
        svc = KnowledgePersistenceService(
            tenant_id=job.tenant_id,
            source_id=job.source_id,
            category="products_services",
            job_id=job.id,
            created_by_user_id=job.created_by_user_id,
            config=PersistenceBatchConfig(batch_size=500),
        )

        async for batch_result in svc.persist_batches(db, batch_generator):
            # update progress counters

        summary = svc.get_summary()
    """

    def __init__(
        self,
        tenant_id: str,
        source_id: str,
        category: str,
        job_id: str,
        created_by_user_id: Optional[str],
        authority_level: str = SourceAuthorityLevel.IMPORTED_DATA.value,
        config: Optional[PersistenceBatchConfig] = None,
    ):
        self.tenant_id = tenant_id
        self.source_id = source_id
        self.category = normalize_category_key(category)
        self.job_id = job_id
        self.created_by_user_id = created_by_user_id
        self.authority_level = authority_level
        self.config = config or PersistenceBatchConfig()
        self._summary = ImportPersistenceSummaryDTO()
        try:
            from app.core.config import get_settings

            self.persist_semantic_chunks = bool(
                get_settings().knowledge_import.knowledge_import_persist_semantic_chunks
            )
        except Exception:
            self.persist_semantic_chunks = False

    # ------------------------------------------------------------------
    # Public: streaming batch persistence
    # ------------------------------------------------------------------

    async def persist_batch(
        self,
        db: AsyncSession,
        batch: BatchQualityResultDTO,
    ) -> BatchPersistenceResultDTO:
        """Persist one bounded batch of quality records to PostgreSQL (single attempt).

        Each call runs within its own transaction. If the batch fails it is rolled back
        without affecting previously committed batches, and every candidate is reported
        as FAILED. Prefer ``persist_batch_with_retry`` from workers: it survives transient
        connection drops (serverless pooler resets) by retrying on a fresh session.

        Tenant security: all records are forced to self.tenant_id; the
        NormalizedRecordDTO.organization_id is asserted but never trusted for writes.
        """
        t0 = time.perf_counter()
        batch_result, results, candidates = self._filter_candidates(batch)
        if candidates:
            try:
                outcome = await self._write_candidates(db, candidates)
                self._apply_outcome(batch_result, results, outcome)
            except Exception as err:
                await _safe_rollback(db)
                self._mark_failed(batch, batch_result, results, candidates, err)
        return self._finalize_batch(batch, batch_result, results, t0)

    async def persist_batch_with_retry(
        self,
        session_factory: Callable[[], Any],
        batch: BatchQualityResultDTO,
        max_attempts: int = 3,
        base_delay_seconds: float = 0.5,
    ) -> BatchPersistenceResultDTO:
        """Persist a batch, retrying transient DB failures on a fresh session.

        Retrying is safe because persistence is idempotent: identity keys are matched
        against existing rows on every attempt, so a batch whose COMMIT reached the
        server before the connection dropped is re-classified as UNCHANGED instead of
        being inserted twice. Non-transient errors fail fast without retry.
        """
        result, _ = await self._persist_with_retry(
            session_factory, batch, project=False,
            max_attempts=max_attempts, base_delay_seconds=base_delay_seconds,
        )
        return result

    async def persist_and_project_batch(
        self,
        session_factory: Callable[[], Any],
        batch: BatchQualityResultDTO,
        max_attempts: int = 3,
        base_delay_seconds: float = 0.5,
    ) -> Tuple[BatchPersistenceResultDTO, List[Tuple[KnowledgeItem, KnowledgeVersion, Any]]]:
        """Streaming import entry point: persist + project a batch in ONE transaction.

        Items, versions (already carrying their projected content_text / chunk_count /
        projection_status) and semantic chunks are written together. Returns the
        (item, version, SemanticDocumentDTO) triples of everything written so the caller
        can embed + upsert to Qdrant straight from memory — no re-read of the batch.
        """
        result, outcome = await self._persist_with_retry(
            session_factory, batch, project=True,
            max_attempts=max_attempts, base_delay_seconds=base_delay_seconds,
        )
        indexable = (outcome or {}).get("indexable", []) if outcome else []
        return result, indexable

    async def _persist_with_retry(
        self,
        session_factory: Callable[[], Any],
        batch: BatchQualityResultDTO,
        project: bool,
        max_attempts: int = 3,
        base_delay_seconds: float = 0.5,
    ) -> Tuple[BatchPersistenceResultDTO, Optional[Dict[str, Any]]]:
        import asyncio

        t0 = time.perf_counter()
        batch_result, results, candidates = self._filter_candidates(batch)
        outcome: Optional[Dict[str, Any]] = None
        if candidates:
            last_err: Optional[BaseException] = None
            for attempt in range(1, max_attempts + 1):
                try:
                    async with session_factory() as db:
                        try:
                            outcome = await self._write_candidates(db, candidates, project=project)
                        except Exception:
                            await _safe_rollback(db)
                            raise
                    self._apply_outcome(batch_result, results, outcome)
                    last_err = None
                    break
                except Exception as err:
                    last_err = err
                    outcome = None
                    if attempt < max_attempts and _is_transient_db_error(err):
                        logger.warning(
                            "knowledge.persistence.batch_retry",
                            batch_index=batch.batch_index,
                            tenant_id=self.tenant_id,
                            attempt=attempt,
                            error=str(err)[:300],
                        )
                        await asyncio.sleep(base_delay_seconds * (2 ** (attempt - 1)))
                        continue
                    break
            if last_err is not None:
                self._mark_failed(batch, batch_result, results, candidates, last_err)
        return self._finalize_batch(batch, batch_result, results, t0), outcome

    # ------------------------------------------------------------------
    # Batch pipeline steps
    # ------------------------------------------------------------------

    def _filter_candidates(
        self, batch: BatchQualityResultDTO
    ) -> Tuple[BatchPersistenceResultDTO, List[RecordPersistenceResultDTO], List[NormalizedRecordDTO]]:
        """Drop invalid / duplicate / conflicting / foreign-tenant records (pure, no I/O)."""
        results: List[RecordPersistenceResultDTO] = []
        batch_result = BatchPersistenceResultDTO(
            batch_index=batch.batch_index,
            total_rows=batch.total_rows,
        )
        candidates: List[NormalizedRecordDTO] = []
        seen_keys: set = set()

        for rec in batch.records:
            # Security assertion: verify tenant matches authoritative job context
            if rec.organization_id != self.tenant_id:
                logger.warning(
                    "Tenant mismatch in normalized record — skipping",
                    record_org=rec.organization_id,
                    job_tenant=self.tenant_id,
                    row=rec.row_number,
                )
                batch_result.failed_count += 1
                results.append(RecordPersistenceResultDTO(
                    row_number=rec.row_number,
                    outcome=PersistenceOutcome.FAILED,
                    identity_key=rec.identity_key,
                    error_message="Tenant ID mismatch: record organization_id does not match job tenant.",
                ))
                continue

            # Skip Phase 8.4 INVALID records (never persist invalid data)
            if rec.status == QualityRowStatus.INVALID:
                if self.config.skip_invalid_records:
                    batch_result.invalid_count += 1
                    results.append(RecordPersistenceResultDTO(
                        row_number=rec.row_number,
                        outcome=PersistenceOutcome.INVALID,
                        identity_key=rec.identity_key,
                    ))
                    continue
                batch_result.failed_count += 1
                results.append(RecordPersistenceResultDTO(
                    row_number=rec.row_number,
                    outcome=PersistenceOutcome.FAILED,
                    identity_key=rec.identity_key,
                    error_message="Record failed Phase 8.4 validation (INVALID status).",
                ))
                continue

            # Skip compatible duplicates if configured
            if rec.is_duplicate and not rec.is_conflict:
                if self.config.skip_duplicate_records:
                    batch_result.duplicate_count += 1
                    results.append(RecordPersistenceResultDTO(
                        row_number=rec.row_number,
                        outcome=PersistenceOutcome.DUPLICATE,
                        identity_key=rec.identity_key,
                    ))
                    continue

            # Skip conflicting duplicates if configured
            if rec.is_conflict:
                if self.config.skip_conflict_records:
                    batch_result.conflict_count += 1
                    results.append(RecordPersistenceResultDTO(
                        row_number=rec.row_number,
                        outcome=PersistenceOutcome.CONFLICT,
                        identity_key=rec.identity_key,
                        conflict_fields=rec.conflict_details,
                    ))
                    continue

            # In-batch identity guard: two rows with the same identity key would violate
            # uq_knowledge_items_tenant_cat_identity and roll back the WHOLE batch.
            db_key = _strip_identity_key(rec.identity_key)
            if db_key in seen_keys:
                batch_result.duplicate_count += 1
                results.append(RecordPersistenceResultDTO(
                    row_number=rec.row_number,
                    outcome=PersistenceOutcome.DUPLICATE,
                    identity_key=rec.identity_key,
                ))
                continue
            seen_keys.add(db_key)
            candidates.append(rec)

        return batch_result, results, candidates

    async def _write_candidates(
        self,
        db: AsyncSession,
        candidates: List[NormalizedRecordDTO],
        project: bool = False,
    ) -> Dict[str, Any]:
        """Write one batch in a single short transaction using set-based statements.

        Round trips per batch (independent of batch size):
          1. SELECT existing items by identity key
          2. SELECT active versions of existing items (re-imports only)
          3. multi-row INSERT knowledge_items (current_version_id pre-assigned)
          4. multi-row INSERT knowledge_versions
          5. UPDATE archive superseded versions (re-imports only)
          6. executemany UPDATE item.current_version_id (re-imports only)
          7. COMMIT

        IDs are generated client-side, so no flush / RETURNING is needed and the old
        per-row ``UPDATE knowledge_items SET current_version_id`` pass is gone: new
        items are inserted already pointing at their first version.

        Raises on any DB error (caller decides rollback / retry). Returns the
        committed outcome lists as (item_id, version_id, record) tuples.
        """
        db_keys = [_strip_identity_key(rec.identity_key) for rec in candidates]

        # 1. Existing items for this batch — one indexed query.
        existing_rows = await db.execute(
            select(KnowledgeItem.id, KnowledgeItem.external_identity_key, KnowledgeItem.tags).where(
                KnowledgeItem.tenant_id == self.tenant_id,
                KnowledgeItem.category == self.category,
                KnowledgeItem.external_identity_key.in_(db_keys),
            )
        )
        existing: Dict[str, Tuple[str, Optional[str]]] = {
            row.external_identity_key: (row.id, row.tags) for row in existing_rows if row.external_identity_key
        }

        # 2. Current active versions of existing items — one query.
        current_versions: Dict[str, KnowledgeVersion] = {}
        if existing:
            cur_res = await db.execute(
                select(KnowledgeVersion).where(
                    KnowledgeVersion.tenant_id == self.tenant_id,
                    KnowledgeVersion.knowledge_item_id.in_([v[0] for v in existing.values()]),
                    KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
                )
            )
            current_versions = {v.knowledge_item_id: v for v in cur_res.scalars().all()}

        # Items matched by identity but without an ACTIVE version (legacy archived rows): continue
        # their numbering from the highest existing version so the new one never collides with
        # uq_knowledge_versions_item_version (which would roll back the whole batch).
        max_version: Dict[str, int] = {}
        without_active = [v[0] for v in existing.values() if v[0] not in current_versions]
        if without_active:
            mv_res = await db.execute(
                select(KnowledgeVersion.knowledge_item_id, func.max(KnowledgeVersion.version_number))
                .where(
                    KnowledgeVersion.tenant_id == self.tenant_id,
                    KnowledgeVersion.knowledge_item_id.in_(without_active),
                )
                .group_by(KnowledgeVersion.knowledge_item_id)
            )
            max_version = {item_id: int(n or 0) for item_id, n in mv_res.all()}

        now_utc = datetime.now(timezone.utc)
        item_rows: List[Dict[str, Any]] = []
        version_rows: List[Dict[str, Any]] = []
        archive_version_ids: List[str] = []
        item_pointer_updates: List[Dict[str, Any]] = []
        inserted: List[Tuple[str, str, NormalizedRecordDTO]] = []
        versioned: List[Tuple[str, str, NormalizedRecordDTO]] = []
        unchanged: List[Tuple[str, str, NormalizedRecordDTO]] = []
        # (item fields, version row) of every version written in this batch
        to_project: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []

        for db_key, rec in zip(db_keys, candidates):
            content_text, canonical_dict, eff_from, eff_until = _build_version_payload(rec)
            tags_json = _extract_tags(rec)
            version_id = f"kv_{uuid.uuid4().hex}"

            if db_key not in existing:
                item_id = f"ki_{uuid.uuid4().hex}"
                title = (
                    rec.canonical_data.get("name")
                    or rec.canonical_data.get("title")
                    or rec.canonical_data.get("question")
                    or f"Import row {rec.row_number}"
                )
                item_rows.append({
                    "id": item_id,
                    "tenant_id": self.tenant_id,
                    "title": str(title)[:512],
                    "category": self.category,
                    "description": str(rec.canonical_data.get("description", ""))[:500] or None,
                    "source_id": self.source_id,
                    "source_type": KnowledgeSourceType.IMPORT.value,
                    "current_version_id": version_id,
                    "external_identity_key": db_key,
                    "tags": tags_json,
                    "is_active": True,
                    "created_by_user_id": self.created_by_user_id,
                    "created_at": now_utc,
                    "updated_at": now_utc,
                })
                version_rows.append(self._version_row(
                    version_id, item_id, 1, content_text, canonical_dict, eff_from, eff_until,
                    f"Initial import via job {self.job_id}", now_utc,
                ))
                to_project.append((item_rows[-1], version_rows[-1]))
                inserted.append((item_id, version_id, rec))
                continue

            item_id, existing_tags = existing[db_key]
            prev = current_versions.get(item_id)

            # Idempotent re-import: identical payload and dates → keep identities, no new version.
            if (
                prev is not None
                and _is_canonical_identical(prev.canonical_data, canonical_dict)
                and prev.effective_from == eff_from
                and prev.effective_until == eff_until
            ):
                unchanged.append((item_id, prev.id, rec))
                continue

            next_num = (prev.version_number + 1) if prev else max_version.get(item_id, 0) + 1
            if prev is not None:
                archive_version_ids.append(prev.id)
            version_rows.append(self._version_row(
                version_id, item_id, next_num, content_text, canonical_dict, eff_from, eff_until,
                f"Re-imported via job {self.job_id}", now_utc,
            ))
            title = (
                rec.canonical_data.get("name")
                or rec.canonical_data.get("title")
                or rec.canonical_data.get("question")
                or f"Import row {rec.row_number}"
            )
            to_project.append(({
                "id": item_id,
                "tenant_id": self.tenant_id,
                "title": str(title)[:512],
                "category": self.category,
                "description": str(rec.canonical_data.get("description", ""))[:500] or None,
                "source_id": self.source_id,
                "source_type": KnowledgeSourceType.IMPORT.value,
            }, version_rows[-1]))
            item_pointer_updates.append({
                "id": item_id,
                "is_active": True,          # a re-imported record is live again
                "current_version_id": version_id,
                "tags": tags_json or existing_tags,
                "updated_at": now_utc,
            })
            versioned.append((item_id, version_id, rec))

        # Inline semantic projection (pure CPU, ~0.1 ms/row): the versions are written
        # already projected and their chunks go in the same transaction, so the old
        # PROJECTING stage that re-downloaded and re-wrote every row is unnecessary.
        chunk_rows: List[Dict[str, Any]] = []
        indexable: List[Tuple[KnowledgeItem, KnowledgeVersion, Any]] = []
        if project and to_project:
            projector = self._get_projector()
            for item_fields, vrow in to_project:
                item_obj = KnowledgeItem(**item_fields)
                ver_obj = KnowledgeVersion(**vrow)
                try:
                    doc = projector.project_item_version(item_obj, ver_obj)
                except Exception as proj_err:
                    # Leave as pending; the post-import reconciliation retries it.
                    logger.warning(
                        "knowledge.projection.row_failed",
                        version_id=vrow["id"],
                        error=str(proj_err)[:200],
                    )
                    continue
                projected = {
                    "content_text": doc.full_text,
                    "chunk_count": len(doc.chunks),
                    "semantic_version": projector.projection_version,
                    "projection_status": "projected",
                    "last_projected_at": now_utc,
                }
                vrow.update(projected)
                for key, val in projected.items():
                    setattr(ver_obj, key, val)
                for c in (doc.chunks if self.persist_semantic_chunks else ()):
                    chunk_rows.append({
                        "id": c.chunk_id,
                        "tenant_id": self.tenant_id,
                        "knowledge_item_id": c.knowledge_item_id,
                        "knowledge_version_id": c.knowledge_version_id,
                        "chunk_index": c.chunk_index,
                        "section": c.section,
                        "text": c.text,
                        "char_count": c.char_count,
                        "projection_version": projector.projection_version,
                        "source_id": c.source_id,
                        "authority_level": c.authority,
                        "status": c.status,
                        "semantic_hash": hashlib.sha256(c.text.encode("utf-8")).hexdigest(),
                        "effective_from": vrow.get("effective_from"),
                        "effective_until": vrow.get("effective_until"),
                    })
                indexable.append((item_obj, ver_obj, doc))

        # 3/4. Multi-row inserts (SQLAlchemy insertmanyvalues → 1 statement per ~1000 rows).
        # The SELECT above already opened this session's transaction, so the COPYs
        # below are part of it and commit / roll back atomically with the batch.
        if item_rows:
            await _bulk_insert(db, KnowledgeItem, item_rows)
        # Archive before inserting the replacement so at most one ACTIVE version exists.
        if archive_version_ids:
            await db.execute(
                update(KnowledgeVersion)
                .where(
                    KnowledgeVersion.tenant_id == self.tenant_id,
                    KnowledgeVersion.id.in_(archive_version_ids),
                )
                .values(
                    status=KnowledgeLifecycleStatus.ARCHIVED.value,
                    archived_at=now_utc,
                    updated_at=now_utc,
                )
            )
        if version_rows:
            await _bulk_insert(db, KnowledgeVersion, version_rows)
        if chunk_rows:
            await _bulk_insert(db, KnowledgeSemanticChunk, chunk_rows)
        if item_pointer_updates:
            await db.execute(update(KnowledgeItem), item_pointer_updates)

        await db.commit()
        return {
            "inserted": inserted,
            "versioned": versioned,
            "unchanged": unchanged,
            "indexable": indexable,
        }

    def _get_projector(self):
        if getattr(self, "_projector", None) is None:
            from app.services.knowledge_projection import KnowledgeProjectionService

            self._projector = KnowledgeProjectionService()
        return self._projector

    def _version_row(
        self,
        version_id: str,
        item_id: str,
        version_number: int,
        content_text: str,
        canonical_dict: Dict[str, Any],
        eff_from: Optional[datetime],
        eff_until: Optional[datetime],
        change_summary: str,
        now_utc: datetime,
    ) -> Dict[str, Any]:
        return {
            "id": version_id,
            "tenant_id": self.tenant_id,
            "knowledge_item_id": item_id,
            "version_number": version_number,
            "status": KnowledgeLifecycleStatus.ACTIVE.value,
            "source_id": self.source_id,
            "authority_level": self.authority_level,
            "content_text": content_text,
            "change_summary": change_summary,
            "canonical_data": canonical_dict,
            "effective_from": eff_from,
            "effective_until": eff_until,
            "projection_status": "pending",
            "semantic_status": "pending",
            "published_at": now_utc,
            "created_by_user_id": self.created_by_user_id,
            "created_at": now_utc,
            "updated_at": now_utc,
        }

    def _apply_outcome(
        self,
        batch_result: BatchPersistenceResultDTO,
        results: List[RecordPersistenceResultDTO],
        outcome: Dict[str, List[Tuple[str, str, NormalizedRecordDTO]]],
    ) -> None:
        for key, enum_val, counter in (
            ("inserted", PersistenceOutcome.INSERTED, "inserted_count"),
            ("versioned", PersistenceOutcome.VERSIONED, "versioned_count"),
            ("unchanged", PersistenceOutcome.UNCHANGED, "unchanged_count"),
        ):
            for item_id, version_id, rec in outcome[key]:
                setattr(batch_result, counter, getattr(batch_result, counter) + 1)
                results.append(RecordPersistenceResultDTO(
                    row_number=rec.row_number,
                    outcome=enum_val,
                    identity_key=rec.identity_key,
                    knowledge_item_id=item_id,
                    knowledge_version_id=version_id,
                ))
        self._summary.batches_committed += 1

    def _mark_failed(
        self,
        batch: BatchQualityResultDTO,
        batch_result: BatchPersistenceResultDTO,
        results: List[RecordPersistenceResultDTO],
        candidates: List[NormalizedRecordDTO],
        err: BaseException,
    ) -> None:
        self._summary.batches_rolled_back += 1
        logger.error(
            "knowledge.persistence.batch_failed",
            batch_index=batch.batch_index,
            tenant_id=self.tenant_id,
            error=str(err)[:1000],
            candidate_count=len(candidates),
        )
        for rec in candidates:
            batch_result.failed_count += 1
            results.append(RecordPersistenceResultDTO(
                row_number=rec.row_number,
                outcome=PersistenceOutcome.FAILED,
                identity_key=rec.identity_key,
                error_message=f"Batch transaction rolled back: {str(err)[:256]}",
            ))

    def _finalize_batch(
        self,
        batch: BatchQualityResultDTO,
        batch_result: BatchPersistenceResultDTO,
        results: List[RecordPersistenceResultDTO],
        t0: float,
    ) -> BatchPersistenceResultDTO:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        logger.info(
            "knowledge.persistence.batch_completed",
            batch_index=batch.batch_index,
            tenant_id=self.tenant_id,
            inserted=batch_result.inserted_count,
            versioned=batch_result.versioned_count,
            unchanged=batch_result.unchanged_count,
            duplicates=batch_result.duplicate_count,
            conflicts=batch_result.conflict_count,
            invalid=batch_result.invalid_count,
            failed=batch_result.failed_count,
            duration_ms=duration_ms,
        )
        batch_result.records = results
        self._accumulate_summary(batch_result)
        return batch_result

    def get_summary(self) -> ImportPersistenceSummaryDTO:
        """Return the accumulated persistence metrics across all processed batches."""
        return self._summary

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _accumulate_summary(self, batch_result: BatchPersistenceResultDTO) -> None:
        """Merge a single batch result into the running summary."""
        self._summary.total_rows_attempted += batch_result.total_rows
        self._summary.total_inserted += batch_result.inserted_count
        self._summary.total_versioned += batch_result.versioned_count
        self._summary.total_unchanged += batch_result.unchanged_count
        self._summary.total_duplicates += batch_result.duplicate_count
        self._summary.total_conflicts += batch_result.conflict_count
        self._summary.total_invalid += batch_result.invalid_count
        self._summary.total_failed += batch_result.failed_count


# ---------------------------------------------------------------------------
# Content Text Builder
# ---------------------------------------------------------------------------

def _build_content_text(rec: NormalizedRecordDTO) -> str:
    """Produce a compact human-readable narrative from canonical + custom fields.

    This becomes KnowledgeVersion.content_text — the input to Phase 10
    semantic chunking and embedding. Format is deterministic and category-agnostic.
    """
    parts: List[str] = []
    for key, val in rec.canonical_data.items():
        if val is not None:
            if isinstance(val, (float, Decimal)):
                v_clean = f"{Decimal(str(val)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
            elif isinstance(val, str) and re.match(r"^-?\d+\.\d{3,}$", val.strip()):
                try:
                    v_clean = f"{Decimal(val.strip()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
                except Exception:
                    v_clean = val
            else:
                v_clean = str(val)
            parts.append(f"{key}: {v_clean}")
    for key, val in rec.custom_attributes.items():
        if val is not None:
            if isinstance(val, (float, Decimal)):
                v_clean = f"{Decimal(str(val)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
            elif isinstance(val, str) and re.match(r"^-?\d+\.\d{3,}$", val.strip()):
                try:
                    v_clean = f"{Decimal(val.strip()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
                except Exception:
                    v_clean = val
            else:
                v_clean = str(val)
            parts.append(f"{key}: {v_clean}")
    return "; ".join(parts) if parts else ""
