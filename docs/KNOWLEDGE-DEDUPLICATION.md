# ProxiPilot — Enterprise Category-Aware Deduplication Architecture (Phase 8.4)
============================================================
Status: IMPLEMENTED & VERIFIED  
Phase: 8.4 (Category-Aware In-Memory Deduplication & Conflict Detection)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Deduplication in ProxiPilot is strictly **Category-Aware**.

A naive whole-row hash (`hash(entire_row)`) is completely unsuitable for enterprise knowledge ingestion because:
- Harmless formatting variations (e.g. `"  AC Repair  "` vs `"AC Repair"`) cause false negatives.
- Irrelevant columns or fluctuating metadata prevent legitimate duplicate discovery.
- Cross-category entities possess distinct semantic definitions of uniqueness.

Phase 8.4 introduces the `CategoryIdentityResolver` and `DeduplicationEngine`, providing $O(1)$ average in-memory duplicate lookup and structured conflict detection.

---

## 2. Category-Specific Identity Strategies

| Category | Primary Identity Attributes | Strategy & Precedence |
| :--- | :--- | :--- |
| **`products_services`** | `name`, `sku` | If `sku` is present: `sku:{norm_sku}\|name:{norm_name}`.<br>If `sku` absent: `name:{norm_name}`. |
| **`contacts`** | `email`, `phone`, `name`, `contact_type` | Precedence order: Normalized `email` $\rightarrow$ `phone` $\rightarrow$ `name:{norm_name}\|type:{norm_type}`. |
| **`policies`** | `policy_name`, `region` | `policy:{norm_policy_name}` combined with `region` if regionally scoped. |
| **`support_faqs`** | `question` | Normalized customer question string: `q:{norm_question}`. |
| **`offers_promotions`** | `promo_code`, `offer_name` | Normalized coupon/promo code if present; fallback to campaign `offer_name`. |
| **`locations`** | `name`, `postal_code`, `address_line_1` | Location identifier combined with postal code or street address. |
| **`company_info`** | `company_name` | Canonical trade name: `co:{norm_company_name}`. |
| **`operations`** | `operation_name` | Standard operating procedure title: `op:{norm_operation_name}`. |
| **`brand_communication`** | `title` | Tone/guideline document title: `brand:{norm_title}`. |

---

## 3. Compatible vs. Conflicting Duplicates

When a row matches the `identity_key` of a previously seen row in the same dataset:

### 3.1 Compatible Duplicates
- **Condition**: All overlapping canonical and custom fields are semantically equivalent or represent non-conflicting null subsets.
- **Example**:
  - Row 1: `Name="AC Repair", SKU="AC-001", Price=999.0`
  - Row 25: `Name="ac repair", SKU="AC-001", Price=999.0`
- **Resolution**: Row 25 is assigned `QualityRowStatus.WARNING` with `is_duplicate=True`, `duplicate_of_row=1`, and `DUPLICATE_RECORD` issue. Downstream Phase 8.5 skips redundant insert.

### 3.2 Conflicting Duplicates
- **Condition**: Overlapping fields contain contradictory business facts.
- **Example**:
  - Row 1: `Name="AC Repair", SKU="AC-001", Price=999.0`
  - Row 25: `Name="AC Repair", SKU="AC-001", Price=1499.0`
- **Resolution**: Row 25 is assigned `QualityRowStatus.WARNING` (or `INVALID`) with `is_conflict=True`, `duplicate_of_row=1`, and `CONFLICTING_DUPLICATE` issue. Mismatched fields are recorded explicitly in `conflict_details` (e.g. `price: {"original": 999.0, "current": 1499.0}`).

---

## 4. Empirical Performance Benchmarks

Measured via `server/tests/benchmark_data_quality.py` across bounded batches of 1,000 rows:

| Dataset Size | Wall Time | Throughput (Rows/s) | Throughput (Fields/s) | Peak Traced Memory | In-Loop DB Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1,000 rows** | **0.322 s** | **3,108 rows/s** | **15,541 fields/s** | **2.80 MB** | **0 calls** |
| **10,000 rows** | **1.441 s** | **6,941 rows/s** | **34,707 fields/s** | **10.65 MB** | **0 calls** |
| **100,000 rows** | **18.239 s** | **5,483 rows/s** | **27,414 fields/s** | **75.14 MB** | **0 calls** |

### Key Architectural Takeaways:
- **Linear $O(N)$ Time**: Processing 100,000 rows required only **18.2 seconds** (~5,500 rows/second).
- **Zero Database Degradation**: 0 queries inside the row evaluation loop.
- **Bounded In-Memory Footprint**: Peak memory is bounded at ~75 MB for 100,000 rows.
