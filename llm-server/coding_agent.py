"""
Coding Agent — agentic loop that writes code in E2B sandboxes.

Port of src/data/coding-agent.ts
Endpoints:
  POST /v1/coding/chat → NDJSON streaming response
  WS   /v1/coding/ws   → WebSocket streaming response

Uses llm_client directly — no HTTP self-call.
"""

import asyncio
import json
import re
import os
import time
import logging
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, WebSocket
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import llm_client
from e2b_client import reconnect_sandbox, get_template, get_preview_url
from coding_tools import execute_coding_tool, ToolContext
from r2_client import r2_put_meta
from session_runtime import serve_resumable_websocket
from stream_store import SessionManager

log = logging.getLogger("coding-agent")

router = APIRouter()
session_manager = SessionManager()

# --- Config ---

MAX_TOOL_ROUNDS = 500
CONTINUATION_PROMPT = "You were cut off mid-response. Continue building from where you stopped. Do NOT repeat work already done."
TRUNCATED_WRITE_PROMPT = "Your last tool call was truncated because the file was too large for a single response. The file was NOT written. Continue from where you stopped — write the file now. Do NOT repeat work already done."

JS_TEMPLATES = {
    "vite", "nextjs", "tanstack", "remix", "nuxt", "svelte", "astro",
    "express", "hono", "vite-express", "nextjs-express",
    "vite-convex", "nextjs-convex", "tanstack-convex", "node-base",
}

LSP_DAEMON_PORT = 9222

TEMPLATE_STRUCTURES: dict[str, str] = {
    "nextjs": """## What's Already In Your Sandbox

**Framework**: Next.js (App Router, TypeScript, Tailwind CSS, ESLint)
**Scaffolded with**: create-next-app (--app --src-dir --import-alias '@/*')

**Pre-installed packages**:
- clsx, tailwind-merge, class-variance-authority, lucide-react
- shadcn/ui — ALL components pre-installed in `components/ui/`

**File structure**:
```
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  lib/
    utils.ts
components/
  ui/             ← ALL shadcn components
public/
package.json
tsconfig.json
next.config.ts
components.json
```

**IMPORTANT**:
- shadcn/ui components ALREADY EXIST. NEVER recreate them, NEVER edit files in `components/ui/`.
- Tailwind is already configured.
- NEVER run scaffolding commands (`create-next-app`, `npm init`, `npx shadcn init`, etc.)
- Port: 3000, Dev command: npm run dev""",
    "nextjs-convex": """## What's Already In Your Sandbox

**Framework**: Next.js (App Router, TypeScript, Tailwind CSS) + Convex backend
**Scaffolded with**: create-next-app + convex

**Pre-installed packages**:
- convex (real-time database, auth, file storage, serverless functions)
- clsx, tailwind-merge, class-variance-authority, lucide-react
- shadcn/ui — ALL components pre-installed in `components/ui/`

**File structure**:
```
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  lib/
    utils.ts
components/
  ui/              ← ALL shadcn components
convex/
  _generated/      ← auto-generated (DO NOT EDIT)
  schema.ts
public/
package.json
tsconfig.json
next.config.ts
components.json
```

**IMPORTANT**:
- Convex IS the backend. Write schema in `convex/schema.ts`, queries/mutations in `convex/*.ts`.
- Run `npx convex dev --once` after schema changes.
- shadcn/ui components ALREADY EXIST. Just import them.
- NEVER run scaffolding commands.
- Port: 3000, Dev command: npm run dev""",
}

PERSONA_CORE_SKILL: dict[str, str] = {
    "frontend": "frontend-design",
    "backend": "backend-dev",
}

# Maps template → essentials skill to auto-embed in system prompt (cached)
# instead of loading at runtime (which pollutes context on every round)
TEMPLATE_ESSENTIALS_SKILL: dict[str, list[str]] = {
    "nextjs": ["nextjs-essentials"],
    "nextjs-express": ["nextjs-essentials"],
    "nextjs-convex": ["nextjs-convex-essentials"],
    "vite": ["vite-react-fundamentals"],
    "vite-express": ["vite-react-fundamentals"],
    "vite-convex": ["vite-react-fundamentals", "convex"],
    "tanstack": ["vite-react-fundamentals"],
    "tanstack-convex": ["vite-react-fundamentals", "convex"],
}




# --- Request model ---

class CodingChatRequest(BaseModel):
    messages: list[dict]
    sandbox_id: str
    project_id: str
    persona: str  # frontend | backend | tester
    agent_model: Optional[str] = None
    template_name: Optional[str] = None


# --- LSP bridge ---

def _start_lsp_daemon(sandbox, template_name: Optional[str], workdir: str) -> Optional[int]:
    """Start LSP daemon in sandbox. Already baked into templates. Returns port if running."""
    if template_name and template_name not in JS_TEMPLATES:
        return None

    try:
        # Check if daemon is already running
        check = sandbox.commands.run(
            f"curl -s -m 2 http://127.0.0.1:{LSP_DAEMON_PORT}/health 2>/dev/null",
            timeout=5,
        )
        if check.exit_code == 0 and '"ok"' in check.stdout:
            log.info(f"[lsp] daemon already running on port {LSP_DAEMON_PORT}")
            return LSP_DAEMON_PORT

        # Daemon script is baked into templates at .lsp/daemon.mjs
        daemon_path = f"{workdir}.lsp/daemon.mjs"
        check = sandbox.commands.run(f"test -f {daemon_path} && echo 1 || echo 0", timeout=5)
        if check.stdout.strip() != "1":
            log.info("[lsp] daemon script not found in template — skipping")
            return None

        # Start the daemon (npm global bin not in default PATH)
        sandbox.commands.run(
            f"nohup env PATH=/home/user/.npm-global/bin:/usr/local/bin:/usr/bin:/bin node {daemon_path} {workdir} > /tmp/lsp-daemon.log 2>&1 &",
            timeout=10,
        )

        # Wait for it to become healthy
        for _ in range(10):
            time.sleep(0.5)
            check = sandbox.commands.run(
                f"curl -s -m 2 http://127.0.0.1:{LSP_DAEMON_PORT}/health 2>/dev/null",
                timeout=5,
            )
            if check.exit_code == 0 and '"ok"' in check.stdout:
                log.info(f"[lsp] daemon started on port {LSP_DAEMON_PORT}")
                # Pre-warm: query an existing file to boot the TS server now
                # (cold start takes ~7s, subsequent queries ~1s)
                sandbox.commands.run(
                    f"nohup curl -s -m 15 'http://127.0.0.1:{LSP_DAEMON_PORT}/diagnostics?file={workdir}src/app/page.tsx' > /dev/null 2>&1 &",
                    timeout=5,
                )
                return LSP_DAEMON_PORT

        log.warning("[lsp] daemon failed to start within timeout")
        return None
    except Exception as e:
        log.warning(f"[lsp] daemon error: {e}")
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

    structure = TEMPLATE_STRUCTURES.get(template_name)
    if structure:
        parts.append(f"\n\n{structure}")
    else:
        parts.append(
            f"\n\n--- ENVIRONMENT ---\nTemplate: {template_name}\nWorking directory: {workdir}\nDev command: {dev_cmd}\nDefault port: {default_port}"
        )

    # 3. Core persona skill (embedded to reduce startup rounds)
    core_skill_name = PERSONA_CORE_SKILL.get(persona)
    if core_skill_name:
        core_skill = _load_skill_content(base_dir, core_skill_name)
        if core_skill:
            parts.append(f"\n\n--- {core_skill_name.upper()} ---\n\n{core_skill}")

    # 4. Fast-start reminder
    parts.append(
        "\n\n--- FAST START ---\nThe template scaffold is already known. Do NOT call workspace_info() for broad exploration. Read project.md, load only needed framework skills, then start writing code."
    )

    # 5. Available skills list
    skills = _list_available_skills(base_dir)
    if skills:
        skill_lines = "\n".join(f"- `{name}`: {desc}" for name, desc in skills)
        parts.append(
            f'\n\n--- AVAILABLE SKILLS ---\nUse load_skill("name") to load focused guidance:\n{skill_lines}'
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


def _list_available_skills(base_dir: str) -> list[tuple[str, str]]:
    skills_dir = os.path.join(base_dir, "skills")
    if not os.path.isdir(skills_dir):
        return []

    out: list[tuple[str, str]] = []
    for root, _, files in os.walk(skills_dir):
        for f in files:
            if not f.endswith(".md") or f == "index.md":
                continue
            path = os.path.join(root, f)
            with open(path) as fh:
                content = fh.read()
            frontmatter = re.match(r"^---\n([\s\S]*?)\n---\n", content)
            desc = ""
            if frontmatter:
                m = re.search(r"^description:\s*(.+)$", frontmatter.group(1), re.MULTILINE)
                if m:
                    desc = m.group(1).strip()
            name = f.replace(".md", "").replace("_", "-")
            out.append((name, desc or "No description"))

    out.sort(key=lambda x: x[0])
    return out


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

        template = get_template(req.template_name or "vite")
        workdir = template.workdir if template else "/home/user/app"

        # 2. Start LSP daemon (baked into templates)
        lsp_port = _start_lsp_daemon(sandbox, req.template_name, workdir)
        if lsp_port:
            log.info(f"[coding:{req.persona}] LSP daemon on port {lsp_port}")

        # Tool context — events are collected and yielded by the generator
        # Uses thread-safe queue so tool calls can run in parallel threads
        import queue
        event_queue: queue.Queue = queue.Queue()

        def emit_event(event: dict):
            event_queue.put(event)

        tool_ctx = ToolContext(
            write=emit_event,
            lsp_port=lsp_port,
            project_id=req.project_id,
            workdir=workdir + "/" if not workdir.endswith("/") else workdir,
            template_name=req.template_name or "",
            persona=req.persona,
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
            _partial_args: dict[int, str] = {}
            _path_sent: set[int] = set()

            # Stream LLM call directly via llm_client (no HTTP self-call)
            async for event in llm_client.stream_chat(
                messages,
                model=model,
                tools=coding_tools if coding_tools else None,
                max_tokens=16384,
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
                    tool_name = event.get("name", "")
                    if tool_name not in ("load_skill",):
                        yield {"type": "tool_start", "tool": tool_name, "index": event.get("index")}

                elif etype == "tool_delta":
                    # Try to extract file path from streamed args early
                    idx = event.get("index")
                    args_chunk = event.get("args", "")
                    if idx is not None:
                        _partial_args[idx] = _partial_args.get(idx, "") + args_chunk
                        partial = _partial_args[idx]
                        # Once we have "path":"...", extract and send to frontend
                        if idx not in _path_sent:
                            m = re.search(r'"path"\s*:\s*"([^"]+)"', partial)
                            if m:
                                _path_sent.add(idx)
                                file_path = re.sub(r"^/home/user/app/", "", m.group(1))
                                yield {"type": "tool_path", "index": idx, "path": file_path}

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
            truncated_tool_name = ""
            if finish_reason == "length" and completed_calls:
                last = completed_calls[-1]
                try:
                    json.loads(last["args"])
                except (json.JSONDecodeError, KeyError):
                    truncated_tool_name = last.get("name", "")
                    log.warning(f"[coding:{req.persona}] dropping truncated tool call: {truncated_tool_name}")
                    completed_calls.pop()

            # No tool calls — check if we should continue or exit
            if not completed_calls:
                pending = _has_pending_tasks(text)
                if finish_reason == "length" or pending:
                    messages.append({"role": "assistant", "content": text or ""})
                    prompt = TRUNCATED_WRITE_PROMPT if truncated_tool_name in ("write", "edit", "multi_edit") else CONTINUATION_PROMPT
                    messages.append({"role": "user", "content": prompt})
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

            # Execute tool calls sequentially (E2B sync SDK httpx.Client is not thread-safe)
            HIDDEN_TOOLS = {"load_skill"}
            HIDDEN_EVENTS = {"skill_loaded"}

            for tc in completed_calls:
                args = _safe_parse_json(tc["args"])
                result = execute_coding_tool(sandbox, tc["name"], args, tool_ctx)

                if tc["name"] not in HIDDEN_TOOLS:
                    yield {"type": "tool_call", "tool": tc["name"], "args": _strip_large_args(args)}

                # Drain any events from tool execution
                while not event_queue.empty():
                    evt = event_queue.get_nowait()
                    if evt.get("type") not in HIDDEN_EVENTS:
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


@router.websocket("/v1/coding/ws")
async def coding_chat_ws(websocket: WebSocket):
    """Coding agent loop — resumable WebSocket streaming response."""
    from main import check_websocket_origin
    if not check_websocket_origin(websocket):
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    await serve_resumable_websocket(
        websocket,
        session_manager=session_manager,
        request_model=CodingChatRequest,
        event_stream_factory=coding_agent_loop,
        log=log,
        stream_label="coding",
        error_event_factory=lambda message: {"type": "error", "message": message},
        cancelled_event_factory=lambda: {
            "type": "error",
            "message": "Request cancelled — client disconnected",
        },
    )


class StreamRequest(BaseModel):
    streamId: str


@router.get("/v1/coding/stream/{stream_id}")
async def stream_status(stream_id: str):
    state = session_manager.get(stream_id)
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


@router.post("/v1/coding/cancel")
async def cancel_stream(req: StreamRequest):
    state = session_manager.get(req.streamId)
    if not state:
        return JSONResponse({"ok": False, "reason": "not found"})
    state.cancel()
    log.info(f"[coding] Cancelled stream {req.streamId}")
    return JSONResponse({"ok": True})
