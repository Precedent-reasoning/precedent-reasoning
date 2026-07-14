"""
Claude agent loop for NSW and Commonwealth legal case search.

The agent receives a natural-language legal situation, formulates search queries,
retrieves relevant cases from the local hybrid index (LanceDB + SQLite), and
explains their relevance.

Uses Claude tool_use with streaming so the frontend can show live progress.
"""

from __future__ import annotations

import json
import logging
import asyncio
import time
from functools import partial
import anthropic
from tools.corpus import search_cases, fetch_case, fetch_cases_parallel
from log_config import SLOW_QUERY_THRESHOLD_S
import response_cache

logger = logging.getLogger(__name__)

client = anthropic.AsyncAnthropic()
MODEL = "claude-sonnet-4-6"

# Hard cap on Claude API calls per request. At MAX_TOOL_ITERATIONS the agent's
# tool calls are answered with a "wrap up now" error instead of being executed;
# one further call is allowed for the final answer.
MAX_TOOL_ITERATIONS = 10

SYSTEM_PROMPT = """You are a legal research assistant helping NSW (New South Wales) residents find relevant Australian case law.

Your role is to help users find relevant decided cases for their legal situation. You provide legal INFORMATION only — not legal advice.

## STEP 1 — Decide whether to clarify or search

Before running any searches, assess whether the query contains enough specific facts to find relevant cases. If one or two targeted questions would significantly improve the results, ask them first. Keep questions short, plain, and numbered. Do not ask more than 2 questions. Do not ask for information that is not necessary to narrow the search (e.g. do not ask for names, dates, or personal details).

Examples of when to ask:
- "My landlord won't return my bond" → ask: residential or commercial tenancy?
- "I was dismissed from my job" → ask: employee or contractor? More or less than 6 months employed?
- "A council decision went against me" → ask: what type of decision (DA, fine, licence)?

Examples of when NOT to ask — search immediately:
- The query already specifies the key facts
- The legal issue is clear enough that the search terms are obvious
- The user is continuing an existing conversation with sufficient context

If you ask clarifying questions, output ONLY the questions — no preamble, no explanation, no search. Wait for the user's reply before searching.

## STEP 2 — REQUIRED OUTPUT FORMAT (after clarification if needed)

Your entire response must consist of exactly two parts and nothing else:

**Part 1:** One short paragraph (2–3 sentences) identifying the legal issues raised — neutral and descriptive. No conclusions.

**Part 2:** Up to 5 case blocks. Each block must use this structure exactly:

### 🏛️ [Case Name and Citation] — [Court Name]
[Case Name and Citation as a markdown hyperlink to the case's source URL]

**Court & Year:** [Court name], [Year] · **Binding status:** [Binding on all Australian courts / Binding on NSW courts / Persuasive in NSW courts] — [one sentence explaining why]

**What the court held:** [The court's decision and the legal principle established. Do not apply it to the user.]

**How it compares to your situation:** [Factual similarities or differences in neutral, descriptive terms only. No conclusions about outcome. No advice.]

After the last case block, output nothing. No summary. No takeaways. No disclaimer. No "next steps". No "what this means". Stop immediately after the last "How it compares" field.

## How to approach a search

1. Analyse the user's situation and identify the key legal issues (e.g. negligence, contract breach, defamation, unfair dismissal).
2. Formulate 2-3 targeted search queries using legal terminology.
3. Search for cases using those queries — look for both NSW cases and relevant federal cases.
4. For promising results, fetch the full case text to assess relevance.
5. Explain clearly WHY each case is relevant to the user's situation — what legal principle it establishes, how the facts compare.
6. For EVERY case you present, you MUST include its URL as a markdown link, e.g. [Smith v Jones [2023] NSWSC 1](https://...). The URL is returned by search_cases and fetch_case — always use it. Never present a case without its URL.
7. **Prefer recent cases.** Prioritise cases from the last 10 years wherever possible. Only include older landmark cases if they are the leading authority on a principle and no more recent case has superseded them — and if so, note that they are the foundational authority.

## Jurisdiction guidance

Cases in the search results come from two jurisdictions:

- **NSW courts** (NSWSC, NSWCA, NSWDC, NCAT, etc.) — directly binding on NSW residents for state law matters such as contract, negligence, property, tenancy, and state criminal law.
- **Federal courts** (High Court, Federal Court, Fair Work Commission, AAT, etc.) — binding across all of Australia for federal law matters such as employment (Fair Work Act), immigration, taxation, consumer law (Australian Consumer Law), corporations, and constitutional matters. High Court decisions on common law principles (e.g. negligence, contract) also bind NSW courts.

When presenting each case, always state:
- The court name and year
- Whether it is **binding** or **persuasive** for an NSW resident (e.g. "This High Court decision is binding on all Australian courts including NSW")
- Why the jurisdiction matters for the user's specific situation

## Important constraints

- Do not mention internal implementation details in your responses — never use words like "simultaneously", "in parallel", or "concurrently" when describing how you search or fetch cases.
- Cases come from a local index of NSW and Commonwealth case law. Only surface cases you have actually retrieved and read via the tools — never invent citations or URLs.
- Provide legal information only, never legal advice: no conclusions about the user's likely outcome, no recommendations on what they should do, no predictions about how a court would decide their matter.
- If a case appears overruled or distinguished by later cases, note that.
- **Present at most 5 cases** in your final response — pick the most relevant ones.
- **Use `fetch_cases` (not `fetch_case`) whenever you want to read multiple cases** — it fetches them all at once and is much faster. Only use `fetch_case` for a single URL.
"""

TOOLS = [
    {
        "name": "search_cases",
        "description": (
            "Search the local Australian case law index using a legal search query. "
            "Covers NSW courts (NSWSC, NSWCA, NCAT, etc.) and federal courts "
            "(High Court, Federal Court, Fair Work Commission, AAT, etc.). "
            "Use legal terminology for best results."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Legal search query, e.g. 'negligence duty of care occupier'"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 5, max 10)",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "fetch_case",
        "description": (
            "Fetch the full text of a single case from the local index by URL. "
            "Use fetch_cases instead when you have multiple URLs to read at once."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The case URL (from search_cases results)"
                }
            },
            "required": ["url"]
        }
    },
    {
        "name": "fetch_cases",
        "description": (
            "Fetch up to 5 cases from the local index in parallel — much faster than calling fetch_case repeatedly. "
            "Prefer this whenever you have 2 or more URLs to read. Returns a list of case objects."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "urls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of case URLs to fetch (max 5), from search_cases results",
                    "maxItems": 5
                }
            },
            "required": ["urls"]
        }
    }
]


def _set_cache_breakpoint(messages: list[dict]) -> None:
    """
    Move the prompt-cache breakpoint to the last content block of the last
    message, so each agent iteration reuses the previous iteration's prefix
    (system + tools + all earlier turns) instead of re-processing it at full
    price. Only one message-level breakpoint is kept (the API allows 4 total;
    one is spent on the system prompt).
    """
    for m in messages:
        content = m.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    block.pop("cache_control", None)
    last_content = messages[-1].get("content")
    if isinstance(last_content, list) and last_content:
        last_block = last_content[-1]
        if isinstance(last_block, dict):
            last_block["cache_control"] = {"type": "ephemeral"}


def _run_tool_sync(name: str, inputs: dict) -> str:
    if name == "search_cases":
        return json.dumps(search_cases(**inputs), indent=2)
    elif name == "fetch_case":
        return json.dumps(fetch_case(**inputs), indent=2)
    else:
        return json.dumps({"error": f"Unknown tool: {name}"})


async def run_agent(situation: str, history: list[dict] | None = None, request_id: str = "-"):
    """
    Run the legal search agent for a given user situation.

    history: list of prior {"role": "user"/"assistant", "content": str} turns
             so the agent can continue an existing conversation.
    request_id: opaque ID used to correlate log lines for a single user request.

    Yields server-sent event strings:
      - {"type": "status", "message": "..."}   agent thinking/searching
      - {"type": "token", "text": "..."}        streaming response text
      - {"type": "done"}                        stream complete
      - {"type": "error", "message": "..."}     error occurred
    """
    rid = request_id  # short alias for log lines

    # Only cache single-turn queries — conversation context makes multi-turn
    # responses situation-specific and unsafe to replay.
    is_cacheable = not history

    if is_cacheable:
        cached = response_cache.get(situation)
        if cached is not None:
            logger.info("[%s] serving from response cache (%d chunks)", rid, len(cached))
            for chunk in cached:
                yield chunk
            return

    # Keep at most the last 10 turns (20 messages) to control latency and cost
    trimmed_history = (history or [])[-20:]
    messages = [*trimmed_history, {"role": "user", "content": situation}]

    collected_chunks: list[str] = []  # accumulate for caching on success

    async def _emit(event_type: str, **kwargs):
        """Yield one SSE chunk and, if this request is cacheable, collect it."""
        chunk = _sse(event_type, **kwargs)
        # status messages are ephemeral (searching/reading) — only cache
        # token and done events so the replay is a clean response stream.
        if is_cacheable and event_type in ("token", "done"):
            collected_chunks.append(chunk)
        return chunk

    first = await _emit("status", message="Analysing your situation...")
    yield first

    iteration = 0
    while True:
        iteration += 1
        if iteration > MAX_TOOL_ITERATIONS + 1:
            logger.error("[%s] aborting: exceeded %d iterations", rid, MAX_TOOL_ITERATIONS + 1)
            yield _sse("error", message="The search took too many steps. Please try rephrasing your question.")
            return

        # Track tool calls being assembled from streaming deltas
        pending_tool_id: str | None = None
        pending_tool_name: str | None = None
        pending_tool_input: str = ""
        assembled_content: list = []

        _set_cache_breakpoint(messages)
        claude_t0 = time.monotonic()
        logger.info("[%s] Claude API call #%d started", rid, iteration)
        try:
            async with client.messages.stream(
                model=MODEL,
                max_tokens=8192,
                system=[{
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    # caches tools + system together (tools render first)
                    "cache_control": {"type": "ephemeral"},
                }],
                tools=TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    etype = event.type

                    if etype == "content_block_start":
                        block = event.content_block
                        if block.type == "tool_use":
                            pending_tool_id = block.id
                            pending_tool_name = block.name
                            pending_tool_input = ""
                            assembled_content.append({
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": {},  # filled after input_json_delta
                            })
                        elif block.type == "text":
                            assembled_content.append({"type": "text", "text": ""})

                    elif etype == "content_block_delta":
                        delta = event.delta
                        if delta.type == "text_delta":
                            # True streaming — yield each token as it arrives
                            yield await _emit("token", text=delta.text)
                            if assembled_content and assembled_content[-1]["type"] == "text":
                                assembled_content[-1]["text"] += delta.text
                        elif delta.type == "input_json_delta":
                            pending_tool_input += delta.partial_json

                    elif etype == "content_block_stop":
                        if pending_tool_name is not None:
                            # Finalise tool input JSON
                            try:
                                tool_input = json.loads(pending_tool_input) if pending_tool_input else {}
                            except json.JSONDecodeError:
                                tool_input = {}
                            for block in assembled_content:
                                if block.get("id") == pending_tool_id:
                                    block["input"] = tool_input
                            pending_tool_id = None
                            pending_tool_name = None
                            pending_tool_input = ""

                final_message = await stream.get_final_message()
        except anthropic.APIError as e:
            elapsed = time.monotonic() - claude_t0
            logger.error("[%s] Claude API error after %.2fs: %s", rid, elapsed, e, exc_info=True)
            if "overloaded" in str(e).lower():
                msg = "The AI service is currently overloaded. Please wait a moment and try again."
            else:
                msg = "The AI service returned an error. Please try again."
            yield _sse("error", message=msg)
            return  # do not cache error responses
        except Exception as e:
            # e.g. the SDK raises TypeError when no API key is configured.
            # Without this, the exception kills the generator mid-stream and
            # the browser just sees "Failed to fetch".
            elapsed = time.monotonic() - claude_t0
            logger.error("[%s] Claude call failed after %.2fs: %s", rid, elapsed, e, exc_info=True)
            if "auth" in str(e).lower() or "api_key" in str(e).lower():
                msg = ("The server is not configured with an Anthropic API key. "
                       "Set ANTHROPIC_API_KEY in backend/.env and restart the backend.")
            else:
                msg = "An unexpected server error occurred. Please try again."
            yield _sse("error", message=msg)
            return  # do not cache error responses

        claude_elapsed = time.monotonic() - claude_t0
        usage = getattr(final_message, "usage", None)
        logger.info(
            "[%s] Claude API call #%d done elapsed=%.2fs stop=%s tokens_in=%s tokens_out=%s cache_read=%s cache_write=%s",
            rid, iteration, claude_elapsed, final_message.stop_reason,
            getattr(usage, "input_tokens", "?"), getattr(usage, "output_tokens", "?"),
            getattr(usage, "cache_read_input_tokens", "?"),
            getattr(usage, "cache_creation_input_tokens", "?"),
        )
        if claude_elapsed > SLOW_QUERY_THRESHOLD_S:
            logger.warning("[%s] Slow Claude API call #%d: %.2fs", rid, iteration, claude_elapsed)

        messages.append({"role": "assistant", "content": assembled_content})

        if final_message.stop_reason == "tool_use":
            if iteration >= MAX_TOOL_ITERATIONS:
                # Budget exhausted — refuse the tool calls and ask for a final answer.
                logger.warning("[%s] tool budget exhausted at iteration %d", rid, iteration)
                tool_results = [
                    {
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps({
                            "error": "Search limit reached. Present your findings now "
                                     "using only the cases you have already retrieved. "
                                     "Do not call any more tools."
                        }),
                    }
                    for block in assembled_content
                    if block["type"] == "tool_use"
                ]
                messages.append({"role": "user", "content": tool_results})
                continue

            tool_results = []
            for block in assembled_content:
                if block["type"] != "tool_use":
                    continue

                tool_name = block["name"]
                tool_input = block["input"]

                if tool_name == "search_cases":
                    yield await _emit("status", message=f'Searching: "{tool_input.get("query", "")}"')
                elif tool_name == "fetch_case":
                    yield await _emit("status", message=f"Reading case: {tool_input.get('url', '')}")
                elif tool_name == "fetch_cases":
                    urls = tool_input.get("urls", [])[:5]
                    yield await _emit("status", message=f"Reading {len(urls)} cases…")

                tool_t0 = time.monotonic()
                try:
                    if tool_name == "fetch_cases":
                        urls = tool_input.get("urls", [])[:5]
                        cases = await fetch_cases_parallel(urls)
                        result = json.dumps(cases, indent=2)
                    else:
                        result = await asyncio.get_event_loop().run_in_executor(
                            None, partial(_run_tool_sync, tool_name, tool_input)
                        )
                    tool_elapsed = time.monotonic() - tool_t0
                    logger.info("[%s] tool=%s elapsed=%.2fs", rid, tool_name, tool_elapsed)
                    if tool_elapsed > SLOW_QUERY_THRESHOLD_S:
                        logger.warning("[%s] Slow tool call: %s took %.2fs", rid, tool_name, tool_elapsed)
                except Exception as e:
                    tool_elapsed = time.monotonic() - tool_t0
                    logger.error("[%s] tool=%s failed after %.2fs: %s", rid, tool_name, tool_elapsed, e, exc_info=True)
                    error_msg = _user_friendly_tool_error(tool_name, e)
                    yield await _emit("status", message=f"⚠️ {error_msg}")
                    result = json.dumps({"error": error_msg})

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": result,
                })

            messages.append({"role": "user", "content": tool_results})

        elif final_message.stop_reason in ("end_turn", "max_tokens"):
            truncated = final_message.stop_reason == "max_tokens"
            if truncated:
                logger.warning("[%s] response truncated at max_tokens", rid)
                yield await _emit("token", text="\n\n*…the response was cut short due to length.*")
            disclaimer = (
                "\n\n---\n\n"
                "*This is legal information, not legal advice. "
                "For advice specific to your circumstances, please consult a qualified NSW solicitor. "
                "For free legal help, contact [Legal Aid NSW](https://www.legalaid.nsw.gov.au).*"
            )
            yield await _emit("token", text=disclaimer)
            yield await _emit("done")
            if is_cacheable and collected_chunks and not truncated:
                response_cache.put(situation, collected_chunks)
            return

        else:
            # Unexpected stop reason (shouldn't happen with tool_use or tool_calls handled above)
            yield _sse("error", message=f"Unexpected stop reason: {final_message.stop_reason}")
            return  # do not cache error responses


def _user_friendly_tool_error(tool_name: str, exc: Exception) -> str:
    msg = str(exc)
    if tool_name == "search_cases":
        if "ingest.py" in msg or "not found" in msg.lower():
            return "The local case law index has not been built yet. Run `python ingest.py` first."
        if "no results" in msg.lower():
            return "No cases found for that query. Try different search terms."
        return f"Search failed: {msg}"
    if tool_name in ("fetch_case", "fetch_cases"):
        if "not found" in msg.lower():
            return "That case was not found in the local index."
        return f"Could not read case: {msg}"
    return f"Tool error ({tool_name}): {msg}"


def _sse(event_type: str, **kwargs) -> str:
    payload = {"type": event_type, **kwargs}
    return f"data: {json.dumps(payload)}\n\n"
