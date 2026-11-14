"""Bounded-Memory Cardinality Estimator (HyperLogLog & Exact Set).

Specification:
- Purpose: Estimate distinct element count in streaming columns without unbounded memory.
- Algorithm: Hybrid Exact-Set + HyperLogLog (Flajolet et al., 2007).
  - Exact Phase: Maintains an exact `set` for up to `exact_threshold` distinct items (default: 1,000).
  - Probabilistic Phase: Automatically transitions to 128-register HyperLogLog (b=7) when threshold is exceeded.
- Accuracy:
  - Exact Phase: 100% accurate (standard error: 0%).
  - HLL Phase: Standard error ≈ 1.04 / sqrt(m) ≈ 9.19% for m=128 registers.
- Complexity:
  - Add: O(1) time complexity.
  - Cardinality: O(m) = O(1) time complexity.
  - Memory: O(1) space complexity. Bounded at <= 1,000 strings during exact phase, and exactly
    128 bytes of register state during HLL phase.
"""

import hashlib
import math
from typing import Optional, Set


class BoundedCardinalityEstimator:
    """Hybrid distinct value counter with exact set and bounded HyperLogLog fallback."""

    def __init__(self, exact_threshold: int = 1_000, p: int = 7) -> None:
        """
        Args:
            exact_threshold: Maximum distinct values tracked exactly before upgrading to HLL.
            p: Precision bits for HLL registers (m = 2^p). Default p=7 gives m=128 registers.
        """
        self.exact_threshold = exact_threshold
        self.p = p
        self.m = 1 << p  # 2^p registers (e.g. 128)
        self.alpha_m = self._compute_alpha(self.m)

        self._is_exact: bool = True
        self._exact_set: Optional[Set[str]] = set()
        self._registers: Optional[bytearray] = None

    @staticmethod
    def _compute_alpha(m: int) -> float:
        """Compute alpha_m bias correction constant."""
        if m == 16:
            return 0.673
        elif m == 32:
            return 0.697
        elif m == 64:
            return 0.709
        else:
            return 0.7213 / (1.0 + 1.079 / m)

    @property
    def is_exact(self) -> bool:
        """Return True if counting is currently 100% exact, False if approximate."""
        return self._is_exact

    def add(self, value: str) -> None:
        """Add a value to the estimator in O(1) time."""
        if not isinstance(value, str):
            value = str(value)

        if self._is_exact:
            assert self._exact_set is not None
            self._exact_set.add(value)
            if len(self._exact_set) > self.exact_threshold:
                self._transition_to_hll()
        else:
            self._add_to_hll(value)

    def _transition_to_hll(self) -> None:
        """Transition from exact set to 128-register HyperLogLog and free set memory."""
        self._registers = bytearray(self.m)
        self._is_exact = False
        assert self._exact_set is not None
        for item in self._exact_set:
            self._add_to_hll(item)
        self._exact_set = None

    def _hash(self, value: str) -> int:
        """Compute a 64-bit integer hash from the string."""
        digest = hashlib.md5(value.encode("utf-8")).digest()
        return int.from_bytes(digest[:8], byteorder="big", signed=False)

    def _add_to_hll(self, value: str) -> None:
        """Update HLL registers for a given item."""
        assert self._registers is not None
        x = self._hash(value)
        # First p bits determine register index
        j = x >> (64 - self.p)
        # Remaining (64 - p) bits determine run of leading zeros + 1
        w = x & ((1 << (64 - self.p)) - 1)
        rho = self._clz(w, 64 - self.p) + 1
        if rho > self._registers[j]:
            self._registers[j] = rho

    @staticmethod
    def _clz(x: int, bit_length: int) -> int:
        """Count leading zeros in an integer of length `bit_length`."""
        if x == 0:
            return bit_length
        return bit_length - x.bit_length()

    def cardinality(self) -> int:
        """Compute distinct count estimate."""
        if self._is_exact:
            assert self._exact_set is not None
            return len(self._exact_set)

        assert self._registers is not None
        # Raw indicator
        indicator = sum(2.0 ** (-reg) for reg in self._registers)
        raw_estimate = self.alpha_m * (self.m**2) / indicator

        # Small range correction (Linear Counting)
        if raw_estimate <= 2.5 * self.m:
            zeros = self._registers.count(0)
            if zeros > 0:
                estimate = self.m * math.log(self.m / zeros)
            else:
                estimate = raw_estimate
        elif raw_estimate <= (1.0 / 30.0) * (2**32):
            estimate = raw_estimate
        else:
            # Large range correction
            estimate = -(2**32) * math.log(1.0 - raw_estimate / (2**32))

        return max(1, int(round(estimate)))
