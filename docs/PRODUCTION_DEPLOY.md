# Production deploy readiness

**Status:** GitHub Actions CI/CD path is in-repo; **ops-blocked** for a green
live deploy until Manut Cloudflare secrets/resources exist.
**DNS cutover is not authorized** by enabling these workflows.

CI/CD details (Pages vs Workers, Environment secret names, trigger matrix):
**`docs/CICD_CLOUDFLARE.md`**.

Companion checklists: `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`,
`docs/CURSOR_HANDOFF.md` (Phase E / F).

## Verdict

| Surface | Ready? | Evidence / blocker |
| --- | --- | --- |
| Expo web export artifact | **Code-ready** | `pnpm --filter @manut/app export:web` → `apps/app/dist` |
| Worker type-check + unit tests | **Code-ready** | `pnpm --filter @manut/edge type-check` / `test` |
| Worker bundle dry-run | **Code-ready** | `pnpm --filter @manut/edge build` (`wrangler deploy --dry-run`) |
| Wrangler env naming contracts | **Code-ready** | `apps/edge/wrangler.jsonc` local→production names; `hyperdrive: []` empty by design |
| Env name documentation | **Code-ready** | `.env.example`, `apps/app/.env.example`, this runbook, `CICD_CLOUDFLARE.md` |
| CI Validate path (PR Checks) | **Code-ready** | `.github/workflows/pr-checks.yml` builds web + Worker dry-run |
| Active GitHub deploy workflow | **Code-ready** | `deploy-staging.yml` (auto) + `deploy.yml` (manual / Environment-gated) |
| Manut-owned Cloudflare account + resources | **Ops-blocked** | No proven fresh account; do not invent Hyperdrive / R2 / Queue ids |
| Hyperdrive binding + `ENABLE_HYPERDRIVE_BOUNDARY` | **Ops-blocked** | Binding id not provisioned; flag stays `false` |
| Worker secrets / JWKS / `API_ORIGIN` | **Ops-blocked** | Names known; values must be issued per environment |
| Postgres + migrations on Manut DB | **Ops-blocked** | Clean baseline exists; production DB not provisioned from this branch |
| Dedicated `manut-intranet-e2e` + `E2E_*` | **Ops-blocked** | Five secrets + dedicated-project marker not configured |
| Expo / EAS Manut org + native builds | **Ops-blocked** | JS exports pass; APK / simulator need fresh Expo org |
| GitHub Pro / branch protection requiring Validate | **Ops-blocked** | Free org 403 on private rulesets |
| DNS / `manut.xyz` cutover | **Ops-blocked** | Explicitly out of scope until separate approval |
| Inherited credential revocation evidence | **Ops-blocked** | Not performed; required before trust cutover |

**NOT ready for DNS / production traffic until** every ops-blocked row above has
private cutover evidence (names, HMAC fingerprints, or tickets — never raw
secrets in Git) and a separately approved cutover. Staging CI may run and
**fail closed** until Environment secrets exist — that is expected.

## CI/CD summary

| Workflow | Triggers | Environment |
| --- | --- | --- |
| `.github/workflows/deploy-staging.yml` | Push `main` / `staging`; `workflow_dispatch` | `staging` |
| `.github/workflows/deploy.yml` | `workflow_dispatch` only | `production` (require reviewers) |

**Turn off Cloudflare Pages auto-deploy** for any Pages project linked to this
repo (including `manut`). Correct delivery is Workers + Assets via
`apps/edge` wrangler — see `docs/CICD_CLOUDFLARE.md`.

### Required GitHub Environment names (no values in git)

**Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

**Vars (required):** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Vars (optional):** `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_REALTIME_ORIGIN`

Hyperdrive ids stay out of CI and out of committed wrangler until ops binds a
real id (`hyperdrive: []` until then). Never substitute a fake `DATABASE_URL`.

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
| Vars | `API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` | Auth fail-closed if JWKS empty at runtime |
| Vars | `ENABLE_HYPERDRIVE_BOUNDARY`, `ENABLE_WORKFLOW_BOUNDARY`, `ENABLE_CONTAINER_BOUNDARY`, `ENABLE_CRON_BOUNDARY` | Default `false`; fail closed when enabled without capability |
| Vars | `TRUSTED_STORAGE_ORIGINS`, `R2_BUCKET_NAME`, `ENABLE_LOCAL_R2_STREAMING` | Receipt provenance; local streaming off in remote envs |
| Secrets | `EDGE_SIGNING_KEY`, `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY` | ≥32-char signing key; unique per env |

Production Worker name contract: `manut-intranet-edge-production`
(`env.production` in `wrangler.jsonc`).

### Express / API (parity bridge)

| Name | Role |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Authoritative Postgres (not a Worker client secret) |
| `API_ORIGIN` (client-facing origin docs) | Browser / native hit Worker or API as configured |
| `EDGE_REALTIME_ORIGIN` | Worker origin owning DO rooms |
| `EDGE_REALTIME_BRIDGE_SECRET` | **Must match** Worker `EDGE_SIGNING_KEY` |
| Auth / JWT / cron secrets | See `.env.example` (names only) |

### Expo app

| Name | Role |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | HTTP API base |
| `EXPO_PUBLIC_SOCKET_URL` | Socket.IO fallback origin |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | Prefer edge DO rooms when set |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public auth client only |

### CI / E2E (when authorized)

`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`,
`E2E_DATABASE_URL`, `E2E_DIRECT_URL` — dedicated `manut-intranet-e2e` only.

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

1. **Prove Manut ownership** of Cloudflare, Postgres/Supabase, Expo, and GitHub
   authority (private evidence record).
2. **Disable Cloudflare Pages auto-deploy** for any Pages project on this repo;
   use Workers + Assets only (`docs/CICD_CLOUDFLARE.md`).
3. **Provision per-environment** Worker, R2, Queues (+ DLQ), DO migrations,
   Workflow stubs, and Hyperdrive configs with unique names from
   `wrangler.jsonc` contracts.
4. **Apply migrations** to the Manut Postgres via `prisma migrate deploy` on a
   dedicated admin path (not invented inside the Worker deploy job).
5. **Bind Hyperdrive** id into `wrangler.jsonc` (or dashboard equivalent) as
   `HYPERDRIVE_DATABASE`; set `ENABLE_HYPERDRIVE_BOUNDARY=true` only after bind.
   Keep `hyperdrive: []` until a real id exists — never invent in CI.
6. **Set Worker vars/secrets:** `API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`,
   `AUTH_AUDIENCE`, `TRUSTED_STORAGE_ORIGINS`, `EDGE_SIGNING_KEY`, R2 secrets.
7. **Configure Express:** `EDGE_REALTIME_ORIGIN` + matching
   `EDGE_REALTIME_BRIDGE_SECRET`; keep Socket.IO until edge live path is sole
   production path and E2E covers it.
8. **Configure GitHub Environments** `staging` / `production` with
   `CLOUDFLARE_*` secrets and Expo public vars; require reviewers on production.
9. **Staging deploy** via push to `main` or `workflow_dispatch`; confirm
   `manut-intranet-edge-staging`.
10. **Authenticated E2E** against `manut-intranet-e2e` / staging edge origin.
11. **Production deploy** via `workflow_dispatch` after Environment approval.
12. **DNS / custom domain** only after staging green and explicit approval;
    keep `manut.xyz` unchanged until that approval.
13. **Revoke** inherited credentials; prove negative auth; store HMAC /
    ticket links only.
14. **Retire** Socket.IO / shrink Express / remove `apps/web` only per
    `CLOUDFLARE_MIGRATION_CHECKLIST.md` §7 after Expo browser E2E acceptance.

## Explicit non-goals of this document

- Mutating DNS or claiming production traffic cutover.
- Committing Hyperdrive ids, account ids, API tokens, or other secrets.
- Claiming Cloudflare / Expo / E2E / revocation complete without live evidence.
- Retiring Socket.IO or `apps/web` before Expo browser E2E acceptance.
- Using Cloudflare Pages as the Manut SPA host.
