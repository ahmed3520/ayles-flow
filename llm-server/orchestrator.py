"""
Orchestrator Agent — master agent that manages the canvas, research, and coding.

Port of src/data/agent.ts
Endpoints:
  POST /v1/agent/chat → NDJSON streaming response
  WS   /v1/agent/ws   → WebSocket streaming response

Uses llm_client directly for LLM calls.
Calls coding_agent_loop directly for sub-agent dispatch (no HTTP).
"""

import asyncio
import json
import os
import re
import logging
import uuid
from collections import Counter
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from stream_store import SessionManager

import llm_client
from e2b_client import create_sandbox, reconnect_sandbox, get_preview_url, get_template, is_convex_template
from coding_agent import coding_agent_loop, CodingChatRequest
from groq_web import groq_web
from research import deep_research

log = logging.getLogger("orchestrator")

router = APIRouter()
session_manager = SessionManager()

MAX_TOOL_ROUNDS = 500
CONTINUATION_PROMPT = "You were cut off mid-response. Continue building from where you stopped. Do NOT repeat work already done."


# --- Request model ---

class CanvasNode(BaseModel):
    id: str
    contentType: str
    label: str
    prompt: str
    model: str
    generationStatus: str
    resultUrl: Optional[str] = None
    x: float
    y: float


class CanvasEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class AvailableModel(BaseModel):
    falId: str
    name: str
    provider: str
    contentType: str
    inputs: list[dict]
    outputType: str


class AgentChatRequest(BaseModel):
    messages: list[dict]
    canvasState: dict  # {"nodes": [...], "edges": [...]}
    models: list[dict]
    agentModel: Optional[str] = None
    projectId: str


# --- Virtual state ---

class VirtualState:
    def __init__(self, nodes: list[dict], edges: list[dict]):
        self.nodes = [dict(n) for n in nodes]
        self.edges = [dict(e) for e in edges]
        max_num = 0
        for n in self.nodes:
            m = re.match(r"^node-(\d+)$", n.get("id", ""))
            if m:
                max_num = max(max_num, int(m.group(1)))
        self.next_node_id = max_num + 1
        self.next_edge_id = len(edges) + 1
        self.sandbox_id: Optional[str] = None
        self.template_name: Optional[str] = None
        self.preview_url: Optional[str] = None
        self.has_website_node = any(n.get("contentType") == "website" for n in self.nodes)


def _format_canvas_state(state: VirtualState) -> str:
    if not state.nodes:
        return "Canvas is empty — no nodes or edges."
    node_lines = []
    for n in state.nodes:
        parts = [f"- {n['id']}: type={n['contentType']}"]
        parts.append(f'label="{n.get("label", "")}"')
        parts.append(f"pos=({n.get('x', 0)}, {n.get('y', 0)})")
        if n.get("model"):
            parts.append(f'model="{n["model"]}"')
        if n.get("prompt"):
            parts.append(f'prompt="{n["prompt"]}"')
        parts.append(f"status={n.get('generationStatus', 'idle')}")
        if n.get("resultUrl"):
            parts.append("[HAS RESULT - can be connected as input to other nodes]")
        node_lines.append(" | ".join(parts))

    edge_lines = (
        [f"- {e['id']}: {e['source']} → {e['target']} ({e.get('sourceHandle', '')} → {e.get('targetHandle', '')})" for e in state.edges]
        if state.edges else ["(no connections)"]
    )
    return f"Nodes ({len(state.nodes)}):\n" + "\n".join(node_lines) + f"\n\nEdges ({len(state.edges)}):\n" + "\n".join(edge_lines)


def _format_models(models: list[dict], content_type: Optional[str] = None) -> str:
    filtered = [m for m in models if m.get("contentType") == content_type] if content_type else models

    def fmt(m):
        inputs = ", ".join(
            f"{i.get('type', '?')}{'(required)' if i.get('required') else '(optional)'}"
            for i in m.get("inputs", [])
        )
        return f'  - "{m.get("name", "")}" falId="{m.get("falId", "")}" | inputs: [{inputs}] → output: {m.get("outputType", "?")}'

    groups = [
        ("Text → Image", "image", False),
        ("Image → Image (editing/variations)", "image", True),
        ("Text → Video", "video", False),
        ("Image → Video (animate image)", "video", True),
        ("Audio / TTS", "audio", None),
        ("Music", "music", None),
    ]
    sections = []
    for label, ct, has_img in groups:
        items = [m for m in filtered if m.get("contentType") == ct]
        if has_img is not None:
            items = [m for m in items if any(i.get("type") == "image" for i in m.get("inputs", [])) == has_img]
        if items:
            sections.append(f"{label}:\n" + "\n".join(fmt(m) for m in items))
    return "\n\n".join(sections)


def _build_runtime_context(state: VirtualState, models: list[dict]) -> str:
    """Compact runtime snapshot to avoid unnecessary discovery tool calls."""
    node_lines = []
    for n in state.nodes[:12]:
        prompt = (n.get("prompt") or "").strip()
        if prompt:
            prompt = prompt[:120] + ("..." if len(prompt) > 120 else "")
        else:
            prompt = "(empty)"
        node_lines.append(
            f"- {n.get('id', '?')} | type={n.get('contentType', '?')} | label={json.dumps(n.get('label', ''))} | status={n.get('generationStatus', 'idle')} | prompt={json.dumps(prompt)}"
        )
    if len(state.nodes) > 12:
        node_lines.append(f"- ... and {len(state.nodes) - 12} more nodes")

    model_counts = Counter((m.get("contentType") or "unknown") for m in models)
    model_parts = ", ".join(
        f"{ct}={model_counts.get(ct, 0)}"
        for ct in ("image", "video", "audio", "music")
    )

    lines = [
        "<runtime_context>",
        f"Canvas snapshot (current request): nodes={len(state.nodes)}, edges={len(state.edges)}, hasWebsiteNode={state.has_website_node}.",
        "Nodes:",
        *(node_lines if node_lines else ["- (none)"]),
        f"Available model counts: {model_parts}.",
        "This snapshot is current. Only call get_canvas_state/get_available_models if you need full details beyond this snapshot.",
        "</runtime_context>",
    ]
    return "\n".join(lines)


# --- Tool definitions (OpenAI function calling format) ---

ORCHESTRATOR_TOOLS: list[dict] = [
    {"type": "function", "function": {"name": "get_canvas_state", "description": "Get full canvas state (all nodes/edges) when the runtime snapshot is insufficient for the task.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "get_available_models", "description": "Get the full list of available AI models grouped by category. Use when you need exact model IDs or model capabilities.", "parameters": {"type": "object", "properties": {"contentType": {"type": "string", "enum": ["image", "video", "audio", "music"], "description": "Optional: filter by content type."}}}}},
    {"type": "function", "function": {"name": "web_search", "description": "Search the web or visit a URL for real-time information.", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Search query or URL"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "add_node", "description": "Add a new node to the canvas.", "parameters": {"type": "object", "properties": {"contentType": {"type": "string", "enum": ["image", "video", "audio", "music", "text", "note", "website"]}, "prompt": {"type": "string"}, "model": {"type": "string"}, "label": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}, "previewUrl": {"type": "string"}, "sandboxId": {"type": "string"}}, "required": ["contentType"]}}},
    {"type": "function", "function": {"name": "connect_nodes", "description": "Connect two nodes with an edge.", "parameters": {"type": "object", "properties": {"sourceNodeId": {"type": "string"}, "targetNodeId": {"type": "string"}, "portType": {"type": "string", "enum": ["text", "image", "audio", "video", "pdf"]}}, "required": ["sourceNodeId", "targetNodeId", "portType"]}}},
    {"type": "function", "function": {"name": "update_node", "description": "Update an existing IDLE node's prompt, model, or label.", "parameters": {"type": "object", "properties": {"nodeId": {"type": "string"}, "prompt": {"type": "string"}, "model": {"type": "string"}, "label": {"type": "string"}}, "required": ["nodeId"]}}},
    {"type": "function", "function": {"name": "delete_nodes", "description": "Delete one or more nodes and their connected edges.", "parameters": {"type": "object", "properties": {"nodeIds": {"type": "array", "items": {"type": "string"}}}, "required": ["nodeIds"]}}},
    {"type": "function", "function": {"name": "clear_canvas", "description": "Remove ALL nodes and edges from the canvas.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "deep_research", "description": "Perform deep multi-step web research on a topic. Creates a note node with the full document.", "parameters": {"type": "object", "properties": {"topic": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}}, "required": ["topic"]}}},
    {"type": "function", "function": {"name": "create_pdf", "description": "Create a PDF document from markdown content.", "parameters": {"type": "object", "properties": {"title": {"type": "string"}, "markdown": {"type": "string"}, "sources": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "url": {"type": "string"}}, "required": ["title", "url"]}}, "x": {"type": "number"}, "y": {"type": "number"}}, "required": ["title", "markdown"]}}},
    {"type": "function", "function": {"name": "create_sandbox", "description": "Create an E2B sandbox for a coding project.", "parameters": {"type": "object", "properties": {"templateName": {"type": "string", "enum": ["nextjs", "nextjs-convex"]}}, "required": ["templateName"]}}},
    {"type": "function", "function": {"name": "create_project_spec", "description": "Create the project.md specification file in the sandbox. Call AFTER create_sandbox and BEFORE run_coding_agent.", "parameters": {"type": "object", "properties": {"sandboxId": {"type": "string"}, "name": {"type": "string"}, "overview": {"type": "string"}, "tech_stack": {"type": "object", "properties": {"frontend": {"type": "string"}, "backend": {"type": "string"}, "database": {"type": "string"}, "auth": {"type": "string"}, "styling": {"type": "string"}}}, "features": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "user_story": {"type": "string"}, "acceptance_criteria": {"type": "array", "items": {"type": "string"}}}}}, "data_models": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "fields": {"type": "array", "items": {"type": "string"}}, "relationships": {"type": "string"}}}}, "api_operations": {"type": "array", "items": {"type": "string"}}, "design_system": {"type": "object", "properties": {"colors": {"type": "object", "properties": {"primary": {"type": "string"}, "secondary": {"type": "string"}, "background": {"type": "string"}, "text": {"type": "string"}, "accent": {"type": "string"}}}, "typography": {"type": "object", "properties": {"headings": {"type": "string"}, "body": {"type": "string"}}}, "theme": {"type": "string"}, "border_radius": {"type": "string"}, "animations": {"type": "string"}}}}, "required": ["sandboxId", "name", "overview", "features"]}}},
    {"type": "function", "function": {"name": "run_coding_agent", "description": "Run a coding sub-agent in the sandbox. Run backend before frontend if both needed.", "parameters": {"type": "object", "properties": {"sandboxId": {"type": "string"}, "persona": {"type": "string", "enum": ["frontend", "backend", "tester"]}, "userMessage": {"type": "string"}}, "required": ["sandboxId", "persona", "userMessage"]}}},
]


# --- System prompt ---

SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "orchestrator_prompt.txt")

# Inline fallback — loaded from file at startup if available
_system_prompt: Optional[str] = None


def _get_system_prompt() -> str:
    global _system_prompt
    if _system_prompt is not None:
        return _system_prompt
    if os.path.exists(SYSTEM_PROMPT_PATH):
        with open(SYSTEM_PROMPT_PATH) as f:
            _system_prompt = f.read()
    else:
        # Fallback: same prompt as agent-config.ts STATIC_SYSTEM_PROMPT
        _system_prompt = _BUILTIN_SYSTEM_PROMPT
    return _system_prompt


# --- Project spec generator ---

def _generate_project_spec(args: dict) -> str:
    tech = args.get("tech_stack") or {}
    design = args.get("design_system") or {}
    colors = design.get("colors") or {}
    typography = design.get("typography") or {}
    features = args.get("features") or []
    data_models = args.get("data_models") or []
    api_ops = args.get("api_operations") or []

    features_text = "\n\n".join(
        f"### {i+1}. {f.get('title', f'Feature {i+1}')}\n"
        + (f"**User Story**: {f['user_story']}\n" if f.get("user_story") else "")
        + (f"**Acceptance Criteria**:\n" + "\n".join(f"- [ ] {c}" for c in f["acceptance_criteria"]) if f.get("acceptance_criteria") else "")
        for i, f in enumerate(features)
    ) if features else "No features specified."

    models_text = "\n\n".join(
        f"### {m.get('name', 'Unknown')}\n```\n" + "\n".join(f"  {fld}" for fld in (m.get("fields") or [])) + "\n```\n"
        + (f"*Relationships*: {m['relationships']}" if m.get("relationships") else "")
        for m in data_models
    ) if data_models else "No data models specified."

    ops_text = "\n".join(f"- {op}" for op in api_ops) if api_ops else "No API operations specified (frontend only)."

    return f"""# Project: {args.get('name', 'Untitled')}

## Overview
{args.get('overview', 'No description provided.')}

## Tech Stack
- **Frontend**: {tech.get('frontend', 'React + TypeScript')}
- **Backend**: {tech.get('backend', 'None')}
- **Database**: {tech.get('database', 'None')}
- **Auth**: {tech.get('auth', 'None')}
- **Styling**: {tech.get('styling', 'Tailwind CSS')}

---

## Features

{features_text}

---

## Data Models

{models_text}

---

## API Operations

{ops_text}

---

## Design System

### Colors
- **Primary**: {colors.get('primary', '#3B82F6')}
- **Secondary**: {colors.get('secondary', '#10B981')}
- **Background**: {colors.get('background', '#0F172A')}
- **Text**: {colors.get('text', '#F8FAFC')}
- **Accent**: {colors.get('accent', '#F59E0B')}

### Typography
- **Headings**: {typography.get('headings', 'Inter, bold')}
- **Body**: {typography.get('body', 'Inter, regular')}

### Style Guidelines
- **Theme**: {design.get('theme', 'Modern dark mode')}
- **Border Radius**: {design.get('border_radius', 'rounded-lg (8px)')}
- **Animations**: {design.get('animations', 'Subtle micro-animations')}

---

## Implementation Status

> This section is updated by agents as they complete work.

### Backend
- **Status**: pending

### Frontend
- **Status**: pending

### Tests
- **Status**: pending
"""


# --- Helpers ---

LARGE_ARG_KEYS = {"content", "markdown", "old_string", "new_string", "edits", "features", "data_models", "acceptance_criteria"}


def _strip_large_args(args: dict) -> dict:
    out = {}
    for k, v in args.items():
        if k in LARGE_ARG_KEYS:
            continue
        if k == "path" and isinstance(v, str):
            out[k] = re.sub(r"^/home/user/app/", "", v)
        else:
            out[k] = v
    return out


def _summarize_args(tool_name: str, args_json: str) -> str:
    if tool_name == "run_coding_agent":
        try:
            args = json.loads(args_json)
            msg_len = len(args.get("userMessage", ""))
            return json.dumps({"sandboxId": args.get("sandboxId"), "persona": args.get("persona"), "userMessage": f"[instructions: {round(msg_len / 1024)}KB]"})
        except Exception:
            pass
    if tool_name in ("deep_research", "create_pdf"):
        try:
            args = json.loads(args_json)
            if "markdown" in args and isinstance(args["markdown"], str):
                return json.dumps({**args, "markdown": f"[{len(args['markdown'])} chars]"})
        except Exception:
            pass
    return args_json


# --- Tool execution ---

async def _execute_tool(
    state: VirtualState,
    models: list[dict],
    name: str,
    args: dict,
    write,  # async callable
    project_id: str,
    llm_model: str,
):
    """Execute a tool call. Returns (result_str, action_dict_or_None, sources_or_None)."""

    if name == "get_canvas_state":
        return _format_canvas_state(state), None, None

    elif name == "get_available_models":
        return _format_models(models, args.get("contentType")), None, None

    elif name == "add_node":
        ct = args.get("contentType", "image")
        if ct == "website" and state.has_website_node:
            return json.dumps({"error": "A website node already exists. You can only create ONE website node per project."}), None, None

        node_id = f"node-{state.next_node_id}"
        state.next_node_id += 1
        last = state.nodes[-1] if state.nodes else None
        x = args.get("x") or (last["x"] + 300 if last else 100)
        y = args.get("y") or (last["y"] if last else 100)

        node = {"id": node_id, "contentType": ct, "label": args.get("label", f"New {ct} block"), "prompt": args.get("prompt", ""), "model": args.get("model", ""), "generationStatus": "idle", "x": x, "y": y}
        state.nodes.append(node)
        if ct == "website":
            state.has_website_node = True

        action = {"type": "add_node", "nodeId": node_id, "contentType": ct, "label": node["label"], "x": x, "y": y}
        if args.get("prompt"):
            action["prompt"] = args["prompt"]
        if args.get("model"):
            action["model"] = args["model"]

        # For website nodes: auto-fill previewUrl and sandboxId from state
        # (LLM might forget to pass them)
        preview_url = args.get("previewUrl") or state.preview_url
        sandbox_id = args.get("sandboxId") or state.sandbox_id
        if preview_url:
            action["previewUrl"] = preview_url
        if sandbox_id:
            action["sandboxId"] = sandbox_id

        return json.dumps({"nodeId": node_id, "success": True}), action, None

    elif name == "connect_nodes":
        src_id = args.get("sourceNodeId", "")
        tgt_id = args.get("targetNodeId", "")
        port = args.get("portType", "")
        src = next((n for n in state.nodes if n["id"] == src_id), None)
        tgt = next((n for n in state.nodes if n["id"] == tgt_id), None)
        if not src:
            return json.dumps({"error": f"Source node {src_id} not found"}), None, None
        if not tgt:
            return json.dumps({"error": f"Target node {tgt_id} not found"}), None, None

        edge_id = f"edge-agent-{state.next_edge_id}"
        state.next_edge_id += 1
        state.edges.append({"id": edge_id, "source": src_id, "target": tgt_id, "sourceHandle": f"output-{port}", "targetHandle": f"input-{port}"})
        action = {"type": "connect_nodes", "edgeId": edge_id, "sourceNodeId": src_id, "targetNodeId": tgt_id, "portType": port}
        return json.dumps({"edgeId": edge_id, "success": True}), action, None

    elif name == "update_node":
        node_id = args.get("nodeId", "")
        node = next((n for n in state.nodes if n["id"] == node_id), None)
        if not node:
            return json.dumps({"error": f"Node {node_id} not found"}), None, None
        if "prompt" in args:
            node["prompt"] = args["prompt"]
        if "model" in args:
            node["model"] = args["model"]
        if "label" in args:
            node["label"] = args["label"]
        action = {"type": "update_node", "nodeId": node_id}
        if "prompt" in args:
            action["prompt"] = args["prompt"]
        if "model" in args:
            action["model"] = args["model"]
        if "label" in args:
            action["label"] = args["label"]
        return json.dumps({"success": True}), action, None

    elif name == "delete_nodes":
        node_ids = set(args.get("nodeIds", []))
        before = len(state.nodes)
        state.nodes = [n for n in state.nodes if n["id"] not in node_ids]
        state.edges = [e for e in state.edges if e["source"] not in node_ids and e["target"] not in node_ids]
        action = {"type": "delete_nodes", "nodeIds": list(node_ids)}
        return json.dumps({"deletedCount": before - len(state.nodes)}), action, None

    elif name == "clear_canvas":
        state.nodes = []
        state.edges = []
        state.next_node_id = 1
        state.next_edge_id = 1
        return json.dumps({"success": True}), {"type": "clear_canvas"}, None

    elif name == "web_search":
        query = (args.get("query") or "").strip()
        if not query:
            return json.dumps({"error": "Search query is required"}), None, None
        try:
            result = await groq_web(query)
            text = result["content"]
            sources = result["sources"]
            if sources:
                source_list = "\n".join(f"- [{s['title']}]({s['url']})" for s in sources)
                text += f"\n\nSources:\n{source_list}"
            return text, None, sources if sources else None
        except Exception as e:
            return json.dumps({"error": str(e)}), None, None

    elif name == "deep_research":
        topic = (args.get("topic") or "").strip()
        if not topic:
            return json.dumps({"error": "Topic is required"}), None, None
        try:
            async def status_writer(phase, detail=""):
                await write({"type": "tool_status", "tool": "deep_research", "status": f"{phase} {detail}".strip()})

            result = await deep_research(topic, llm_model, status_writer)

            # Create note node
            node_id = f"node-{state.next_node_id}"
            state.next_node_id += 1
            last = state.nodes[-1] if state.nodes else None
            x = args.get("x") or (last["x"] + 300 if last else 100)
            y = args.get("y") or (last["y"] if last else 100)

            node = {"id": node_id, "contentType": "note", "label": result["title"], "prompt": result["markdown"], "model": "", "generationStatus": "idle", "x": x, "y": y}
            state.nodes.append(node)

            action = {"type": "add_node", "nodeId": node_id, "contentType": "note", "prompt": result["markdown"], "label": result["title"], "x": x, "y": y}
            return json.dumps({"success": True, "noteNodeId": node_id, "title": result["title"], "summary": result["summary"], "sourceCount": len(result["sources"]), "markdown": result["markdown"]}), action, result["sources"] if result["sources"] else None
        except Exception as e:
            return json.dumps({"error": str(e)}), None, None

    elif name == "create_pdf":
        title = args.get("title", "Document")
        markdown = args.get("markdown", "")
        sources = args.get("sources") or []
        if not markdown.strip():
            return json.dumps({"error": "Markdown content is required"}), None, None
        last = state.nodes[-1] if state.nodes else None
        x = args.get("x") or (last["x"] + 300 if last else 100)
        y = args.get("y") or (last["y"] if last else 100)
        action = {"type": "create_pdf", "title": title, "markdown": markdown, "sources": sources, "x": x, "y": y}
        return json.dumps({"success": True, "message": "PDF creation initiated on client"}), action, None

    elif name == "create_sandbox":
        if state.sandbox_id:
            return json.dumps({"error": f"Sandbox already exists ({state.sandbox_id}). You can only create ONE sandbox per project."}), None, None
        template_name = args.get("templateName", "vite")

        if is_convex_template(template_name) and (not os.getenv("CONVEX_TEAM_ID") or not os.getenv("CONVEX_TEAM_TOKEN")):
            fallback = template_name.replace("-convex", "-express")
            return json.dumps({"error": f'Convex templates unavailable (missing credentials). Call create_sandbox with templateName="{fallback}" instead.'}), None, None

        try:
            sandbox, info = create_sandbox(template_name)
            template = get_template(template_name)
            preview_url = get_preview_url(sandbox, template.default_port if template else 3000)
            state.sandbox_id = info.sandbox_id
            state.template_name = info.template_name
            state.preview_url = preview_url
            return json.dumps({"success": True, "sandboxId": info.sandbox_id, "templateName": info.template_name, "previewUrl": preview_url}), None, None
        except Exception as e:
            return json.dumps({"error": str(e)}), None, None

    elif name == "create_project_spec":
        sandbox_id = args.get("sandboxId", "")
        spec_name = args.get("name", "")
        overview = args.get("overview", "")
        if not sandbox_id or not spec_name or not overview:
            return json.dumps({"error": "sandboxId, name, and overview are required"}), None, None
        try:
            spec = _generate_project_spec(args)
            await write({"type": "tool_status", "tool": "create_project_spec", "status": f'Writing spec for "{spec_name}"'})
            sandbox, _ = reconnect_sandbox(sandbox_id)
            sandbox.files.write("/home/user/app/project.md", spec)
            return json.dumps({"success": True, "path": "/home/user/app/project.md", "name": spec_name, "featuresCount": len(args.get("features") or [])}), None, None
        except Exception as e:
            return json.dumps({"error": str(e)}), None, None

    elif name == "run_coding_agent":
        sandbox_id = args.get("sandboxId", "")
        persona = args.get("persona", "")
        user_message = args.get("userMessage", "")
        if not sandbox_id or not persona or not user_message:
            return json.dumps({"error": "sandboxId, persona, and userMessage are required"}), None, None
        try:
            log.info(f"[orchestrator] run_coding_agent: persona={persona}, sandboxId={sandbox_id}, msgLen={len(user_message)}")

            agent_output = ""
            tool_call_count = 0
            last_error: Optional[str] = None

            # Call coding_agent_loop directly (no HTTP)
            async for event in coding_agent_loop(CodingChatRequest(
                messages=[{"role": "user", "content": user_message}],
                sandbox_id=sandbox_id,
                project_id=project_id,
                persona=persona,
                agent_model=llm_model,
                template_name=state.template_name,
            )):
                etype = event.get("type")
                if etype == "text_delta":
                    agent_output += event.get("content", "")
                    await write({"type": "text_delta", "content": event.get("content", "")})
                elif etype == "reasoning":
                    await write({"type": "reasoning", "content": event.get("content", "")})
                elif etype == "tool_start":
                    await write({"type": "tool_start", "tool": event.get("tool", ""), "args": event.get("args", {})})
                elif etype == "tool_call":
                    tool_call_count += 1
                    await write({"type": "tool_call", "tool": event.get("tool", ""), "args": event.get("args", {})})
                elif etype == "tool_status":
                    await write({"type": "tool_status", "tool": event.get("tool", "shell"), "status": event.get("status", "")})
                elif etype == "error":
                    last_error = event.get("message", "")
                    log.error(f"[orchestrator] sub-agent error: {last_error}")

            log.info(f"[orchestrator] sub-agent finished: toolCalls={tool_call_count}, outputLen={len(agent_output)}, error={last_error}")

            if last_error and re.search(r"sandbox.*(expired|not found|not running)", last_error, re.IGNORECASE):
                return json.dumps({"error": f"SANDBOX_DEAD: {last_error}. Do NOT call run_coding_agent again — it will fail."}), None, None

            return agent_output or json.dumps({"success": True, "persona": persona}), None, None
        except Exception as e:
            msg = str(e)
            log.error(f"[orchestrator] run_coding_agent THREW: {msg}")
            err = f"SANDBOX_DEAD: {msg}. Do NOT retry." if re.search(r"sandbox.*(expired|not found|not running)", msg, re.IGNORECASE) else msg
            return json.dumps({"error": err}), None, None

    else:
        return json.dumps({"error": f"Unknown tool: {name}"}), None, None


# --- Inline sub-agent streaming (yields directly to client, no queue) ---

async def _run_coding_agent_inline(state, args, project_id, llm_model):
    """Yield NDJSON lines directly. Last line is {"_result": "..."} for the tool result."""
    sandbox_id = args.get("sandboxId", "")
    persona = args.get("persona", "")
    user_message = args.get("userMessage", "")

    if not sandbox_id or not persona or not user_message:
        yield json.dumps({"_result": json.dumps({"error": "sandboxId, persona, and userMessage are required"})})
        return

    try:
        log.info(f"[orchestrator] run_coding_agent: persona={persona}, sandboxId={sandbox_id}, msgLen={len(user_message)}")
        agent_output = ""
        tool_call_count = 0
        last_error = None

        async for event in coding_agent_loop(CodingChatRequest(
            messages=[{"role": "user", "content": user_message}],
            sandbox_id=sandbox_id,
            project_id=project_id,
            persona=persona,
            agent_model=llm_model,
            template_name=state.template_name,
        )):
            etype = event.get("type")
            if etype == "ping":
                yield json.dumps({"type": "ping"})
            elif etype == "text_delta":
                agent_output += event.get("content", "")
                yield json.dumps({"type": "text_delta", "content": event.get("content", "")})
            elif etype == "reasoning":
                yield json.dumps({"type": "reasoning", "content": event.get("content", "")})
            elif etype == "tool_start":
                yield json.dumps({"type": "tool_start", "tool": event.get("tool", ""), "args": event.get("args", {})})
            elif etype == "tool_call":
                tool_call_count += 1
                yield json.dumps({"type": "tool_call", "tool": event.get("tool", ""), "args": event.get("args", {})})
            elif etype == "tool_status":
                yield json.dumps({"type": "tool_status", "tool": event.get("tool", "shell"), "status": event.get("status", "")})
            elif etype == "error":
                last_error = event.get("message", "")
                log.error(f"[orchestrator] sub-agent error: {last_error}")

        log.info(f"[orchestrator] sub-agent finished: toolCalls={tool_call_count}, outputLen={len(agent_output)}, error={last_error}")

        if last_error and re.search(r"sandbox.*(expired|not found|not running)", last_error, re.IGNORECASE):
            yield json.dumps({"_result": json.dumps({"error": f"SANDBOX_DEAD: {last_error}. Do NOT retry."})})
        else:
            yield json.dumps({"_result": agent_output or json.dumps({"success": True, "persona": persona})})
    except Exception as e:
        msg = str(e)
        log.error(f"[orchestrator] run_coding_agent THREW: {msg}")
        err = f"SANDBOX_DEAD: {msg}. Do NOT retry." if re.search(r"sandbox.*(expired|not found|not running)", msg, re.IGNORECASE) else msg
        yield json.dumps({"_result": json.dumps({"error": err})})


# --- Endpoint ---

async def _agent_event_stream(req: AgentChatRequest):
    """Orchestrator agent loop — yields event dicts."""
    model = req.agentModel or llm_client.DEFAULT_MODEL
    try:
        state = VirtualState(
            req.canvasState.get("nodes", []),
            req.canvasState.get("edges", []),
        )

        event_queue: asyncio.Queue = asyncio.Queue()

        async def write(event: dict):
            await event_queue.put(event)

        messages = [
            {"role": "system", "content": _get_system_prompt()},
            {"role": "system", "content": _build_runtime_context(state, req.models)},
            *[{"role": m["role"], "content": m["content"]} for m in req.messages],
        ]

        for rnd in range(MAX_TOOL_ROUNDS):
            content = ""
            completed_calls = []
            finish_reason = ""
            reasoning_content = ""
            reasoning_details = None

            async for event in llm_client.stream_chat(
                messages,
                model=model,
                tools=ORCHESTRATOR_TOOLS,
                max_tokens=llm_client.DEFAULT_MAX_TOKENS,
                temperature=llm_client.DEFAULT_TEMPERATURE,
            ):
                etype = event.get("type")

                if etype == "ping":
                    yield {"type": "ping"}
                elif etype == "reasoning":
                    reasoning_content += event["content"]
                    yield {"type": "reasoning", "content": event["content"]}
                elif etype == "content":
                    content += event["content"]
                    yield {"type": "text_delta", "content": event["content"]}
                elif etype == "tool_start":
                    if event.get("name") != "run_coding_agent":
                        yield {"type": "tool_start", "tool": event.get("name", ""), "args": {}}
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

            # Drop truncated tool call when cut off
            if finish_reason == "length" and completed_calls:
                last = completed_calls[-1]
                try:
                    json.loads(last["args"])
                except (json.JSONDecodeError, KeyError):
                    completed_calls.pop()

            # No valid tool calls
            if not completed_calls:
                if finish_reason == "length":
                    messages.append({"role": "assistant", "content": content or ""})
                    messages.append({"role": "user", "content": CONTINUATION_PROMPT})
                    continue
                yield {"type": "done"}
                break

            # Push assistant message (with summarized args to save context)
            assistant_msg = {
                "role": "assistant",
                "content": content or None,
                "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": _summarize_args(tc["name"], tc["args"])}}
                    for tc in completed_calls
                ],
            }
            if reasoning_details:
                assistant_msg["reasoning_details"] = reasoning_details
            if reasoning_content:
                assistant_msg["reasoning_content"] = reasoning_content
            messages.append(assistant_msg)

            # Execute each tool
            for tc in completed_calls:
                args = {}
                try:
                    args = json.loads(tc["args"])
                except (json.JSONDecodeError, TypeError):
                    pass

                # run_coding_agent: stream events inline (not via queue)
                if tc["name"] == "run_coding_agent":
                    result = ""
                    async for evt_line in _run_coding_agent_inline(
                        state, args, req.projectId, model,
                    ):
                        evt = json.loads(evt_line)
                        if "_result" in evt:
                            result = evt.get("_result", "")
                        else:
                            yield evt
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })
                    continue

                result, action, sources = await _execute_tool(
                    state, req.models, tc["name"], args, write, req.projectId, model,
                )

                is_error = result.startswith('{"error"')
                evt = {"type": "tool_call", "tool": tc["name"], "args": _strip_large_args(args)}
                if is_error:
                    evt["error"] = True
                yield evt

                if action:
                    yield {"type": "action", "action": action}
                if sources:
                    yield {"type": "resources", "sources": sources}

                # Drain any queued events
                while not event_queue.empty():
                    evt = event_queue.get_nowait()
                    yield evt

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

    except Exception as e:
        log.error(f"[orchestrator] ERROR: {e}")
        yield {"type": "error", "message": str(e)}


@router.post("/v1/agent/chat")
async def agent_chat(req: AgentChatRequest):
    """Orchestrator agent loop — NDJSON streaming response."""

    async def generate():
        async for event in _agent_event_stream(req):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


async def _run_agent_to_store(stream_id: str, state, req: AgentChatRequest):
    """Run agent as background task, buffer all events into the stream store."""
    try:
        async for event in _agent_event_stream(req):
            if event.get("type") == "ping":
                continue
            state.append(event)
            if event.get("type") == "done":
                state.mark_done()
                return
    except asyncio.CancelledError:
        state.append({"type": "error", "message": "Cancelled by user"})
    except Exception as e:
        log.error(f"[orchestrator] stream {stream_id} error: {e}")
        state.append({"type": "error", "message": str(e)})
    # Ensure done is always sent
    if not state.done:
        state.append({"type": "done"})
        state.mark_done()


@router.websocket("/v1/agent/ws")
async def agent_chat_ws(websocket: WebSocket):
    """Resumable orchestrator agent — WebSocket streams from in-memory buffer.

    New stream:    client sends {messages, canvasState, models, agentModel, projectId}
    Resume stream: client sends {resume: streamId, lastIndex: N}
    """
    from main import check_websocket_origin
    if not check_websocket_origin(websocket):
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    await websocket.accept()
    stream_id = None
    connection_id = uuid.uuid4().hex
    state = None

    try:
        payload = await websocket.receive_json()

        resume_id = payload.get("resume")
        after_seq = payload.get("afterSeq")
        if after_seq is None:
            after_seq = payload.get("lastIndex", 0)
        if not isinstance(after_seq, int) or after_seq < 0:
            after_seq = 0

        if resume_id:
            # --- Resume existing stream ---
            state = session_manager.get(resume_id)
            if not state:
                await websocket.send_json({"type": "error", "message": "Stream expired or not found"})
                await websocket.send_json({"type": "done"})
                return
            stream_id = resume_id
            after_seq = min(after_seq, state.next_seq - 1)
            log.info(f"[orchestrator] Resuming stream {stream_id} after seq {after_seq}")
        else:
            # --- Start new stream ---
            req = AgentChatRequest(**payload)
            stream_id, state = session_manager.create()
            after_seq = 0
            task = asyncio.create_task(_run_agent_to_store(stream_id, state, req))
            state.task = task
            log.info(f"[orchestrator] New stream {stream_id}")

        # Claim connection ownership for this socket.
        state.attach(connection_id)

        # Tell client the stream ID so it can resume later
        await websocket.send_json(
            {
                "type": "stream_id",
                "streamId": stream_id,
                "nextSeq": state.next_seq,
            },
        )
        log.info(f"[orchestrator] Sent stream_id {stream_id}, starting event loop")

        # Stream events: replay missed + live
        while True:
            if not state.owns_connection(connection_id):
                log.info(f"[orchestrator] Connection superseded for stream {stream_id}")
                try:
                    await websocket.close(code=4001, reason="superseded")
                except Exception:
                    pass
                break

            # Send any buffered events
            batch = state.replay_after(after_seq)
            for event in batch:
                await websocket.send_json(event)
                after_seq = event["seq"]

            if state.done:
                log.info(f"[orchestrator] Stream {stream_id} done at seq {after_seq}")
                break

            # Wait for new events (shorter timeout to keep proxies alive)
            await state.wait_for_new(timeout=5)

            if not state.owns_connection(connection_id):
                log.info(f"[orchestrator] Connection superseded during wait for stream {stream_id}")
                try:
                    await websocket.close(code=4001, reason="superseded")
                except Exception:
                    pass
                break

            # If no new events arrived, send ping to keep connection alive
            if state.next_seq == after_seq + 1 and not state.done:
                await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        log.info(f"[orchestrator] WS disconnected, grace timer started for stream {stream_id}")
    except Exception as e:
        log.error(f"[orchestrator] WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        # Start grace timer — if no reconnect within 60s, agent is auto-cancelled
        if state:
            state.detach(connection_id)
        try:
            await websocket.close()
        except Exception:
            pass


class StreamRequest(BaseModel):
    streamId: str


@router.get("/v1/agent/stream/{stream_id}")
async def stream_status(stream_id: str):
    """Check if a stream exists and its current state."""
    state = session_manager.get(stream_id)
    if not state:
        return JSONResponse({"exists": False})
    return JSONResponse({
        "exists": True,
        "done": state.done,
        "eventCount": len(state.events),
        "connected": state.connected,
        "nextSeq": state.next_seq,
    })


@router.post("/v1/agent/cancel")
async def cancel_stream(req: StreamRequest):
    """Cancel a running agent stream."""
    state = session_manager.get(req.streamId)
    if not state:
        return JSONResponse({"ok": False, "reason": "not found"})
    state.cancel()
    log.info(f"[orchestrator] Cancelled stream {req.streamId}")
    return JSONResponse({"ok": True})


# --- Builtin system prompt (same as STATIC_SYSTEM_PROMPT in agent-config.ts) ---

_BUILTIN_SYSTEM_PROMPT = """<role>
You are the AI assistant for ayles flow — an infinite canvas where users build visual AI generation workflows.
Nodes are blocks that generate content (images, videos, audio, music). Users wire them together with edges to create pipelines, then click generate to run them.
You help users build and modify these workflows. You can add nodes, connect them, update settings, and delete them.
You CANNOT run generations — only the user can trigger that.

IMPORTANT: You receive a runtime canvas/model snapshot on every request. Use that snapshot directly for speed. Call get_canvas_state/get_available_models only when you need deeper detail not present in the snapshot.
</role>

<canvas_concepts>
<nodes>
Each node is a block with:
- A content type: image, video, audio, music, text, note
- A prompt: the text instruction for generation
- A model: the AI model (identified by falId)
- Input ports on the left (what the node accepts from upstream)
- One output port on the right (what the node produces for downstream)
</nodes>

<ports>
- Port types: text, image, audio, video, pdf
- Connections go from output port → input port
- Port types MUST match exactly: image output → image input only
- Handle ID format: output-{type} and input-{type}
- Each input port accepts only ONE incoming connection
- A node can output to MULTIPLE downstream nodes
</ports>

<node_lifecycle>
- idle: created, not yet generated
- generating: in progress
- completed: done, has a result URL (image/video/audio)
  → A completed node's output port stays active — it feeds downstream nodes
  → Downstream nodes receive the result URL as their media input
</node_lifecycle>
</canvas_concepts>

<critical_rule>
NEVER edit a completed node's prompt to "modify" its output. That would re-generate from scratch and lose the original result.
Instead, to edit/modify/restyle/vary any existing result: create a NEW node downstream, connect the original's output to the new node's input, and set the new prompt to describe the desired change.
This is the CORE CONCEPT of the infinite canvas — every modification is a new node in the pipeline, preserving the history of all generations.
</critical_rule>

<when_to_use_update_node>
Only use update_node for nodes that are IDLE (not yet generated):
- Fixing a typo in a prompt before the user generates
- Changing the model selection before generation
- Updating a label
NEVER use update_node on a completed node to "edit" its result. Always create a new downstream node instead.
</when_to_use_update_node>

<workflow_patterns>

<pattern name="simple_generation">
Create one node with a prompt and model. User clicks generate.
<example>
User: "Generate a photo of a sunset over the ocean"
→ add_node(contentType="image", prompt="a photo of a sunset over the ocean, golden hour, dramatic clouds", model="fal-ai/flux-pro/v1.1-ultra", label="Sunset")
</example>
</pattern>

<pattern name="edit_image">
To edit, restyle, or create variations of an existing image:
1. Source node MUST have status=completed with a result
2. Create a NEW image node with an image-to-image model (one that has image input)
3. Connect source output → new node's image input (portType="image")
4. Set new node's prompt describing the edit
5. User generates the new node

<example>
User has node-1 (completed image of a cat). User says: "make it look like a watercolor painting"

CORRECT:
→ add_node(contentType="image", prompt="watercolor painting style, soft brushstrokes, artistic", model="fal-ai/flux-pro/kontext", label="Watercolor Cat", x=node1.x+300, y=node1.y)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-2", portType="image")

WRONG — DO NOT DO THIS:
→ update_node(nodeId="node-1", prompt="watercolor painting of a cat")
</example>
</pattern>

<pattern name="image_to_video">
To animate an existing image into a video:
1. Source image node must have a completed result
2. Create a NEW video node with an image-to-video model (has required image input)
3. Connect source image output → new video node's image input (portType="image")
4. Set prompt describing the motion/animation
</pattern>

<pattern name="multi_step_pipeline">
Chain nodes left-to-right for complex workflows:
- Text → Image → Image edit → Video
- Image → fan out to multiple edits
- Image → both a video AND an image edit in parallel
</pattern>

<pattern name="audio_and_music">
<example>
User: "Create a text-to-speech node that says hello world"
→ add_node(contentType="audio", prompt="Hello world! Welcome to Ayles Flow.", model="fal-ai/orpheus-tts", label="TTS Hello")
</example>
</pattern>

<pattern name="parallel_variations">
Generate multiple variations of the same source image by fanning out.
</pattern>

</workflow_patterns>

<rules>
1. Model-contentType matching: the model's contentType MUST match the node's contentType.
2. Port type matching: only connect matching types (image→image, text→text, audio→audio, video→video).
3. Layout: space nodes ~300px apart horizontally, ~200px vertically.
4. Node IDs: new nodes get IDs automatically. Only reference existing node IDs.
5. Explain briefly: tell the user what you're doing and why.
6. Ask when unclear: if ambiguous, ask before acting.
7. Editing = new node: ALWAYS create a new downstream node. NEVER update_node on completed.
8. Check for results: verify source has a result before connecting.
9. Pick image-to-image models for edits.
10. Use text-to-image models ONLY for fresh generations.
</rules>

<web_tools>
You have web_search for real-time information. Use when needed. Include inline citations [1], [2].
</web_tools>

<deep_research_tool>
You have deep_research for thorough multi-step web research. Creates a note node.
</deep_research_tool>

<create_pdf_tool>
create_pdf generates a PDF on the canvas from markdown.
If user says "create a PDF about X": do deep_research first, then create_pdf immediately.
</create_pdf_tool>

<coding_tools>
You can build full applications using a sandboxed coding environment.

Be concise. Go straight to: create_sandbox → add_node → create_project_spec → run_coding_agent.

CRITICAL RULES:
- ONE create_sandbox call only.
- ONE add_node with contentType="website" only.
- ONE create_project_spec call only.
- All sub-agents share the SAME sandboxId.
- Convex templates ARE fullstack. Do NOT create a second sandbox.
- Build COMPLETE, production-grade apps.

Template selection:
1. "landing page", "portfolio", "static site" → nextjs
2. "mock data" or "no backend" → nextjs
3. REAL data persistence needed → nextjs-convex
4. DEFAULT → nextjs

Delegation: always delegate to "frontend" only. nextjs-convex frontend agent writes both UI and Convex functions.

Mock data: create REALISTIC data — real names, 10-20 items, Unsplash URLs. Never "Lorem ipsum".
</coding_tools>"""
