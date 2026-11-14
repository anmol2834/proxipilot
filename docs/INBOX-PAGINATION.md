# Inbox Pagination & Infinite Scroll Architecture

## 1. Principle: Latest-First, Cursor-Based
The ProxiPilot Inbox strictly avoids offset pagination (`?page=2`). Offset pagination produces duplicate items and missed rows in high-volume environments where new emails arrive continuously. Instead, the inbox uses **opaque cursor-based pagination** in two directions:
1. **Downwards (Conversation List)**: Infinite scroll appending older conversations.
2. **Upwards (Conversation Thread)**: Reverse infinite scroll prepending older thread messages.

---

## 2. Downward Infinite Scroll (Conversation List)

### 2.1 Backend Contract
```http
GET /inbox/conversations?limit=30&cursor=<cursor>
```
Response:
```json
{
  "items": [...],
  "nextCursor": "eyJsYXN0X3RzIjoiMjAyNC0wOS0xN1QxMDoyNDowMFoifQ==",
  "hasMore": true
}
```

### 2.2 Client Implementation
- Utilizes TanStack Query's `useInfiniteQuery`.
- Uses an `IntersectionObserver` sentinel placed near the bottom of the list with a 150px threshold to start pre-fetching before the user hits the hard end.
- `isFetchingNextPage` guards against duplicate requests during fast scrolling.

---

## 3. Upward Reverse Scroll (Thread History)

### 3.1 Backend Contract
```http
GET /inbox/conversations/:id/messages?limit=30&before=<cursor>
```

### 3.2 Scroll Position Preservation
When older messages are prepended to the top of a thread container, the browser naturally shifts the scroll viewport unless compensated. ProxiPilot employs scroll-height delta compensation:
```typescript
const prevScrollHeight = container.scrollHeight;
const prevScrollTop = container.scrollTop;

// Prepend older messages into DOM...

const newScrollHeight = container.scrollHeight;
container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
```
This guarantees the user remains visually locked onto the message they were reading without jarring viewport jumps.
