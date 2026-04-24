# Delicious24

Restaurant credit and sales management system — admin console + NestJS backend.

**Status:** V1-ready locally. Deployment pending (see TODO below).

- Full docs and session history: **[docs/README.md](docs/README.md)**
- Resume a session: **[docs/SESSION_LOG.md](docs/SESSION_LOG.md)** → read *Current state* + *Next steps*
- What's left: **[docs/V1_TODO.md](docs/V1_TODO.md)**
- Dev setup: **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**

## Quick start (local)

```bash
npm install
# fill apps/api/.env and apps/console/.env.local (copy from .env.example)
npm run db:migrate           # apply migrations
npm run dev:api &            # API on :3001
npm run dev:worker &         # BullMQ worker (notifications)
npm run dev:console          # console on :3000
```
