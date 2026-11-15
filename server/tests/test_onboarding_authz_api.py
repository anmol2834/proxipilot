"""Regression (QA audit 2026-11-15): onboarding endpoints must enforce tenant membership and
write permission, over real HTTP (ASGI) and real PostgreSQL.

Defects reproduced before the fix:
  * GET /onboarding/activation-status?organization_id=<other org> returned another tenant's
    mailbox / knowledge counts to any authenticated user (no membership check).
  * PATCH /organizations/{id}/business-profile and /preferences (writes) only required
    ``organization.read``, so any read-only member could overwrite org-level settings.
Throwaway orgs/users only; everything is removed afterwards.
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from sqlalchemy import text

from conftest import purge_tenant

pytestmark = pytest.mark.asyncio

MEMBER_KEYS = ("organization.read", "team.read", "knowledge.read", "inbox.read", "settings.read")


@pytest.fixture(scope="module")
async def env():
    from app.core.database import db_manager
    from app.core.security import create_access_token
    from app.main import app

    tag = uuid.uuid4().hex[:10]
    org_a, org_b = f"org_itest_oa_{tag}", f"org_itest_ob_{tag}"
    users = {"owner": f"usr_itest_ow_{tag}", "member": f"usr_itest_mb_{tag}"}
    roles = {"owner": f"rol_itest_ow_{tag}", "member": f"rol_itest_mb_{tag}"}
    async with db_manager.session_factory() as db:
        for org in (org_a, org_b):
            await db.execute(text("""INSERT INTO organizations (id, name, slug, status, plan_tier, is_active,
                max_integrations, max_members, created_at, updated_at)
                VALUES (:id, 'Integration Test Catalogue', :slug, 'ACTIVE', 'free', true, 5, 10, now(), now())"""),
                {"id": org, "slug": f"it-{org[-16:]}"})
        # org B has tenant data that must not be visible from A
        await db.execute(text("""INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address,
            status, connection_status, sync_enabled, automation_enabled, created_at, updated_at)
            VALUES (:a, :t, 'gmail', :e, 'active', 'connected', false, false, now(), now())"""),
            {"a": f"int_itest_ob_{tag}", "t": org_b, "e": f"b-{tag}@itest.example"})
        all_perms = (await db.execute(text("SELECT id, key FROM permissions"))).all()
        for who in ("owner", "member"):
            await db.execute(text("""INSERT INTO users (id, email, hashed_password, full_name, is_active, is_verified,
                created_at, updated_at) VALUES (:id, :e, 'x', :n, true, true, now(), now())"""),
                {"id": users[who], "e": f"{who}-{tag}@itest.example", "n": f"IT {who}"})
            await db.execute(text("""INSERT INTO roles (id, organization_id, name, is_system_role, created_at, updated_at)
                VALUES (:id, :o, :n, false, now(), now())"""), {"id": roles[who], "o": org_a, "n": f"itest-{who}"})
            perms = all_perms if who == "owner" else [p for p in all_perms if p.key in MEMBER_KEYS]
            for p in perms:
                await db.execute(text("INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at) "
                                      "VALUES (:id, :r, :p, now(), now())"),
                                 {"id": f"rp_{uuid.uuid4().hex[:16]}", "r": roles[who], "p": p.id})
            await db.execute(text("""INSERT INTO organization_members (id, organization_id, user_id, role_id, status,
                created_at, updated_at) VALUES (:id, :o, :u, :r, 'ACTIVE', now(), now())"""),
                {"id": f"mem_{uuid.uuid4().hex[:16]}", "o": org_a, "u": users[who], "r": roles[who]})
        await db.commit()

    def client(who: str) -> httpx.AsyncClient:
        token = create_access_token(users[who], tenant_id=org_a)
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://itest/api/v1",
                                 headers={"Authorization": f"Bearer {token}"}, timeout=120)

    clients = {who: client(who) for who in users}
    try:
        yield {"org_a": org_a, "org_b": org_b, "c": clients}
    finally:
        for c in clients.values():
            await c.aclose()
        for org in (org_a, org_b):
            await purge_tenant(org)
        async with db_manager.session_factory() as db:
            await db.execute(text("DELETE FROM roles WHERE id = ANY(:r)"), {"r": list(roles.values())})
            await db.execute(text("DELETE FROM users WHERE id = ANY(:u)"), {"u": list(users.values())})
            await db.commit()


PROFILE = {"description": "We service home appliances.", "industry_served": "Home Services",
           "products_services": "AC repair, fridge repair"}


async def test_activation_status_never_reads_another_tenant(env):
    c = env["c"]
    other = await c["member"].get("/onboarding/activation-status", params={"organization_id": env["org_b"]})
    assert other.status_code == 403, other.text[:300]
    assert "connected_accounts_count" not in other.text
    own = await c["member"].get("/onboarding/activation-status", params={"organization_id": env["org_a"]})
    assert own.status_code == 200 and own.json()["data"]["connected_accounts_count"] == 0
    implicit = await c["member"].get("/onboarding/activation-status")
    assert implicit.status_code == 200


async def test_business_profile_write_needs_update_permission(env):
    c, org_a = env["c"], env["org_a"]
    denied = await c["member"].patch(f"/organizations/{org_a}/business-profile", json=PROFILE)
    assert denied.status_code == 403, denied.text[:300]
    # reading stays allowed for members
    assert (await c["member"].get(f"/organizations/{org_a}/business-profile")).status_code == 200
    saved = await c["owner"].patch(f"/organizations/{org_a}/business-profile", json=PROFILE)
    assert saved.status_code == 200, saved.text[:300]
    # never across tenants, whatever the role
    cross = await c["owner"].patch(f"/organizations/{env['org_b']}/business-profile", json=PROFILE)
    assert cross.status_code == 403, cross.text[:300]


async def test_validation_and_unauthenticated(env):
    c, org_a = env["c"], env["org_a"]
    bad = await c["owner"].patch(f"/organizations/{org_a}/business-profile", json={"description": "x"})
    assert bad.status_code == 422
    async with httpx.AsyncClient(transport=c["owner"]._transport, base_url="http://itest/api/v1") as anon:
        assert (await anon.get("/onboarding/activation-status")).status_code == 401
