# Gmail Watch Renewal & Algorithmic Priority Scheduling

## 1. Algorithmic Foundation: Min-Heap Priority Queue
Rather than polling every Gmail account or running $N$ background threads:
- **Durable Persistence Layer**: PostgreSQL composite index on `(provider, sync_state, watch_expires_at)`.
- **In-Memory Priority Queue**: Python `heapq` Min-Heap storing `(expiration_timestamp, account_id)`.

### Complexity Analysis
| Operation | Algorithm / Mechanism | Time Complexity | Space Complexity |
|---|---|---|---|
| Peek Next Due Watch | Min-Heap root `heap[0]` | $O(1)$ | $O(1)$ |
| Push Account | `heapq.heappush()` | $O(\log n)$ | $O(1)$ |
| Extract Due Watches | `heapq.heappop()` | $O(\log n)$ | $O(1)$ |
| Scheduled Batch Query | PostgreSQL B-tree Index Scan | $O(\log N + M)$ | $O(M)$ |
| Mailbox Synchronization | `users.history.list` & message ingestion | $O(k)$ where $k$ is change count | $O(k)$ |

*Note: Algorithmic complexity $O(\log n)$ applies strictly to control-plane watch renewal scheduling. Mailbox message sync is naturally $O(k)$ based on change volume.*

## 2. Renewal Window & Cadence
- Google `users.watch()` registrations expire after 7 days.
- ProxiPilot's renewal scheduler targets mailboxes with $\le 2$ days remaining (`GMAIL_WATCH_RENEWAL_DAYS=2`), giving a 48-hour safety buffer against network outages or temporary quota pauses.
