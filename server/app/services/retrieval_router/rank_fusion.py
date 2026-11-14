"""Reciprocal Rank Fusion (RRF) of the semantic and lexical candidate lists.

Why
---
The verifier used to rank by raw scores, mixing two incompatible scales: Qdrant cosine
similarity (≈0.45–0.65 for good matches with text-embedding-3) and the lexical IDF score
(0–1, where a few rare words can score 0.8+). A record that shared rare words with the
question but meant something else ("guest room" -> a hotel intercom for "electric kettle
for guest rooms") beat genuinely relevant records that the semantic branch ranked first.

RRF uses only RANKS, so scales never meet:

    rrf(item) = Σ_lists 1 / (k + rank_in_list)          (k = 60, Cormack et al. 2009)

An item ranked well by BOTH retrievers beats an item that tops only one of them. The result
is normalised to 0..1 by the best achievable value (rank 1 in every list).
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Sequence

RRF_K = 60


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Sequence[str]],
    k: int = RRF_K,
    weights: Optional[Sequence[float]] = None,
) -> Dict[str, float]:
    """item_id -> fused relevance in [0, 1]. Each list is item ids, best first; duplicates
    inside one list keep their best rank.

    ``weights`` (one per list, default 1.0) express how much of the question a list could
    see. A keyword list that knows none of the customer's main noun is partly blind and
    must not count as much as a list that read the whole question.
    """
    w_all = list(weights) if weights is not None else [1.0] * len(ranked_lists)
    pairs = [(lst, max(0.0, float(w))) for lst, w in zip(ranked_lists, w_all) if lst]
    pairs = [(lst, w) for lst, w in pairs if w > 0]
    if not pairs:
        return {}
    scores: Dict[str, float] = {}
    for lst, w in pairs:
        seen = set()
        rank = 0
        for item_id in lst:
            if item_id in seen:
                continue
            seen.add(item_id)
            rank += 1
            scores[item_id] = scores.get(item_id, 0.0) + w / (k + rank)
    best = sum(w for _, w in pairs) / (k + 1)
    return {i: s / best for i, s in scores.items()}


def ranked_ids(pairs: Iterable[tuple]) -> List[str]:
    """(item_id, score) pairs -> ids ordered by score, best first (stable)."""
    return [i for i, _ in sorted(pairs, key=lambda p: -float(p[1] or 0.0))]
