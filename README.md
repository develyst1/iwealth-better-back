# iwealth-better-back

v0 stub API — Bun + Hono + TypeScript + PostgreSQL + Drizzle ORM.

Implements thin contracts from [iwealth-better-spec](https://github.com/develyst1/iwealth-better-spec) `@ 30b98e0` / testcases `@ 945ea0e`:
`docs/contracts/{api,auth,db}.md`, `docs/adapters/{llm,market-data}.md`, `docs/domain/model.md`.

## Stack

| Piece | Choice |
|-------|--------|
| Runtime | Bun |
| HTTP | Hono |
| DB | PostgreSQL + Drizzle (SQL migrations in `drizzle/`) |
| Password | **argon2id** via `Bun.password` |
| Auth token | **JWT (HS256)** Bearer — no `sessions` table in v0 |
| Market / events | **Stub** adapters (synthetic EOD ≤2y; filing events; news/earnings sparse stubs) |
| LLM | Back-only proxy → `LLM_GATEWAY_URL` (`POST /chat`) |

UI library changes on the front (e.g. no Mantine) do **not** affect this repo.

## Auth (documented choice)

- Register / login return `{ user, token }` where `token` is a JWT signed with `JWT_SECRET`.
- Client sends `Authorization: Bearer <token>`.
- Logout is contract-parity: JWT is stateless — client drops the token; server returns `{ ok: true }`.
- Opaque session table is intentionally skipped (allowed by `auth.md` / `db.md`).

## Range policy (>2 years)

Windows longer than **2 years** are **clamped** to the last 2 years ending at `to` (or today). Responses may include `clamped: true`. (Alternative of hard 400 was not chosen.)

## Ownership

Accessing another user's portfolio → **404** `Portfolio not found` (stable; does not leak existence).

## Quick start

### 1. Postgres

```bash
docker compose up -d
# host port 5433 → container 5432 (avoids clashing with other local DBs)
```

Or point `DATABASE_URL` at any Postgres 14+.

### 2. Env

```bash
cp .env.example .env
# set DATABASE_URL, JWT_SECRET, PORT, LLM_GATEWAY_URL
# optional: LLM_GATEWAY_AUTH (Bearer token for gateway — server only, never commit)
```

### 3. Install, migrate, optional seed

```bash
bun install
bun run db:setup   # migrate + optional demo user
```

Demo seed (optional): `demo@iwealth.local` / `demo-pass-123`.

### 4. Run

```bash
bun run dev
# → http://localhost:3010
curl http://localhost:3010/health
curl http://localhost:3010/api/v0/health
```

### 5. Smoke

```bash
bun run smoke
```

## API (`/api/v0`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` (also root `/health`) | no |
| POST | `/auth/register` `{ email, password }` | no |
| POST | `/auth/login` | no |
| POST | `/auth/logout` | yes |
| GET | `/auth/me` | yes |
| GET/POST | `/portfolios` | yes |
| GET/PATCH/DELETE | `/portfolios/:id` | yes |
| PUT | `/portfolios/:id/holdings` `{ symbol, quantity, avgCost }` | yes |
| DELETE | `/portfolios/:id/holdings/:symbol` | yes |
| GET | `/market/bars?symbol=&from=&to=` | yes |
| GET | `/market/events?symbol=&from=&to=&types=` | yes |
| POST | `/compare` `{ symbol, from?, to?, eventTypes? }` | yes |
| POST | `/compare/summarize` `{ compare, question? }` | yes |

Errors: `{ error, code? }` with 400 / 401 / 403 / 404 / 409 / 503.

### LLM summarize

- Back calls `POST {LLM_GATEWAY_URL}/chat` with messages built from the provided `CompareResult` only.
- If `LLM_GATEWAY_URL` is missing → **503** `{ code: "LLM_UNAVAILABLE" }`.
- Prompt forbids inventing prices and unconditional investment advice.
- Front must never hold gateway keys.

### LLM gateway notes (from inbox Bruno samples)

- Base: `https://ai.develyst.online`
- `POST /chat` body: `{ messages: [{ role, content }, ...] }`
- Success: `{ success: true, data: { content, provider, model, latency_ms, usage } }`
- Fallback chain when provider omitted: deepseek → xai → gemini → openai

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run dev` | Hot-reload server |
| `bun run start` | Production-style start |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed` | Optional demo user |
| `bun run db:setup` | migrate + seed |
| `bun run smoke` | Happy/fail HTTP smoke vs running server |

## Hard no (v0)

- Real vendor market/news feeds
- Secrets in git
- Deploy
- Invented endpoints beyond contracts
