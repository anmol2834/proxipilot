"""Settings store: registry integrity, provisioning at creation, reconcile for new settings and
changed defaults, validated partial writes.

Unit tests run anywhere; integration tests need the LOCAL throwaway database (the conftest guard
blocks any remote database).
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.contracts import settings_registry as reg
from app.contracts.settings_registry import SettingDefinition, SettingKind, SettingScope, SettingValidationError
from app.services import settings_store as store
from conftest import REMOTE_DATABASE_BLOCKED

needs_db = pytest.mark.skipif(REMOTE_DATABASE_BLOCKED, reason="needs the local throwaway database")
ADMIN = {"organization.read", "organization.update"}
MEMBER = {"organization.read"}


# ---------------------------------------------------------------------------------------------
# Unit: registry
# ---------------------------------------------------------------------------------------------

def test_registry_is_consistent():
    keys = [d.key for d in reg.SETTINGS]
    assert len(keys) == len(set(keys))
    for d in reg.SETTINGS:
        assert d.is_valid(d.default), d.key
        if d.scope is SettingScope.USER:
            assert d.edit_permission is None
        else:
            assert d.edit_permission == "organization.update"
    assert reg.defaults(SettingScope.USER) and reg.defaults(SettingScope.WORKSPACE)


def test_actions_that_act_on_their_own_default_off():
    """Sending customer email or deleting data must be switched on deliberately."""
    for d in reg.SETTINGS:
        if d.kind is SettingKind.BOOL and ({"customer_facing", "destructive"} & set(d.tags)):
            assert d.default is False, d.key


@pytest.mark.parametrize("kind,kw,value,ok", [
    (SettingKind.BOOL, {}, True, True), (SettingKind.BOOL, {}, 1, False), (SettingKind.BOOL, {}, "true", False),
    (SettingKind.INT, {"minimum": 20, "maximum": 100}, 50, True), (SettingKind.INT, {"minimum": 20}, 5, False),
    (SettingKind.INT, {}, True, False), (SettingKind.INT, {}, 1.5, False),
    (SettingKind.ENUM, {"choices": (0, 1)}, 1, True), (SettingKind.ENUM, {"choices": (0, 1)}, True, False),
    (SettingKind.ENUM, {"choices": ("a", "b")}, "c", False),
    (SettingKind.STRING, {"max_length": 3}, "abc", True), (SettingKind.STRING, {"max_length": 3}, "abcd", False),
])
def test_validation_is_strict(kind, kw, value, ok):
    d = SettingDefinition("x.y", SettingScope.USER, kind, None, "X", **kw)
    if ok:
        d.validate(value)
    else:
        with pytest.raises(SettingValidationError):
            d.validate(value)


def test_registry_rejects_bad_definitions():
    with pytest.raises(ValueError):
        reg._check_registry([SettingDefinition("Bad Key", SettingScope.USER, SettingKind.BOOL, True, "x")])
    with pytest.raises(ValueError):
        reg._check_registry([SettingDefinition("a.b", SettingScope.USER, SettingKind.BOOL, "no", "x")])
    with pytest.raises(ValueError):
        d = SettingDefinition("a.b", SettingScope.USER, SettingKind.BOOL, True, "x")
        reg._check_registry([d, d])


# ---------------------------------------------------------------------------------------------
# Integration
# ---------------------------------------------------------------------------------------------

@pytest.fixture
async def world():
    from tests.followup_world import build_world, destroy_world

    w = await build_world(f"st{uuid.uuid4().hex[:8]}")
    try:
        yield w
    finally:
        await destroy_world(w)


async def _rows(table, owner_col, owner_id):
    from app.core.database import db_manager

    async with db_manager.session_factory() as db:
        return {r.key: r for r in (await db.execute(text(
            f"SELECT key, value, is_customized, version FROM {table} WHERE {owner_col} = :o"), {"o": owner_id})).all()}


def _add_setting(monkeypatch, d: SettingDefinition):
    monkeypatch.setattr(reg, "SETTINGS", reg.SETTINGS + (d,))
    monkeypatch.setattr(reg, "BY_KEY", {**reg.BY_KEY, d.key: d})
    monkeypatch.setattr(store, "BY_KEY", reg.BY_KEY)


async def _drop_key(key):
    from app.core.database import db_manager

    async with db_manager.session_factory() as db:
        await db.execute(text("DELETE FROM user_settings WHERE key = :k"), {"k": key})
        await db.execute(text("DELETE FROM workspace_settings WHERE key = :k"), {"k": key})
        await db.commit()


@needs_db
async def test_new_users_and_workspaces_get_every_default_in_the_same_transaction(world):
    for uid in world.users.values():
        rows = await _rows("user_settings", "user_id", uid)
        assert set(rows) == set(reg.defaults(SettingScope.USER))
        assert all(not r.is_customized and r.value == reg.BY_KEY[k].default for k, r in rows.items())
    rows = await _rows("workspace_settings", "tenant_id", world.tenant_id)
    assert set(rows) == set(reg.defaults(SettingScope.WORKSPACE))


@needs_db
async def test_password_signup_provisions_user_settings_and_a_failed_signup_leaves_nothing():
    from app.core.database import db_manager
    from app.models.organization import User

    uid = f"usr_st_{uuid.uuid4().hex[:10]}"
    async with db_manager.session_factory() as db:                     # rolled back: nothing persists
        db.add(User(id=uid, email=f"{uid}@team.example", hashed_password="x", full_name="T"))
        await db.flush()
        assert (await db.execute(text("SELECT count(*) FROM user_settings WHERE user_id=:u"), {"u": uid})).scalar() \
            == len(reg.defaults(SettingScope.USER))
        await db.rollback()
    assert await _rows("user_settings", "user_id", uid) == {}

    from app.contracts.auth import SignupRequest
    from app.services.auth import auth_service

    email = f"signup-{uuid.uuid4().hex[:8]}@team.example"
    async with db_manager.session_factory() as db:
        try:
            res = await auth_service.signup(db, SignupRequest(email=email, password="Sup3r-secret-pass!",
                                                              first_name="Set", last_name="Tings"))
            user_id = res.user_id
        except HTTPException:                                          # mail delivery refused locally
            user_id = (await db.execute(text("SELECT id FROM users WHERE email=:e"), {"e": email})).scalar()
    try:
        assert user_id and set(await _rows("user_settings", "user_id", user_id)) == set(reg.defaults(SettingScope.USER))
    finally:
        async with db_manager.session_factory() as db:
            await db.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
            await db.commit()


@needs_db
async def test_a_setting_added_later_reaches_new_and_existing_owners(world, monkeypatch):
    from app.core.database import db_manager
    from app.models.organization import User

    new = SettingDefinition("labs.future_flag", SettingScope.USER, SettingKind.BOOL, True, "Future flag")
    owner = world.users["owner"]
    assert "labs.future_flag" not in await _rows("user_settings", "user_id", owner)
    _add_setting(monkeypatch, new)
    try:
        # Existing owner: readable at once (registry default), materialized by the reconcile.
        async with db_manager.session_factory() as db:
            assert (await store.get_settings(db, SettingScope.USER, owner))["values"]["labs.future_flag"] is True
        async with db_manager.session_factory() as db:
            first = await store.reconcile_defaults(db, [SettingScope.USER])
        assert first["user"]["inserted"] >= 1
        assert "labs.future_flag" in await _rows("user_settings", "user_id", owner)
        async with db_manager.session_factory() as db:
            again = await store.reconcile_defaults(db, [SettingScope.USER])
        assert again["user"]["inserted"] == 0 and again["user"]["defaults_refreshed"] == 0

        # New owner registered after the setting was added gets it with the others.
        uid = f"usr_st_{uuid.uuid4().hex[:10]}"
        async with db_manager.session_factory() as db:
            db.add(User(id=uid, email=f"{uid}@team.example", hashed_password="x", full_name="T"))
            await db.commit()
        rows = await _rows("user_settings", "user_id", uid)
        assert set(rows) == set(reg.defaults(SettingScope.USER)) and rows["labs.future_flag"].value is True
        async with db_manager.session_factory() as db:
            await db.execute(text("DELETE FROM users WHERE id = :u"), {"u": uid})
            await db.commit()
    finally:
        await _drop_key("labs.future_flag")


@needs_db
async def test_changed_default_follows_through_only_where_nobody_chose_a_value(world, monkeypatch):
    from app.core.database import db_manager

    key = "inbox.density"
    owner, member = world.users["owner"], world.users["member"]
    async with db_manager.session_factory() as db:
        await store.update_settings(db, SettingScope.USER, owner, owner, values={key: "comfortable"})
    old = reg.BY_KEY[key]
    changed = SettingDefinition(key, old.scope, old.kind, "compact", old.label, choices=old.choices, tab=old.tab)
    monkeypatch.setattr(reg, "SETTINGS", tuple(changed if d.key == key else d for d in reg.SETTINGS))
    monkeypatch.setattr(reg, "BY_KEY", {**reg.BY_KEY, key: changed})
    monkeypatch.setattr(store, "BY_KEY", reg.BY_KEY)
    try:
        async with db_manager.session_factory() as db:
            await store.reconcile_defaults(db, [SettingScope.USER])
        assert (await _rows("user_settings", "user_id", member))[key].value == "compact"     # followed default
        kept = (await _rows("user_settings", "user_id", owner))[key]
        assert kept.value == "comfortable" and kept.is_customized                              # their choice kept
    finally:
        monkeypatch.undo()
        async with db_manager.session_factory() as db:                # put shared local rows back
            await store.reconcile_defaults(db, [SettingScope.USER])


@needs_db
async def test_partial_validated_writes_reset_and_permissions(world):
    from app.core.database import db_manager

    tenant, owner, member = world.tenant_id, world.users["owner"], world.users["member"]
    async with db_manager.session_factory() as db:
        out = await store.update_settings(db, SettingScope.USER, member, member,
                                          values={"notifications.email": True, "inbox.density": "compact"})
    assert out["values"]["notifications.email"] is True and out["state"]["inbox.density"]["customized"]
    assert out["values"]["notifications.mobile_push"] is True            # untouched keys unchanged
    rows = await _rows("user_settings", "user_id", member)
    assert rows["inbox.density"].version == 2 and rows["notifications.mobile_push"].version == 1

    async with db_manager.session_factory() as db:
        out = await store.update_settings(db, SettingScope.USER, member, member, reset=["inbox.density"])
    assert out["values"]["inbox.density"] == "comfortable" and not out["state"]["inbox.density"]["customized"]

    for bad in ({"inbox.density": "tiny"}, {"no.such_key": 1}, {"automation.auto_send_enabled": True},
                {"notifications.email": "yes"}):
        async with db_manager.session_factory() as db:
            with pytest.raises(HTTPException) as exc:
                await store.update_settings(db, SettingScope.USER, member, member, values=bad)
        assert exc.value.status_code == 422

    # Workspace: members can read but not change; admins can; a failed batch changes nothing.
    async with db_manager.session_factory() as db:
        with pytest.raises(HTTPException) as exc:
            await store.update_settings(db, SettingScope.WORKSPACE, tenant, member,
                                        values={"billing.display_currency": "INR"}, permissions=MEMBER)
        assert exc.value.detail["errors"]["billing.display_currency"].startswith("Only workspace owners")
    async with db_manager.session_factory() as db:
        with pytest.raises(HTTPException):
            await store.update_settings(db, SettingScope.WORKSPACE, tenant, owner, permissions=ADMIN,
                                        values={"billing.display_currency": "INR", "billing.spend_cap_amount": 5})
    assert (await _rows("workspace_settings", "tenant_id", tenant))["billing.display_currency"].value == "USD"
    async with db_manager.session_factory() as db:
        out = await store.update_settings(db, SettingScope.WORKSPACE, tenant, owner, permissions=ADMIN,
                                          values={"billing.display_currency": "INR"}, audit_tenant_id=tenant)
        assert out["values"]["billing.display_currency"] == "INR"
        assert await store.get_value(db, SettingScope.WORKSPACE, tenant, "billing.display_currency") == "INR"
        audit = (await db.execute(text(
            "SELECT action, metadata FROM audit_events WHERE organization_id=:t AND action='SETTINGS_UPDATED'"),
            {"t": tenant})).all()
    assert audit and "INR" not in str(audit[-1][1])                       # keys recorded, never values


@needs_db
async def test_reads_fall_back_to_defaults_when_rows_are_missing_or_invalid(world):
    from app.core.database import db_manager

    owner = world.users["owner"]
    async with db_manager.session_factory() as db:
        await db.execute(text("DELETE FROM user_settings WHERE user_id=:u AND key='inbox.density'"), {"u": owner})
        await db.execute(text("UPDATE user_settings SET value='\"bogus\"', is_customized=true "
                              "WHERE user_id=:u AND key='inbox.auto_advance'"), {"u": owner})
        await db.commit()
        out = await store.get_settings(db, SettingScope.USER, owner)
    assert out["values"]["inbox.density"] == "comfortable"
    assert out["values"]["inbox.auto_advance"] == "next_thread"
    assert not out["state"]["inbox.auto_advance"]["customized"]
    assert {d["key"] for d in out["definitions"]} == set(reg.defaults(SettingScope.USER))


@needs_db
async def test_http_my_settings_round_trip(world):
    import httpx

    from app.core.security import TokenPayload, get_current_user
    from app.main import app

    member = world.users["member"]
    app.dependency_overrides[get_current_user] = lambda: TokenPayload(sub=member, tenant_id=world.tenant_id)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            got = (await c.get("/api/v1/settings/me")).json()
            assert got["values"]["inbox.keyboard_shortcuts"] is True and got["definitions"]
            r = await c.patch("/api/v1/settings/me", json={"values": {"inbox.keyboard_shortcuts": False}})
            assert r.status_code == 200 and r.json()["values"]["inbox.keyboard_shortcuts"] is False
            bad = await c.patch("/api/v1/settings/me", json={"values": {"inbox.density": "huge"}})
            assert bad.status_code == 422
            extra = await c.patch("/api/v1/settings/me", json={"values": {}, "other": 1})
            assert extra.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
