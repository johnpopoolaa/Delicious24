FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=@delicious24/db --workspace=@delicious24/api --include-workspace-root

COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN npm run db:generate && npm run build:api

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=@delicious24/db --workspace=@delicious24/api --include-workspace-root --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
