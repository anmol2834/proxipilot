"""RBAC and System Roles Seeder for ProxiPilot.

Guarantees idempotent existence of:
- Discrete permission keys
- System roles (OWNER, ADMIN, MEMBER)
- System role-permission mappings
"""

from datetime import datetime, timezone
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import db_manager
from app.core.logging import logger
from app.models.organization import (
    Permission,
    Role,
    RolePermission,
    SystemRole,
)

SYSTEM_PERMISSIONS: List[Tuple[str, str, str]] = [
    ("perm_org_read", "organization.read", "View organization profile and details"),
    ("perm_org_update", "organization.update", "Update organization profile and settings"),
    ("perm_org_delete", "organization.delete", "Archive or delete organization"),
    ("perm_team_read", "team.read", "View organization members"),
    ("perm_team_invite", "team.invite", "Invite new organization members"),
    ("perm_team_manage_roles", "team.manage_roles", "Change member roles"),
    ("perm_team_remove", "team.remove", "Remove members from organization"),
    ("perm_know_read", "knowledge.read", "Read knowledge items and versions"),
    ("perm_know_create", "knowledge.create", "Create or upload knowledge items"),
    ("perm_know_update", "knowledge.update", "Update existing knowledge items"),
    ("perm_know_delete", "knowledge.delete", "Delete knowledge items"),
    ("perm_int_read", "integration.read", "View connected integrations"),
    ("perm_int_connect", "integration.connect", "Connect mailbox integrations"),
    ("perm_int_disconnect", "integration.disconnect", "Disconnect integrations"),
    ("perm_inbox_read", "inbox.read", "View inbox email threads and messages"),
    ("perm_inbox_reply", "inbox.reply", "Create AI or manual reply drafts"),
    ("perm_inbox_send", "inbox.send", "Send outbound emails"),
    ("perm_inbox_delete", "inbox.delete", "Delete email threads"),
    ("perm_bill_read", "billing.read", "View subscription and billing details"),
    ("perm_bill_manage", "billing.manage", "Manage subscriptions and payment methods"),
    ("perm_set_read", "settings.read", "View workspace preferences"),
    ("perm_set_update", "settings.update", "Update workspace preferences"),
]

SYSTEM_ROLES: List[Tuple[str, str, str]] = [
    (
        "rol_system_owner",
        SystemRole.OWNER.value,
        "Full organization owner with all administrative and billing privileges",
    ),
    (
        "rol_system_admin",
        SystemRole.ADMIN.value,
        "Administrator with organizational and operational management rights",
    ),
    (
        "rol_system_member",
        SystemRole.MEMBER.value,
        "Standard member with operational access to day-to-day features",
    ),
]

ADMIN_PERM_KEYS = {
    "organization.read", "organization.update",
    "team.read", "team.invite", "team.remove",
    "knowledge.read", "knowledge.create", "knowledge.update", "knowledge.delete",
    "integration.read", "integration.connect", "integration.disconnect",
    "inbox.read", "inbox.reply", "inbox.send", "inbox.delete",
    "billing.read",
    "settings.read", "settings.update",
}

MEMBER_PERM_KEYS = {
    "organization.read",
    "team.read",
    "knowledge.read", "knowledge.create", "knowledge.update",
    "integration.read",
    "inbox.read", "inbox.reply", "inbox.send",
    "settings.read",
}


async def ensure_system_rbac(db: AsyncSession) -> None:
    """Ensure all canonical permissions, system roles, and mappings exist in database."""
    now = datetime.now(timezone.utc)

    # 1. Seed Permissions
    existing_perms = await db.execute(select(Permission.key))
    existing_perm_keys = set(existing_perms.scalars().all())

    for perm_id, key, desc in SYSTEM_PERMISSIONS:
        if key not in existing_perm_keys:
            db.add(
                Permission(
                    id=perm_id,
                    key=key,
                    description=desc,
                    created_at=now,
                    updated_at=now,
                )
            )

    # 2. Seed System Roles
    existing_roles = await db.execute(select(Role.name).where(Role.is_system_role.is_(True)))
    existing_role_names = set(existing_roles.scalars().all())

    for role_id, name, desc in SYSTEM_ROLES:
        if name not in existing_role_names:
            db.add(
                Role(
                    id=role_id,
                    name=name,
                    description=desc,
                    is_system_role=True,
                    organization_id=None,
                    created_at=now,
                    updated_at=now,
                )
            )

    await db.flush()

    # 3. Seed Role Permissions
    all_perms_res = await db.execute(select(Permission))
    perm_map = {p.key: p.id for p in all_perms_res.scalars().all()}

    existing_rp = await db.execute(select(RolePermission.role_id, RolePermission.permission_id))
    existing_rp_pairs = set(existing_rp.all())

    # OWNER: gets all permissions
    owner_role_res = await db.execute(select(Role.id).where(Role.name == SystemRole.OWNER.value, Role.is_system_role.is_(True)))
    owner_role_id = owner_role_res.scalar_one_or_none()
    if owner_role_id:
        for p_key, p_id in perm_map.items():
            if (owner_role_id, p_id) not in existing_rp_pairs:
                db.add(
                    RolePermission(
                        id=f"rp_{owner_role_id}_{p_id[:16]}",
                        role_id=owner_role_id,
                        permission_id=p_id,
                        created_at=now,
                        updated_at=now,
                    )
                )

    # ADMIN: gets admin permissions
    admin_role_res = await db.execute(select(Role.id).where(Role.name == SystemRole.ADMIN.value, Role.is_system_role.is_(True)))
    admin_role_id = admin_role_res.scalar_one_or_none()
    if admin_role_id:
        for p_key, p_id in perm_map.items():
            if p_key in ADMIN_PERM_KEYS and (admin_role_id, p_id) not in existing_rp_pairs:
                db.add(
                    RolePermission(
                        id=f"rp_{admin_role_id}_{p_id[:16]}",
                        role_id=admin_role_id,
                        permission_id=p_id,
                        created_at=now,
                        updated_at=now,
                    )
                )

    # MEMBER: gets member permissions
    member_role_res = await db.execute(select(Role.id).where(Role.name == SystemRole.MEMBER.value, Role.is_system_role.is_(True)))
    member_role_id = member_role_res.scalar_one_or_none()
    if member_role_id:
        for p_key, p_id in perm_map.items():
            if p_key in MEMBER_PERM_KEYS and (member_role_id, p_id) not in existing_rp_pairs:
                db.add(
                    RolePermission(
                        id=f"rp_{member_role_id}_{p_id[:16]}",
                        role_id=member_role_id,
                        permission_id=p_id,
                        created_at=now,
                        updated_at=now,
                    )
                )

    await db.commit()
    logger.info("System RBAC permissions and roles verified.")
