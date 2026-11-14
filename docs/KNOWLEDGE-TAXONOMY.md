# ProxiPilot — Knowledge Taxonomy Specification (Phase 7.1)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.1 (Knowledge Taxonomy + Category Schemas)  
Last Updated: 2026-09-17  

This document formalizes the canonical category taxonomy for ProxiPilot's multi-tenant Knowledge Architecture. All future ingest engines (CSV/Excel), UI authoring forms, versioning workflows, and AI retrieval projections strictly adhere to this taxonomy.

---

## 1. The Nine Frozen Canonical Categories

ProxiPilot organizes all business facts, operational guidelines, and customer-facing data into exactly nine canonical categories:

```
                          CANONICAL TAXONOMY
                                  │
    ┌────────────────┬────────────┼────────────┬────────────────┐
    ▼                ▼            ▼            ▼                ▼
company_info   products_services  contacts  policies       support_faqs
                     │
    ┌────────────────┼────────────┬────────────┐
    ▼                ▼            ▼            ▼
offers_promotions operations  locations  brand_communication
```

### 1.1 Category Registry Overview

| # | Machine Key | Display Name | Primary Entity Types | Temporal? | Regional? | Purpose & Scope |
| :- | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | `company_info` | Company Info | `ORGANIZATION`, `BRANCH`, `LEGAL_ENTITY` | ❌ | ✅ | Identity, corporate overview, mission, founding year, registration facts. |
| 2 | `products_services` | Products & Services | `PRODUCT`, `SERVICE`, `PACKAGE`, `PLAN` | ✅ | ✅ | Commercial catalog offerings, specifications, availability, and **all pricing**. |
| 3 | `contacts` | Contacts | `PERSON`, `DEPARTMENT`, `HOTLINE` | ❌ | ✅ | Key personnel, team points of contact, support desks, and escalations. |
| 4 | `policies` | Policies | `POLICY`, `AGREEMENT`, `STANDARD` | ✅ | ✅ | Formal business rules, refund guidelines, terms of service, warranty, and SLAs. |
| 5 | `support_faqs` | Support & FAQs | `FAQ`, `HOW_TO`, `TROUBLESHOOTING` | ❌ | ✅ | Frequently asked questions, customer problem resolution, and verified answers. |
| 6 | `offers_promotions` | Offers & Promotions | `DISCOUNT`, `PROMO_CODE`, `BUNDLE`, `SEASONAL` | ✅ | ✅ | Time-sensitive discounts, promotional campaigns, coupons, and seasonal sales. |
| 7 | `operations` | Operations | `SOP`, `PROCESS`, `WORKFLOW` | ❌ | ✅ | Standard Operating Procedures, fulfillment rules, turnaround times, and logistics. |
| 8 | `locations` | Locations | `OFFICE`, `WAREHOUSE`, `BRANCH`, `STORE` | ❌ | ✅ | Physical branch offices, warehouses, retail stores, and service territory zones. |
| 9 | `brand_communication`| Brand & Communication | `VOICE_GUIDE`, `MESSAGING`, `STYLE_SHEET` | ❌ | ✅ | AI conversational voice, tone of voice, communication standards, and taboo phrases. |

---

## 2. Hard Taxonomy Invariants

### 2.1 The Standalone Pricing Rule (Rule 11 & 12)
> [!IMPORTANT]  
> **There is NO standalone `pricing` category.**  
> Pricing is not an isolated taxonomy branch; it is an intrinsic commercial attribute of an offering. All pricing facts (`price`, `currency`, `billing_period`, `unit`, `minimum_quantity`) belong **strictly inside `products_services`**.
> 
> *Rationale for AI Grounding:* When a prospect asks in negotiation: *"What is the cost of the AC overhaul package?"*, retrieval filters by `category = products_services` and matches the entity name. Storing pricing in an independent category creates disconnected records, leading to entity resolution ambiguities and hallucinated cross-references.

### 2.2 Machine Key Stability (Rule 6)
* The machine key (e.g. `products_services`, `company_info`) is an immutable domain contract identifier.
* UI display labels (e.g. *"Products & Services"*, *"Company Info"*) and localized titles may evolve, but backend database values, API parameters, and vector payload filters must always use the exact canonical snake_case string.
* Category key normalization accepts kebab-case from UI URLs (e.g. `/knowledge?category=products-services`) and deterministically normalizes it to `products_services` before executing any query or validation.

---

## 3. Detailed Category Semantics & Boundaries

### 3.1 `company_info`
* **Semantic Definition**: Macro-level organizational facts, corporate narrative, founding metadata, and official identity.
* **Included Facts**: Company name, legal entity name, corporate mission statement, industry sector, headquarters city, global website, founding year, employee headcount range, general contact email/phone.
* **Boundary Clarification**: Individual employee contact details belong in `contacts`, not here. Branch street addresses belong in `locations`, not here.
* **Relationship to `business_profiles`**: The `business_profiles` table stores operational onboarding profile configuration (used for system bootstrapping). `company_info` represents customer-facing, authoritative business knowledge that can be edited, versioned, and cited by AI during conversations.

### 3.2 `products_services`
* **Semantic Definition**: All commercial offerings provided by the organization to its clients.
* **Included Facts**: Product names, service packages, software subscription tiers, SKUs, brand names, sub-categories, physical specifications, hourly/monthly/annual prices, accepted currencies, billing cycles, stock availability, service warranty, and service territories.
* **Entity Types**:
  * `PRODUCT`: Physical goods or manufactured items with SKUs and stock states.
  * `SERVICE`: Professional services, maintenance contracts, or field labor.
  * `PACKAGE`: Bundled products and services sold together.
  * `PLAN`: Recurring SaaS or retainer subscription tiers.

### 3.3 `contacts`
* **Semantic Definition**: Directory of communication endpoints, key representatives, and departments.
* **Included Facts**: Full name, job title/role, department, direct email, desk phone, mobile/alternate phone, office location, on-call schedule/availability hours, and internal escalation notes.
* **Boundary Clarification**: Only business contact information is stored. Personal credentials, passwords, or authentication secrets must never enter the knowledge base.

### 3.4 `policies`
* **Semantic Definition**: Enforceable business rules, customer commitments, terms, and constraints.
* **Included Facts**: Title, policy classification (refund, cancellation, privacy, SLA, warranty, compliance), summary statement, full narrative details, scope of applicability, jurisdiction/region, and temporal validity window (`effective_from`, `effective_until`).
* **Boundary Clarification**: General troubleshooting guides belong in `support_faqs`, not `policies`. Step-by-step internal SOPs belong in `operations`.

### 3.5 `support_faqs`
* **Semantic Definition**: Verified customer inquiries paired with canonical, approved responses.
* **Included Facts**: Question text, complete verified answer, 1-sentence executive short answer, topic tag, related product/service link, target audience segment, and regional scope.
* **Boundary Clarification**: FAQs provide conversational answers. They cite underlying `policies` or `products_services`, but do not redefine core business pricing or legal terms.

### 3.6 `offers_promotions`
* **Semantic Definition**: Active, scheduled, or past promotional discounts, sales campaigns, and coupon codes.
* **Included Facts**: Campaign title, discount percentage or flat amount, currency, promo coupon code, eligible product/service SKUs, target customer segment, terms and exclusions, start timestamp (`start_at`), end timestamp (`end_at`), and status (`active`, `expired`, `upcoming`, `draft`).
* **Boundary Clarification**: Base catalog pricing belongs in `products_services`. Only temporary, promotional variations belong in `offers_promotions`.

### 3.7 `operations`
* **Semantic Definition**: Internal and field operational procedures, fulfillment schedules, turnaround windows, and escalation paths.
* **Included Facts**: Workflow title, detailed step-by-step SOP procedure, process owner role, operating department, business hours, guaranteed SLA turnaround time, escalation criteria, and territory.
* **Boundary Clarification**: Customer-facing rules belong in `policies`. `operations` represents practical execution workflows.

### 3.8 `locations`
* **Semantic Definition**: Physical facilities, branches, logistics warehouses, and service dispatch zones.
* **Included Facts**: Branch name, facility type (HQ, branch, warehouse, retail store, service center), street address, city, state, country, postal code, GPS coordinates (latitude/longitude), branch direct phone/email, operating hours, service coverage area, and local timezone.
* **Boundary Clarification**: Corporate identity belongs in `company_info`. Specific facility addresses and geo-dispatch boundaries belong here.

### 3.9 `brand_communication`
* **Semantic Definition**: Persona parameters, tone of voice guidelines, approved brand terminology, and taboo vocabulary.
* **Included Facts**: Guideline title, primary conversational voice persona (`professional`, `friendly`, `formal`, `consultative`, `casual`, `empathetic`), descriptive tone nuances, style guidelines, standard greeting style, standard closing style, language/locale preferences, preferred brand phrases, strictly avoided words/phrases (`do_not_say`), and few-shot exemplary responses.
* **Boundary Clarification**: This category directly steers the AI model's generation style during email negotiations.

---

## 4. Normalization and Discovery Contract

The application provides deterministic normalization for all taxonomy operations:

```python
from app.contracts.knowledge import category_registry, normalize_category_key

# URL input: "products-services" -> normalized: "products_services"
clean_key = normalize_category_key("products-services")

# Sub-millisecond in-memory registry resolution
cat_def = category_registry.get(clean_key)
print(cat_def.display_name)  # "Products & Services"
print(cat_def.fields["price"].field_type)  # AttributeValueType.DECIMAL
```
