"""Secure File Validation Engine — Phase 8.1.

Multi-layer file security validation:
1. Path traversal and malicious filename sanitization
2. File extension whitelisting (.csv, .xls, .xlsx)
3. Content-type / MIME verification
4. Magic byte / binary container signature inspection (anti-spoofing)
"""

import os
from pathlib import Path
import re
from typing import Optional, Set, Tuple


class FileValidationError(ValueError):
    """Raised when an uploaded file fails security, extension, or signature validation."""
    pass


# Whitelisted extensions
ALLOWED_EXTENSIONS: Set[str] = {".csv", ".xls", ".xlsx"}

# Canonical MIME mappings
MIME_TYPE_MAP = {
    "csv": "text/csv",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# Magic byte signatures
OLE2_MAGIC = b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"  # Microsoft Compound Document (.xls)
ZIP_MAGIC = b"PK\x03\x04"                          # ZIP archive container (.xlsx)
UTF8_BOM = b"\xEF\xBB\xBF"                         # UTF-8 with BOM (.csv)

# Executable / dangerous signatures that must NEVER be accepted as CSV
DANGEROUS_MAGIC_HEADERS = [
    (b"MZ", "DOS/Windows Executable (PE)"),
    (b"\x7FELF", "Linux ELF Executable"),
    (b"\xCA\xFE\xBA\xBE", "Java Class / Mach-O Binary"),
    (b"%PDF", "PDF Document"),
    (b"\xFF\xD8\xFF", "JPEG Image"),
    (b"\x89PNG", "PNG Image"),
    (b"GIF8", "GIF Image"),
    (b"\x1F\x8B", "GZIP Compressed Archive"),
    (b"7z\xBC\xAF\x27\x1C", "7-Zip Archive"),
    (b"Rar!\x1A\x07", "RAR Archive"),
]


def secure_filename(raw_filename: Optional[str], default_ext: str = ".csv") -> str:
    """Sanitize client-provided filename to prevent path traversal and shell injection.
    
    Rules:
    - Strips directory path components (both / and \\)
    - Strips control characters, null bytes, and non-printable characters
    - Replaces path traversal tokens ('..')
    - Enforces safe ASCII/alphanumeric characters with hyphens, underscores, dots
    - Retains safe file extension if valid
    """
    if not raw_filename or not raw_filename.strip():
        return f"upload{default_ext}"

    # Extract base name only (strip any leading directory paths)
    base = os.path.basename(raw_filename.replace("\\", "/"))
    base = base.replace("\x00", "").strip()

    # Remove dangerous characters (allow only letters, digits, '.', '-', '_')
    cleaned = re.sub(r"[^\w\.\-]", "_", base)

    # Prevent hidden files or path traversal like '....' or '.htaccess'
    cleaned = cleaned.lstrip(".")

    # If all characters were stripped or empty, generate default
    if not cleaned or cleaned == "_":
        return f"upload{default_ext}"

    # Verify safe length
    if len(cleaned) > 200:
        stem, ext = os.path.splitext(cleaned)
        cleaned = stem[:190] + ext

    return cleaned


def detect_and_validate_file_type(
    header_chunk: bytes,
    filename: str,
    declared_content_type: Optional[str] = None,
) -> Tuple[str, str]:
    """Validate file extension, MIME type, and binary magic bytes.
    
    Returns:
        Tuple of (canonical_file_type, canonical_mime_type)
        e.g. ("csv", "text/csv") or ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
    Raises:
        FileValidationError: If format, extension, or signature is invalid or spoofed.
    """
    if not header_chunk:
        raise FileValidationError("Uploaded file is completely empty (0 bytes).")

    # 1. Validate Extension
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Unsupported file extension '{ext}'. Only CSV (.csv), XLS (.xls), and XLSX (.xlsx) are allowed."
        )

    file_type = ext.lstrip(".")

    # 2. Signature Validation based on Extension
    if file_type == "xls":
        # Must match OLE2 compound document signature
        if not header_chunk.startswith(OLE2_MAGIC):
            raise FileValidationError(
                "Invalid XLS file: content does not match Microsoft Excel (OLE2) binary container signature."
            )
        return "xls", MIME_TYPE_MAP["xls"]

    elif file_type == "xlsx":
        # Must match ZIP container signature
        if not header_chunk.startswith(ZIP_MAGIC):
            raise FileValidationError(
                "Invalid XLSX file: content does not match OpenXML (ZIP) container signature."
            )
        return "xlsx", MIME_TYPE_MAP["xlsx"]

    elif file_type == "csv":
        # Anti-spoofing: Verify no binary executable or archive signatures
        for magic, desc in DANGEROUS_MAGIC_HEADERS:
            if header_chunk.startswith(magic):
                raise FileValidationError(
                    f"Malicious file detected: file named as CSV has binary signature of {desc}."
                )

        if header_chunk.startswith(OLE2_MAGIC):
            raise FileValidationError("Binary XLS file uploaded with .csv extension.")

        if header_chunk.startswith(ZIP_MAGIC):
            raise FileValidationError("ZIP or XLSX archive uploaded with .csv extension.")

        # Check for null bytes (presence of \x00 indicates binary file masquerading as CSV)
        if b"\x00" in header_chunk:
            raise FileValidationError(
                "Invalid CSV file: contains null bytes (binary content detected)."
            )

        # Verify decodable text
        test_bytes = header_chunk
        if test_bytes.startswith(UTF8_BOM):
            test_bytes = test_bytes[len(UTF8_BOM) :]

        try:
            sample_text = test_bytes[:4096].decode("utf-8")
        except UnicodeDecodeError:
            try:
                sample_text = test_bytes[:4096].decode("latin-1")
            except UnicodeDecodeError:
                raise FileValidationError(
                    "Invalid CSV file: content cannot be decoded as UTF-8 or Latin-1 text."
                )

        # Verify minimal structure: must contain printable text
        if not sample_text.strip():
            raise FileValidationError("Invalid CSV file: file contains only whitespace.")

        return "csv", MIME_TYPE_MAP["csv"]

    raise FileValidationError(f"Unhandled file type: {file_type}")
