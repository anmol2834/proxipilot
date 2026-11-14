# Role-Based Access Control (RBAC) Architecture

## 1. Principles & Anti-Patterns

### Anti-Pattern: Never scatter role string comparisons
```python
# ❌ INCORRECT / PROHIBITED:
if member.role == "owner":
    allow_action()
```

### Correct Pattern: Permission-based decoupling
```python
# ✅ CORRECT:
await authorization_service.require(
    db=db,
    user_id=user_id,
    organization_id=organization_id,
    permission_key="organization.update",
)
```

---

## 2. RBAC Data Schema

```text
roles (id, name, is_system_role, organization_id)
  │
  ▼
role_permissions (role_id, permission_id)
  ▲
  │
permissions (id, key, description)
```

### Extensibility:
- **System Roles (`is_system_role=True, organization_id=NULL`)**:
  - `OWNER`
  - `ADMIN`
  - `MEMBER`
- **Tenant Custom Roles (`is_system_role=False, organization_id="org_...")`**:
  - Allows future enterprise tenants to create custom roles (e.g. `Support Lead`, `Sales Rep`) without altering core database architecture.

---

## 3. V1 Role-Permission Matrix

| Permission Key | Description | OWNER | ADMIN | MEMBER |
| :--- | :--- | :---: | :---: | :---: |
| `organization.read` | View organization profile | ✅ | ✅ | ✅ |
| `organization.update` | Update organization details | ✅ | ✅ | ❌ |
| `organization.delete` | Delete or archive organization | ✅ | ❌ | ❌ |
| `team.read` | View team members | ✅ | ✅ | ✅ |
| `team.invite` | Invite new members | ✅ | ✅ | ❌ |
| `team.manage_roles` | Modify member roles | ✅ | ❌ | ❌ |
| `team.remove` | Remove team members | ✅ | ✅ | ❌ |
| `knowledge.read` | Access knowledge base | ✅ | ✅ | ✅ |
| `knowledge.create` | Upload / create knowledge | ✅ | ✅ | ✅ |
| `knowledge.update` | Edit knowledge versions | ✅ | ✅ | ✅ |
| `knowledge.delete` | Delete knowledge items | ✅ | ✅ | ❌ |
| `integration.read` | View mailboxes | ✅ | ✅ | ✅ |
| `integration.connect` | Connect Gmail / IMAP | ✅ | ✅ | ❌ |
| `integration.disconnect` | Disconnect mailbox | ✅ | ✅ | ❌ |
| `inbox.read` | Read email conversations | ✅ | ✅ | ✅ |
| `inbox.reply` | Reply to email threads | ✅ | ✅ | ✅ |
| `inbox.send` | Send outbound emails | ✅ | ✅ | ✅ |
| `inbox.delete` | Delete email threads | ✅ | ✅ | ❌ |
| `billing.read` | View invoices & plan | ✅ | ✅ | ❌ |
| `billing.manage` | Upgrade/cancel plan | ✅ | ❌ | ❌ |
| `settings.read` | View workspace config | ✅ | ✅ | ✅ |
| `settings.update` | Modify workspace config | ✅ | ✅ | ❌ |

---

## 4. Central Authorization Service (`AuthorizationService`)

Located at `app.core.authorization.authorization_service`:
- **`has_permission(db, user_id, organization_id, permission_key) -> bool`**: Returns boolean evaluation without raising.
- **`require(db, user_id, organization_id, permission_key) -> OrganizationMember`**: Raises `403 Forbidden` if missing permission or if membership is inactive.
- **`verify_resource_tenancy(resource_org_id, current_org_id)`**: Verifies that requested entity belongs to the caller's active tenant (IDOR prevention).
