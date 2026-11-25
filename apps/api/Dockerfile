# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Only the files the api and its workspace packages need.
FROM base AS pruned
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.11.11 prune api --docker

FROM base AS build
WORKDIR /repo
COPY --from=pruned /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
RUN pnpm turbo run build --filter=api
# A standalone folder: the built api plus production dependencies only.
RUN pnpm --filter=api deploy --prod --legacy /out

FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
