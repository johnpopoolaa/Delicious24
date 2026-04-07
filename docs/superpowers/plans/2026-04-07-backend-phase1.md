# Backend Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all correctness bugs in the existing NestJS backend, close quality gaps, and add test skeletons + OpenAPI documentation.

**Architecture:** All changes are within `apps/api/src`. No schema changes required. The worker consumers, scheduler service, and order service are the most heavily touched. Each fix is self-contained and committed independently.

**Tech Stack:** NestJS 10, Prisma 6, BullMQ 5, `@nestjs/bullmq` 10, decimal.js, date-fns-tz, Jest 29, `@nestjs/swagger` 7.

**Spec:** `docs/superpowers/specs/2026-04-07-backend-phase1-design.md`

---

## File Map

| File | Action | Reason |
|------|--------|--------|
| `apps/api/src/wat/wat.service.ts` | Modify | Fix courtesyReminderAt, urgentReminderAt signatures and logic |
| `apps/api/src/scheduler/scheduler.service.ts` | Modify | Update reminder timing calls + use custom BullMQ backoff |
| `apps/api/src/config/backoff.config.ts` | Create | 1m/5m/20m backoff delay function |
| `apps/api/src/queue/reminders.consumer.ts` | Modify | Add backoffStrategy to @Processor settings |
| `apps/api/src/queue/appreciation.consumer.ts` | Modify | Add backoffStrategy to @Processor settings |
| `apps/api/src/payments/payments.service.ts` | Modify | Remove settleToNearestTen call |
| `apps/api/src/common/idempotency.interceptor.ts` | Modify | Capture real HTTP status code |
| `apps/api/src/orders/orders.service.ts` | Modify | Merge PAID trust score into main DB transaction |
| `apps/api/src/common/parse-inbound-amount.ts` | Create | Multi-keyword, k-suffix, 1–99×1000 parser |
| `apps/api/src/webhook/webhook.service.ts` | Modify | Use parseInboundAmount; store raw parsed amount |
| `apps/api/src/customers/dto/create-customer.dto.ts` | Create | POST /api/customers DTO |
| `apps/api/src/customers/dto/update-customer.dto.ts` | Create | PATCH /api/customers/:id DTO |
| `apps/api/src/customers/customers.service.ts` | Modify | Add createCustomer, updateCustomer |
| `apps/api/src/customers/customers.controller.ts` | Modify | Add POST, PATCH routes |
| `apps/api/src/pending-payments/dto/pending-payment-filter.dto.ts` | Create | Query filter DTO |
| `apps/api/src/pending-payments/dto/update-pending-payment.dto.ts` | Create | PATCH status DTO |
| `apps/api/src/pending-payments/pending-payments.service.ts` | Modify | Add filtering, pagination, updateStatus |
| `apps/api/src/pending-payments/pending-payments.controller.ts` | Modify | Add query params, PATCH route |
| `apps/api/src/sync/sync.service.ts` | Modify | Real CUSTOMER + MENU_ITEM upsert |
| `apps/api/.env.example` | Create | Document required environment variables |
| `docs/SESSION_LOG.md` | Modify | Update Current state + Next steps |
| `apps/api/src/trust/trust-engine.service.spec.ts` | Create | Test skeleton |
| `apps/api/src/wat/wat.service.spec.ts` | Create | Test skeleton |
| `apps/api/src/common/parse-inbound-amount.spec.ts` | Create | Test skeleton |
| `apps/api/package.json` | Modify | Add @nestjs/swagger |
| `apps/api/src/main.ts` | Modify | Wire Swagger at /api/docs |
| `apps/api/src/orders/dto/create-order.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/customers/dto/customer-search.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/payments/dto/confirm-payment.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/webhook/dto/inbound-webhook.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/scheduler/dto/scheduled-job-filter.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/scheduler/dto/manual-reminder-body.dto.ts` | Modify | Add @ApiProperty decorations |
| `apps/api/src/sync/dto/sync-batch.dto.ts` | Modify | Add @ApiProperty decorations |
| All controllers | Modify | Add @ApiTags and @ApiOperation |
| `apps/api/scripts/export-openapi.ts` | Create | Export openapi.json artifact |

---

## Task 1: Fix WatService reminder timing

**Files:**
- Modify: `apps/api/src/wat/wat.service.ts`
- Modify: `apps/api/src/scheduler/scheduler.service.ts`

- [ ] **Step 1: Update `courtesyReminderAt` to accept `dueDate` instead of `fromUtc`**

Replace the current implementation in `apps/api/src/wat/wat.service.ts`:

```ts
/** Day before due date at 09:00 WAT. */
courtesyReminderAt(dueDate: Date): Date {
  const dueWat = toZonedTime(dueDate, WAT_TZ);
  const dayBefore = addDays(dueWat, -1);
  const atNine = setMilliseconds(setSeconds(setMinutes(setHours(dayBefore, 9), 0), 0), 0);
  return fromZonedTime(atNine, WAT_TZ);
}
```

- [ ] **Step 2: Update `urgentReminderAt` to fire ON the due date (not 2 days before)**

```ts
/** Due date itself at 09:00 WAT. */
urgentReminderAt(dueDate: Date): Date {
  const dueWat = toZonedTime(dueDate, WAT_TZ);
  const atNine = setMilliseconds(setSeconds(setMinutes(setHours(dueWat, 9), 0), 0), 0);
  return fromZonedTime(atNine, WAT_TZ);
}
```

- [ ] **Step 3: Update `SchedulerService.createCreditReminderRowsInTransaction` call sites**

In `apps/api/src/scheduler/scheduler.service.ts`, update the `runs` array inside `createCreditReminderRowsInTransaction`. The `params` object already has `dueDate`. Remove `now` from the courtesy and urgent calls:

```ts
const runs: Array<{ type: ScheduledJobType; at: Date; template: string }> = [
  { type: ScheduledJobType.COURTESY, at: this.wat.courtesyReminderAt(dueDate), template: 'courtesy_v1' },
  { type: ScheduledJobType.URGENT, at: this.wat.urgentReminderAt(dueDate), template: 'urgent_v1' },
  { type: ScheduledJobType.OVERDUE, at: this.wat.overdueReminderAt(dueDate), template: 'overdue_v1' },
];
```

- [ ] **Step 4: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/src/wat/wat.service.ts apps/api/src/scheduler/scheduler.service.ts
git commit -m "fix(scheduler): correct reminder timing — courtesy day-before due, urgent on due date"
```

---

## Task 2: Fix BullMQ retry backoff (1m / 5m / 20m)

**Files:**
- Create: `apps/api/src/config/backoff.config.ts`
- Modify: `apps/api/src/scheduler/scheduler.service.ts`
- Modify: `apps/api/src/queue/reminders.consumer.ts`
- Modify: `apps/api/src/queue/appreciation.consumer.ts`

- [ ] **Step 1: Create `backoff.config.ts`**

```ts
// apps/api/src/config/backoff.config.ts

/**
 * Custom BullMQ backoff strategy: 1m → 5m → 20m.
 * Register via @Processor settings.backoffStrategy.
 * Jobs must specify backoff: { type: 'custom' }.
 */
export function reminderBackoffDelay(attemptsMade: number): number {
  const delays = [60_000, 300_000, 1_200_000]; // 1m, 5m, 20m
  return delays[Math.min(attemptsMade - 1, delays.length - 1)];
}
```

- [ ] **Step 2: Update all `queue.add` calls in `SchedulerService` to use `backoff: { type: 'custom' }`**

In `apps/api/src/scheduler/scheduler.service.ts`, replace every occurrence of:
```ts
backoff: { type: 'exponential', delay: 60_000 },
```
with:
```ts
backoff: { type: 'custom' },
```

There are four `queue.add` calls: `enqueueCreditReminderJobs`, `scheduleAppreciation`, `sendNow` (two queues), and `enqueueManualReminder`. Update all of them.

- [ ] **Step 3: Register the backoff strategy on `RemindersConsumer`**

In `apps/api/src/queue/reminders.consumer.ts`, add the import and update `@Processor`:

```ts
import { reminderBackoffDelay } from '../config/backoff.config';

@Processor('reminders', {
  concurrency: 4,
  settings: {
    backoffStrategy: reminderBackoffDelay,
  },
})
export class RemindersConsumer extends WorkerHost {
```

- [ ] **Step 4: Register the backoff strategy on `AppreciationConsumer`**

In `apps/api/src/queue/appreciation.consumer.ts`, add the import and update `@Processor`:

```ts
import { reminderBackoffDelay } from '../config/backoff.config';

@Processor('notifications', {
  concurrency: 4,
  settings: {
    backoffStrategy: reminderBackoffDelay,
  },
})
export class AppreciationConsumer extends WorkerHost {
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/backoff.config.ts apps/api/src/scheduler/scheduler.service.ts \
        apps/api/src/queue/reminders.consumer.ts apps/api/src/queue/appreciation.consumer.ts
git commit -m "fix(queue): set BullMQ retry backoff to 1m/5m/20m via custom strategy"
```

---

## Task 3: Remove settlement rounding from PaymentsService

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`

- [ ] **Step 1: Remove `settleToNearestTen` call and use the raw amount directly**

In `apps/api/src/payments/payments.service.ts`, find the `confirmPayment` method. Change:

```ts
const roundedPayment = settleToNearestTen(money(amount));
if (roundedPayment.lte(0)) {
  throw new BadRequestException({ error: 'INVALID_AMOUNT', message: 'Amount must be positive after rounding' });
}

const priorBalance = money(credit.balance.toString());
let newBalance = priorBalance.minus(roundedPayment);
```

To:

```ts
const paymentAmount = money(amount);
if (paymentAmount.lte(0)) {
  throw new BadRequestException({ error: 'INVALID_AMOUNT', message: 'Amount must be positive' });
}

const priorBalance = money(credit.balance.toString());
let newBalance = priorBalance.minus(paymentAmount);
```

- [ ] **Step 2: Replace all subsequent uses of `roundedPayment` with `paymentAmount`**

In the same method, `roundedPayment` appears in:
- `newBalance = priorBalance.minus(roundedPayment)` — already changed above
- `amount: roundedPayment.toFixed(2)` in the `tx.transaction.create` call
- The overpayment note string
- `payment_amount: roundedPayment.toFixed(2)` in the return value

Replace every `roundedPayment` with `paymentAmount`:

```ts
// in tx.transaction.create:
amount: paymentAmount.toFixed(2),
note:
  note ??
  (storeCreditAdded.gt(0)
    ? `Payment; overpay ${toDecimalString(storeCreditAdded)} to store credit`
    : undefined),

// in return value:
payment_amount: paymentAmount.toFixed(2),
```

- [ ] **Step 3: Remove unused `settleToNearestTen` import**

Remove `settleToNearestTen` from the import at the top of `payments.service.ts`:

```ts
import { money, toDecimalString } from '../common/money.util';
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/payments/payments.service.ts
git commit -m "fix(payments): store payment amount as received, remove settlement rounding"
```

---

## Task 4: Fix idempotency interceptor — capture real HTTP status code

**Files:**
- Modify: `apps/api/src/common/idempotency.interceptor.ts`

- [ ] **Step 1: Replace the interceptor implementation**

The full updated file:

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next.handle();
    }
    const body = req.body as { idempotency_key?: string } | undefined;
    const key =
      (req.headers['idempotency-key'] as string | undefined) ??
      (req.headers['x-idempotency-key'] as string | undefined) ??
      body?.idempotency_key;
    if (!key || typeof key !== 'string') {
      return next.handle();
    }

    // NestJS defaults: POST → 201, everything else → 200
    const inferredStatus = req.method === 'POST' ? 201 : 200;
    const route = `${req.method}:${req.path}`;
    const res = context.switchToHttp().getResponse<Response>();

    return from(
      this.prisma.idempotencyRequest.findUnique({
        where: { key_route: { key, route } },
      }),
    ).pipe(
      mergeMap((existing) => {
        if (existing) {
          // Replay with the originally stored status code
          res.status(existing.statusCode);
          return of(existing.responseBody);
        }
        return next.handle().pipe(
          mergeMap((bodyResponse) =>
            from(
              (async () => {
                try {
                  await this.prisma.idempotencyRequest.create({
                    data: {
                      key,
                      route,
                      responseBody: bodyResponse as object,
                      statusCode: inferredStatus,
                    },
                  });
                } catch (e: unknown) {
                  const err = e as { code?: string };
                  if (err?.code === 'P2002') {
                    const r = await this.prisma.idempotencyRequest.findUnique({
                      where: { key_route: { key, route } },
                    });
                    if (r) {
                      res.status(r.statusCode);
                      return r.responseBody;
                    }
                  }
                  throw e;
                }
                return bodyResponse;
              })(),
            ),
          ),
        );
      }),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/common/idempotency.interceptor.ts
git commit -m "fix(idempotency): capture and replay correct HTTP status code (POST→201)"
```

---

## Task 5: Merge PAID order trust score into the main DB transaction

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`

- [ ] **Step 1: Move the trust score update inside the main `prisma.$transaction` block**

In `apps/api/src/orders/orders.service.ts`, the `create` method currently has two separate transactions. Replace with a single transaction. The full updated `create` method:

```ts
async create(dto: CreateOrderDto, actor: string) {
  const customer = await this.prisma.customer.findUnique({ where: { id: dto.customer_id } });
  if (!customer) throw new NotFoundException({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });

  const needsCredit =
    dto.type === OrderType.CREDIT ||
    (dto.type === OrderType.CASH_WITHDRAWAL && dto.as_credit === true);
  if (needsCredit && !dto.due_date) {
    throw new BadRequestException({ error: 'DUE_DATE_REQUIRED', message: 'due_date is required for credit sales' });
  }

  if (dto.type !== OrderType.CASH_WITHDRAWAL && (!dto.items || dto.items.length === 0)) {
    throw new BadRequestException({ error: 'ITEMS_REQUIRED', message: 'items required for this order type' });
  }

  const lines: Array<{ menuItemId: number; qty: number; unitPrice: Prisma.Decimal }> = [];
  let computed = money(0);

  if (dto.items?.length) {
    for (const line of dto.items) {
      const item = await this.prisma.menuItem.findUnique({ where: { id: line.menu_item_id } });
      if (!item) {
        throw new BadRequestException({
          error: 'MENU_ITEM_NOT_FOUND',
          message: `menu_item_id ${line.menu_item_id} not found`,
        });
      }
      if (!item.inStock) {
        throw new BadRequestException({ error: 'OUT_OF_STOCK', message: `Item ${item.name} is out of stock` });
      }
      const unit = money(item.price.toString());
      const sub = unit.mul(line.qty);
      computed = computed.add(sub);
      lines.push({ menuItemId: item.id, qty: line.qty, unitPrice: item.price });
    }
  }

  const declared = money(dto.total);
  if (!computed.eq(0) && !computed.equals(declared)) {
    throw new BadRequestException({
      error: 'TOTAL_MISMATCH',
      message: `total ${dto.total} does not match line sum ${toDecimalString(computed)}`,
    });
  }
  if (computed.eq(0) && dto.type === OrderType.CASH_WITHDRAWAL) {
    computed = declared;
  }

  const now = new Date();
  const dueDate = dto.due_date ? new Date(dto.due_date) : now;

  const result = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerId: dto.customer_id,
        total: computed.toFixed(2),
        type: dto.type,
        note: dto.note,
        lines: lines.length
          ? {
              create: lines.map((l) => ({
                menuItemId: l.menuItemId,
                quantity: l.qty,
                unitPrice: l.unitPrice,
              })),
            }
          : undefined,
      },
    });

    await tx.transaction.create({
      data: {
        orderId: order.id,
        amount: computed.toFixed(2),
        kind: TransactionKind.CHARGE,
        note: dto.note,
      },
    });

    let creditId: string | null = null;
    let reminderRows: Awaited<ReturnType<SchedulerService['createCreditReminderRowsInTransaction']>> = [];

    if (needsCredit) {
      await tx.credit.create({
        data: {
          orderId: order.id,
          customerId: dto.customer_id,
          principal: computed.toFixed(2),
          balance: computed.toFixed(2),
          dueDate,
          status: CreditStatus.ACTIVE,
        },
      });
      const creditRow = await tx.credit.findFirst({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
      });
      creditId = creditRow!.id;
      reminderRows = await this.scheduler.createCreditReminderRowsInTransaction(tx, {
        creditId: creditRow!.id,
        dueDate,
        now,
      });
    }

    // For outright PAID orders: record trust score event in the same transaction
    if (dto.type === OrderType.PAID) {
      const delta = this.trust.outrightPaidSaleDelta();
      const next = this.trust.clamp(customer.trustScore + delta.delta);
      const segment = this.trust.segmentForScore(next);
      await tx.trustScoreEvent.create({
        data: {
          customerId: dto.customer_id,
          delta: delta.delta,
          reason: delta.reason,
          sourceId: order.id,
        },
      });
      await tx.customer.update({
        where: { id: dto.customer_id },
        data: { trustScore: next, riskSegment: segment },
      });
      await tx.auditLog.create({
        data: {
          actor,
          action: 'trust_outright_paid',
          targetTable: 'customers',
          targetId: dto.customer_id,
          payload: { order_id: order.id, delta: delta.delta },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actor,
        action: 'create_order',
        targetTable: 'orders',
        targetId: order.id,
        payload: { type: dto.type, customer_id: dto.customer_id, total: dto.total },
      },
    });

    return { order, creditId, computed, dueDate, reminderRows };
  });

  if (result.reminderRows.length > 0) {
    await this.scheduler.enqueueCreditReminderJobs(result.reminderRows, customer.phone, now);
  }

  // Appreciation job: BullMQ only (no DB write needed here), safe outside transaction
  if (dto.type === OrderType.PAID) {
    await this.scheduler.scheduleAppreciation({
      customerId: customer.id,
      customerPhone: customer.phone,
      orderId: result.order.id,
      now,
    });
  }

  return {
    success: true,
    data: {
      order_id: result.order.id,
      credit_id: result.creditId,
      total: toDecimalString(result.computed),
      type: dto.type,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/orders/orders.service.ts
git commit -m "fix(orders): merge PAID trust score event into order creation transaction"
```

---

## Task 6: Upgrade inbound message parser

**Files:**
- Create: `apps/api/src/common/parse-inbound-amount.ts`
- Modify: `apps/api/src/webhook/webhook.service.ts`

- [ ] **Step 1: Create `parse-inbound-amount.ts`**

```ts
// apps/api/src/common/parse-inbound-amount.ts

/**
 * Detects payment intent in a message and extracts the amount.
 * Rules:
 *  - Payment keyword must appear anywhere in the message (case-insensitive).
 *  - k/K suffix multiplies by 1,000 (e.g. "5k" → 5000, "5.5K" → 5500).
 *  - Integers 1–99 are treated as thousands (e.g. "5" → 5000, "50" → 50000).
 *  - Integers ≥ 100 and decimals are taken as-is.
 *  - Amounts are stored raw — no rounding.
 */

const KEYWORD_RE =
  /\b(paid|payment|sent|transfer(?:red)?|deposit(?:ed)?|remit(?:ted)?|settled|cleared)\b/i;

// e.g. 5k, 5.5K, 10K
const AMOUNT_K_RE = /\b([\d,]+(?:\.\d+)?)\s*[kK]\b/;

// plain number with optional thousands separator and up to 2 decimal places
const AMOUNT_PLAIN_RE = /\b([\d,]+(?:\.\d{1,2})?)\b/;

export function parseInboundAmount(text: string): { amount: string } | null {
  if (!KEYWORD_RE.test(text)) return null;

  // k-suffix takes priority
  const kMatch = text.match(AMOUNT_K_RE);
  if (kMatch) {
    const raw = parseFloat(kMatch[1].replace(/,/g, ''));
    return { amount: String(raw * 1000) };
  }

  // plain number
  const plainMatch = text.match(AMOUNT_PLAIN_RE);
  if (!plainMatch) return null; // keyword present but no number

  const raw = plainMatch[1].replace(/,/g, '');
  const num = parseFloat(raw);

  // 1–99 integers → treated as thousands
  if (Number.isInteger(num) && num >= 1 && num <= 99) {
    return { amount: String(num * 1000) };
  }

  return { amount: raw };
}
```

- [ ] **Step 2: Update `WebhookService` to use the new parser and store raw amount**

In `apps/api/src/webhook/webhook.service.ts`, replace the import and usage:

```ts
import { Injectable } from '@nestjs/common';
import { CreditStatus, PendingPaymentCandidateStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { parseInboundAmount } from '../common/parse-inbound-amount';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(raw: string): string {
    return raw.trim().replace(/\s+/g, '');
  }

  async handleInbound(dto: InboundWebhookDto) {
    const phone = this.normalizePhone(dto.from_phone);
    const parsed = parseInboundAmount(dto.message_text);
    const candidate = await this.prisma.pendingPaymentCandidate.create({
      data: {
        fromPhone: phone,
        // Store raw parsed amount — no rounding applied
        parsedAmount: parsed ? parsed.amount : undefined,
        rawText: dto.message_text,
        status: PendingPaymentCandidateStatus.NEW,
      },
    });

    if (parsed) {
      const customer = await this.prisma.customer.findFirst({
        where: { phone },
      });
      if (customer) {
        const oldest = await this.prisma.credit.findFirst({
          where: {
            customerId: customer.id,
            status: CreditStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await this.prisma.pendingPaymentCandidate.update({
            where: { id: candidate.id },
            data: { matchedCreditId: oldest.id },
          });
        }
      }
    }

    const updated = await this.prisma.pendingPaymentCandidate.findUnique({ where: { id: candidate.id } });
    return {
      success: true,
      data: {
        id: updated!.id,
        from_phone: updated!.fromPhone,
        parsed_amount: updated!.parsedAmount?.toString() ?? null,
        matched_credit_id: updated!.matchedCreditId,
        status: updated!.status,
      },
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/parse-inbound-amount.ts apps/api/src/webhook/webhook.service.ts
git commit -m "feat(webhook): upgrade inbound parser — multi-keyword, k-suffix, 1-99 thousands inference"
```

---

## Task 7: Customer CREATE and PATCH endpoints

**Files:**
- Create: `apps/api/src/customers/dto/create-customer.dto.ts`
- Create: `apps/api/src/customers/dto/update-customer.dto.ts`
- Modify: `apps/api/src/customers/customers.service.ts`
- Modify: `apps/api/src/customers/customers.controller.ts`

- [ ] **Step 1: Create `create-customer.dto.ts`**

```ts
// apps/api/src/customers/dto/create-customer.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
```

- [ ] **Step 2: Create `update-customer.dto.ts`**

```ts
// apps/api/src/customers/dto/update-customer.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
```

- [ ] **Step 3: Add `createCustomer` and `updateCustomer` to `CustomersService`**

Append to `apps/api/src/customers/customers.service.ts` (keep existing methods, add below):

```ts
async createCustomer(dto: { name: string; phone: string; email?: string }) {
  try {
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
      },
    });
    return { success: true, data: customer };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') {
      throw new ConflictException({ error: 'PHONE_ALREADY_EXISTS', message: 'A customer with this phone number already exists' });
    }
    throw e;
  }
}

async updateCustomer(id: string, dto: { name?: string; phone?: string; email?: string }) {
  try {
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
      },
    });
    return { success: true, data: customer };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') {
      throw new ConflictException({ error: 'PHONE_ALREADY_EXISTS', message: 'A customer with this phone number already exists' });
    }
    if (err?.code === 'P2025') {
      throw new NotFoundException({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }
    throw e;
  }
}
```

Add `ConflictException` to the import from `@nestjs/common`:
```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
```

- [ ] **Step 4: Add POST and PATCH routes to `CustomersController`**

```ts
// apps/api/src/customers/customers.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CustomersService } from './customers.service';
import { CustomerSearchDto } from './dto/customer-search.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.createCustomer(dto);
  }

  @Patch(':customerId')
  update(@Param('customerId') customerId: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.updateCustomer(customerId, dto);
  }

  @Get('search')
  search(@Query() q: CustomerSearchDto) {
    return this.customers.search(q.q, q.page ?? 1, q.limit ?? 20);
  }

  @Get(':customerId/ledger')
  ledger(@Param('customerId') customerId: string) {
    return this.customers.ledger(customerId);
  }

  @Get(':customerId/ledger/export.csv')
  async exportLedger(@Param('customerId') customerId: string, @Res() res: Response) {
    const csv = await this.customers.ledgerCsv(customerId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-${customerId}.csv"`);
    return res.send(csv);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/customers/dto/create-customer.dto.ts \
        apps/api/src/customers/dto/update-customer.dto.ts \
        apps/api/src/customers/customers.service.ts \
        apps/api/src/customers/customers.controller.ts
git commit -m "feat(customers): add POST /customers and PATCH /customers/:id endpoints"
```

---

## Task 8: Pending payments — filtering, pagination, and PATCH status

**Files:**
- Create: `apps/api/src/pending-payments/dto/pending-payment-filter.dto.ts`
- Create: `apps/api/src/pending-payments/dto/update-pending-payment.dto.ts`
- Modify: `apps/api/src/pending-payments/pending-payments.service.ts`
- Modify: `apps/api/src/pending-payments/pending-payments.controller.ts`
- Modify: `apps/api/src/pending-payments/pending-payments.module.ts`

- [ ] **Step 1: Create `pending-payment-filter.dto.ts`**

```ts
// apps/api/src/pending-payments/dto/pending-payment-filter.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class PendingPaymentFilterDto {
  @IsOptional()
  @IsEnum(PendingPaymentCandidateStatus)
  status?: PendingPaymentCandidateStatus;

  @IsOptional()
  @IsString()
  from_phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

- [ ] **Step 2: Create `update-pending-payment.dto.ts`**

```ts
// apps/api/src/pending-payments/dto/update-pending-payment.dto.ts
import { IsIn } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class UpdatePendingPaymentDto {
  @IsIn([PendingPaymentCandidateStatus.REVIEWED, PendingPaymentCandidateStatus.REJECTED])
  status!: PendingPaymentCandidateStatus;
}
```

- [ ] **Step 3: Replace `PendingPaymentsService`**

```ts
// apps/api/src/pending-payments/pending-payments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PendingPaymentCandidateStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PendingPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    status?: PendingPaymentCandidateStatus;
    from_phone?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.from_phone ? { fromPhone: { contains: params.from_phone, mode: 'insensitive' as const } } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.pendingPaymentCandidate.count({ where }),
      this.prisma.pendingPaymentCandidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { matchedCredit: { include: { customer: true } } },
      }),
    ]);

    return { success: true, data: { items, total, page, limit } };
  }

  async updateStatus(id: string, status: PendingPaymentCandidateStatus) {
    try {
      const updated = await this.prisma.pendingPaymentCandidate.update({
        where: { id },
        data: { status },
      });
      return { success: true, data: updated };
    } catch {
      throw new NotFoundException({ error: 'CANDIDATE_NOT_FOUND', message: 'Pending payment candidate not found' });
    }
  }
}
```

- [ ] **Step 4: Replace `PendingPaymentsController`**

```ts
// apps/api/src/pending-payments/pending-payments.controller.ts
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PendingPaymentsService } from './pending-payments.service';
import { PendingPaymentFilterDto } from './dto/pending-payment-filter.dto';
import { UpdatePendingPaymentDto } from './dto/update-pending-payment.dto';

@Controller('pending-payments')
export class PendingPaymentsController {
  constructor(private readonly pending: PendingPaymentsService) {}

  @Get()
  list(@Query() q: PendingPaymentFilterDto) {
    return this.pending.list({
      status: q.status,
      from_phone: q.from_phone,
      page: q.page,
      limit: q.limit,
    });
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePendingPaymentDto) {
    return this.pending.updateStatus(id, dto.status);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pending-payments/
git commit -m "feat(pending-payments): add filtering, pagination, and PATCH status endpoint"
```

---

## Task 9: Sync service — real non-financial upsert

**Files:**
- Modify: `apps/api/src/sync/sync.service.ts`

- [ ] **Step 1: Replace the non-financial handling in `SyncService.applyBatch`**

Full updated `apps/api/src/sync/sync.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

const FINANCIAL_TYPES = new Set(['ORDER', 'PAYMENT', 'CREDIT', 'TRANSACTION']);

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async applyBatch(dto: SyncBatchDto) {
    const results: Array<{
      temp_id: string;
      ok: boolean;
      canonical_id?: string;
      error?: string;
      reconciliation_id?: string;
    }> = [];

    for (const ch of dto.changes) {
      const entityType = ch.entity_type.toUpperCase();

      // Financial types → reject and open reconciliation task
      if (FINANCIAL_TYPES.has(entityType)) {
        const task = await this.prisma.reconciliationTask.create({
          data: {
            clientId: dto.client_id,
            entityType: ch.entity_type,
            payload: { temp_id: ch.temp_id, ...ch.payload } as object,
            status: ReconciliationTaskStatus.OPEN,
          },
        });
        results.push({
          temp_id: ch.temp_id,
          ok: false,
          error: 'FINANCIAL_CONFLICT',
          reconciliation_id: task.id,
        });
        continue;
      }

      // CUSTOMER: upsert by phone
      if (entityType === 'CUSTOMER') {
        const p = ch.payload as { phone?: string; name?: string; email?: string };
        if (!p.phone || !p.name) {
          results.push({ temp_id: ch.temp_id, ok: false, error: 'INVALID_PAYLOAD' });
          continue;
        }
        const customer = await this.prisma.customer.upsert({
          where: { phone: p.phone },
          create: { phone: p.phone, name: p.name, email: p.email },
          update: { name: p.name, email: p.email },
        });
        results.push({ temp_id: ch.temp_id, ok: true, canonical_id: customer.id });
        continue;
      }

      // MENU_ITEM: upsert by name (name not unique in schema — use findFirst + create/update)
      if (entityType === 'MENU_ITEM') {
        const p = ch.payload as { name?: string; price?: string; in_stock?: boolean };
        if (!p.name || !p.price) {
          results.push({ temp_id: ch.temp_id, ok: false, error: 'INVALID_PAYLOAD' });
          continue;
        }
        const existing = await this.prisma.menuItem.findFirst({ where: { name: p.name } });
        if (existing) {
          const updated = await this.prisma.menuItem.update({
            where: { id: existing.id },
            data: { price: p.price, inStock: p.in_stock ?? true },
          });
          results.push({ temp_id: ch.temp_id, ok: true, canonical_id: String(updated.id) });
        } else {
          const created = await this.prisma.menuItem.create({
            data: { name: p.name, price: p.price, inStock: p.in_stock ?? true },
          });
          results.push({ temp_id: ch.temp_id, ok: true, canonical_id: String(created.id) });
        }
        continue;
      }

      // Unknown entity type
      results.push({ temp_id: ch.temp_id, ok: false, error: 'UNSUPPORTED_ENTITY_TYPE' });
    }

    return { success: true, data: { results } };
  }

  async listReconciliation(status?: ReconciliationTaskStatus) {
    return this.prisma.reconciliationTask.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/sync/sync.service.ts
git commit -m "fix(sync): implement real CUSTOMER and MENU_ITEM upsert in non-financial sync path"
```

---

## Task 10: API `.env.example` and session log update

**Files:**
- Create: `apps/api/.env.example`
- Modify: `docs/SESSION_LOG.md`

- [ ] **Step 1: Create `apps/api/.env.example`**

Note: `redisConnection()` in `config/redis.config.ts` reads `REDIS_HOST` and `REDIS_PORT` separately (not a URL). Ports are offset from defaults since 5432/6379 are in use.

```bash
# apps/api/.env.example
DATABASE_URL=postgresql://user:password@localhost:5434/delicious24
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
API_PORT=3001
NODE_ENV=development
```

- [ ] **Step 2: Add a dated section to the TOP of `docs/SESSION_LOG.md`**

Update the `Current state` and `Next steps` sections, then prepend a dated block:

```markdown
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

## 2026-04-07 — Backend Phase 1 fixes and quality uplift

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
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example docs/SESSION_LOG.md
git commit -m "docs: add API env example and update session log for phase 1 completion"
```

---

## Task 11: Test skeleton — TrustEngineService

**Files:**
- Create: `apps/api/src/trust/trust-engine.service.spec.ts`

- [ ] **Step 1: Create the spec file**

```ts
// apps/api/src/trust/trust-engine.service.spec.ts
import { TrustEngineService } from './trust-engine.service';
import { WatService } from '../wat/wat.service';
import { RiskSegment } from '@delicious24/db';
import Decimal from 'decimal.js';

describe('TrustEngineService', () => {
  let service: TrustEngineService;

  beforeEach(() => {
    service = new TrustEngineService(new WatService());
  });

  // ── segmentForScore ────────────────────────────────────────────────────────
  describe('segmentForScore', () => {
    it('returns VIP for score 85', () => expect(service.segmentForScore(85)).toBe(RiskSegment.VIP));
    it('returns VIP for score 100', () => expect(service.segmentForScore(100)).toBe(RiskSegment.VIP));
    it('returns SAFE for score 84', () => expect(service.segmentForScore(84)).toBe(RiskSegment.SAFE));
    it('returns SAFE for score 65', () => expect(service.segmentForScore(65)).toBe(RiskSegment.SAFE));
    it('returns RISK for score 64', () => expect(service.segmentForScore(64)).toBe(RiskSegment.RISK));
    it('returns RISK for score 40', () => expect(service.segmentForScore(40)).toBe(RiskSegment.RISK));
    it('returns BANNED for score 39', () => expect(service.segmentForScore(39)).toBe(RiskSegment.BANNED));
    it('returns BANNED for score 0', () => expect(service.segmentForScore(0)).toBe(RiskSegment.BANNED));
  });

  // ── clamp ─────────────────────────────────────────────────────────────────
  describe('clamp', () => {
    it('clamps to 0 for negative input', () => expect(service.clamp(-10)).toBe(0));
    it('clamps to 100 for input over 100', () => expect(service.clamp(110)).toBe(100));
    it('keeps value unchanged when in range', () => expect(service.clamp(50)).toBe(50));
    it('keeps boundary 0', () => expect(service.clamp(0)).toBe(0));
    it('keeps boundary 100', () => expect(service.clamp(100)).toBe(100));
  });

  // ── outrightPaidSaleDelta ─────────────────────────────────────────────────
  describe('outrightPaidSaleDelta', () => {
    it('returns +8 for outright paid sale', () => {
      const d = service.outrightPaidSaleDelta();
      expect(d.delta).toBe(8);
      expect(d.reason).toBe('OUTRIGHT_PAID_SALE');
    });
  });

  // ── chargebackDelta ───────────────────────────────────────────────────────
  describe('chargebackDelta', () => {
    it('returns -20', () => {
      const d = service.chargebackDelta();
      expect(d.delta).toBe(-20);
      expect(d.reason).toBe('CHARGEBACK');
    });
  });

  // ── verifiedReceiptDelta ──────────────────────────────────────────────────
  describe('verifiedReceiptDelta', () => {
    it('returns +1', () => {
      const d = service.verifiedReceiptDelta();
      expect(d.delta).toBe(1);
    });
  });

  // ── paymentApplicationDeltas ──────────────────────────────────────────────
  describe('paymentApplicationDeltas', () => {
    // due date: 2026-04-10 noon UTC (1pm WAT)
    const dueDate = new Date('2026-04-10T12:00:00.000Z');
    const priorBalance = new Decimal('5000');
    const zeroed = new Decimal('0');

    it('on-time full settlement → +8', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'), // 1 day before due
      });
      expect(deltas).toHaveLength(1);
      expect(deltas[0].delta).toBe(8);
      expect(deltas[0].reason).toBe('ON_TIME_SETTLEMENT');
    });

    it('partial payment (balance not zeroed) → +2', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: new Decimal('2000'), // still has 2000 balance
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'),
      });
      expect(deltas).toHaveLength(1);
      expect(deltas[0].delta).toBe(2);
      expect(deltas[0].reason).toBe('PARTIAL_PAYMENT');
    });

    it('no delta when balance unchanged', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: priorBalance, // nothing paid
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'),
      });
      expect(deltas).toHaveLength(0);
    });

    it('late 1–7 days → −6', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-13T10:00:00.000Z'), // 3 days late
      });
      expect(deltas[0].delta).toBe(-6);
      expect(deltas[0].reason).toBe('LATE_1_7D');
    });

    it('late 8–30 days → −15', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-25T10:00:00.000Z'), // 15 days late
      });
      expect(deltas[0].delta).toBe(-15);
      expect(deltas[0].reason).toBe('LATE_8_30D');
    });

    it('default >30 days → −35', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-05-15T10:00:00.000Z'), // 35 days late
      });
      expect(deltas[0].delta).toBe(-35);
      expect(deltas[0].reason).toBe('DEFAULT_GT30D');
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/john/projects/Delicious24/apps/api
npm test -- --testPathPattern="trust-engine" --no-coverage
```

Expected: All tests pass. If any fail, check that `WatService` is importable without a NestJS module context (it has no dependencies — it should work).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/trust/trust-engine.service.spec.ts
git commit -m "test: add TrustEngineService unit test skeleton"
```

---

## Task 12: Test skeleton — WatService

**Files:**
- Create: `apps/api/src/wat/wat.service.spec.ts`

- [ ] **Step 1: Create the spec file**

WAT is UTC+1. So 09:00 WAT = 08:00 UTC. All expected times below use UTC ISO strings.

```ts
// apps/api/src/wat/wat.service.spec.ts
import { WatService } from './wat.service';

describe('WatService', () => {
  let service: WatService;

  beforeEach(() => {
    service = new WatService();
  });

  // ── courtesyReminderAt ────────────────────────────────────────────────────
  describe('courtesyReminderAt', () => {
    it('fires one day BEFORE the due date at 09:00 WAT', () => {
      // due date: 2026-04-10 (any time UTC)
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.courtesyReminderAt(dueDate);
      // Expected: 2026-04-09 09:00 WAT = 2026-04-09T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-09T08:00:00.000Z');
    });

    it('handles due date at midnight WAT without shifting the calendar day', () => {
      // 2026-04-10 00:00 WAT = 2026-04-09T23:00:00.000Z UTC
      const dueDate = new Date('2026-04-09T23:00:00.000Z');
      const result = service.courtesyReminderAt(dueDate);
      // Day before 2026-04-10 WAT is 2026-04-09 WAT at 09:00
      expect(result.toISOString()).toBe('2026-04-09T08:00:00.000Z');
    });
  });

  // ── urgentReminderAt ──────────────────────────────────────────────────────
  describe('urgentReminderAt', () => {
    it('fires ON the due date at 09:00 WAT', () => {
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.urgentReminderAt(dueDate);
      // Expected: 2026-04-10 09:00 WAT = 2026-04-10T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    });
  });

  // ── overdueReminderAt ─────────────────────────────────────────────────────
  describe('overdueReminderAt', () => {
    it('fires one day AFTER the due date at 09:00 WAT', () => {
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.overdueReminderAt(dueDate);
      // Expected: 2026-04-11 09:00 WAT = 2026-04-11T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-11T08:00:00.000Z');
    });
  });

  // ── calendarDaysLate ──────────────────────────────────────────────────────
  describe('calendarDaysLate', () => {
    const dueDate = new Date('2026-04-10T12:00:00.000Z');

    it('returns 0 when paid on the due date', () => {
      const paidAt = new Date('2026-04-10T14:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(0);
    });

    it('returns negative when paid before due date', () => {
      const paidAt = new Date('2026-04-08T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBeLessThan(0);
    });

    it('returns 3 when paid 3 calendar days late', () => {
      const paidAt = new Date('2026-04-13T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(3);
    });

    it('returns 35 when paid 35 days late', () => {
      const paidAt = new Date('2026-05-15T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(35);
    });
  });

  // ── appreciationSendAt ────────────────────────────────────────────────────
  describe('appreciationSendAt', () => {
    it('fires 2 minutes after the given time', () => {
      const now = new Date('2026-04-10T10:00:00.000Z');
      const result = service.appreciationSendAt(now);
      expect(result.getTime() - now.getTime()).toBe(2 * 60 * 1000);
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/john/projects/Delicious24/apps/api
npm test -- --testPathPattern="wat.service" --no-coverage
```

Expected: All tests pass. The WAT UTC+1 offset means 09:00 WAT = 08:00 UTC. If any time assertions fail, verify the `date-fns-tz` conversion in `WatService`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/wat/wat.service.spec.ts
git commit -m "test: add WatService unit test skeleton — reminder timing assertions"
```

---

## Task 13: Test skeleton — inbound parser

**Files:**
- Create: `apps/api/src/common/parse-inbound-amount.spec.ts`

- [ ] **Step 1: Create the spec file**

```ts
// apps/api/src/common/parse-inbound-amount.spec.ts
import { parseInboundAmount } from './parse-inbound-amount';

describe('parseInboundAmount', () => {
  // ── keyword matching ───────────────────────────────────────────────────────
  describe('keyword detection', () => {
    it('returns null when no payment keyword is present', () => {
      expect(parseInboundAmount('hello boss')).toBeNull();
    });
    it('returns null for "done" with no keyword', () => {
      expect(parseInboundAmount('done')).toBeNull();
    });
    it('returns null when keyword present but no number', () => {
      expect(parseInboundAmount('paid')).toBeNull();
    });
    it('matches "transferred" keyword', () => {
      expect(parseInboundAmount('transferred 5000')).not.toBeNull();
    });
    it('matches "deposited" keyword', () => {
      expect(parseInboundAmount('deposited 5000')).not.toBeNull();
    });
    it('matches "settled" keyword', () => {
      expect(parseInboundAmount('settled 5000')).not.toBeNull();
    });
    it('matches "cleared" keyword', () => {
      expect(parseInboundAmount('cleared 5000')).not.toBeNull();
    });
  });

  // ── plain amounts ─────────────────────────────────────────────────────────
  describe('plain amounts', () => {
    it('"paid 5000" → 5000', () => {
      expect(parseInboundAmount('paid 5000')).toEqual({ amount: '5000' });
    });
    it('"PAID 5,000" → 5000 (thousands separator stripped)', () => {
      expect(parseInboundAmount('PAID 5,000')?.amount).toBe('5000');
    });
    it('"payment of 2000.50" → 2000.50 (raw, no rounding)', () => {
      expect(parseInboundAmount('payment of 2000.50')).toEqual({ amount: '2000.50' });
    });
    it('"deposited 500" → 500 (≥100 taken as-is)', () => {
      expect(parseInboundAmount('deposited 500')).toEqual({ amount: '500' });
    });
    it('embedded: "please note i sent 2000 today" → 2000', () => {
      expect(parseInboundAmount('please note i sent 2000 today')?.amount).toBe('2000');
    });
  });

  // ── k-suffix ──────────────────────────────────────────────────────────────
  describe('k-suffix (×1000)', () => {
    it('"i sent 5k" → 5000', () => {
      expect(parseInboundAmount('i sent 5k')).toEqual({ amount: '5000' });
    });
    it('"transferred 5.5K" → 5500', () => {
      expect(parseInboundAmount('transferred 5.5K')).toEqual({ amount: '5500' });
    });
    it('"paid 10K" → 10000', () => {
      expect(parseInboundAmount('paid 10K')).toEqual({ amount: '10000' });
    });
  });

  // ── 1–99 integers as thousands ────────────────────────────────────────────
  describe('1–99 integers treated as thousands', () => {
    it('"sent 5" → 5000', () => {
      expect(parseInboundAmount('sent 5')).toEqual({ amount: '5000' });
    });
    it('"payment of 50" → 50000', () => {
      expect(parseInboundAmount('payment of 50')).toEqual({ amount: '50000' });
    });
    it('"paid 99" → 99000', () => {
      expect(parseInboundAmount('paid 99')).toEqual({ amount: '99000' });
    });
    it('"paid 100" → 100 (boundary: ≥100 taken as-is)', () => {
      expect(parseInboundAmount('paid 100')).toEqual({ amount: '100' });
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/john/projects/Delicious24/apps/api
npm test -- --testPathPattern="parse-inbound-amount" --no-coverage
```

Expected: All tests pass. If the `"PAID 5,000"` case fails, check that `replace(/,/g, '')` is applied before `parseFloat` in the plain amount path.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/parse-inbound-amount.spec.ts
git commit -m "test: add parse-inbound-amount unit test skeleton"
```

---

## Task 14: OpenAPI / Swagger setup

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/main.ts`
- Modify: all DTO files (add `@ApiProperty`)
- Modify: all controller files (add `@ApiTags`, `@ApiOperation`)
- Create: `apps/api/scripts/export-openapi.ts`

- [ ] **Step 1: Install `@nestjs/swagger`**

```bash
cd /home/john/projects/Delicious24/apps/api
npm install @nestjs/swagger
```

- [ ] **Step 2: Wire Swagger into `apps/api/src/main.ts`**

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Delicious24 API')
    .setDescription('Restaurant credit system — admin backend')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-actor' }, 'actor')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port);
  console.log(`API listening on http://127.0.0.1:${port}/api`);
  console.log(`Swagger UI at  http://127.0.0.1:${port}/api/docs`);
}

bootstrap();
```

- [ ] **Step 3: Add `@ApiProperty` to `CreateOrderDto`**

```ts
// apps/api/src/orders/dto/create-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import { OrderType } from '@delicious24/db';

export class OrderLineItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber() @Min(1)
  menu_item_id!: number;

  @ApiProperty({ example: 2 })
  @IsNumber() @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-of-customer' })
  @IsUUID()
  customer_id!: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional({ type: [OrderLineItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderLineItemDto)
  items?: OrderLineItemDto[];

  @ApiProperty({ example: '2500.00' })
  @IsString() @IsNotEmpty()
  total!: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @ValidateIf((o) => o.type === OrderType.CREDIT || (o.type === OrderType.CASH_WITHDRAWAL && o.as_credit))
  @IsString() @IsNotEmpty()
  due_date?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  as_credit?: boolean;
}
```

- [ ] **Step 4: Add `@ApiProperty` to `ConfirmPaymentDto`**

```ts
// apps/api/src/payments/dto/confirm-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ example: '2500' })
  @IsString() @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for safe retries' })
  @IsOptional() @IsString()
  idempotency_key?: string;
}
```

- [ ] **Step 5: Add `@ApiProperty` to `InboundWebhookDto`**

```ts
// apps/api/src/webhook/dto/inbound-webhook.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class InboundWebhookDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString() @IsNotEmpty()
  from_phone!: string;

  @ApiProperty({ example: 'i sent 5k' })
  @IsString() @IsNotEmpty()
  message_text!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  raw_payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  idempotency_key?: string;
}
```

- [ ] **Step 6: Add `@ApiProperty` to `CustomerSearchDto`, `CreateCustomerDto`, `UpdateCustomerDto`**

```ts
// apps/api/src/customers/dto/customer-search.dto.ts — add @ApiProperty to q, page, limit
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// ... existing imports

export class CustomerSearchDto {
  @ApiProperty({ example: 'John' })
  @IsString() @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}
```

```ts
// apps/api/src/customers/dto/create-customer.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ngozi Adeyemi' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString() @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'ngozi@example.com' })
  @IsOptional() @IsEmail()
  email?: string;
}
```

```ts
// apps/api/src/customers/dto/update-customer.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail()
  email?: string;
}
```

- [ ] **Step 7: Add `@ApiProperty` to remaining DTOs**

```ts
// apps/api/src/sync/dto/sync-batch.dto.ts — add @ApiProperty to all fields
// apps/api/src/scheduler/dto/scheduled-job-filter.dto.ts — add @ApiPropertyOptional
// apps/api/src/scheduler/dto/manual-reminder-body.dto.ts — add @ApiProperty
// apps/api/src/pending-payments/dto/pending-payment-filter.dto.ts — add @ApiPropertyOptional
// apps/api/src/pending-payments/dto/update-pending-payment.dto.ts — add @ApiProperty
```

For `SyncBatchDto`:
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// add @ApiProperty({ example: 'client-device-01' }) to client_id
// add @ApiProperty({ type: [SyncChangeDto] }) to changes
// add @ApiPropertyOptional() to idempotency_key
```

For `ScheduledJobFilterDto`, `ManualReminderBodyDto`, `PendingPaymentFilterDto`, `UpdatePendingPaymentDto` — add `@ApiPropertyOptional()` to optional fields and `@ApiProperty()` to required fields following the same pattern.

- [ ] **Step 8: Add `@ApiTags` and `@ApiOperation` to all controllers**

```ts
// Example pattern — apply to every controller:
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  @ApiOperation({ summary: 'Create a new order (PAID, CREDIT, or CASH_WITHDRAWAL)' })
  @Post()
  create(...) { ... }
}
```

Apply to all controllers:
- `OrdersController` → `@ApiTags('orders')`
- `CustomersController` → `@ApiTags('customers')`
- `PaymentsController` → `@ApiTags('credits')`
- `WebhookController` → `@ApiTags('webhooks')`
- `SchedulerController` → `@ApiTags('scheduled-jobs')`
- `SyncController` → `@ApiTags('sync')`
- `MenuController` → `@ApiTags('menu-items')`
- `PendingPaymentsController` → `@ApiTags('pending-payments')`
- `AuditController` → `@ApiTags('audit-log')`

Each `@Post`, `@Get`, `@Patch` method gets `@ApiOperation({ summary: '...' })`.

- [ ] **Step 9: Create `apps/api/scripts/export-openapi.ts`**

```ts
// apps/api/scripts/export-openapi.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function exportSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Delicious24 API')
    .setDescription('Restaurant credit system — admin backend')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

exportSpec();
```

Add to `apps/api/package.json` scripts:
```json
"export:openapi": "ts-node --transpile-only -r tsconfig-paths/register scripts/export-openapi.ts"
```

- [ ] **Step 10: Start the API and verify Swagger UI loads**

```bash
cd /home/john/projects/Delicious24/apps/api
# Check available port first
node -e "require('net').createServer().listen(3001, () => { console.log('3001 free'); process.exit(0); }).on('error', () => { console.log('3001 in use'); process.exit(1); })"
# Start (uses API_PORT env var, defaults to 3001)
API_PORT=3001 npm run start:dev
```

Then open `http://127.0.0.1:3001/api/docs` in a browser. Verify all tags appear and at least one DTO shows properties.

- [ ] **Step 11: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/main.ts \
        apps/api/scripts/ apps/api/src/orders/dto/ apps/api/src/customers/dto/ \
        apps/api/src/payments/dto/ apps/api/src/webhook/dto/ \
        apps/api/src/scheduler/dto/ apps/api/src/sync/dto/ \
        apps/api/src/pending-payments/dto/ \
        apps/api/src/orders/orders.controller.ts \
        apps/api/src/customers/customers.controller.ts \
        apps/api/src/payments/payments.controller.ts \
        apps/api/src/webhook/webhook.controller.ts \
        apps/api/src/scheduler/scheduler.controller.ts \
        apps/api/src/sync/sync.controller.ts \
        apps/api/src/menu/menu.controller.ts \
        apps/api/src/pending-payments/pending-payments.controller.ts \
        apps/api/src/audit/audit.controller.ts
git commit -m "feat(swagger): add OpenAPI/Swagger UI at /api/docs with full DTO and controller decorations"
```

---

## Self-Review Checklist

- [x] **1a BullMQ backoff** → Task 2 (backoff.config.ts + consumers + scheduler)
- [x] **1b Remove rounding from payments** → Task 3
- [x] **1c Idempotency status code** → Task 4
- [x] **1d PAID trust score atomic** → Task 5
- [x] **1e WatService timing** → Task 1
- [x] **2a Customer CREATE + PATCH** → Task 7
- [x] **2b Pending payments filtering + PATCH** → Task 8
- [x] **2c Sync non-financial upsert** → Task 9
- [x] **2d API .env.example** → Task 10
- [x] **2e Session log** → Task 10
- [x] **3a Parser upgrade** → Task 6
- [x] **3b Test skeletons** → Tasks 11, 12, 13
- [x] **3c OpenAPI** → Task 14
- [x] **Acceptance criteria 1–11** → covered across tasks above
