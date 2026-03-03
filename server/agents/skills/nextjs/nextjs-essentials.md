---
name: nextjs-essentials
description: Comprehensive Next.js App Router + Tailwind v4 + shadcn/ui essentials. Covers server/client components, routing, data fetching, navigation, server actions, cookies, searchParams, images, error handling, streaming, and all major patterns. Auto-injected for nextjs templates.
---

# Next.js App Router Essentials

Comprehensive reference for Next.js 15+ App Router with Tailwind v4 and shadcn/ui. For deeper examples on a specific topic, use `load_skill("skill-name")`.

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
- Fetch data from APIs/databases, access env vars, process secrets

### Server Components CANNOT:
- Use `useState`, `useEffect`, `useContext`, or any React hooks
- Use `useRouter()`, `usePathname()`, `useSearchParams()`
- Use browser APIs (`window`, `localStorage`, `navigator`)
- Have event handlers (`onClick`, `onChange`, etc.)

### Client Components REQUIRE `'use client'` for:
- Interactive elements (onClick, onChange, onSubmit)
- React hooks (useState, useEffect, useContext, useRef)
- Browser APIs (window, localStorage, navigator, WebSocket)
- Third-party client libraries (maps, charts, etc.)
- React Context providers/consumers

### `'use client'` Boundary Rule
Only add to the **LOWEST** component that needs interactivity. Never on layouts or pages that don't need it. A page importing a client component does NOT need `'use client'` itself.

### Composition Pattern — Server Inside Client
Never import a Server Component into a Client Component (it becomes client). Pass it as `children`:

```tsx
// Server parent composes both
import ClientWrapper from './ClientWrapper';
import ServerContent from './ServerContent';

export default function Page() {
  return (
    <ClientWrapper>
      <ServerContent />  {/* Stays server */}
    </ClientWrapper>
  );
}

// ClientWrapper.tsx
'use client';
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return <div>{isOpen && children}</div>;
}
```

### Decision Tree
```
Need interactivity/hooks/browser APIs? → 'use client'
Need to fetch data/access cookies/headers? → Server Component (default)
Static content only? → Server Component (default)
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
- `template.tsx` — like layout but re-renders on navigation

Only `page.tsx` and `route.ts` create public routes. Other files are NOT routable.

### Dynamic Routes
```
app/[id]/page.tsx              → /123, /abc
app/blog/[slug]/page.tsx       → /blog/hello-world
app/[cat]/[id]/page.tsx        → /electronics/123
app/docs/[...slug]/page.tsx    → /docs/a, /docs/a/b (catch-all)
app/shop/[[...slug]]/page.tsx  → /shop, /shop/a, /shop/a/b (optional catch-all)
```

### Route Groups
`(marketing)/about/page.tsx` — groups without affecting URL.

### Avoid Over-Nesting
Default to the simplest structure. "Fetch product by ID" → `app/[id]/page.tsx`, NOT `app/products/[id]/page.tsx`, unless the URL explicitly requires it.

---

## 4. Params & searchParams (Next.js 15+)

Both `params` and `searchParams` are **Promises** — must `await`.

### params
```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchProduct(id);
  return <div>{data.name}</div>;
}
```

### searchParams (Server Component)
```tsx
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  // Inline access — keeps searchParams and param on same line
  const q = (await searchParams).q || '';
  const category = (await searchParams).category || 'all';
  return <div>Search: {q}, Category: {category}</div>;
}
```

### searchParams in Client Components — useSearchParams + Suspense
`useSearchParams()` **REQUIRES** both `'use client'` AND a `<Suspense>` wrapper.

```tsx
// app/page.tsx (Server Component)
import { Suspense } from 'react';
import SearchContent from './SearchContent';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}

// SearchContent.tsx
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  return <div>Search: {query}</div>;
}
```

### useParams in Client Components
```tsx
'use client';
import { useParams } from 'next/navigation';

export function ProductClient() {
  const params = useParams<{ id: string }>();
  return <div>{params.id}</div>;
}
```

---

## 5. Navigation

### Server Components (no 'use client' needed)
- `<Link href="/path">` from `next/link` — client-side navigation
- `redirect('/path')` from `next/navigation` — conditional redirects

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Page() {
  const user = await getUser();
  if (!user) redirect('/login');

  return <Link href="/dashboard">Dashboard</Link>;
}
```

### Client Components (require 'use client')
- `useRouter().push('/path')` — programmatic navigation
- `usePathname()` — current path
- `useSearchParams()` — query params (+ Suspense)

### NEVER use:
- `window.location.href` for internal navigation (full page reload)
- `useRouter()` in Server Components (hooks don't work)
- `'use client'` just for `<Link>` — it works in Server Components

---

## 6. Data Fetching

### Fetch in Server Components — NOT in useEffect
```tsx
// Server Component — direct fetch, no loading state needed
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 },
  }).then((r) => r.json());
  return <div>{data.title}</div>;
}
```

### Parallel Fetching — NEVER serial await
```tsx
// WRONG: serial (3s total if each takes 1s)
const user = await fetchUser();
const posts = await fetchPosts();

// CORRECT: parallel (1s total)
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()]);
```

### Streaming with Suspense
```tsx
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const data = await fetchStats(); // slow query
  return <div>{data.total}</div>;
}
```

### React `use` API — Pass Promises to Client Components
```tsx
// Server Component
export default function Page() {
  const userPromise = fetchUser(); // don't await
  return (
    <Suspense fallback={<Loading />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// Client Component
'use client';
import { use } from 'react';

export function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  return <div>{user.name}</div>;
}
```

### Don't create API routes for data you can fetch directly in Server Components
Only use `route.ts` for webhooks, external API consumers, client mutations.

---

## 7. Metadata

Use `metadata` export — NEVER `next/head`:

```tsx
import type { Metadata } from 'next';

// Static
export const metadata: Metadata = {
  title: 'My Page',
  description: 'Description',
  openGraph: { title: 'My Page', images: ['/og.jpg'] },
};

// Dynamic
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post.title, description: post.excerpt };
}
```

---

## 8. Images

Use `next/image` — never plain `<img>` for local/remote images.

```tsx
import Image from 'next/image';

// Fixed dimensions
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} />

// Fill mode (parent needs relative + dimensions)
<div className="relative w-full h-64">
  <Image src="/hero.jpg" alt="Hero" fill className="object-cover" />
</div>
```

External URLs require `images.remotePatterns` in `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
```

---

## 9. Server Actions

Server actions enable server-side mutations without creating API endpoints.

### File Organization
- `'use server'` at file top = ALL exports are server actions
- Place in `app/actions.ts` (shared) or `app/feature/action.ts` (colocated)
- NEVER mix `'use server'` and `'use client'` in the same file

### Form Actions MUST Return Void
When using `<form action={serverAction}>`, the function **must return void** (no return statement):

```tsx
// app/actions.ts
'use server';
import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title) throw new Error('Title required');
  await db.posts.create({ data: { title } });
  revalidatePath('/posts');
  // No return — void
}

// Usage in page
<form action={createPost}>
  <input name="title" required />
  <button type="submit">Create</button>
</form>
```

### useActionState — When You Need Feedback
```tsx
// app/actions.ts
'use server';

export async function createPost(prevState: unknown, formData: FormData) {
  const title = formData.get('title') as string;
  if (!title) return { error: 'Title required' };
  await db.posts.create({ data: { title } });
  return { success: true, message: 'Created!' };
}

// Client Component
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

export default function Form() {
  const [state, action, isPending] = useActionState(createPost, null);
  return (
    <form action={action}>
      <input name="title" required />
      <button disabled={isPending}>{isPending ? 'Creating...' : 'Create'}</button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}
```

### Client Component Calling Server Action
```tsx
// app/actions.ts
'use server';
import { cookies } from 'next/headers';

export async function setTheme(theme: 'light' | 'dark') {
  const cookieStore = await cookies();
  cookieStore.set('theme', theme, { httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
}

// ThemeToggle.tsx
'use client';
import { setTheme } from './actions';

export default function ThemeToggle() {
  return <button onClick={() => setTheme('dark')}>Dark Mode</button>;
}
```

### Revalidation and Redirection
```tsx
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deletePost(id: string) {
  await db.posts.delete({ where: { id } });
  revalidatePath('/posts');
  redirect('/posts');
}
```

---

## 10. Route Handlers (API Routes)

Create in `route.ts` files. Export named functions for HTTP methods.

```tsx
// app/api/posts/route.ts
export async function GET(request: Request) {
  const posts = await db.posts.findMany();
  return Response.json(posts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const post = await db.posts.create({ data: body });
  return Response.json(post, { status: 201 });
}

// Dynamic: app/api/posts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return Response.json(await db.posts.findById(id));
}
```

### Cookies & Headers in Route Handlers
```tsx
import { cookies, headers } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const headersList = await headers();
  const auth = headersList.get('authorization');
  // ...
}
```

---

## 11. Error Handling

### error.tsx (requires 'use client')
```tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### not-found.tsx
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <Link href="/">Return Home</Link>
    </div>
  );
}
```

Trigger programmatically: `notFound()` from `next/navigation`.

### global-error.tsx — catches root layout errors
Must include `<html>` and `<body>` tags.

---

## 12. Layouts

```tsx
// app/layout.tsx — Root (REQUIRED)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// app/blog/layout.tsx — Nested
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <BlogSidebar />
      <main>{children}</main>
    </div>
  );
}
```

Layouts preserve state across navigation and don't re-render on route changes.

---

## 13. Static Generation — generateStaticParams

Replaces `getStaticPaths` from Pages Router:

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = true; // default: non-pre-rendered paths generated on-demand
// dynamicParams = false → returns 404 for non-pre-rendered paths
```

Must be in a Server Component (no `'use client'`). Must be exported.

---

## 14. Advanced Routing

### Parallel Routes
Use `@folder` syntax to render multiple pages simultaneously:

```
app/dashboard/
├── @analytics/page.tsx
├── @activity/page.tsx
├── layout.tsx          ← accepts analytics, activity slots
└── page.tsx
```

```tsx
export default function Layout({
  children,
  analytics,
  activity,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  activity: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <aside>{analytics}</aside>
      <aside>{activity}</aside>
    </div>
  );
}
```

Provide `default.tsx` for unmatched routes. Scope parallel routes to the feature, not root level.

### Intercepting Routes
Use `(.)` prefix to load a route within the current layout (modal pattern):

```
app/
├── photos/[id]/page.tsx       ← full page
├── @modal/(.)photos/[id]/page.tsx  ← modal view
└── @modal/default.tsx         ← returns null
```

---

## 15. Cookies

### Read in Server Components
```tsx
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value || 'light';
  return <div className={theme}>Content</div>;
}
```

### Set via Server Actions (client trigger)
```tsx
// actions.ts
'use server';
import { cookies } from 'next/headers';

export async function setPreference(key: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

// ClientButton.tsx
'use client';
import { setPreference } from './actions';

export function ClientButton() {
  return <button onClick={() => setPreference('theme', 'dark')}>Dark</button>;
}
```

---

## 16. Anti-Patterns Checklist

| Anti-Pattern | Fix |
|---|---|
| `useEffect` for data fetching | Server Component with async/await |
| `useState` for server data | Fetch in Server Component |
| `useState` for derived values | Calculate directly or `useMemo` |
| `'use client'` on static components | Remove — keep as Server Component |
| `getServerSideProps` / `getStaticProps` | Async Server Components |
| `next/head` | `metadata` export |
| Serial `await` | `Promise.all` for parallel fetching |
| `window.location.href` for navigation | `<Link>` or `useRouter` |
| Client importing Server Component | Composition pattern (children) |
| API route for simple data | Fetch in Server Component directly |
| `useRouter` in Server Component | `<Link>` or `redirect()` |
| Missing Suspense for `useSearchParams` | Wrap in `<Suspense>` |
| `<img>` tag | `next/image` with width/height or fill |
| Returning data from form actions | Return void, or use `useActionState` |
| `'use server'` in client file | Separate into actions.ts file |

---

## 17. Tailwind v4 + shadcn/ui

Templates are pre-configured. **NEVER** run scaffolding, `npx shadcn init`, or install tailwindcss/shadcn deps.

### CSS Architecture (globals.css / index.css)

**1. Define CSS vars at root level** (NOT inside `@layer base`):
```css
@import "tailwindcss";

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 84% 4.9%);
  --primary: hsl(221.2 83.2% 53.3%);
  --primary-foreground: hsl(210 40% 98%);
  /* ... all semantic colors with hsl() wrapper */
}

.dark {
  --background: hsl(222.2 84% 4.9%);
  --foreground: hsl(210 40% 98%);
}
```

**2. Map variables to Tailwind utilities via `@theme inline`:**
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

Without `@theme inline`, utilities like `bg-background`, `border-border` won't exist.

**3. Base styles in `@layer base`:**
```css
@layer base {
  body { background-color: var(--background); color: var(--foreground); }
}
```

**4. Use semantic tokens — dark mode switches automatically:**
```tsx
<div className="bg-background text-foreground border-border">
  {/* No dark: variants needed */}
</div>
```

### Tailwind v4 Rules

**DO:** Use `hsl()` values in `:root`/`.dark`, `@theme inline`, `cn()` for conditionals, `@plugin` for plugins, semantic tokens.

**NEVER:**
- Put `:root`/`.dark` inside `@layer base`
- Use `.dark { @theme { } }` — v4 doesn't support nested @theme
- Double-wrap: `hsl(var(--background))` — variables already contain `hsl()`
- Use `tailwind.config.ts` — v4 ignores it
- Use `@apply` — deprecated in v4
- Use `dark:` variants for semantic colors — theme auto-switches
- Install `tailwindcss-animate` / `tw-animate-css` — deprecated

### Common Errors

| Symptom | Fix |
|---|---|
| `bg-primary` doesn't work | Add `--color-primary: var(--primary)` to `@theme inline` |
| `border-border` unknown | Add `--color-border: var(--border)` to `@theme inline` |
| Colors all black/white | Remove double `hsl()` wrapping |
| Dark mode not switching | Wrap app in `<ThemeProvider>` |
| Build fails | Delete `tailwind.config.ts` |
| Plugin errors | Use `@plugin "@tailwindcss/typography"` not `require()` |
