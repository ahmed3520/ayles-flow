// Template structure descriptions — tells the coding agent what's pre-installed
// so it doesn't waste time exploring the sandbox.

export const TEMPLATE_STRUCTURES: Record<string, string> = {
  nextjs: `## What's Already In Your Sandbox

**Framework**: Next.js (App Router, TypeScript, Tailwind CSS, ESLint)
**Scaffolded with**: create-next-app (--app --src-dir --import-alias '@/*')

**Pre-installed packages**:
- clsx, tailwind-merge, class-variance-authority, lucide-react
- shadcn/ui — ALL components pre-installed in \`components/ui/\`

**File structure**:
\`\`\`
src/
  app/
    layout.tsx    ← root layout (html, body, fonts)
    page.tsx      ← home page
    globals.css   ← global styles + Tailwind
  lib/
    utils.ts      ← cn() helper
components/
  ui/             ← ALL shadcn components (button, card, dialog, input, table, form, etc.)
public/
package.json
tsconfig.json
next.config.ts
postcss.config.mjs
components.json   ← shadcn config
\`\`\`

**IMPORTANT**:
- shadcn/ui components ALREADY EXIST as files. NEVER recreate them, NEVER edit files in components/ui/, NEVER run \`npx shadcn add\`. Just import: \`import { Button } from "@/components/ui/button"\`
- NEVER run scaffolding commands (create-next-app, npm init, npx shadcn init)
- Tailwind + PostCSS are already configured
- Port: 3000, Dev command: npm run dev`,

  'nextjs-convex': `## What's Already In Your Sandbox

**Framework**: Next.js (App Router, TypeScript, Tailwind CSS) + Convex real-time backend
**Scaffolded with**: create-next-app + convex

**Pre-installed packages**:
- convex (real-time database, auth, file storage, serverless functions)
- clsx, tailwind-merge, class-variance-authority, lucide-react
- shadcn/ui — ALL components pre-installed in \`components/ui/\`

**File structure**:
\`\`\`
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
  schema.ts        ← define your tables here (may be empty)
public/
package.json
tsconfig.json
next.config.ts
components.json
\`\`\`

**IMPORTANT**:
- Convex IS the backend. Write schema in convex/schema.ts, queries/mutations in convex/*.ts
- Run \`npx convex dev --once\` after writing schema to push it
- shadcn/ui components ALREADY EXIST. Just import them.
- NEVER run scaffolding commands
- Port: 3000, Dev command: npm run dev`,

  vite: `## What's Already In Your Sandbox

**Framework**: Vite + React (TypeScript)
**Scaffolded with**: create-vite (react-ts template)

**Pre-installed packages**:
- tailwindcss@3, postcss, autoprefixer
- clsx, tailwind-merge, lucide-react
- NO shadcn/ui (install manually if needed)

**File structure**:
\`\`\`
src/
  App.tsx          ← main app component
  main.tsx         ← entry point
  index.css        ← global styles + Tailwind directives
  vite-env.d.ts
public/
index.html
package.json
tsconfig.json
vite.config.ts
postcss.config.js
tailwind.config.js
\`\`\`

**IMPORTANT**:
- NO shadcn/ui pre-installed. Build your own components or install shadcn manually.
- Tailwind + PostCSS are already configured
- NEVER run scaffolding commands (npm create vite, etc.)
- Port: 5173, Dev command: npm run dev`,

  'vite-convex': `## What's Already In Your Sandbox

**Framework**: Vite + React (TypeScript) + Convex real-time backend
**Scaffolded with**: create-vite + convex

**Pre-installed packages**:
- convex (real-time database, auth, file storage, serverless functions)
- tailwindcss@3, postcss, autoprefixer
- clsx, tailwind-merge, lucide-react
- NO shadcn/ui

**File structure**:
\`\`\`
src/
  App.tsx
  main.tsx
  index.css
convex/
  _generated/      ← auto-generated (DO NOT EDIT)
  schema.ts
public/
index.html
package.json
tsconfig.json
vite.config.ts
\`\`\`

**IMPORTANT**:
- Convex IS the backend. Write schema in convex/schema.ts, queries/mutations in convex/*.ts
- Run \`npx convex dev --once\` after writing schema
- NEVER run scaffolding commands
- Port: 5173, Dev command: npm run dev`,

  'tanstack-convex': `## What's Already In Your Sandbox

**Framework**: TanStack Start + Convex real-time backend

**Pre-installed packages**:
- @tanstack/start, @tanstack/react-router, vinxi, react, react-dom
- convex
- tailwindcss@3, postcss, autoprefixer

**IMPORTANT**:
- Convex IS the backend
- NEVER run scaffolding commands
- Port: 3000, Dev command: npm run dev`,

  'vite-express': `## What's Already In Your Sandbox

**Framework**: Vite + React frontend + Express.js backend (monorepo)

**Pre-installed packages**:
- Frontend: Vite, React, TypeScript, Tailwind, clsx, tailwind-merge, lucide-react
- Backend: Express, cors, dotenv, TypeScript

**File structure**:
\`\`\`
src/               ← frontend (Vite + React)
  App.tsx
  main.tsx
  index.css
server/            ← backend (Express)
  index.ts
public/
package.json
vite.config.ts
\`\`\`

**IMPORTANT**:
- Frontend port: 5173, Backend port: 3000
- Dev command: npm run dev (runs both)
- NEVER run scaffolding commands`,

  'nextjs-express': `## What's Already In Your Sandbox

**Framework**: Next.js frontend + Express.js backend (monorepo)

**Pre-installed packages**:
- Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/ui (all components), lucide-react
- Backend: Express, cors, dotenv, TypeScript

**File structure**:
\`\`\`
src/
  app/
    layout.tsx
    page.tsx
    globals.css
components/
  ui/              ← ALL shadcn components
server/
  index.ts         ← Express backend
package.json
\`\`\`

**IMPORTANT**:
- shadcn/ui components ALREADY EXIST. Just import them.
- Frontend port: 3000, Backend port: 8000
- Dev command: npm run dev
- NEVER run scaffolding commands`,

  express: `## What's Already In Your Sandbox

**Framework**: Express.js backend (TypeScript)

**Pre-installed packages**:
- express, cors, dotenv
- typescript, @types/node, @types/express, @types/cors, ts-node, tsx, nodemon

**File structure**:
\`\`\`
src/
  index.ts
package.json
tsconfig.json
\`\`\`

- Port: 3000, Dev command: npx tsx watch src/index.ts`,

  hono: `## What's Already In Your Sandbox

**Framework**: Hono backend (TypeScript)

**Pre-installed packages**:
- hono, @hono/node-server
- typescript, @types/node, tsx

- Port: 3000, Dev command: npx tsx watch src/index.ts`,

  tanstack: `## What's Already In Your Sandbox

**Framework**: TanStack Start (TypeScript, Tailwind)

**Pre-installed packages**:
- @tanstack/start, @tanstack/react-router, vinxi, react, react-dom
- tailwindcss@3, postcss, autoprefixer

- Port: 3000, Dev command: npm run dev
- NEVER run scaffolding commands`,

  astro: `## What's Already In Your Sandbox

**Framework**: Astro (with React + Tailwind integrations)

**Pre-installed packages**:
- astro, @astrojs/react, @astrojs/tailwind

- Port: 4321, Dev command: npm run dev
- NEVER run scaffolding commands`,

  svelte: `## What's Already In Your Sandbox

**Framework**: SvelteKit (TypeScript, Tailwind)

**Pre-installed packages**:
- @sveltejs/kit, @sveltejs/adapter-auto, svelte, vite
- tailwindcss@3, postcss, autoprefixer

- Port: 5173, Dev command: npm run dev
- NEVER run scaffolding commands`,

  remix: `## What's Already In Your Sandbox

**Framework**: Remix (React 18, TypeScript, Tailwind)

**Pre-installed packages**:
- @remix-run/node, @remix-run/react, @remix-run/serve, react@18, react-dom@18
- tailwindcss@3, postcss, autoprefixer

- Port: 3000, Dev command: npm run dev
- NEVER run scaffolding commands`,

  nuxt: `## What's Already In Your Sandbox

**Framework**: Nuxt (Vue, TypeScript, Tailwind)

**Pre-installed packages**:
- nuxt, vue, vue-router
- @nuxtjs/tailwindcss

- Port: 3000, Dev command: npm run dev
- NEVER run scaffolding commands`,

  fastapi: `## What's Already In Your Sandbox

**Framework**: FastAPI (Python)

**Pre-installed packages**:
- fastapi, uvicorn

- Port: 8000, Dev command: uvicorn app.main:app --reload --port 8000`,

  flask: `## What's Already In Your Sandbox

**Framework**: Flask (Python)

- Port: 5000, Dev command: flask run --port 5000`,

  django: `## What's Already In Your Sandbox

**Framework**: Django (Python)

- Port: 8000, Dev command: python manage.py runserver 0.0.0.0:8000`,

  'node-base': `## What's Already In Your Sandbox

**Framework**: Node.js 22 (bare environment)

- Port: 3000`,

  'python-base': `## What's Already In Your Sandbox

**Framework**: Python 3.12 (bare environment)

- Port: 8000`,
}
