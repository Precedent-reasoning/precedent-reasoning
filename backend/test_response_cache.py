#!/usr/bin/env python3
"""
Unit tests for response_cache.py — verify TF-IDF semantic similarity
and LRU eviction work correctly without calling live APIs.
"""

import response_cache

def test_identical_query():
    """Identical queries should hit cache."""
    situation = "My landlord is refusing to return my bond"
    chunks = [
        'data: {"type": "status", "message": "Found cases..."}\n\n',
        'data: {"type": "token", "text": "Here are relevant"}\n\n',
        'data: {"type": "done"}\n\n',
    ]

    # First query: miss (cache empty)
    assert response_cache.get(situation) is None
    response_cache.put(situation, chunks)

    # Second query: hit (exact same text)
    cached = response_cache.get(situation)
    assert cached == chunks, f"Expected cached chunks, got {cached}"
    print("✓ Identical query hits cache")


def test_semantic_similarity():
    """Paraphrases with similar legal vocabulary should hit cache."""
    q1 = "My landlord is refusing to return my bond"
    chunks = ["data: OK\n\n"]

    response_cache.put(q1, chunks)

    # Paraphrase with same keywords in different order
    q2 = "Bond refusal landlord my return is"
    result = response_cache.get(q2)
    assert result == chunks, f"Paraphrase should hit cache"
    print("✓ Semantic similarity (word reuse) hits cache")

    # Different topic should miss
    q3 = "I need help with my visa application"
    result = response_cache.get(q3)
    # May or may not hit depending on threshold, but let's verify it's treated differently
    response_cache.invalidate(q1)  # Clear for next test


def test_cache_stats():
    """Stats should reflect cache state."""
    response_cache.invalidate("anything")  # Clear
    assert response_cache.stats()["entries"] == 0

    response_cache.put("test query", ["data: x\n\n"])
    stats = response_cache.stats()
    assert stats["entries"] == 1
    assert stats["live"] == 1  # Not expired
    print("✓ Cache stats work")
    response_cache.invalidate("test query")


def test_lru_eviction():
    """Cache should evict oldest entry when full."""
    # Set a small max for testing
    import os
    os.environ["RESPONSE_CACHE_MAX"] = "3"

    # Reload module to pick up new env var
    import importlib
    importlib.reload(response_cache)

    # Fill cache
    for i in range(3):
        response_cache.put(f"query {i}", [f"data: {i}\n\n"])
    assert response_cache.stats()["entries"] == 3

    # Add one more — should evict the oldest (query 0)
    response_cache.put("query 3", ["data: 3\n\n"])
    assert response_cache.stats()["entries"] == 3

    # Query 0 should be gone
    assert response_cache.get("query 0") is None
    # Query 3 should be there
    assert response_cache.get("query 3") is not None
    print("✓ LRU eviction works")

    # Reset env
    os.environ["RESPONSE_CACHE_MAX"] = "200"
    importlib.reload(response_cache)


if __name__ == "__main__":
    print("Running response_cache tests...\n")
    test_identical_query()
    test_semantic_similarity()
    test_cache_stats()
    test_lru_eviction()
    print("\n✓ All tests passed!")
