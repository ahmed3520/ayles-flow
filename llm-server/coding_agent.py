"""
Coding Agent — agentic loop that writes code in E2B sandboxes.

Port of src/data/coding-agent.ts
Endpoint: POST /v1/coding/chat → NDJSON streaming response

Uses llm_client directly — no HTTP self-call.
"""

import asyncio
import json
import re
import os
import time
import logging
from typing import Optional, AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import llm_client
from e2b_client import reconnect_sandbox, get_template, get_preview_url
from coding_tools import execute_coding_tool, ToolContext
from r2_client import r2_put_meta

log = logging.getLogger("coding-agent")

router = APIRouter()

# --- Config ---

MAX_TOOL_ROUNDS = 500
CONTINUATION_PROMPT = "You were cut off mid-response. Continue building from where you stopped. Do NOT repeat work already done."

JS_TEMPLATES = {
    "vite", "nextjs", "tanstack", "remix", "nuxt", "svelte", "astro",
    "express", "hono", "vite-express", "nextjs-express",
    "vite-convex", "nextjs-convex", "tanstack-convex", "node-base",
}

LSP_BRIDGE_PATH = "/tmp/lsp-bridge.mjs"
LSP_BRIDGE_PORT = 7998

_lsp_bridge_script: Optional[str] = None


def _get_lsp_bridge_script() -> Optional[str]:
    global _lsp_bridge_script
    if _lsp_bridge_script is not None:
        return _lsp_bridge_script
    script_path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "lsp-bridge-script.ts")
    if not os.path.exists(script_path):
        _lsp_bridge_script = ""
        return ""
    _lsp_bridge_script = ""
    return ""


# --- Request model ---

class CodingChatRequest(BaseModel):
    messages: list[dict]
    sandbox_id: str
    project_id: str
    persona: str  # frontend | backend | tester
    agent_model: Optional[str] = None
    template_name: Optional[str] = None


# --- LSP bridge ---

def _start_lsp_bridge(sandbox, template_name: Optional[str]) -> Optional[int]:
    """Start LSP bridge in sandbox. Returns port if successful, None otherwise."""
    if template_name and template_name not in JS_TEMPLATES:
        return None

    try:
        # Check if the bridge script exists in the sandbox
        check = sandbox.commands.run(f"test -f {LSP_BRIDGE_PATH} && echo 1 || echo 0", timeout=5)
        if check.stdout.strip() != "1":
            # LSP bridge script not deployed to sandbox — skip silently
            return None

        sandbox.commands.run(
            "which typescript-language-server >/dev/null 2>&1 || npm install -g typescript-language-server typescript 2>/dev/null",
            timeout=30,
        )
        sandbox.commands.run(
            f"node {LSP_BRIDGE_PATH} > /tmp/lsp-bridge.log 2>&1 &",
            timeout=5,
        )
        for _ in range(15):
            time.sleep(0.5)
            check = sandbox.commands.run(
                f"curl -s http://localhost:{LSP_BRIDGE_PORT}/health 2>/dev/null",
            )
            if check.exit_code == 0 and '"ok"' in check.stdout:
                return LSP_BRIDGE_PORT

        log.warning("LSP bridge failed to start within timeout")
        return None
    except Exception as e:
        log.warning(f"LSP bridge error: {e}")
        return None


# --- Prompt builder ---

def _build_system_prompt(persona: str, template_name: str, model: Optional[str] = None) -> str:
    parts = []
    base_dir = os.path.join(os.path.dirname(__file__), "..", "server", "agents")

    # 1. Persona prompt
    is_openai = model and model.startswith("openai/")
    prompt_variants = []
    if is_openai:
        prompt_variants.append(f"{persona}-openai")
    prompt_variants.append(persona)

    for variant in prompt_variants:
        prompt_path = os.path.join(base_dir, "prompts", f"{variant}.md")
        if os.path.exists(prompt_path):
            with open(prompt_path) as f:
                content = f.read()
            m = re.match(r"^---\n[\s\S]*?\n---\n([\s\S]*)$", content)
            parts.append(m.group(1).strip() if m else content)
            break

    # 2. Template structure
    template = get_template(template_name)
    workdir = template.workdir if template else "/home/user/app"
    dev_cmd = template.dev_cmd if template else "npm run dev"
    default_port = template.default_port if template else 3000

    parts.append(
        f"\n\n--- ENVIRONMENT ---\nTemplate: {template_name}\nWorking directory: {workdir}\nDev command: {dev_cmd}\nDefault port: {default_port}"
    )

    return "".join(parts)


def _load_skill_content(base_dir: str, name: str) -> Optional[str]:
    skills_dir = os.path.join(base_dir, "skills")
    if not os.path.isdir(skills_dir):
        return None
    for root, _, files in os.walk(skills_dir):
        for f in files:
            if not f.endswith(".md") or f == "index.md":
                continue
            fname = f.replace(".md", "").replace("_", "-")
            if fname == name:
                with open(os.path.join(root, f)) as fh:
                    content = fh.read()
                m = re.match(r"^---\n[\s\S]*?\n---\n([\s\S]*)$", content)
                return m.group(1).strip() if m else content
    return None


# --- Tool definitions ---

def _get_coding_tools() -> list[dict]:
    tools_path = os.path.join(os.path.dirname(__file__), "coding_tool_defs.json")
    if os.path.exists(tools_path):
        with open(tools_path) as f:
            return json.load(f)
    return []


# --- Utils ---

def _safe_parse_json(s: str) -> dict:
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return {}


LARGE_ARG_KEYS = {"content", "projectSpec", "markdown", "old_string", "new_string", "edits"}


def _strip_large_args(args: dict) -> dict:
    out = {}
    for k, v in args.items():
        if k in LARGE_ARG_KEYS:
            if isinstance(v, str):
                out[k] = f"[{len(v)} chars]"
            elif isinstance(v, list):
                out[k] = f"[{len(v)} items]"
            continue
        if k == "path" and isinstance(v, str):
            out[k] = re.sub(r"^/home/user/app/", "", v)
        else:
            out[k] = v
    return out


def _has_pending_tasks(text: str) -> bool:
    return bool(re.search(r"\[ \]", text) and re.search(r"\[→\]|\[x\]", text, re.IGNORECASE))


# --- Core loop (callable by orchestrator or endpoint) ---

async def coding_agent_loop(req: CodingChatRequest) -> AsyncGenerator[dict, None]:
    """Core coding agent loop — yields NDJSON events as dicts."""
    model = req.agent_model or "anthropic/claude-sonnet-4.6"
    coding_tools = _get_coding_tools()

    try:
        # 1. Connect to sandbox
        sandbox, _ = reconnect_sandbox(req.sandbox_id)
        yield {"type": "sandbox_status", "status": "ready", "sandboxId": req.sandbox_id}

        # 2. Start LSP bridge
        lsp_port = _start_lsp_bridge(sandbox, req.template_name)
        if lsp_port:
            log.info(f"[coding:{req.persona}] LSP bridge on port {lsp_port}")

        template = get_template(req.template_name or "vite")
        workdir = template.workdir if template else "/home/user/app"

        # Tool context — events are collected and yielded by the generator
        event_queue: asyncio.Queue = asyncio.Queue()

        async def emit_event(event: dict):
            await event_queue.put(event)

        tool_ctx = ToolContext(
            write=emit_event,
            lsp_port=lsp_port,
            project_id=req.project_id,
            workdir=workdir + "/" if not workdir.endswith("/") else workdir,
        )

        yield {"type": "agent_start", "persona": req.persona}

        # 3. Build messages
        system_prompt = _build_system_prompt(req.persona, req.template_name or "unknown", req.agent_model)
        messages = [
            {"role": "system", "content": system_prompt},
            *[{"role": m["role"], "content": m["content"]} for m in req.messages],
        ]

        # 4. Agentic loop
        exit_reason = "max_rounds"

        for round_num in range(MAX_TOOL_ROUNDS):
            text = ""
            completed_calls = []
            finish_reason = ""
            reasoning_content = ""
            reasoning_details = None

            # Stream LLM call directly via llm_client (no HTTP self-call)
            async for event in llm_client.stream_chat(
                messages,
                model=model,
                tools=coding_tools if coding_tools else None,
                max_tokens=8192,
                temperature=0.4,
            ):
                etype = event.get("type")

                if etype == "content":
                    text += event["content"]
                    yield {"type": "text_delta", "content": event["content"]}

                elif etype == "reasoning":
                    reasoning_content += event["content"]
                    yield {"type": "reasoning", "content": event["content"]}

                elif etype == "ping":
                    yield {"type": "ping"}

                elif etype == "tool_start":
                    yield {"type": "tool_start", "tool": event.get("name", "")}

                elif etype == "tool_complete":
                    completed_calls = event.get("toolCalls", [])
                    finish_reason = event.get("finishReason", "tool_calls")
                    if event.get("reasoningDetails"):
                        reasoning_details = event["reasoningDetails"]

                elif etype == "done":
                    finish_reason = event.get("finishReason", "stop")
                    if event.get("reasoningDetails"):
                        reasoning_details = event["reasoningDetails"]

                elif etype == "error":
                    raise RuntimeError(event.get("error", "LLM error"))

            # Drop truncated tool call when cut off by max_tokens
            if finish_reason == "length" and completed_calls:
                last = completed_calls[-1]
                try:
                    json.loads(last["args"])
                except (json.JSONDecodeError, KeyError):
                    log.warning(f"[coding:{req.persona}] dropping truncated tool call: {last.get('name')}")
                    completed_calls.pop()

            # No tool calls — check if we should continue or exit
            if not completed_calls:
                pending = _has_pending_tasks(text)
                if finish_reason == "length" or pending:
                    messages.append({"role": "assistant", "content": text or ""})
                    messages.append({"role": "user", "content": CONTINUATION_PROMPT})
                    continue
                exit_reason = f"no_tool_calls:{finish_reason}"
                break

            log.info(f"[coding:{req.persona}] round {round_num}: {len(completed_calls)} tool(s): {[tc['name'] for tc in completed_calls]}")

            # Push assistant message — include reasoning fields for models that require them
            # (Kimi K2.5, DeepSeek R1, etc. reject messages without reasoning_content)
            assistant_msg = {
                "role": "assistant",
                "content": text or None,
                "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["args"]}}
                    for tc in completed_calls
                ],
            }
            if reasoning_content:
                assistant_msg["reasoning_content"] = reasoning_content
            if reasoning_details:
                assistant_msg["reasoning_details"] = reasoning_details
            messages.append(assistant_msg)

            # Execute tool calls
            for tc in completed_calls:
                args = _safe_parse_json(tc["args"])
                result = await execute_coding_tool(sandbox, tc["name"], args, tool_ctx)

                yield {"type": "tool_call", "tool": tc["name"], "args": _strip_large_args(args)}

                # Drain any events from tool execution
                while not event_queue.empty():
                    evt = event_queue.get_nowait()
                    yield evt

                if result.expired:
                    yield {"type": "error", "message": "Sandbox expired."}
                    return

                tool_content = (
                    (result.result if isinstance(result.result, str) else json.dumps(result.result))
                    if result.success
                    else json.dumps({"success": False, "error": result.error})
                )

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_content,
                })

        log.info(f"[coding:{req.persona}] DONE — {exit_reason}, {len(messages)} messages")

        # Save R2 metadata
        try:
            r2_put_meta(req.project_id, {
                "templateName": req.template_name or "vite",
                "lastSync": int(time.time() * 1000),
            })
        except Exception:
            pass

        yield {"type": "agent_done", "persona": req.persona}
        yield {"type": "done"}

    except asyncio.CancelledError:
        log.warning(f"[coding:{req.persona}] CANCELLED — client disconnected or timeout (round in progress, {len(messages)} msgs)")
        yield {"type": "error", "message": "Request cancelled — client disconnected"}
    except GeneratorExit:
        log.warning(f"[coding:{req.persona}] GENERATOR EXIT — client disconnected (round in progress, {len(messages)} msgs)")
        return
    except Exception as e:
        log.error(f"[coding:{req.persona}] ERROR: {e}")
        yield {"type": "error", "message": str(e)}


# --- Endpoint ---

@router.post("/v1/coding/chat")
async def coding_chat(req: CodingChatRequest):
    """Coding agent loop — NDJSON streaming response."""

    async def generate():
        async for event in coding_agent_loop(req):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )
