# ProxiPilot — Knowledge Attribute Domain Contract (Phase 7.2)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.2 (Flexible Schema + Typed Attribute Engine)  
Last Updated: 2026-09-17  

This document specifies the concrete typing, null semantics, bounded constraints, and lifecycle policies for all knowledge attributes.

---

## 1. Supported Attribute Types

| Type | Python Storage | Validation Rule | Bounded Limits |
| :--- | :--- | :--- | :--- |
| `string` | `str` | Unicode normalized, regex pattern | Max 4,096 chars |
| `text` | `str` | Multi-line narrative text | Max 65,536 chars |
| `integer` | `int` | Exact numeric integer | Configurable min/max |
| `decimal` | `float` / `Decimal` | Exact precision numeric | Configurable min/max |
| `currency` | `float` | Decimal amount paired with 3-letter ISO currency code | Validated ISO-4217 code |
| `boolean` | `bool` | Strict tokens: `true/false`, `1/0`, `yes/no`, `active/inactive` | Non-boolean strings rejected |
| `date` | `str` (ISO-8601) | Strict `YYYY-MM-DD`. Ambiguous slashes (`01/02/26`) rejected | Valid calendar date |
| `datetime` | `str` (ISO-8601) | Strict UTC ISO-8601 timestamp | Timezone-aware |
| `enum` | `str` | Member of tenant-defined `allowed_values` | Must match allowed list |
| `array` | `list` | Parsed from JSON array or delimited string | Max 250 items |
| `object` | `dict` | Constrained JSON dictionary | Max depth: 3, Max keys: 50, Max size: 16 KB |

---

## 2. Explicit Null Semantics

The normalization engine strictly differentiates between absent, null, empty, false, and zero:

| Input Value | Engine Interpretation | Resulting Action |
| :--- | :--- | :--- |
| `None` (Key absent) | Missing | Default value applied if set; required check triggered |
| `None` (Explicit null) | Null | Retained as null; does not coerce to 0 or empty string |
| `""` (Empty string) | Empty | Stripped to None/omitted; does NOT become 0 or False |
| `0` (Numeric zero) | Falsy numeric | Retained as 0 integer or 0.0 decimal |
| `False` | Boolean false | Retained as boolean False; distinct from empty or null |
| `[]` (Empty list) | Empty list | Retained as empty list; distinct from null |

---

## 3. Controlled Transformations (No Eval/Exec)

All transformations are strictly deterministic functions:
- `TRIM`: Whitespace stripping
- `LOWERCASE`: Lowercase conversion
- `UPPERCASE`: Uppercase conversion
- `NORMALIZE_WHITESPACE`: Collapse multiple whitespace characters into single space
- `PARSE_INTEGER`: Extract clean integer digits
- `PARSE_DECIMAL`: Extract clean decimal digits
- `PARSE_DATE`: Strict ISO-8601 date parse
- `PARSE_DATETIME`: Strict ISO-8601 datetime parse
- `NORMALIZE_BOOLEAN`: Controlled token coercion
- `SPLIT_ARRAY`: Comma/semicolon array splitting

**Security Invariant**: No user-supplied scripts, Python `eval()`, or dynamic code execution is permitted anywhere in the pipeline.

---

## 4. Attribute Lifecycle & Deprecation

1. **Renaming Display Name**: The underlying identifier `key` is immutable (`id` and `key` remain stable).
2. **Type Mutation**: Changing an attribute's type (e.g. `integer` $\rightarrow$ `string`) is forbidden on active attributes with stored records.
3. **Deprecation**: Deprecate custom attributes rather than hard deleting to preserve historical version auditability.
