"""
Coding Tool Executor — dispatches and executes coding tools in E2B sandboxes.

Port of src/data/coding-tool-executor.ts
"""

import asyncio
import json
import re
import logging
from typing import Any, Callable, Awaitable, Optional
from dataclasses import dataclass, field

from e2b import Sandbox

from r2_client import r2_put, r2_delete, to_relative_path
from e2b_client import get_preview_url, get_template

log = logging.getLogger("coding-tools")

MAX_READ_CHARS = 8000
MAX_CMD_CHARS = 4000

# --- Types ---

@dataclass
class BackgroundProcess:
    pid: int
    command: str
    name: str
    log_file: str
    cwd: str


@dataclass
class ToolContext:
    background_processes: dict[str, BackgroundProcess] = field(default_factory=dict)
    write: Callable[[dict], Awaitable[None]] = None  # type: ignore
    lsp_port: Optional[int] = None
    project_id: str = ""
    workdir: str = "/home/user/app/"
    template_name: str = ""
    persona: str = ""


@dataclass
class ToolResult:
    success: bool
    result: Any = None
    error: Optional[str] = None
    validation_error: bool = False
    expired: bool = False


# --- Arg validation ---

REQUIRED_ARGS: dict[str, list[str]] = {
    "read": ["path"],
    "write": ["path", "content"],
    "edit": ["path", "old_string", "new_string"],
    "multi_edit": ["path", "edits"],
    "delete": ["path"],
    "mkdir": ["path"],
    "move": ["from_path", "to_path"],
    "grep": ["pattern"],
    "glob": ["pattern"],
    "ls": [],
    "shell": [],
    "lint": ["path"],
    "workspace_info": [],
    "load_skill": ["name"],
    "get_preview_url": ["port"],
}


def _validate_args(tool_name: str, args: dict) -> Optional[str]:
    required = REQUIRED_ARGS.get(tool_name)
    if required is None:
        return None
    missing = [a for a in required if args.get(a) is None]
    if missing:
        return f"Missing required arguments for '{tool_name}': {', '.join(missing)}"
    return None


# --- Helpers ---

def _truncate(text: str, max_chars: int, label: str = "") -> str:
    if not isinstance(text, str) or len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n... [{label} truncated, {len(text)} total chars]"


def _shell_escape(s: str) -> str:
    return s.replace("'", "'\\''")


LSP_EXTS = {"ts", "tsx", "js", "jsx", "css", "scss", "less", "html", "json", "py"}

MAX_LSP_DIAGNOSTICS = 5


def _get_lsp_diagnostics(sandbox: Sandbox, lsp_port: Optional[int], file_path: str) -> Optional[str]:
    if not lsp_port:
        return None
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    if ext not in LSP_EXTS:
        return None

    try:
        escaped_path = _shell_escape(file_path)
        result = sandbox.commands.run(
            f"curl -s -m 10 'http://127.0.0.1:{lsp_port}/diagnostics?file={escaped_path}'",
            timeout=12,
        )
        if result.exit_code != 0 or not result.stdout.strip():
            return None

        diags = json.loads(result.stdout)
        if not isinstance(diags, list) or not diags:
            return None

        errors = [d for d in diags if d.get("severity") == "error"]
        warnings = [d for d in diags if d.get("severity") == "warning"]
        selected = (errors + warnings)[:MAX_LSP_DIAGNOSTICS]
        if not selected:
            return None

        lines = []
        for d in selected:
            sev = d.get("severity", "error").upper()
            line = d.get("line", 0)
            col = d.get("character", 0)
            msg = d.get("message", "")
            lines.append(f"L{line}:{col} {sev}: {msg}")
        if len(diags) > MAX_LSP_DIAGNOSTICS:
            lines.append(f"... and {len(diags) - MAX_LSP_DIAGNOSTICS} more")
        return "\n".join(lines)
    except Exception:
        return None


# --- R2 sync (fire-and-forget via threading — never blocks async loop) ---

import threading


def _sync_to_r2(project_id: str, workdir: str, path: str, content: str):
    """Fire-and-forget R2 upload in a background thread."""
    def _do():
        try:
            rel = to_relative_path(path, workdir)
            r2_put(project_id, rel, content)
        except Exception as e:
            log.warning(f"[r2-sync] {e}")
    threading.Thread(target=_do, daemon=True).start()


def _delete_from_r2(project_id: str, workdir: str, path: str):
    """Fire-and-forget R2 delete in a background thread."""
    def _do():
        try:
            rel = to_relative_path(path, workdir)
            r2_delete(project_id, rel)
        except Exception as e:
            log.warning(f"[r2-sync] {e}")
    threading.Thread(target=_do, daemon=True).start()


# --- Skill loader (reads from disk) ---

_SKILL_DIR = None

def _find_skill_dir():
    global _SKILL_DIR
    if _SKILL_DIR is not None:
        return _SKILL_DIR
    import os
    # Try relative paths from llm-server/
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "server", "agents", "skills"),
        os.path.join(os.path.dirname(__file__), "server", "agents", "skills"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            _SKILL_DIR = os.path.abspath(c)
            return _SKILL_DIR
    _SKILL_DIR = ""
    return _SKILL_DIR


def _load_skill(name: str) -> Optional[dict]:
    skill_dir = _find_skill_dir()
    if not skill_dir:
        return None

    import os
    # Try direct match and subdirectory match
    for root, _, files in os.walk(skill_dir):
        for f in files:
            if not f.endswith(".md") or f == "index.md":
                continue
            fname = f.replace(".md", "").replace("_", "-")
            if fname == name:
                with open(os.path.join(root, f)) as fh:
                    content = fh.read()
                # Strip frontmatter
                m = re.match(r"^---\n[\s\S]*?\n---\n([\s\S]*)$", content)
                body = m.group(1).strip() if m else content
                return {"name": name, "content": body}
    return None


# --- Main executor ---

async def execute_coding_tool(
    sandbox: Sandbox,
    tool_name: str,
    args: dict,
    context: ToolContext,
) -> ToolResult:
    validation_error = _validate_args(tool_name, args)
    if validation_error:
        return ToolResult(success=False, error=validation_error, validation_error=True)

    try:
        result = await _dispatch(sandbox, tool_name, args, context)
        return ToolResult(success=True, result=result)
    except Exception as e:
        msg = str(e)
        lower = msg.lower()
        if ("sandbox" in lower and "not found" in lower) or "usage limit reached" in lower:
            return ToolResult(success=False, error="Sandbox expired. Please start a new session.", expired=True)
        return ToolResult(success=False, error=msg)


# --- Dispatch ---

def _resolve_path(path: str, workdir: str) -> str:
    """Resolve relative paths against workdir."""
    if path.startswith("/"):
        return path
    wd = workdir.rstrip("/")
    return f"{wd}/{path}"


async def _dispatch(sandbox: Sandbox, tool_name: str, args: dict, ctx: ToolContext) -> Any:

    # ===== File Operations =====

    if tool_name == "read":
        path = _resolve_path(args["path"], ctx.workdir)
        content = sandbox.files.read(path)
        all_lines = content.split("\n")
        offset = max(0, (args.get("offset") or 1) - 1)
        limit = args.get("limit")
        sliced = all_lines[offset:offset + limit] if limit else all_lines[offset:]
        numbered = [f"{str(offset + i + 1).rjust(6)}\t{line}" for i, line in enumerate(sliced)]
        return _truncate("\n".join(numbered), MAX_READ_CHARS, "file content")

    if tool_name == "write":
        path = _resolve_path(args["path"], ctx.workdir)
        content = args["content"]
        sandbox.files.write(path, content)
        await ctx.write({"type": "file_change", "path": path, "action": "create"})
        # R2 sync (fire-and-forget)
        _sync_to_r2(ctx.project_id, ctx.workdir, path, content)
        diags = _get_lsp_diagnostics(sandbox, ctx.lsp_port, path)
        result = {"success": True, "path": path}
        if diags:
            result["diagnostics"] = diags
        return result

    if tool_name == "edit":
        path = _resolve_path(args["path"], ctx.workdir)
        content = sandbox.files.read(path)
        old_str = args["old_string"]
        new_str = args["new_string"]
        replace_all = args.get("replace_all", False)

        if old_str not in content:
            return {"success": False, "error": f"old_string not found in {path}"}

        if not replace_all:
            count = content.count(old_str)
            if count > 1:
                return {"success": False, "error": f"old_string found {count} times in {path}. Use replace_all=true to replace all."}

        updated = content.replace(old_str, new_str) if not replace_all else content.replace(old_str, new_str)
        # For replace_all, Python's replace already replaces all occurrences by default
        # For single replace, we need to limit to 1
        if not replace_all:
            updated = content.replace(old_str, new_str, 1)

        sandbox.files.write(path, updated)
        await ctx.write({"type": "file_change", "path": path, "action": "update"})
        asyncio.get_event_loop().run_in_executor(None, _sync_to_r2, ctx.project_id, ctx.workdir, path, updated)
        diags = _get_lsp_diagnostics(sandbox, ctx.lsp_port, path)
        result = {"success": True, "path": path}
        if diags:
            result["diagnostics"] = diags
        return result

    if tool_name == "multi_edit":
        path = _resolve_path(args["path"], ctx.workdir)
        edits = args["edits"]
        content = sandbox.files.read(path)

        for edit in edits:
            if edit["old_string"] not in content:
                return {"success": False, "error": f"Edit not found: {edit['old_string'][:50]}..."}
            if edit.get("replace_all"):
                content = content.replace(edit["old_string"], edit["new_string"])
            else:
                content = content.replace(edit["old_string"], edit["new_string"], 1)

        sandbox.files.write(path, content)
        await ctx.write({"type": "file_change", "path": path, "action": "update"})
        _sync_to_r2(ctx.project_id, ctx.workdir, path, content)
        diags = _get_lsp_diagnostics(sandbox, ctx.lsp_port, path)
        result = {"success": True, "path": path, "edits_applied": len(edits)}
        if diags:
            result["diagnostics"] = diags
        return result

    if tool_name == "delete":
        path = _resolve_path(args["path"], ctx.workdir)
        sandbox.commands.run(f"rm -rf '{_shell_escape(path)}'")
        await ctx.write({"type": "file_change", "path": path, "action": "delete"})
        _delete_from_r2(ctx.project_id, ctx.workdir, path)
        return {"success": True, "path": path}

    if tool_name == "mkdir":
        path = _resolve_path(args["path"], ctx.workdir)
        sandbox.commands.run(f"mkdir -p '{_shell_escape(path)}'")
        return {"success": True, "path": path}

    if tool_name == "move":
        from_path = _resolve_path(args["from_path"], ctx.workdir)
        to_path = _resolve_path(args["to_path"], ctx.workdir)
        sandbox.commands.run(f"mv '{_shell_escape(from_path)}' '{_shell_escape(to_path)}'")
        await ctx.write({"type": "file_change", "path": from_path, "action": "delete"})
        await ctx.write({"type": "file_change", "path": to_path, "action": "create"})
        _delete_from_r2(ctx.project_id, ctx.workdir, from_path)
        try:
            new_content = sandbox.files.read(to_path)
            _sync_to_r2(ctx.project_id, ctx.workdir, to_path, new_content)
        except Exception:
            pass
        return {"success": True, "from": from_path, "to": to_path}

    # ===== Search =====

    if tool_name == "grep":
        pattern = args["pattern"]
        path = _resolve_path(args.get("path", "."), ctx.workdir)
        output_mode = args.get("output_mode", "files_with_matches")

        parts = ["rg"]
        if output_mode == "files_with_matches":
            parts.append("-l")
        elif output_mode == "count":
            parts.append("-c")

        if args.get("case_insensitive"):
            parts.append("-i")
        if args.get("line_numbers") and output_mode == "content":
            parts.append("-n")
        if args.get("multiline"):
            parts.extend(["-U", "--multiline-dotall"])

        if output_mode == "content":
            if args.get("context") is not None:
                parts.append(f"-C {args['context']}")
            if args.get("before_context") is not None:
                parts.append(f"-B {args['before_context']}")
            if args.get("after_context") is not None:
                parts.append(f"-A {args['after_context']}")

        if args.get("glob"):
            parts.append(f"--glob '{_shell_escape(args['glob'])}'")
        if args.get("file_type"):
            parts.append(f"--type {args['file_type']}")

        parts.extend(["--glob '!node_modules'", "--glob '!.git'", "--glob '!dist'", "--glob '!.next'"])
        parts.append(f"'{_shell_escape(pattern)}'")
        parts.append(path)

        if args.get("head_limit"):
            parts.append(f"| head -{args['head_limit']}")

        rg_cmd = " ".join(parts)
        fallback = f"({rg_cmd}) 2>/dev/null || grep -rn '{_shell_escape(pattern)}' {path} 2>/dev/null | head -50"

        result = sandbox.commands.run(fallback)
        output = result.stdout.strip()

        if output_mode == "files_with_matches":
            files = [f for f in output.split("\n") if f]
            return {"files": files, "count": len(files)}

        if output_mode == "count":
            counts = {}
            for line in output.split("\n"):
                if not line:
                    continue
                sep = line.rfind(":")
                if sep > 0:
                    counts[line[:sep]] = int(line[sep + 1:]) if line[sep + 1:].isdigit() else 0
            return {"counts": counts, "total": sum(counts.values())}

        return _truncate(output, MAX_CMD_CHARS, "grep output")

    if tool_name == "glob":
        pattern = args["pattern"]
        path = _resolve_path(args.get("path", "."), ctx.workdir)

        if "**" in pattern or "/" in pattern:
            find_pattern = pattern.replace("**", "*")
            cmd = f"find {path} -type f -path '*/{find_pattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' 2>/dev/null | head -100"
        else:
            cmd = f"find {path} -type f -name '{_shell_escape(pattern)}' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' 2>/dev/null | head -100"

        result = sandbox.commands.run(cmd)
        files = [f for f in result.stdout.split("\n") if f]
        return {"pattern": pattern, "path": path, "matches": files, "count": len(files)}

    if tool_name == "ls":
        path = _resolve_path(args.get("path", "."), ctx.workdir)
        ignore = args.get("ignore", [])

        entries = sandbox.files.list(path)
        results = [{"name": e.name, "path": e.path, "isDirectory": e.type == "dir"} for e in entries]

        if ignore:
            def should_keep(entry):
                for p in ignore:
                    if p.startswith("*."):
                        ext = p[1:]
                        if entry["name"].endswith(ext):
                            return False
                    elif entry["name"] == p:
                        return False
                return True
            results = [e for e in results if should_keep(e)]

        return results

    # ===== Shell =====

    if tool_name == "shell":
        action = args.get("action")

        if action == "list":
            procs = [
                {"process_id": pid, "name": p.name, "command": p.command, "pid": p.pid}
                for pid, p in ctx.background_processes.items()
            ]
            return {"processes": procs}

        if action == "output":
            process_id = args.get("process_id")
            if not process_id:
                return {"error": "process_id is required for action=output"}
            proc = ctx.background_processes.get(process_id)
            if not proc:
                return {"error": "Process not found", "available": list(ctx.background_processes.keys())}
            lines = args.get("lines", 50)
            result = sandbox.commands.run(f"tail -n {lines} {proc.log_file}")
            check = sandbox.commands.run(f"ps -p {proc.pid} > /dev/null 2>&1 && echo 1 || echo 0")
            return {"output": result.stdout, "is_running": check.stdout.strip() == "1", "process_id": process_id}

        if action == "stop":
            process_id = args.get("process_id")
            if not process_id:
                return {"error": "process_id is required for action=stop"}
            proc = ctx.background_processes.get(process_id)
            if not proc:
                return {"success": False, "error": "Process not found"}
            sandbox.commands.run(f"kill {proc.pid} 2>/dev/null || true")
            del ctx.background_processes[process_id]
            return {"success": True, "process_id": process_id}

        command = args.get("command")
        if not command:
            return {"error": "command is required to execute a shell command"}

        cwd = args.get("cwd")
        timeout_s = (args.get("timeout_ms") or 120_000) / 1000
        background = args.get("background", False)

        if background:
            name = args.get("name") or command[:20]
            process_id = f"bg_{len(ctx.background_processes)}"
            log_file = f"/tmp/{process_id}.log"

            cwd_prefix = f"cd {cwd} && " if cwd else ""
            bg_cmd = f"bash -c '{cwd_prefix}{command}' > {log_file} 2>&1 & echo $!"
            result = sandbox.commands.run(bg_cmd)
            pid = int(result.stdout.strip().split("\n")[-1] or "0")

            ctx.background_processes[process_id] = BackgroundProcess(
                pid=pid, command=command, name=name, log_file=log_file, cwd=cwd or ".",
            )
            return {"process_id": process_id, "name": name, "pid": pid}

        # Foreground execution with streaming
        result = sandbox.commands.run(
            command,
            cwd=cwd,
            timeout=timeout_s,
            on_stdout=lambda data: asyncio.ensure_future(ctx.write({"type": "terminal_output", "content": data, "stream": "stdout"})),
            on_stderr=lambda data: asyncio.ensure_future(ctx.write({"type": "terminal_output", "content": data, "stream": "stderr"})),
        )

        return {
            "stdout": _truncate(result.stdout, MAX_CMD_CHARS, "stdout"),
            "stderr": _truncate(result.stderr, MAX_CMD_CHARS // 2, "stderr"),
            "exit_code": result.exit_code,
            "success": result.exit_code == 0,
        }

    # ===== Development =====

    if tool_name == "lint":
        path = _resolve_path(args["path"], ctx.workdir)
        ext = path.rsplit(".", 1)[-1] if "." in path else ""

        if ctx.lsp_port and ext in LSP_EXTS:
            diags = _get_lsp_diagnostics(sandbox, ctx.lsp_port, path)
            return {"valid": not diags, "diagnostics": diags or "No issues found."}

        errors = []
        if ext == "py":
            result = sandbox.commands.run(f"python3 -m py_compile {path} 2>&1")
            if result.exit_code != 0:
                errors.append({"line": 0, "message": (result.stdout or result.stderr).strip(), "severity": "error"})
        elif ext in ("js", "jsx", "ts", "tsx"):
            result = sandbox.commands.run(f"node --check {path} 2>&1")
            if result.exit_code != 0:
                errors.append({"line": 0, "message": (result.stdout or result.stderr).strip(), "severity": "error"})
        elif ext == "json":
            result = sandbox.commands.run(f"python3 -c \"import json; json.load(open('{path}'))\" 2>&1")
            if result.exit_code != 0:
                errors.append({"line": 0, "message": (result.stdout or result.stderr).strip(), "severity": "error"})

        return {"valid": len(errors) == 0, "errors": errors}

    # ===== Workspace =====

    if tool_name == "workspace_info":
        # Frontend templates are already documented in the system prompt.
        # Returning a compact reminder avoids wasted exploration rounds.
        if ctx.persona == "frontend" and ctx.template_name:
            template = get_template(ctx.template_name)
            if template:
                return {
                    "template": template.name,
                    "workdir": template.workdir,
                    "default_port": template.default_port,
                    "dev_command": template.dev_cmd,
                    "note": "Template structure is already in your prompt. Skip workspace exploration and start coding after reading project.md.",
                }

        max_depth = args.get("max_depth", 3)
        info = {}

        cwd_result = sandbox.commands.run("pwd")
        info["cwd"] = cwd_result.stdout.strip()

        tree_cmd = f"find . -maxdepth {max_depth} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' 2>/dev/null | head -100"
        tree_result = sandbox.commands.run(tree_cmd)
        info["file_tree"] = [f for f in tree_result.stdout.split("\n") if f]

        cfg_result = sandbox.commands.run(
            "ls -1 package.json tsconfig.json vite.config.* tailwind.config.* .env* requirements.txt pyproject.toml 2>/dev/null || true"
        )
        info["config_files"] = [f for f in cfg_result.stdout.split("\n") if f]

        pkg_result = sandbox.commands.run("cat package.json 2>/dev/null")
        if pkg_result.exit_code == 0 and pkg_result.stdout.strip():
            try:
                pkg = json.loads(pkg_result.stdout)
                info["package_info"] = {
                    "name": pkg.get("name", "unknown"),
                    "scripts": list((pkg.get("scripts") or {}).keys()),
                    "dependencies": list((pkg.get("dependencies") or {}).keys()),
                    "devDependencies": list((pkg.get("devDependencies") or {}).keys()),
                }
            except json.JSONDecodeError:
                pass

        ui_dirs = ["src/components/ui", "components/ui", "frontend/src/components/ui", "frontend/components/ui"]
        for ui_dir in ui_dirs:
            ui_result = sandbox.commands.run(f"ls -1 {ui_dir} 2>/dev/null")
            if ui_result.exit_code == 0 and ui_result.stdout.strip():
                components = [re.sub(r"\.tsx?$", "", f) for f in ui_result.stdout.split("\n") if f]
                info["ui_components"] = {
                    "path": ui_dir,
                    "count": len(components),
                    "components": components,
                    "note": "Pre-installed — import these, do NOT recreate or edit them",
                }
                break

        return info

    # ===== Skills =====

    if tool_name == "load_skill":
        name = args["name"]
        skill = _load_skill(name)
        if not skill:
            return {"error": f"Skill '{name}' not found"}
        await ctx.write({"type": "skill_loaded", "name": name})
        return skill

    # ===== Preview =====

    if tool_name == "get_preview_url":
        port = args["port"]
        url = get_preview_url(sandbox, port)
        await ctx.write({"type": "preview_url", "url": url, "port": port})
        return {"url": url, "port": port}

    raise ValueError(f"Unknown tool: {tool_name}")
