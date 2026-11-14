"""Probabilistic Bloom Filter for Fast-Path Duplicate Detection.

Specification:
- Purpose: Extremely space-efficient set membership testing for high-volume email & event IDs.
- Input: String keys (e.g. provider_message_id, event_id).
- Output: True (possibly in set), False (definitely not in set).

Complexity:
- Add: O(k) where k is the number of hash functions.
- Check: O(k)
- Space: O(m) bits where m is the bit-array size.

When to use:
- Fast-path rejection of duplicate webhook deliveries before performing database or Redis lookups.
- Email thread duplicate reply filtering.

When NOT to use:
- When false positives are strictly unacceptable (always verify positive matches against the DB).
- When item deletion is required (use a Counting Bloom Filter or Cuckoo Filter).
"""

import hashlib
import math
from typing import List


class BloomFilter:
    """Space-efficient probabilistic filter using double-hashing technique."""

    def __init__(self, expected_elements: int = 100_000, false_positive_rate: float = 0.01):
        """
        Args:
            expected_elements: Projected number of unique elements to insert.
            false_positive_rate: Acceptable probability of a false positive (e.g. 0.01 = 1%).
        """
        assert expected_elements > 0, "expected_elements must be greater than 0"
        assert 0 < false_positive_rate < 1, "false_positive_rate must be between 0 and 1"

        self.expected_elements = expected_elements
        self.false_positive_rate = false_positive_rate

        # Calculate optimal bit array size m = - (n * ln(p)) / (ln(2)^2)
        self.size = int(
            -1 * (expected_elements * math.log(false_positive_rate)) / (math.log(2) ** 2)
        )
        self.size = max(self.size, 64)

        # Calculate optimal number of hash functions k = (m / n) * ln(2)
        self.num_hashes = int((self.size / expected_elements) * math.log(2))
        self.num_hashes = max(self.num_hashes, 1)

        self._bit_array = bytearray((self.size + 7) // 8)
        self._count = 0

    def _get_hashes(self, item: str) -> List[int]:
        """Generate k independent hash values using Kirsch-Mitzenmacher double hashing."""
        # 128-bit MD5 digest yields two independent 64-bit integers
        md5_hash = hashlib.md5(item.encode("utf-8")).digest()
        h1 = int.from_bytes(md5_hash[:8], "big")
        h2 = int.from_bytes(md5_hash[8:], "big")

        # g_i(x) = (h1 + i * h2) mod m
        return [(h1 + i * h2) % self.size for i in range(self.num_hashes)]

    def add(self, item: str) -> None:
        """Add an item to the filter."""
        for bit_index in self._get_hashes(item):
            byte_index = bit_index // 8
            bit_offset = bit_index % 8
            self._bit_array[byte_index] |= 1 << bit_offset
        self._count += 1

    def contains(self, item: str) -> bool:
        """Check if an item might be in the set.

        Returns False: 100% guarantee that item was NEVER added.
        Returns True: Item is likely in the set (subject to false_positive_rate).
        """
        for bit_index in self._get_hashes(item):
            byte_index = bit_index // 8
            bit_offset = bit_index % 8
            if not (self._bit_array[byte_index] & (1 << bit_offset)):
                return False
        return True

    def __contains__(self, item: str) -> bool:
        return self.contains(item)

    @property
    def element_count(self) -> int:
        return self._count
