# Cloudflare migration checklist (Phase E)

Ops-facing checklist for fresh Manut-owned Cloudflare / CI cutover.
**This document does not authorize provisioning or deploy.**

Deploy-readiness matrix, env/binding names, cutover order, and local dry-run
commands: **`docs/PRODUCTION_DEPLOY.md`**.

## Deploy CI vs DNS cutover

- [x] GitHub Actions Workers deploy path enabled:
      `.github/workflows/deploy-staging.yml` (push `main`/`staging` + dispatch)
      and `.github/workflows/deploy.yml` (dispatch + Environment `production`).
      See `docs/CICD_CLOUDFLARE.md`.
- [ ] **Turn off Cloudflare Pages auto-deploy** for Pages project `manut` (or
      any Pages project on this repo). Correct shape is Workers + Assets.
- [ ] Configure GitHub Environments `staging` / `production` secrets and Expo
      public vars (names in `docs/CICD_CLOUDFLARE.md`) — workflows fail closed
      until present.
- [ ] Do not mutate DNS or touch `manut.xyz` until a separately approved
      cutover; CI deploy ≠ traffic cutover.
- [ ] Do not invent or commit Hyperdrive ids, account ids, API tokens, or
      other provider secrets. Record only names, paths, or HMAC fingerprints
      in private cutover evidence. Keep `hyperdrive: []` until ops binds a
      real id.

## Code-ready vs ops-blocked (summary)

| Item | State |
| --- | --- |
| Expo web export + Worker type-check / test / `wrangler deploy --dry-run` | **Code-ready** (see `PRODUCTION_DEPLOY.md`) |
| Wrangler naming contracts + empty `hyperdrive: []` | **Code-ready** |
| Fresh Manut Cloudflare / Hyperdrive / R2 / Queue / secrets | **Ops-blocked** |
| `E2E_*` dedicated project, Expo org, GitHub Pro, DNS, revocation | **Ops-blocked** |

**NOT ready for DNS / production traffic until** Phase E resources exist,
staging Worker deploy is green, and a separate approved cutover authorizes
custom domains. CI workflows may fail closed until secrets exist.

## 1. Hyperdrive id + binding

Names and steps only — no live create from this branch.

- [ ] Create a Manut-owned Hyperdrive config against the authoritative Postgres
      (separate config per environment that needs edge Postgres).
- [ ] Bind in `apps/edge/wrangler.jsonc`:
      `hyperdrive: [{ "binding": "HYPERDRIVE_DATABASE", "id": "<manut-hyperdrive-id>" }]`
      (`hyperdrive: []` remains empty until a real id is supplied).
- [ ] Optional local: `localConnectionString` or
      `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_DATABASE`.
- [ ] Set Worker var `ENABLE_HYPERDRIVE_BOUNDARY=true` only after the binding
      exists; fail closed if the flag is on without `HYPERDRIVE_DATABASE`.
- [ ] Keep `API_ORIGIN` for Express fallback routes and auth JWKS.
- [ ] Never put a client `DATABASE_URL` into the Worker for business queries.

## 2. `TRUSTED_STORAGE_ORIGINS`

- [ ] Set comma-separated HTTPS origins on the Worker (wrangler vars /
      secrets per env) for FileUpload receipt provenance on the Hyperdrive
      path (see `apps/edge/src/trusted-storage.ts`).
- [ ] Empty / unset = managed receipt writes stay proxied to Express
      (documented in `.env.example`).
- [ ] Do not hard-code inherited storage project hosts; use Manut-owned R2 /
      custom hosts in `TRUSTED_STORAGE_ORIGINS` only.
- [ ] Confirm bucket allowlist + purpose/ownership registry still apply
      server-side after origins are set.

## 3. `EDGE_REALTIME_*` + messageBus → Durable Object bridge

- [ ] Worker secret `EDGE_SIGNING_KEY` (≥32 chars), unique per environment.
- [ ] Express / API: `EDGE_REALTIME_ORIGIN` = Worker origin that owns the
      channel Durable Object rooms.
- [ ] Express / API: `EDGE_REALTIME_BRIDGE_SECRET` **must match** Worker
      `EDGE_SIGNING_KEY`.
- [ ] Expo client: `EXPO_PUBLIC_REALTIME_ORIGIN` (or equivalent) when live
      chat should prefer edge DO rooms (`channel:{channelId}`).
- [ ] Until origin + bridge secret are set, Socket.IO `/messages` remains
      the fallback — do not delete Socket.IO in this phase.
- [ ] Verify membership checks on join and messageBus fan-out after bridge
      activation (local Worker tests + focused messages bridge tests).

## 4. Queues / Workflows / R2 / Worker env uniqueness

Each of local, development, preview, E2E, staging, and production must use
**distinct** Manut-owned names and secrets (see `apps/edge/wrangler.jsonc`
naming contracts).

- [ ] Worker name unique per environment.
- [ ] R2 bucket unique per environment (private by default; CORS only for
      approved app origins).
- [ ] `JOB_QUEUE` + `DEAD_LETTER_QUEUE` (+ ledger DO) unique per environment;
      idempotency preserved.
- [ ] Workflow / Container stubs get Manut-owned bindings when authorized;
      missing capability fails closed (no inherited substitute).
- [ ] Hyperdrive config id unique where edge Postgres is enabled.
- [ ] Rotate `EDGE_SIGNING_KEY`, R2 keys, and other Worker secrets per env;
      never share with inherited accounts or across environments.

## 5. `E2E_*` secrets + dedicated project

- [ ] Dedicated `manut-intranet-e2e` Postgres (+ auth fixtures) only —
      not shared with staging/production. Prefer Cloudflare Access–issued
      test credentials over inherited Supabase project names.
- [ ] Configure the approved E2E secrets (names only in Git). Until the E2E
      gate is renamed, the fail-closed set remains:
      - `E2E_SUPABASE_URL` (legacy name — replace when E2E harness drops Supabase)
      - `E2E_SUPABASE_ANON_KEY`
      - `E2E_SUPABASE_SERVICE_ROLE_KEY`
      - `E2E_DATABASE_URL`
      - `E2E_DIRECT_URL`
- [ ] Independent dedicated-project marker / guard remains enforced; never
      bypass for CI convenience.
- [ ] Authenticated Playwright runs only against that project.

## 6. GitHub Pro / CodeQL Ruby

- [ ] Upgrade `mygogocash` org to GitHub Pro (or Team) so private-repo branch
      protection / rulesets can require `Validate` on `main` (Free returns 403).
- [ ] Code scanning default setup: drop **Ruby** (tree has no Ruby sources;
      Analyze (ruby) fails with “could not process any code written in Ruby”).
      Keep `javascript-typescript` (and other used languages) only.
- [ ] After settings change, confirm CodeQL JS/TS + Secret scan + Validate
      path without inventing workflow bypasses.

## 7. Retirement sequence (after Expo browser E2E)

Do **not** reorder. Do **not** delete Socket.IO or `apps/web` before the
gates below.

1. **Expo browser E2E acceptance** for each route leaving Next parity
   (`docs/ROUTE_DISPOSITION.md` → accepted).
2. **Prefer edge DO live rooms** everywhere messages need realtime
   (`EDGE_REALTIME_*` + client origin configured and verified).
3. **Retire Socket.IO `/messages` fallback** only after edge live path is
   the sole production path and E2E covers it.
4. **Shrink Express** — leave only routes still proxied / not yet
   Hyperdrive-native; keep authz authoritative on the server.
5. **Remove Next.js `apps/web`** and web-only dependencies only after full
   approved Expo web parity + browser E2E (Phase C).
6. **Deploy / DNS cutover** remains a separate approved operation after
   Phase E evidence — still not from unchecked enablement of disabled
   workflows in this branch.

## Related code / docs (read-only pointers)

- `docs/PRODUCTION_DEPLOY.md` — deploy-readiness report + cutover runbook
- `docs/CICD_CLOUDFLARE.md` — GitHub Actions Workers deploy + Pages off note
- `docs/CURSOR_HANDOFF.md` — Phase E narrative and blockers
- `docs/CREDENTIAL_BOUNDARY.md` — clean provider rules
- `apps/edge/wrangler.jsonc` — env naming + empty `hyperdrive: []`
- `.env.example` / `apps/app/.env.example` — placeholder env names
- `scripts/e2e/README.md` — E2E secret contract
- `.github/workflows/deploy-staging.yml` / `deploy.yml` — Workers + Assets CI
