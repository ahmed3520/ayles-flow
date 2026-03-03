---
name: tailwind-v4-shadcn
description: Tailwind CSS v4 + shadcn/ui patterns. Breaking changes from v3.
---

# Tailwind v4 + shadcn/ui

Templates are pre-configured. NEVER run scaffolding, `npx shadcn init`, or install tailwindcss/shadcn deps.

## CSS Architecture (4 steps — all in `index.css`)

### 1. Define CSS variables at root level (NOT inside `@layer base`)

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
  --primary: hsl(217.2 91.2% 59.8%);
}
```

### 2. Map variables to Tailwind utilities via `@theme inline`

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

Without `@theme inline`, utilities like `bg-background`, `border-border`, `ring-ring` won't exist.

### 3. Apply base styles

```css
@layer base {
  body {
    background-color: var(--background);
    color: var(--foreground);
  }
}
```

### 4. Use semantic tokens — dark mode switches automatically

```tsx
<div className="bg-background text-foreground border-border">
  {/* No dark: variants needed */}
</div>
```

## Rules

**DO:**
- Wrap color values with `hsl()` in `:root` and `.dark`
- Use `@theme inline` to map all CSS variables
- Set `"tailwind.config": ""` in `components.json`
- Use `cn()` for conditional classes: `cn("base", isActive && "active")`
- Use `@plugin` directive for plugins: `@plugin "@tailwindcss/typography";`
- Use semantic tokens: `bg-primary`, `text-destructive`, `border-border`

**NEVER:**
- Put `:root`/`.dark` inside `@layer base`
- Use `.dark { @theme { } }` — v4 doesn't support nested @theme
- Double-wrap: `hsl(var(--background))` — use `var(--background)` directly
- Use `tailwind.config.ts` for theme — v4 ignores it
- Use `@apply` — deprecated in v4
- Use `dark:` variants for semantic colors — theme switches automatically
- Install `tailwindcss-animate` or `tw-animate-css` — deprecated in v4

## Common Errors

| Symptom | Fix |
|---------|-----|
| `bg-primary` doesn't work | Add `--color-primary: var(--primary)` to `@theme inline` |
| `border-border` unknown | Add `--color-border: var(--border)` to `@theme inline` |
| Colors all black/white | Remove double `hsl()` wrapping |
| Dark mode not switching | Wrap app in `<ThemeProvider>` |
| Build fails | Delete `tailwind.config.ts` |
| Plugin errors | Use `@plugin "@tailwindcss/typography"` not `require()` |
