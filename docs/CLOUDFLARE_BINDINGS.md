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

| Priority | Binding type | Variable / binding name | Resource / notes |
| --- | --- | --- | --- |
| **Required (SoR)** | Hyperdrive | `HYPERDRIVE_DATABASE` | Manut-owned Hyperdrive → Postgres. Keep `ENABLE_HYPERDRIVE_BOUNDARY=false` until bound; then set `true`. Commit id into `wrangler.jsonc` only after ops provisions it (`hyperdrive: []` until then). |
| **Required** | R2 bucket | `UPLOADS` | Bucket contract: `manut-intranet-uploads-production` (private). |
| **Required** | Durable Object | `REALTIME_ROOMS` | Class: `RealtimeRoom` (migrations tag `edge-v1`). |
| **Required** | Durable Object | `QUEUE_LEDGER` | Class: `QueueLedger`. |
| **Required** | Queue (producer) | `JOB_QUEUE` | Queue: `manut-intranet-jobs-production`. |
| **Required** | Queue (producer) | `DEAD_LETTER_QUEUE` | Queue: `manut-intranet-jobs-production-dlq`. |
| **Required** | Queue consumer | (same queue) | Consumer on `manut-intranet-jobs-production` → DLQ above; batch/retry per wrangler. |
| **Required** | Workflow | `BACKGROUND_WORKFLOW` | Name: `manut-intranet-background-production`, class `BackgroundWorkflow`. Keep `ENABLE_WORKFLOW_BOUNDARY=false` until ready. |
| **Required** | Rate limiting | `API_RATE_LIMITER` | Namespace id contract in wrangler (`471501` production). |
| **Required** | Static Assets | `ASSETS` | From wrangler `assets` → `../app/dist` (SPA). Usually set by deploy, not the Bindings modal. |
| **Secrets** | Secret / Secrets Store | `EDGE_SIGNING_KEY`, `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY` | Prefer Secrets Store or `wrangler secret put`. Never put in client bundles. |

### Worker vars (Settings → Variables)

| Var | Production guidance |
| --- | --- |
| `API_ORIGIN` | Express parity origin when routes still proxy |
| `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` | Fail closed if JWKS empty at runtime |
| `ENABLE_HYPERDRIVE_BOUNDARY` | `true` only after `HYPERDRIVE_DATABASE` exists |
| `ENABLE_WORKFLOW_BOUNDARY` / `ENABLE_CONTAINER_BOUNDARY` / `ENABLE_CRON_BOUNDARY` | Stay `false` until capability provisioned |
| `TRUSTED_STORAGE_ORIGINS` | Comma-separated HTTPS origins for receipt URLs; empty = proxy managed receipts |
| `R2_BUCKET_NAME` | `manut-intranet-uploads-production` |
| `ENABLE_LOCAL_R2_STREAMING` | `false` on remote envs |

## Optional later (do not add empty)

| Binding | When |
| --- | --- |
| KV | Non-authoritative cache / feature flags only — never SoR |
| Workers AI | Only for a real product feature |
| Secrets Store | Preferred home for `EDGE_SIGNING_KEY` / R2 keys |
| Analytics Engine | Metrics later |
| D1 | **Only** trivial edge metadata with an explicit use-case — **never** business/transactional data |

## Do not bind / do not invent

| Item | Why |
| --- | --- |
| **D1 as business DB** | Violates repo boundary; Postgres + Hyperdrive is SoR |
| Client `DATABASE_URL` | Never in Expo / browser |
| Invented Hyperdrive ids in git | Keep `hyperdrive: []` until a real id exists |
| Inherited / shared account resources | Fresh Manut-owned names only |
| Cloudflare Pages as SPA host | Workers + Assets only |

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

## Preview vs staging naming

| Env | Worker / service | Notes |
| --- | --- | --- |
| Production | `manut` (`--env production`) | `manu.xyz`, `manut.bettergogocash.workers.dev` |
| Preview | same service `manut` (`--env preview` / versions upload) | Prefer `preview.manu.xyz` on Preview env — move off Production if still attached |
| Staging | separate Worker `manut-staging` | Does not overwrite live `manut` |
