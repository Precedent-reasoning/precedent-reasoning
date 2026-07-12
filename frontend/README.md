Next.js (App Router) frontend for **Precedent Reasoning** — see the [root README](../README.md) and [CLAUDE.md](../CLAUDE.md) for the full project architecture (agent, local case law index, ingestion).

## Structure

- `app/page.tsx` — root route, redirects to the static landing page (`public/landing/index.html`, see [`landing/README.md`](../landing/README.md))
- `app/app/page.tsx` — the actual chat UI: conversation state, SSE streaming from the backend, `localStorage`-backed conversation history
- `components/` — `Sidebar` (conversation list/search), `AgentStatus`, `ResultsPanel`, `Disclaimer`, `ExampleQueries`

## Getting started

```bash
npm install
npm run dev
# Runs on http://localhost:3000
```

The chat UI (`/app`) calls the backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) — make sure the FastAPI backend is running and its local case law index has been built (see root README) before testing search.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
