"""Phase 8.6: AI-Ready Semantic Chunker.

Breaks structured sections of a projected knowledge document into
deterministic, word-boundary aligned logical chunks with configurable
maximum size and overlap.

Invariants:
- Deterministic chunking: Identical input text produces identical chunks.
- Natural boundary preservation: Never splits words mid-character unless
  a single continuous word exceeds max_chars.
- Stable chunk indices: 0-indexed sequential order across the document.
- Fully decoupled: Zero database access, network calls, or embedding logic.
"""

import hashlib
from typing import List, Optional, Tuple

from app.contracts.semantic_projection import SemanticChunkDTO


class SemanticChunker:
    """Configurable, deterministic semantic chunker."""

    def __init__(self, max_chars: int = 2000, overlap_chars: int = 100):
        if max_chars < 50:
            raise ValueError("max_chars must be at least 50.")
        if overlap_chars < 0:
            raise ValueError("overlap_chars cannot be negative.")
        if overlap_chars >= max_chars:
            raise ValueError("overlap_chars must be strictly less than max_chars.")

        self.max_chars = max_chars
        self.overlap_chars = overlap_chars

    @staticmethod
    def compute_chunk_id(
        tenant_id: str,
        item_id: str,
        version_id: str,
        section: str,
        chunk_index: int,
    ) -> str:
        """Deterministic chunk ID generated from composite hierarchical keys."""
        raw = f"{tenant_id}:{item_id}:{version_id}:{section}:{chunk_index}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        return f"chk_{digest}"

    def split_text_into_spans(self, text: str) -> List[str]:
        """Splits a single text block into chunks <= max_chars with overlap at word boundaries."""
        stripped = text.strip()
        if not stripped:
            return []

        if len(stripped) <= self.max_chars:
            return [stripped]

        spans: List[str] = []
        n = len(stripped)
        start = 0

        while start < n:
            end = min(start + self.max_chars, n)

            if end < n:
                # Seek backward from `end` for a natural break boundary (newline or space)
                # Look back up to max(50, self.overlap_chars * 2) or half max_chars
                lookback_limit = max(start + 1, end - max(100, self.overlap_chars * 2))
                break_point = -1

                # 1. Prefer paragraph/line breaks
                for i in range(end - 1, lookback_limit - 1, -1):
                    if stripped[i] in ("\n", "\r"):
                        break_point = i + 1
                        break

                # 2. Fall back to whitespace
                if break_point == -1:
                    for i in range(end - 1, lookback_limit - 1, -1):
                        if stripped[i].isspace():
                            break_point = i + 1
                            break

                # 3. If no whitespace found in lookback window, hard cut at end
                if break_point <= start:
                    break_point = end
            else:
                break_point = n

            span = stripped[start:break_point].strip()
            if span:
                spans.append(span)

            if break_point >= n:
                break

            # Calculate next start point considering overlap
            if self.overlap_chars > 0 and break_point < n:
                candidate_start = max(start + 1, break_point - self.overlap_chars)
                # Advance candidate_start to the next non-whitespace or word beginning
                while candidate_start < break_point and not stripped[candidate_start].isspace():
                    candidate_start += 1
                while candidate_start < break_point and stripped[candidate_start].isspace():
                    candidate_start += 1

                # If advancing caused it to reach or exceed break_point, just start at break_point
                if candidate_start >= break_point:
                    start = break_point
                else:
                    start = candidate_start
            else:
                start = break_point

            # Skip any leading whitespace for the new start
            while start < n and stripped[start].isspace():
                start += 1

        return spans

    def chunk_sections(
        self,
        tenant_id: str,
        item_id: str,
        version_id: str,
        category: str,
        authority: str,
        status: str,
        sections: List[Tuple[str, str]],
        source_id: Optional[str] = None,
        effective_from: Optional[str] = None,
        effective_until: Optional[str] = None,
    ) -> List[SemanticChunkDTO]:
        """Convert an ordered list of (section_name, section_text) into SemanticChunkDTOs."""
        chunks: List[SemanticChunkDTO] = []
        global_index = 0

        for section_name, section_text in sections:
            if not section_text or not section_text.strip():
                continue

            spans = self.split_text_into_spans(section_text)
            for span in spans:
                # Skip trivially short spans — they carry no meaningful semantic content
                # for RAG retrieval and add noise to the embedding space.
                if len(span) < 20:
                    continue
                chunk_id = self.compute_chunk_id(
                    tenant_id=tenant_id,
                    item_id=item_id,
                    version_id=version_id,
                    section=section_name,
                    chunk_index=global_index,
                )
                chunks.append(
                    SemanticChunkDTO(
                        chunk_id=chunk_id,
                        section=section_name,
                        text=span,
                        chunk_index=global_index,
                        organization_id=tenant_id,
                        knowledge_item_id=item_id,
                        knowledge_version_id=version_id,
                        category=category,
                        authority=authority,
                        status=status,
                        source_id=source_id,
                        effective_from=effective_from,
                        effective_until=effective_until,
                        char_count=len(span),
                    )
                )
                global_index += 1

        return chunks
