# Session log (resume here)

Append a new **dated section** at the **top** after each work block (human or agent). Keep **Current state** and **Next steps** accurate so a fresh session can continue without guessing.

---

## Current state (update when this file changes)

- **Git:** Root `.gitignore` ignores `node_modules/`, `.env` (not `.env.example`), build artifacts.
- **Monorepo:** npm workspaces (`packages/*`, `apps/*`). Root scripts proxy to `@delicious24/db`.
- **Implemented:**
  - `packages/db` — Prisma 6 schema + initial migration committed.
  - `apps/api` — Full NestJS backend: orders, payments, webhook, scheduler, sync, customers, menu, pending payments, audit, trust engine, BullMQ workers. All Phase 1 bug fixes applied (backoff, rounding removal, idempotency, trust score atomicity, reminder timing, parser upgrade, customer CRUD, pending payments pagination, sync upsert).
  - Test skeletons: `trust-engine.service.spec.ts`, `wat.service.spec.ts`, `parse-inbound-amount.spec.ts`.
  - OpenAPI: `/api/docs` served by Swagger UI; `apps/api/openapi.json` exported.
- **No frontend yet:** `apps/console` (Next.js) is Phase 2.

## Next steps

1. Build `apps/console` (Next.js 14 admin UI) — Phase 2.
2. Replace `NotificationSenderService` logger stub with real SMS/WhatsApp/email adapter.
3. Post-UI module restructuring (Approach C): Facade pattern for Credits/Orders orchestration.

---

## 2026-04-08 — Backend Phase 1 fixes and quality uplift

**What we did**

- Fixed BullMQ retry backoff (was 1m/2m/4m, now 1m/5m/20m via custom strategy).
- Removed settlement rounding from `confirmPayment` — amounts stored as received.
- Fixed idempotency interceptor to store and replay correct HTTP status code.
- Merged PAID order trust score event into the order creation DB transaction (was a separate second transaction — data integrity gap).
- Fixed WAT reminder timing: courtesy = due−1d, urgent = due date, overdue = due+1d.
- Upgraded inbound webhook parser: multi-keyword, k-suffix (5k→5000), 1–99 integers treated as thousands.
- Added `POST /api/customers` and `PATCH /api/customers/:id` endpoints.
- Added filtering, pagination, and `PATCH` status to pending payments.
- Implemented real CUSTOMER/MENU_ITEM upsert in offline sync (was returning fake UUIDs).
- Added `apps/api/.env.example`.
- Added test skeletons (TrustEngine, WatService, Parser).
- Added OpenAPI/Swagger at `/api/docs`.
- Updated this session log.

---

## 2026-04-07 — Documentation and workflow conventions

**What we did**

- User asked to **always explain work as it happens** and to **update markdown docs** so work can resume if a session is lost.
- Added **`docs/README.md`**: index of all project documentation with a clear “resume” reading order.
- Added **`docs/DEVELOPMENT.md`**: setup, scripts, repo layout, and explicit rules for agents/humans (narrate changes + update `SESSION_LOG.md` + touch related docs).
- Added **`docs/SESSION_LOG.md`** (this file): rolling log with **Current state** and **Next steps**.
- Updated **`docs/architecture.md`**: new “Documentation map” section at the top linking to the above files (architecture stays the design spec; operational/resume info lives in the other docs).
- Added **root `README.md`**: one-line pointer to `docs/README.md` so cloning the repo surfaces the resume path.

**Why**

- Single place (`SESSION_LOG.md`) answers “what exists / what’s next” without re-scanning the repo.
- `DEVELOPMENT.md` captures commands and conventions once, so they are not only in chat history.

---

## 2026-04-06 — Initial architecture split and Prisma package

**What we did**

- User chose **split** documentation: design in markdown, schema in Prisma.
- Created **`docs/architecture.md`**: diagrams, flows, modules, DTOs, BullMQ, integrity rules; links to Prisma for canonical tables.
- Created **`packages/db/prisma/schema.prisma`**: full schema from the field list (UUID PKs except `menu_items` autoincrement).
- Wired root **`package.json`** workspaces and `db:*` scripts; **`packages/db/package.json`** with Prisma; **`turbo.json`** tasks; **`packages/db/.env.example`** for `DATABASE_URL`.
- Ran `npm install` and `prisma validate` successfully.

**Next at the time**

- Configure `.env` and run migrations; scaffold Nest and Next apps when ready.
