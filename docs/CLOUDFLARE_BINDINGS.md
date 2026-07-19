# Cloudflare Worker bindings — `manut` (production)

Account: `187ab61ed9dbc6e616cb23e6b95aa8f1`  
Worker service: **`manut`**  
Dashboard: Workers & Pages → `manut` → **Settings → Bindings** (Production)

**System of record is PostgreSQL via Prisma + Hyperdrive — never D1.**

Companion: `apps/edge/wrangler.jsonc`, `docs/CICD_CLOUDFLARE.md`,
`docs/PRODUCTION_DEPLOY.md`.

## If you are on the D1 modal right now

1. **Cancel** — do not create a D1 database for Manut business data.
2. D1 is **not** the transactional store. Do not migrate Prisma schema to D1.
3. Continue below with **Hyperdrive** (Postgres), then R2 / DO / Queues.

## Bind checklist (Production) — match wrangler exactly

Use the **Add binding** modal. Names are case-sensitive and must match code.

Queue and R2 **resources** (`manut-intranet-jobs-*`, `manut-intranet-uploads-*`)
are auto-created at deploy by `apps/edge/scripts/ensure-cloudflare-resources.mjs`;
the rows below are for verifying bindings, not creating resources.

| Priority           | Binding type           | Variable / binding name                                                         | Resource / notes                                                                                                                                                                                     |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Required (SoR)** | Hyperdrive             | `HYPERDRIVE_DATABASE`                                                           | Manut-owned Hyperdrive → Postgres. **Status (2026-07-18):** not provisioned — `hyperdrive: []`, `ENABLE_HYPERDRIVE_BOUNDARY=false`. See [Hyperdrive provisioning](#hyperdrive-provisioning-ops) below. Config **id** may be committed (not a password); never commit connection strings. |
| **Required**       | R2 bucket              | `UPLOADS`                                                                       | Bucket contract: `manut-intranet-uploads-production` (private).                                                                                                                                      |
| **Required**       | Durable Object         | `REALTIME_ROOMS`                                                                | Class: `RealtimeRoom` (migrations tag `edge-v1`).                                                                                                                                                    |
| **Required**       | Durable Object         | `QUEUE_LEDGER`                                                                  | Class: `QueueLedger`.                                                                                                                                                                                |
| **Required**       | Queue (producer)       | `JOB_QUEUE`                                                                     | Queue: `manut-intranet-jobs-production`.                                                                                                                                                             |
| **Required**       | Queue (producer)       | `DEAD_LETTER_QUEUE`                                                             | Queue: `manut-intranet-jobs-production-dlq`.                                                                                                                                                         |
| **Required**       | Queue consumer         | (same queue)                                                                    | Consumer on `manut-intranet-jobs-production` → DLQ above; batch/retry per wrangler.                                                                                                                  |
| **Required**       | Workflow               | `BACKGROUND_WORKFLOW`                                                           | Name: `manut-intranet-background-production`, class `BackgroundWorkflow`. Keep `ENABLE_WORKFLOW_BOUNDARY=false` until ready.                                                                         |
| **Required**       | Rate limiting          | `API_RATE_LIMITER`                                                              | Namespace id contract in wrangler (`471501` production).                                                                                                                                             |
| **Required**       | Static Assets          | `ASSETS`                                                                        | From wrangler `assets` → `../app/dist` (SPA). Usually set by deploy, not the Bindings modal.                                                                                                         |
| **Secrets**        | Secret / Secrets Store | **Required:** `EDGE_SIGNING_KEY`. **Optional** S3 pair: `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY` | Uploads use the `UPLOADS` R2 binding when the S3 pair is unset. Set the pair only for direct SigV4 client→R2. Prefer Secrets Store or `wrangler secret put`. Never put in client bundles. |

### Worker vars (Settings → Variables)

| Var                                                                               | Production guidance                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `API_ORIGIN`                                                                      | Distinct Express origin when routes still proxy (empty/self-host fail closed)  |
| `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE`                                 | Application-session issuer (ADR-003); fail closed if empty — not Access JWKS   |
| `ENABLE_HYPERDRIVE_BOUNDARY`                                                      | `true` only after `HYPERDRIVE_DATABASE` exists                                 |
| `ENABLE_WORKFLOW_BOUNDARY` / `ENABLE_CONTAINER_BOUNDARY` / `ENABLE_CRON_BOUNDARY` | Stay `false` until capability provisioned                                      |
| `TRUSTED_STORAGE_ORIGINS`                                                         | Comma-separated HTTPS origins for receipt URLs; empty = proxy managed receipts |
| `R2_BUCKET_NAME`                                                                  | `manut-intranet-uploads-production`                                            |
| `ENABLE_LOCAL_R2_STREAMING`                                                       | `false` on remote envs (loopback-only force). Without S3 keys, remote uploads still use Worker + `UPLOADS`. |

## Optional later (do not add empty)

| Binding          | When                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| KV               | Non-authoritative cache / feature flags only — never SoR                                         |
| Workers AI       | Only for a real product feature                                                                  |
| Secrets Store    | Preferred home for `EDGE_SIGNING_KEY` / R2 keys                                                  |
| Analytics Engine | Metrics later                                                                                    |
| D1               | **Only** trivial edge metadata with an explicit use-case — **never** business/transactional data |

## Do not bind / do not invent

| Item                                 | Why                                                  |
| ------------------------------------ | ---------------------------------------------------- |
| **D1 as business DB**                | Violates repo boundary; Postgres + Hyperdrive is SoR |
| Client `DATABASE_URL`                | Never in Expo / browser                              |
| Invented / placeholder Hyperdrive ids | Keep `hyperdrive: []` until a real Cloudflare config id exists; then commit that id |
| Inherited / shared account resources | Fresh Manut-owned names only                         |
| Cloudflare Pages as SPA host         | Workers + Assets only                                |

## Click path (Bindings UI)

1. Open [Worker `manut` Production](https://dash.cloudflare.com/187ab61ed9dbc6e616cb23e6b95aa8f1/workers/services/view/manut/production) → **Settings → Bindings**.
2. If **D1** create modal is open → **Cancel**.
3. **Add** → **Hyperdrive** → variable name `HYPERDRIVE_DATABASE` → select (or create) Manut Postgres Hyperdrive config.
4. **Add** → **R2 bucket** → variable name `UPLOADS` → `manut-intranet-uploads-production`.
5. Confirm **Durable Objects** `REALTIME_ROOMS` / `QUEUE_LEDGER` (deploy via wrangler applies migrations).
6. **Add** → **Queue** producers `JOB_QUEUE` + `DEAD_LETTER_QUEUE` (and consumer) matching wrangler queue names.
7. **Add** → **Workflow** `BACKGROUND_WORKFLOW` (flag off until used).
8. Confirm **Rate limit** `API_RATE_LIMITER`.
9. Confirm **Assets** come from `wrangler deploy` (`ASSETS` → Expo `dist`).
10. Set secrets / vars as above. Do **not** enable Hyperdrive boundary until step 3 is real.

## Hyperdrive provisioning (ops)

**Blocked until a Manut-owned Postgres `DATABASE_URL` is available.** Local
checkout and process env had no `DATABASE_URL` / `DIRECT_URL` / `.env` on
2026-07-18. Cloudflare account `187ab61ed9dbc6e616cb23e6b95aa8f1` had **zero**
Hyperdrive configs. Wrangler OAuth works; create was not run without a URL.

Edge Prisma already uses Hyperdrive only (`hyperdriveConnectionString` →
`createPrismaClient` + `@prisma/adapter-pg`). Do not put `DATABASE_URL` on the
Worker.

### Prerequisites

1. Authoritative Postgres URL for production (direct / non-pooler preferred for
   Hyperdrive origin; use the admin `DIRECT_URL` shape if the pooler URL is
   pgbouncer-only).
2. Optional second URL for preview/staging → **prefer a separate Hyperdrive
   config** (`manut-intranet-postgres-preview`). If only production URL exists,
   leave preview `hyperdrive: []` and `ENABLE_HYPERDRIVE_BOUNDARY=false` (do
   not share production origin casually).
3. `CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1` (or
   `account_id` in wrangler) so non-interactive CLI selects GoGoCash.

### Exact commands (production)

```bash
source ~/.nvm/nvm.sh && nvm use
cd apps/edge
export CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1
# Load DATABASE_URL from your secret store — never echo it.
# Prefer DIRECT_URL if DATABASE_URL is a transaction-pooler-only URL.

npx wrangler hyperdrive create manut-intranet-postgres-production \
  --connection-string="$DATABASE_URL"

# Capture only the printed config id (UUID). Then edit wrangler.jsonc:
# env.production.hyperdrive = [
#   { "binding": "HYPERDRIVE_DATABASE", "id": "<config-id>" }
# ]
# Set env.production.vars.ENABLE_HYPERDRIVE_BOUNDARY = "true"
# Keep top-level / other envs at hyperdrive: [] and flag false until ready.

npx wrangler deploy --env production --dry-run
# After dry-run looks good, deploy via Workers Builds / approved path.
```

### Exact commands (preview — only if a separate Postgres URL exists)

```bash
npx wrangler hyperdrive create manut-intranet-postgres-preview \
  --connection-string="$PREVIEW_DATABASE_URL"
# Bind id under env.preview.hyperdrive; set ENABLE_HYPERDRIVE_BOUNDARY=true
# for preview only after dry-run.
```

### After bind

| Surface                         | Expected                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `apps/edge/wrangler.jsonc`      | Production `hyperdrive` array with real id; flag `true` for production |
| Other envs                      | Stay empty / `false` until their own configs exist                       |
| Worker secret `DATABASE_URL`    | **Must not** be set — binding supplies `connectionString`                |
| Tests                           | Update `cloudflare-builds.test.ts` empty-hyperdrive assertion when id lands |

## Preview vs staging naming

| Env        | Worker / service                                  | Notes                                                                                                                  |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Production | `manut` (`--env production`)                      | `app.manut.xyz`, `manut.bettergogocash.workers.dev`                                                                    |
| Preview    | separate Worker `manut-preview` (`--env preview`) | Durable Object migrations require full deploy isolation; workers.dev first, custom domain only after separate approval |
| Staging    | separate Worker `manut-staging`                   | Does not overwrite live `manut`                                                                                        |
