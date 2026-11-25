# Spaced Rep

Spaced repetition with multi-step cards. A pnpm + Turborepo monorepo.

| Path | What it is |
|---|---|
| `apps/api` | NestJS API (port 4000) |
| `apps/web` | Next.js web app (port 3000). A placeholder page for now |
| `packages/db` | Database schema, migrations and the `migrate` script (`@repo/db`) |
| `packages/typescript-config`, `packages/eslint-config` | Shared tool config |

## Setup

Needs Node 22 (`.nvmrc`), pnpm and Docker (the api tests start a Postgres container).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill it in
```

## Everyday commands

```bash
pnpm dev                                  # run every app in watch mode
pnpm turbo run lint check-types test build
pnpm --filter api test:e2e                # api end-to-end tests
pnpm --filter @repo/db generate           # write a migration after changing packages/db/src/schema.ts
DATABASE_URL=... pnpm --filter @repo/db migrate
```

The api imports `@repo/db` from its built output, so run tests through `turbo` (which builds it first) or run `pnpm --filter @repo/db build` once.

## Deployment

Fly.io runs the apps, Neon hosts Postgres and GitHub Actions drives both.

| Event | Result |
|---|---|
| Pull request | CI checks. A preview: Neon branch `pr-N` and Fly apps `spaced-rep-api-pr-N`, `spaced-rep-web-pr-N`, removed when the pull request closes |
| Merge to `main` | CI, then each changed app is built once, the `staging` database is migrated and the app is deployed to `spaced-rep-<app>-staging` |
| Actions → Release → Run workflow | The images staging runs are released to `spaced-rep-api` and `spaced-rep-web`. Nothing is rebuilt |
