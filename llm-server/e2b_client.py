"""
E2B Client — Sandbox lifecycle management.

Wraps the E2B Python SDK for creating, reconnecting, and managing sandboxes.
"""

import os
import logging
import httpx
from typing import Optional
from dataclasses import dataclass

from e2b import Sandbox

log = logging.getLogger("e2b")

DEFAULT_TIMEOUT = 60 * 60  # 1 hour in seconds


# --- Template config (mirrors src/config/e2bTemplates.ts) ---

@dataclass
class TemplateConfig:
    id: str
    name: str
    category: str  # frontend | backend | fullstack | base
    default_port: int
    workdir: str
    dev_cmd: str
    convex: bool = False


WORKDIR = "/home/user/app"

TEMPLATES: dict[str, TemplateConfig] = {
    # Frontend
    "vite": TemplateConfig("m8vig10ovz8jgg537fnv", "vite", "frontend", 5173, WORKDIR, "npm run dev"),
    "nextjs": TemplateConfig("xv0k19z2x5c9f3bdcxne", "nextjs", "frontend", 3000, WORKDIR, "npm run dev"),
    "tanstack": TemplateConfig("9eti2k16gu447z6niboe", "tanstack", "frontend", 3000, WORKDIR, "npm run dev"),
    "remix": TemplateConfig("0qc9mmcdzv72j7le6zxx", "remix", "frontend", 3000, WORKDIR, "npm run dev"),
    "nuxt": TemplateConfig("adan0j7m2wiys5bcescn", "nuxt", "frontend", 3000, WORKDIR, "npm run dev"),
    "svelte": TemplateConfig("o1uiv4z3y42fq7o4kgki", "svelte", "frontend", 5173, WORKDIR, "npm run dev"),
    "astro": TemplateConfig("jz2g3oydkbr6fkc2l0f4", "astro", "frontend", 4321, WORKDIR, "npm run dev"),
    # Backend
    "express": TemplateConfig("z82fjfi5c5u37mvlm0df", "express", "backend", 8000, WORKDIR, "npm run dev"),
    "hono": TemplateConfig("83z6t8qcrob72vxxicoy", "hono", "backend", 8000, WORKDIR, "npm run dev"),
    "fastapi": TemplateConfig("w2dtz08ktz3lxti8mcv4", "fastapi", "backend", 8000, WORKDIR, "uvicorn app.main:app --reload --port 8000"),
    "flask": TemplateConfig("ukdjmznq5llj5be0cvsr", "flask", "backend", 5000, WORKDIR, "flask run --port 5000"),
    "django": TemplateConfig("jrj5htsdsbvftekwlsmd", "django", "backend", 8000, WORKDIR, "python manage.py runserver 0.0.0.0:8000"),
    # Fullstack
    "vite-express": TemplateConfig("neeaylgppfgdv66n0s91", "vite-express", "fullstack", 3000, WORKDIR, "npm run dev"),
    "nextjs-express": TemplateConfig("w6cvahvxf7agvh9phy4c", "nextjs-express", "fullstack", 3000, WORKDIR, "npm run dev"),
    "vite-convex": TemplateConfig("x7gyhpnw8s4h770d42g0", "vite-convex", "fullstack", 5173, WORKDIR, "npm run dev", convex=True),
    "nextjs-convex": TemplateConfig("uzto48tvduo78atpgv7a", "nextjs-convex", "fullstack", 3000, WORKDIR, "npm run dev", convex=True),
    "tanstack-convex": TemplateConfig("fbu6a0x5itig1hqgf7ka", "tanstack-convex", "fullstack", 3000, WORKDIR, "npm run dev", convex=True),
    # Base
    "node-base": TemplateConfig("7lajixmr5x56htr95xoh", "node-base", "base", 3000, WORKDIR, "npm run dev"),
    "python-base": TemplateConfig("a1330lez5rmb5ap1r5a0", "python-base", "base", 8000, WORKDIR, "python main.py"),
    "desktop": TemplateConfig("k0wmnzir0zuzye6dndlw", "desktop", "base", 6080, "/home/user", ""),
    "code-interpreter": TemplateConfig("nlhz8vlwyupq845jsdg9", "code-interpreter", "base", 8888, "/home/user", ""),
}


def get_template(name: str) -> Optional[TemplateConfig]:
    return TEMPLATES.get(name)


def is_convex_template(name: str) -> bool:
    t = TEMPLATES.get(name)
    return t.convex if t else False


# --- Sandbox info ---

@dataclass
class SandboxInfo:
    sandbox_id: str
    template_name: str
    template_id: str


# --- Core operations ---

def create_sandbox(
    template_name: str,
    env_vars: Optional[dict[str, str]] = None,
) -> tuple[Sandbox, SandboxInfo]:
    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        raise RuntimeError("E2B_API_KEY is not set")

    template = get_template(template_name)
    if not template:
        raise ValueError(f"Unknown template: {template_name}")

    # Check Convex creds before creating sandbox
    if template.convex:
        if not os.getenv("CONVEX_TEAM_ID") or not os.getenv("CONVEX_TEAM_TOKEN"):
            raise RuntimeError("CONVEX_TEAM_ID and CONVEX_TEAM_TOKEN required for Convex templates")

    sandbox = Sandbox.create(
        template=template.id,
        api_key=api_key,
        timeout=DEFAULT_TIMEOUT,
        envs=env_vars or {},
    )

    # Convex provisioning
    if template.convex:
        _provision_convex(sandbox, template.workdir)

    info = SandboxInfo(
        sandbox_id=sandbox.sandbox_id,
        template_name=template_name,
        template_id=template.id,
    )

    log.info(f"Created sandbox {info.sandbox_id} (template={template_name})")
    return sandbox, info


def reconnect_sandbox(sandbox_id: str) -> tuple[Sandbox, SandboxInfo]:
    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        raise RuntimeError("E2B_API_KEY is not set")

    sandbox = Sandbox._cls_connect(sandbox_id, api_key=api_key)

    info = SandboxInfo(
        sandbox_id=sandbox.sandbox_id,
        template_name="unknown",
        template_id="",
    )

    return sandbox, info


def kill_sandbox(sandbox_id: str) -> None:
    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        return
    try:
        sandbox = Sandbox._cls_connect(sandbox_id, api_key=api_key)
        sandbox.kill()
    except Exception:
        pass


def get_preview_url(sandbox: Sandbox, port: int) -> str:
    host = sandbox.get_host(port)
    return f"https://{host}"


# --- Convex provisioning ---

CONVEX_API = "https://api.convex.dev/v1"


def _provision_convex(sandbox: Sandbox, workdir: str) -> None:
    team_id = os.getenv("CONVEX_TEAM_ID")
    team_token = os.getenv("CONVEX_TEAM_TOKEN")
    if not team_id or not team_token:
        raise RuntimeError("CONVEX_TEAM_ID and CONVEX_TEAM_TOKEN required")

    headers = {
        "Authorization": f"Bearer {team_token}",
        "Content-Type": "application/json",
    }

    import time
    project_name = f"sandbox-{int(time.time() * 1000)}"

    # 1. Create project
    resp = httpx.post(
        f"{CONVEX_API}/teams/{team_id}/create_project",
        headers=headers,
        json={"projectName": project_name, "deploymentType": "dev"},
    )
    resp.raise_for_status()
    project = resp.json()

    if not project.get("deploymentName"):
        raise RuntimeError("Convex project created but no deployment was provisioned")

    # 2. Create deploy key
    resp = httpx.post(
        f"{CONVEX_API}/deployments/{project['deploymentName']}/create_deploy_key",
        headers=headers,
        json={"name": "sandbox-deploy"},
    )
    resp.raise_for_status()
    deploy_key = resp.json()["deployKey"]

    # 3. Write .env.local
    deployment_url = project.get("deploymentUrl") or f"https://{project['deploymentName']}.convex.cloud"
    env_content = "\n".join([
        f"CONVEX_DEPLOYMENT={project['deploymentName']}",
        f"CONVEX_DEPLOY_KEY={deploy_key}",
        f"NEXT_PUBLIC_CONVEX_URL={deployment_url}",
        f"VITE_CONVEX_URL={deployment_url}",
    ])
    sandbox.files.write(f"{workdir}/.env.local", env_content)

    # 4. Push schema
    sandbox.commands.run(
        f'CONVEX_DEPLOY_KEY="{deploy_key}" npx convex dev --once',
        cwd=workdir,
        timeout=60,
    )

    log.info(f"Provisioned Convex: {project['deploymentName']}")
