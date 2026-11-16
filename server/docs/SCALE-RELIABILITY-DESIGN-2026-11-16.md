# Scale & Reliability: adaptive retrieval at 1 lakh+ items, delivery state machine, Redis Streams

## 1. Adaptive, exhaustive retrieval (`knowledge_search_index`)

**Problem.**
- Family candidates were a regex scan over every item, capped at 150 rows.
- Keyword search ran regexes over every item's JSON.
- Size and price filters ran in Python after fetching.

Result: O(n) per query, and a correct record outside the window was silently missed, which can produce a false NO_MATCH.

**Design.** A projection table holds one row per active item, with every hard constraint as an indexed column.

| Column | Index | Used for |
|---|---|---|
| `code_upper` | B-tree `(tenant, code)` + trigram GIN | exact code O(log n); closest codes |
| `family` | B-tree `(tenant, family, price)` | family listing, cheapest |
| `item_role` | B-tree `(tenant, family, role, price)` | product / part / accessory / bundle / service |
| `volume_ml`, `weight_g`, `power_w` | B-tree `(tenant, family, volume, price)` | "30 L only, not 40 L" |
| `price` | in the composite keys | cheapest / most expensive / ranges |
| `search_tsv` | GIN | keyword prefilter for very large catalogues |
| `title` | trigram GIN | fuzzy titles |

**Pipeline**, matching the 7 steps you asked for:
1. **Initial parallel searches:** exact codes, indexed family, vector (Qdrant HNSW with indexed payload filters), keyword.
2. **Canonical identity resolution:** exact code → item; a missing code → closest codes (trigram).
3. **Hard constraints in SQL:** family, role, sizes (wanted / negated) and price range, evaluated over the WHOLE catalogue.
4. **Coverage assessment:** `count(*)` of all matches (index-only scan).
5. **Complementary search:**
   - price-ordered requests read the exact top-N in index order;
   - otherwise up to the budget (`RETRIEVAL_INDEX_BUDGET`, default 2000);
   - very large catalogues (above `RETRIEVAL_LEXICAL_PREFILTER_THRESHOLD`, default 20,000) get a GIN prefilter on keyword search (`RETRIEVAL_LEXICAL_PREFILTER_LIMIT`).
6. **Bounded progressive retrieval:** the budget is configurable; candidates are hydrated from the canonical store in one batch.
7. **Exhaustion / uncertainty:**
   - `search_exhaustive` is set on the result;
   - when it is false, the reply never claims an item does not exist (`search_incomplete` → drafter rule).

**Measured at 100,000 rows** (server-side `EXPLAIN ANALYZE`, session-only temp table):

| Query | Indexed | Old full scan |
|---|---|---|
| Exact code | 0.04 ms (Index Scan) | — |
| Family + role + 30 L, cheapest top 15 | 0.13 ms (exact over all matches) | Python filter of a 150-row window |
| Count of all family matches | 0.24 ms (Index Only Scan) | — |
| Code-prefix candidates | 0.07 ms | ~2,000 rows + Python |
| Keyword candidates | 36 ms (GIN) | 38–51 ms Seq Scan (linear in n) |

**Other changes:**
- **Catalogue overview:** cached per tenant and invalidated on every knowledge change. Term counts use the GIN index, so there is no O(n) scan per email.
- **Maintenance:**
  - a single-row upsert in `knowledge_sync.sync_after_commit` for every manual change;
  - a background `rebuild_tenant` after every import (keyset batches of 500, bounded memory);
  - the migration `d2e3f4a5b6c7` is additive only.
- **Fallback:** until a tenant's index exists, every path uses the previous queries unchanged.

## 2. Item-role taxonomy (derived per tenant)

- **Roles:** finished product, service, spare part, accessory, consumable, raw material, packaging, **bundle** (set / kit / combo / multi-pack, new), unknown.
- **How a role is decided:** from the uploaded schema (category, product type, entity type) and the title. "Suitable for model X" marks a compatible component.
- **Only real roles filter:** a role restricts results only if it exists in that tenant's data (`roles_present`).
- **Bundles vs single items:** "single / individual / per piece" excludes bundles. Asking for a set does not hard-filter, so "repair kit" still finds spare parts.
- **Two separate category concepts:** the knowledge category (products_services, policies…) and the product family are independent.

## 3. Evidence authority hierarchy (AI #2)

- **Precedence:** verified catalogue record > business profile / owner data > imported documents > excerpts > memory > the customer's own claims.
- **What AI #2 sees:**
  - every fact is labelled with its authority tier and ordered strongest first;
  - excerpts are marked context-only.
- **Conflicts:** use the higher-authority fact; when facts of equal authority disagree, say the team will confirm.
- **Validator (unchanged):** prices and codes in a draft must exist in the verified facts.

## 4. Delivery state machine (`delivery_state.py`, `delivery_reconciler.py`)

`PENDING → SEND_ATTEMPTED (committed before Gmail) → PROVIDER_ACCEPTED → SENT`

| Outcome of the send | Next state |
|---|---|
| Timeout / network error / 5xx | `DELIVERY_UNKNOWN` → reconcile |
| 401 / 408 / 429 | `FAILED_RETRYABLE` |
| Other 4xx | `FAILED_FINAL` |
| Reconcile finds the message in the thread | `PROVIDER_ACCEPTED` (sent) |
| Reconcile confirms it is not there | `FAILED_RETRYABLE` / `FAILED_FINAL` |
| Gmail unreachable during reconcile | `RECONCILIATION_REQUIRED` |

**How reconciliation works.** Every send carries `X-ProxiPilot-Outbound-Id`. Reconcile is one Gmail thread-metadata call that looks for a SENT message carrying that header.

**The reconciler (every 60 s)** resolves records in `SEND_ATTEMPTED` (crashed mid-send), `DELIVERY_UNKNOWN`, `RECONCILIATION_REQUIRED` and `FAILED_RETRYABLE`:
- It always asks Gmail first, so a send that Gmail accepted is never sent twice.
- It retries only replies verified as not sent, with backoff.
- Instead of resending, it **cancels** (leaving the reply for the team) when:
  - the reply is older than 30 minutes;
  - the customer wrote again since;
  - someone already replied.

**Every state that can still lead to a send blocks a new send for the same message:** `SENT`, `PROVIDER_ACCEPTED`, `SEND_ATTEMPTED`, `DELIVERY_UNKNOWN`, `RECONCILIATION_REQUIRED`, `FAILED_RETRYABLE` (plus the legacy `SENDING`). This applies in the AI path, the draft and manual send paths, and the email worker's "already replied" check.

## 5. Redis Streams

| Property | Implementation |
|---|---|
| PEL recovery / crash ownership | `XAUTOCLAIM` (60 s, or 120 s for AI) for other consumers. **New:** at startup each worker re-processes its OWN pending entries immediately (`XREADGROUP … 0`). |
| Safe ack | `XACK` only after success; failure leaves the entry pending; DLQ after 3 deliveries. |
| Poison messages | **New:** a corrupt entry reclaimed from the pending list is dead-lettered and acknowledged (previously it was reclaimed forever). |
| Retention | `XACK` does NOT delete. **`XDEL` after a successful `XACK`** (single group per stream), so stream length equals the real backlog; the DLQ is capped with `MAXLEN ~10000`. |
| Backpressure | **New:** a worker reads only as many entries as it has free processing slots. Previously a burst parked claimed entries in memory without a keepalive, and they were reclaimed and processed twice. |
| Lag monitoring | **New:** `stream_monitor` every 30 s publishes Prometheus gauges `proxipilot_stream_{length,pending,lag,oldest_pending_ms}` and warns when lag ≥ 200 or a message is in flight for more than 5 minutes. |
| Duplicate processing | Per-message Redis locks (released on failure), DB idempotency guards, and the delivery state machine. |

## 6. Deployment steps (require approval)

1. `alembic upgrade head`: creates `knowledge_search_index` and `pg_trgm` (additive).
2. Backfill: `rebuild_tenant(<tenant>)` for each tenant (Dolphy, 5,103 items: seconds).
3. Restart. Until step 2 completes, retrieval uses the previous queries.
