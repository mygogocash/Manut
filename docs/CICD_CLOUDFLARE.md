# CI/CD — Cloudflare Workers + Assets

Manut web delivery is **Workers + Assets** from `apps/edge` (`wrangler deploy`),
not Cloudflare Pages. GitHub Actions and/or Workers Builds own deploy after
Expo web export.

**Bindings (Hyperdrive, R2, DO, Queues — never D1 as SoR):**
[`docs/CLOUDFLARE_BINDINGS.md`](./CLOUDFLARE_BINDINGS.md).

Companion: `docs/PRODUCTION_DEPLOY.md` (cutover order, ops blockers).

## Live Cloudflare account / service

| Field | Value |
| --- | --- |
| Account id | `187ab61ed9dbc6e616cb23e6b95aa8f1` |
| Worker service | **`manut`** |
| Production dashboard | [workers/services/view/manut/production](https://dash.cloudflare.com/187ab61ed9dbc6e616cb23e6b95aa8f1/workers/services/view/manut/production) |
| Production hosts | `https://manu.xyz`, `https://manut.bettergogocash.workers.dev` |
| Preview host | `https://preview.manu.xyz` (attach to **Preview** env, not Production) |

Wrangler: `env.production.name` / `env.preview.name` = `manut`; staging is a
separate Worker `manut-staging`.

## Why `pnpm run build` fails on Workers Builds

Root `pnpm run build` runs **turbo build** (API, packages, full monorepo). That
path expects a generated Prisma client and more than the SPA+Worker need.

**Use instead:**

```bash
pnpm run build:cloudflare
```

which is `pnpm db:generate && pnpm --filter @manut/app export:web` (no turbo).

## Cloudflare Workers Builds (dashboard paste values)

Path: Worker `manut` → **Settings → Builds** (or Connect to Git → Builds).

### Production

| Setting | Paste value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `cd apps/edge && npx wrangler deploy --env production` |
| Branch | `main` |
| Node version | `24.18.0` (or `.nvmrc`) |
| Package manager | pnpm `11.13.1` |

**Variables (Production Builds / Worker vars for Expo export):**

| Variable | Required | Example / note |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | `https://manu.xyz` |
| `EXPO_PUBLIC_SOCKET_URL` | no | Usually same origin or API host |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no | Edge DO WebSocket origin when not same-origin |
| Auth JWKS / issuer | later | Worker vars `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` — **not** Supabase CI vars |

Do **not** require `EXPO_PUBLIC_SUPABASE_*` for Builds or GitHub deploy workflows.

### Preview

| Setting | Paste value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `cd apps/edge && npx wrangler deploy --env preview` |
| Branch | `preview` (or non-`main` PR previews per dashboard) |
| `EXPO_PUBLIC_API_URL` | `https://preview.manu.xyz` |

`--env preview` targets the Preview environment of service `manut` (same
Worker name as production). Attach custom domain `preview.manu.xyz` to the
**Preview** environment, not Production.

GitHub Actions `deploy-preview.yml` still uses `wrangler versions upload
--env preview` so automated pushes create preview versions without promoting
Production.

### After you change Builds settings — View build checklist

1. Open Worker **`manut`** → **Builds** → latest run → **View build**.
2. Confirm install used **pnpm** (not npm) and Node **24.18.0**.
3. Confirm build step is `pnpm run build:cloudflare` — **not** `pnpm run build` / turbo.
4. Confirm log shows `prisma generate` / `@manut/database` generate before Expo export.
5. Confirm deploy runs from `apps/edge` with `--env production` (or `--env preview`).
6. If still red: paste the first `error TS` / `Failed:` line (not the whole log).

Common failure if settings are stale: `Cannot find module './generated/prisma/client'`
from `@manut/database#build` — that means turbo `build` ran without `db:generate`.

## Disable Cloudflare Pages auto-deploy

If a Pages project named `manut` (or any Pages project) is connected to this
repo:

1. Open Cloudflare Dashboard → Workers & Pages → that Pages project.
2. **Turn off automatic deployments** (disconnect Git if needed).
3. Deploy only via Workers Builds / GitHub Actions → wrangler against service
   **`manut`** (production/preview) or Worker **`manut-staging`**.

## GitHub Actions workflows

| Git branch | Workflow | File | Trigger | GitHub Environment | Wrangler |
| --- | --- | --- | --- | --- | --- |
| `preview` | Deploy Preview | `.github/workflows/deploy-preview.yml` | Push `preview`; dispatch | `preview` | `wrangler versions upload --env preview` → service `manut` |
| `staging` | Deploy Staging | `.github/workflows/deploy-staging.yml` | Push `staging`; dispatch | `staging` | `wrangler deploy --env staging` → `manut-staging` |
| `main` | Deploy Production | `.github/workflows/deploy.yml` | Push `main`; dispatch | `production` (require reviewers) | `wrangler deploy --env production` → service `manut` |

Neither workflow mutates DNS. Neither invents Hyperdrive ids or `DATABASE_URL`.

### Pipeline (all three)

1. Fail closed if required Environment secrets/vars are missing.
2. Node `24.18.0`, pnpm `11.13.1`, `pnpm install --frozen-lockfile`.
3. `pnpm db:generate`
4. `pnpm --filter @manut/app export:web` (Expo public vars from Environment)
5. Worker `type-check` + `test`
6. `pnpm security:credentials` on `apps/app/dist`
7. wrangler deploy / versions upload from `apps/edge`

Actions are commit-SHA pinned to match `.github/workflows/pr-checks.yml`.

## GitHub Environment configuration (names only)

Create Environments **`preview`**, **`staging`**, and **`production`**. For
`production`, enable **required reviewers** before the deploy job can run.

### Secrets (per Environment)

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Manut-owned token with Workers deploy permission |
| `CLOUDFLARE_ACCOUNT_ID` | `187ab61ed9dbc6e616cb23e6b95aa8f1` |

### Variables (per Environment)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | HTTP API / app origin baked into Expo web export (`https://manu.xyz` production) |
| `EXPO_PUBLIC_SOCKET_URL` | no | Socket.IO fallback origin |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no | Edge DO WebSocket origin when not same-origin |

Supabase public vars are **not** required for deploy CI.

### Not set by CI (configure in Cloudflare / wrangler)

Worker **secrets** (`EDGE_SIGNING_KEY`, R2 credentials) and **vars**
(`API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `TRUSTED_STORAGE_ORIGINS`, …)
are set with `wrangler secret put` / dashboard / `wrangler.jsonc` — not invented
in the workflow. See `docs/CLOUDFLARE_BINDINGS.md`.

**Hyperdrive:** keep `"hyperdrive": []` in committed `wrangler.jsonc` until ops
provisions a real config id and binds `HYPERDRIVE_DATABASE`. CI must never
fabricate a Hyperdrive id.

R2 buckets, Queues, and Durable Object migrations must exist (or be creatable
by the deploy token) for the named contracts in `apps/edge/wrangler.jsonc`.

## First green preview / staging run — ops checklist

- [ ] Pages auto-deploy disabled (see above)
- [ ] Workers Builds: `build:cloudflare` + deploy commands above
- [ ] GitHub Environments secrets + `EXPO_PUBLIC_API_URL`
- [ ] Bindings per `docs/CLOUDFLARE_BINDINGS.md` (cancel D1; add Hyperdrive/R2/…)
- [ ] `preview.manu.xyz` on Preview env
- [ ] Push / dispatch preview + staging; confirm service `manut` / Worker `manut-staging`

## Production enablement

1. Preview/staging deploys green and smoke-tested.
2. GitHub Environment `production` with **required reviewers** + secrets/vars.
3. Production bindings provisioned (Hyperdrive id real; R2/Queues/DO per wrangler).
4. Merge/push to `main` (or **Actions → Deploy Production → Run workflow**).
5. DNS / custom domain only after separate approval (`PRODUCTION_DEPLOY.md`).
