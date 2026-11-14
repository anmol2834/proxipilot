# Tenant Isolation & IDOR Security Testing — ProxiPilot

## 1. Overview

This document specifies the automated security testing strategy proving strict multi-tenant boundary enforcement and Insecure Direct Object Reference (IDOR) immunity across the ProxiPilot backend.

## 2. Test Architecture: Dual Tenant Isolation

Tests instantiate two complete, isolated tenant environments:
- **Tenant A**: User A (`alice@tenant-a.com`), Organization A (`Acme Corp A`), OWNER role.
- **Tenant B**: User B (`bob@tenant-b.com`), Organization B (`Beta Corp B`), OWNER role.

Both tenants hold distinct business profiles, workspace preferences, and configuration state.

## 3. Automated Test Scenarios (`server/tests/test_tenant_security.py`)

| Test Name | Threat Vector | Target Route | Expected Result |
|---|---|---|---|
| `test_cross_tenant_organization_idor` | Cross-tenant resource read / write | `GET/PATCH /api/v1/organizations/{org_b_id}` | `403 Forbidden` ("Caller is not a member") |
| `test_cross_tenant_business_profile_idor` | Cross-tenant profile tampering | `GET/PATCH /api/v1/organizations/{org_b_id}/business-profile` | `403 Forbidden` |
| `test_cross_tenant_preferences_idor` | Cross-tenant preferences hijack | `GET/PATCH /api/v1/organizations/{org_b_id}/preferences` | `403 Forbidden` |
| `test_spoofed_organization_header` | Tenant header manipulation | `GET /api/v1/onboarding/state` with `X-Organization-Id: org_b_id` | `403 Forbidden` |
| `test_redis_tenant_isolation` | Cache namespace collision | `tenant:{org_id}:{namespace}:{key}` | Independent Redis namespaces, cross-tenant reads impossible |
| `test_qdrant_tenant_filter_enforcement` | Vector search boundary leak | Vector queries | Unscoped filter raises `TenantScopingError` |
| `test_event_envelope_tenant_enforcement` | Unscoped event emission | Domain event envelopes | Missing `tenant_id` raises `TenantScopingError` |
| `test_audit_event_recording_and_redaction` | Tenant log scoping & secret leaks | Audit event service | Sensitive fields redacted, Org A cannot query Org B audit log |

## 4. Execution & Verification

Run automated tenant isolation suite:
```bash
python -m pytest tests/test_tenant_security.py -v
```
All 8 test cases run in isolation against test PostgreSQL and Redis instances.
