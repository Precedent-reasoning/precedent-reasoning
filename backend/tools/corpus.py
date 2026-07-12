"""
Local case law search and fetch tools backed by:
  - LanceDB  — vector index (Qwen3-Embedding-8B) + FTS index (BM25 via Tantivy)
  - SQLite    — full case text, keyed by URL

Models are lazy-loaded on first use and kept in memory for the life of the process.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sqlite3
import time
from pathlib import Path

import torch
import lancedb
from sentence_transformers import CrossEncoder, SentenceTransformer

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
LANCEDB_PATH = DATA_DIR / "lancedb"
SQLITE_PATH  = DATA_DIR / "cases.db"

EMBED_MODEL  = "nomic-ai/nomic-embed-text-v1.5"
RERANK_MODEL = "zeroentropy/zerank-1-small-reranker"
EMBED_DIM    = 768

# nomic-embed-text-v1.5: prefix queries with "search_query: "
_QUERY_PREFIX = "search_query: "

# How many of a case's highest-scoring chunks to remember for fetch_case() —
# lets fetch_case return the passages that actually matched, not just the
# document's opening characters.
TOP_K_CHUNKS_PER_CASE = 3
FETCH_TEXT_FALLBACK_CHARS = 8000  # cap when a case has no recent search context

# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------

_embedder: SentenceTransformer | None = None
_reranker: CrossEncoder | None = None
_table = None

# url -> (timestamp, sorted matched chunk_indices) — populated by search_cases(),
# consulted by fetch_case() so it can return the matched passages instead of
# always the document head. Short TTL: only needs to bridge a single agent turn
# (search_cases -> fetch_case/fetch_cases within the same request).
_MATCHED_CHUNKS_TTL = 600
_matched_chunks_cache: dict[str, tuple[float, list[int]]] = {}


def _device() -> str:
    return "mps" if torch.backends.mps.is_available() else "cpu"


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        logger.info("Loading embedding model %s…", EMBED_MODEL)
        _embedder = SentenceTransformer(
            EMBED_MODEL,
            trust_remote_code=True,
            model_kwargs={"torch_dtype": torch.bfloat16},
            device=_device(),
        )
    return _embedder


def _get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        logger.info("Loading reranker %s…", RERANK_MODEL)
        # zerank-1-small is a Qwen3ForCausalLM (~4B params) despite the name —
        # must load in bfloat16 (its native dtype) or it doubles to ~16GB+ in fp32
        # and blows the MPS memory ceiling.
        _reranker = CrossEncoder(
            RERANK_MODEL,
            trust_remote_code=True,
            model_kwargs={"torch_dtype": torch.bfloat16},
            device=_device(),
        )
    return _reranker


def _get_table():
    global _table
    if _table is None:
        if not LANCEDB_PATH.exists():
            raise RuntimeError(
                "Local index not found. Run `python ingest.py` first to build it."
            )
        db = lancedb.connect(str(LANCEDB_PATH))
        _table = db.open_table("chunks")
    return _table


# ---------------------------------------------------------------------------
# Public tools
# ---------------------------------------------------------------------------

def search_cases(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the local case law index using hybrid vector + full-text search,
    then rerank results with zerank-1-small.

    Returns up to max_results cases, each with:
      title, citation, url, snippet, court, year, jurisdiction
    """
    table    = _get_table()
    embedder = _get_embedder()

    # Embed query with instruction prefix
    query_vec = embedder.encode(
        _QUERY_PREFIX + query,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )[:EMBED_DIM].astype("float32").tolist()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()

    # Vector search — top 50 chunks
    vec_hits = (
        table.search(query_vec, vector_column_name="vector")
        .limit(50)
        .to_list()
    )

    # FTS search — top 50 chunks
    try:
        fts_hits = (
            table.search(query, query_type="fts")
            .limit(50)
            .to_list()
        )
    except Exception as e:
        logger.warning("FTS search failed (%s), using vector results only.", e)
        fts_hits = []

    # Merge by chunk_id (deduplicate)
    seen: dict[str, dict] = {}
    for hit in vec_hits + fts_hits:
        cid = hit["chunk_id"]
        if cid not in seen:
            seen[cid] = hit
    candidates = list(seen.values())

    if not candidates:
        return []

    # Rerank
    reranker = _get_reranker()
    pairs  = [(query, c["text"]) for c in candidates]
    # zerank's custom forward pass doesn't wrap itself in no_grad, so without this
    # every call retains a full autograd graph (28 transformer layers of
    # activations) that's never freed — blows past the MPS memory ceiling within
    # a single batch.
    with torch.no_grad():
        scores = reranker.predict(pairs)
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    for c, s in zip(candidates, scores):
        c["_score"] = float(s)
    candidates.sort(key=lambda c: c["_score"], reverse=True)

    # Keep the top TOP_K_CHUNKS_PER_CASE scored chunks per case (not just the
    # single best), up to max_results cases — so fetch_case() can later return
    # the passages that actually matched, not just whichever chunk scored highest.
    case_order: list[str] = []       # case_ids in ranked order (best chunk first-seen)
    case_chunks: dict[str, list[dict]] = {}
    for chunk in candidates:
        case_id = chunk["case_id"]
        if case_id not in case_chunks:
            if len(case_order) >= max_results:
                continue
            case_order.append(case_id)
            case_chunks[case_id] = []
        if len(case_chunks[case_id]) < TOP_K_CHUNKS_PER_CASE:
            case_chunks[case_id].append(chunk)

    now = time.monotonic()
    results = []
    for case_id in case_order:
        chunks = case_chunks[case_id]
        best = chunks[0]  # highest-scoring chunk for this case — used for metadata/snippet
        citation = best.get("citation", "")
        url      = best.get("url", "")

        matched_indices = sorted({c["chunk_index"] for c in chunks})
        _matched_chunks_cache[url] = (now, matched_indices)

        results.append({
            "title":        _title_from_citation(citation),
            "citation":     citation,
            "url":          url,
            "snippet":      best["text"][:500],
            "court":        _extract_court(citation, url),
            "year":         _extract_year(citation) or _extract_year(best.get("date", "")),
            "jurisdiction": best.get("jurisdiction", ""),
        })

    return results


def fetch_case(url: str) -> dict:
    """
    Retrieve a case from the local SQLite store by its source URL.
    Returns title, citation, court, jurisdiction, date, text, url.
    """
    if not SQLITE_PATH.exists():
        return {"error": "Local index not found. Run `python ingest.py` first.", "url": url}

    conn = sqlite3.connect(str(SQLITE_PATH))
    try:
        row = conn.execute(
            "SELECT case_id, citation, url, jurisdiction, date, text "
            "FROM cases WHERE url = ?",
            (url,),
        ).fetchone()
    finally:
        conn.close()

    if not row:
        return {"error": f"Case not found in local index: {url}", "url": url}

    case_id, citation, url, jurisdiction, date, stored_text = row
    return {
        "title":        _title_from_citation(citation),
        "citation":     citation,
        "url":          url,
        "court":        _extract_court(citation, url),
        "jurisdiction": jurisdiction,
        "date":         date or "",
        "text":         _assemble_case_text(case_id, url, stored_text),
    }


def _assemble_case_text(case_id: str, url: str, fallback_text: str | None) -> str:
    """
    Build the text returned to the agent for a case: the chunks that actually
    matched the search (if this URL was searched recently, via
    _matched_chunks_cache), plus the case's first and last chunk for structural
    framing — NSW/Commonwealth judgments almost always carry catchwords/parties
    up front and orders/conclusion at the end, wherever the matched passage falls.

    Falls back to the SQLite-stored text (head of document, truncated) if the
    case's chunks can't be looked up or weren't recently searched.
    """
    fallback = (fallback_text or "")[:FETCH_TEXT_FALLBACK_CHARS]

    try:
        table = _get_table()
        rows = (
            table.search()
            .where(f"case_id = '{case_id}'")
            .select(["chunk_index", "text"])
            .to_list()
        )
    except Exception as e:
        logger.warning("chunk lookup failed for case_id=%s (%s); using stored text head", case_id, e)
        return fallback

    if not rows:
        return fallback

    rows.sort(key=lambda r: r["chunk_index"])
    last_index = rows[-1]["chunk_index"]

    now = time.monotonic()
    cached = _matched_chunks_cache.get(url)
    matched_indices: set[int] = set()
    if cached and now - cached[0] < _MATCHED_CHUNKS_TTL:
        matched_indices = set(cached[1])

    wanted = matched_indices | {0, last_index}
    selected = [r for r in rows if r["chunk_index"] in wanted]
    selected.sort(key=lambda r: r["chunk_index"])

    return "\n\n[...]\n\n".join(r["text"] for r in selected)


async def fetch_cases_parallel(urls: list[str]) -> list[dict]:
    """Fetch up to 5 cases from the local store concurrently."""
    urls = urls[:5]
    loop = asyncio.get_event_loop()
    return await asyncio.gather(
        *[loop.run_in_executor(None, fetch_case, url) for url in urls]
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

COURTS = {
    "HCA":          "High Court of Australia",
    "FCAFC":        "Federal Court (Full Court)",
    "FCA":          "Federal Court of Australia",
    "FedCFamC1A":   "Federal Circuit and Family Court (Div 1, Appeals)",
    "FedCFamC1I":   "Federal Circuit and Family Court (Div 1)",
    "FedCFamC2I":   "Federal Circuit and Family Court (Div 2)",
    "AATA":         "Administrative Appeals Tribunal",
    "FWCFB":        "Fair Work Commission (Full Bench)",
    "FWC":          "Fair Work Commission",
    "NSWSC":        "NSW Supreme Court",
    "NSWCA":        "NSW Court of Appeal",
    "NSWCCA":       "NSW Court of Criminal Appeal",
    "NSWLEC":       "NSW Land and Environment Court",
    "NSWDC":        "NSW District Court",
    "NSWLC":        "NSW Local Court",
    "NSWIRComm":    "NSW Industrial Relations Commission",
    "NSWCATAP":     "NSW Civil and Administrative Tribunal (Appeal Panel)",
    "NSWCATCD":     "NSW Civil and Administrative Tribunal (Consumer Division)",
    "NSWCATAD":     "NSW Civil and Administrative Tribunal (Administrative Division)",
    "NSWCATGD":     "NSW Civil and Administrative Tribunal (General Division)",
}


def _extract_court(citation: str, url: str = "") -> str:
    if citation:
        m = re.search(r"\[\d{4}\]\s+([A-Za-z]+)\s+\d+", citation)
        if m:
            code = m.group(1)
            return COURTS.get(code, code)
    for code, name in COURTS.items():
        if f"/{code}/" in url or f"/{code.lower()}/" in url.lower():
            return name
    return "Australian Court"


def _extract_year(value: str) -> str | None:
    if not value:
        return None
    m = re.search(r"\[(\d{4})\]", value) or re.search(r"(\d{4})", value)
    return m.group(1) if m else None


def _title_from_citation(citation: str) -> str:
    if not citation:
        return "Unknown"
    m = re.match(r"(.+?)\s*\[\d{4}\]", citation)
    return m.group(1).strip() if m else citation
