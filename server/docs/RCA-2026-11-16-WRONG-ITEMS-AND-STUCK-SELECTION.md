# RCA: wrong items, stuck answers and "cannot verify" replies (thread "Need a price of minibars", 2026-11-15)

## 1. Data verification (read-only)

- **Excel `dolphy_product.xlsx`:** 5,103 rows (2 rows share duplicate codes, 2 rows have no MRP).
- **PostgreSQL:** 5,103 active items. Every code is present. Titles and prices match the Excel. The only differences are the 2 duplicate-code rows, which are stored as separate items.
- **Qdrant (production):** 5,103 active points for the tenant.
- **Conclusion:** the upload pipeline is correct. Every code and price in the bad replies exists in the Excel. The defects were in **which items** were retrieved and how the conversation was interpreted, not in the stored data.

## 2. Turn-by-turn root causes (from production logs)

| Customer | What happened | Root cause |
|---|---|---|
| "price of all 30 liter minibars" | 5 of 6 items | Default result count of 5. "All" was not modelled. The "Mini Bar" family was not resolved from "minibars", so a 30 L bucket and 40/50 L items competed. |
| "product code of these all minibars" | Codes of 5 other (40/50 L) models | Treated as `more_options`. The AI #1 prompt labelled the shown items "(To Exclude)". There was no concept of "these = the items we just listed". The drafter also had a rule forbidding product codes in the reply. |
| "cheapest 30 liter only, no 40 liter" | "cannot verify" | (a) The selection resolver "selected" one item from the opening request, which was written before any item was shown, so only that item was retrieved. (b) "Cheapest" was ignored downstream: the ranking criterion was dropped unless a comparison was requested. (c) AI #1 phrases like "product code" or "30-liter" were treated as exact codes, and the exact-code gate then rejected every real item. |
| "need DSDR0016 / DSDR0053 price" | "unable to verify" | The stale selection (DMBR0008) pinned retrieval to one item, so the new codes were never looked up. A code that does not exist had no closest-code fallback. |
| "most affordable in-room product", "soap dispenser, hand wash..." | Repeated the DMBR0008 minibar | Same stale selection: catalogue-wide questions were narrowed to the earlier item. |

The HUMAN_REVIEW drafts in this thread were sent manually from the dashboard (`/feedback/drafts/*/send`). They were not auto-sent.

## 3. Fixes (business-agnostic; no tenant or product vocabulary in code)

1. **Conversation reference resolution**
   - AI #1 now sees the items actually shown (codes and titles) instead of an "exclude" list.
   - It declares `reference_scope` (new_request / selected_item / listed_items / none) and `referenced_item_codes`.
   - Deterministic rules enforce and override the decision:
     - a code typed now that was never shown is a new subject;
     - plural back-references ("these / them / ye sab / inke") mean the latest list;
     - catalogue-wide intents drop earlier focus;
     - a message can only select an item that had already been shown when it was written.
2. **Multi-item focus:** "codes of these" retrieves exactly the items of the latest list (`focus_keys`).
3. **"All" requests:** `wants_all_matching` lists every match, up to the safety limit.
4. **Eligibility**
   - Compound family names ("minibar" ↔ "Mini Bar").
   - Nominal size constraints for volume, weight and power: the requested size is hard; sizes the customer negates are excluded (English pre-negation, Hindi post-negation, clause-aware). A record that states no size is kept and flagged unverified.
5. **Price ordering:** "cheapest / most expensive" (`ranking_criterion`) is kept and applied to all eligible items in retrieval and fusion. Size-verified items rank before unverified ones.
6. **Identifier hygiene:** model-tagged phrases and quantities ("product code", "30-liter", "0nly") are never exact codes. Only real closest-code suggestions bypass the code gate.
7. **Unknown codes:** the reply says the code is not in the catalogue and offers up to 3 closest real codes as "did you mean", each with its own verified name and price.
8. **Reply guards**
   - Catalogue codes are customer-facing; the reply must give them when asked.
   - A new validator check rejects any code in a draft that is not in the evidence (critical issue, so the draft is repaired or goes to human review).
9. **Loop safety:** automatic replies carry `Auto-Submitted: auto-replied` and `X-Auto-Response-Suppress: All` (RFC 3834), so another automated responder never answers them. Human-approved sends are not marked.

## 4. Verification (executed)

- **Unit and integration suites:** 222 passed (28 pipeline files: unit, integration, synthetic-tenant end to end, and the accuracy datasets).
- **End-to-end regression on the synthetic tenant** (`tests/test_reference_conversation_regression.py`), using the real AI #1, retrieval, fusion, packaging and AI #2:
  - codes of these;
  - unknown code with suggestions;
  - a new code after a selection;
  - a catalogue-wide question;
  - cheapest by database price;
  - follow-up on the selection.
- **Read-only replay of the real thread** (no writes, no sends; present-day memories disabled so later turns don't leak into earlier ones). Results in section 5.

## 5. Replay results (real data, new code)

- "all 30 liter minibars": all 6 items with correct prices and codes.
- "codes of these": exactly the 5 listed items, with codes.
- "cheapest 30 liter, no 40": DMBR0008, ₹19,140 (stable over 3 runs).
- "DMBR0008": ₹19,140.
- "DSDR0016": not in the catalogue; suggests DSDR0015 (₹195), DSDR0017 (₹225), DSDR0014 (₹1,180).
- "DSDR0053": New ABS Soap Dispenser 800ML, ₹1,940.
- "most affordable in-room product": no false superlative. It explains that the matching options are not in-room products and asks which type is wanted (the request resolves to no product family).
- "soap dispenser / hand wash...": soap and hand-wash dispensers with verified prices.

## 6. Known limitations

- "In-room product" is ambiguous: the reply asks a clarifying question rather than guessing.
- Two non-product rows in the Excel ("Discount", "MIG-001 Outstanding Migration") were imported as products. They have no price and are never quoted, but they should be removed from the source sheet.
- Free-text negation covers common English and Hinglish forms only. Unusual phrasings still fall back to AI #1's own exclusion.
