# Session log (resume here)

Append a new **dated section** at the **top** after each work block (human or agent). Keep **Current state** and **Next steps** accurate so a fresh session can continue without guessing.

---

## Current state (update when this file changes)

- **Git:** Root `.gitignore` ignores `node_modules/`, `.env` (not `.env.example`), build artifacts.
- **Monorepo:** npm workspaces (`packages/*`, `apps/*`). Root scripts: `dev:api`, `dev:worker`, `dev:console`, `build:api`, `build:console`, `db:*`.
- **Implemented:**
  - `packages/db` — Prisma 6 schema + 3 migrations: `init`, `add_notif_channel_and_notification_log`, `remove_cash_withdrawal_order_type`. `OrderType` enum is now `PAID | CREDIT` only.
  - `apps/api` — Full NestJS backend. `CASH_WITHDRAWAL` removed from `OrderType`; `items` always required on orders; `as_credit` field removed. 61 tests passing.
  - `apps/console` — Next.js 14 admin UI. Create sale form: 2 order types (PAID/CREDIT), inline customer creation, item picker with live search + inline menu item creation (confirmation modal), charges field (for cash withdrawal service fee), auto-calculated total. All other pages unchanged.

## Next steps

1. Post-UI module restructuring (Approach C): Facade pattern for Credits/Orders orchestration.
2. Add PATCH endpoint for reconciliation tasks in the API (currently read-only).
3. Deploy (Docker Compose or Railway/Render) — not yet started.

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
