# Production deploy readiness

**Status:** code-path proven locally; **ops-blocked** for live cutover.
**Deploy workflows remain disabled.** This document does not authorize
provisioning, DNS changes, or enabling `.github/workflows/deploy*.yml.disabled`.

Companion checklists: `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`,
`docs/CURSOR_HANDOFF.md` (Phase E / F).

## Verdict

| Surface | Ready? | Evidence / blocker |
| --- | --- | --- |
| Expo web export artifact | **Code-ready** | `pnpm --filter @manut/app export:web` → `apps/app/dist` |
| Worker type-check + unit tests | **Code-ready** | `pnpm --filter @manut/edge type-check` / `test` (155 tests) |
| Worker bundle dry-run | **Code-ready** | `pnpm --filter @manut/edge build` (`wrangler deploy --dry-run`) |
| Wrangler env naming contracts | **Code-ready** | `apps/edge/wrangler.jsonc` local→production names; `hyperdrive: []` empty by design |
| Env name documentation | **Code-ready** | `.env.example`, `apps/app/.env.example`, this runbook |
| CI Validate path (PR Checks) | **Code-ready** | `.github/workflows/pr-checks.yml` builds web + Worker dry-run |
| Active GitHub deploy workflow | **Intentionally absent** | Only `deploy.yml.disabled` / `deploy-staging.yml.disabled` stubs |
| Manut-owned Cloudflare account + resources | **Ops-blocked** | No proven fresh account; do not invent Hyperdrive / R2 / Queue ids |
| Hyperdrive binding + `ENABLE_HYPERDRIVE_BOUNDARY` | **Ops-blocked** | Binding id not provisioned; flag stays `false` |
| Worker secrets / JWKS / `API_ORIGIN` | **Ops-blocked** | Names known; values must be issued per environment |
| Postgres + migrations on Manut DB | **Ops-blocked** | Clean baseline exists; production DB not provisioned from this branch |
| Dedicated `manut-intranet-e2e` + `E2E_*` | **Ops-blocked** | Five secrets + dedicated-project marker not configured |
| Expo / EAS Manut org + native builds | **Ops-blocked** | JS exports pass; APK / simulator need fresh Expo org |
| GitHub Pro / branch protection requiring Validate | **Ops-blocked** | Free org 403 on private rulesets |
| DNS / `manut.xyz` cutover | **Ops-blocked** | Explicitly out of scope until separate approval |
| Inherited credential revocation evidence | **Ops-blocked** | Not performed; required before trust cutover |

**NOT ready to flip deploy on until** every ops-blocked row above has private
cutover evidence (names, HMAC fingerprints, or tickets — never raw secrets in
Git), a separate approved cutover PR exists, and deploy stubs are rewritten
against Manut-owned resources only.

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

Latest local dry-run evidence (2026-07-18): Expo web export succeeded; Worker
20 files / 155 tests passed; `wrangler deploy --dry-run` bundled assets from
`apps/app/dist` and exited without uploading. **No live deploy.**

## Order of operations (when cutover is separately approved)

Do not reorder. Do not enable deploy workflows before step 8.

1. **Prove Manut ownership** of Cloudflare, Postgres/Supabase, Expo, and GitHub
   authority (private evidence record).
2. **Provision per-environment** Worker, R2, Queues (+ DLQ), DO migrations,
   Workflow stubs, and Hyperdrive configs with unique names from
   `wrangler.jsonc` contracts.
3. **Apply migrations** to the Manut Postgres via `prisma migrate deploy` on a
   dedicated admin path (not from disabled Actions until rewritten).
4. **Bind Hyperdrive** id into `wrangler.jsonc` (or dashboard equivalent) as
   `HYPERDRIVE_DATABASE`; set `ENABLE_HYPERDRIVE_BOUNDARY=true` only after bind.
5. **Set Worker vars/secrets:** `API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`,
   `AUTH_AUDIENCE`, `TRUSTED_STORAGE_ORIGINS`, `EDGE_SIGNING_KEY`, R2 secrets.
6. **Configure Express:** `EDGE_REALTIME_ORIGIN` + matching
   `EDGE_REALTIME_BRIDGE_SECRET`; keep Socket.IO until edge live path is sole
   production path and E2E covers it.
7. **Configure Expo** public origins for the target environment; produce
   Android internal + iOS simulator builds from a Manut Expo org (no store
   submit in migration).
8. **Rewrite** (do not blindly rename) deploy workflow stubs into real
   workflows that: export web → dry-run or deploy Worker with Manut OIDC /
   API token secrets → never reuse inherited credentials. Staging first.
9. **Authenticated E2E** against `manut-intranet-e2e` / staging edge origin.
10. **DNS / custom domain** only after staging green and explicit approval;
    keep `manut.xyz` unchanged until that approval.
11. **Revoke** inherited credentials; prove negative auth; store HMAC /
    ticket links only.
12. **Retire** Socket.IO / shrink Express / remove `apps/web` only per
    `CLOUDFLARE_MIGRATION_CHECKLIST.md` §7 after Expo browser E2E acceptance.

## Mechanical re-enable checklist (still leave `.disabled` until approved)

The current stubs are intentional no-ops (comment-only). When an approved
cutover PR lands, replace them with a workflow that at minimum:

1. Uses commit-SHA-pinned Actions; `permissions` least privilege; never
   `pull_request_target`.
2. Node `24.18.0`, pnpm `11.13.1`, `pnpm install --frozen-lockfile`.
3. `pnpm --filter @manut/app export:web` then upload/use `apps/app/dist`.
4. `pnpm --filter @manut/edge type-check`, `test`, then
   `wrangler deploy --env production` (or staging) with Manut-owned
   `CLOUDFLARE_API_TOKEN` / account id from GitHub Environment secrets.
5. Does **not** invent Hyperdrive ids in the workflow; id must already be in
   wrangler config from the approved provisioning PR.
6. Runs `pnpm security:credentials` on export + Worker bundle outputs.
7. Targets GitHub Environments `staging` / `production` with required reviewers.

Until that rewrite lands, keep filenames:

- `.github/workflows/deploy.yml.disabled`
- `.github/workflows/deploy-staging.yml.disabled`

## Explicit non-goals of this document

- Enabling deploy workflows or mutating DNS.
- Committing Hyperdrive ids, account ids, API tokens, or other secrets.
- Claiming Cloudflare / Expo / E2E / revocation complete without live evidence.
- Retiring Socket.IO or `apps/web` before Expo browser E2E acceptance.
