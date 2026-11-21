"""Settings store: provisioning, reconciliation, reads and validated writes.

Only storage lives here — what each setting *does* is implemented where it is used, later.

* New owners: provisioned in their creating transaction by the hook in ``app.models.settings``.
* Existing owners / newly added settings: ``reconcile_defaults`` (start-up, advisory-locked,
  set-based, idempotent) inserts missing rows and moves non-customized rows to the current default.
  It never overwrites a value somebody chose and never deletes rows.
* Reads return the *effective* value of every active setting: the stored value when it was
  customized and is still valid, otherwise the registry default. A missing row (owner created
  between deploy and reconcile) therefore still reads correctly.
* Writes validate against the registry, run in one transaction, bump the row version, record who
  changed what (keys only, never values) in the audit log, and never touch other keys.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.settings_registry import (
    BY_KEY,
    SettingScope,
    SettingValidationError,
    defaults,
    definitions,
    fingerprint,
)
from app.core.logging import logger
from app.models.settings import UserSetting, WorkspaceSetting

_RECONCILE_LOCK_KEY = 0x5E771265  # pg advisory lock id for the start-up reconcile

_TABLES = {
    SettingScope.USER: ("user_settings", "user_id", "users", "id"),
    SettingScope.WORKSPACE: ("workspace_settings", "tenant_id", "organizations", "id"),
}


def _model(scope: SettingScope):
    return UserSetting if scope is SettingScope.USER else WorkspaceSetting


def _owner_col(scope: SettingScope):
    return UserSetting.user_id if scope is SettingScope.USER else WorkspaceSetting.tenant_id


# ---------------------------------------------------------------------------------------------
# Reconcile (existing owners, new settings, changed defaults)
# ---------------------------------------------------------------------------------------------
async def reconcile_defaults(db: AsyncSession, scopes: Sequence[SettingScope] = tuple(SettingScope)) -> Dict[str, Any]:
    """Insert missing default rows for every owner and refresh non-customized rows to the current
    default. Two set-based statements per scope; safe to run any number of times and concurrently
    (one instance does the work, the others skip). Commits on success."""
    got = (await db.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": _RECONCILE_LOCK_KEY})).scalar()
    if not got:
        await db.rollback()
        return {"skipped": "another instance is reconciling"}
    report: Dict[str, Any] = {}
    for scope in scopes:
        table, owner_col, owner_table, owner_pk = _TABLES[scope]
        payload = json.dumps(defaults(scope))
        inserted = (await db.execute(text(
            f"INSERT INTO {table} ({owner_col}, key, value, is_customized, version, created_at, updated_at) "
            f"SELECT o.{owner_pk}, d.key, d.value, false, 1, now(), now() "
            f"FROM {owner_table} o CROSS JOIN jsonb_each(CAST(:defaults AS jsonb)) AS d(key, value) "
            f"ON CONFLICT ({owner_col}, key) DO NOTHING"), {"defaults": payload})).rowcount
        refreshed = (await db.execute(text(
            f"UPDATE {table} s SET value = d.value, version = s.version + 1, updated_at = now() "
            f"FROM jsonb_each(CAST(:defaults AS jsonb)) AS d(key, value) "
            f"WHERE s.key = d.key AND NOT s.is_customized AND s.value IS DISTINCT FROM d.value"),
            {"defaults": payload})).rowcount
        report[scope.value] = {"inserted": inserted, "defaults_refreshed": refreshed,
                               "registry": fingerprint(scope)}
    await db.commit()
    return report


async def reconcile_on_startup() -> None:
    """Never raises and never blocks start-up; logs what it changed."""
    from app.core.database import db_manager

    try:
        async with db_manager.session_factory() as db:
            report = await reconcile_defaults(db)
        logger.info("settings.reconcile_completed", **{k: v for k, v in report.items()})
    except Exception as err:  # noqa: BLE001 - reads fall back to registry defaults meanwhile
        logger.warning("settings.reconcile_failed", error=f"{type(err).__name__}: {str(err)[:200]}")


# ---------------------------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------------------------
async def get_settings(db: AsyncSession, scope: SettingScope, owner_id: str,
                       include_definitions: bool = True) -> Dict[str, Any]:
    """Effective values for one owner (one indexed query on the primary key)."""
    model = _model(scope)
    # populate_existing: the session may hold rows from an earlier statement (no expire on commit).
    rows = (await db.execute(select(model).where(_owner_col(scope) == owner_id)
                             .execution_options(populate_existing=True))).scalars().all()
    stored = {r.key: r for r in rows}
    values: Dict[str, Any] = {}
    meta: Dict[str, Dict[str, Any]] = {}
    for d in definitions(scope):
        row = stored.get(d.key)
        customized = bool(row is not None and row.is_customized and d.is_valid(row.value))
        values[d.key] = row.value if customized else d.default
        meta[d.key] = {"customized": customized, "version": row.version if row is not None else 0}
    out: Dict[str, Any] = {"scope": scope.value, "values": values, "state": meta}
    if include_definitions:
        out["definitions"] = [d.describe() for d in definitions(scope)]
    return out


async def get_value(db: AsyncSession, scope: SettingScope, owner_id: str, key: str) -> Any:
    """Effective value of one setting (for the code that will implement its behaviour)."""
    d = BY_KEY.get(key)
    if d is None or d.scope is not scope or d.deprecated:
        raise KeyError(key)
    model = _model(scope)
    row = (await db.execute(select(model).where(_owner_col(scope) == owner_id, model.key == key)
                            .execution_options(populate_existing=True))).scalar_one_or_none()
    return row.value if (row is not None and row.is_customized and d.is_valid(row.value)) else d.default


# ---------------------------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------------------------
def _validate_patch(scope: SettingScope, values: Dict[str, Any], reset: Iterable[str],
                    permissions: Optional[set]) -> Tuple[Dict[str, Any], List[str]]:
    errors: Dict[str, str] = {}
    clean: Dict[str, Any] = {}
    reset_keys = list(dict.fromkeys(reset or []))
    for key in list(values) + reset_keys:
        d = BY_KEY.get(key)
        if d is None or d.deprecated or d.scope is not scope:
            errors[key] = "Unknown setting."
        elif d.edit_permission and (permissions is None or d.edit_permission not in permissions):
            errors[key] = "Only workspace owners and admins can change this setting."
    if set(values) & set(reset_keys):
        for key in set(values) & set(reset_keys):
            errors.setdefault(key, "A setting can't be changed and reset in the same request.")
    for key, value in values.items():
        if key in errors:
            continue
        try:
            clean[key] = BY_KEY[key].validate(value)
        except SettingValidationError as err:
            errors[key] = str(err)
    if errors:
        raise HTTPException(422, {"message": "Some settings are invalid.",
                                                                    "errors": errors})
    return clean, reset_keys


async def update_settings(db: AsyncSession, scope: SettingScope, owner_id: str, actor_user_id: str,
                          values: Optional[Dict[str, Any]] = None, reset: Optional[Iterable[str]] = None,
                          permissions: Optional[set] = None, audit_tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Validated partial update: set ``values`` (customized) and/or ``reset`` keys to their defaults.
    All-or-nothing; unchanged values are not rewritten."""
    clean, reset_keys = _validate_patch(scope, values or {}, reset or [], permissions)
    if not clean and not reset_keys:
        return await get_settings(db, scope, owner_id)

    model = _model(scope)
    owner_attr = "user_id" if scope is SettingScope.USER else "tenant_id"
    keys = list(clean) + reset_keys
    current = {r.key: r for r in (await db.execute(
        select(model).where(_owner_col(scope) == owner_id, model.key.in_(keys)).with_for_update()
    )).scalars().all()}

    changed: List[str] = []
    for key in keys:
        d = BY_KEY[key]
        target_value, customized = (clean[key], True) if key in clean else (d.default, False)
        row = current.get(key)
        if row is not None and row.value == target_value and row.is_customized == customized:
            continue
        stmt = pg_insert(model).values(**{owner_attr: owner_id, "key": key, "value": target_value,
                                          "is_customized": customized, "version": 1, "updated_by": actor_user_id})
        stmt = stmt.on_conflict_do_update(
            index_elements=[owner_attr, "key"],
            set_={"value": stmt.excluded.value, "is_customized": stmt.excluded.is_customized,
                  "version": model.version + 1, "updated_by": actor_user_id, "updated_at": text("now()")})
        await db.execute(stmt)
        changed.append(key)

    if changed:
        try:
            from app.models.audit import AuditAction
            from app.services.audit import audit_service

            await audit_service.record(
                db=db, action=AuditAction.SETTINGS_UPDATED,
                resource_type=f"{scope.value}_settings", resource_id=owner_id,
                organization_id=audit_tenant_id, actor_user_id=actor_user_id,
                metadata={"changed_keys": changed[:50], "reset_keys": [k for k in reset_keys if k in changed]},
            )
        except Exception as err:  # noqa: BLE001 - audit must not block a preference change
            logger.warning("settings.audit_failed", error=type(err).__name__)
    await db.commit()
    return await get_settings(db, scope, owner_id)
