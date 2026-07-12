"""
One-time ingestion script: downloads the Open Australian Legal Corpus from
HuggingFace, filters to NSW + Commonwealth court decisions, chunks the text,
embeds with Qwen3-Embedding-8B (via sentence-transformers on MPS), and indexes
into LanceDB (vector) + SQLite (full text).

Usage:
    cd backend
    python ingest.py

Run again monthly to pick up corpus updates — already-indexed cases are skipped.
"""

from __future__ import annotations

import logging
import re
import sqlite3
import time
from pathlib import Path

import json

import lancedb
import pyarrow as pa
import torch
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CORPUS_ID = "isaacus/open-australian-legal-corpus"
JURISDICTIONS = {"new_south_wales", "commonwealth"}

DATA_DIR     = Path(__file__).parent / "data"
CORPUS_LOCAL = DATA_DIR / "corpus" / "corpus.jsonl"
LANCEDB_PATH = DATA_DIR / "lancedb"
SQLITE_PATH  = DATA_DIR / "cases.db"

EMBED_MODEL = "nomic-ai/nomic-embed-text-v1.5"
EMBED_DIM = 768         # full nomic-embed-text-v1.5 dimension (Matryoshka; can truncate to 256/512)
EMBED_BATCH = 256       # 137 M params fits many seqs per batch; 256 × 512 tokens well within 32 GB
CHUNK_TOKENS = 512      # ≈2 KB text; nomic supports up to 8192 but 512 is fast and retrieval-optimal
CHUNK_OVERLAP = 50      # token overlap between consecutive chunks
CHARS_PER_TOKEN = 4

FLUSH_EVERY = 2048      # flush to LanceDB after this many chunks (larger = fewer files = faster adds)
FLUSH_INTERVAL_SECONDS = 240  # also flush if this much time has passed, so low-chunk-density
                              # stretches (e.g. short procedural orders) don't leave hours of
                              # work sitting in an uncommitted transaction

# nomic-embed-text-v1.5: documents need "search_document: " prefix; queries need "search_query: "
DOC_PREFIX = "search_document: "

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

CHUNK_SCHEMA = pa.schema([
    pa.field("chunk_id",    pa.string()),
    pa.field("case_id",     pa.string()),
    pa.field("citation",    pa.string()),
    pa.field("url",         pa.string()),
    pa.field("jurisdiction",pa.string()),
    pa.field("date",        pa.string()),
    pa.field("chunk_index", pa.int32()),
    pa.field("text",        pa.string()),
    pa.field("vector",      pa.list_(pa.float32(), EMBED_DIM)),  # 768 floats for nomic-embed-text-v1.5
])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_text(text: str) -> list[str]:
    size = CHUNK_TOKENS * CHARS_PER_TOKEN
    step = (CHUNK_TOKENS - CHUNK_OVERLAP) * CHARS_PER_TOKEN
    chunks, start = [], 0
    while start < len(text):
        chunk = text[start : start + size]
        if chunk.strip():
            chunks.append(chunk)
        start += step
    return chunks


def _setup_sqlite(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            case_id    TEXT PRIMARY KEY,
            citation   TEXT,
            url        TEXT,
            jurisdiction TEXT,
            date       TEXT,
            source     TEXT,
            text       TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_url ON cases(url)")
    conn.commit()
    return conn


def _existing_case_ids(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT case_id FROM cases").fetchall()
    return {r[0] for r in rows}


def _embed(embedder: SentenceTransformer, texts: list[str]) -> list[list[float]]:
    prefixed = [DOC_PREFIX + t for t in texts]
    vecs = embedder.encode(
        prefixed,
        batch_size=EMBED_BATCH,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vecs[:, :EMBED_DIM].astype("float32").tolist()


def _flush(
    embedder: SentenceTransformer,
    text_buf: list[str],
    meta_buf: list[dict],
    table,
    conn: sqlite3.Connection,
) -> None:
    vectors = _embed(embedder, text_buf)
    rows = [{**m, "vector": v} for m, v in zip(meta_buf, vectors)]
    table.add(rows)
    conn.commit()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)

    device = "mps"
    logger.info("Device: %s", device)

    logger.info("Loading %s (bfloat16)…", EMBED_MODEL)
    embedder = SentenceTransformer(
        EMBED_MODEL,
        trust_remote_code=True,
        model_kwargs={"torch_dtype": torch.bfloat16},
        device=device,
    )
    embedder.max_seq_length = CHUNK_TOKENS

    if device == "mps":
        logger.info("Warming up MPS kernel…")
        _dummy = [DOC_PREFIX + "warmup " * 100] * EMBED_BATCH
        embedder.encode(_dummy, batch_size=EMBED_BATCH, normalize_embeddings=True,
                        show_progress_bar=False, convert_to_numpy=True)
        logger.info("MPS warm-up done.")
    else:
        logger.info("Using CPU (AMX) — no warm-up needed.")

    conn = _setup_sqlite(SQLITE_PATH)
    already_indexed = _existing_case_ids(conn)
    logger.info("%d cases already in index — will skip them.", len(already_indexed))

    db = lancedb.connect(str(LANCEDB_PATH))
    try:
        table = db.open_table("chunks")
        logger.info("Opened existing 'chunks' table.")
    except Exception:
        table = db.create_table("chunks", schema=CHUNK_SCHEMA)
        logger.info("Created new 'chunks' table.")

    if not CORPUS_LOCAL.exists():
        raise FileNotFoundError(
            f"Local corpus not found at {CORPUS_LOCAL}.\n"
            "Download it first:\n"
            "  python -c \"from huggingface_hub import hf_hub_download; "
            "hf_hub_download('isaacus/open-australian-legal-corpus', 'corpus.jsonl', "
            "repo_type='dataset', local_dir='data/corpus')\""
        )

    logger.info("Reading corpus from %s (%.1f GB)…", CORPUS_LOCAL, CORPUS_LOCAL.stat().st_size / 1e9)
    # Known count: 232560. Skip re-reading the 9.4 GB file just to count lines —
    # that fills the OS page cache and leaves less unified memory for MPS.
    TOTAL_DOCS = 232560

    text_buf: list[str] = []
    meta_buf: list[dict] = []
    total_cases = total_chunks = skipped = 0
    total_seen = 0
    t0 = time.monotonic()
    last_flush = t0

    with open(CORPUS_LOCAL, "r", encoding="utf-8") as f:
      for line in tqdm(f, total=TOTAL_DOCS, desc="Ingesting", unit="doc"):
        if len(line) > 1_000_000:  # skip lines > 1 MB — too slow to parse, heavily truncated anyway
            total_seen += 1
            continue
        doc = json.loads(line)
        total_seen += 1
        if total_seen % 5000 == 0:
            elapsed = time.monotonic() - t0
            logger.info(
                "Streamed %d docs — %d matched (%d chunks buffered) — %.0fs elapsed",
                total_seen, total_cases, len(text_buf), elapsed,
            )

        if doc.get("type") != "decision":
            continue
        if doc.get("jurisdiction") not in JURISDICTIONS:
            continue
        text = (doc.get("text") or "")[:200_000].strip()  # cap at 200 KB (~108 chunks max per doc)
        if not text:
            continue

        case_id = doc["version_id"]

        if case_id in already_indexed:
            skipped += 1
            continue

        citation   = doc.get("citation") or ""
        url        = doc.get("url") or ""
        jurisdiction = doc.get("jurisdiction") or ""
        date       = doc.get("date") or ""
        source     = doc.get("source") or ""

        conn.execute(
            "INSERT OR REPLACE INTO cases VALUES (?,?,?,?,?,?,?)",
            (case_id, citation, url, jurisdiction, date, source, text[:50_000]),
        )
        total_cases += 1

        for i, chunk in enumerate(_chunk_text(text)):
            meta_buf.append({
                "chunk_id":    f"{case_id}:{i}",
                "case_id":     case_id,
                "citation":    citation,
                "url":         url,
                "jurisdiction":jurisdiction,
                "date":        date,
                "chunk_index": i,
                "text":        chunk,
            })
            text_buf.append(chunk)
            total_chunks += 1
            if len(text_buf) >= FLUSH_EVERY or (time.monotonic() - last_flush) >= FLUSH_INTERVAL_SECONDS:
                _flush(embedder, text_buf, meta_buf, table, conn)
                text_buf.clear()
                meta_buf.clear()
                last_flush = time.monotonic()

    if text_buf:
        _flush(embedder, text_buf, meta_buf, table, conn)

    conn.commit()
    conn.close()

    logger.info("Building full-text search index…")
    table.create_fts_index("text", replace=True)

    logger.info("Building vector ANN index (IVF-PQ)…")
    table.create_index(vector_column_name="vector", replace=True)

    elapsed = time.monotonic() - t0
    logger.info(
        "Done in %.0fs — %d cases, %d chunks indexed, %d skipped.",
        elapsed, total_cases, total_chunks, skipped,
    )


if __name__ == "__main__":
    main()
