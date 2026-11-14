# ProxiPilot — Enterprise Streaming Dataset Parser Architecture (Phase 8.2)
============================================================
Status: IMPLEMENTED & FROZEN  
Phase: 8.2 (CSV, XLSX, XLS Streaming Parsers & Resource Guardrails)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary & Architectural Scope

In enterprise data ingestion pipelines, handling arbitrary client-uploaded tabular datasets (CSV, XLSX, XLS) presents critical security and operational risks:
- **Unbounded Memory Exhaustion**: Loading entire files into memory via `pandas.read_csv()` or `pandas.read_excel()` causes catastrophic Out-Of-Memory (OOM) worker crashes when customers upload multi-hundred megabyte or multi-million row datasets.
- **Pathological Payloads & Cell Bombs**: Malicious or malformed files with million-character cell strings or hundreds of thousands of columns.
- **Active Code Execution**: Malicious Excel macros, VBA scripts, or dynamic formula injections.
- **Worker Starvation**: Monopolizing worker processes without cancellation checkpoints or progress heartbeats.

ProxiPilot Phase 8.2 establishes a strictly bounded-memory, asynchronous streaming parser layer that transforms raw staged files into a stream of sanitized tabular rows and persists a compact, deterministic dataset profile for Phase 8.3 Schema Detection:

```
[STAGED UPLOAD FILE] (Phase 8.1)
        ↓
[KNOWLEDGE IMPORT WORKER] (Background Process via Redis Streams)
        ↓
[STREAMING DATASET PARSER] (CsvStreamParser / XlsxStreamParser / XlsStreamParser)
        ↓
  - Enforce MAX_ROWS, MAX_COLUMNS, MAX_CELL_LENGTH, MAX_SHEETS
  - Sanitize control characters, evaluate formula results without macro execution
  - Deterministic Header Detection (first meaningful structural row; no LLMs)
        ↓
[ROW STREAM] (Bounded O(1) Memory Generator)
        ↓
[COLUMN ACCUMULATORS & PROFILING] (Phase 8.2)
        ↓
[SCHEMA FINGERPRINT & COMPACT PROFILE DTO]
        ↓
[IMPORT JOB METADATA PERSISTED] (PostgreSQL)
        ↓
[PHASE 8.3 SCHEMA DETECTION] (Ready for Domain Mapping)
```

**Explicit Phase Boundaries**:
- Phase 8.2 produces only descriptive dataset statistics and a cryptographic schema fingerprint.
- Phase 8.2 strictly does **NOT** implement column mapping, canonical normalization, row persistence, embeddings, Qdrant indexing, or RAG.

---

## 2. Parser Strategies & Memory Models

### 2.1 CSV Streaming Parser (`CsvStreamParser`)
- **Engine**: Python standard library `csv.reader` consuming text streams.
- **Memory Complexity**: Strictly $O(1)$ memory. File is read line-by-line in small buffers rather than buffered into memory.
- **Encoding Detection**:
  1. Inspects the first 64KB for UTF-8 Byte Order Mark (`\xef\xbb\xbf` -> `utf-8-sig`).
  2. Attempts standard `utf-8` decode.
  3. Controlled fallback to `latin-1` / `cp1252` if UTF-8 decode fails.
- **Delimiter Detection**:
  - Employs `csv.Sniffer` on the first 8KB using candidate set: `[',', '\t', ';']`.
  - Fallback heuristic examines delimiter frequencies on the first non-empty line.
- **Quoting & Multiline Handling**:
  - Full support for RFC 4180 escaped quotes (`""`) and multiline quoted strings without line splitting corruption.

### 2.2 Modern Excel Parser (`XlsxStreamParser`)
- **Engine**: `openpyxl` initialized with `read_only=True` and `data_only=True`.
- **Memory Complexity**: $O(1)$ memory per row. Rows are parsed lazily as XML tokens directly from the underlying zip stream without instantiating an in-memory Document Object Model (DOM).
- **Macro & Formula Safety**:
  - `data_only=True` instructs openpyxl to read only pre-evaluated cached formula results stored in the workbook XML.
  - Formula expressions are never evaluated as active code.
  - VBA macros and embedded scripts are strictly ignored.
- **Sheet Policy**:
  - Enforces `MAX_SHEETS` (default: 50).
  - Selects the active sheet, or first visible sheet if active is not specified.

### 2.3 Legacy Binary Excel Parser (`XlsStreamParser`)
- **Engine**: `xlrd` initialized with `on_demand=True` and `ragged_rows=True`.
- **Architectural Limitation & Transparency**:
  - Legacy BIFF8 `.xls` binary workbook structures inherently require workbook metadata parsing in memory.
  - `xlrd` does not provide true XML token streaming.
  - **Enforced Mitigation**: Strict upper bounds on `MAX_ROWS` (default: 500,000), `MAX_COLUMNS` (200), and `MAX_CELL_LENGTH` (65,536) are strictly verified. Sheets are loaded on-demand and resources released via `release_resources()` immediately upon completion.

---

## 3. Security & Resource Guardrails

| Guardrail Metric | Default Limit | Enforcement Action | Error Classification |
| :--- | :--- | :--- | :--- |
| `PARSER_MAX_ROWS` | 500,000 | Immediate stream termination | `TOO_MANY_ROWS` |
| `PARSER_MAX_COLUMNS` | 200 | Immediate stream termination | `TOO_MANY_COLUMNS` |
| `PARSER_MAX_CELL_LENGTH` | 65,536 characters | Rejection of row | `CELL_TOO_LARGE` |
| `PARSER_MAX_SHEETS` | 50 sheets | Rejection of workbook | `RESOURCE_LIMIT` |
| `PARSER_HEADER_SCAN_ROWS` | 10 rows | Scan window for header | `AMBIGUOUS_HEADER` |

### 3.1 Cell Sanitization
Every cell value is sanitized through `sanitize_cell_value()`:
1. Strips dangerous ASCII control characters (`\x00-\x08`, `\x0b-\x0c`, `\x0e-\x1f`, `\x7f`), while preserving whitespace (`\t`, `\n`).
2. Converts float representations of integers (e.g., `100.0` in Excel) to integer strings (`100`).
3. Verifies length $\le$ `PARSER_MAX_CELL_LENGTH`.

---

## 4. Deterministic Header Detection

Header detection is strictly deterministic and rule-based (no external LLM or probabilistic network calls):
1. Reads up to `PARSER_HEADER_SCAN_ROWS` candidate rows.
2. Skips blank lines.
3. Evaluates candidate row cell contents:
   - If $> 50\%$ of cells in a row are purely numeric, the row is considered data (not header).
   - If all candidate rows are numeric or empty, raises `AMBIGUOUS_HEADER`.
4. Guarantees column name uniqueness by appending numerical suffixes to duplicate headers (e.g., `col`, `col_2`).

---

## 5. Worker Integration & Lifecycle Orchestration

```
[ImportJob: UPLOADED]
        ↓ Claimed by KnowledgeImportWorker (with distributed lock)
[ImportJob: PARSING]
        ↓
Local file path resolved via LocalStorageProvider (Tenant-isolated)
        ↓
Run DatasetProfiler in asyncio thread pool (asyncio.to_thread)
        ↓ Cooperative cancellation check every 1,000 rows
        ↓ Update heartbeat every 5 seconds
Finalize DatasetProfileDTO + SHA-256 Schema Fingerprint
        ↓
Persist profile to ImportJob.metadata_json["dataset_profile"]
Update ImportJob.row_count
Update KnowledgeSource.schema_fingerprint
        ↓
[ImportJob: SCHEMA_DETECTION] (Phase 8.3 handoff)
```

### 5.1 Cooperative Cancellation
Long-running dataset parsing jobs check `cancel_requested_at` every 1,000 rows. If cancellation is detected, the parser cleanly terminates with `CANCELLED` and marks the job terminal without leaving orphaned worker threads.

### 5.2 Structured Error Handling
Exceptions are classified into discrete `ParserErrorType` instances:
- `PARSER_ERROR`: Unhandled parsing exception
- `ENCODING_ERROR`: Invalid or corrupted text encoding
- `INVALID_FILE`: Empty file or unrecognized structure
- `TOO_MANY_COLUMNS`: Columns exceed `PARSER_MAX_COLUMNS`
- `TOO_MANY_ROWS`: Rows exceed `PARSER_MAX_ROWS`
- `CELL_TOO_LARGE`: Cell exceeds `PARSER_MAX_CELL_LENGTH`
- `WORKBOOK_INVALID`: Corrupted XLSX/XLS workbook
- `AMBIGUOUS_HEADER`: Structural ambiguity in header row
- `RESOURCE_LIMIT`: Sheet count or resource threshold breached
- `CANCELLED`: User requested cooperative cancellation

Permanent parsing errors immediately mark the job `FAILED` (or `CANCELLED`) with structured audit records and never retry indefinitely.
