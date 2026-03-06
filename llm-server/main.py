"""
LLM Server — OpenAI SDK wrapper for OpenRouter.

Single source of truth for all LLM communication.
Uses llm_client module for all OpenRouter interaction.

Endpoints:
  POST /v1/chat/stream  → NDJSON stream
  WS   /v1/chat/ws      → WebSocket stream
  POST /v1/chat         → JSON response
"""

import json
import logging
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import llm_client
from session_runtime import serve_resumable_websocket
from stream_store import SessionManager

# ─── Config ──────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[llm-server] %(message)s")
log = logging.getLogger("llm-server")

app = FastAPI(title="Ayles LLM Server", version="1.0.0")
chat_session_manager = SessionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.websocket("/v1/chat/ws")
async def chat_stream_ws(websocket: WebSocket):
    """Streaming chat endpoint over resumable WebSocket."""
    async def chat_event_stream(req: ChatRequest):
        async for event in llm_client.stream_chat(
            req.messages,
            model=req.model,
            tools=req.tools,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        ):
            yield event

    await serve_resumable_websocket(
        websocket,
        session_manager=chat_session_manager,
        request_model=ChatRequest,
        event_stream_factory=chat_event_stream,
        log=log,
        stream_label="chat",
        error_event_factory=lambda message: {"type": "error", "error": message},
        cancelled_event_factory=lambda: {"type": "error", "error": "Request cancelled"},
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


class StreamRequest(BaseModel):
    streamId: str


@app.get("/v1/chat/stream/{stream_id}")
async def chat_stream_status(stream_id: str):
    state = chat_session_manager.get(stream_id)
    if not state:
        return JSONResponse({"exists": False})
    return JSONResponse(
        {
            "exists": True,
            "done": state.done,
            "eventCount": len(state.events),
            "connected": state.connected,
            "nextSeq": state.next_seq,
        },
    )


@app.post("/v1/chat/cancel")
async def cancel_chat_stream(req: StreamRequest):
    state = chat_session_manager.get(req.streamId)
    if not state:
        return JSONResponse({"ok": False, "reason": "not found"})
    state.cancel()
    log.info(f"chat stream cancelled {req.streamId}")
    return JSONResponse({"ok": True})


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
