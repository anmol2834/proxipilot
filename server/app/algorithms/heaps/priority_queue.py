"""Thread-Safe Binary Heap Priority Queue for SLA & Job Scheduling.

Specification:
- Purpose: Order-preserving task priority queue for scheduling urgent emails & automations.
- Input: Generic items with numeric priority (lower number = higher priority) and tie-breaking timestamps.
- Output: Highest-priority item.

Complexity:
- Push / Insert: O(log n)
- Pop / Extract-Min: O(log n)
- Peek: O(1)
- Space: O(n)

When to use:
- In-process job scheduling where items arrive continuously and must be serviced by SLA priority.
- Micro-batch prioritization before dispatching to workers.

When NOT to use:
- Multi-node durable scheduling that must survive process restarts (use Redis Streams or durable broker).
"""

import heapq
import threading
from typing import Generic, List, Optional, Tuple, TypeVar

T = TypeVar("T")


class PriorityQueue(Generic[T]):
    """Thread-safe Min-Heap Priority Queue."""

    def __init__(self) -> None:
        self._heap: List[Tuple[int, int, T]] = []
        self._counter: int = 0
        self._lock: threading.Lock = threading.Lock()

    def push(self, item: T, priority: int = 0) -> None:
        """Insert an item with a given priority. Lower numeric value = higher priority."""
        with self._lock:
            # Entry: (priority, counter, item) where counter handles FIFO tie-breaking
            entry = (priority, self._counter, item)
            self._counter += 1
            heapq.heappush(self._heap, entry)

    def pop(self) -> T:
        """Remove and return the highest priority item. Raises IndexError if empty."""
        with self._lock:
            if not self._heap:
                raise IndexError("Cannot pop from an empty PriorityQueue")
            _, _, item = heapq.heappop(self._heap)
            return item

    def peek(self) -> Optional[T]:
        """Inspect the highest priority item without removing it. Returns None if empty."""
        with self._lock:
            if not self._heap:
                return None
            return self._heap[0][2]

    def __len__(self) -> int:
        with self._lock:
            return len(self._heap)

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._heap) == 0
