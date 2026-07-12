"""
FastAPI backend for Precedent Reasoning.

Single endpoint: POST /search
Streams server-sent events (SSE) back to the frontend as the agent works.
"""

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env", override=True)

import logging
import os
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, field_validator
from agent import run_agent
from log_config import configure_logging
import response_cache
import anthropic

configure_logging(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

_anthropic = anthropic.Anthropic()

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Precedent Reasoning")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
_allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["Content-Type"],
)


class HistoryTurn(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class SearchRequest(BaseModel):
    situation: str
    history: list[HistoryTurn] = []

    @field_validator("situation")
    @classmethod
    def situation_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("situation cannot be empty")
        if len(v) > 2000:
            raise ValueError("situation must be under 2000 characters")
        return v


@app.post("/search")
@limiter.limit("5/minute")
async def search(body: SearchRequest, request: Request):
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())[:8]
    history = [{"role": t.role, "content": t.content} for t in body.history]
    started_at = time.monotonic()
    logger.info("[%s] /search started situation_len=%d history_turns=%d",
                request_id, len(body.situation), len(history) // 2)

    async def stream_with_logging():
        try:
            async for chunk in run_agent(body.situation, history=history, request_id=request_id):
                yield chunk
        finally:
            elapsed = time.monotonic() - started_at
            logger.info("[%s] /search completed elapsed=%.2fs", request_id, elapsed)

    return StreamingResponse(
        stream_with_logging(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Request-Id": request_id,
        },
    )


class TitleRequest(BaseModel):
    situation: str


@app.post("/title")
async def generate_title(request: TitleRequest):
    import asyncio
    from functools import partial

    t0 = time.monotonic()
    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            partial(
                _anthropic.messages.create,
                model="claude-haiku-4-5-20251001",
                max_tokens=20,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Give a short 3-6 word title summarising this legal situation. "
                        f"Return ONLY the title, no punctuation, no quotes.\n\n{request.situation}"
                    ),
                }],
            )
        )
    except Exception:
        logger.exception("/title API call failed elapsed=%.2fs", time.monotonic() - t0)
        raise
    elapsed = time.monotonic() - t0
    logger.info("/title completed elapsed=%.2fs", elapsed)
    title = response.content[0].text.strip().strip('"').strip("'")
    return {"title": title}


@app.get("/health")
async def health():
    return {"status": "ok", "response_cache": response_cache.stats()}
