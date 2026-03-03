---
name: vite-anti-patterns
description: "Common Vite + React anti-patterns and mistakes. Use when building React apps with Vite to avoid build errors, environment variable issues, and incorrect patterns."
---

# Vite + React Anti-Patterns

## Overview

Common mistakes and anti-patterns when building React applications with Vite. Covers environment variables, build configuration, and React-specific issues.

## TypeScript: NEVER Use `any` Type

**CRITICAL RULE:** Using `any` will cause lint failures.

**❌ WRONG:**
```typescript
function handleClick(e: any) { ... }
const data: any[] = [];
```

**✅ CORRECT:**
```typescript
function handleClick(e: React.MouseEvent<HTMLButtonElement>) { ... }
const data: string[] = [];
```

## Category 1: Environment Variable Anti-Patterns

### Anti-Pattern 1.1: Using process.env in Vite

**❌ WRONG - process.env doesn't work in Vite:**
```typescript
// This will be undefined in Vite!
const apiUrl = process.env.REACT_APP_API_URL;
const apiKey = process.env.API_KEY;
```

**✅ CORRECT - Use import.meta.env:**
```typescript
// Vite uses import.meta.env
const apiUrl = import.meta.env.VITE_API_URL;
const apiKey = import.meta.env.VITE_API_KEY;
```

**Important rules:**
- All client-side env vars MUST start with `VITE_`
- Env vars without `VITE_` prefix are NOT exposed to client code
- Use `.env` file in project root

**.env file:**
```bash
# These are exposed to the browser (prefix with VITE_)
VITE_API_URL=https://api.example.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# These are NOT exposed (no VITE_ prefix) - server-side only
DATABASE_URL=postgresql://...
SECRET_KEY=supersecret
```

### Anti-Pattern 1.2: Not Typing Environment Variables

**❌ WRONG - No type safety:**
```typescript
const url = import.meta.env.VITE_API_URL; // Type is 'any'
```

**✅ CORRECT - Create env.d.ts:**
```typescript
// src/vite-env.d.ts (or env.d.ts)
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Now you get autocomplete and type checking for env vars.

## Category 2: Build Configuration Anti-Patterns

### Anti-Pattern 2.1: Not Configuring Base Path for Deployment

**❌ WRONG - Works locally but breaks on GitHub Pages, Vercel subpath:**
```typescript
// vite.config.ts - missing base
export default defineConfig({
  plugins: [react()],
});
```

**✅ CORRECT - Set base for non-root deployments:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/my-app/', // For GitHub Pages: https://user.github.io/my-app/
});
```

### Anti-Pattern 2.2: Not Configuring Path Aliases

**❌ WRONG - Relative import hell:**
```typescript
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../../hooks/useAuth';
```

**✅ CORRECT - Configure path aliases:**

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Now you can:**
```typescript
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
```

### Anti-Pattern 2.3: Not Handling Assets Correctly

**❌ WRONG - Public folder path issues:**
```typescript
// This may not work
<img src="/images/logo.png" alt="Logo" />
```

**✅ CORRECT - Import assets or use public folder correctly:**

**Option 1: Import (recommended for build optimization):**
```typescript
import logo from '@/assets/logo.png';

function Header() {
  return <img src={logo} alt="Logo" />;
}
```

**Option 2: Public folder (for static assets):**
```
public/
  images/
    logo.png
```
```typescript
// Reference from public folder - note: no /public prefix
<img src="/images/logo.png" alt="Logo" />
```

## Category 3: React-Specific Anti-Patterns

### Anti-Pattern 3.1: Not Using React.StrictMode

**❌ WRONG - Missing StrictMode:**
```typescript
// main.tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

**✅ CORRECT - Wrap with StrictMode:**
```typescript
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### Anti-Pattern 3.2: Incorrect Fast Refresh Setup

**❌ WRONG - Exporting non-components breaks Fast Refresh:**
```typescript
// Button.tsx - mixing exports breaks Fast Refresh
export const BUTTON_SIZES = { sm: 'small', lg: 'large' };

export function Button() {
  return <button>Click</button>;
}
```

**✅ CORRECT - Keep component files pure:**
```typescript
// constants.ts - separate file for constants
export const BUTTON_SIZES = { sm: 'small', lg: 'large' };

// Button.tsx - only component exports
import { BUTTON_SIZES } from './constants';

export function Button() {
  return <button>Click</button>;
}
```

### Anti-Pattern 3.3: Not Using Lazy Loading for Routes

**❌ WRONG - All routes loaded upfront:**
```typescript
import Home from './pages/Home';
import About from './pages/About';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

const routes = [
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
];
```

**✅ CORRECT - Lazy load routes:**
```typescript
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

## Category 4: CSS and Styling Anti-Patterns

### Anti-Pattern 4.1: Not Configuring Tailwind Properly

**❌ WRONG - Tailwind not scanning files:**
```javascript
// tailwind.config.js - wrong content paths
export default {
  content: ['./src/**/*.js'],  // Missing tsx!
  theme: {},
};
```

**✅ CORRECT - Include all file extensions:**
```javascript
// tailwind.config.js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Anti-Pattern 4.2: Missing CSS Import in Main File

**❌ WRONG - CSS not imported:**
```typescript
// main.tsx - missing CSS import
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

**✅ CORRECT - Import CSS in main.tsx:**
```typescript
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';  // Import global CSS including Tailwind

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Category 5: Development Server Anti-Patterns

### Anti-Pattern 5.1: Not Configuring Proxy for API Calls

**❌ WRONG - CORS errors during development:**
```typescript
// Calling external API directly causes CORS issues
fetch('http://localhost:8000/api/users');
```

**✅ CORRECT - Configure Vite proxy:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

Now API calls work without CORS:
```typescript
// This is proxied to http://localhost:8000/api/users
fetch('/api/users');
```

### Anti-Pattern 5.2: Not Exposing Dev Server to Network

**❌ WRONG - Can't access from mobile device:**
```bash
npm run dev  # Only accessible on localhost
```

**✅ CORRECT - Expose to network:**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // Expose to network
    port: 3000,
  },
});
```

Or via CLI:
```bash
npm run dev -- --host
```

## Detection Checklist

When reviewing Vite + React code, check for:

- [ ] `process.env` usage → Replace with `import.meta.env`
- [ ] Env vars without `VITE_` prefix → Add prefix for client-side vars
- [ ] Missing vite-env.d.ts → Create for type-safe env vars
- [ ] Deep relative imports → Configure path aliases
- [ ] Missing StrictMode → Add to main.tsx
- [ ] All routes eager loaded → Use lazy() for code splitting
- [ ] Tailwind not working → Check content paths in config
- [ ] CORS errors → Configure server proxy
- [ ] Assets 404 → Use imports or check public folder path

## Common Vite Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Type check
npx tsc --noEmit

# Lint
npm run lint
```
