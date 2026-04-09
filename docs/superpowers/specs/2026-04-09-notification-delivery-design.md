# Notification Delivery System — Design Spec

**Date:** 2026-04-09  
**Status:** Approved  
**Scope:** WhatsApp + SMS delivery via Twilio, per-customer channel preference, delivery logging, worker verification

---

## Goal

Replace the `NotificationSenderService` logger stub with a real Twilio implementation that sends payment reminders and appreciation messages to customers via WhatsApp and/or SMS, logs every send attempt, and avoids duplicate sends on retry.

---

## Architecture

Single-service approach (Approach A). `NotificationSenderService` is the only delivery layer — it handles channel routing, template rendering, Twilio API calls, and delivery logging. No separate channel adapters. If a third channel is ever added, adapters can be introduced at that point.

---

## Schema Changes

### `NotifChannel` enum (new)
```prisma
enum NotifChannel {
  WHATSAPP
  SMS
  BOTH
}
```

### `Customer` model — add field
```prisma
notifChannel  NotifChannel  @default(WHATSAPP)  @map("notif_channel")
```

Default is `WHATSAPP`. Admin can override per customer via `PATCH /api/customers/:id`.

### `NotificationLog` model (new)
```prisma
model NotificationLog {
  id             String       @id @default(uuid()) @db.Uuid
  scheduledJobId String       @map("scheduled_job_id") @db.Uuid
  channel        NotifChannel
  toPhone        String       @map("to_phone")
  messageSid     String?      @map("message_sid")
  status         String                              // "SENT" | "FAILED"
  error          String?
  createdAt      DateTime     @default(now())        @map("created_at")

  scheduledJob   ScheduledJob @relation(fields: [scheduledJobId], references: [id])

  @@index([scheduledJobId])
  @@map("notification_logs")
}
```

One row per send attempt per channel. If `notifChannel = BOTH` and both succeed, two `SENT` rows are written.

---

## Message Templates

Templates are rendered inline in `NotificationSenderService` via a `switch` on `templateId`. Variables fetched from DB at send time (not from job payload) to ensure accuracy.

| Template ID | Trigger | Message |
|---|---|---|
| `courtesy_v1` | Day before due date | Hello {name}, this is a reminder from Delicious24 that your balance of ₦{balance} is due tomorrow. Kindly make your payment at your earliest convenience. Thank you. |
| `urgent_v1` | Due date | Hello {name}, your balance of ₦{balance} with Delicious24 is due today. Please make your payment to avoid any inconvenience. Thank you. |
| `overdue_v1` | Day after due date | Hello {name}, your balance of ₦{balance} with Delicious24 was due yesterday and is now overdue. Please settle your account as soon as possible. Contact us if you need assistance. |
| `appreciation_v1` | After PAID order | Thank you {name}! Your payment of ₦{amount} has been received. We appreciate your business and look forward to serving you again at Delicious24. |

Variables: `{name}` = customer name, `{balance}` = current credit balance (fetched at send time), `{amount}` = order total.

**WhatsApp note:** These templates must be submitted to Meta for approval before production use. For sandbox testing, any message text works.

---

## NotificationSenderService — Delivery Flow

### `sendReminder(payload: { scheduledJobId, creditId, customerPhone, reminderType, templateId })`

1. Fetch `credit` (with `customer`) from DB using `creditId` — gets current balance and `notifChannel`
2. Render message text from `templateId` + customer name + current balance
3. Determine channels from `customer.notifChannel`
4. For each channel (`WHATSAPP`, `SMS`):
   - Check `NotificationLog` for existing `SENT` row with `scheduledJobId + channel` → **skip if found** (dedup on retry)
   - Call Twilio: `to = whatsapp:+{phone}` for WhatsApp, `+{phone}` for SMS
   - On success: write `NotificationLog { status: SENT, messageSid }`
   - On failure: write `NotificationLog { status: FAILED, error }`, collect error
5. If any channel failed, throw — BullMQ retries with 1m/5m/20m backoff

### `sendAppreciation(payload: { scheduledJobId, customerId, customerPhone, orderId, templateId })`

Same pattern but fetches `customer` (for name + `notifChannel`) and `order` (for total amount).

---

## Consumer Changes

`RemindersConsumer` and `AppreciationConsumer` pass `scheduledJobId` and `creditId`/`customerId`+`orderId` to the sender so it can fetch current data at send time. Both already pass `scheduledJobId` — `creditId` needs to be added to the `sendReminder` call.

---

## Customer Endpoint Update

`PATCH /api/customers/:id` accepts an optional `notif_channel: WHATSAPP | SMS | BOTH` field. `UpdateCustomerDto` and `CustomersService.updateCustomer` updated accordingly.

---

## Environment Variables

Added to `apps/api/.env` (gitignored) and documented in `apps/api/.env.example`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_SMS_FROM=+1234567890
TWILIO_WHATSAPP_FROM=+14155238886
```

For sandbox: `TWILIO_WHATSAPP_FROM=+14155238886` (Twilio's shared sandbox number).  
For production: replace with the approved WhatsApp Business number.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Twilio API error | Log `FAILED`, re-throw → BullMQ retries (1m/5m/20m) |
| BOTH channel: one succeeds, one fails | Each channel logged independently; dedup check on retry prevents re-sending the succeeded channel |
| All 3 retries exhausted | `scheduledJob.status = FAILED`; admin re-triggers via `POST /api/scheduled-jobs/:id/send-now` |
| Credit/customer not found at send time | Log `FAILED`, throw → retries, eventually `FAILED` — visible in job list |

---

## Files Changed

| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | Add `NotifChannel` enum, `notifChannel` on Customer, `NotificationLog` model |
| `packages/db/prisma/migrations/` | New migration |
| `apps/api/src/notifications/notification-sender.service.ts` | Replace stub with Twilio implementation |
| `apps/api/src/queue/reminders.consumer.ts` | Pass `creditId` to `sendReminder` |
| `apps/api/src/queue/appreciation.consumer.ts` | Pass `customerId` + `orderId` to `sendAppreciation` |
| `apps/api/src/customers/dto/update-customer.dto.ts` | Add `notif_channel` field |
| `apps/api/src/customers/customers.service.ts` | Include `notifChannel` in `updateCustomer` |
| `apps/api/.env` | Add Twilio credentials (local, not committed) |
| `apps/api/.env.example` | Add Twilio placeholder keys |

---

## Worker Verification

After implementation, verify end-to-end:
1. Start worker: `node dist/worker.main.js`
2. Create a CREDIT order → 3 jobs enqueue in Redis
3. Manually trigger one via `POST /api/scheduled-jobs/:id/send-now`
4. Confirm `NotificationLog` row written with `status: SENT` and a real Twilio `messageSid`
5. Check Twilio console for message delivery confirmation
