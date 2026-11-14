# ProxiPilot — Knowledge Base CRUD API Reference (Phase 7.3)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.3 (Knowledge CRUD + Tenant Isolation)  
Last Updated: 2026-09-17  

This document specifies the REST API endpoints, request/response models, keyset cursor pagination, and lifecycle semantics for ProxiPilot's business knowledge base.

---

## 1. Endpoints Overview

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/knowledge` | `knowledge.create` | Create knowledge item and Version 1 snapshot |
| `GET` | `/api/v1/knowledge` | `knowledge.read` | Keyset cursor-paginated list and search |
| `GET` | `/api/v1/knowledge/{id}` | `knowledge.read` | Get item details and active facts |
| `PATCH` | `/api/v1/knowledge/{id}` | `knowledge.update` | Update item (creates new version snapshot) |
| `DELETE` | `/api/v1/knowledge/{id}` | `knowledge.delete` | Soft-archive (default) or hard-delete item |
| `GET` | `/api/v1/knowledge/{id}/versions` | `knowledge.read` | Inspect historical version snapshots |

---

## 2. Request & Response Contracts

### 2.1 Create Knowledge Item (`POST /api/v1/knowledge`)
**Payload**:
```json
{
  "category": "products-services",
  "title": "AC Repair & Maintenance Service",
  "type": "Service",
  "description": "Comprehensive diagnostic, coil cleaning, and compressor repair.",
  "content": "Full service guide for commercial and residential HVAC units.",
  "status": "Published",
  "source": "manual",
  "tags": ["hvac", "repair", "maintenance"],
  "pricing": "$150 - $400",
  "currency": "USD",
  "warranty": "90-day parts and labor guarantee",
  "serviceRegions": "Greater Metropolitan Area",
  "canonical_data": {
    "price": 150.0,
    "currency": "USD",
    "availability": "available",
    "region": "Greater Metropolitan Area",
    "entity_type": "SERVICE"
  },
  "custom_attributes": {
    "emergency_turnaround_hours": 4
  }
}
```

**Response (HTTP 201 Created)**:
```json
{
  "id": "ki_1a2b3c4d5e6f",
  "organizationId": "org_xyz",
  "category": "products-services",
  "type": "Service",
  "title": "AC Repair & Maintenance Service",
  "excerpt": "Comprehensive diagnostic, coil cleaning, and compressor repair.",
  "content": "Full service guide for commercial and residential HVAC units.",
  "status": "Published",
  "source": "Manual",
  "version": 1,
  "updatedAt": "Sep 17, 2026",
  "updatedBy": "You",
  "tags": ["hvac", "repair", "maintenance"],
  "pricing": "150.0 USD",
  "currency": "USD",
  "warranty": "90-day parts and labor guarantee",
  "serviceRegions": "Greater Metropolitan Area",
  "canonical_data": {
    "price": 150.0,
    "currency": "USD",
    "availability": "available",
    "region": "Greater Metropolitan Area",
    "entity_type": "SERVICE"
  },
  "custom_attributes": {
    "emergency_turnaround_hours": 4
  }
}
```

---

## 3. Keyset Cursor Pagination (No OFFSET)

The list endpoint uses opaque keyset cursors built on the stable indexed tuple `(updated_at DESC, id DESC)`.

### Query Parameters:
- `category` (optional): e.g. `products-services`, `policies`, `all`.
- `status` (optional): `active`, `published`, `archived`, `all`.
- `search` (optional): Case-insensitive indexed search across `title` and `description`.
- `limit` (optional): Default 20, max 100.
- `cursor` (optional): Opaque base64 token returned in `next_cursor` from previous response.

### Paginated Response Structure:
```json
{
  "items": [...],
  "next_cursor": "MjAyNi0wOS0xN1QxNTozMDowMC4wMDBaXGtpXzFhMmIzYzRkNWU2Zg==",
  "has_more": true
}
```

---

## 4. Immutable Version Updates (`PATCH /api/v1/knowledge/{id}`)

When an update is submitted:
1. The current active version is archived: `status = ARCHIVED`, `archived_at = NOW()`.
2. A new immutable `KnowledgeVersion` snapshot is created with `version_number = current_version + 1`.
3. Updated canonical and custom attributes are attached to the new version record.
4. Historical versions are NEVER overwritten or mutated.
5. Emits `AuditAction.KNOWLEDGE_UPDATED` and `AuditAction.KNOWLEDGE_VERSION_CREATED`.
