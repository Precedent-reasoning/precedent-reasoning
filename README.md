# Precedent Reasoning

[![GitHub](https://img.shields.io/badge/GitHub-repo-181717?logo=github&logoColor=white)](https://github.com/Precedent-reasoning/precedent-reasoning)

Find the cases that matter. An AI-powered legal research tool for NSW residents. Describe your legal situation in plain English and get relevant decided cases from NSW and federal courts — with explanations of what each case held and how it compares to your situation.

> **Legal information only.** This tool surfaces case law and explains legal principles. It does not provide legal advice. Always consult a qualified NSW solicitor for advice specific to your circumstances.

![Precedent Reasoning](landing/logo-wordmark.png)

---

## What it does

- Accepts a natural-language description of a legal situation
- Identifies the key legal issues and formulates targeted search queries
- Searches a pre-indexed local corpus of NSW and federal court decisions using hybrid vector + full-text search, reranked with a cross-encoder
- Fetches and reads the full text of promising cases from the local index
- Presents up to 5 relevant cases with citation, court, binding status, what the court held, and how the facts compare to your situation
- Streams results token-by-token as the agent works
- Maintains a persistent, multi-turn conversation history

---

**Key design decision:** Pre-indexed local corpus, no live scraping. A one-time (then periodic) ingestion job (`backend/ingest.py`) downloads the [Open Australian Legal Corpus](https://huggingface.co/datasets/isaacus/open-australian-legal-corpus), filters it to NSW + Commonwealth decisions, and builds a local hybrid search index. The agent queries that local index on every request instead of scraping any court website live — faster, and immune to source-site rate limits or downtime.

**Search strategy:** Each query is embedded (`nomic-embed-text-v1.5`) and searched against a LanceDB vector index and its FTS/BM25 index in parallel; the merged candidates are reranked with a `zerank-1-small` cross-encoder, and the top result per case is returned. When the agent reads a case in full, it gets the chunks that actually matched the search — not just the document's opening lines — plus the case's first and last chunk for context, pulled from LanceDB; a capped SQLite read is the fallback when there's no recent search context.

---

## Jurisdiction coverage

| Jurisdiction | Courts | Relevance for NSW residents |
|---|---|---|
| **NSW** | NSWSC, NSWCA, NSWCCA, NSWLEC, NSWDC, NSWLC, NCAT | Directly binding on NSW state law matters |
| **Federal** | High Court, Federal Court, Fair Work Commission, AAT | Binding on federal law matters (employment, consumer law, immigration, etc.) |

High Court decisions on common law principles (negligence, contract) also bind all NSW courts.

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/) — the only API key required
- ~10 GB free disk for the downloaded corpus + local index (Apple Silicon with MPS recommended for reasonable ingestion speed, but not required)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add:
#   ANTHROPIC_API_KEY=sk-ant-...
# (TAVILY_API_KEY in .env.example is a leftover from an earlier live-search
# design and is no longer read by any code — safe to ignore or delete.)

uvicorn main:app --reload
# Runs on http://localhost:8000
```

### 2. Build the local case law index (one-time)

The backend searches a local index, not the internet, so it must be built before `/search` works:

```bash
cd backend
python -c "from huggingface_hub import hf_hub_download; \
  hf_hub_download('isaacus/open-australian-legal-corpus', 'corpus.jsonl', \
  repo_type='dataset', local_dir='data/corpus')"

python ingest.py
# Downloads once, then chunks + embeds NSW/Commonwealth decisions into
# backend/data/lancedb (vectors + FTS) and backend/data/cases.db (full text).
# Safe to re-run any time (e.g. after a crash, or monthly for corpus updates) —
# already-indexed cases are skipped automatically.
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000).

---

## API

### `POST /search`

Streams SSE events as the agent searches and responds.

**Request body:**
```json
{
  "situation": "My landlord is refusing to return my bond...",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**SSE event types:**
| Type | Fields | Description |
|---|---|---|
| `status` | `message` | Agent progress step (searching, reading case, etc.) |
| `token` | `text` | One chunk of the response text |
| `done` | — | Stream complete |
| `error` | `message` | Error occurred |

### `POST /title`

Generates a short 3–6 word title for a conversation. Uses `claude-haiku-4-5` for speed.

### `GET /health`

Returns `{"status": "ok", "response_cache": {...}}` — the second field reports response-cache size/TTL stats (see below).

---

## Features

- **Streaming** — response text appears token by token; agent status steps update live
- **Parallel case fetching** — up to 5 cases fetched concurrently from the local index to reduce latency
- **Semantic response cache** — single-turn queries are matched against recent responses by TF-IDF cosine similarity (0.82 threshold, 6 h TTL, 200-entry LRU); near-duplicate questions skip the Claude API entirely (`backend/response_cache.py`)
- **Rate limiting** — `/search` capped at 5 requests/minute per client IP
- **Conversation history** — full multi-turn conversations stored in `localStorage` and passed to the backend for context
- **Context trimming** — last 20 messages (10 turns) kept to control latency and cost
- **Smart auto-scroll** — page follows new content unless the user has scrolled up to read
- **Conversation titles** — auto-generated from the first message using Claude Haiku

---

## Disclaimer

This tool provides legal **information** — what courts have decided and what legal principles apply. It does not provide legal **advice** — it will not tell you what to do or predict the outcome of your situation. For advice specific to your circumstances, consult a qualified NSW solicitor. For free legal help, contact [Legal Aid NSW](https://www.legalaid.nsw.gov.au).
