"""
LLM Server — OpenAI SDK wrapper for OpenRouter.

Single source of truth for all LLM communication.
Uses llm_client module for all OpenRouter interaction.

Endpoints:
  POST /v1/chat/stream  → NDJSON stream
  POST /v1/chat         → JSON response
"""

import json
import logging
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import llm_client

# ─── Config ──────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[llm-server] %(message)s")
log = logging.getLogger("llm-server")

app = FastAPI(title="Ayles LLM Server", version="1.0.0")


# ─── Request model ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    model: str = llm_client.DEFAULT_MODEL
    messages: list[dict]
    tools: Optional[list[dict]] = None
    max_tokens: int = llm_client.DEFAULT_MAX_TOKENS
    temperature: float = llm_client.DEFAULT_TEMPERATURE


# ─── Streaming endpoint ──────────────────────────────────────────────

@app.post("/v1/chat/stream")
async def chat_stream(req: ChatRequest):
    async def generate():
        async for event in llm_client.stream_chat(
            req.messages,
            model=req.model,
            tools=req.tools,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        ):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


# ─── Non-streaming endpoint ─────────────────────────────────────────

@app.post("/v1/chat")
async def chat(req: ChatRequest):
    try:
        result = await llm_client.chat(
            req.messages,
            model=req.model,
            tools=req.tools,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
        return JSONResponse(result)
    except Exception as e:
        log.error(f"chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Agent & Sandbox routers ─────────────────────────────────────────

from coding_agent import router as coding_router
from sandbox_sync import router as sync_router
from orchestrator import router as orchestrator_router

app.include_router(coding_router)
app.include_router(sync_router)
app.include_router(orchestrator_router)


# ─── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "hasApiKey": bool(llm_client.OPENROUTER_API_KEY)}
