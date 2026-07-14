from __future__ import annotations

"""
Semantic response cache for Claude agent answers.

Caches the full SSE event stream for a given legal situation so that
identical or very similar follow-up queries skip the Claude API entirely.

Similarity strategy
-------------------
We use TF-IDF cosine similarity over word unigrams.  This is cheap to compute
in-process and catches paraphrases that share legal vocabulary (e.g.
"landlord won't return my bond" ≈ "landlord refusing to refund bond deposit").
It won't catch deep semantic synonyms, but those are rare in legal queries
where users tend to use the same terminology.

A proper embedding-based cache (e.g. with text-embedding-3-small) would catch
more cases but requires an additional API call per query.  The TF-IDF approach
is a practical first step with zero latency overhead on cache hits.

Configuration
-------------
RESPONSE_CACHE_TTL_S      How long a cached response is valid (default 6 h).
RESPONSE_CACHE_MAX        Maximum number of entries before LRU eviction (default 200).
RESPONSE_CACHE_SIMILARITY Cosine similarity threshold for a cache hit (default 0.82).
                          Raise to require closer matches; lower to be more aggressive.
"""

import logging
import math
import os
import re
import time
from collections import Counter, OrderedDict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (readable from environment so tests / staging can override)
# ---------------------------------------------------------------------------
TTL_S: float = float(os.environ.get("RESPONSE_CACHE_TTL_S", 6 * 3600))      # 6 hours
MAX_ENTRIES: int = int(os.environ.get("RESPONSE_CACHE_MAX", 200))
SIMILARITY_THRESHOLD: float = float(os.environ.get("RESPONSE_CACHE_SIMILARITY", 0.82))

# ---------------------------------------------------------------------------
# Internal storage: OrderedDict used as an LRU queue
# ---------------------------------------------------------------------------
# Each value: (timestamp, normalised_text, tf_vector, numbers, event_chunks)
_cache: OrderedDict[str, tuple[float, str, dict[str, float], Counter, list[str]]] = OrderedDict()

# ---------------------------------------------------------------------------
# Text normalisation & TF-IDF helpers
# ---------------------------------------------------------------------------
_STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "my", "i", "me", "is", "was", "are", "were", "be", "been",
    "have", "has", "had", "do", "did", "will", "would", "can", "could",
    "that", "this", "it", "its", "they", "them", "their", "we", "our",
    "not", "no", "by", "from", "as", "so", "if", "then", "than",
}


def _tokenise(text: str) -> list[str]:
    return [
        w for w in re.findall(r"[a-z]+", text.lower())
        if w not in _STOP_WORDS and len(w) > 1
    ]


def _numbers(text: str) -> Counter:
    """
    Multiset of numeric tokens. Numbers carry outsized legal weight relative
    to their share of the text ("dismissed after 5 months" vs "7 months"
    straddles the 6-month minimum employment period), so a cached response is
    only reused when the numbers match exactly.
    """
    return Counter(re.findall(r"\d+(?:\.\d+)?", text))


def _tf(tokens: list[str]) -> dict[str, float]:
    """Term frequency (log-normalised)."""
    counts = Counter(tokens)
    total = sum(counts.values()) or 1
    return {term: math.log(1 + count / total) for term, count in counts.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two TF vectors."""
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _make_key(text: str) -> str:
    """Stable cache key: normalised, whitespace-collapsed."""
    return re.sub(r"\s+", " ", text.lower().strip())


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get(situation: str) -> list[str] | None:
    """
    Return the cached SSE event chunks for this situation, or None if not
    cached / expired / no close match found.
    """
    now = time.monotonic()
    query_tf = _tf(_tokenise(situation))
    query_numbers = _numbers(situation)

    best_key: str | None = None
    best_sim: float = 0.0

    for key, (ts, _norm, cached_tf, cached_numbers, _chunks) in list(_cache.items()):
        if now - ts > TTL_S:
            del _cache[key]
            continue
        if cached_numbers != query_numbers:
            # Numeric details differ — legally distinct even if the words match.
            continue
        sim = _cosine(query_tf, cached_tf)
        if sim > best_sim:
            best_sim = sim
            best_key = key

    if best_key is not None and best_sim >= SIMILARITY_THRESHOLD:
        entry = _cache[best_key]
        # Move to end (most recently used)
        _cache.move_to_end(best_key)
        logger.info(
            "response cache HIT similarity=%.3f key=%r", best_sim, best_key[:60]
        )
        return entry[4]  # event_chunks

    logger.debug("response cache MISS best_similarity=%.3f", best_sim)
    return None


def put(situation: str, chunks: list[str]) -> None:
    """
    Store the collected SSE chunks for this situation.
    Evicts the least-recently-used entry when the cache is full.
    """
    if not chunks:
        return
    key = _make_key(situation)
    tf = _tf(_tokenise(situation))
    _cache[key] = (time.monotonic(), key, tf, _numbers(situation), chunks)
    _cache.move_to_end(key)
    while len(_cache) > MAX_ENTRIES:
        evicted = next(iter(_cache))
        del _cache[evicted]
        logger.debug("response cache evicted key=%r", evicted[:60])
    logger.info("response cache stored key=%r entries=%d", key[:60], len(_cache))


def invalidate(situation: str) -> bool:
    """Remove an exact entry. Returns True if it existed."""
    key = _make_key(situation)
    if key in _cache:
        del _cache[key]
        return True
    return False


def stats() -> dict:
    """Return current cache statistics (useful for /health or admin endpoints)."""
    now = time.monotonic()
    live = sum(1 for ts, *_ in _cache.values() if now - ts <= TTL_S)
    return {"entries": len(_cache), "live": live, "ttl_s": TTL_S, "max": MAX_ENTRIES}
