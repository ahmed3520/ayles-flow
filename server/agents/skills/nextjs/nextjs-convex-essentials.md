---
name: nextjs-convex-essentials
description: Comprehensive Next.js App Router + Convex + Tailwind v4 + shadcn/ui essentials. Covers server/client components, routing, data fetching, navigation, server actions, cookies, searchParams, images, error handling, streaming, Convex queries/mutations/schema, and all major patterns. Auto-injected for nextjs-convex templates.
---

# Next.js App Router + Convex Essentials

Comprehensive reference for Next.js 15+ App Router with Convex, Tailwind v4, and shadcn/ui. For deeper examples on a specific topic, use `load_skill("skill-name")`.

---

## 1. TypeScript — NEVER use `any`

`@typescript-eslint/no-explicit-any` is enabled. `any` = build failure.

```typescript
// Page props (Next.js 15+ — params & searchParams are Promises)
function Page({ params }: { params: Promise<{ id: string }> }) { ... }
function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) { ... }

// Form events
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { ... }
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

// Server actions
async function myAction(formData: FormData): Promise<void> { ... }

// Convex — use Id and Doc types
import { Id, Doc } from "./_generated/dataModel";
type UserId = Id<"users">;
type User = Doc<"users">;
```

---

## 2. Server vs Client Components

**Default = Server Component.** Only add `'use client'` when you NEED hooks, event handlers, or browser APIs.

### Server Components CAN:
- Be `async`, use `await` directly
- Access `cookies()`, `headers()` from `next/headers` (must `await` in 15+)
- Use `redirect()` from `next/navigation`
- Use `<Link>` from `next/link`
- Access `params` and `searchParams` props directly

### Server Components CANNOT:
- Use `useState`, `useEffect`, `useContext`, or any React hooks
- Use `useRouter()`, `usePathname()`, `useSearchParams()`
- Use browser APIs (`window`, `localStorage`, `navigator`)
- Have event handlers (`onClick`, `onChange`, etc.)
- Use Convex hooks (`useQuery`, `useMutation`) — these are client-only

### Client Components REQUIRE `'use client'` for:
- Interactive elements (onClick, onChange, onSubmit)
- React hooks (useState, useEffect, useContext, useRef)
- Browser APIs (window, localStorage, navigator)
- **Convex hooks** (useQuery, useMutation, useAction)

### `'use client'` Boundary Rule
Only add to the **LOWEST** component that needs interactivity. Never on layouts or pages that don't need it.

### Composition Pattern — Server Inside Client
Never import a Server Component into a Client Component. Pass it as `children`:

```tsx
// Server parent composes both
<ClientWrapper><ServerContent /></ClientWrapper>

// ClientWrapper.tsx
'use client';
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return <div>{isOpen && children}</div>;
}
```

---

## 3. Routing

### File Conventions
- `layout.tsx` — shared UI, persists across navigation. Root MUST have `<html>` + `<body>`
- `page.tsx` — makes route accessible
- `loading.tsx` — Suspense fallback (automatic)
- `error.tsx` — error boundary (`'use client'` required)
- `not-found.tsx` — 404 UI
- `route.ts` — API endpoint (Route Handler)

### Dynamic Routes
```
app/[id]/page.tsx              → /123, /abc
app/blog/[slug]/page.tsx       → /blog/hello-world
app/docs/[...slug]/page.tsx    → /docs/a, /docs/a/b (catch-all)
app/shop/[[...slug]]/page.tsx  → /shop, /shop/a (optional catch-all)
```

### Route Groups
`(marketing)/about/page.tsx` — groups without affecting URL.

### Avoid Over-Nesting
Default to simplest structure. "Fetch product by ID" → `app/[id]/page.tsx`, NOT `app/products/[id]/page.tsx`.

---

## 4. Params & searchParams (Next.js 15+)

Both are **Promises** — must `await`.

### params
```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>{id}</div>;
}
```

### searchParams (Server Component)
```tsx
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q || '';
  return <div>Search: {q}</div>;
}
```

### useSearchParams (Client) — requires Suspense
```tsx
// Parent
<Suspense fallback={<div>Loading...</div>}>
  <SearchContent />
</Suspense>

// SearchContent.tsx
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  return <div>Search: {query}</div>;
}
```

---

## 5. Navigation

### Server Components (no 'use client' needed)
- `<Link href="/path">` from `next/link`
- `redirect('/path')` from `next/navigation`

### Client Components (require 'use client')
- `useRouter().push('/path')`
- `usePathname()`, `useSearchParams()`

**NEVER:** `window.location.href` for internal navigation, `useRouter` in Server Components.

---

## 6. Data Fetching

### With Convex — Use Hooks in Client Components
```tsx
'use client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function TaskList() {
  const tasks = useQuery(api.tasks.list);
  const createTask = useMutation(api.tasks.create);

  if (tasks === undefined) return <div>Loading...</div>;

  return (
    <div>
      {tasks.map((task) => <div key={task._id}>{task.title}</div>)}
      <button onClick={() => createTask({ title: 'New task' })}>Add</button>
    </div>
  );
}
```

### Without Convex — Server Component Fetch
```tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 },
  }).then((r) => r.json());
  return <div>{data.title}</div>;
}
```

### Parallel Fetching — NEVER serial await
```tsx
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()]);
```

### Streaming with Suspense
```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
```

---

## 7. Metadata

Use `metadata` export — NEVER `next/head`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page', description: '...' };

// Dynamic
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post.title };
}
```

---

## 8. Images

Use `next/image` — never `<img>`. External URLs need `images.remotePatterns` in `next.config.ts`.

```tsx
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} />

// Fill mode
<div className="relative w-full h-64">
  <Image src="/hero.jpg" alt="Hero" fill className="object-cover" />
</div>
```

---

## 9. Server Actions

### File Organization
- `'use server'` at file top = ALL exports are server actions
- Place in `app/actions.ts` (shared) or colocated
- NEVER mix `'use server'` and `'use client'` in same file

### Form Actions MUST Return Void
```tsx
'use server';
export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title) throw new Error('Title required');
  await db.posts.create({ data: { title } });
  revalidatePath('/posts');
  // No return — void
}
```

### useActionState for Feedback
```tsx
'use client';
import { useActionState } from 'react';
const [state, action, isPending] = useActionState(serverAction, null);
```

### Setting Cookies via Server Actions
```tsx
'use server';
import { cookies } from 'next/headers';

export async function setTheme(theme: 'light' | 'dark') {
  const cookieStore = await cookies();
  cookieStore.set('theme', theme, { httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
}
```

---

## 10. Error Handling

```tsx
// error.tsx — requires 'use client'
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <div><p>{error.message}</p><button onClick={reset}>Retry</button></div>;
}

// not-found.tsx
import Link from 'next/link';
export default function NotFound() {
  return <div><h2>Not Found</h2><Link href="/">Home</Link></div>;
}
```

---

## 11. Advanced Routing

### Parallel Routes (`@folder`)
Scope to the feature, not root level. Provide `default.tsx` for unmatched routes.

### Intercepting Routes (`(.)` prefix)
For modal patterns — load route within current layout.

---

## 12. Anti-Patterns Checklist

| Anti-Pattern | Fix |
|---|---|
| `useEffect` for data fetching | Server Component or Convex `useQuery` |
| `useState` for server data | Server Component or Convex `useQuery` |
| `'use client'` on static components | Remove — keep as Server Component |
| `getServerSideProps` / `getStaticProps` | Async Server Components |
| `next/head` | `metadata` export |
| Serial `await` | `Promise.all` |
| `window.location.href` | `<Link>` or `useRouter` |
| Client importing Server Component | Composition (children) |
| API route for simple data | Server Component or Convex |
| Missing Suspense for `useSearchParams` | Wrap in `<Suspense>` |
| `<img>` tag | `next/image` |
| Returning data from form actions | Return void or use `useActionState` |

---

## 13. Tailwind v4 + shadcn/ui

Templates are pre-configured. **NEVER** run scaffolding, `npx shadcn init`, or install deps.

### CSS Architecture

**1. CSS vars at root level** (NOT inside `@layer base`):
```css
@import "tailwindcss";

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 84% 4.9%);
  --primary: hsl(221.2 83.2% 53.3%);
  /* ... */
}
.dark {
  --background: hsl(222.2 84% 4.9%);
  /* ... */
}
```

**2. `@theme inline`** to map variables:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  /* ... map ALL semantic colors + radius */
}
```

**3. Base styles in `@layer base`:**
```css
@layer base { body { background-color: var(--background); color: var(--foreground); } }
```

### Tailwind v4 Rules

**NEVER:** `:root`/`.dark` inside `@layer base`, nested `@theme`, double `hsl()` wrapping, `tailwind.config.ts`, `@apply`, `dark:` variants for semantic colors, `tailwindcss-animate`.

| Symptom | Fix |
|---|---|
| `bg-primary` doesn't work | Add `--color-primary: var(--primary)` to `@theme inline` |
| Colors black/white | Remove double `hsl()` wrapping |
| Dark mode not switching | Wrap app in `<ThemeProvider>` |
| Build fails | Delete `tailwind.config.ts` |

---

## 14. Convex — Functions & Schema

### Schema Definition
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    completed: v.boolean(),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "completed"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
});
```

### Query Functions
```typescript
// convex/tasks.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      title: v.string(),
      completed: v.boolean(),
      userId: v.id("users"),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});
```

### Mutation Functions
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { title: v.string(), userId: v.id("users") },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      title: args.title,
      completed: false,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined),
    );
    if (Object.keys(cleanUpdates).length > 0) {
      await ctx.db.patch("tasks", taskId, cleanUpdates);
    }
    return null;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("tasks", args.taskId);
    return null;
  },
});
```

### Error Handling with ConvexError
```typescript
import { ConvexError } from "convex/values";

// In handler:
const task = await ctx.db.get("tasks", args.taskId);
if (!task) {
  throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
}
```

### Using Convex in React (Client Components)
```tsx
'use client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function TaskList({ userId }: { userId: string }) {
  const tasks = useQuery(api.tasks.list, { userId });
  const createTask = useMutation(api.tasks.create);
  const deleteTask = useMutation(api.tasks.remove);

  if (tasks === undefined) return <div>Loading...</div>;

  return (
    <div>
      <ul>
        {tasks.map((task) => (
          <li key={task._id}>
            {task.title}
            <button onClick={() => deleteTask({ taskId: task._id })}>Delete</button>
          </li>
        ))}
      </ul>
      <button onClick={() => createTask({ title: 'New Task', userId })}>
        Add Task
      </button>
    </div>
  );
}
```

### Convex Best Practices
- **Always validate args AND returns** — use `args: {}` and `returns: v.xxx()`
- **Use indexes** for all filtered queries — never `.filter()` alone
- **Make mutations idempotent** — check current state before updating
- **Patch directly** when you don't need to read first
- **Use `Promise.all`** for parallel independent updates
- **Organize by domain** — `users.ts`, `tasks.ts`, etc.
- **Use `internalMutation`/`internalQuery`** for server-only functions
- **Never run `npx convex deploy`** unless explicitly instructed
- Convex queries are reactive — think subscriptions, not requests
