# ProxiPilot — Category Schemas & Canonical Field Specifications (Phase 7.1)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.1 (Knowledge Taxonomy + Category Schemas)  
Last Updated: 2026-09-17  

This document specifies the complete, typed canonical field contract for each of the nine knowledge categories. Every field is defined with its concrete data type, nullability, validation constraints, normalization rules, and its designated role in future AI retrieval (structured filter vs semantic narrative text).

---

## 1. Schema System Overview

Every knowledge item belongs to a canonical category. A record within that category consists of:
1. **Identity-Level Canonical Fields**: Invariant properties stored directly on `KnowledgeItem` (`title`, `category`, `source_id`, `is_active`).
2. **Versioned Canonical Fields**: Facts that change over time, stored across `KnowledgeVersion` (narrative `content_text`) and `KnowledgeAttribute` (concrete typed columns).
3. **Tenant-Scoped Custom Attributes**: Extensible, typed attributes defined per tenant in `KnowledgeAttributeDefinition`.

### Field Classification Keys
* **Type**: `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `datetime`, `currency`, `enum`, `array`.
* **Required**: Mandatory on record creation/import.
* **Retrieval Role**:
  * **Structured Filter**: Preserved as exact relational and Qdrant payload filters for metadata-constrained queries.
  * **Semantic Narrative**: Projects into plain text chunks for semantic embedding and vector similarity search.
  * **Informational**: Metadata preserved for citation or human review.

---

## 2. Category 1: `company_info`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `company_name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Canonical brand or business trade name. |
| `legal_name` | `string` | No | Informational | `trim` | Max 255 chars | Official registered legal corporate entity name. |
| `description` | `text` | No | **Semantic Narrative** | `trim` | — | Macro narrative overview, founding mission, and value proposition. |
| `industry` | `string` | No | Structured Filter | `trim` | Max 128 chars | Primary economic sector or business domain. |
| `website` | `string` | No | Informational | `trim` | Valid URL | Official website URL. |
| `founded_year` | `integer`| No | Informational | `number` | 1800 to 2100 | Year the enterprise was founded. |
| `company_size` | `enum` | No | Informational | `enum` | `1-10`, `11-50`, `51-200`, `201-500`, `500+` | Total employee headcount range. |
| `headquarters` | `string` | No | Structured Filter | `trim` | Max 128 chars | Main headquarters city, state, or metropolitan area. |
| `email` | `string` | No | Informational | `email` | RFC 5322 regex | General public inquiry email. |
| `phone` | `string` | No | Informational | `phone` | Digits & leading `+` | Main corporate switchboard telephone. |
| `support_email`| `string` | No | Informational | `email` | RFC 5322 regex | Dedicated support team email. |
| `sales_email` | `string` | No | Informational | `email` | RFC 5322 regex | Dedicated sales desk email. |

---

## 3. Category 2: `products_services` (Includes All Pricing)

> [!IMPORTANT]  
> All pricing facts belong strictly inside `products_services`. There is no separate `pricing` category.

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Name of product, plan, or service offering. |
| `entity_type` | `enum` | **Yes** | Structured Filter | `enum` | `PRODUCT`, `SERVICE`, `PACKAGE`, `PLAN` | Commercial offering classification. |
| `description` | `text` | No | **Semantic Narrative** | `trim` | — | In-depth description, scope of work, and customer value. |
| `short_description`| `string` | No | **Semantic Narrative** | `trim` | Max 512 chars | 1–2 sentence executive summary. |
| `sku` | `string` | No | Structured Filter | `trim` | Max 128 chars | Unique SKU or internal catalog code. |
| `brand` | `string` | No | Structured Filter | `trim` | Max 128 chars | Brand or manufacturer name. |
| `sub_category` | `string` | No | Structured Filter | `trim` | Max 128 chars | Sub-classification (e.g. "HVAC Overhaul", "Annual SaaS"). |
| `price` | `decimal`| No | Structured Filter | `number` | $\ge 0.0$ | Exact commercial price amount. |
| `currency` | `currency`| No | Structured Filter | `currency` | ISO-4217 3-letter code (e.g. `INR`, `USD`). | Currency code for price. |
| `billing_period` | `enum` | No | Structured Filter | `enum` | `one_time`, `hourly`, `daily`, `weekly`, `monthly`, `quarterly`, `annual` | Recurring billing schedule. |
| `availability` | `enum` | No | Structured Filter | `enum` | `in_stock`, `available`, `out_of_stock`, `discontinued`, `by_appointment` | Current fulfillment state (default `available`). |
| `region` | `string` | No | Structured Filter | `trim` | Max 128 chars | Geographic zone or service territory. |
| `warranty` | `string` | No | Informational | `trim` | Max 255 chars | Standard warranty terms and coverage. |
| `unit` | `string` | No | Informational | `trim` | Max 64 chars | Pricing unit (e.g. `hour`, `seat`, `visit`, `box`). |
| `minimum_quantity` | `integer`| No | Informational | `number` | $\ge 1$ | Minimum order quantity. |
| `features` | `array` | No | **Semantic Narrative** | `array` | List of strings | Core bulleted features and specifications. |
| `service_area` | `string` | No | Structured Filter | `trim` | Max 255 chars | Specific physical cities/districts covered. |

---

## 4. Category 3: `contacts`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Name of contact person, desk, or department. |
| `contact_type` | `enum` | **Yes** | Structured Filter | `enum` | `sales`, `support`, `billing`, `operations`, `emergency`, `general` | Functional department/endpoint role. |
| `role` | `string` | No | Informational | `trim` | Max 128 chars | Professional title or function. |
| `department` | `string` | No | Structured Filter | `trim` | Max 128 chars | Organizational division. |
| `email` | `string` | No | Informational | `email` | RFC 5322 regex | Direct or desk email address. |
| `phone` | `string` | No | Informational | `phone` | Digits & leading `+` | Direct telephone number. |
| `alternate_phone` | `string` | No | Informational | `phone` | Digits & leading `+` | Mobile or after-hours telephone number. |
| `location` | `string` | No | Structured Filter | `trim` | Max 128 chars | Office floor, building, or branch desk. |
| `availability` | `string` | No | Informational | `trim` | Max 128 chars | Working hours or dispatch schedule. |
| `notes` | `text` | No | **Semantic Narrative** | `trim` | — | Internal routing or escalation guidelines. |

---

## 5. Category 4: `policies`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `policy_name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Formal policy title. |
| `policy_type` | `enum` | **Yes** | Structured Filter | `enum` | `refund`, `cancellation`, `privacy`, `terms_of_service`, `warranty`, `sla`, `shipping`, `compliance`, `general` | Policy classification. |
| `summary` | `string` | No | **Semantic Narrative** | `trim` | Max 512 chars | 1–2 sentence executive summary. |
| `details` | `text` | **Yes** | **Semantic Narrative** | `trim` | Non-empty | Complete binding legal or operational text. |
| `scope` | `string` | No | Informational | `trim` | Max 255 chars | Client segments or product lines covered. |
| `applicability` | `string` | No | Informational | `trim` | Max 255 chars | Specific preconditions triggering policy. |
| `region` | `string` | No | Structured Filter | `trim` | Max 128 chars | Jurisdiction or legal territory. |
| `effective_from` | `datetime`| No | Structured Filter | `datetime` | ISO-8601 | Start timestamp when policy takes legal effect. |
| `effective_until`| `datetime`| No | Structured Filter | `datetime` | ISO-8601 | Expiry timestamp when policy ceases validity. |

---

## 6. Category 5: `support_faqs`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `question` | `string` | **Yes** | **Semantic Narrative** & Filter | `trim` | 3–512 chars | Canonical customer prompt or inquiry. |
| `answer` | `text` | **Yes** | **Semantic Narrative** | `trim` | Non-empty | Authoritative verified answer. |
| `short_answer` | `string` | No | **Semantic Narrative** | `trim` | Max 255 chars | Concise single-sentence answer. |
| `category_tag` | `string` | No | Structured Filter | `trim` | Max 64 chars | Topic tag (e.g. `billing`, `setup`, `wifi`). |
| `related_service` | `string`| No | Structured Filter | `trim` | Max 128 chars | SKU or name of associated offering. |
| `audience` | `enum` | No | Structured Filter | `enum` | `all`, `prospective_clients`, `existing_customers`, `internal_staff` | Target recipient group (default `all`). |
| `region` | `string` | No | Structured Filter | `trim` | Max 128 chars | Regional constraint. |

---

## 7. Category 6: `offers_promotions`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `offer_name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Promotional campaign title. |
| `description` | `text` | No | **Semantic Narrative** | `trim` | — | Promotional terms, customer benefits, copy. |
| `offer_type` | `enum` | **Yes** | Structured Filter | `enum` | `percentage_discount`, `flat_discount`, `bundle_deal`, `free_trial`, `seasonal_special` | Discount structure. |
| `discount_value`| `decimal`| No | Informational | `number` | $\ge 0.0$ | Magnitude of discount. |
| `discount_type` | `enum` | No | Informational | `enum` | `percent`, `fixed_amount` | Discount value unit. |
| `currency` | `currency`| No | Informational | `currency` | ISO-4217 3-letter code | Currency for fixed amount discounts. |
| `promo_code` | `string` | No | Structured Filter | `trim` | Max 64 chars | Voucher / coupon redemption code. |
| `applicable_products`| `array`| No | Informational | `array` | List of strings | Eligible product SKUs or names. |
| `applicable_services`| `array`| No | Informational | `array` | List of strings | Eligible service offerings. |
| `customer_segment`| `enum` | No | Structured Filter | `enum` | `all`, `new_customers`, `returning_customers`, `enterprise` | Target audience segment. |
| `start_at` | `datetime`| No | Structured Filter | `datetime` | ISO-8601 | Start timestamp when promotion opens. |
| `end_at` | `datetime`| No | Structured Filter | `datetime` | ISO-8601 | Expiry timestamp when promotion closes. |
| `terms` | `text` | No | **Semantic Narrative** | `trim` | — | Terms, conditions, and exclusions. |
| `status` | `enum` | No | Structured Filter | `enum` | `active`, `expired`, `upcoming`, `draft` | Campaign status (default `active`). |

---

## 8. Category 7: `operations`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `operation_name`| `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Procedure or workflow title. |
| `description` | `text` | No | **Semantic Narrative** | `trim` | — | Summary of procedure objective. |
| `procedure` | `text` | **Yes** | **Semantic Narrative** | `trim` | Non-empty | Step-by-step operational instructions. |
| `owner` | `string` | No | Informational | `trim` | Max 128 chars | Responsible person or team lead. |
| `department` | `string` | No | Structured Filter | `trim` | Max 128 chars | Operating department. |
| `business_hours`| `string` | No | Informational | `trim` | Max 128 chars | Operational schedule (e.g. "24/7", "Mon-Fri 8-5"). |
| `turnaround_time`| `string`| No | Informational | `trim` | Max 128 chars | Guaranteed resolution time window. |
| `sla` | `string` | No | Informational | `trim` | Max 128 chars | SLA benchmark. |
| `escalation_rules`| `text` | No | **Semantic Narrative** | `trim` | — | Ticket/incident escalation path. |
| `region` | `string` | No | Structured Filter | `trim` | Max 128 chars | Geographic zone covered by procedure. |

---

## 9. Category 8: `locations`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Location name or branch identifier. |
| `location_type` | `enum` | **Yes** | Structured Filter | `enum` | `headquarters`, `branch_office`, `warehouse`, `service_center`, `retail_store`, `remote_area` | Type of facility. |
| `address_line_1`| `string` | No | Informational | `trim` | Max 255 chars | Street address line 1. |
| `address_line_2`| `string` | No | Informational | `trim` | Max 255 chars | Suite, unit, or floor. |
| `city` | `string` | No | Structured Filter | `trim` | Max 128 chars | City name. |
| `state` | `string` | No | Structured Filter | `trim` | Max 128 chars | State or province. |
| `country` | `string` | No | Structured Filter | `trim` | Max 128 chars | Country name or ISO country code. |
| `postal_code` | `string` | No | Structured Filter | `trim` | Max 32 chars | Postal or ZIP code. |
| `latitude` | `decimal`| No | Informational | `number` | $-90.0$ to $+90.0$ | GPS latitude coordinate. |
| `longitude` | `decimal`| No | Informational | `number` | $-180.0$ to $+180.0$| GPS longitude coordinate. |
| `phone` | `string` | No | Informational | `phone` | Digits & leading `+` | Direct facility telephone number. |
| `email` | `string` | No | Informational | `email` | RFC 5322 regex | Facility direct contact email. |
| `business_hours`| `string` | No | Informational | `trim` | Max 128 chars | Walk-in and counter operational hours. |
| `service_area` | `string` | No | Structured Filter | `trim` | Max 255 chars | Operational dispatch radius or cities. |
| `timezone` | `string` | No | Informational | `trim` | Max 64 chars | Local timezone identifier (e.g. `Asia/Kolkata`). |

---

## 10. Category 9: `brand_communication`

| Field Name | Type | Req? | Retrieval Role | Normalization | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | Structured Filter | `trim` | 1–255 chars | Guideline document title. |
| `voice` | `enum` | **Yes** | Structured Filter | `enum` | `professional`, `friendly`, `formal`, `consultative`, `casual`, `empathetic` | Primary conversational persona. |
| `tone` | `string` | No | **Semantic Narrative** | `trim` | Max 255 chars | Emotional tone descriptors. |
| `style` | `text` | No | **Semantic Narrative** | `trim` | — | Stylistic messaging rules. |
| `greeting_style`| `string` | No | Informational | `trim` | Max 255 chars | Standard opening greetings. |
| `closing_style` | `string` | No | Informational | `trim` | Max 255 chars | Standard sign-off closings. |
| `language_preferences`| `array`| No | Informational | `array` | List of strings | Dialects/languages supported (e.g. `['en-IN', 'hi']`). |
| `preferred_phrases`| `array`| No | Informational | `array` | List of strings | Vocabulary to favor in responses. |
| `do_not_say` | `array` | No | Informational | `array` | List of strings | Strictly forbidden words or claims. |
| `example_responses`| `text` | No | **Semantic Narrative** | `trim` | — | Few-shot exemplary model responses. |
