# Development guide

## Working agreement (humans and coding agents)

1. **Explain as you go.** When making changes, briefly state intent, what files you touch, and why—so the session transcript and git history stay intelligible.
2. **Update docs when behavior or layout changes.** At minimum:
   - Append a dated block to [**SESSION_LOG.md**](./SESSION_LOG.md) (top of file after **Current state** / **Next steps** edits).
   - Adjust **Current state** and **Next steps** in `SESSION_LOG.md` if the repo’s reality changed.
   - Update [**architecture.md**](./architecture.md) if components, flows, modules, or data rules change.
3. **Keep docs truthful.** If something is planned but not built, say so under **Next steps** in `SESSION_LOG.md`, not in **Current state**.

## Prerequisites

- Node.js 20+ (recommended) and npm.
- PostgreSQL when you run migrations or the API against a real DB.

## Repository layout

```
Delicious24/
├── docs/                    # All project markdown (start at docs/README.md)
├── packages/
│   └── db/                  # @delicious24/db — Prisma schema + client
│       ├── prisma/
│       │   └── schema.prisma
│       └── .env.example     # copy to .env; set DATABASE_URL
├── apps/                    # (future) console, api
├── package.json             # workspaces + db:* scripts
└── turbo.json
```

## Setup

```bash
cd /path/to/Delicious24
npm install
cp packages/db/.env.example packages/db/.env
# Edit packages/db/.env — set DATABASE_URL
```

## npm scripts (run from repo root)

| Script | What it does |
|--------|----------------|
| `npm run db:generate` | `prisma generate` in `@delicious24/db` |
| `npm run db:migrate` | `prisma migrate dev` (interactive; needs DB) |
| `npm run db:push` | `prisma db push` (prototyping; needs DB) |
| `npm run db:studio` | Prisma Studio |

Prisma loads `schema.prisma` from `packages/db/prisma/` and reads `DATABASE_URL` from the environment (use `packages/db/.env` when running from that directory, or export `DATABASE_URL` in the shell).

## Turbo

`turbo.json` defines `db:*` tasks so you can later add `turbo run db:generate` from CI. Not required for day-to-day until more packages exist.

## Schema changes

1. Edit `packages/db/prisma/schema.prisma`.
2. Run `npm run db:migrate` (or `db:push` for throwaway DBs).
3. Update `docs/architecture.md` only if the **documented** model or rules changed (the schema file is canonical for column lists).
4. Log the change in `docs/SESSION_LOG.md`.

## Resuming after a lost session

1. Open [**docs/README.md**](./README.md) → follow links.
2. Read **Current state** and **Next steps** in [**SESSION_LOG.md**](./SESSION_LOG.md).
3. Use this file for commands and folder expectations.
