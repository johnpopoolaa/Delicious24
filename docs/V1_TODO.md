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
- [x] **Prisma CLI available in production image** — moved `prisma` to `dependencies` in `packages/db/package.json`
- [ ] **Create DigitalOcean Droplet** — Ubuntu 24.04, $18/mo (2 GB RAM / 2 CPU)
- [ ] **Install Docker on droplet** — `curl -fsSL https://get.docker.com | sh`
- [ ] **Clone repo + create root `.env`** — fill `POSTGRES_PASSWORD`, `API_KEY`, `CORS_ORIGIN`, Twilio vars
- [ ] **Run migrations on production DB** — `docker compose run --rm -e DATABASE_URL=... api npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`
  - ⚠️ Pending migration not yet applied to production: `20260503000000_add_archived_at_to_menu_items`
- [ ] **Start all services** — `docker compose up -d --build`; verify `GET /api/health` responds
- [ ] **Open firewall** — `ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`
- [ ] **Point domain DNS** — add A record pointing your domain to the droplet IP (do this before SSL)
- [ ] **Set up HTTPS / reverse proxy** — install nginx + certbot for Let's Encrypt SSL; proxy `yourdomain.com` → `localhost:3001`
  ```bash
  apt install -y nginx certbot python3-certbot-nginx
  # configure /etc/nginx/sites-available/delicious24 to proxy_pass http://localhost:3001
  certbot --nginx -d yourdomain.com
  ```
  ⚠️ Without HTTPS, your `API_KEY` and all customer data travels over plain HTTP
- [ ] **Deploy console to Vercel** — set `NEXT_PUBLIC_API_URL` to `https://yourdomain.com`
- [ ] **Update `CORS_ORIGIN`** on droplet to the Vercel console URL, then restart API: `docker compose up -d api`
- [ ] **Verify API key auth** — confirm unauthenticated requests to protected endpoints return 401
- [ ] **Production smoke test** — repeat the testing checklist above against the live URL

---

## Nice-to-have before V1 (non-blocking)

- [x] Customer ledger — inline `notifChannel` editor (WhatsApp / SMS / Both) — 3-button toggle, saves on click via `PATCH /api/customers/:id`
- [x] Scheduled jobs — "Cancel" and "Send Now" action buttons added (was incorrectly marked; actually implemented 2026-05-03)
- [ ] Pending payments — link "matched credit" to the customer ledger
- [x] Menu page — delete / archive items (soft-archive via `archived_at` column; migration `20260503000000_add_archived_at_to_menu_items`)
- [x] Error boundary in the console — `app/error.tsx` (page-level, 15s auto-retry countdown, human-readable messages by error type) + `app/global-error.tsx` (layout-level crashes)

---

## Post-V1 (backlog)

- [ ] Facade refactor: Credits/Orders orchestration cleanup (Approach C)
- [ ] Offline sync / `POST /api/sync` end-to-end testing
- [ ] Trust score display graph on customer ledger
- [ ] CSV bulk import of customers and menu items
- [ ] Mobile-responsive console layout
