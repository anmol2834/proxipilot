# ProxiPilot — Knowledge Taxonomy Specification (Phase 7.1)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.1 (Knowledge Taxonomy + Category Schemas)  
Last Updated: 2026-11-20 (6 categories: Contacts, Operations, Locations and Brand & Communication
removed; Processes & Timelines added)

This document formalizes the canonical category taxonomy for ProxiPilot's multi-tenant Knowledge Architecture. All future ingest engines (CSV/Excel), UI authoring forms, versioning workflows, and AI retrieval projections strictly adhere to this taxonomy.

---

## 1. The Six Frozen Canonical Categories

ProxiPilot organizes all business facts and customer-facing data into exactly six canonical categories:

```
                              CANONICAL TAXONOMY
                                      │
    ┌──────────────┬──────────────┬───┴──────────┬──────────────────┬─────────────────────┐
    ▼              ▼              ▼              ▼                  ▼                     ▼
company_info  products_services  policies   support_faqs   offers_promotions   processes_timelines
```

### 1.1 Category Registry Overview

| # | Machine Key | Display Name | Primary Entity Types | Temporal? | Regional? | Purpose & Scope |
| :- | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | `company_info` | Company Info | `ORGANIZATION`, `BRANCH`, `LEGAL_ENTITY` | ❌ | ✅ | Identity, corporate overview, and the company's contact details: email, phone, address, business hours. |
| 2 | `products_services` | Products & Services | `PRODUCT`, `SERVICE`, `PACKAGE`, `PLAN` | ✅ | ✅ | Commercial catalog offerings, specifications, availability, and **all pricing**. |
| 3 | `policies` | Policies | `POLICY`, `AGREEMENT`, `STANDARD` | ✅ | ✅ | Formal business rules, refund guidelines, terms of service, warranty, and SLAs. |
| 4 | `support_faqs` | Support & FAQs | `FAQ`, `HOW_TO`, `TROUBLESHOOTING` | ❌ | ✅ | Frequently asked questions, customer problem resolution, and verified answers. |
| 5 | `offers_promotions` | Offers & Promotions | `DISCOUNT`, `PROMO_CODE`, `BUNDLE`, `SEASONAL` | ✅ | ✅ | Time-sensitive discounts, promotional campaigns, coupons, and seasonal sales. |
| 6 | `processes_timelines` | Processes & Timelines | `PROCESS`, `WORKFLOW`, `TIMELINE` | ❌ | ✅ | How things work and how long they take: PO/order confirmation, quotation turnaround, dispatch & delivery lead times, payment/refund processing, onboarding & installation steps. |

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
* Removed keys (`contacts`, `operations`, `locations`, `brand_communication`) are rejected by `normalize_category_key`; the dashboard ignores them in old links and shows all items.

### 2.3 The Dashboard Has No "All" View
Exactly one category card is always selected and the list shows that category's items. The page opens on
**Products & Services** (first card) unless the URL names another valid category (`?category=company-info`);
an unknown or retired value (e.g. `?category=operations`) also opens Products & Services. Cards are laid
out 3 per row. `GET /knowledge/stats` still returns an `all` total, but no UI view or stored item uses it.

---

## 3. Detailed Category Semantics & Boundaries

### 3.1 `company_info`
* **Semantic Definition**: Macro-level organizational facts, corporate narrative, founding metadata, official identity, and how customers reach the company.
* **Included Facts**: Company name, legal entity name, description, industry sector, headquarters, website, founding year, employee headcount range, general / support / sales email, phone, office address(es) and business hours.
* **Retrieval**: "How can I contact you / what is your address / what are your timings" is answered from this category (contact resolution reads Company Info records that carry an email, phone, address or hours).
* **Relationship to `business_profiles`**: The `business_profiles` table stores operational onboarding profile configuration (used for system bootstrapping). `company_info` represents customer-facing, authoritative business knowledge that can be edited, versioned, and cited by AI during conversations.

### 3.2 `products_services`
* **Semantic Definition**: All commercial offerings provided by the organization to its clients.
* **Included Facts**: Product names, service packages, software subscription tiers, SKUs, brand names, sub-categories, physical specifications, hourly/monthly/annual prices, accepted currencies, billing cycles, stock availability, service warranty, and service territories.
* **Entity Types**:
  * `PRODUCT`: Physical goods or manufactured items with SKUs and stock states.
  * `SERVICE`: Professional services, maintenance contracts, or field labor.
  * `PACKAGE`: Bundled products and services sold together.
  * `PLAN`: Recurring SaaS or retainer subscription tiers.

### 3.3 `policies`
* **Semantic Definition**: Enforceable business rules, customer commitments, terms, and constraints.
* **Included Facts**: Title, policy classification (refund, cancellation, privacy, SLA, warranty, compliance), summary statement, full narrative details, scope of applicability, jurisdiction/region, and temporal validity window (`effective_from`, `effective_until`).
* **Boundary Clarification**: General troubleshooting guides belong in `support_faqs`. *What happens and how long it takes* (e.g. "refunds are processed within 7 working days after the return is received") belongs in `processes_timelines`; the rule itself ("returns accepted within 30 days") stays here.

### 3.4 `support_faqs`
* **Semantic Definition**: Verified customer inquiries paired with canonical, approved responses.
* **Included Facts**: Question text, complete verified answer, 1-sentence executive short answer, topic tag, related product/service link, target audience segment, and regional scope.
* **Boundary Clarification**: FAQs provide conversational answers. They cite underlying `policies` or `products_services`, but do not redefine core business pricing or legal terms.

### 3.5 `offers_promotions`
* **Semantic Definition**: Active, scheduled, or past promotional discounts, sales campaigns, and coupon codes.
* **Included Facts**: Campaign title, discount percentage or flat amount, currency, promo coupon code, eligible product/service SKUs, target customer segment, terms and exclusions, start timestamp (`start_at`), end timestamp (`end_at`), and status (`active`, `expired`, `upcoming`, `draft`).
* **Boundary Clarification**: Base catalog pricing belongs in `products_services`. Only temporary, promotional variations belong in `offers_promotions`.

### 3.6 `processes_timelines`
* **Semantic Definition**: The business's own stated steps and timelines for what happens after a customer action — so replies answer "what happens next and when" without inventing a commitment.
* **Typical questions answered**: "After the PO, what is the confirmation time?", "How long does dispatch take after payment?", "What is the delivery lead time to Pune?", "When will the quotation be shared?", "How many days for the refund?", "What are the onboarding / installation steps?"
* **Fields**: `process_name` (required), `stage` (quotation, order, dispatch, delivery, payment, returns, …), `trigger` (what starts the clock, e.g. "After the PO is received"), `timeline` (the commitment verbatim, e.g. "Within 24 working hours"), `steps`, `description`, `conditions` (exceptions: bulk orders, holidays, custom items), `customer_action` (what the customer must provide), `applies_to` (products / order sizes / customer types), `working_hours`, `owner`, `region`.
* **Identity (dedup)**: `process_name` + `applies_to` + `region`, so "PO confirmation — bulk orders" and "PO confirmation — standard" stay separate items.
* **Retrieval**: Each item is projected as one chunk (process name, trigger, timeline and conditions stay together). Process/timeline questions form their own evidence group (`CandidateRole.PROCESS_TIMELINE`); they are never routed to the appointment-booking path. With no records in this category the reply withholds a timeline instead of guessing.
* **Import aliases**: sheet/category names `processes`, `process`, `timelines`, `lead_times`, `turnaround_times`, `workflows`, `procedures`, `sop(s)`; column aliases such as `lead_time`, `tat`, `turnaround`, `confirmation_time`, `dispatch_time`, `delivery_time`, `sla` map to `timeline`.

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
