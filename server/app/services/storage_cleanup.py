"""Storage Lifecycle & Stale Uploads Cleanup Service — Phase 8.1.

Periodically cleans up abandoned or timed-out temporary uploads (.uploading/)
to prevent storage leaks while preserving finalized source files.
"""

from datetime import datetime, timezone
import time
from typing import Optional
from app.core.config import get_settings
from app.core.logging import logger
from app.core.storage import get_storage_provider


class StorageCleanupService:
    """Enterprise service for storage lifecycle maintenance."""

    async def cleanup_stale_uploads(self, max_age_seconds: Optional[int] = None) -> int:
        """Scan and purge temporary staged upload artifacts exceeding retention threshold."""
        settings = get_settings()
        age = max_age_seconds if max_age_seconds is not None else settings.storage.stale_upload_retention_seconds

        start_time = time.perf_counter()
        storage = get_storage_provider()
        cleaned_count = await storage.cleanup_stale_uploads(max_age_seconds=age)
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        logger.info(
            "Completed stale upload cleanup run",
            cleaned_count=cleaned_count,
            retention_seconds=age,
            duration_ms=round(duration_ms, 2),
        )
        return cleaned_count


# Global singleton
storage_cleanup_service = StorageCleanupService()
