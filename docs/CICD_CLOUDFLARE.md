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
| Production hosts | `https://app.manut.xyz`, `https://manut.bettergogocash.workers.dev` |
| Preview host | `https://preview.manut.xyz` (attach to **Preview** env, not Production) |
| Landing page | `https://manut.xyz` — marketing site, separate surface, **not** this Worker |

| Git branch | CF env | URL |
| --- | --- | --- |
| `main` | production | https://app.manut.xyz (+ https://manut.bettergogocash.workers.dev) |
| `preview` | preview | https://preview.manut.xyz (+ `*.manut.bettergogocash.workers.dev`) |

Wrangler: `env.production.name` / `env.preview.name` = `manut`; staging is a
separate Worker `manut-staging`. If `preview.manut.xyz` is listed under
**Production** in Cloudflare Domains, move it to the **Preview** environment.

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
| Deploy command | `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env production && npx wrangler deploy --env production` |
| Branch | `main` |
| Node version | `24.18.0` (or `.nvmrc`) |
| Package manager | pnpm `11.13.1` |

### One-time: add Queues Edit to the Workers Builds API token

The auto-generated Workers Builds token has Workers Scripts / KV / R2 /
Routes edit but **no Queues permission**, so the ensure script (and
`wrangler deploy` queue validation) fails closed until ops adds it:
Dashboard → **My Profile → API Tokens** → the auto-generated "Workers
Builds" token → **Edit** → add **Account → Queues → Edit** → Save. Editing
scopes keeps the same token value. R2 needs no change (Workers R2 Storage
Edit is already granted).

**Variables (Production Builds / Worker vars for Expo export):**

| Variable | Required | Example / note |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | `https://app.manut.xyz` |
| `EXPO_PUBLIC_SOCKET_URL` | no | Usually same origin or API host |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no | Edge DO WebSocket origin when not same-origin |
| Auth JWKS / issuer | later | Worker vars `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` — **not** Supabase CI vars |

Do **not** require Supabase Expo public vars for Builds or GitHub deploy workflows.

### Preview

| Setting | Paste value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env preview && npx wrangler deploy --env preview` |
| Branch | `preview` (or non-`main` PR previews per dashboard) |
| `EXPO_PUBLIC_API_URL` | `https://preview.manut.xyz` |

`--env preview` targets the Preview environment of service `manut` (same
Worker name as production). Attach custom domain `preview.manut.xyz` to the
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
7. `node scripts/ensure-cloudflare-resources.mjs --env <env>` (idempotent
   queue + R2 provisioning from `wrangler.jsonc` contracts; create-only)
8. wrangler deploy / versions upload from `apps/edge`

Actions are commit-SHA pinned to match `.github/workflows/pr-checks.yml`.

## GitHub Environment configuration (names only)

Create Environments **`preview`**, **`staging`**, and **`production`**. For
`production`, enable **required reviewers** before the deploy job can run.

### Secrets (per Environment)

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Manut-owned token: Workers Scripts Edit + Queues Edit + Workers R2 Storage Edit + Account Settings Read |
| `CLOUDFLARE_ACCOUNT_ID` | `187ab61ed9dbc6e616cb23e6b95aa8f1` |

### Variables (per Environment)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | HTTP API / app origin baked into Expo web export (`https://app.manut.xyz` production) |
| `EXPO_PUBLIC_SOCKET_URL` | no | Socket.IO fallback origin |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no | Edge DO WebSocket origin when not same-origin |

Supabase public vars are **not** required for deploy CI.

### Not set by CI (configure in Cloudflare / wrangler)

Worker **secrets** (`EDGE_SIGNING_KEY`, R2 credentials) and **vars**
(`API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`,
`TRUSTED_STORAGE_ORIGINS`, …) are set with `wrangler secret put` / dashboard /
`wrangler.jsonc` — not invented in the workflow. See `docs/CLOUDFLARE_BINDINGS.md`.

#### Cloudflare Access → Worker JWT verification

Create a Cloudflare Access application (do not invent team/app ids in git).
Point Worker vars at Access:

| Worker var | Example shape |
| --- | --- |
| `AUTH_JWKS_URL` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` |
| `AUTH_ISSUER` | `https://<team>.cloudflareaccess.com` |
| `AUTH_AUDIENCE` | Access application AUD tag |

Empty JWKS / issuer / audience fails closed (`503 AUTH_*_NOT_CONFIGURED`).
Storage is **R2** (`UPLOADS`); receipt provenance uses `TRUSTED_STORAGE_ORIGINS`.

**Hyperdrive:** keep `"hyperdrive": []` in committed `wrangler.jsonc` until ops
provisions a real config id and binds `HYPERDRIVE_DATABASE`. CI must never
fabricate a Hyperdrive id.

**Queues + R2:** the queues and R2 buckets named in `apps/edge/wrangler.jsonc`
are created automatically at deploy time by
`apps/edge/scripts/ensure-cloudflare-resources.mjs` (create-only, idempotent;
requires the Queues Edit + Workers R2 Storage Edit token permissions above).
Durable Object migrations, queue consumers, and Workflows are applied by
`wrangler deploy` itself.

## Bootstrap remaining secrets (local)

OAuth (`wrangler login`) can set Worker secrets and create R2 buckets, but
**cannot** mint a long-lived `CLOUDFLARE_API_TOKEN` for GitHub Actions. After
creating a Manut-owned API token (and optional R2 S3 token) in the dashboard:

```bash
source ~/.nvm/nvm.sh && nvm use
export CLOUDFLARE_API_TOKEN=…          # Workers Scripts Edit + Queues Edit + Workers R2 Storage Edit + Account read
export CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1
# optional R2 S3 pair for Worker secrets.required:
export R2_ACCESS_KEY_ID=…
export R2_SECRET_ACCESS_KEY=…
./scripts/setup-cloudflare-deploy-secrets.sh
```

The script never prints secret values. Committed `wrangler.jsonc` already sets
non-secret production/preview vars (`API_ORIGIN`, boundary flags,
`TRUSTED_STORAGE_ORIGINS`, `R2_BUCKET_NAME`). Auth JWKS vars stay empty until
Access is configured (runtime fail-closed).

## First green preview / staging run — ops checklist

- [ ] Pages auto-deploy disabled (see above)
- [ ] Workers Builds: `build:cloudflare` + deploy commands above
- [ ] Deploy tokens have Queues Edit + Workers R2 Storage Edit (Workers Builds auto token: add Queues Edit manually; GH Actions token: verify scopes)
- [ ] GitHub Environments: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` + `EXPO_PUBLIC_API_URL`
- [ ] Worker secrets: `EDGE_SIGNING_KEY`, `R2_*` (see bootstrap script)
- [ ] Cloudflare Access JWKS → Worker `AUTH_*` vars
- [ ] Bindings per `docs/CLOUDFLARE_BINDINGS.md` (cancel D1; add Hyperdrive/R2/…)
- [ ] `preview.manut.xyz` on Preview env
- [ ] Push / dispatch preview + staging; confirm service `manut` / Worker `manut-staging`

## Production enablement

1. Preview/staging deploys green and smoke-tested.
2. GitHub Environment `production` with **required reviewers** + secrets/vars.
3. Production bindings provisioned (Hyperdrive id real; R2/Queues/DO per wrangler).
4. Merge/push to `main` (or **Actions → Deploy Production → Run workflow**).
5. DNS / custom domain only after separate approval (`PRODUCTION_DEPLOY.md`).
