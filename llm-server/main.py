"""
LLM Server — OpenAI SDK wrapper for OpenRouter.

Single source of truth for all LLM communication.
Anthropic caching uses explicit cache_control breakpoints on content blocks.
OpenRouter does NOT support top-level auto caching — only per-block breakpoints.
Provider sticky routing is automatic — do NOT set provider.order.

Endpoints:
  POST /v1/chat/stream  → NDJSON stream
  POST /v1/chat         → JSON response
"""

import json
import os
import logging
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

# ─── Config ──────────────────────────────────────────────────────────

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEFAULT_MODEL = "anthropic/claude-sonnet-4.6"  
DEFAULT_MAX_TOKENS = 16384
DEFAULT_TEMPERATURE = 0.4

logging.basicConfig(level=logging.INFO, format="[llm-server] %(message)s")
log = logging.getLogger("llm-server")

app = FastAPI(title="Ayles LLM Server", version="1.0.0")

# ─── AsyncOpenAI client (shared) ────────────────────────────────────

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        _client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://ayles.com",
                "X-Title": "Ayles Flow",
            },
        )
    return _client


# ─── Request model ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    model: str = DEFAULT_MODEL
    messages: list[dict]
    tools: Optional[list[dict]] = None
    max_tokens: int = DEFAULT_MAX_TOKENS
    temperature: float = DEFAULT_TEMPERATURE


# ─── Anthropic explicit prompt caching via OpenRouter ────────────────
#
# OpenRouter requires cache_control on content blocks inside messages.
# Top-level cache_control (auto caching) is NOT supported by OpenRouter.
# Max 4 breakpoints. Sliding window strategy:
#   1. System message       → stable prefix, always cached
#   2. Last tool definition → tool specs are static
#   3–4. Last 2 messages with content (any role) → sliding window
#
# Do NOT set provider.order — it disables sticky routing.
#

CACHE_BP = {"type": "ephemeral"}


def _to_content_blocks(text: str, cache: bool = False) -> list[dict]:
    """Convert a string to content block array, optionally with cache_control."""
    block: dict = {"type": "text", "text": text}
    if cache:
        block["cache_control"] = CACHE_BP
    return [block]


def _apply_anthropic_caching(
    messages: list[dict],
    tools: Optional[list[dict]] = None,
) -> tuple[list[dict], Optional[list[dict]]]:
    """
    Explicit cache breakpoints for Anthropic via OpenRouter.
    Max 4 breakpoints. Each marks the end of a cacheable prefix.

    Strategy:
      1. System message       — stable prefix, always cached
      2. Last tool definition — tool specs are static, cache as one block
      3–4. Last 2 messages with string content (any role) — sliding window

    The sliding window ensures that on turn N+1, the previous turn's
    breakpoint becomes a cache READ, and the new last message becomes
    a cache WRITE.
    """
    messages = [m.copy() for m in messages]
    tools = [{**t} for t in tools] if tools else None
    bp = 0

    # 1. System message
    for msg in messages:
        if msg.get("role") != "system" or bp >= 4:
            continue
        content = msg.get("content")
        if isinstance(content, str):
            msg["content"] = _to_content_blocks(content, cache=True)
            bp += 1
        elif isinstance(content, list):
            content = [({**b} if isinstance(b, dict) else b) for b in content]
            msg["content"] = content
            for i in range(len(content) - 1, -1, -1):
                if isinstance(content[i], dict) and content[i].get("type") == "text":
                    content[i]["cache_control"] = CACHE_BP
                    bp += 1
                    break

    # 2. Last tool definition (caches the entire tools array as one prefix)
    if tools and bp < 4:
        last = tools[-1]
        if "function" in last:
            last["function"] = {**last["function"], "cache_control": CACHE_BP}
            bp += 1

    # 3. Last 2 messages with string content (any role — user, tool, assistant)
    tagged = 0
    for msg in reversed(messages):
        if tagged >= 2 or bp >= 4:
            break
        if msg.get("role") == "system":
            continue  # already handled

        content = msg.get("content")
        if content is None:
            continue  # assistant msgs with only tool_calls have null content

        if isinstance(content, str):
            msg["content"] = _to_content_blocks(content, cache=True)
            bp += 1
            tagged += 1
        elif isinstance(content, list):
            content = [({**b} if isinstance(b, dict) else b) for b in content]
            msg["content"] = content
            for i in range(len(content) - 1, -1, -1):
                if isinstance(content[i], dict) and content[i].get("type") == "text":
                    content[i]["cache_control"] = CACHE_BP
                    bp += 1
                    tagged += 1
                    break

    log.info(f"  cache: {bp} breakpoints (system, tools={'Y' if tools and bp > 1 else 'N'}, msgs×{tagged})")
    return messages, tools


# ─── Streaming endpoint ──────────────────────────────────────────────

@app.post("/v1/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Streaming chat completion → NDJSON lines matching LLMStreamEvent.
    """
    client = get_client()
    is_anthropic = req.model.startswith("anthropic/")

    if is_anthropic:
        messages, tools = _apply_anthropic_caching(req.messages, req.tools)
    else:
        messages, tools = req.messages, req.tools

    log.info(f"stream → {req.model} | {len(req.messages)} msgs | tools={len(tools) if tools else 0}")

    async def generate():
        try:
            stream = await client.chat.completions.create(
                model=req.model,
                messages=messages,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                stream=True,
                stream_options={"include_usage": True},
                tools=tools if tools else None,
                parallel_tool_calls=True if req.tools else None,
            )

            tool_calls_in_progress: dict[int, dict] = {}
            # Accumulate reasoning from streaming chunks.
            # OpenRouter returns reasoning in delta.model_extra as either:
            #   - reasoning_content / reasoning (string) — Kimi native / OpenRouter alias
            #   - reasoning_details (array of {type, text, ...}) — OpenRouter normalized
            # The SDK's ChoiceDelta has no native reasoning fields — extras go to model_extra.
            # IMPORTANT: both formats may carry the SAME text, so only use one per chunk.
            reasoning_content = ""
            reasoning_details: list[dict] = []

            async for chunk in stream:
                # Log usage info (comes in final chunk or separate chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    u = chunk.usage
                    cached_tokens = 0
                    if hasattr(u, 'prompt_tokens_details') and u.prompt_tokens_details:
                        cached_tokens = getattr(u.prompt_tokens_details, 'cached_tokens', 0)
                    log.info(f"  usage: prompt={u.prompt_tokens} completion={u.completion_tokens} cached={cached_tokens}")

                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = choice.delta
                finish_reason = choice.finish_reason

                # Reasoning content (Kimi K2.5, DeepSeek R1, etc.)
                # Stream each chunk immediately so the frontend can display it progressively.
                if delta:
                    extras = getattr(delta, "model_extra", None) or {}
                    rc_chunk = ""

                    # Prefer string form (reasoning_content / reasoning)
                    rc = extras.get("reasoning_content") or extras.get("reasoning")
                    if rc and isinstance(rc, str):
                        rc_chunk = rc
                    # Fall back to reasoning_details array (extract text)
                    elif extras.get("reasoning_details"):
                        rd = extras["reasoning_details"]
                        if isinstance(rd, list):
                            for item in rd:
                                if isinstance(item, dict):
                                    reasoning_details.append(item)
                                    if item.get("text"):
                                        rc_chunk += item["text"]

                    if rc_chunk:
                        reasoning_content += rc_chunk
                        yield json.dumps({"type": "reasoning", "content": rc_chunk}) + "\n"

                # Content
                if delta and delta.content:
                    yield json.dumps({"type": "content", "content": delta.content}) + "\n"

                # Tool calls
                if delta and delta.tool_calls:
                    for tc in delta.tool_calls:
                        index = tc.index

                        if tc.id:
                            tool_calls_in_progress[index] = {
                                "id": tc.id,
                                "name": tc.function.name if tc.function else "",
                                "args": tc.function.arguments if tc.function else "",
                            }
                            yield json.dumps({
                                "type": "tool_start",
                                "index": index,
                                "id": tc.id,
                                "name": tc.function.name if tc.function else "",
                            }) + "\n"
                        else:
                            existing = tool_calls_in_progress.get(index)
                            if existing and tc.function:
                                if tc.function.name:
                                    existing["name"] += tc.function.name
                                if tc.function.arguments:
                                    existing["args"] += tc.function.arguments
                                    yield json.dumps({
                                        "type": "tool_delta",
                                        "index": index,
                                        "id": existing["id"],
                                        "args": tc.function.arguments,
                                    }) + "\n"

                # Finish — include reasoning if any was captured
                if finish_reason == "stop":
                    evt: dict = {"type": "done", "finishReason": "stop"}
                    if reasoning_content or reasoning_details:
                        evt["reasoningContent"] = reasoning_content
                        if reasoning_details:
                            evt["reasoningDetails"] = reasoning_details
                    yield json.dumps(evt) + "\n"
                elif finish_reason == "tool_calls":
                    evt = {
                        "type": "tool_complete",
                        "toolCalls": list(tool_calls_in_progress.values()),
                        "finishReason": "tool_calls",
                    }
                    if reasoning_content or reasoning_details:
                        evt["reasoningContent"] = reasoning_content
                        if reasoning_details:
                            evt["reasoningDetails"] = reasoning_details
                    yield json.dumps(evt) + "\n"
                elif finish_reason == "length":
                    if tool_calls_in_progress:
                        evt = {
                            "type": "tool_complete",
                            "toolCalls": list(tool_calls_in_progress.values()),
                            "finishReason": "length",
                        }
                        if reasoning_content or reasoning_details:
                            evt["reasoningContent"] = reasoning_content
                            if reasoning_details:
                                evt["reasoningDetails"] = reasoning_details
                        yield json.dumps(evt) + "\n"
                    else:
                        evt = {"type": "done", "finishReason": "length"}
                        if reasoning_content or reasoning_details:
                            evt["reasoningContent"] = reasoning_content
                            if reasoning_details:
                                evt["reasoningDetails"] = reasoning_details
                        yield json.dumps(evt) + "\n"

        except Exception as e:
            log.error(f"stream error: {e}")
            yield json.dumps({"type": "error", "error": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


# ─── Non-streaming endpoint ─────────────────────────────────────────

@app.post("/v1/chat")
async def chat(req: ChatRequest):
    """
    Non-streaming chat completion → JSON response.
    """
    client = get_client()
    is_anthropic = req.model.startswith("anthropic/")

    if is_anthropic:
        messages, tools = _apply_anthropic_caching(req.messages, req.tools)
    else:
        messages, tools = req.messages, req.tools

    log.info(f"chat → {req.model} | {len(req.messages)} msgs | tools={len(tools) if tools else 0}")

    try:
        response = await client.chat.completions.create(
            model=req.model,
            messages=messages,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            stream=False,
            tools=tools if tools else None,
            tool_choice="auto" if req.tools else None,
            parallel_tool_calls=True if req.tools else None,
        )

        if response.usage:
            u = response.usage
            cached = getattr(u, 'prompt_tokens_details', None)
            cached_tokens = getattr(cached, 'cached_tokens', 0) if cached else 0
            log.info(f"  usage: prompt={u.prompt_tokens} completion={u.completion_tokens} total={u.total_tokens} cached={cached_tokens}")

        choice = response.choices[0]
        tool_calls = [
            {"id": tc.id, "name": tc.function.name, "args": tc.function.arguments}
            for tc in (choice.message.tool_calls or [])
            if tc.type == "function"
        ]

        return JSONResponse({
            "content": choice.message.content,
            "toolCalls": tool_calls,
            "finishReason": choice.finish_reason or "stop",
        })

    except Exception as e:
        log.error(f"chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "hasApiKey": bool(OPENROUTER_API_KEY)}
