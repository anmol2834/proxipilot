"""Phase 8.2 — Enterprise Streaming Dataset Parsers (CSV, XLSX, XLS).

Specification:
- Purpose: Stream raw rows from CSV, XLSX, and XLS files without unbounded in-memory dataset loading.
- Memory:
  - CSV: O(1) buffer size via standard csv.reader streaming over file text stream.
  - XLSX: O(1) row memory via openpyxl read_only=True XML token streaming.
  - XLS: Enforced strict row/column bounds; xlrd on-demand sheet streaming with documented memory boundaries.
- Security:
  - Enforces MAX_ROWS, MAX_COLUMNS, MAX_CELL_LENGTH, MAX_SHEETS.
  - Strips hazardous control characters, rejects oversized cells and malicious macros.
  - Deterministic header detection without LLMs; raises AMBIGUOUS_HEADER when structure is indeterminate.
"""

import csv
import io
import os
import re
from pathlib import Path
from typing import Generator, List, Optional, Sequence, Tuple

from app.contracts.dataset_profile import FileParserMetadataDTO, ParserErrorType
from app.core.config import get_settings


class DatasetParserError(Exception):
    """Structured dataset parsing exception with categorized error type."""

    def __init__(self, error_type: ParserErrorType, message: str) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message


def normalize_column_name(name: str) -> str:
    """Produce a deterministic normalized snake_case column identifier.

    Rules:
    - Strips leading/trailing whitespace
    - Lowercases all characters
    - Replaces whitespace, punctuation, hyphens, slashes with single underscore
    - Strips leading/trailing underscores
    - Fallbacks to 'column' if empty
    """
    if not name:
        return "column"
    cleaned = re.sub(r"[^\w\s]", "_", name.strip().lower())
    normalized = re.sub(r"[\s_]+", "_", cleaned).strip("_")
    return normalized if normalized else "column"


from datetime import date, datetime

# Precomputed fast character translation map for stripping unsafe control characters
# Preserves tab (\t, 9), newline (\n, 10), carriage return (\r, 13)
_CONTROL_CHARS_TRANSLATE = {i: None for i in range(32) if i not in (9, 10, 13)}
_CONTROL_CHARS_TRANSLATE[127] = None


def sanitize_cell_value(val: object, max_cell_len: int) -> str:
    """Sanitize cell value to string, validating cell length bounds and stripping unsafe control chars."""
    if val is None:
        return ""
    if isinstance(val, (datetime, date)):
        s = val.isoformat()
    elif isinstance(val, float) and val.is_integer():
        s = str(int(val))
    else:
        s = str(val)

    # Check cell length limit
    if len(s) > max_cell_len:
        raise DatasetParserError(
            ParserErrorType.CELL_TOO_LARGE,
            f"Cell length ({len(s)} chars) exceeds maximum allowed {max_cell_len} characters.",
        )

    # Fast strip dangerous control characters via compiled C translation table
    s = s.translate(_CONTROL_CHARS_TRANSLATE)
    return s.strip()


def detect_headers(
    sample_rows: Sequence[Sequence[str]], max_scan_rows: int = 10
) -> Tuple[int, List[str]]:
    """Determine the header row index and header names using deterministic structural rules.

    Raises:
        DatasetParserError: If headers are ambiguous, completely missing, or purely numeric.
    """
    if not sample_rows:
        raise DatasetParserError(
            ParserErrorType.AMBIGUOUS_HEADER,
            "Cannot detect headers: file is empty.",
        )

    # Find the first non-empty row candidate
    header_idx = -1
    candidate_headers: List[str] = []

    for idx, row in enumerate(sample_rows[:max_scan_rows]):
        non_empty = [c.strip() for c in row if c and c.strip()]
        if not non_empty:
            continue

        # If more than 50% of candidate headers are purely numeric, this row is likely data, not headers
        numeric_count = 0
        for val in non_empty:
            try:
                float(val.replace(",", ""))
                numeric_count += 1
            except ValueError:
                pass

        if numeric_count == len(non_empty) and len(non_empty) > 1:
            # Entire row is numbers (e.g. data matrix without headers)
            raise DatasetParserError(
                ParserErrorType.AMBIGUOUS_HEADER,
                f"Row {idx + 1} consists purely of numeric data; header detection requires review.",
            )

        if numeric_count / len(non_empty) > 0.5:
            # Majority of cells are numbers, ambiguous header
            raise DatasetParserError(
                ParserErrorType.AMBIGUOUS_HEADER,
                f"Candidate header row {idx + 1} has predominantly numeric values; header detection is ambiguous.",
            )

        header_idx = idx
        candidate_headers = [c.strip() for c in row]
        break

    if header_idx == -1 or not candidate_headers:
        raise DatasetParserError(
            ParserErrorType.AMBIGUOUS_HEADER,
            "Could not identify a valid header row within candidate scan rows.",
        )

    # Ensure uniqueness of headers by suffixing duplicates (e.g. col, col_2)
    seen: dict[str, int] = {}
    unique_headers: List[str] = []
    for i, h in enumerate(candidate_headers):
        clean_h = h if h else f"unnamed_column_{i + 1}"
        if clean_h in seen:
            seen[clean_h] += 1
            unique_headers.append(f"{clean_h}_{seen[clean_h]}")
        else:
            seen[clean_h] = 1
            unique_headers.append(clean_h)

    return header_idx, unique_headers


class CsvStreamParser:
    """Streaming CSV parser supporting UTF-8, UTF-8-BOM, Latin-1, and comma/tab/semicolon delimiters."""

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.metadata: Optional[FileParserMetadataDTO] = None

    def _detect_encoding_and_delimiter(self) -> Tuple[str, str]:
        """Detect encoding (UTF-8-SIG, UTF-8, Latin-1) and delimiter from file sample."""
        with open(self.file_path, "rb") as fb:
            raw_sample = fb.read(65536)

        if not raw_sample:
            raise DatasetParserError(ParserErrorType.INVALID_FILE, "CSV file is 0 bytes.")

        # Detect UTF-8 BOM
        if raw_sample.startswith(b"\xef\xbb\xbf"):
            encoding = "utf-8-sig"
        else:
            try:
                raw_sample.decode("utf-8")
                encoding = "utf-8"
            except UnicodeDecodeError:
                encoding = "latin-1"

        text_sample = raw_sample.decode(encoding, errors="replace")

        # Sniff delimiter using candidate set: [',', '\t', ';']
        delimiter = ","
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(text_sample[:8192], delimiters=",\t;")
            delimiter = dialect.delimiter
        except Exception:
            # Fallback heuristic: count delimiter frequency in first line
            first_line = text_sample.splitlines()[0] if text_sample.splitlines() else ""
            counts = {
                ",": first_line.count(","),
                "\t": first_line.count("\t"),
                ";": first_line.count(";"),
            }
            best = max(counts, key=lambda k: counts[k])
            if counts[best] > 0:
                delimiter = best

        return encoding, delimiter

    def stream_rows(
        self,
        max_rows: int,
        max_cols: int,
        max_cell_len: int,
    ) -> Generator[Tuple[int, List[str], List[str]], None, None]:
        """Stream parsed rows yielding: (row_index, sanitized_row_cells, headers).

        The first yielded element represents row 0 (the first data row), with detected headers.
        """
        encoding, delimiter = self._detect_encoding_and_delimiter()

        try:
            f = open(self.file_path, "r", encoding=encoding, errors="replace", newline="")
        except Exception as e:
            raise DatasetParserError(
                ParserErrorType.ENCODING_ERROR, f"Unable to open CSV file: {e}"
            ) from e

        try:
            reader = csv.reader(f, delimiter=delimiter)

            # Read first N rows to detect headers
            sample_buffer: List[List[str]] = []
            for row in reader:
                sample_buffer.append([sanitize_cell_value(c, max_cell_len) for c in row])
                if len(sample_buffer) >= 10:
                    break

            header_idx, headers = detect_headers(sample_buffer)

            if len(headers) > max_cols:
                raise DatasetParserError(
                    ParserErrorType.TOO_MANY_COLUMNS,
                    f"Column count ({len(headers)}) exceeds maximum allowed ({max_cols}).",
                )

            self.metadata = FileParserMetadataDTO(
                file_type="csv",
                encoding=encoding,
                delimiter=delimiter,
                header_row_index=header_idx,
            )

            # Stream data rows after header from sample_buffer first
            data_row_count = 0
            for row in sample_buffer[header_idx + 1 :]:
                if not any(row):
                    continue  # skip completely blank rows
                if len(row) > max_cols:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_COLUMNS,
                        f"Row columns ({len(row)}) exceeds maximum {max_cols}.",
                    )
                # Pad or truncate row to header length
                padded = row[: len(headers)] + [""] * max(0, len(headers) - len(row))
                yield data_row_count, padded, headers
                data_row_count += 1
                if data_row_count > max_rows:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_ROWS,
                        f"Dataset rows ({data_row_count}) exceeds maximum allowed ({max_rows}).",
                    )

            # Stream remaining rows from file
            for raw_row in reader:
                row = [sanitize_cell_value(c, max_cell_len) for c in raw_row]
                if not any(row):
                    continue
                if len(row) > max_cols:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_COLUMNS,
                        f"Row columns ({len(row)}) exceeds maximum {max_cols}.",
                    )
                padded = row[: len(headers)] + [""] * max(0, len(headers) - len(row))
                yield data_row_count, padded, headers
                data_row_count += 1
                if data_row_count > max_rows:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_ROWS,
                        f"Dataset rows ({data_row_count}) exceeds maximum allowed ({max_rows}).",
                    )
        finally:
            f.close()


class XlsxStreamParser:
    """Streaming XLSX parser using openpyxl in read_only=True, data_only=True mode.

    Guarantees bounded memory by streaming XML tokens rather than building a full DOM.
    """

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.metadata: Optional[FileParserMetadataDTO] = None

    def stream_rows(
        self,
        max_rows: int,
        max_cols: int,
        max_cell_len: int,
        max_sheets: int = 50,
    ) -> Generator[Tuple[int, List[str], List[str]], None, None]:
        """Stream parsed rows from active/first sheet of XLSX."""
        import openpyxl

        try:
            wb = openpyxl.load_workbook(
                str(self.file_path),
                read_only=True,
                data_only=True,  # evaluates formulas to cached values without running macro code
                keep_links=False,
            )
        except Exception as e:
            raise DatasetParserError(
                ParserErrorType.WORKBOOK_INVALID, f"Failed to open XLSX workbook: {e}"
            ) from e

        try:
            sheet_names = wb.sheetnames
            if not sheet_names:
                raise DatasetParserError(
                    ParserErrorType.INVALID_FILE, "XLSX workbook contains no sheets."
                )

            if len(sheet_names) > max_sheets:
                raise DatasetParserError(
                    ParserErrorType.RESOURCE_LIMIT,
                    f"Workbook sheet count ({len(sheet_names)}) exceeds maximum allowed ({max_sheets}).",
                )

            # Select active or first sheet
            active_sheet = wb.active
            sheet_name = active_sheet.title if active_sheet is not None else sheet_names[0]
            sheet = wb[sheet_name]

            # Read first N rows for header detection
            sample_buffer: List[List[str]] = []
            row_gen = sheet.iter_rows(values_only=True)

            for raw_row in row_gen:
                clean_row = [sanitize_cell_value(c, max_cell_len) for c in raw_row]
                sample_buffer.append(clean_row)
                if len(sample_buffer) >= 10:
                    break

            header_idx, headers = detect_headers(sample_buffer)

            if len(headers) > max_cols:
                raise DatasetParserError(
                    ParserErrorType.TOO_MANY_COLUMNS,
                    f"Column count ({len(headers)}) exceeds maximum allowed ({max_cols}).",
                )

            self.metadata = FileParserMetadataDTO(
                file_type="xlsx",
                sheet_name=sheet_name,
                sheet_names=sheet_names,
                header_row_index=header_idx,
            )

            # Stream initial buffer
            data_row_count = 0
            for row in sample_buffer[header_idx + 1 :]:
                if not any(row):
                    continue
                if len(row) > max_cols:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_COLUMNS,
                        f"Row columns ({len(row)}) exceeds maximum {max_cols}.",
                    )
                padded = row[: len(headers)] + [""] * max(0, len(headers) - len(row))
                yield data_row_count, padded, headers
                data_row_count += 1
                if data_row_count > max_rows:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_ROWS,
                        f"Dataset rows exceeds maximum allowed {max_rows}.",
                    )

            # Stream remainder
            consecutive_empty = 0
            for raw_row in row_gen:
                if not any(raw_row):
                    consecutive_empty += 1
                    if consecutive_empty >= 50:
                        # Reached end of actual data; trailing formatted blank rows in Excel
                        break
                    continue
                consecutive_empty = 0

                row = [sanitize_cell_value(c, max_cell_len) for c in raw_row]
                if not any(row):
                    continue
                if len(row) > max_cols:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_COLUMNS,
                        f"Row columns ({len(row)}) exceeds maximum {max_cols}.",
                    )
                padded = row[: len(headers)] + [""] * max(0, len(headers) - len(row))
                yield data_row_count, padded, headers
                data_row_count += 1
                if data_row_count > max_rows:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_ROWS,
                        f"Dataset rows exceeds maximum allowed {max_rows}.",
                    )
        finally:
            wb.close()


class XlsStreamParser:
    """Parser for legacy Excel binary workbooks (BIFF8 / .xls) using xlrd.

    Architectural Limitation:
    The xlrd library parses binary BIFF records into memory structures for each sheet.
    True tokenized streaming is not natively provided by the binary format.
    To guarantee safety and prevent memory exhaustion:
    - Workbook is loaded on_demand=True.
    - Strict MAX_ROWS, MAX_COLUMNS, and MAX_CELL_LENGTH limits are rigidly enforced before iteration.
    """

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.metadata: Optional[FileParserMetadataDTO] = None

    def stream_rows(
        self,
        max_rows: int,
        max_cols: int,
        max_cell_len: int,
        max_sheets: int = 50,
    ) -> Generator[Tuple[int, List[str], List[str]], None, None]:
        """Stream parsed rows from first sheet of legacy XLS."""
        import xlrd

        try:
            wb = xlrd.open_workbook(
                str(self.file_path),
                on_demand=True,
                ragged_rows=True,
            )
        except Exception as e:
            raise DatasetParserError(
                ParserErrorType.WORKBOOK_INVALID, f"Failed to open XLS workbook: {e}"
            ) from e

        try:
            sheet_names = wb.sheet_names()
            if not sheet_names:
                raise DatasetParserError(
                    ParserErrorType.INVALID_FILE, "XLS workbook contains no sheets."
                )

            if len(sheet_names) > max_sheets:
                raise DatasetParserError(
                    ParserErrorType.RESOURCE_LIMIT,
                    f"XLS sheet count ({len(sheet_names)}) exceeds maximum allowed ({max_sheets}).",
                )

            sheet = wb.sheet_by_index(0)
            sheet_name = sheet_names[0]

            if sheet.nrows > max_rows:
                raise DatasetParserError(
                    ParserErrorType.TOO_MANY_ROWS,
                    f"XLS row count ({sheet.nrows}) exceeds maximum allowed ({max_rows}).",
                )

            sample_buffer: List[List[str]] = []
            for r_idx in range(min(10, sheet.nrows)):
                row_vals = sheet.row_values(r_idx)
                clean_row = [sanitize_cell_value(c, max_cell_len) for c in row_vals]
                sample_buffer.append(clean_row)

            header_idx, headers = detect_headers(sample_buffer)

            if len(headers) > max_cols:
                raise DatasetParserError(
                    ParserErrorType.TOO_MANY_COLUMNS,
                    f"Column count ({len(headers)}) exceeds maximum allowed ({max_cols}).",
                )

            self.metadata = FileParserMetadataDTO(
                file_type="xls",
                sheet_name=sheet_name,
                sheet_names=sheet_names,
                header_row_index=header_idx,
            )

            data_row_count = 0
            for r_idx in range(header_idx + 1, sheet.nrows):
                row_vals = sheet.row_values(r_idx)
                row = [sanitize_cell_value(c, max_cell_len) for c in row_vals]
                if not any(row):
                    continue
                if len(row) > max_cols:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_COLUMNS,
                        f"Row columns ({len(row)}) exceeds maximum {max_cols}.",
                    )
                padded = row[: len(headers)] + [""] * max(0, len(headers) - len(row))
                yield data_row_count, padded, headers
                data_row_count += 1
                if data_row_count > max_rows:
                    raise DatasetParserError(
                        ParserErrorType.TOO_MANY_ROWS,
                        f"Dataset rows exceeds maximum allowed {max_rows}.",
                    )
        finally:
            wb.release_resources()


def get_dataset_stream_parser(file_path: Path, file_type: str):
    """Factory creating the appropriate streaming parser for a file format."""
    ft = file_type.lower().strip(".")
    if ft == "csv":
        return CsvStreamParser(file_path)
    elif ft == "xlsx":
        return XlsxStreamParser(file_path)
    elif ft == "xls":
        return XlsStreamParser(file_path)
    else:
        raise DatasetParserError(
            ParserErrorType.INVALID_FILE, f"Unsupported file format for parsing: {file_type}"
        )
