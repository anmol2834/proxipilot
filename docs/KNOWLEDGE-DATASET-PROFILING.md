# ProxiPilot — Enterprise Bounded-Memory Dataset Profiling Architecture (Phase 8.2)
============================================================
Status: IMPLEMENTED & FROZEN  
Phase: 8.2 (Dataset Profiling, Type Inference, Cardinality & Fingerprinting)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Dataset profiling is the descriptive intelligence phase of the ProxiPilot knowledge ingestion pipeline. Its sole mission is to answer:

> *"What is inside this dataset?"*

It deliberately does **not** answer *"What should this become in ProxiPilot?"* (which is reserved for Phase 8.3 Schema Detection and Phase 8.4 Mapping).

To process enterprise datasets at scale without crashing worker instances, the profiling engine operates under a **Single-Pass, Bounded-Memory** design:
- Memory footprint is strictly $O(\text{columns})$ and independent of row count.
- Cardinality estimation is bounded via a hybrid Exact Set + HyperLogLog algorithm.
- String samples are capped at 5 bounded values (max 128 characters each).
- Schema fingerprinting produces a deterministic SHA-256 hash identifying structural equivalence across disparate tenant files.

---

## 2. Statistical Column Profile Specification

For every column discovered in the input file, `ColumnAccumulator` computes the following metrics:

| Metric | Field in `ColumnProfileDTO` | Type | Description |
| :--- | :--- | :--- | :--- |
| **Original Name** | `original_name` | `str` | Verbatim header text from raw file |
| **Normalized Name** | `normalized_name` | `str` | Cleaned snake_case identifier for Phase 8.3 |
| **Column Index** | `column_index` | `int` | 0-based positional index in workbook |
| **Total Rows** | `row_count_observed` | `int` | Total data rows evaluated |
| **Non-Empty Count** | `non_empty_count` | `int` | Count of populated cells |
| **Empty Count** | `empty_count` | `int` | Count of null or empty cells |
| **Empty Ratio** | `empty_ratio` | `float` | Proportion of blank cells ($0.0 \dots 1.0$) |
| **Candidate Types** | `candidate_types` | `List[str]` | Detected structural candidate types |
| **Dominant Type** | `dominant_type` | `str` | Highest-confidence candidate type |
| **Type Confidence** | `type_confidence` | `float` | Proportion of cells matching dominant type |
| **Samples** | `samples` | `List[str]` | Up to 5 non-empty samples (max 128 chars each) |
| **Max Length** | `max_length` | `int` | Longest observed character length |
| **Min Numeric** | `min_numeric` | `Optional[float]` | Minimum numeric value observed |
| **Max Numeric** | `max_numeric` | `Optional[float]` | Maximum numeric value observed |
| **Date Patterns** | `date_patterns` | `List[str]` | Candidate date patterns (e.g. `YYYY-MM-DD`) |
| **Ambiguous Date** | `is_ambiguous_date` | `bool` | True if date could be `DD/MM` or `MM/DD` |
| **Currency Symbols** | `currency_symbols` | `List[str]` | Extracted currency symbols (`$`, `€`, `£`, `₹`) |
| **Enum Candidates** | `enum_candidates` | `Optional[List[str]]` | Distinct values if column appears categorical |
| **Approx Unique Count** | `approx_unique_count` | `int` | Estimated or exact distinct value count |
| **Approx Unique Ratio** | `approx_unique_ratio` | `float` | Unique count divided by non-empty count |
| **Is Exact** | `is_cardinality_exact` | `bool` | True if exact count, False if HLL estimate |

---

## 3. Bounded Cardinality Estimation (`BoundedCardinalityEstimator`)

### 3.1 Problem Statement
Maintaining an unbounded Python `set` across millions of distinct strings consumes hundreds of megabytes of memory per column, creating severe Out-Of-Memory risks.

### 3.2 Hybrid Exact-Set + HyperLogLog Architecture
ProxiPilot uses a two-phase hybrid estimator:
1. **Exact Phase**:
   - Stores distinct values in an exact Python `set` while distinct items $\le 1,000$.
   - Yields 100% exact cardinality measurements (`is_cardinality_exact = True`) for small-to-medium columns.
2. **Probabilistic Phase (HyperLogLog)**:
   - When cardinality exceeds 1,000 items, the estimator automatically upgrades to a 128-register HyperLogLog ($p=7, m=2^7=128$).
   - The exact set is flushed and garbage collected.
   - All subsequent additions modify only the 128-byte register array (`bytearray(128)`).
   - Standard Error:
     $$\text{SE} \approx \frac{1.04}{\sqrt{m}} = \frac{1.04}{\sqrt{128}} \approx 9.19\%$$
   - Time Complexity: $O(1)$ per addition.
   - Space Complexity: Strictly $O(1)$, bounded at $\le 128$ bytes of register memory.

---

## 4. Type Inference Engine & Edge Cases

The `TypeInferenceEngine` classifies cell values using precompiled deterministic patterns without LLM reliance:

### 4.1 Supported Types
1. `INTEGER`: Optionally signed whole numbers (`100`, `-42`).
2. `DECIMAL`: Floating point numbers with dot or comma formatting (`19.99`, `1,250.50`, `1.250,50`).
3. `CURRENCY`: Currency-prefixed or suffixed numbers (`$100`, `49.99 €`, `₹499`).
4. `BOOLEAN`: Standard truth values (`true`, `false`, `yes`, `no`, `t`, `f`).
5. `DATE`: ISO dates (`2026-03-15`) and slash/dot dates (`15/03/2026`).
6. `DATETIME`: ISO timestamp representations (`2026-03-15T14:30:00Z`).
7. `EMAIL`: RFC-compliant email address patterns.
8. `URL`: Standard HTTP/HTTPS or `www.` web URLs.
9. `TEXT`: Strings exceeding 255 characters or containing newline characters (`\n`).
10. `STRING`: Default alphanumeric text.
11. `ENUM`: Detected when distinct cardinality is low relative to row count.

### 4.2 Guardrails & Disambiguation
- **Leading Zero Identifier Preservation**: Strings with leading zeros such as `"00100"` or `"01"` (excluding standalone `"0"`) are strictly classified as `STRING` (identifier codes like postal codes, part numbers, SKUs) rather than coerced to `INTEGER`.
- **Date Ambiguity Flagging**: For dates formatted like `03/04/2024` where both day and month are $\le 12$, `is_ambiguous_date` is marked `True`. The parser never assumes server locale.
- **Text Elevation**: If any cell in a column contains newlines or exceeds 255 characters, the column's dominant type is elevated from `STRING` to `TEXT` to prevent database truncation.

---

## 5. Categorical & Enum-Like Detection

Columns exhibiting low cardinality and repeated categories are automatically tagged with `enum_candidates`:
- **Eligibility Criteria**:
  - `non_empty_count >= 5`
  - Unique distinct count $\le 25$ (`PARSER_MAX_ENUM_CARDINALITY`)
  - Unique ratio $\le 0.25$ (or $\le 8$ total distinct values)
- Populates `enum_candidates` with sorted unique values (e.g. `["active", "inactive", "pending"]`).
- Inserts `ENUM` into `candidate_types` for Phase 8.3 category mapping.

---

## 6. Cryptographic Schema Fingerprinting

A deterministic schema fingerprint is generated at the conclusion of every profiling run:
- Computed via SHA-256 over concatenated normalized column tokens:
  $$\text{token}_i = \text{normalized\_name}_i : \text{dominant\_type}_i : \text{column\_index}_i$$
  $$\text{SchemaFingerprint} = \text{SHA256}\left(\sum_i \text{token}_i\right)$$
- **Tenant & Row Invariant**: Two completely different datasets with different row data (e.g. Q1 catalog vs Q2 catalog) possessing the same column structure and types yield identical schema fingerprints.
- Persisted on `KnowledgeSource.schema_fingerprint` to facilitate automatic schema matching in Phase 8.3.

---

## 7. Empirical Performance & Memory Benchmarks

Tested on standard production configuration with mixed-type enterprise datasets:

| Dataset Size | Row Count | Columns | Wall Duration | Throughput (Rows/sec) | Throughput (Cells/sec) | Peak Traced Memory | Memory / Row Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **10.0 MB** | 59,609 | 10 | 25.02 s | **2,383 rows/s** | 23,827 cells/s | **1.90 MB** | 31.8 bytes/row |
| **50.0 MB** | 293,977 | 10 | 104.11 s | **2,824 rows/s** | 28,237 cells/s | **1.81 MB** | 6.1 bytes/row |

### Memory Invariance Observation:
When the dataset scaled from **10 MB (59,609 rows)** to **50 MB (293,977 rows)**:
- Memory did **NOT** scale linearly with dataset size.
- Peak memory remained virtually flat at **~1.8 MB to 1.9 MB**.
- Confirms strictly bounded $O(\text{columns})$ streaming memory consumption under enterprise load.
