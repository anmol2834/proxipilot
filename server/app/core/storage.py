"""Enterprise File & Object Storage Abstraction — Phase 8.1.

Provides a provider-neutral, tenant-scoped storage interface for staged
and finalized knowledge files:
- Hard tenant isolation: All keys deterministic and prefixed by tenant_id
- Path traversal and malicious key prevention
- Temporary upload staging (.uploading/) with atomic promotion
- Safe cancellation and rollback on failed/rejected uploads
- Extensible to cloud providers (AWS S3, Google Cloud Storage, Azure Blob)
"""

from abc import ABC, abstractmethod
import asyncio
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
from typing import BinaryIO, Optional
from app.core.config import get_settings
from app.core.logging import logger


class UploadSession(ABC):
    """Encapsulates an in-flight, streaming upload session."""

    @abstractmethod
    async def write_chunk(self, chunk: bytes) -> None:
        """Write chunk to temporary staging storage."""
        pass

    @abstractmethod
    async def finalize(self) -> str:
        """Atomically promote staged upload to permanent storage key and return file_uri."""
        pass

    @abstractmethod
    async def abort(self) -> None:
        """Clean up temporary staged object on failure or cancellation."""
        pass


class FileStorageProvider(ABC):
    """Abstract interface for multi-tenant file and object storage."""

    @abstractmethod
    async def create_upload_session(
        self,
        tenant_id: str,
        source_id: str,
        upload_id: str,
        safe_filename: str,
    ) -> UploadSession:
        """Create a new staged streaming upload session."""
        pass

    @abstractmethod
    async def delete_file(self, file_uri: str) -> bool:
        """Delete finalized file from storage."""
        pass

    @abstractmethod
    async def file_exists(self, file_uri: str) -> bool:
        """Check if file exists at specified URI."""
        pass

    @abstractmethod
    async def resolve_local_path(self, file_uri: str) -> Optional[Path]:
        """Resolve file_uri to local file path if stored locally."""
        pass

    @abstractmethod
    async def cleanup_stale_uploads(self, max_age_seconds: int = 7200) -> int:
        """Purge unfinalized staged uploads older than max_age_seconds."""
        pass


# =============================================================================
# Local Disk Storage Implementation
# =============================================================================


class LocalUploadSession(UploadSession):
    """Local filesystem upload session with atomic temporary staging and high-performance streaming I/O."""

    def __init__(
        self,
        temp_path: Path,
        final_path: Path,
        storage_key: str,
        file_uri: str,
    ):
        self.temp_path = temp_path
        self.final_path = final_path
        self.storage_key = storage_key
        self.file_uri = file_uri
        self._file: Optional[BinaryIO] = None
        self._lock = asyncio.Lock()

    async def write_chunk(self, chunk: bytes) -> None:
        """Write chunk to temporary staging file using open buffered file stream."""
        if not chunk:
            return

        async with self._lock:
            if self._file is None:
                def _open_stream():
                    self.temp_path.parent.mkdir(parents=True, exist_ok=True)
                    return open(self.temp_path, "wb")
                self._file = await asyncio.to_thread(_open_stream)

            def _write():
                if self._file:
                    self._file.write(chunk)
            await asyncio.to_thread(_write)

    async def finalize(self) -> str:
        """Atomically close and rename staged temporary file to final path."""
        async with self._lock:
            if self._file is not None and not self._file.closed:
                await asyncio.to_thread(self._file.close)
                self._file = None

        if not self.temp_path.exists():
            raise FileNotFoundError(f"Staged file not found at {self.temp_path}")

        # Ensure destination directory exists
        self.final_path.parent.mkdir(parents=True, exist_ok=True)

        # Atomic replacement / move
        await asyncio.to_thread(os.replace, self.temp_path, self.final_path)

        # Attempt to prune empty .uploading directory
        temp_dir = self.temp_path.parent
        try:
            if temp_dir.exists() and not any(temp_dir.iterdir()):
                temp_dir.rmdir()
        except OSError:
            pass

        logger.info(
            "Upload finalized successfully",
            storage_key=self.storage_key,
            file_uri=self.file_uri,
        )
        return self.file_uri

    async def abort(self) -> None:
        """Close handle and delete temporary staged file."""
        async with self._lock:
            if self._file is not None and not self._file.closed:
                try:
                    await asyncio.to_thread(self._file.close)
                except Exception:
                    pass
                self._file = None

        def _cleanup():
            if self.temp_path.exists():
                try:
                    self.temp_path.unlink()
                except OSError:
                    pass
            temp_dir = self.temp_path.parent
            try:
                if temp_dir.exists() and not any(temp_dir.iterdir()):
                    temp_dir.rmdir()
            except OSError:
                pass

        await asyncio.to_thread(_cleanup)
        logger.info("Staged upload aborted and cleaned up", storage_key=self.storage_key)


class LocalStorageProvider(FileStorageProvider):
    """Local disk object storage provider for development, testing, and edge deployments."""

    URI_SCHEME = "storage://local/"

    def __init__(self, root_dir: Optional[str] = None):
        settings = get_settings()
        configured_root = root_dir or settings.storage.storage_local_root
        self.root_path = Path(configured_root).resolve()
        self.root_path.mkdir(parents=True, exist_ok=True)

    def _sanitize_and_validate_key(self, tenant_id: str, relative_key: str) -> Path:
        """Verify storage key stays within root_path and tenant_id boundary."""
        target = (self.root_path / relative_key).resolve()
        tenant_root = (self.root_path / tenant_id).resolve()

        if not target.is_relative_to(tenant_root):
            raise ValueError(
                f"Security violation: key '{relative_key}' escapes tenant boundary '{tenant_id}'"
            )
        return target

    async def create_upload_session(
        self,
        tenant_id: str,
        source_id: str,
        upload_id: str,
        safe_filename: str,
    ) -> UploadSession:
        """Create a staged temporary upload session with isolated paths."""
        final_rel = f"{tenant_id}/knowledge/{source_id}/{upload_id}/{safe_filename}"
        temp_rel = f"{tenant_id}/knowledge/{source_id}/{upload_id}/.uploading/{safe_filename}"

        final_path = self._sanitize_and_validate_key(tenant_id, final_rel)
        temp_path = self._sanitize_and_validate_key(tenant_id, temp_rel)

        file_uri = f"{self.URI_SCHEME}{final_rel}"

        return LocalUploadSession(
            temp_path=temp_path,
            final_path=final_path,
            storage_key=final_rel,
            file_uri=file_uri,
        )

    async def resolve_local_path(self, file_uri: str) -> Optional[Path]:
        """Convert storage://local/<rel_path> to concrete local Path."""
        if file_uri.startswith(self.URI_SCHEME):
            rel_path = file_uri[len(self.URI_SCHEME) :]
        elif file_uri.startswith("file://"):
            rel_path = file_uri[len("file://") :]
            p = Path(rel_path).resolve()
            if p.exists() and p.is_relative_to(self.root_path):
                return p
            return None
        else:
            rel_path = file_uri

        target = (self.root_path / rel_path).resolve()
        if target.is_relative_to(self.root_path) and target.exists():
            return target
        return None

    async def file_exists(self, file_uri: str) -> bool:
        """Check whether file exists on disk."""
        path = await self.resolve_local_path(file_uri)
        return path is not None and path.is_file()

    async def delete_file(self, file_uri: str) -> bool:
        """Safely delete file by URI."""
        path = await self.resolve_local_path(file_uri)
        if path and path.is_file():
            def _remove():
                path.unlink(missing_ok=True)
                # prune empty parent dirs if empty
                cur = path.parent
                while cur != self.root_path:
                    try:
                        if not any(cur.iterdir()):
                            cur.rmdir()
                            cur = cur.parent
                        else:
                            break
                    except OSError:
                        break
            await asyncio.to_thread(_remove)
            return True
        return False

    async def cleanup_stale_uploads(self, max_age_seconds: int = 7200) -> int:
        """Scan for orphaned .uploading directories older than max_age_seconds."""
        now = datetime.now(timezone.utc).timestamp()
        cutoff = now - max_age_seconds
        cleaned_count = 0

        def _scan_and_clean():
            count = 0
            if not self.root_path.exists():
                return 0

            for root, dirs, _ in os.walk(self.root_path, topdown=False):
                if ".uploading" in dirs:
                    uploading_dir = Path(root) / ".uploading"
                    try:
                        mtime = uploading_dir.stat().st_mtime
                        if mtime < cutoff:
                            shutil.rmtree(uploading_dir, ignore_errors=True)
                            count += 1
                    except OSError:
                        pass
            return count

        cleaned_count: int = await asyncio.to_thread(_scan_and_clean)
        if cleaned_count > 0:
            logger.info("Cleaned stale upload directories", count=cleaned_count)
        return int(cleaned_count)


# Global singleton instance
_storage_provider: Optional[FileStorageProvider] = None


def get_storage_provider() -> FileStorageProvider:
    """Return configured singleton FileStorageProvider."""
    global _storage_provider
    if _storage_provider is None:
        settings = get_settings()
        if settings.storage.storage_backend == "local":
            _storage_provider = LocalStorageProvider()
        else:
            # Fallback to local if cloud provider credentials not set
            _storage_provider = LocalStorageProvider()
    return _storage_provider
