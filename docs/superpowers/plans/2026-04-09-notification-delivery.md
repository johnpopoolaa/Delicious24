# Notification Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `NotificationSenderService` logger stub with a real Twilio implementation that sends WhatsApp and/or SMS reminders and appreciation messages, deduplicates on retry, and logs every send attempt.

**Architecture:** Single-service approach. `NotificationSenderService` owns channel routing, template rendering, Twilio API calls, and delivery logging. Per-customer channel preference (`WHATSAPP | SMS | BOTH`) is stored on the `Customer` model. Every send attempt — success or failure — is recorded in `NotificationLog`.

**Tech Stack:** Twilio Node SDK (`twilio`), Prisma 6 (new `NotifChannel` enum + `NotificationLog` model), NestJS 10, BullMQ 5, Jest + ts-jest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/db/prisma/schema.prisma` | Modify | Add `NotifChannel` enum, `notifChannel` on `Customer`, `NotificationLog` model, `notificationLogs` on `ScheduledJob` |
| `packages/db/prisma/migrations/` | Auto-created | Migration SQL |
| `apps/api/src/notifications/notifications.module.ts` | Modify | Import `PrismaModule`, add `TWILIO_CLIENT` factory provider |
| `apps/api/src/notifications/notification-sender.service.ts` | Modify | Full Twilio implementation with dedup, template rendering, channel routing |
| `apps/api/src/notifications/notification-sender.service.spec.ts` | Create | Unit tests with mocked Prisma + Twilio client |
| `apps/api/src/queue/reminders.consumer.ts` | Modify | Pass `scheduledJobId` + `creditId` to `sendReminder` |
| `apps/api/src/queue/appreciation.consumer.ts` | Modify | Pass `scheduledJobId` + `customerId` to `sendAppreciation` |
| `apps/api/src/customers/dto/update-customer.dto.ts` | Modify | Add `notif_channel?: NotifChannel` field |
| `apps/api/src/customers/customers.service.ts` | Modify | Add `notifChannel` to `updateCustomer` data |
| `apps/api/.env.example` | Modify | Add `TWILIO_*` placeholder keys |

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Auto-created: `packages/db/prisma/migrations/`

- [ ] **Step 1: Edit schema.prisma — add enum, Customer field, NotificationLog model, ScheduledJob relation**

Replace the block after the existing enums (after `ReconciliationTaskStatus`) and after the `Customer` model, adding:

**After the `ReconciliationTaskStatus` enum, add:**
```prisma
enum NotifChannel {
  WHATSAPP
  SMS
  BOTH
}
```

**In the `Customer` model, add this field before `createdAt`:**
```prisma
  notifChannel       NotifChannel @default(WHATSAPP) @map("notif_channel")
```

**After the `AuditLog` model (end of file), add:**
```prisma
model NotificationLog {
  id             String       @id @default(uuid()) @db.Uuid
  scheduledJobId String       @map("scheduled_job_id") @db.Uuid
  channel        NotifChannel
  toPhone        String       @map("to_phone")
  messageSid     String?      @map("message_sid")
  status         String
  error          String?
  createdAt      DateTime     @default(now()) @map("created_at")

  scheduledJob ScheduledJob @relation(fields: [scheduledJobId], references: [id])

  @@index([scheduledJobId])
  @@map("notification_logs")
}
```

**In the `ScheduledJob` model, add relation after the existing `customer` relation line:**
```prisma
  notificationLogs NotificationLog[]
```

- [ ] **Step 2: Run migration**

```bash
cd /home/john/projects/Delicious24/packages/db
npx prisma migrate dev --name add_notif_channel_and_notification_log
```

Expected: Migration created and applied. Output includes `The following migration(s) have been applied`.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npm run db:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/john/projects/Delicious24
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): add NotifChannel enum, Customer.notifChannel, NotificationLog model"
```

---

## Task 2: Install Twilio + wire NotificationsModule

**Files:**
- Modify: `apps/api/src/notifications/notifications.module.ts`

- [ ] **Step 1: Install Twilio SDK**

```bash
cd /home/john/projects/Delicious24
npm install twilio --workspace=apps/api
```

Expected: `twilio` appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Replace NotificationsModule**

Full file content for `apps/api/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationSenderService } from './notification-sender.service';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationSenderService,
    {
      provide: 'TWILIO_CLIENT',
      useFactory: (): Twilio =>
        twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!),
    },
  ],
  exports: [NotificationSenderService],
})
export class NotificationsModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/notifications/notifications.module.ts apps/api/package.json apps/api/package-lock.json package-lock.json
git commit -m "feat(notifications): install twilio, wire PrismaModule and TWILIO_CLIENT provider"
```

---

## Task 3: Write failing unit tests for NotificationSenderService

**Files:**
- Create: `apps/api/src/notifications/notification-sender.service.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { Test } from '@nestjs/testing';
import { NotifChannel } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationSenderService } from './notification-sender.service';

const makePrisma = () => ({
  credit: { findUnique: jest.fn() },
  customer: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  notificationLog: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeCredit = (notifChannel: NotifChannel = NotifChannel.WHATSAPP) => ({
  id: 'credit-1',
  balance: { toString: () => '1500.00' },
  customer: { name: 'Ngozi', phone: '+2348012345601', notifChannel },
});

const makeOrder = () => ({
  id: 'order-1',
  total: { toString: () => '1800.00' },
});

const makeCustomer = (notifChannel: NotifChannel = NotifChannel.WHATSAPP) => ({
  id: 'customer-1',
  name: 'Ngozi',
  phone: '+2348012345601',
  notifChannel,
});

describe('NotificationSenderService', () => {
  let service: NotificationSenderService;
  let prisma: ReturnType<typeof makePrisma>;
  let twilioCreate: jest.Mock;

  beforeEach(async () => {
    twilioCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });
    prisma = makePrisma();

    const module = await Test.createTestingModule({
      providers: [
        NotificationSenderService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: 'TWILIO_CLIENT',
          useValue: {
            messages: { create: twilioCreate },
          },
        },
      ],
    }).compile();

    service = module.get(NotificationSenderService);
  });

  // ── sendReminder ─────────────────────────────────────────────────────────────

  describe('sendReminder', () => {
    const basePayload = {
      scheduledJobId: 'job-1',
      creditId: 'credit-1',
      customerPhone: '+2348012345601',
      reminderType: 'COURTESY',
      templateId: 'courtesy_v1',
    };

    it('sends WhatsApp message and writes SENT log for WHATSAPP channel', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'whatsapp:+2348012345601' }),
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledJobId: 'job-1',
          channel: NotifChannel.WHATSAPP,
          status: 'SENT',
          messageSid: 'SM_test_123',
        }),
      });
    });

    it('sends SMS and writes SENT log for SMS channel', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.SMS));

      await service.sendReminder({ ...basePayload });

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+2348012345601' }),
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ channel: NotifChannel.SMS, status: 'SENT' }),
      });
    });

    it('sends both channels and writes 2 SENT logs for BOTH', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.BOTH));

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(2);
      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
    });

    it('skips channel if SENT log already exists (dedup on retry)', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1', status: 'SENT' });

      await service.sendReminder(basePayload);

      expect(twilioCreate).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('writes FAILED log and throws when Twilio errors', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));
      twilioCreate.mockRejectedValue(new Error('Twilio unavailable'));

      await expect(service.sendReminder(basePayload)).rejects.toThrow('WHATSAPP: Twilio unavailable');

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'FAILED', error: 'Twilio unavailable' }),
      });
    });

    it('throws when credit is not found', async () => {
      prisma.credit.findUnique.mockResolvedValue(null);

      await expect(service.sendReminder(basePayload)).rejects.toThrow('Credit credit-1 not found');
    });

    it('renders courtesy_v1 template with name and balance', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit());

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Ngozi'),
        }),
      );
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('1500.00'),
        }),
      );
    });
  });

  // ── sendAppreciation ──────────────────────────────────────────────────────────

  describe('sendAppreciation', () => {
    const basePayload = {
      scheduledJobId: 'job-2',
      customerId: 'customer-1',
      customerPhone: '+2348012345601',
      orderId: 'order-1',
      templateId: 'appreciation_v1',
    };

    it('sends WhatsApp appreciation and writes SENT log', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      await service.sendAppreciation(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledJobId: 'job-2',
          channel: NotifChannel.WHATSAPP,
          status: 'SENT',
        }),
      });
    });

    it('renders appreciation_v1 template with name and order total', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      await service.sendAppreciation(basePayload);

      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Ngozi'),
        }),
      );
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('1800.00'),
        }),
      );
    });

    it('throws when customer is not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.sendAppreciation(basePayload)).rejects.toThrow(
        'Customer customer-1 not found',
      );
    });

    it('deduplicates on retry for appreciation', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.order.findUnique.mockResolvedValue(makeOrder());
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-2', status: 'SENT' });

      await service.sendAppreciation(basePayload);

      expect(twilioCreate).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/john/projects/Delicious24/apps/api
npx jest src/notifications/notification-sender.service.spec.ts --no-coverage
```

Expected: Tests fail with something like `TypeError: service.sendReminder is not a function` or similar — the stub doesn't have the right signature yet.

---

## Task 4: Implement NotificationSenderService

**Files:**
- Modify: `apps/api/src/notifications/notification-sender.service.ts`

- [ ] **Step 1: Replace the file with full implementation**

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotifChannel } from '@delicious24/db';
import { Twilio } from 'twilio';
import { PrismaService } from '../prisma/prisma.service';

export type SendReminderPayload = {
  scheduledJobId: string;
  creditId: string;
  customerPhone: string;
  reminderType: string;
  templateId: string;
};

export type SendAppreciationPayload = {
  scheduledJobId: string;
  customerId: string;
  customerPhone: string;
  orderId: string;
  templateId: string;
};

@Injectable()
export class NotificationSenderService {
  private readonly log = new Logger(NotificationSenderService.name);
  private readonly smsFrom: string;
  private readonly waFrom: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('TWILIO_CLIENT') private readonly twilio: Twilio,
  ) {
    this.smsFrom = process.env.TWILIO_SMS_FROM!;
    this.waFrom = process.env.TWILIO_WHATSAPP_FROM!;
  }

  async sendReminder(payload: SendReminderPayload): Promise<void> {
    const credit = await this.prisma.credit.findUnique({
      where: { id: payload.creditId },
      include: { customer: true },
    });
    if (!credit) {
      throw new Error(`Credit ${payload.creditId} not found`);
    }
    const body = this.renderMessage(payload.templateId, {
      name: credit.customer.name,
      balance: credit.balance.toString(),
    });
    const channels = this.resolveChannels(credit.customer.notifChannel);
    const errors: string[] = [];
    for (const channel of channels) {
      if (await this.alreadySent(payload.scheduledJobId, channel)) {
        this.log.log(`Skipping ${channel} for job ${payload.scheduledJobId} — already SENT`);
        continue;
      }
      await this.send(payload.scheduledJobId, channel, payload.customerPhone, body, errors);
    }
    if (errors.length > 0) throw new Error(errors.join('; '));
  }

  async sendAppreciation(payload: SendAppreciationPayload): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) {
      throw new Error(`Customer ${payload.customerId} not found`);
    }
    const order =
      payload.orderId !== 'manual'
        ? await this.prisma.order.findUnique({ where: { id: payload.orderId } })
        : null;
    const amount = order ? order.total.toString() : '0.00';
    const body = this.renderMessage(payload.templateId, {
      name: customer.name,
      amount,
    });
    const channels = this.resolveChannels(customer.notifChannel);
    const errors: string[] = [];
    for (const channel of channels) {
      if (await this.alreadySent(payload.scheduledJobId, channel)) {
        this.log.log(`Skipping ${channel} for job ${payload.scheduledJobId} — already SENT`);
        continue;
      }
      await this.send(payload.scheduledJobId, channel, payload.customerPhone, body, errors);
    }
    if (errors.length > 0) throw new Error(errors.join('; '));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private resolveChannels(notifChannel: NotifChannel): NotifChannel[] {
    if (notifChannel === NotifChannel.BOTH) return [NotifChannel.WHATSAPP, NotifChannel.SMS];
    return [notifChannel];
  }

  private async alreadySent(scheduledJobId: string, channel: NotifChannel): Promise<boolean> {
    const existing = await this.prisma.notificationLog.findFirst({
      where: { scheduledJobId, channel, status: 'SENT' },
    });
    return !!existing;
  }

  private async send(
    scheduledJobId: string,
    channel: NotifChannel,
    phone: string,
    body: string,
    errors: string[],
  ): Promise<void> {
    const to = channel === NotifChannel.WHATSAPP ? `whatsapp:${phone}` : phone;
    const from =
      channel === NotifChannel.WHATSAPP ? `whatsapp:${this.waFrom}` : this.smsFrom;
    try {
      const result = await this.twilio.messages.create({ to, from, body });
      await this.prisma.notificationLog.create({
        data: { scheduledJobId, channel, toPhone: phone, messageSid: result.sid, status: 'SENT' },
      });
      this.log.log(`${channel} sent to ${phone}: ${result.sid}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.notificationLog.create({
        data: { scheduledJobId, channel, toPhone: phone, status: 'FAILED', error: msg },
      });
      errors.push(`${channel}: ${msg}`);
    }
  }

  private renderMessage(
    templateId: string,
    vars: { name: string; balance?: string; amount?: string },
  ): string {
    switch (templateId) {
      case 'courtesy_v1':
      case 'manual_courtesy':
        return `Hello ${vars.name}, this is a reminder from Delicious24 that your balance of ₦${vars.balance} is due tomorrow. Kindly make your payment at your earliest convenience. Thank you.`;
      case 'urgent_v1':
      case 'manual_urgent':
        return `Hello ${vars.name}, your balance of ₦${vars.balance} with Delicious24 is due today. Please make your payment to avoid any inconvenience. Thank you.`;
      case 'overdue_v1':
      case 'manual_overdue':
        return `Hello ${vars.name}, your balance of ₦${vars.balance} with Delicious24 was due yesterday and is now overdue. Please settle your account as soon as possible. Contact us if you need assistance.`;
      case 'appreciation_v1':
        return `Thank you ${vars.name}! Your payment of ₦${vars.amount} has been received. We appreciate your business and look forward to serving you again at Delicious24.`;
      case 'manual_notice':
        return `Hello ${vars.name}, this is a reminder from Delicious24 that your balance of ₦${vars.balance} is outstanding. Please make your payment at your earliest convenience. Thank you.`;
      default:
        return `Hello ${vars.name}, this is a reminder from Delicious24. Please make your payment at your earliest convenience. Thank you.`;
    }
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /home/john/projects/Delicious24/apps/api
npx jest src/notifications/notification-sender.service.spec.ts --no-coverage
```

Expected: All 10 tests pass. Output: `Tests: 10 passed, 10 total`.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass (50+ tests from trust, wat, and parse-inbound-amount specs, plus the 10 new ones).

- [ ] **Step 4: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/src/notifications/notification-sender.service.ts apps/api/src/notifications/notification-sender.service.spec.ts
git commit -m "feat(notifications): implement Twilio delivery with dedup, template rendering, and channel routing"
```

---

## Task 5: Update RemindersConsumer

**Files:**
- Modify: `apps/api/src/queue/reminders.consumer.ts`

The consumer currently calls `sendReminder({ jobKey, customerPhone, reminderType, templateId })`. The job payload already has `scheduledJobId` and `creditId` — they just need to be passed to the sender.

- [ ] **Step 1: Edit reminders.consumer.ts — update the destructure and sendReminder call**

Change line 22 (destructure) from:
```typescript
    const { scheduledJobId, jobKey, customerPhone, reminderType, templateId } = job.data;
```
To:
```typescript
    const { scheduledJobId, jobKey, creditId, customerPhone, reminderType, templateId } = job.data;
```

Change the `sendReminder` call (lines 37-42) from:
```typescript
      await this.sender.sendReminder({
        jobKey,
        customerPhone,
        reminderType,
        templateId,
      });
```
To:
```typescript
      await this.sender.sendReminder({
        scheduledJobId,
        creditId,
        customerPhone,
        reminderType,
        templateId,
      });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/john/projects/Delicious24/apps/api
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/src/queue/reminders.consumer.ts
git commit -m "feat(queue): pass scheduledJobId and creditId to sendReminder"
```

---

## Task 6: Update AppreciationConsumer

**Files:**
- Modify: `apps/api/src/queue/appreciation.consumer.ts`

The consumer currently calls `sendAppreciation({ customerPhone, orderId, templateId })`. The job payload already has `scheduledJobId` and `customerId`.

- [ ] **Step 1: Edit appreciation.consumer.ts — update the destructure and sendAppreciation call**

Change line 22 (destructure) from:
```typescript
    const { scheduledJobId, customerPhone, orderId, templateId } = job.data;
```
To:
```typescript
    const { scheduledJobId, customerId, customerPhone, orderId, templateId } = job.data;
```

Change the `sendAppreciation` call (lines 37-38) from:
```typescript
      await this.sender.sendAppreciation({ customerPhone, orderId, templateId });
```
To:
```typescript
      await this.sender.sendAppreciation({ scheduledJobId, customerId, customerPhone, orderId, templateId });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/john/projects/Delicious24/apps/api
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/src/queue/appreciation.consumer.ts
git commit -m "feat(queue): pass scheduledJobId and customerId to sendAppreciation"
```

---

## Task 7: Customer endpoint — add notif_channel

**Files:**
- Modify: `apps/api/src/customers/dto/update-customer.dto.ts`
- Modify: `apps/api/src/customers/customers.service.ts`

- [ ] **Step 1: Update UpdateCustomerDto**

Full file content for `apps/api/src/customers/dto/update-customer.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotifChannel } from '@delicious24/db';

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: NotifChannel })
  @IsOptional()
  @IsEnum(NotifChannel)
  notif_channel?: NotifChannel;
}
```

- [ ] **Step 2: Update CustomersService.updateCustomer**

In `apps/api/src/customers/customers.service.ts`, change the method signature and data object:

Change line 25 from:
```typescript
  async updateCustomer(id: string, dto: { name?: string; phone?: string; email?: string }) {
```
To:
```typescript
  async updateCustomer(id: string, dto: { name?: string; phone?: string; email?: string; notif_channel?: NotifChannel }) {
```

Add `NotifChannel` to the import on line 2:
```typescript
import { CreditStatus, NotifChannel, Prisma } from '@delicious24/db';
```

Change lines 27-30 (the `data` object in `prisma.customer.update`) from:
```typescript
        data: { name: dto.name, phone: dto.phone, email: dto.email },
```
To:
```typescript
        data: { name: dto.name, phone: dto.phone, email: dto.email, notifChannel: dto.notif_channel },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/john/projects/Delicious24/apps/api
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/src/customers/dto/update-customer.dto.ts apps/api/src/customers/customers.service.ts
git commit -m "feat(customers): add notif_channel field to PATCH /api/customers/:id"
```

---

## Task 8: Update .env.example

**Files:**
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add Twilio keys to .env.example**

Append to `apps/api/.env.example`:

```
# Twilio — notification delivery
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_SMS_FROM=+1234567890
# TWILIO_WHATSAPP_FROM=+14155238886   # sandbox: Twilio shared number; prod: approved WA Business number
```

- [ ] **Step 2: Add the keys to your local .env**

In `apps/api/.env`, add (with real sandbox credentials):

```
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_SMS_FROM=<your-twilio-number>
TWILIO_WHATSAPP_FROM=+14155238886
```

Note: `.env` is gitignored — it will not be committed.

- [ ] **Step 3: Commit**

```bash
cd /home/john/projects/Delicious24
git add apps/api/.env.example
git commit -m "chore: add TWILIO_* env var placeholders to .env.example"
```

---

## Task 9: Worker end-to-end verification

This is a manual verification step — no code changes. Run after all previous tasks are committed and the worker is rebuilt.

- [ ] **Step 1: Build and start the API + worker**

```bash
cd /home/john/projects/Delicious24/apps/api
npm run build
# Start API (in background terminal)
node dist/main.js &
# Start worker (in background terminal)
node dist/worker.main.js &
```

- [ ] **Step 2: Create a test customer and CREDIT order**

```bash
# Create customer
curl -s -X POST http://127.0.0.1:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Verification Test","phone":"+23480900000001"}'

# Note the customer ID from response, then create credit order
DUE=$(date -d "+7 days" +%Y-%m-%d)
curl -s -X POST http://127.0.0.1:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "x-actor: admin" \
  -d "{\"customer_id\":\"<CUSTOMER_ID>\",\"type\":\"CREDIT\",\"total\":\"2000.00\",\"due_date\":\"$DUE\",\"items\":[]}"
```

Expected: 3 scheduled jobs created (COURTESY, URGENT, OVERDUE).

- [ ] **Step 3: Get the scheduled job ID and trigger it manually**

```bash
curl -s "http://127.0.0.1:3001/api/scheduled-jobs?creditId=<CREDIT_ID>" | python3 -m json.tool

# Trigger the COURTESY job
curl -s -X POST http://127.0.0.1:3001/api/scheduled-jobs/<JOB_ID>/send-now
```

- [ ] **Step 4: Verify NotificationLog row**

```bash
psql "$DATABASE_URL" -c "SELECT id, channel, to_phone, status, message_sid, error FROM notification_logs ORDER BY created_at DESC LIMIT 5;"
```

Expected: Row with `status = SENT` and a real `message_sid` starting with `SM`.

- [ ] **Step 5: Check Twilio console**

Open the Twilio console → Messaging → Logs. Confirm the message appears with "Delivered" or "Sent" status.

- [ ] **Step 6: Verify deduplication**

Trigger the same job again via `send-now`:

```bash
curl -s -X POST http://127.0.0.1:3001/api/scheduled-jobs/<JOB_ID>/send-now
```

```bash
psql "$DATABASE_URL" -c "SELECT channel, status, message_sid FROM notification_logs WHERE scheduled_job_id = '<JOB_ID>';"
```

Expected: Still only 1 SENT row (dedup check prevented re-send).

---

## Self-Review Checklist

**Spec coverage:**
- ✅ NotifChannel enum (WHATSAPP, SMS, BOTH) — Task 1
- ✅ Customer.notifChannel default WHATSAPP — Task 1
- ✅ NotificationLog model with all required fields — Task 1
- ✅ sendReminder: fetch credit+customer at send time — Task 4
- ✅ sendReminder: template rendering — Task 4
- ✅ sendReminder: channel routing — Task 4
- ✅ sendReminder: dedup check per channel — Task 4
- ✅ sendReminder: Twilio API call (WhatsApp prefix / SMS) — Task 4
- ✅ sendReminder: SENT/FAILED log per channel — Task 4
- ✅ sendAppreciation: same pattern, fetches customer + order — Task 4
- ✅ Error handling: throw on failure → BullMQ retries — Task 4
- ✅ BOTH channel partial failure: each channel logged independently — Task 4
- ✅ RemindersConsumer: passes scheduledJobId + creditId — Task 5
- ✅ AppreciationConsumer: passes scheduledJobId + customerId — Task 6
- ✅ PATCH /api/customers/:id accepts notif_channel — Task 7
- ✅ .env.example Twilio vars — Task 8
- ✅ Worker end-to-end verification steps — Task 9

**Type consistency:**
- `SendReminderPayload` defined in notification-sender.service.ts, used in reminders.consumer.ts ✅
- `SendAppreciationPayload` defined in notification-sender.service.ts, used in appreciation.consumer.ts ✅
- `NotifChannel` imported from `@delicious24/db` in all files that use it ✅
- `Twilio` type from `twilio` package used for injection ✅
