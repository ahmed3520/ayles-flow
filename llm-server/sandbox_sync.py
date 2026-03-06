"""
Sandbox Sync — restore, sync, download, deploy endpoints.

Port of src/data/sandbox-sync.ts
"""

import asyncio
import base64
import json
import os
import random
import time
import logging
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from e2b_client import create_sandbox, reconnect_sandbox, get_preview_url, get_template
from r2_client import r2_get, r2_list_files, r2_get_meta, r2_put_meta, r2_put, to_relative_path

log = logging.getLogger("sandbox-sync")

router = APIRouter()

# --- Request models ---

class RestoreRequest(BaseModel):
    sandbox_id: Optional[str] = None
    project_id: str
    template_name: Optional[str] = None


class SyncRequest(BaseModel):
    sandbox_id: str
    project_id: str
    template_name: str


class DownloadRequest(BaseModel):
    sandbox_id: str
    project_name: str = "project"


class DeployRequest(BaseModel):
    sandbox_id: str
    project_name: str = "project"
    env_vars: Optional[dict[str, str]] = None


# --- Helpers ---

ADJECTIVES = ["swift", "bright", "calm", "bold", "cool", "keen", "vivid", "sleek", "crisp", "lunar", "solar", "neon", "cyber", "pixel", "cloud", "frost", "ember", "flux", "nova", "pulse"]
NOUNS = ["fox", "owl", "wave", "spark", "bloom", "drift", "stone", "reef", "dune", "peak", "grove", "nest", "arc", "haze", "glow", "tide", "fern", "cove", "mint", "opal"]


def _random_project_name() -> str:
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(100, 999)
    return f"{adj}-{noun}-{num}"


def _slugify(name: str) -> str:
    import re
    s = name.lower()
    s = re.sub(r"[^a-z0-9-]", "-", s)
    s = re.sub(r"-+", "-", s)
    s = s.strip("-")[:50]
    return s


def _restore_files(sandbox, project_id: str, workdir: str) -> int:
    """Restore project files from R2 into sandbox."""
    files = r2_list_files(project_id)
    if not files:
        return 0

    # Strip workdir basename prefix if baked into R2 paths
    wd_basename = workdir.rstrip("/").split("/")[-1]
    strip_prefix = wd_basename + "/"

    restored = 0
    BATCH = 20
    for i in range(0, len(files), BATCH):
        batch = files[i:i + BATCH]
        for relative_path in batch:
            try:
                content = r2_get(project_id, relative_path)
                if content is None:
                    continue
                # Strip workdir basename prefix if present
                clean_path = relative_path[len(strip_prefix):] if relative_path.startswith(strip_prefix) else relative_path
                full_path = f"{workdir}/{clean_path}"
                dir_path = full_path.rsplit("/", 1)[0]
                sandbox.commands.run(f"mkdir -p '{dir_path}'")
                sandbox.files.write(full_path, content)
                restored += 1
            except Exception:
                pass

    log.info(f"Restored {restored}/{len(files)} files to {workdir}")
    return restored


# --- Restore endpoint ---

@router.post("/v1/sandbox/restore")
async def restore_sandbox(req: RestoreRequest):
    """Create fresh sandbox, restore from R2, install deps, start dev server. NDJSON streaming."""

    async def generate():
        try:
            # 1. Get template info
            meta = r2_get_meta(req.project_id)
            template_name = req.template_name or (meta.get("templateName") if meta else None) or "vite"
            template = get_template(template_name)
            if not template:
                yield json.dumps({"type": "error", "message": f"Unknown template: {template_name}"}) + "\n"
                return

            # 2. Try reconnecting to existing sandbox first
            sandbox = None
            info = None
            if req.sandbox_id:
                try:
                    yield json.dumps({"type": "status", "step": "Reconnecting to sandbox..."}) + "\n"
                    sandbox, info = reconnect_sandbox(req.sandbox_id)
                    preview_url = get_preview_url(sandbox, template.default_port)
                    log.info(f"Reconnected to existing sandbox {req.sandbox_id} for {req.project_id}")
                    yield json.dumps({"type": "done", "sandboxId": info.sandbox_id, "previewUrl": preview_url}) + "\n"
                    return
                except Exception as e:
                    log.info(f"Reconnect failed for {req.sandbox_id}: {e}, creating fresh sandbox")
                    sandbox = None

            # 3. Create fresh sandbox (reconnect failed or no sandbox_id)
            yield json.dumps({"type": "status", "step": "Creating sandbox..."}) + "\n"
            sandbox, info = create_sandbox(template_name)

            # 4. Restore files from R2
            yield json.dumps({"type": "status", "step": "Restoring files..."}) + "\n"
            _restore_files(sandbox, req.project_id, template.workdir)

            # 5. Install dependencies
            yield json.dumps({"type": "status", "step": "Installing dependencies..."}) + "\n"
            result = sandbox.commands.run(f"cd {template.workdir} && npm install 2>&1", timeout=120)
            if result.exit_code != 0:
                yield json.dumps({"type": "status", "step": f"npm install failed (exit {result.exit_code}), continuing..."}) + "\n"

            # 6. Start dev server in background
            if template.dev_cmd:
                yield json.dumps({"type": "status", "step": "Starting dev server..."}) + "\n"
                sandbox.commands.run(
                    f"bash -c 'cd {template.workdir} && {template.dev_cmd}' > /tmp/dev.log 2>&1 & echo $!",
                )

            preview_url = get_preview_url(sandbox, template.default_port)
            log.info(f"Restored {req.project_id} → {info.sandbox_id}")
            yield json.dumps({"type": "done", "sandboxId": info.sandbox_id, "previewUrl": preview_url}) + "\n"

        except Exception as e:
            log.error(f"Restore error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


# --- Full sync endpoint ---

@router.post("/v1/sandbox/sync")
async def full_sync(req: SyncRequest):
    """Sync all sandbox files to R2."""
    sandbox, _ = reconnect_sandbox(req.sandbox_id)
    template = get_template(req.template_name)
    workdir = template.workdir if template else "/home/user/app"

    # List source files (exclude heavy dirs)
    excludes = " ".join(f"-not -path '*/{d}/*'" for d in [
        "node_modules", ".git", "dist", ".next", "build", "__pycache__", ".cache", ".turbo",
    ])
    result = sandbox.commands.run(f"find {workdir} -type f {excludes} 2>/dev/null", timeout=30)
    files = [f for f in result.stdout.split("\n") if f]

    wd = workdir + "/" if not workdir.endswith("/") else workdir
    synced = 0

    BATCH = 20
    for i in range(0, len(files), BATCH):
        batch = files[i:i + BATCH]
        for f in batch:
            try:
                content = sandbox.files.read(f)
                r2_put(req.project_id, to_relative_path(f, wd), content)
                synced += 1
            except Exception:
                pass

    r2_put_meta(req.project_id, {"templateName": req.template_name, "lastSync": int(time.time() * 1000)})
    log.info(f"Full sync: {synced}/{len(files)} files")
    return JSONResponse({"synced": synced, "total": len(files)})


# --- Download endpoint ---

@router.post("/v1/sandbox/download")
async def download_project(req: DownloadRequest):
    """Tar project and return as base64."""
    sandbox, _ = reconnect_sandbox(req.sandbox_id)
    workdir = "/home/user/app"
    tar_path = "/tmp/project.tar.gz"

    excludes = " ".join([
        "--exclude=node_modules", "--exclude=.git", "--exclude=dist",
        "--exclude=.next", "--exclude=build", "--exclude=__pycache__",
        "--exclude=.cache", "--exclude=.turbo",
    ])

    result = sandbox.commands.run(f"tar czf {tar_path} {excludes} -C {workdir} .", timeout=30)
    if result.exit_code != 0:
        return JSONResponse({"error": f"tar failed: {result.stdout}\n{result.stderr}"}, status_code=500)

    tar_bytes = sandbox.files.read(tar_path, format="bytes")
    b64 = base64.b64encode(tar_bytes).decode("ascii")
    return JSONResponse({"base64": b64, "fileName": f"{req.project_name or 'project'}.tar.gz"})


# --- Deploy endpoint ---

@router.post("/v1/deploy/vercel")
async def deploy_vercel(req: DeployRequest):
    """Deploy to Vercel via CLI in sandbox. NDJSON streaming with real-time logs."""

    vercel_token = os.getenv("VERCEL_TOKEN")
    vercel_team_id = os.getenv("VERCEL_TEAM_ID")
    if not vercel_token:
        return JSONResponse({"error": "VERCEL_TOKEN is not configured"}, status_code=500)

    async def generate():
        try:
            sandbox, _ = reconnect_sandbox(req.sandbox_id)
            yield json.dumps({"type": "log", "text": "Connected to sandbox\n"}) + "\n"

            # Write env vars
            if req.env_vars:
                env_content = "\n".join(f"{k}={v}" for k, v in req.env_vars.items())
                sandbox.files.write("/home/user/app/.env.production", env_content)
                yield json.dumps({"type": "log", "text": "Wrote .env.production\n"}) + "\n"

            team_flag = f" --scope {vercel_team_id}" if vercel_team_id else ""
            slug = _slugify(req.project_name)
            project_name = slug or _random_project_name()

            yield json.dumps({"type": "log", "text": f'Deploying as "{project_name}"...\n\n'}) + "\n"

            # Stream stdout/stderr in real-time
            all_output = []

            def on_stdout(chunk):
                all_output.append(chunk)

            def on_stderr(chunk):
                all_output.append(chunk)

            result = sandbox.commands.run(
                f"npx --yes vercel deploy --yes --prod --public --token {vercel_token}{team_flag} --name {project_name}",
                cwd="/home/user/app",
                timeout=180,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )

            # Emit collected output
            full_output = "".join(all_output)
            if full_output:
                yield json.dumps({"type": "log", "text": full_output}) + "\n"

            if result.exit_code != 0:
                yield json.dumps({"type": "error", "text": f"\nDeploy failed (exit code {result.exit_code})"}) + "\n"
            else:
                # Extract URL
                lines = full_output.strip().split("\n")
                url = next((l.strip() for l in lines if l.strip().startswith("https://")), lines[-1].strip() if lines else "")
                yield json.dumps({"type": "done", "url": url}) + "\n"

        except Exception as e:
            yield json.dumps({"type": "error", "text": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )
