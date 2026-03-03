"""
Cache testing script — simulates the coding agent's agentic loop.

Sends a sequence of growing requests that mimic:
  system prompt + user task → assistant(tool_calls) → tool results → repeat

Logs cache metrics, costs, and full message structure to a JSON log file.

Usage:
  cd llm-server
  source venv/bin/activate
  python test_caching.py
"""

import json
import time
import sys
import os
from datetime import datetime

import httpx

SERVER = os.getenv("LLM_SERVER_URL", "http://localhost:9400")
MODEL = "anthropic/claude-sonnet-4.6"
LOG_FILE = f"cache_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"

# ─── Realistic system prompt (matches coding agent ~7k tokens) ────────

SYSTEM_PROMPT = """You are XO-Copilot, a frontend development specialist. You build production-grade React interfaces using Tailwind CSS and TypeScript.

Be concise and direct. Don't explain what you did unless asked.

IMPORTANT: You are building a COMPLETE, production-grade application — not a demo. Every feature in project.md MUST have fully implemented pages, components, and routes. If a feature lists 5 acceptance criteria, all 5 must work. Missing pages is unacceptable.

IMPORTANT RULES:
- ALWAYS read project.md first
- Load framework essentials skill before writing code
- Run `npm run build` after completing all tasks
- Use semantic design tokens, never hardcode colors
- Match existing code patterns

## What's Already In Your Sandbox

**Framework**: Next.js 16 (App Router) + TypeScript
**Styling**: Tailwind CSS v4 + shadcn/ui components
**Package Manager**: npm (already installed)
**Port**: 3000, Dev command: npm run dev

### Pre-installed packages
- next@16.1.6, react@19, typescript@5.8
- tailwindcss@4, @tailwindcss/postcss
- lucide-react (icons), class-variance-authority, clsx, tailwind-merge
- shadcn/ui components available via `npx shadcn@latest add <component>`

### Project structure
```
app/
├── public/          # Static assets
├── src/
│   ├── app/         # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/  # React components
│   │   └── ui/      # shadcn components
│   ├── hooks/       # Custom hooks
│   └── lib/
│       └── utils.ts # cn() helper
├── next.config.ts
├── tsconfig.json
├── package.json
└── tailwind.config.ts (v4 — CSS-based config)
```

## Available Skills
Use load_skill("name") to load any of these before writing code for that framework:
- `nextjs-essentials`: Next.js App Router patterns, routing, layouts
- `tailwind-v4`: Tailwind CSS v4 migration guide and new features
- `shadcn-ui`: shadcn/ui component library usage
- `react-patterns`: React 19 patterns, hooks, server components
- `typescript-strict`: Strict TypeScript patterns
- `framer-motion`: Animation patterns with Framer Motion
- `nextjs-auth`: Authentication with NextAuth.js
- `prisma`: Database with Prisma ORM

## Task Tracking Format
Print your task list at the START and after completing major sections:
```
TASKS:
[x] Completed task
[→] Current task
[ ] Pending task
```
""" + ("Additional context for architecture decisions and best practices. " * 100)

# ─── Realistic tool definitions (subset of coding agent's 15 tools) ──

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read",
            "description": "Read a file from the sandbox filesystem.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to /home/user/app/"},
                    "offset": {"type": "integer", "description": "Line offset to start reading from"},
                    "limit": {"type": "integer", "description": "Max lines to read"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write",
            "description": "Create or overwrite a file in the sandbox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path"},
                    "content": {"type": "string", "description": "File content to write"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "shell",
            "description": "Execute a shell command in the sandbox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute"},
                    "timeout_ms": {"type": "integer", "description": "Timeout in ms"},
                    "background": {"type": "boolean", "description": "Run in background"},
                    "name": {"type": "string", "description": "Name for background process"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "load_skill",
            "description": "Load a framework-specific skill by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Skill name to load"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit",
            "description": "Replace exact string in a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path"},
                    "old_string": {"type": "string", "description": "Exact text to find"},
                    "new_string": {"type": "string", "description": "Replacement text"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "Search file contents using ripgrep patterns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex pattern"},
                    "path": {"type": "string", "description": "Directory or file to search"},
                    "include": {"type": "string", "description": "Glob pattern for files to include"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob",
            "description": "Find files matching a glob pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern"},
                    "path": {"type": "string", "description": "Base directory"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lint",
            "description": "Check for syntax errors in a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File to lint"},
                },
                "required": ["path"],
            },
        },
    },
]

# ─── Simulated agent conversation ────────────────────────────────────
# Mimics a coding agent doing: read project → load skill → read files → write code

SIMULATED_TURNS = [
    # Turn 1: Initial — system + user task
    {
        "user": "Build the complete ProAttire professional clothes ecommerce landing page as described in project.md. Use Tailwind CSS throughout. Use Google Fonts (Playfair Display for headings, Inter for body) via next/font. Use real Unsplash image URLs. Make the page fully responsive.",
    },
    # Turn 2: Agent reads project.md and loads skill
    {
        "assistant_tool_calls": [
            {"id": "tc_001", "name": "read", "args": '{"path": "project.md"}'},
            {"id": "tc_002", "name": "load_skill", "args": '{"name": "nextjs-essentials"}'},
        ],
        "tool_results": [
            {"id": "tc_001", "content": '{"success":false,"error":"path \'/home/user/project.md\' does not exist"}'},
            {"id": "tc_002", "content": '{"name":"nextjs-essentials","content":"# Next.js App Router Essentials\\n\\nComprehensive reference for Next.js 15+ App Router with Tailwind v4 and shadcn/ui.\\n\\n## 1. TypeScript — NEVER use any\\n\\n## 2. File-based routing\\n\\napp/page.tsx → /\\napp/about/page.tsx → /about\\n\\n## 3. Layouts\\n\\nexport default function Layout({ children }) { return <div>{children}</div> }\\n\\n## 4. Server Components\\n\\nBy default all components are server components.\\n\\n## 5. Client Components\\n\\nAdd \\"use client\\" directive at the top.\\n\\n## 6. Metadata\\n\\nexport const metadata = { title: \\"...\\" }\\n\\n## 7. Image Optimization\\n\\nimport Image from \\"next/image\\"\\n\\n## 8. Fonts\\n\\nimport { Inter } from \\"next/font/google\\""}'},
        ],
    },
    # Turn 3: Agent reads existing files
    {
        "assistant_text": "Let me check the existing project structure:",
        "assistant_tool_calls": [
            {"id": "tc_003", "name": "read", "args": '{"path": "src/app/globals.css"}'},
            {"id": "tc_004", "name": "read", "args": '{"path": "src/app/layout.tsx"}'},
            {"id": "tc_005", "name": "read", "args": '{"path": "next.config.ts"}'},
        ],
        "tool_results": [
            {"id": "tc_003", "content": '@import "tailwindcss";\n@import "tw-animate-css";\n@import "shadcn/tailwind.css";\n\n@custom-variant dark (&:is(.dark *));\n\n@theme inline {\n  --color-background: var(--background);\n  --color-foreground: var(--foreground);\n}'},
            {"id": "tc_004", "content": 'import type { Metadata } from "next";\nimport { Geist } from "next/font/google";\nimport "./globals.css";\n\nconst geist = Geist({ variable: "--font-geist", subsets: ["latin"] });\n\nexport const metadata: Metadata = { title: "Create Next App" };\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body className={geist.variable}>{children}</body></html>;\n}'},
            {"id": "tc_005", "content": 'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;'},
        ],
    },
    # Turn 4: Agent explores workspace
    {
        "assistant_tool_calls": [
            {"id": "tc_006", "name": "shell", "args": '{"command": "find /home/user/app -maxdepth 3 -type f | head -40"}'},
        ],
        "tool_results": [
            {"id": "tc_006", "content": '{"stdout":"/home/user/app/public/file.svg\\n/home/user/app/public/globe.svg\\n/home/user/app/src/app/layout.tsx\\n/home/user/app/src/app/page.tsx\\n/home/user/app/src/app/globals.css\\n/home/user/app/next.config.ts\\n/home/user/app/package.json\\n/home/user/app/tsconfig.json","stderr":"","exit_code":0,"success":true}'},
        ],
    },
    # Turn 5: Agent writes next.config.ts
    {
        "assistant_text": "Now I have the full picture. Let me build the landing page.\n\n```\nTASKS:\n[x] Read project structure & load skills\n[→] Configure next.config.ts\n[ ] Update globals.css\n[ ] Build page.tsx\n```",
        "assistant_tool_calls": [
            {"id": "tc_007", "name": "write", "args": '{"path": "next.config.ts", "content": "import type { NextConfig } from \\"next\\";\\nconst nextConfig: NextConfig = { images: { remotePatterns: [{ protocol: \\"https\\", hostname: \\"images.unsplash.com\\" }] } };\\nexport default nextConfig;"}'},
        ],
        "tool_results": [
            {"id": "tc_007", "content": '{"success":true,"path":"next.config.ts"}'},
        ],
    },
    # Turn 6: Agent writes globals.css
    {
        "assistant_tool_calls": [
            {"id": "tc_008", "name": "write", "args": '{"path": "src/app/globals.css", "content": "@import \\"tailwindcss\\";\\n@import \\"tw-animate-css\\";\\n@import \\"shadcn/tailwind.css\\";\\n\\n@theme inline {\\n  --color-background: var(--background);\\n  --color-foreground: var(--foreground);\\n  --font-sans: var(--font-inter);\\n  --font-heading: var(--font-playfair);\\n}\\n\\n@keyframes fadeInUp {\\n  from { opacity: 0; transform: translateY(24px); }\\n  to { opacity: 1; transform: translateY(0); }\\n}"}'},
        ],
        "tool_results": [
            {"id": "tc_008", "content": '{"success":true,"path":"src/app/globals.css"}'},
        ],
    },
    # Turn 7: Agent writes layout.tsx
    {
        "assistant_tool_calls": [
            {"id": "tc_009", "name": "write", "args": '{"path": "src/app/layout.tsx", "content": "import type { Metadata } from \\"next\\";\\nimport { Playfair_Display, Inter } from \\"next/font/google\\";\\nimport \\"./globals.css\\";\\n\\nconst playfair = Playfair_Display({ variable: \\"--font-playfair\\", subsets: [\\"latin\\"], weight: [\\"400\\", \\"500\\", \\"600\\", \\"700\\"] });\\nconst inter = Inter({ variable: \\"--font-inter\\", subsets: [\\"latin\\"] });\\n\\nexport const metadata: Metadata = { title: \\"ProAttire — Premium Professional Clothing\\", description: \\"Discover our curated collection of premium professional clothing.\\" };\\n\\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\\n  return <html lang=\\"en\\"><body className={`${playfair.variable} ${inter.variable} font-sans antialiased`}>{children}</body></html>;\\n}"}'},
        ],
        "tool_results": [
            {"id": "tc_009", "content": '{"success":true,"path":"src/app/layout.tsx"}'},
        ],
    },
    # Turn 8: Agent writes large page.tsx component
    {
        "assistant_tool_calls": [
            {"id": "tc_010", "name": "write", "args": '{"path": "src/app/page.tsx", "content": "' + 'import Image from \\"next/image\\";\\n// Full landing page component with Hero, Products, Categories, Testimonials, Footer\\n' + ('// Product data and component code here... ' * 50) + '"}'},
        ],
        "tool_results": [
            {"id": "tc_010", "content": '{"success":true,"path":"src/app/page.tsx"}'},
        ],
    },
    # Turn 9: Agent runs build
    {
        "assistant_tool_calls": [
            {"id": "tc_011", "name": "shell", "args": '{"command": "cd /home/user/app && npm run build 2>&1", "timeout_ms": 120000}'},
        ],
        "tool_results": [
            {"id": "tc_011", "content": '{"stdout":"\\n> app@0.1.0 build\\n> next build\\n\\n▲ Next.js 16.1.6 (Turbopack)\\n\\n   Creating an optimized production build ...\\n ✓ Compiled successfully\\n   Collecting page data ...\\n   Generating static pages ...\\n ✓ Generating static pages (3/3)\\n\\n   Route (app)\\n   ┌ ○ /\\n   └ ○ /_not-found\\n\\n ○  (Static)  prerendered as static content\\n\\nBuild completed successfully.","stderr":"","exit_code":0,"success":true}'},
        ],
    },
]


def build_messages(turns: list[dict]) -> list[dict]:
    """Build the messages array up to a given set of turns."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turn in turns:
        if "user" in turn:
            messages.append({"role": "user", "content": turn["user"]})

        if "assistant_tool_calls" in turn:
            tc_list = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["args"]},
                }
                for tc in turn["assistant_tool_calls"]
            ]
            messages.append({
                "role": "assistant",
                "content": turn.get("assistant_text") or None,
                "tool_calls": tc_list,
            })

            for tr in turn["tool_results"]:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tr["id"],
                    "content": tr["content"],
                })

    return messages


def send_request(messages: list[dict], tools: list[dict]) -> dict:
    """Send a streaming request and collect usage metrics."""
    body = {
        "model": MODEL,
        "messages": messages,
        "tools": tools,
        "max_tokens": 100,
        "temperature": 0,
    }

    t0 = time.time()
    with httpx.Client(timeout=30) as client:
        resp = client.post(f"{SERVER}/v1/chat/stream", json=body)
        resp.raise_for_status()

    elapsed = time.time() - t0
    lines = resp.text.strip().split("\n")
    events = [json.loads(l) for l in lines if l.strip()]

    return {
        "elapsed_ms": round(elapsed * 1000),
        "events": events,
    }


def main():
    print(f"═══ Cache Test — {MODEL} ═══")
    print(f"Server: {SERVER}")
    print(f"Log file: {LOG_FILE}")
    print()

    # Check server health
    try:
        r = httpx.get(f"{SERVER}/health", timeout=5)
        health = r.json()
        if not health.get("hasApiKey"):
            print("ERROR: Server has no API key configured")
            sys.exit(1)
        print(f"Server: OK")
    except Exception as e:
        print(f"ERROR: Cannot reach server: {e}")
        sys.exit(1)

    log_entries = []
    total_cost_cached = 0.0
    total_cost_uncached = 0.0

    # Sonnet 4.6 pricing per MTok
    BASE_INPUT = 3.0
    CACHE_WRITE = 3.75
    CACHE_READ = 0.30
    OUTPUT = 15.0

    for step in range(1, len(SIMULATED_TURNS) + 1):
        messages = build_messages(SIMULATED_TURNS[:step])
        msg_count = len(messages)

        print(f"─── Step {step}/{len(SIMULATED_TURNS)} | {msg_count} messages ───")

        result = send_request(messages, TOOLS)

        # Extract content from events
        content_parts = [e["content"] for e in result["events"] if e.get("type") == "content"]
        tool_calls = [e for e in result["events"] if e.get("type") in ("tool_start", "tool_complete")]
        finish = [e for e in result["events"] if e.get("type") in ("done", "tool_complete")]

        entry = {
            "step": step,
            "timestamp": datetime.now().isoformat(),
            "msg_count": msg_count,
            "elapsed_ms": result["elapsed_ms"],
            "response_preview": "".join(content_parts)[:200],
            "tool_calls": tool_calls,
            "finish": finish,
            "messages_snapshot": messages,  # full message history for debugging
        }

        log_entries.append(entry)
        print(f"  Messages: {msg_count} | Time: {result['elapsed_ms']}ms")
        print(f"  Response: {''.join(content_parts)[:100]}...")
        print(f"  (Check server terminal for cached= values)")
        print()

        # Write log entry
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        # Small delay to avoid rate limits
        if step < len(SIMULATED_TURNS):
            time.sleep(1)

    print(f"═══ Done — {len(SIMULATED_TURNS)} steps ═══")
    print(f"Log saved to: {LOG_FILE}")
    print()
    print("Check the server terminal for cache metrics:")
    print("  cached=0     → cache MISS (cold or invalidated)")
    print("  cached=NNNN  → cache HIT (tokens read from cache)")
    print()
    print("Expected pattern:")
    print("  Step 1: cached=0 (first request, writes to cache)")
    print("  Step 2+: cached>0 (prefix matches, reads from cache)")
    print("  cached should grow as conversation grows")


if __name__ == "__main__":
    main()
