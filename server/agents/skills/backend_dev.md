---
name: backend-dev
description: |
  Production patterns for backend API development with Express, Hono, and FastAPI.

  Use when: building REST APIs, setting up authentication, designing database schemas,
  implementing error handling, structuring backend projects, or debugging API issues.

  Covers: route patterns, JWT auth middleware, input validation, error handling,
  database setup (Supabase, Prisma, SQLite), CORS configuration, project structure,
  common backend mistakes and fixes.

  Keywords: Express, Hono, FastAPI, REST API, JWT, authentication, middleware,
  validation, error handling, database, Supabase, Prisma, CORS, backend structure
---

# Backend Development — Production Patterns

## Development Thinking

Before coding, think through these perspectives:

- **Architecture**: What's the right route structure? How should concerns be separated (routes → controllers → services → data)?
- **Security**: How is auth handled? Are inputs validated? Are secrets safe? Is CORS configured?
- **Database**: What's the right schema? Are queries efficient? Is data consistent?
- **Performance**: Are there N+1 queries? Should anything be cached? Are responses paginated?

Don't over-engineer — apply these as appropriate for the project's scale. A simple CRUD app doesn't need microservices.

---

## Project Structure Patterns

### Express / Hono (Node.js)

```
src/
├── routes/          # Route definitions — one file per resource
│   ├── products.ts
│   ├── auth.ts
│   ├── cart.ts
│   └── orders.ts
├── middleware/       # Reusable middleware
│   ├── auth.ts      # JWT verification
│   ├── validate.ts  # Input validation
│   └── error.ts     # Error handler
├── services/        # Business logic (optional — use for complex logic)
│   └── order.ts
├── db/              # Database setup and queries
│   ├── client.ts    # DB connection (Supabase/Prisma/SQLite)
│   └── seed.ts      # Seed data (if needed)
├── types/           # Shared TypeScript types
│   └── index.ts
└── index.ts         # Server entry point
```

### FastAPI (Python)

```
app/
├── routes/          # Route definitions
│   ├── products.py
│   ├── auth.py
│   ├── cart.py
│   └── orders.py
├── middleware/       # Middleware
│   └── auth.py
├── models/          # Pydantic models
│   └── schemas.py
├── db/              # Database
│   ├── client.py
│   └── seed.py
├── services/        # Business logic (optional)
│   └── order.py
└── main.py          # App entry point
```

**Keep it flat.** Only add `services/` if business logic is genuinely complex. For simple CRUD, put logic directly in route handlers.

---

## Route Patterns

### Express

```typescript
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/api/products", async (req, res) => {
  try {
    const { category, brand, search, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const products = await db.query(/* ... */);
    const total = await db.count(/* ... */);

    res.json({
      products,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/api/products/:id", async (req, res) => {
  try {
    const product = await db.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/api/cart", authMiddleware, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ error: "productId and quantity required" });
    }
    const cart = await addToCart(req.userId, productId, quantity);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: "Failed to add to cart" });
  }
});

export default router;
```

### Hono

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

const app = new Hono();

app.get("/api/products", async (c) => {
  const { category, brand, search, page = "1", limit = "20" } = c.req.query();
  const products = await db.query(/* ... */);
  return c.json({ products, total, page: Number(page) });
});

app.get("/api/products/:id", async (c) => {
  const product = await db.findById(c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json(product);
});

app.post("/api/cart", authMiddleware, async (c) => {
  const { productId, quantity } = await c.req.json();
  const cart = await addToCart(c.get("userId"), productId, quantity);
  return c.json(cart);
});

export default app;
```

### FastAPI

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api")

class CartItem(BaseModel):
    productId: str
    quantity: int

@router.get("/products")
async def list_products(
    category: str = None,
    brand: str = None,
    search: str = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * limit
    products = await db.query(offset=offset, limit=limit)
    total = await db.count()
    return {"products": products, "total": total, "page": page, "totalPages": -(-total // limit)}

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.find_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/cart")
async def add_to_cart(item: CartItem, user_id: str = Depends(get_current_user)):
    cart = await add_item(user_id, item.productId, item.quantity)
    return cart
```

---

## Authentication Patterns

### JWT Auth Middleware (Express)

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

### Token Generation (Login/Register)

```typescript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

router.post("/api/auth/register", async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  const existing = await db.findUserByEmail(email);
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await db.createUser({ fullName, email, password: hashed, role });
  const token = generateToken(user.id);

  res.status(201).json({ user: { id: user.id, fullName, email, role }, token });
});

router.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken(user.id);
  res.json({ user: { id: user.id, fullName: user.fullName, email, role: user.role }, token });
});
```

### JWT Auth (FastAPI)

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

---

## Error Handling

### Consistent Error Format

Pick ONE error format and use it everywhere:

```typescript
// Standard error response
{ "error": "Human-readable message" }

// With status code
res.status(400).json({ error: "productId and quantity required" });
res.status(401).json({ error: "Invalid credentials" });
res.status(404).json({ error: "Product not found" });
res.status(409).json({ error: "Email already exists" });
res.status(500).json({ error: "Internal server error" });
```

### Error Handling Middleware (Express)

```typescript
export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
}

// In index.ts — MUST be registered last
app.use(errorHandler);
```

### FastAPI Error Handling

```python
from fastapi import HTTPException

# FastAPI handles this natively — just raise HTTPException
raise HTTPException(status_code=404, detail="Product not found")

# Response format: { "detail": "Product not found" }
```

**Note**: FastAPI uses `detail` not `error`. If you want `{ error: "..." }` format, use a custom exception handler:

```python
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def custom_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
```

---

## Input Validation

### Express — Manual Validation

```typescript
router.post("/api/products", authMiddleware, async (req, res) => {
  const { title, price, category } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  if (typeof price !== "number" || price <= 0) return res.status(400).json({ error: "Valid price required" });
  if (!category?.trim()) return res.status(400).json({ error: "Category required" });

  const product = await db.createProduct({ title: title.trim(), price, category: category.trim() });
  res.status(201).json(product);
});
```

### FastAPI — Pydantic (automatic)

```python
from pydantic import BaseModel, Field

class CreateProduct(BaseModel):
    title: str = Field(min_length=1)
    price: float = Field(gt=0)
    category: str = Field(min_length=1)

@router.post("/products")
async def create_product(data: CreateProduct):
    # Validation is automatic — 422 on invalid input
    product = await db.create_product(data.dict())
    return product
```

---

## Database Patterns

### Supabase (Node.js)

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function getProducts(filters) {
  let query = supabase.from("products").select("*", { count: "exact" });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { products: data, total: count };
}
```

### Prisma

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getProducts(filters) {
  const where = {};
  if (filters.category) where.category = filters.category;
  if (filters.search) where.title = { contains: filters.search, mode: "insensitive" };

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip: filters.offset, take: filters.limit }),
    prisma.product.count({ where }),
  ]);
  return { products, total };
}
```

### SQLite (better-sqlite3)

```typescript
import Database from "better-sqlite3";
const db = new Database("data.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

function getProducts(filters) {
  const conditions = [];
  const params = [];
  if (filters.category) { conditions.push("category = ?"); params.push(filters.category); }
  if (filters.search) { conditions.push("title LIKE ?"); params.push(`%${filters.search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const products = db.prepare(`SELECT * FROM products ${where} LIMIT ? OFFSET ?`).all(...params, filters.limit, filters.offset);
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...params);
  return { products, total };
}
```

### In-Memory (Mock Data)

```typescript
let products = [/* seed data */];
let nextId = products.length + 1;

function getProducts(filters) {
  let result = [...products];
  if (filters.category) result = result.filter(p => p.category === filters.category);
  if (filters.search) result = result.filter(p => p.title.toLowerCase().includes(filters.search.toLowerCase()));

  const total = result.length;
  const paged = result.slice(filters.offset, filters.offset + filters.limit);
  return { products: paged, total };
}
```

---

## Server Setup

### Express Entry Point

```typescript
import express from "express";
import cors from "cors";
import productRoutes from "./routes/products";
import authRoutes from "./routes/auth";
import cartRoutes from "./routes/cart";
import { errorHandler } from "./middleware/error";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"] }));
app.use(express.json());

app.use(productRoutes);
app.use(authRoutes);
app.use(cartRoutes);
app.use(errorHandler);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### Hono Entry Point

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

const app = new Hono();
app.use("*", cors({ origin: ["http://localhost:3000", "http://localhost:5173"] }));

// Mount routes
app.route("/", productRoutes);
app.route("/", authRoutes);

serve({ fetch: app.fetch, port: 8000 });
```

### FastAPI Entry Point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import products, auth, cart

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(auth.router)
app.include_router(cart.router)
```

---

## Security Checklist

Apply these based on the project's needs:

- **Never expose secrets** — Use environment variables, never hardcode keys/passwords
- **Hash passwords** — Use bcrypt (Node) or passlib (Python), never store plaintext
- **Validate all input** — Check types, lengths, required fields on every endpoint
- **Parameterize queries** — Never concatenate user input into SQL strings
- **Set CORS properly** — Whitelist specific origins, don't use `*` in production
- **Use HTTPS** — In production (sandbox proxies handle this)
- **Rate limit auth endpoints** — Login/register are brute-force targets
- **Don't leak internal errors** — Return generic messages to clients, log details server-side
- **Sanitize output** — Don't return password hashes or internal IDs the client doesn't need

---

## Common Mistakes & Fixes

| Mistake | Fix |
|---------|-----|
| Returning password hash in user response | Exclude password field: `const { password, ...user } = dbUser` |
| No error handling on DB queries | Wrap in try/catch, return `{ error }` response |
| Using `app.use(cors())` with no config | Specify allowed origins explicitly |
| Hardcoding JWT secret | Use `process.env.JWT_SECRET` with fallback for dev |
| Not parsing JSON body | Add `app.use(express.json())` before routes |
| 404 on valid routes | Check route registration order — specific before generic |
| Port already in use | Use `process.env.PORT || 8000` and kill stale processes |
| CORS errors from frontend | Ensure backend CORS allows frontend origin AND methods |
| Returning `500` for user errors | Use `400` for bad input, `401` for auth, `404` for not found |
| Not sending `Content-Type` header | Express `res.json()` sets it automatically — don't use `res.send()` for JSON |
| Forgetting `async` on route handler | Express swallows unhandled promise rejections — always use async/await with try/catch |
| SQLite "database is locked" | Use WAL mode: `db.pragma("journal_mode = WAL")` |

---

## Template-Specific Notes

### vite-express / nextjs-express Templates

- Frontend proxy is pre-configured — frontend calls `/api/*` which routes to backend:8000
- CORS is pre-configured for localhost:3000 and localhost:5173
- Backend runs on port 8000 by default
- `npm run dev` from root starts both frontend and backend
- Backend code goes in `backend/` directory

### fastapi Template

- Uses uvicorn as ASGI server
- Pydantic models for request/response validation (automatic)
- Backend runs on port 8000 by default
- Code goes in root directory (no `backend/` subdirectory)
- Install with `pip install -r requirements.txt`
- Start with `uvicorn app.main:app --reload --port 8000`

---

## Best Practices

- **Keep routes thin** — Route handlers should validate input, call services, return response. Heavy logic goes in services.
- **One resource per file** — `products.ts`, `auth.ts`, `cart.ts`. Don't put all routes in one file.
- **Consistent naming** — `/api/products` (plural), `/api/auth/login` (verb for actions). Pick a convention and stick to it.
- **Return created resources** — `POST` should return the created object, not just `{ success: true }`.
- **Use proper status codes** — `201` for created, `204` for deleted, `400` for bad input, `401` for unauthorized, `404` for not found.
- **Paginate list endpoints** — Always support `page` and `limit` params on lists. Return `total` and `totalPages`.
- **Log errors server-side** — `console.error(err)` in catch blocks. The client gets a clean message, you get the stack trace.
- **Test with curl** — After implementing an endpoint, verify it works: `curl http://localhost:8000/api/products`
