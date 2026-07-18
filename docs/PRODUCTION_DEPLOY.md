# Production deploy readiness

**Status:** GitHub Actions CI/CD path is in-repo; **ops-blocked** for a green
live deploy until Manut Cloudflare secrets/resources and Access JWKS are set.
**DNS cutover is not authorized** by enabling these workflows alone.

CI/CD details (Pages vs Workers, Environment secret names, trigger matrix):
**`docs/CICD_CLOUDFLARE.md`**.

Companion checklists: `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`,
`docs/CURSOR_HANDOFF.md` (Phase E / F).

## Live Worker mapping (authoritative)

Dashboard Worker **service name:** `manut`.

| Git branch | CF env | URL |
| --- | --- | --- |
| `main` | production | https://app.manut.xyz (+ https://manut.bettergogocash.workers.dev) |
| `preview` | preview | https://preview.manut.xyz (+ `*.manut.bettergogocash.workers.dev`) |

If `preview.manut.xyz` is still listed under **Production** in Cloudflare Domains,
move it to the **Preview** environment.

## Verdict

| Surface | Ready? | Evidence / blocker |
| --- | --- | --- |
| Expo web export artifact | **Code-ready** | `pnpm --filter @manut/app export:web` → `apps/app/dist` |
| Worker type-check + unit tests | **Code-ready** | `pnpm --filter @manut/edge type-check` / `test` |
| Worker bundle dry-run | **Code-ready** | `pnpm --filter @manut/edge build` (`wrangler deploy --dry-run`) |
| Wrangler env naming contracts | **Code-ready** | service `manut` (prod/preview); `manut-staging` optional; `hyperdrive: []` |
| Env name documentation | **Code-ready** | `.env.example`, `apps/app/.env.example`, this runbook, `CICD_CLOUDFLARE.md` |
| CI Validate path (PR Checks) | **Code-ready** | `.github/workflows/pr-checks.yml` builds web + Worker dry-run |
| Active GitHub deploy workflow | **Code-ready** | `deploy-preview.yml` + `deploy-staging.yml` + `deploy.yml` (Environment-gated) |
| Manut-owned Cloudflare account + resources | **Ops-blocked** | Prove secrets/bindings; do not invent Hyperdrive / R2 / Queue ids |
| Hyperdrive binding + `ENABLE_HYPERDRIVE_BOUNDARY` | **Ops-blocked** | Binding id not provisioned; flag stays `false` |
| Worker secrets / JWKS / `API_ORIGIN` | **Ops-blocked** | Cloudflare Access JWKS names known; values per environment |
| Postgres + migrations on Manut DB | **Ops-blocked** | Clean baseline exists; production DB not provisioned from this branch |
| Dedicated E2E project + `E2E_*` | **Ops-blocked** | Five secrets + dedicated-project marker not configured |
| Expo / EAS Manut org + native builds | **Ops-blocked** | JS exports pass; APK / simulator need fresh Expo org |
| GitHub Pro / branch protection requiring Validate | **Ops-blocked** | Free org 403 on private rulesets |
| DNS / custom domain cutover | **Ops-blocked** | Confirm Domains assignment; separate approval for zone changes |
| Inherited credential revocation evidence | **Ops-blocked** | Not performed; required before trust cutover |

**NOT ready for DNS / production traffic until** every ops-blocked row above has
private cutover evidence (names, HMAC fingerprints, or tickets — never raw
secrets in Git) and a separately approved cutover. Deploy CI may run and
**fail closed** until Environment secrets exist — that is expected.

## CI/CD summary

| Workflow | Triggers | Environment | Wrangler target |
| --- | --- | --- | --- |
| `.github/workflows/deploy-preview.yml` | Push `preview`; `workflow_dispatch` | `preview` | `versions upload --env preview` → `manut` |
| `.github/workflows/deploy-staging.yml` | Push `staging`; `workflow_dispatch` | `staging` | `deploy --env staging` → `manut-staging` |
| `.github/workflows/deploy.yml` | Push `main`; `workflow_dispatch` | `production` (require reviewers) | `deploy --env production` → `manut` |

**Turn off Cloudflare Pages auto-deploy** for any Pages project linked to this
repo. Correct delivery is Workers + Assets via `apps/edge` — see
`docs/CICD_CLOUDFLARE.md`.

### Required GitHub Environment names (no secret values in git)

Environments: **`preview`**, **`staging`**, and **`production`** (require reviewers
on production).

**Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

**Vars (required):** `EXPO_PUBLIC_API_URL`

| Environment | Recommended `EXPO_PUBLIC_API_URL` |
| --- | --- |
| `production` | `https://app.manut.xyz` (fallback `https://manut.bettergogocash.workers.dev`) |
| `preview` | `https://preview.manut.xyz` |
| `staging` | staging host only (not live `manut` Production) |

**Vars (optional):** `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_REALTIME_ORIGIN`

**Not required:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Hyperdrive ids stay out of CI (`hyperdrive: []` until then). Never substitute a
fake `DATABASE_URL`.

## Required bindings and env (names only)

### Worker (`apps/edge` / wrangler)

| Kind | Name | Notes |
| --- | --- | --- |
| Assets | `ASSETS` → `../app/dist` | SPA; requires Expo web export before deploy |
| Hyperdrive | `HYPERDRIVE_DATABASE` | Empty until real id; then `ENABLE_HYPERDRIVE_BOUNDARY=true` |
| R2 | `UPLOADS` | Bucket names unique per env (`manut-intranet-uploads-{env}`) |
| DO | `REALTIME_ROOMS`, `QUEUE_LEDGER` | Classes `RealtimeRoom`, `QueueLedger` |
| Queues | `JOB_QUEUE`, `DEAD_LETTER_QUEUE` | Unique queue + DLQ names per env |
| Workflow | `BACKGROUND_WORKFLOW` | Stub until `ENABLE_WORKFLOW_BOUNDARY=true` |
| Rate limit | `API_RATE_LIMITER` | Namespace ids are contracts, not inherited account proof |
| Vars | `API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` | Cloudflare Access JWKS; fail-closed if empty |
| Vars | `ENABLE_HYPERDRIVE_BOUNDARY`, `ENABLE_WORKFLOW_BOUNDARY`, `ENABLE_CONTAINER_BOUNDARY`, `ENABLE_CRON_BOUNDARY` | Default `false`; fail closed when enabled without capability |
| Vars | `TRUSTED_STORAGE_ORIGINS`, `R2_BUCKET_NAME`, `ENABLE_LOCAL_R2_STREAMING` | R2 receipt provenance; local streaming off in remote envs |
| Secrets | `EDGE_SIGNING_KEY`, `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY` | ≥32-char signing key; unique per env |

Production / preview Worker service contract: **`manut`**
(`env.production` / `env.preview` in `wrangler.jsonc`).

### Express / API (parity bridge)

| Name | Role |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Authoritative Postgres (not a Worker client secret) |
| `API_ORIGIN` (client-facing origin docs) | Browser / native hit Worker or API as configured |
| `EDGE_REALTIME_ORIGIN` | Worker origin owning DO rooms |
| `EDGE_REALTIME_BRIDGE_SECRET` | **Must match** Worker `EDGE_SIGNING_KEY` |
| Auth / JWT / cron secrets | See `.env.example` (names only) |

Express still has temporary Supabase Admin SDK usage for password login /
storage until Cloudflare Access + R2 own those paths — see leftovers in
`docs/CICD_CLOUDFLARE.md` and handoff.

### Expo app

| Name | Role |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | HTTP API / SPA origin |
| `EXPO_PUBLIC_SOCKET_URL` | Socket.IO fallback origin |
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
3. **Confirm Domains** on Worker `manut`: `app.manut.xyz` → Production;
   `preview.manut.xyz` → Preview (move if mis-assigned).
4. **Provision** R2, Queues (+ DLQ), DO migrations, Workflow stubs, and
   Hyperdrive configs with unique names from `wrangler.jsonc` contracts.
5. **Apply migrations** to the Manut Postgres via `prisma migrate deploy` on a
   dedicated admin path (not invented inside the Worker deploy job).
6. **Bind Hyperdrive** id into `wrangler.jsonc` (or dashboard equivalent) as
   `HYPERDRIVE_DATABASE`; set `ENABLE_HYPERDRIVE_BOUNDARY=true` only after bind.
   Keep `hyperdrive: []` until a real id exists — never invent in CI.
7. **Set Worker vars/secrets:** `API_ORIGIN`, Cloudflare Access
   `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE`, `TRUSTED_STORAGE_ORIGINS`,
   `EDGE_SIGNING_KEY`, R2 secrets.
8. **Configure Express:** `EDGE_REALTIME_ORIGIN` + matching
   `EDGE_REALTIME_BRIDGE_SECRET`; keep Socket.IO until edge live path is sole
   production path and E2E covers it.
9. **Configure GitHub Environments** `preview` / `staging` / `production` with
   `CLOUDFLARE_*` secrets and `EXPO_PUBLIC_API_URL`; require reviewers on production.
10. **Preview** via push to `preview` (`versions upload`); confirm
    `*.manut.bettergogocash.workers.dev` / `preview.manut.xyz`.
11. **Production** via merge/push to `main` (Environment reviewers) or
    `workflow_dispatch`; confirm `manut` + `app.manut.xyz`.
12. **Revoke** inherited credentials; prove negative auth; store HMAC /
    ticket links only.
13. **Retire** Express Supabase SDK / Socket.IO / `apps/web` only per
    `CLOUDFLARE_MIGRATION_CHECKLIST.md` after Expo browser E2E acceptance.

## Explicit non-goals of this document

- Mutating DNS or claiming production traffic cutover without approval.
- Committing Hyperdrive ids, account ids, API tokens, or other secrets.
- Claiming Cloudflare / Expo / E2E / revocation complete without live evidence.
- Retiring Socket.IO or `apps/web` before Expo browser E2E acceptance.
- Using Cloudflare Pages as the Manut SPA host.
- Requiring Supabase Expo public vars for Worker deploy.
