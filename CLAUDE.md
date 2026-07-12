# Precedent Reasoning — CLAUDE.md

## Project Overview

An AI-enabled legal research tool that accepts natural-language descriptions of legal situations, searches a pre-indexed corpus of NSW and Commonwealth case law, and explains why retrieved cases are relevant. The system provides legal **information**, not legal **advice**.

> See [`docs/retrieval-pipeline.html`](docs/retrieval-pipeline.html) for a visual flowchart of the search pipeline described below (open directly in a browser — no build step).

## Architecture

### Approach
- **Pre-indexed local corpus, no live scraping** — a one-time (then periodic) ingestion job builds a local hybrid search index from a bulk case law corpus; the agent queries that local index at request time instead of hitting any court website live
- **Hybrid retrieval + rerank** — each query is embedded and searched against both a vector index and a full-text (BM25/FTS) index, the two result sets are merged, and a cross-encoder reranks candidates before the top results are returned
- **Agent-based** — Claude uses tools to search and fetch cases iteratively, refining queries as needed

### Agent Flow
1. User submits a natural-language description of their legal situation
2. The agent (system prompt in `agent.py`) decides whether to ask 1-2 clarifying questions or search immediately
3. Agent calls `search_cases` with legal-terminology queries; for promising hits it calls `fetch_cases` (parallel) or `fetch_case` to read full text
4. Agent explains why each retrieved case is relevant, with binding/persuasive status and citation
5. Response is streamed to the user (SSE) with case links, summaries, and relevance explanations, followed by a fixed disclaimer

### Key Tools (`backend/tools/corpus.py` — active)
- `search_cases` — hybrid vector + FTS search over the local LanceDB index, reranked with a cross-encoder. Covers NSW courts (NSWSC, NSWCA, NSWCCA, NSWLEC, NCAT, etc.) and Commonwealth courts/tribunals (HCA, FCA, FCAFC, FWC, AAT, etc.). Keeps each returned case's top 3 scored chunks (not just the best one), recorded in a short-lived, TTL'd `_matched_chunks_cache` keyed by URL, so `fetch_case` can retrieve the passages that actually matched
- `fetch_case` — retrieves case text for a single URL. Pulls the case's matched chunks (from the cache above, if this URL was searched in roughly the last 10 minutes) plus its first and last chunk from LanceDB — catchwords/parties and orders/conclusion, wherever the match landed in a long judgment. Falls back to a capped (~8,000 char) head-of-document read from SQLite if there's no recent search context or the chunk lookup fails
- `fetch_cases` — same as `fetch_case` but for up to 5 URLs concurrently; the agent is instructed to prefer this over repeated `fetch_case` calls

### Legacy/unused code
- `backend/tools/austlii.py` — the original live-search implementation (`search_nsw_cases`, `fetch_case` over HTTP to caselaw.nsw.gov.au). No longer imported by `agent.py`; kept in the tree but dead. Safe to delete once confirmed unneeded, otherwise treat as historical reference only.

### Local index build (`backend/ingest.py`)
- Source corpus: [`isaacus/open-australian-legal-corpus`](https://huggingface.co/datasets/isaacus/open-australian-legal-corpus) (HuggingFace), downloaded once to `backend/data/corpus/corpus.jsonl`
- Filters to `type == "decision"` documents where `jurisdiction` is `new_south_wales` or `commonwealth`
- Chunks case text (512 tokens, 50-token overlap), embeds each chunk, and writes to:
  - **LanceDB** (`backend/data/lancedb/`) — chunk vectors + an FTS/BM25 index over chunk text
  - **SQLite** (`backend/data/cases.db`) — full case text keyed by `case_id`/`url`
- **Resumable by design**: re-running `ingest.py` skips any `case_id` already present in SQLite, so it can be killed and restarted freely (e.g. after a crash) without duplicating work
- Flushes to disk every 2048 buffered chunks **or** every 240 seconds, whichever comes first — bounds how much work can be lost if the process is killed mid-run
- Re-run periodically (e.g. monthly) to pick up corpus updates

## Stack

- **Backend**: Python, FastAPI
- **Agent**: Claude tool-use — `claude-sonnet-4-6` for search/reasoning, `claude-haiku-4-5-20251001` for conversation-title generation
- **Embedding model**: `nomic-ai/nomic-embed-text-v1.5` (768-dim, MPS/bfloat16 on Apple Silicon)
- **Reranker**: `zeroentropy/zerank-1-small-reranker` cross-encoder
- **Vector + FTS store**: LanceDB · **Full case text store**: SQLite
- **Frontend**: Next.js (App Router) with streaming responses
- **Data source**: Open Australian Legal Corpus (bulk download, ingested locally) — no live scraping of NSW Caselaw or AustLII in the current agent path
- **Only required API key**: `ANTHROPIC_API_KEY`. (`.env.example` still lists `TAVILY_API_KEY` from an earlier live-search design — it is no longer read by any current code path.)

## Project Structure

```
AI-Legal-Search/
├── backend/
│   ├── main.py              # FastAPI app: POST /search (SSE), POST /title, GET /health
│   ├── agent.py             # Claude agent loop, system prompt, tool dispatch
│   ├── ingest.py            # Corpus download → chunk → embed → LanceDB + SQLite (resumable)
│   ├── response_cache.py    # TF-IDF semantic cache for single-turn /search responses
│   ├── log_config.py        # Logging setup, slow-operation threshold
│   ├── tools/
│   │   ├── corpus.py        # search_cases, fetch_case, fetch_cases_parallel — ACTIVE, local index
│   │   └── austlii.py       # search_nsw_cases, fetch_case — LEGACY, live HTTP, unused
│   └── data/                # corpus.jsonl, cases.db, lancedb/ — gitignored, built by ingest.py
├── frontend/
│   ├── app/                 # Next.js app router — `/` redirects to the static landing page,
│   │                        # `/app` is the actual chat UI (frontend/app/app/page.tsx)
│   └── components/          # Sidebar, AgentStatus, ResultsPanel, Disclaimer, ExampleQueries
├── landing/                  # Static marketing site — see landing/README.md
└── CLAUDE.md
```

## Important Constraints

- **Legal information only**: The system must never provide legal advice. All responses append a fixed disclaimer recommending consultation with a qualified solicitor.
- **Cite sources**: Always link back to the case's source URL for every case surfaced.
- **Jurisdiction**: NSW courts (NSWSC, NSWCA, NSWCCA, NSWLEC, NSWDC, NSWLC, NCAT, etc.) and Commonwealth courts/tribunals (High Court, Federal Court, Fair Work Commission, AAT, etc.) — both are present in the local index.
- **Never invent citations**: the agent must only present cases it actually retrieved via `search_cases`/`fetch_case(s)` from the local index.

## Development Notes

- Use streaming (SSE) on the frontend so users see agent progress in real time
- The agent should show its work: which queries it tried, which cases it fetched
- Disclaimer text must appear prominently in the UI
- Rate limiting: `POST /search` is capped at 5 requests/minute per client IP (`slowapi`)
- The local index must exist before the backend can answer searches — run `python ingest.py` at least once after cloning; `search_cases`/`fetch_case` raise a clear error if `backend/data/lancedb` or `cases.db` don't exist yet
