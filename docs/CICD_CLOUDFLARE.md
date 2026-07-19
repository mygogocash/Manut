# CI/CD — Cloudflare Workers + Assets

Manut web delivery is **Workers + Assets** from `apps/edge` (`wrangler deploy`),
not Cloudflare Pages. Cloudflare Workers Builds is the sole production deploy
owner for `main`; GitHub Actions owns preview and staging deploys only.

**Bindings (Hyperdrive, R2, DO, Queues — never D1 as SoR):**
[`docs/CLOUDFLARE_BINDINGS.md`](./CLOUDFLARE_BINDINGS.md).

Companion: `docs/PRODUCTION_DEPLOY.md` (cutover order, ops blockers).

## Live Cloudflare account / service

| Field                | Value                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Account id           | `187ab61ed9dbc6e616cb23e6b95aa8f1`                                                                                                            |
| Worker service       | **`manut`**                                                                                                                                   |
| Production dashboard | [workers/services/view/manut/production](https://dash.cloudflare.com/187ab61ed9dbc6e616cb23e6b95aa8f1/workers/services/view/manut/production) |
| Production hosts     | `https://app.manut.xyz`, `https://manut.bettergogocash.workers.dev`                                                                           |
| Preview Worker       | **`manut-preview`**                                                                                                                           |
| Preview host         | `https://manut-preview.bettergogocash.workers.dev` (`preview.manut.xyz` only after separate DNS approval)                                     |
| Landing page         | `https://manut.xyz` — marketing site, separate surface, **not** this Worker                                                                   |

| Git branch | CF env     | URL                                                                |
| ---------- | ---------- | ------------------------------------------------------------------ |
| `main`     | production | https://app.manut.xyz (+ https://manut.bettergogocash.workers.dev) |
| `preview`  | preview    | https://manut-preview.bettergogocash.workers.dev                   |

Wrangler: `env.production.name = "manut"`, `env.preview.name =
"manut-preview"`, and `env.staging.name = "manut-staging"`. Preview must not
use the Worker name `manut`: Durable Object lifecycle migrations require a full
deploy, so sharing the name would let preview overwrite production.

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

| Setting         | Paste value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Root directory  | `/`                                                                                                                     |
| Build command   | `pnpm run build:cloudflare`                                                                                             |
| Deploy command  | `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env production && npx wrangler deploy --env production` |
| Branch          | `main`                                                                                                                  |
| Node version    | `24.18.0` (or `.nvmrc`)                                                                                                 |
| Package manager | pnpm `11.13.1`                                                                                                          |

### Recover a deleted or rolled Workers Builds token

The error `The build token selected for this build has been deleted or rolled`
happens before checkout. Do not change source, the build command, or Worker
runtime secrets to compensate.

1. Review recent Cloudflare token, build, and deployment activity. Treat any
   unexplained use as a credential incident before retrying.
2. In Worker **`manut`** → **Settings → Builds → API token**, choose
   **Create new token**, name it **`Manut Workers Builds - YYYY-MM-DD`**, and
   save. Workers Builds currently lists Builds-managed user tokens in this
   selector; a separately created custom token may not be eligible to select.
3. Open **My Profile → API Tokens** and choose **Edit** (not **Roll**) for that
   same token. The generated token may initially include unrelated Cloudflare
   product permissions. Remove them, restrict the account to **GoGoCash** and
   the zone to **`manut.xyz`**, and keep only this final matrix:

   | Scope                  | Permission              |
   | ---------------------- | ----------------------- |
   | Account                | Account Settings Read   |
   | Account                | Workers Scripts Edit    |
   | Account                | Workers KV Storage Edit |
   | Account                | Workers R2 Storage Edit |
   | Account                | Queues Edit             |
   | Zone (Manut zone only) | Workers Routes Edit     |
   | User                   | User Details Read       |
   | User                   | Memberships Read        |

4. Return to Worker **`manut`** → **Settings → Builds** and confirm the selected
   token name is unchanged. Never copy the value to GitHub, source, logs, or
   this runbook, and never choose **Roll** while the token is selected. If a
   future scope change cannot be made in place, create and select a complete
   replacement before retiring the old token.
5. Retry a non-production build first using the isolated preview contract
   below. The ensure step must successfully inspect the preview Queues and R2
   bucket, and the deploy must target `manut-preview`, before any production
   retry. Cloudflare code `10211` means a version-only upload attempted an
   unapplied Durable Object migration; use the full isolated preview deploy,
   never a version upload against production `manut`.

**Variables (Production Builds / Worker vars for Expo export):**

| Variable                      | Required | Example / note                                                                         |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`         | yes      | `https://app.manut.xyz/api` (must include `/api`; app-core paths are relative)          |
| `EXPO_PUBLIC_SOCKET_URL`      | no       | Usually same origin or API host                                                        |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no       | Edge DO WebSocket origin when not same-origin                                          |
| Auth JWKS / issuer            | later    | Worker vars `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` — **not** Supabase CI vars |

Do **not** require Supabase Expo public vars for Builds or GitHub deploy workflows.

### Preview

| Setting               | Paste value                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Root directory        | `/`                                                                                                               |
| Build command         | `pnpm run build:cloudflare`                                                                                       |
| Deploy command        | `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env preview && npx wrangler deploy --env preview` |
| Branch                | `preview` (or non-`main` PR previews per dashboard)                                                               |
| `EXPO_PUBLIC_API_URL` | `https://manut-preview.bettergogocash.workers.dev/api` until separate custom-domain approval                      |

`--env preview` targets the separate Worker `manut-preview`. Its full deploy is
required for Durable Object migrations and cannot promote or overwrite
production `manut`. Validate the workers.dev host first; attaching
`preview.manut.xyz` remains a separately approved DNS operation.

Use this native non-production build only to validate a replacement build
token. After it succeeds, disable Workers Builds for non-production branches;
GitHub Actions `deploy-preview.yml` remains the sole preview owner and deploys
only `manut-preview`.

### After you change Builds settings — View build checklist

1. Open Worker **`manut`** → **Builds** → latest run → **View build**.
2. Confirm install used **pnpm** (not npm) and Node **24.18.0**.
3. Confirm build step is `pnpm run build:cloudflare` — **not** `pnpm run build` / turbo.
4. Confirm log shows `prisma generate` / `@manut/database` generate before Expo export.
5. Confirm deploy runs from `apps/edge`:
   - production: `wrangler deploy --env production`;
   - preview validation: `wrangler deploy --env preview` → `manut-preview`.
6. If still red: paste the first `error TS` / `Failed:` line (not the whole log).

Common failure if settings are stale: `Cannot find module './generated/prisma/client'`
from `@manut/database#build` — that means turbo `build` ran without `db:generate`.

## Disable Cloudflare Pages auto-deploy

If a Pages project named `manut` (or any Pages project) is connected to this
repo:

1. Open Cloudflare Dashboard → Workers & Pages → that Pages project.
2. **Turn off automatic deployments** (disconnect Git if needed).
3. Deploy production only through Workers Builds; deploy preview/staging only
   through GitHub Actions. Pages remains disconnected.

## GitHub Actions workflows

| Git branch | Workflow       | File                                   | Trigger                  | GitHub Environment | Wrangler                                          |
| ---------- | -------------- | -------------------------------------- | ------------------------ | ------------------ | ------------------------------------------------- |
| `preview`  | Deploy Preview | `.github/workflows/deploy-preview.yml` | Push `preview`; dispatch | `preview`          | `wrangler deploy --env preview` → `manut-preview` |
| `staging`  | Deploy Staging | `.github/workflows/deploy-staging.yml` | Push `staging`; dispatch | `staging`          | `wrangler deploy --env staging` → `manut-staging` |

Neither workflow mutates DNS. Neither invents Hyperdrive ids or `DATABASE_URL`.
There is no GitHub Actions production deploy workflow; a `main` build is owned
only by Workers Builds.

### Pipeline (preview and staging)

1. Fail closed if required Environment secrets/vars are missing.
2. Node `24.18.0`, pnpm `11.13.1`, `pnpm install --frozen-lockfile`.
3. `pnpm db:generate`
4. `pnpm --filter @manut/app export:web` (Expo public vars from Environment)
5. Worker `type-check` + `test`
6. `pnpm security:credentials` on `apps/app/dist`
7. `node scripts/ensure-cloudflare-resources.mjs --env <env>` (idempotent
   queue + R2 provisioning from `wrangler.jsonc` contracts; create-only)
8. `wrangler deploy` from `apps/edge` to the branch-isolated Worker

Actions are commit-SHA pinned to match `.github/workflows/pr-checks.yml`.

## GitHub Environment configuration (names only)

Create GitHub Environments **`preview`** and **`staging`** only for deploy
credentials. Production deploy authentication belongs to the dashboard-selected
Workers Builds token, not a GitHub Environment.

### Secrets (per Environment)

| Secret                  | Environments     | Purpose                                                                                                 |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | preview, staging | Manut-owned token: Workers Scripts Edit + Queues Edit + Workers R2 Storage Edit + Account Settings Read |
| `CLOUDFLARE_ACCOUNT_ID` | preview, staging | `187ab61ed9dbc6e616cb23e6b95aa8f1`                                                                      |
| `EDGE_SIGNING_KEY`      | preview          | Unique preview bridge secret; never reuse production                                                    |
| `R2_ACCESS_KEY_ID`      | preview (optional) | Optional R2 S3 credential for SigV4 client→R2; omit to use Worker + `UPLOADS` binding                |
| `R2_SECRET_ACCESS_KEY`  | preview (optional) | Pair with `R2_ACCESS_KEY_ID` when enabling SigV4; both or neither                                    |

### Variables (per Environment)

| Variable                      | Required | Purpose                                                              |
| ----------------------------- | -------- | -------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`         | yes      | Hosted API base including `/api` (Worker origin + `/api`, or web `/api`) |
| `EXPO_PUBLIC_SOCKET_URL`      | no       | Socket.IO fallback origin                                            |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no       | Edge DO WebSocket origin when not same-origin                        |

Supabase public vars are **not** required for deploy CI.

### Runtime config handling

The preview workflow requires `EDGE_SIGNING_KEY` from the GitHub Environment,
writes it to a mode-0600 file under `RUNNER_TEMP`, uploads it atomically with
the first `wrangler deploy --secrets-file`, and deletes the temporary file on
exit. The R2 S3 pair is optional: when both `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY` are present, they are included and `R2_ACCOUNT_ID` is
derived from `CLOUDFLARE_ACCOUNT_ID` (no value invented). When omitted, uploads
use the `UPLOADS` R2 binding (Worker-mediated). `secrets.required` only lists
`EDGE_SIGNING_KEY`, so SPA deploys are not blocked on unused S3 keys.

Production Worker runtime secrets remain configured separately in Cloudflare
and are independent of removing the GitHub production deploy token. Non-secret
vars (`API_ORIGIN`, `TRUSTED_STORAGE_ORIGINS`, boundary flags, …) come from
`wrangler.jsonc`; application-session vars (`AUTH_JWKS_URL`, `AUTH_ISSUER`,
`AUTH_AUDIENCE`) stay ops-managed and fail closed while empty
(`docs/ADR-003-auth-trust-model.md`). See `docs/CLOUDFLARE_BINDINGS.md` and
`docs/ops/p0-topology-checklists.md`.

#### Application-session JWKS → Worker JWT verification

Point Worker vars at the **Manut application session issuer** once provisioned
(do not invent issuer hosts or audiences in git). These are **not** Cloudflare
Access team JWKS — Access remains an optional outer gate (ADR-003).

| Worker var      | Example shape (placeholders only)                          |
| --------------- | ---------------------------------------------------------- |
| `AUTH_JWKS_URL` | `https://<session-issuer-host>/.well-known/jwks.json`      |
| `AUTH_ISSUER`   | `https://<session-issuer-host>`                            |
| `AUTH_AUDIENCE` | `<application-audience>`                                   |

Empty JWKS / issuer / audience fails closed (`503 AUTH_*_NOT_CONFIGURED`).
Storage is **R2** (`UPLOADS`); receipt provenance uses `TRUSTED_STORAGE_ORIGINS`.

**Hyperdrive:** keep `"hyperdrive": []` and
`ENABLE_HYPERDRIVE_BOUNDARY=false` until ops creates a real config (requires
Postgres `DATABASE_URL` / `DIRECT_URL`) and binds `HYPERDRIVE_DATABASE`. The
Hyperdrive **config id** may then be committed in `wrangler.jsonc` (it is not a
password); CI must never invent a placeholder id. Full runbook:
`docs/CLOUDFLARE_BINDINGS.md` → [Hyperdrive provisioning](./CLOUDFLARE_BINDINGS.md#hyperdrive-provisioning-ops).
Status 2026-07-18: no configs in account; create blocked on missing DB URL.

**Queues + R2:** the queues and R2 buckets named in `apps/edge/wrangler.jsonc`
are created automatically at deploy time by
`apps/edge/scripts/ensure-cloudflare-resources.mjs` (create-only, idempotent;
requires the Queues Edit + Workers R2 Storage Edit token permissions above).
Durable Object migrations, queue consumers, and Workflows are applied by
`wrangler deploy` itself.

## Bootstrap remaining secrets (local)

OAuth (`wrangler login`) can set Worker runtime secrets and create R2 buckets,
but **cannot** mint a long-lived `CLOUDFLARE_API_TOKEN` for GitHub Actions.
After creating a Manut-owned preview/staging deploy token (and optional R2 S3
token) in the dashboard:

```bash
source ~/.nvm/nvm.sh && nvm use
export CLOUDFLARE_API_TOKEN=…          # GitHub preview/staging deploy token; never the Workers Builds token
export CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1
export PREVIEW_EDGE_SIGNING_KEY=…       # unique preview runtime secret; never production's value
# Optional — only if you want SigV4 client→R2 instead of Worker + UPLOADS:
# export R2_ACCESS_KEY_ID=…
# export R2_SECRET_ACCESS_KEY=…
./scripts/setup-cloudflare-deploy-secrets.sh
```

The script never prints secret values. It stores preview/staging deploy
credentials and the preview-only first-deploy runtime secrets in their GitHub
Environments; production runtime Worker secrets remain valid and separately
managed in Cloudflare. Committed `wrangler.jsonc` sets non-secret
production/preview vars (boundary flags, `TRUSTED_STORAGE_ORIGINS`,
`R2_BUCKET_NAME`) and requires only `EDGE_SIGNING_KEY` as a deploy-time
secret. Committed `API_ORIGIN` for preview/production is **empty** (fail
closed) until ops sets a **distinct Express** origin — never the Worker
front door (`app.manut.xyz` / `preview.manut.xyz`). Self-proxy and repeated
`x-manut-proxy-hop` markers are rejected at runtime (see
`docs/ADR-002-worker-express-api-boundary.md`). Application-session
`AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` stay empty until the
session issuer is provisioned (runtime fail-closed; Access is a separate
outer gate — `docs/ADR-003-auth-trust-model.md`).

**Custom domains / routes:** leave `routes` out of `wrangler.jsonc`. Hosts such
as `app.manut.xyz` (and any dashboard-attached domains) are
**dashboard-managed custom domains** so `wrangler deploy` does not strip them.
Drift warnings about `manut.xyz` / `preview.manut.xyz` vs local config are
expected until DNS cutover is explicitly approved; do not add matching `routes`
just to silence the warning. Today `app.manut.xyz` may not resolve; Worker
`workers.dev` health is not end-to-end `/api` readiness.

### Ops-required: pause production Workers Builds until cutover marker (P0-E4-T7)

Engineering does **not** flip dashboard switches from this repo. Until G5 /
an approved cutover marker exists, an owner must **pause or fail-close** the
production Workers Builds trigger on Worker `manut` so merges to `main`
cannot publish pre-cutover Expo foundations. Record the change-window marker
privately; do not invent DNS or Hyperdrive ids to compensate.

**Fail-closed marker (git):**
[`docs/ops/markers/p0-e4-t7-workers-builds-pause.md`](./ops/markers/p0-e4-t7-workers-builds-pause.md).
That file tracks required vs applied pause evidence. This repository must
**not** claim the dashboard pause is done until that marker is updated by an
ops owner after a live check.

#### Live read-only status (verified 2026-07-19, account `187ab61ed9dbc6e616cb23e6b95aa8f1`)

| Field | Live value |
| ----- | ---------- |
| Worker service | `manut` |
| Script / external id | `4d091451cca54519bfeb5c2eb4ccd7e1` |
| Builds configured | **yes** (GitHub `mygogocash/Manut` linked) |
| Production trigger | **enabled** — `Deploy default branch` (`trigger_uuid` `b2dc37d3-1e1d-4a60-9c1a-42ada4fe03d2`) |
| `branch_includes` | `main` |
| `deleted_on` | `null` (active) |
| Non-production Builds (`previews_enabled`) | **false** (already off — keep off) |
| Latest evidence | successful `push_event` builds on `main` (e.g. build `da8331df-…` for merge of PR #219) |
| Build token name (no secret) | `Manut Workers Builds - 2026-07-18` |

**Verdict:** production Workers Builds is **currently enabled**. Do **not**
pause it from an engineering PR. Pause only after explicit ops approval in the
marker file (or a private change ticket referenced there).

Read-only re-check (ops laptop / MCP; never write):

```bash
# Wrangler (OAuth) — list recent deployments only
export CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1
npx wrangler deployments list --name manut

# Cloudflare Builds API (requires account token with Builds read)
# GET /accounts/{account_id}/builds/workers/4d091451cca54519bfeb5c2eb4ccd7e1/triggers
# Active pause = no trigger, or trigger with deleted_on set / empty branch_includes
# that no longer matches main pushes.
```

Dashboard path:
[workers/services/view/manut/production](https://dash.cloudflare.com/187ab61ed9dbc6e616cb23e6b95aa8f1/workers/services/view/manut/production)
→ **Settings → Builds**.

#### Exact pause steps (ops-only, after approval)

Pick **one** method. Prefer A (reversible disconnect). Do not invent Hyperdrive
ids, DNS records, or new Worker names as a substitute.

**A — Disconnect Git (preferred full pause)**

1. Confirm marker status is `approval: granted` (or private ticket id recorded).
2. Open Worker **`manut`** → **Settings → Builds**.
3. Select **Disconnect** (disconnect the GitHub repository from Workers Builds).
4. Confirm no new build starts on a harmless docs-only `main` push (or wait for
   the next merge and verify Builds history stays idle).
5. Confirm **Builds for non-production branches** remains disabled
   (`previews_enabled` must stay `false`; GitHub Actions owns preview/staging).
6. Update
   [`docs/ops/markers/p0-e4-t7-workers-builds-pause.md`](./ops/markers/p0-e4-t7-workers-builds-pause.md):
   `status: paused`, method `disconnect`, timestamp, and who performed it
   (names only — no tokens).

**B — Soft fail-close (builds may still run; do not promote)**

Use only if ops must keep the Git connection for log history but must not
publish Active Deployments:

1. Same approval gate as A.
2. Worker **`manut`** → **Settings → Builds → Build configuration**.
3. Change **Deploy command** from the production contract above to:

   ```bash
   npx wrangler versions upload --env production
   ```

   (Cloudflare documents this as disabling automatic promotion while still
   uploading versions — see Workers Builds “Disconnecting builds” notes.)
4. Save. Verify a subsequent `main` build does **not** change the Active
   Deployment for `manut`.
5. Update the marker with method `versions_upload_only`.

**C — API pause (ops token; no engineering automation)**

Only with an approved Builds-capable API token (never commit it):

1. Same approval gate as A.
2. `DELETE /accounts/187ab61ed9dbc6e616cb23e6b95aa8f1/builds/triggers/b2dc37d3-1e1d-4a60-9c1a-42ada4fe03d2`
   **or** disconnect via dashboard (A) so the trigger cannot fire on `main`.
3. Re-GET triggers for script `4d091451cca54519bfeb5c2eb4ccd7e1` and confirm
   production push triggers are gone / inactive.
4. Update the marker with method `api_delete_trigger` and the observed GET
   result (UUIDs only).

**Do not:** roll or delete the Builds token solely to “pause” (that breaks
recovery); pause Pages instead of Workers; enable non-production Builds; or
point preview at Worker name `manut`.

#### Re-enable (only after G5 / cutover marker)

1. Marker shows cutover approval + pause previously applied.
2. Reconnect Git or restore the exact production build/deploy commands from
   **Cloudflare Workers Builds (dashboard paste values)** above.
3. Confirm branch control: production branch `main`; non-production Builds
   **off**.
4. Retry one production build deliberately; confirm Active Deployment +
   `workers.dev` health — DNS cutover remains a separate approval.
5. Flip marker `status` to `reenabled_after_cutover`.

## First green preview / staging run — ops checklist

- [ ] Pages auto-deploy disabled (see above)
- [ ] Workers Builds: `build:cloudflare` + exact production command above
- [ ] Dedicated Builds-managed `Manut Workers Builds - YYYY-MM-DD` token has effective access to every scope above, including Queues Edit
- [ ] Replacement token validated with preview ensure + deploy to `manut-preview`; no write to production `manut`
- [ ] Native non-production Workers Builds disabled after validation
- [ ] GitHub Environments `preview` / `staging`: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` + `EXPO_PUBLIC_API_URL`
- [ ] Preview Environment: unique `EDGE_SIGNING_KEY` for atomic first deploy (R2 S3 pair optional); production runtime secrets remain in Cloudflare (`EDGE_SIGNING_KEY` required; R2 S3 optional)
- [ ] Application-session `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` set per env (not Access JWKS; ADR-003)
- [ ] Distinct Express `API_ORIGIN` per env (never Worker self-host; ADR-002)
- [ ] Preview isolation: deploy targets `manut-preview` only; `preview.manut.xyz` not on production `manut`
- [ ] Bindings per `docs/CLOUDFLARE_BINDINGS.md` (cancel D1; add Hyperdrive/R2/…)
- [ ] `manut-preview.bettergogocash.workers.dev/health` passes; custom-domain work remains separately approved
- [ ] Push / dispatch preview + staging; confirm Workers `manut-preview` / `manut-staging`
- [ ] Topology checklists complete: `docs/ops/p0-topology-checklists.md`

## Production enablement

1. Preview/staging GitHub deploys are green and smoke-tested.
2. A dedicated Workers Builds token is selected and has passed the preview
   validation retry against `manut-preview`; native non-production Workers
   Builds is disabled.
3. Production bindings are provisioned (Hyperdrive id real; R2/Queues/DO per
   wrangler) and production runtime secrets/vars are set in Cloudflare.
4. Retry the production build, or merge/push to `main` for the next production
   build, and confirm Workers Builds is the only production deploy owner.
5. DNS / custom-domain changes require separate approval; successful deploy
   authentication grants no DNS authorization (`PRODUCTION_DEPLOY.md`).
