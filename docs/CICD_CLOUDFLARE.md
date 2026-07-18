# CI/CD — Cloudflare Workers + Assets

Manut web delivery is **Workers + Assets** from `apps/edge` (`wrangler deploy`),
not Cloudflare Pages. GitHub Actions owns deploy after Expo web export.

Companion: `docs/PRODUCTION_DEPLOY.md` (bindings, cutover order, ops blockers).

## Disable Cloudflare Pages auto-deploy

If a Pages project named `manut` (or any Pages project) is connected to this
repo with empty/wrong build settings:

1. Open Cloudflare Dashboard → Workers & Pages → that Pages project.
2. **Turn off automatic deployments** (and disconnect the Git integration if
   present). Pages is the wrong shape for this app.
3. Deploy only via GitHub Actions → `wrangler deploy` against
   `manut-intranet-edge-preview` / `manut-intranet-edge-staging` /
   `manut-intranet-edge-production`.

Do not use Pages as a substitute for the edge Worker.

## Workflows

| Git branch | Workflow | File | Trigger | GitHub Environment | Worker (`wrangler` env) |
| --- | --- | --- | --- | --- | --- |
| `preview` | Deploy Preview | `.github/workflows/deploy-preview.yml` | Push to `preview`; `workflow_dispatch` | `preview` | `manut-intranet-edge-preview` (`--env preview`) |
| `staging` | Deploy Staging | `.github/workflows/deploy-staging.yml` | Push to `staging`; `workflow_dispatch` | `staging` | `manut-intranet-edge-staging` (`--env staging`) |
| `main` | Deploy Production | `.github/workflows/deploy.yml` | Push to `main`; `workflow_dispatch` | `production` (require reviewers) | `manut-intranet-edge-production` (`--env production`) |

Branch → environment mapping is exact: `main` does **not** deploy staging or
preview; `preview` / `staging` do **not** deploy production.

Neither workflow mutates DNS. Neither invents Hyperdrive ids or `DATABASE_URL`.

### Pipeline (all three)

1. Fail closed if required Environment secrets/vars are missing.
2. Node `24.18.0`, pnpm `11.13.1`, `pnpm install --frozen-lockfile`.
3. `pnpm db:generate`
4. `pnpm --filter @manut/app export:web` (Expo public vars from Environment)
5. Worker `type-check` + `test`
6. `pnpm security:credentials` on `apps/app/dist`
7. `pnpm exec wrangler deploy --env preview|staging|production` from `apps/edge`

Actions are commit-SHA pinned to match `.github/workflows/pr-checks.yml`.

## GitHub Environment configuration (names only)

Create Environments **`preview`**, **`staging`**, and **`production`**. For
`production`, enable **required reviewers** before the deploy job can run.

### Secrets (per Environment)

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Manut-owned token with Workers deploy permission |
| `CLOUDFLARE_ACCOUNT_ID` | Manut Cloudflare account id |

### Variables (per Environment)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | HTTP API base baked into Expo web export |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Public auth project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `EXPO_PUBLIC_SOCKET_URL` | no | Socket.IO fallback origin |
| `EXPO_PUBLIC_REALTIME_ORIGIN` | no | Edge DO WebSocket origin when not same-origin |

### Not set by CI (configure in Cloudflare / wrangler)

Worker **secrets** (`EDGE_SIGNING_KEY`, R2 credentials) and **vars**
(`API_ORIGIN`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `TRUSTED_STORAGE_ORIGINS`, …)
are set with `wrangler secret put` / dashboard / `wrangler.jsonc` — not invented
in the workflow.

**Hyperdrive:** keep `"hyperdrive": []` in committed `wrangler.jsonc` until ops
provisions a real config id and binds it (dashboard or a dedicated config PR).
CI must never fabricate a Hyperdrive id or substitute a fake `DATABASE_URL`.

R2 buckets, Queues, and Durable Object migrations must exist (or be creatable
by the deploy token) for the named contracts in `apps/edge/wrangler.jsonc`
(`manut-intranet-uploads-preview`, `manut-intranet-uploads-staging`,
`manut-intranet-jobs-staging`, etc.).

## First green preview / staging run — ops checklist

- [ ] Pages auto-deploy disabled (see above)
- [ ] GitHub Environments `preview` and `staging` secrets + required Expo vars
- [ ] Preview / staging R2 / Queues / Worker name contracts provisioned
- [ ] Worker secrets/vars set per env (`EDGE_SIGNING_KEY`, auth JWKS, …)
- [ ] Push to `preview` (or `workflow_dispatch` on Deploy Preview)
- [ ] Push to `staging` (or `workflow_dispatch` on Deploy Staging)
- [ ] Confirm Workers `manut-intranet-edge-preview` /
  `manut-intranet-edge-staging` updated in Cloudflare

## Production enablement

1. Preview/staging deploys green and smoke-tested.
2. GitHub Environment `production` with **required reviewers** + secrets/vars.
3. Production Cloudflare resources provisioned (unique names from wrangler).
4. Merge/push to `main` (or **Actions → Deploy Production → Run workflow**).
   The job waits on Environment protection (required reviewers) before deploy.
5. DNS / custom domain only after separate approval (`PRODUCTION_DEPLOY.md`).
