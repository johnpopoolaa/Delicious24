# Session log (resume here)

Append a new **dated section** at the **top** after each work block (human or agent). Keep **Current state** and **Next steps** accurate so a fresh session can continue without guessing.

---

## Current state (update when this file changes)

- **Git:** Root `.gitignore` ignores `node_modules/`, `.env` (not `.env.example`), build artifacts, `.tsbuildinfo` cache files.
- **Monorepo:** npm workspaces (`packages/*`, `apps/*`). Root scripts: `dev:api`, `dev:worker`, `dev:console`, `build:api`, `build:console`, `db:*`. `packageManager` field set in root `package.json` (required by Turbo 2.x).
- **Implemented:**
  - `packages/db` — Prisma 6 schema + 4 migrations applied locally. `OrderType` is `PAID | CREDIT` only. `menu_items.archived_at` nullable column added (soft-archive). Prisma CLI moved to `dependencies` (needed in production Docker image).
  - `apps/api` — Full NestJS backend. All API completeness gaps closed. Global `ApiKeyGuard`. Rate limiting on webhook only. `GET /api/health`. E.164 normalization. Charges field on orders. Trust score thresholds corrected. `DELETE /api/menu-items/:id` soft-archives items.
  - `apps/console` — Next.js 14 admin UI. All pages functional. Inline notifChannel editor on ledger. Cancel/Send Now on scheduled jobs. Soft-archive on menu page. Page-level error boundary (`error.tsx`) with 15s countdown auto-retry. Layout-level error boundary (`global-error.tsx`).
  - `docker-compose.yml` + `apps/api/Dockerfile` — production deployment ready.

## Next steps

1. **Deploy** — provision DigitalOcean droplet, fill production `.env`, run `docker-compose up`, apply migration `20260503000000_add_archived_at_to_menu_items`, point domain, set up nginx + certbot HTTPS. Full checklist in `docs/V1_TODO.md`.
2. **WhatsApp production** — apply for WhatsApp Business API via Twilio (sandbox requires recipient opt-in).
3. **Smoke-test remaining flows** — inbound webhook → pending payment → confirm payment end-to-end.
4. **Nice-to-have complete** — all V1 non-blocking items are done. Backlog items remain (trust score graph, CSV import, mobile layout, facade refactor).

---

## 2026-05-03 — Nice-to-have features; deployment checklist expanded

**What we did**

**Menu item soft-archive:**
- New migration `20260503000000_add_archived_at_to_menu_items` adds nullable `archived_at` to `menu_items`.
- `packages/db/prisma/schema.prisma` — `archivedAt DateTime?` field added to `MenuItem` model.
- `apps/api/src/menu/menu.service.ts` — `list()` filters `where: { archivedAt: null }`; `archive(id)` sets `archivedAt = now()`.
- `apps/api/src/menu/menu.controller.ts` — `DELETE /api/menu-items/:id` calls `archive()`.
- `apps/console/src/lib/api.ts` — `deleteMenuItem(id)` added.
- `apps/console/src/app/menu/page.tsx` — Delete button with confirm dialog; item removed from list on success.
- Chose soft-archive: hard delete blocked by `order_lines` FK constraint.

**Scheduled jobs Cancel / Send Now buttons:**
- `apps/console/src/app/scheduled-jobs/page.tsx` — Actions column added. "Send Now" (orange) for PENDING/FAILED; "Cancel" (gray) for PENDING/RUNNING. Per-row loading + error state; confirm dialogs before both actions. (`cancelJob` / `sendJobNow` were already in `api.ts`.)

**Inline notifChannel editor on customer ledger:**
- `apps/console/src/app/customers/[id]/page.tsx` — 3-button toggle (WhatsApp / SMS / Both) replaces read-only text. Saves immediately via `PATCH /api/customers/:id`.

**Global error boundary:**
- `apps/console/src/app/error.tsx` (new) — page-level boundary. Classifies errors by message pattern: network, 401, 403, 404, 429, 502/503/504, 5xx, fallback. 15s auto-retry countdown with animated progress bar. Collapsible technical details.
- `apps/console/src/app/global-error.tsx` (new) — layout-level crash fallback with own `<html>/<body>`. Static descriptive message + "Try again" button.

**Deployment checklist expanded (`docs/V1_TODO.md`):**
- Added: `ufw` firewall rules, DNS A record step, nginx + certbot HTTPS, CORS update after Vercel deploy, API key auth verification, production smoke test. Noted pending migration.

**Prisma CLI moved to production dependencies:**
- `packages/db/package.json` — `prisma` moved from `devDependencies` to `dependencies` so the production Docker image (built with `--omit=dev`) has the CLI available for `npx prisma migrate deploy`.

---

## 2026-04-27 — Build fixes; state review

**What we did**

Two small commits since last session:
- `768eeeb` — Added `.tsbuildinfo` to root `.gitignore` (build cache files were being tracked).
- `bce3d92` — Added `packageManager: "npm@10.x"` to root `package.json` (required by Turbo 2.x; without it Turbo logs a warning and may pick the wrong package manager).

No feature work. All unchecked items in `V1_TODO.md` remain unfinished (verified in code):
- `notifChannel` on customer ledger is read-only (no inline editor).
- Pending payments page has no link to customer ledger.
- Menu page has no delete/archive endpoint or UI.
- No `ErrorBoundary` component exists in the console.

Updated `SESSION_LOG.md` current state and next steps to reflect this.

---

## 2026-04-24 — V1 hardening, bug fixes, deployment scaffolding

**What we did**

**API completeness:**
- `GET /api/customers/:id` — direct single-customer fetch.
- `PATCH /api/reconciliation-tasks/:id` — resolve or dismiss sync conflicts.
- `notifChannel` exposed in ledger response and `CustomerLedger` type.
- `CustomerSearchDto.q` made optional so empty query returns all customers (ordered by `createdAt desc`).
- `charges` field added to `CreateOrderDto`; included in total validation, order total, and credit principal.

**Security:**
- Global `ApiKeyGuard` (opt-in via `API_KEY` env var); all GET and webhook endpoints marked `@Public()`.
- `ThrottlerGuard` scoped to webhook inbound only (10 req/min); removed global throttle that was hitting 429 on the customers live-search page.
- CORS wired via `CORS_ORIGIN` env var.

**Notifications:**
- Thank-you message now fires after every sale (PAID and CREDIT). Credit thank-you includes repayment amount + due date (`thank_you_credit_v1` template).
- Phone numbers normalized to E.164 (`+234…`) before Twilio dispatch — fixes "not a valid phone number" error for local Nigerian numbers.

**Console fixes:**
- `NewCustomerInline` was a `<form>` nested inside the outer sale `<form>` — browsers strip inner forms, so "Create Customer" was silently submitting the outer form. Fixed by converting to `<div>` with `type="button"` handlers.
- `useState` replaces `useTransition` for create-customer loading state (async transitions don't hold `pending` past first `await`).
- "Create new customer" button always shows for name queries even when suggestions exist; suppressed for numeric (phone) queries.
- New customer form pre-fills name or phone from the search input.
- Customer page loads all customers on mount (live search, debounced 300ms); after creation, auto-searches new customer's phone.
- Reconciliation page: Resolve/Dismiss buttons wired to `PATCH /api/reconciliation-tasks/:id`.
- Customer ledger: notification channel displayed.
- Pending payments: confirm-before-reject dialog added; React Fragment keys fixed.
- Price label fixed to `₦` in new-item modal.
- `getCustomer(id)` added to API client; sale page pre-fill uses it instead of broken search-by-UUID.
- `resolveReconciliationTask` added to API client.
- `notif_channel` added to `CustomerLedger` type.

**Other:**
- Trust score thresholds corrected: 50 = SAFE, 80 = VIP, 25 = RISK, <25 = BANNED.
- `GET /api/health` endpoint added for container orchestration.
- `docker-compose.yml` + `apps/api/Dockerfile` created (multi-stage, non-root user; services: api, worker, postgres, redis).
- `API_KEY` added to `.env.example`.

---

## 2026-04-15 (2) — Sale flow redesign: 2 order types, cash withdrawal as item, inline creation

**What we did**

- Removed `CASH_WITHDRAWAL` from `OrderType` enum. New migration: `20260415120000_remove_cash_withdrawal_order_type`. The `orders.type` column now only accepts `PAID` or `CREDIT`.
- Simplified `CreateOrderDto`: removed `as_credit` flag, made `items` a required array (min 1 item), tightened `due_date` validation to CREDIT only.
- Cleaned up `OrdersService`: removed all `CASH_WITHDRAWAL` code branches. Cash withdrawals are now recorded as regular orders where the withdrawal amount is a menu item and the service fee goes in the charges field on the console.
- Reworked `apps/console` create sale form (`/sales/new`):
  - Only PAID and CREDIT tabs.
  - **Inline customer creation**: when no search results, "Customer not found — create new?" expands an inline form (name, phone, optional email).
  - **Item picker**: live search across the menu, add by clicking. Qty +/- controls on selected lines. Subtotal auto-calculated.
  - **Inline menu item creation**: if typed name doesn't match any item, "+ Create as new menu item" opens a modal (name, price, in stock toggle — default in stock). Item is added to the menu and the order on confirm.
  - **Charges field**: optional service fee amount (e.g. cash withdrawal charge). Displayed separately; adds to grand total.
  - **Grand total**: auto-calculated from line items + charges. Displayed read-only; sent as `total` to API.
- Added `createMenuItem` to console API client.
- Updated `architecture.md` (order types, DTO docs, CASH_WITHDRAWAL note).
- Updated `SESSION_LOG.md`.

---

## 2026-04-15 — Full Next.js 14 admin console (Phase 2)

**What we did**

- Scaffolded `apps/console` (Next.js 14, TypeScript, Tailwind CSS). Wired into monorepo with `dev:console` / `build:console` scripts and Turbo `build`/`dev` tasks.
- Added `.env.example` for `NEXT_PUBLIC_API_URL`.
- Built typed API client (`src/lib/api.ts`) against all NestJS endpoints.
- Implemented all 7 admin pages:
  - `/customers` — search (name/phone/email), paginated results, inline new-customer form.
  - `/customers/[id]` — ledger: summary cards (running balance, store credit, risk, trust score), credits table, transactions table, CSV export, "+ New Sale" shortcut.
  - `/sales/new` — create sale form: order type selector, customer lookup (live search), menu item picker with qty, total, due date (CREDIT), note. Pre-fills customer from ledger link.
  - `/pending-payments` — status-filtered queue; inline confirm (amount + note → `POST /api/credits/:id/confirm-payment`) and reject actions.
  - `/scheduled-jobs` — status-filtered table; click row to expand last_error; failed jobs highlighted; "+ Manual Reminder" button.
  - `/scheduled-jobs/manual` — form: customer search → active credit select → datetime → `POST /api/scheduled-jobs/manual`.
  - `/audit` — infinite-scroll table; click row to expand JSON payload.
  - `/reconciliation` — status-filtered table; click row to expand conflict payload.
- Updated `DEVELOPMENT.md` repo layout and npm scripts table.
- Updated `SESSION_LOG.md` current state.

---

## 2026-04-15 — Real Twilio notification delivery + test infrastructure

**What we did**

- Replaced `NotificationSenderService` logger stub with a real Twilio implementation.
  - Sends SMS and WhatsApp via the Twilio Messages API; resolves channel from `customer.notifChannel` (WHATSAPP / SMS / BOTH).
  - Writes a `NotificationLog` row per channel per send (status `SENT` + `messageSid`, or `FAILED` + `error`).
  - Deduplication on BullMQ retry: skips a channel if a `SENT` log already exists for `(scheduledJobId, channel)`.
- Wired `NotificationsModule` with `PrismaModule` and a `TWILIO_CLIENT` factory provider (`twilio(sid, token)`).
- Updated `RemindersConsumer` and `AppreciationConsumer` to inject `NotificationSenderService` and call `sendReminder` / `sendAppreciation`.
- Added `notif_channel` to `UpdateCustomerDto` and `CustomersService.updateCustomer` so the channel can be changed via `PATCH /api/customers/:id`.
- Added `apps/api/test-setup.js` (sets Twilio env vars for unit tests) and wired it into `jest.config.js` via `setupFiles`.
- Wrote `notification-sender.service.spec.ts`: 13 tests covering WHATSAPP, SMS, BOTH channels, dedup, Twilio error → FAILED log, credit/customer not found, template rendering for `sendReminder` and `sendAppreciation`.
- All 61 tests pass.

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
