"""
Shared LLM Client — single source of truth for all LLM calls.

Used by main.py, coding_agent.py, orchestrator.py, research.py.
All LLM calls go through OpenRouter with Anthropic-style caching.
"""

import json
import os
import logging
from typing import Optional, AsyncGenerator

from openai import AsyncOpenAI

log = logging.getLogger("llm-client")

# --- Config ---

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEFAULT_MODEL = "anthropic/claude-sonnet-4.6"
DEFAULT_MAX_TOKENS = 16384
DEFAULT_TEMPERATURE = 0.4

# --- Singleton client ---

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


# --- Anthropic caching ---

CACHE_BP = {"type": "ephemeral"}


def _to_content_blocks(text: str, cache: bool = False) -> list[dict]:
    block: dict = {"type": "text", "text": text}
    if cache:
        block["cache_control"] = CACHE_BP
    return [block]


def apply_anthropic_caching(
    messages: list[dict],
    tools: Optional[list[dict]] = None,
) -> tuple[list[dict], Optional[list[dict]]]:
    """
    Explicit cache breakpoints for Anthropic via OpenRouter.
    Max 4 breakpoints. Strategy:
      1. System message — stable prefix
      2. Last tool definition — static
      3-4. Last 2 messages with string content — sliding window
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

    # 2. Last tool definition
    if tools and bp < 4:
        last = tools[-1]
        if "function" in last:
            last["function"] = {**last["function"], "cache_control": CACHE_BP}
            bp += 1

    # 3. Last 2 messages with string content
    tagged = 0
    for msg in reversed(messages):
        if tagged >= 2 or bp >= 4:
            break
        if msg.get("role") == "system":
            continue
        content = msg.get("content")
        if content is None:
            continue
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


# --- Streaming chat ---

async def stream_chat(
    messages: list[dict],
    *,
    model: str = DEFAULT_MODEL,
    tools: Optional[list[dict]] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
) -> AsyncGenerator[dict, None]:
    """
    Stream a chat completion. Yields dicts:
    - {"type": "content", "content": "..."}
    - {"type": "reasoning", "content": "..."}
    - {"type": "tool_start", "index": N, "id": "...", "name": "..."}
    - {"type": "tool_delta", "index": N, "id": "...", "args": "..."}
    - {"type": "tool_complete", "toolCalls": [...], "finishReason": "..."}
    - {"type": "done", "finishReason": "..."}
    - {"type": "error", "error": "..."}
    """
    client = get_client()
    is_anthropic = model.startswith("anthropic/")

    if is_anthropic:
        msgs, tls = apply_anthropic_caching(messages, tools)
    else:
        msgs, tls = messages, tools

    log.info(f"stream → {model} | {len(messages)} msgs | tools={len(tls) if tls else 0}")

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=msgs,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
            stream_options={"include_usage": True},
            tools=tls if tls else None,
            parallel_tool_calls=True if tools else None,
        )

        tool_calls_in_progress: dict[int, dict] = {}
        reasoning_content = ""
        reasoning_details: list[dict] = []

        async for chunk in stream:
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

            # Reasoning
            if delta:
                extras = getattr(delta, "model_extra", None) or {}
                rc_chunk = ""
                rc = extras.get("reasoning_content") or extras.get("reasoning")
                if rc and isinstance(rc, str):
                    rc_chunk = rc
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
                    yield {"type": "reasoning", "content": rc_chunk}

            # Content
            if delta and delta.content:
                yield {"type": "content", "content": delta.content}

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
                        yield {
                            "type": "tool_start",
                            "index": index,
                            "id": tc.id,
                            "name": tc.function.name if tc.function else "",
                        }
                    else:
                        existing = tool_calls_in_progress.get(index)
                        if existing and tc.function:
                            if tc.function.name:
                                existing["name"] += tc.function.name
                            if tc.function.arguments:
                                existing["args"] += tc.function.arguments
                                yield {
                                    "type": "tool_delta",
                                    "index": index,
                                    "id": existing["id"],
                                    "args": tc.function.arguments,
                                }

            # Finish
            if finish_reason:
                evt: dict = {}
                if finish_reason == "stop":
                    evt = {"type": "done", "finishReason": "stop"}
                elif finish_reason == "tool_calls":
                    evt = {
                        "type": "tool_complete",
                        "toolCalls": list(tool_calls_in_progress.values()),
                        "finishReason": "tool_calls",
                    }
                elif finish_reason == "length":
                    if tool_calls_in_progress:
                        evt = {
                            "type": "tool_complete",
                            "toolCalls": list(tool_calls_in_progress.values()),
                            "finishReason": "length",
                        }
                    else:
                        evt = {"type": "done", "finishReason": "length"}

                if evt:
                    if reasoning_content or reasoning_details:
                        evt["reasoningContent"] = reasoning_content
                        if reasoning_details:
                            evt["reasoningDetails"] = reasoning_details
                    yield evt

    except Exception as e:
        log.error(f"stream error: {e}")
        yield {"type": "error", "error": str(e)}


# --- Non-streaming chat ---

async def chat(
    messages: list[dict],
    *,
    model: str = DEFAULT_MODEL,
    tools: Optional[list[dict]] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
) -> dict:
    """
    Non-streaming chat completion. Returns:
    {"content": str|None, "toolCalls": [...], "finishReason": str}
    """
    client = get_client()
    is_anthropic = model.startswith("anthropic/")

    if is_anthropic:
        msgs, tls = apply_anthropic_caching(messages, tools)
    else:
        msgs, tls = messages, tools

    log.info(f"chat → {model} | {len(messages)} msgs | tools={len(tls) if tls else 0}")

    response = await client.chat.completions.create(
        model=model,
        messages=msgs,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
        tools=tls if tls else None,
        tool_choice="auto" if tools else None,
        parallel_tool_calls=True if tools else None,
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

    return {
        "content": choice.message.content,
        "toolCalls": tool_calls,
        "finishReason": choice.finish_reason or "stop",
    }
