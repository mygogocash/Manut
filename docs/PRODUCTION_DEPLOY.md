# Production deploy readiness

**Status:** Cloudflare Workers Builds is the sole production deploy owner for
`main`; GitHub Actions owns preview/staging only. Live deployment remains
**ops-blocked** until Manut Cloudflare secrets/resources and Access JWKS are
set. **Successful build authentication does not authorize DNS cutover.**

CI/CD details (Pages vs Workers, Environment secret names, trigger matrix):
**`docs/CICD_CLOUDFLARE.md`**.

Companion checklists: `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`,
`docs/CURSOR_HANDOFF.md` (Phase E / F).

## Live Worker mapping (authoritative)

Dashboard Worker **service name:** `manut`.

| Git branch | CF env     | URL                                                                |
| ---------- | ---------- | ------------------------------------------------------------------ |
| `main`     | production | https://app.manut.xyz (+ https://manut.bettergogocash.workers.dev) |
| `preview`  | preview    | https://manut-preview.bettergogocash.workers.dev                   |

`preview.manut.xyz` is not part of this token-recovery change. Attach it to the
isolated preview Worker only after separate DNS approval.

## Verdict

| Surface                                           | Ready?          | Evidence / blocker                                                                                  |
| ------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Expo web export artifact                          | **Code-ready**  | `pnpm --filter @manut/app export:web` → `apps/app/dist`                                             |
| Worker type-check + unit tests                    | **Code-ready**  | `pnpm --filter @manut/edge type-check` / `test`                                                     |
| Worker bundle dry-run                             | **Code-ready**  | `pnpm --filter @manut/edge build` (`wrangler deploy --dry-run`)                                     |
| Wrangler env naming contracts                     | **Code-ready**  | `manut` production; isolated `manut-preview`; `manut-staging` optional; `hyperdrive: []`            |
| Env name documentation                            | **Code-ready**  | `.env.example`, `apps/app/.env.example`, this runbook, `CICD_CLOUDFLARE.md`                         |
| CI Validate path (PR Checks)                      | **Code-ready**  | `.github/workflows/pr-checks.yml` builds web + Worker dry-run                                       |
| Deploy ownership                                  | **Code-ready**  | Workers Builds: production `main`; GitHub Actions: `deploy-preview.yml` + `deploy-staging.yml` only |
| Manut-owned Cloudflare account + resources        | **Ops-blocked** | Prove secrets/bindings; do not invent Hyperdrive / R2 / Queue ids                                   |
| Hyperdrive binding + `ENABLE_HYPERDRIVE_BOUNDARY` | **Ops-blocked** | Binding id not provisioned; flag stays `false`                                                      |
| Worker secrets / JWKS / `API_ORIGIN`              | **Ops-blocked** | Distinct Express `API_ORIGIN` + app-session JWKS per env; Access optional outer gate only (ADR-002/003) |
| Postgres + migrations on Manut DB                 | **Ops-blocked** | Clean baseline exists; production DB not provisioned from this branch                               |
| Dedicated E2E project + `E2E_*`                   | **Ops-blocked** | Five secrets + dedicated-project marker not configured                                              |
| Expo / EAS Manut org + native builds              | **Ops-blocked** | JS exports pass; APK / simulator need fresh Expo org                                                |
| GitHub Pro / branch protection requiring Validate | **Ops-blocked** | Free org 403 on private rulesets                                                                    |
| DNS / custom domain cutover                       | **Ops-blocked** | Confirm Domains assignment; separate approval for zone changes                                      |
| Inherited credential revocation evidence          | **Ops-blocked** | Not performed; required before trust cutover                                                        |

**NOT ready for DNS / production traffic until** every ops-blocked row above has
private cutover evidence (names, HMAC fingerprints, or tickets — never raw
secrets in Git) and a separately approved cutover. Preview/staging GitHub CI
may **fail closed** until Environment secrets exist; Workers Builds production
may fail closed until its selected token and Cloudflare runtime config exist.

## CI/CD summary

| Owner                                                 | Trigger                             | Credential boundary                             | Wrangler target                          |
| ----------------------------------------------------- | ----------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| GitHub Actions `.github/workflows/deploy-preview.yml` | Push `preview`; `workflow_dispatch` | GitHub Environment `preview`                    | `deploy --env preview` → `manut-preview` |
| GitHub Actions `.github/workflows/deploy-staging.yml` | Push `staging`; `workflow_dispatch` | GitHub Environment `staging`                    | `deploy --env staging` → `manut-staging` |
| Cloudflare Workers Builds                             | Push/merge `main`; dashboard retry  | dashboard-selected `Manut Workers Builds` token | `deploy --env production` → `manut`      |

**Turn off Cloudflare Pages auto-deploy** for any Pages project linked to this
repo. Correct delivery is Workers + Assets via `apps/edge` — see
`docs/CICD_CLOUDFLARE.md`.

### Deleted or rolled Workers Builds token recovery

If initialization reports that the selected build token was deleted or rolled,
choose **Create new token** from Worker `manut` → **Settings → Builds → API
token**, name it **`Manut Workers Builds - YYYY-MM-DD`**, and verify its
effective access includes the standard Workers Builds permissions plus
**Account → Queues → Edit**. The generated token may initially be broad: use
**My Profile → API Tokens → Edit** (not **Roll**) to keep only the permission
matrix in `docs/CICD_CLOUDFLARE.md`, account **GoGoCash**, and zone
**`manut.xyz`**. Confirm the selected token name remains unchanged; never roll
a selected token.

Save the selection under Worker `manut` → **Settings → Builds → Build
configuration**, then validate it with the non-production contract:

```bash
pnpm run build:cloudflare
cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env preview && npx wrangler deploy --env preview
```

Only after preview succeeds, retry production with the exact deploy contract:

```bash
pnpm run build:cloudflare
cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env production && npx wrangler deploy --env production
```

The committed preview environment targets the separate Worker `manut-preview`
and uses a full deploy because Durable Object lifecycle migrations cannot be
version-uploaded. Confirm the build log names `manut-preview` before proceeding;
preview must never use the production Worker name `manut`.

Disable native non-production Workers Builds after that validation so GitHub
Actions remains the only preview/staging deploy owner. The selected build token
must never be copied into GitHub, source, or logs. See
`docs/CICD_CLOUDFLARE.md` for the full permission matrix.

### Required GitHub Environment names (no secret values in git)

Deploy Environments: **`preview`** and **`staging`** only.

**Secrets (preview and staging):** `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`

**Additional preview first-deploy secret:** unique `EDGE_SIGNING_KEY` (required).
Optional SigV4 pair: `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (both or
neither). The workflow uploads present secrets with a mode-0600 `RUNNER_TEMP`
file and `wrangler deploy --secrets-file`, then removes the file on exit. When
the R2 pair is present, `R2_ACCOUNT_ID` comes from `CLOUDFLARE_ACCOUNT_ID`.
When omitted, uploads use the Worker `UPLOADS` R2 binding.

**Vars (required):** `EXPO_PUBLIC_API_URL`

| Environment | Recommended `EXPO_PUBLIC_API_URL`                                                             |
| ----------- | --------------------------------------------------------------------------------------------- |
| `preview`   | `https://manut-preview.bettergogocash.workers.dev/api` until separate custom-domain approval |
| `staging`   | staging Worker origin + `/api` (not live `manut` Production)                                  |

**Vars (optional):** `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_REALTIME_ORIGIN`

**Not required:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Hyperdrive ids stay out of CI (`hyperdrive: []` until then). Never substitute a
fake `DATABASE_URL`.

Production `EXPO_PUBLIC_API_URL=https://app.manut.xyz/api` belongs in Workers
Builds configuration (include the `/api` path — app-core calls `/auth/*` and
other relative paths beneath that base). Host-only values are normalized at
runtime to append `/api`, but ops should set the explicit contract. Production
Worker runtime secrets such as `EDGE_SIGNING_KEY` and R2 credentials remain
configured in Cloudflare; removing a GitHub production deploy token does not
remove or replace those runtime secrets.

## Required bindings and env (names only)

### Worker (`apps/edge` / wrangler)

| Kind       | Name                                                                                                          | Notes                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Assets     | `ASSETS` → `../app/dist`                                                                                      | SPA; requires Expo web export before deploy                  |
| Hyperdrive | `HYPERDRIVE_DATABASE`                                                                                         | Empty until real id; then `ENABLE_HYPERDRIVE_BOUNDARY=true`  |
| R2         | `UPLOADS`                                                                                                     | Bucket names unique per env (`manut-intranet-uploads-{env}`) |
| DO         | `REALTIME_ROOMS`, `QUEUE_LEDGER`                                                                              | Classes `RealtimeRoom`, `QueueLedger`                        |
| Queues     | `JOB_QUEUE`, `DEAD_LETTER_QUEUE`                                                                              | Unique queue + DLQ names per env                             |
| Workflow   | `BACKGROUND_WORKFLOW`                                                                                         | Stub until `ENABLE_WORKFLOW_BOUNDARY=true`                   |
| Rate limit | `API_RATE_LIMITER`                                                                                            | Namespace ids are contracts, not inherited account proof     |
| Vars       | `API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`                                                 | Distinct Express origin + app-session JWKS; fail-closed if empty/self-proxy (ADR-002/003) |
| Vars       | `ENABLE_HYPERDRIVE_BOUNDARY`, `ENABLE_WORKFLOW_BOUNDARY`, `ENABLE_CONTAINER_BOUNDARY`, `ENABLE_CRON_BOUNDARY` | Default `false`; fail closed when enabled without capability |
| Vars       | `TRUSTED_STORAGE_ORIGINS`, `R2_BUCKET_NAME`, `ENABLE_LOCAL_R2_STREAMING`                                      | R2 receipt provenance; local streaming off in remote envs    |
| Secrets    | **Required:** `EDGE_SIGNING_KEY`. **Optional:** `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY` | ≥32-char signing key; S3 pair only for SigV4 client→R2       |

Production / preview Worker service contract: **`manut`**
(`env.production` / `env.preview` in `wrangler.jsonc`).

### Express / API (parity bridge)

| Name                                     | Role                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL` / `DIRECT_URL`            | Authoritative Postgres (not a Worker client secret) |
| `API_ORIGIN` (client-facing origin docs) | Browser / native hit Worker or API as configured    |
| `EDGE_REALTIME_ORIGIN`                   | Worker origin owning DO rooms                       |
| `EDGE_REALTIME_BRIDGE_SECRET`            | **Must match** Worker `EDGE_SIGNING_KEY`            |
| Auth / JWT / cron secrets                | See `.env.example` (names only)                     |

Express still has temporary Supabase Admin SDK usage for password login /
storage until Cloudflare Access + R2 own those paths — see leftovers in
`docs/CICD_CLOUDFLARE.md` and handoff.

### Expo app

| Name                          | Role                          |
| ----------------------------- | ----------------------------- |
| `EXPO_PUBLIC_API_URL`         | API base including `/api`     |
| `EXPO_PUBLIC_SOCKET_URL`      | Socket.IO fallback origin     |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | Prefer edge DO rooms when set |

Web: httpOnly cookie session. Native: SecureStore bearer via Manut `/auth/*`
(`X-Manut-Client: native`). No Expo Supabase public vars.

### CI / E2E (when authorized)

Dedicated Postgres + auth fixtures for `manut-intranet-e2e` only. Prefer
Manut-owned Access/Postgres secrets over inherited Supabase project names;
existing `E2E_SUPABASE_*` names remain a fail-closed gate until replaced.

## Local verification (artifact path)

Use Node `24.18.0` and pnpm `11.13.1` (`nvm use` / `.nvmrc`).

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @manut/app export:web
pnpm --filter @manut/edge type-check
pnpm --filter @manut/edge test
pnpm --filter @manut/edge build   # wrangler deploy --dry-run
```

CI equivalent: `web-build` then `worker-build` in `.github/workflows/pr-checks.yml`.

## Order of operations (when cutover is separately approved)

Do not reorder. DNS remains last.

1. **Prove Manut ownership** of Cloudflare, Postgres, Expo, and GitHub
   authority (private evidence record).
2. **Disable Cloudflare Pages auto-deploy** for any Pages project on this repo;
   use Workers + Assets only (`docs/CICD_CLOUDFLARE.md`).
3. **Confirm Domains** on Worker `manut`: `app.manut.xyz` → Production. Attach
   `preview.manut.xyz` only to `manut-preview` and only after separate approval.
4. **Provision** R2, Queues (+ DLQ), DO migrations, Workflow stubs, and
   Hyperdrive configs with unique names from `wrangler.jsonc` contracts.
5. **Apply migrations** to the Manut Postgres via `prisma migrate deploy` on a
   dedicated admin path (not invented inside the Worker deploy job).
6. **Bind Hyperdrive** id into `wrangler.jsonc` (or dashboard equivalent) as
   `HYPERDRIVE_DATABASE`; set `ENABLE_HYPERDRIVE_BOUNDARY=true` only after bind.
   Keep `hyperdrive: []` until a real id exists — never invent in CI. Ops
   commands: `docs/CLOUDFLARE_BINDINGS.md` (Hyperdrive provisioning).
7. **Set Worker vars/secrets:** distinct Express `API_ORIGIN` (never the
   Worker host), application-session `AUTH_JWKS_URL` / `AUTH_ISSUER` /
   `AUTH_AUDIENCE`, `TRUSTED_STORAGE_ORIGINS`, `EDGE_SIGNING_KEY`, R2 secrets.
   Optional Cloudflare Access remains a separate outer gate (ADR-003) — do
   not claim Access JWKS is set until provisioned. Pause production Workers
   Builds until the cutover marker exists (`docs/CICD_CLOUDFLARE.md`).
8. **Configure Express:** `EDGE_REALTIME_ORIGIN` + matching
   `EDGE_REALTIME_BRIDGE_SECRET`; keep Socket.IO until edge live path is sole
   production path and E2E covers it.
9. **Configure GitHub Environments** `preview` / `staging` with
   `CLOUDFLARE_*` secrets and `EXPO_PUBLIC_API_URL`; preview additionally needs
   its unique `EDGE_SIGNING_KEY` and R2 S3 pair for the atomic first deploy.
10. **Recover/validate the Workers Builds token** if needed: create it from the
    Builds selector, verify effective Queue/R2/Worker access, then deploy the
    isolated `manut-preview` Worker before production. Disable native
    non-production Workers Builds after validation.
11. **Preview** via push to `preview`; confirm
    `manut-preview.bettergogocash.workers.dev/health`.
12. **Production** through Workers Builds via merge/push to `main` or a build
    retry; confirm `manut` + `app.manut.xyz` without changing DNS.
13. **Revoke** inherited credentials; prove negative auth; store HMAC /
    ticket links only.
14. **Retire** Express Supabase SDK / Socket.IO / `apps/web` only per
    `CLOUDFLARE_MIGRATION_CHECKLIST.md` after Expo browser E2E acceptance.

## Explicit non-goals of this document

- Mutating DNS or claiming production traffic cutover without approval.
- Committing connection strings, API tokens, or other secrets. (A real
  Hyperdrive **config id** in `wrangler.jsonc` is allowed after provisioning;
  invented placeholder ids are not.)
- Claiming Cloudflare / Expo / E2E / revocation complete without live evidence.
- Retiring Socket.IO or `apps/web` before Expo browser E2E acceptance.
- Using Cloudflare Pages as the Manut SPA host.
- Requiring Supabase Expo public vars for Worker deploy.
