# syntax=docker/dockerfile:1
# Build API:  docker build --target api -t split-api .
# Build worker: docker build --target worker -t split-worker .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile

COPY server ./server
RUN pnpm --filter @split/server run build
RUN pnpm --filter @split/server deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runner-base
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/ ./
# migrate.ts resolves SQL paths from dist/db/migrations (tsc does not copy .sql files).
COPY --from=build /repo/server/src/db/migrations ./dist/db/migrations
EXPOSE 4000
USER node

FROM runner-base AS api
CMD ["node", "dist/index.js"]

FROM runner-base AS worker
CMD ["node", "dist/notification-worker.js"]
