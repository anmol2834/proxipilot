# Business Profile Architecture

## 1. Overview & Domain Boundaries

A **Business Profile** defines the operational and commercial identity of an organization:
- What the company does (`description`)
- Which industry it serves (`industry`)
- Target customer demographics (`customer_type`)
- Main products or offerings (`products_services`)
- Operational guidelines and notes (`additional_context`)

### Critical Distinction: Business Profile vs. AI Persona
- **Business Profile**: Fact-based domain reality ("What does this company sell, service, and do?"). Used as grounding knowledge for AI RAG and company-wide business context.
- **AI Persona**: Behavioral interaction layer ("How does ProxiPilot communicate? E.g., tone, persona, signature, empathy level"). AI Persona is a separate domain entity and must not be conflated with the business profile.

## 2. Tenancy & Ownership Model

```
Organization (1) ──── (1) BusinessProfile
```

- **Strict Organization Ownership**: The business profile belongs to the **Organization**, NOT the individual user (`business_profiles.organization_id`).
- All members within the organization operate against the same organizational business profile.
- Foreign key constraint: `organization_id REFERENCES organizations(id) ON DELETE CASCADE`.
- Unique constraint: `UNIQUE(organization_id)` ensures exactly one business profile per tenant.

## 3. Storage & Schema

Table: `business_profiles`
- `id` (VARCHAR(36), PK): UUIDv7 / ULID.
- `organization_id` (VARCHAR(36), FK, UNIQUE): Tenant ownership.
- `description` (TEXT): High-level operational overview.
- `industry` (VARCHAR(100)): Primary industry category.
- `customer_type` (VARCHAR(50)): B2B, B2C, Enterprise, SMB, etc.
- `main_products_services` (TEXT): Specific products or offerings.
- `additional_context` (TEXT, nullable): Operational details.
- `created_at` / `updated_at`: Timestamps.

## 4. Authorization & Security

- Access to `GET` / `PATCH` requires verified membership in the organization (`MEMBERS_READ` / `ORG_UPDATE`).
- Cross-tenant IDOR attacks are blocked at the repository boundary:
  ```python
  stmt = select(BusinessProfile).where(
      BusinessProfile.organization_id == context.organization_id
  )
  ```
- Cache Invalidation: On update, Redis cache key `tenant:{organization_id}:config:business_profile` is invalidated immediately.
