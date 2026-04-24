# Delicious24 — V1 Launch Checklist

Edit this file to track progress. Check off items as they are completed.

---

## Immediate (local — do these now)

- [x] **Restart the API** after the CORS fix (`apps/api/src/main.ts` was updated)
- [x] **Commit all changes**
- [x] **Run migration on DB** — applied `remove_cash_withdrawal_order_type`
- [x] **Copy and fill `.env` files**
  - `apps/api/.env` — `DATABASE_URL`, `REDIS_HOST/PORT`, `TWILIO_*`, `CORS_ORIGIN`
  - `apps/console/.env.local` — `NEXT_PUBLIC_API_URL`

---

## Testing (smoke-test all flows before shipping)

- [x] Create a customer
- [x] Create a PAID order with items → transaction + trust score event created
- [x] Create a CREDIT order with due date → credit row + 3 scheduled jobs created
- [x] Record a cash withdrawal (as menu item + charges)
- [x] Add/edit/toggle a menu item
- [ ] Receive an inbound webhook → verify pending payment candidate appears
- [ ] Confirm a pending payment → verify credit balance decremented
- [ ] Manual reminder dispatched and appears in scheduled jobs
- [x] SMS/WhatsApp notification fires (worker running, E.164 normalization fixed)
  - ⚠️ **WhatsApp sandbox**: recipients must join sandbox first (`join <keyword>` → `+14155238886`)
  - For production: apply for WhatsApp Business API number via Twilio

---

## API completeness gaps

- [x] **PATCH `/api/reconciliation-tasks/:id`** — Resolve/Dismiss buttons now in UI
- [x] **Customer ledger: expose `notifChannel`** — shown on ledger page
- [x] **`GET /api/customers/:id`** — direct single-customer fetch added

---

## Security / auth

- [x] **CORS_ORIGIN** — reads from env var, defaults to `http://localhost:3000`; set to real domain before deploying
- [x] **Single-admin auth** — global `ApiKeyGuard`; set `API_KEY` in `.env` to enable
- [x] **Rate limiting** — `ThrottlerGuard` applied to webhook inbound only (10 req/min)

---

## Deployment

- [x] **Docker Compose** — `docker-compose.yml` wires API, worker, Postgres, Redis
- [x] **Dockerfile** — `apps/api/Dockerfile` (multi-stage, non-root user)
- [x] **Health check endpoint** — `GET /api/health` returns `{ status: 'ok' }`
- [ ] **Environment variables** — set all required vars in hosting environment
- [ ] **Run migrations** on production database before first boot
- [ ] **Choose and provision a server** — VPS (DigitalOcean/Hetzner) for API+worker+DB+Redis; Vercel for console

---

## Nice-to-have before V1 (non-blocking)

- [ ] Customer ledger — inline `notifChannel` editor (WhatsApp / SMS / Both)
- [x] Scheduled jobs — "Cancel" and "Send Now" action buttons added
- [ ] Pending payments — link "matched credit" to the customer ledger
- [ ] Menu page — delete / archive items
- [ ] Error boundary in the console (global 500/network error UI)

---

## Post-V1 (backlog)

- [ ] Facade refactor: Credits/Orders orchestration cleanup (Approach C)
- [ ] Offline sync / `POST /api/sync` end-to-end testing
- [ ] Trust score display graph on customer ledger
- [ ] CSV bulk import of customers and menu items
- [ ] Mobile-responsive console layout
