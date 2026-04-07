# Backend Phase 1 Design — Delicious24 Credit System

**Date:** 2026-04-07  
**Scope:** Bug fixes + quality uplift for `apps/api`. UI (apps/console) is Phase 2. Restructuring (Approach C) is post-UI.  
**Approach:** B — fix all correctness bugs and close quality gaps without speculative refactoring.

---

## Context

Cursor AI scaffolded a complete NestJS backend covering orders, payments, webhook, scheduler, sync, trust engine, and workers. The schema and migration are correct. The following gaps were identified and are addressed in this phase.

---

## Section 1 — Bug Fixes

### 1a. BullMQ backoff — wrong delays

**Problem:** All queued jobs use `{ type: 'exponential', delay: 60_000 }`, which produces 1m / 2m / 4m. Spec requires 1m / 5m / 20m.

**Fix:** Add `apps/api/src/config/backoff.config.ts` exporting a `REMINDER_BACKOFF` constant using BullMQ's per-attempt delay array. Update all `remindersQueue.add(...)` and `notificationsQueue.add(...)` calls in `SchedulerService` to use this constant.

```ts
// backoff.config.ts
export const REMINDER_BACKOFF = {
  type: 'custom' as const,
  // BullMQ custom backoff receives attemptsMade (1-indexed)
};
export function reminderBackoffDelay(attemptsMade: number): number {
  const delays = [60_000, 300_000, 1_200_000]; // 1m, 5m, 20m
  return delays[Math.min(attemptsMade - 1, delays.length - 1)];
}
```

Register the custom backoff strategy in the BullMQ `Worker` options inside `WorkerModule`.

### 1b. Settlement rounding — removed

**Problem:** `settleToNearestTen` was called in `PaymentsService.confirmPayment`, rounding the admin-entered amount before storing. This is wrong — payments must be stored exactly as received.

**Fix:** Remove the `settleToNearestTen` call from `confirmPayment`. The function remains in `money.util.ts` but is unused in the payment flow (kept for potential future use). Amount is used as-is.

### 1c. Idempotency interceptor — hardcoded status 200

**Problem:** `IdempotencyInterceptor` always stores `statusCode: 200` regardless of the actual HTTP response.

**Fix:** Capture the actual response status from the execution context after the handler resolves. On cache-hit replay, set `res.status(stored.statusCode)` before returning the cached body.

### 1d. PAID order trust score — split transaction

**Problem:** A PAID order creates the order in transaction 1, then runs a **second separate transaction** for the trust score update. A crash between them leaves the order without a trust event.

**Fix:** Fold the `trustScoreEvent.create` + `customer.update` (trust score + segment) inside the **same** `prisma.$transaction` block as the order, `orderLine`, and `transaction` creates. The appreciation job scheduling (BullMQ) stays outside the DB transaction — that is correct and safe.

### 1e. WatService reminder timing — wrong schedule

**Problem:**
- `courtesyReminderAt(fromUtc)` fires next day after **order creation**, ignoring the due date.
- `urgentReminderAt(dueDate, now)` fires **2 days before** due date.

**Correct rules (per product spec):**
- Courtesy → due_date − 1 day, 09:00 WAT
- Urgent → due_date itself, 09:00 WAT
- Overdue → due_date + 1 day, 09:00 WAT *(already correct)*

**Fix:**
- `courtesyReminderAt(dueDate: Date)` — computes `dueDate − 1 day` at 09:00 WAT.
- `urgentReminderAt(dueDate: Date)` — computes `dueDate` itself at 09:00 WAT. Remove `fromUtc` fallback parameter.
- Update `SchedulerService.createCreditReminderRowsInTransaction` to pass `dueDate` to `courtesyReminderAt` instead of `now`.

---

## Section 2 — Quality Gaps

### 2a. Customer CREATE + PATCH endpoints

**Problem:** `CustomersController` has only `GET search` and `GET ledger`. Orders require a `customer_id` but there is no API to create customers.

**Fix:**
- `POST /api/customers` — requires `name` (string), `phone` (string, unique). Optional: `email`. Returns created customer. Phone uniqueness violation → `409 PHONE_ALREADY_EXISTS`.
- `PATCH /api/customers/:id` — partial update of `name`, `email`, `phone`. Phone uniqueness validated.
- DTOs: `CreateCustomerDto`, `UpdateCustomerDto` with `class-validator` decorations.

### 2b. Pending payments — filtering and pagination

**Problem:** `PendingPaymentsService.list()` returns a flat `findMany({ take: 200 })` with no filtering or pagination.

**Fix:**
- Add query params: `status` (NEW / REVIEWED / REJECTED), `from_phone`, `page`, `limit` (max 100).
- Return envelope: `{ items, total, page, limit }`.
- Add `PATCH /api/pending-payments/:id` to update status (REVIEWED or REJECTED). Used by admin to action items.

### 2c. Offline sync — non-financial path is a stub

**Problem:** Non-financial entity changes in `SyncService` return `randomUUID()` without persisting anything. The client receives a fake canonical ID with no corresponding DB record.

**Fix:** Handle two entity types properly:
- `CUSTOMER` — payload must contain `phone` (required) + `name` (required) + optional `email`. Upsert by phone; return canonical UUID. Missing required fields → `INVALID_PAYLOAD`.
- `MENU_ITEM` — payload must contain `name` (required) + `price` (required) + optional `in_stock`. Upsert by name; return canonical `id`. Missing required fields → `INVALID_PAYLOAD`.
- Unknown entity types → reject with `UNSUPPORTED_ENTITY_TYPE` error.
- Financial types (ORDER, PAYMENT, CREDIT, TRANSACTION) → existing reject-and-reconcile behaviour unchanged.

### 2d. API environment template

**Problem:** `apps/api` has no `.env.example`. Developers must guess what environment variables are required.

**Fix:** Add `apps/api/.env.example`:
```
DATABASE_URL=postgresql://user:password@localhost:5434/delicious24
REDIS_URL=redis://localhost:6380
API_PORT=3001
NODE_ENV=development
```
Ports intentionally offset from 5432/6379 defaults since those are in use on dev machine.

### 2e. Session log — outdated state

**Problem:** `docs/SESSION_LOG.md` still says "No `apps/console` or `apps/api` yet."

**Fix:** Update `Current state` and `Next steps` to reflect reality after this phase.

---

## Section 3 — Inbound Parser + Tests + OpenAPI

### 3a. Inbound message parser — multi-pattern, k-suffix, thousands inference

**Problem:** `parsePaidAmount` only matches `paid <amount>`. Real customers use varied phrasing. Amounts like `5k`, `5`, `50` are not handled.

**Fix:** Rename to `parseInboundAmount`. New rules:

**Payment-intent keywords (case-insensitive, anywhere in message):**
`paid`, `payment`, `sent`, `transferred`, `transfer`, `deposited`, `deposit`, `remitted`, `remit`, `settled`, `cleared`

**Amount extraction (first match in message):**
1. Number with `k`/`K` suffix → multiply by 1,000 (`5k` → 5000, `5.5K` → 5500)
2. Plain number with optional thousands separator and optional decimal (`5,000`, `2000.50`)
3. Single/double digit integer (1–99) → multiply by 1,000 (`5` → 5000, `50` → 50000)

**Storage:** `parsedAmount` stored as raw decimal string — no rounding. Admin confirms actual amount at settlement.

**If keyword present but no number found:** candidate created with `parsedAmount: null` (admin reviews).

**Test cases:**

| Input | Expected |
|-------|----------|
| `paid 5000` | 5000 |
| `PAID 5,000` | 5000 |
| `i sent 5k` | 5000 |
| `transferred 5.5K` | 5500 |
| `payment of 2000.50` | 2000.50 |
| `sent 5` | 5000 (1–99 → ×1000) |
| `payment of 50` | 50000 (1–99 → ×1000) |
| `deposited 500` | 500 (≥100 → as-is) |
| `done` | null (no keyword) |
| `paid` (no number) | null |

### 3b. Test skeletons

Three unit test files, runnable with `npm test` in `apps/api`. Real `describe`/`it`/`expect` blocks — not empty stubs.

**`src/trust/trust-engine.service.spec.ts`**
- Each delta rule: on-time (+8), partial (+2), late 1–7d (−6), late 8–30d (−15), default >30d (−35), outright paid (+8), chargeback (−20)
- Segment boundaries: score 85 → VIP, 84 → SAFE, 65 → SAFE, 64 → RISK, 40 → RISK, 39 → BANNED
- `clamp` keeps score in [0, 100]

**`src/wat/wat.service.spec.ts`**
- `courtesyReminderAt(dueDate)` → due_date − 1 day, 09:00 WAT
- `urgentReminderAt(dueDate)` → due_date itself, 09:00 WAT
- `overdueReminderAt(dueDate)` → due_date + 1 day, 09:00 WAT
- `calendarDaysLate` → correct day count across WAT midnight boundary

**`src/common/parse-inbound-amount.spec.ts`**
- All cases from the table in 3a above

### 3c. OpenAPI / Swagger

- Install `@nestjs/swagger` + `swagger-ui-express`
- Wire into `apps/api/src/main.ts` to serve at `/api/docs`
- Decorate all DTOs with `@ApiProperty` (required/optional, examples)
- Decorate all controllers with `@ApiTags` and `@ApiOperation`
- Add `apps/api/scripts/export-openapi.ts` — boots the app in doc-only mode and writes `apps/api/openapi.json` for external consumers

---

## What is explicitly NOT in this phase

- `apps/console` (Next.js admin UI) — Phase 2
- Module restructuring / facade pattern — post-UI (Approach C)
- Real SMS/email adapter (NotificationSenderService stays as a logger stub)
- Auth/session middleware

---

## Acceptance criteria

1. `POST /api/orders` with `type: CREDIT` → creates order, credit, 3 scheduled_jobs, 3 BullMQ jobs with delays 1m/5m/20m from their respective `runAt`.
2. Courtesy reminder fires at `dueDate − 1 day 09:00 WAT`; urgent at `dueDate 09:00 WAT`; overdue at `dueDate + 1 day 09:00 WAT`.
3. `POST /api/webhooks/inbound` with `"i sent 5k"` → candidate with `parsedAmount = 5000`, linked to oldest ACTIVE credit for that phone.
4. `POST /api/credits/:id/confirm-payment` with `amount: "2005"` → PAYMENT transaction stores `2005.00`, credit balance decremented by 2005, no rounding applied.
5. `POST /api/orders` with `type: PAID` → trust score event written in the **same** DB transaction as the order row.
6. Duplicate request with same `idempotency_key` → returns cached response with correct HTTP status code.
7. `POST /api/customers` creates a customer; duplicate phone → 409.
8. `GET /api/pending-payments?status=NEW&page=1&limit=20` → paginated list.
9. `POST /api/sync` with `entity_type: CUSTOMER` and a valid payload → returns real canonical UUID from DB.
10. `npm test` runs all three spec files without errors.
11. `/api/docs` serves Swagger UI.
