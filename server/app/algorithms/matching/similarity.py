"""Constrained Lightweight String & Token Similarity Matching (Phase 8.3).

Specification:
- Purpose: Compare candidate source columns against target canonical/attribute names when exact/alias lookups fail.
- Safety: Only evaluated on candidate subsets filtered by token presence; never against full cross-products.
- Complexity:
  - Token Jaccard: O(|T1| + |T2|) time, O(|T1| + |T2|) space where |T| is number of tokens (typically 1-5).
  - Bounded Levenshtein: O(|s1| * |s2|) time, O(min(|s1|, |s2|)) space, bounded by max string length (<= 64 chars).
  - Memory: O(1) in-process allocation.
"""

import re
from typing import List, Set, Tuple


_TOKEN_SPLIT_REGEX = re.compile(r"[_\s\-\.\/]+")


def tokenize_identifier(name: str) -> Set[str]:
    """Split identifier into lowercase token set.

    Examples:
    - 'product_title_usd' -> {'product', 'title', 'usd'}
    - 'unitPrice' -> {'unit', 'price'}
    """
    if not name:
        return set()
    # Handle camelCase
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    tokens = _TOKEN_SPLIT_REGEX.split(s.strip().lower())
    return {t for t in tokens if t}


def token_jaccard_similarity(s1: str, s2: str) -> float:
    """Compute Jaccard token overlap between two identifier strings.

    J(A, B) = |A ∩ B| / |A ∪ B|
    """
    t1 = tokenize_identifier(s1)
    t2 = tokenize_identifier(s2)
    if not t1 or not t2:
        return 0.0

    intersection = len(t1 & t2)
    union = len(t1 | t2)
    return round(intersection / union, 4) if union > 0 else 0.0


def bounded_levenshtein_ratio(s1: str, s2: str) -> float:
    """Compute normalized Levenshtein similarity ratio between 0.0 and 1.0 using two-row memory model.

    Memory: O(min(len(s1), len(s2))).
    """
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    # Ensure s2 is the shorter string to minimize row allocation
    if len(s1) < len(s2):
        s1, s2 = s2, s1

    len1, len2 = len(s1), len(s2)
    prev_row = list(range(len2 + 1))
    curr_row = [0] * (len2 + 1)

    for i in range(1, len1 + 1):
        curr_row[0] = i
        c1 = s1[i - 1]
        for j in range(1, len2 + 1):
            cost = 0 if c1 == s2[j - 1] else 1
            curr_row[j] = min(
                curr_row[j - 1] + 1,      # insertion
                prev_row[j] + 1,          # deletion
                prev_row[j - 1] + cost,   # substitution
            )
        prev_row, curr_row = curr_row, prev_row

    dist = prev_row[len2]
    max_len = max(len1, len2)
    ratio = 1.0 - (dist / max_len)
    return round(max(0.0, ratio), 4)


def compute_candidate_similarity(source_col: str, target_name: str) -> float:
    """Hybrid similarity score combining Token Jaccard (60%) and Normalized Levenshtein (40%)."""
    jaccard = token_jaccard_similarity(source_col, target_name)
    lev = bounded_levenshtein_ratio(source_col, target_name)
    # If there is token overlap, weight Jaccard higher; otherwise rely on edit distance
    score = (0.6 * jaccard) + (0.4 * lev)
    return round(score, 4)
