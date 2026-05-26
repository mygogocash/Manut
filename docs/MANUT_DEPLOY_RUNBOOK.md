# Manut Production Deploy Runbook

> **Audience:** the operator pushing Manut Wave 2 (PR #121) to production.
> **Scope:** the 25-commit, 199-file, 5-migration release that turns
> Manut into a cloud-first AI workspace. Same shape applies to every
> subsequent release — adjust the migration list and the smoke set.
> **R-tier:** R1. Touches auth, quota (critical path), GraphQL schema,
> copilot controller, five idempotent migrations.

---

## Table of contents

1. [Pre-deploy checklist](#1-pre-deploy-checklist)
2. [Secrets to populate](#2-secrets-to-populate)
3. [Migration order](#3-migration-order)
4. [Build steps](#4-build-steps)
5. [Image push to GAR](#5-image-push-to-gar)
6. [Railway redeploy](#6-railway-redeploy)
7. [Smoke test sequence](#7-smoke-test-sequence)
8. [Rollback procedure](#8-rollback-procedure)
9. [Post-deploy verification](#9-post-deploy-verification)
10. [Failure modes + recovery](#10-failure-modes--recovery)

---

## 1. Pre-deploy checklist

Run these in order. Each must be green before the next step.

- [ ] PR #121 merged to `main`, GitHub Actions `Manut CI` green.
- [ ] `manut-build.yml` produced an immutable
      `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:main-<sha>-<runid>`
      tag.
- [ ] Staging Postgres has the five Wave-2 migrations applied (see §3).
- [ ] `tests/affine-cloud/e2e/manut/*.spec.ts` green locally OR in CI.
- [ ] The current production tag is recorded in deploy notes (rollback target).
- [ ] On-call engineer pinged (launch window owner).
- [ ] Status page reads "All systems operational" (so we can detect
      a regression we caused vs an outage we walked into).

---

## 2. Secrets to populate

These are the new Wave-2 env vars. Existing Manut secrets (Google
OAuth, Vertex AI service account, AFFINE_SERVER_HTTPS, etc.) stay
unchanged.

Where to populate: Railway dashboard → `Manut` service → Variables.

### Required for full feature parity

| Variable                | Purpose                          | Failure mode if unset                                                                               |
| ----------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Pro tier checkout                | `/upgrade` button surfaces "Could not start checkout" via `FailedToCheckout` — page does not crash. |
| `STRIPE_WEBHOOK_SECRET` | Plan upgrade callbacks           | Stripe success redirect lands but the workspace plan never flips.                                   |
| `MANUT_PRO_PRICE_ID`    | Stripe price ID for the Pro plan | Resolver throws `FailedToCheckout` (same surface as above).                                         |
| `MIXPANEL_TOKEN`        | Telemetry events (B13)           | `trackEvent` becomes a silent no-op — no crash, no data.                                            |

### Optional / nice-to-have

| Variable                                | Purpose                           | Default behavior                                    |
| --------------------------------------- | --------------------------------- | --------------------------------------------------- |
| `MODAL_API_TOKEN`                       | `code_run` AI tool sandbox (E3.1) | Tool returns "Modal not configured" friendly error. |
| `EXA_API_KEY`                           | Web search via Exa (existing)     | Tool returns "Exa not configured" friendly error.   |
| `GITHUB_OAUTH_CLIENT_ID` / `..._SECRET` | GitHub connector (E2.1)           | Connect button surfaces "configure OAuth client".   |

> **Critical:** never paste secrets into chat, commits, or the Railway
> variable description field. Use the masked-value input only.

> **Verification:** every secret in this table can be smoke-tested via
> the `/api/server-config` GraphQL query, which surfaces booleans for
> "feature X is configured" without leaking the values themselves.

---

## 3. Migration order

Five new migrations land with this release. Prisma applies them in
filename order — match this order when running manually.

| #   | Migration                                            | What it adds                                                                                             | Idempotent?            |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | `20260520000000_add_mn_agent_memory_embedding`       | `embedding vector(1024)`, `scope`, `pinned`, `user_id` on `mn_agent_memories`. Memory MVP (pgvector).    | Yes (`IF NOT EXISTS`). |
| 2   | `20260520010000_add_mn_ai_budget_usage`              | `mn_ai_budget_usage` table + composite unique on `(workspace_id, period_start)`. AI budget cap tracking. | Yes.                   |
| 3   | `20260520020000_add_pinned_doc_id_to_chat_histories` | `pinned_doc_id` column on `ai_chat_histories`. Tabbed multi-chat.                                        | Yes.                   |
| 4   | `20260520030000_add_user_completed_onboarding`       | `completed_onboarding` boolean on `users`. Welcome wizard flow.                                          | Yes.                   |
| 5   | `20260520040000_add_workspace_plan`                  | `plan` column on `workspaces`. Pro tier signal.                                                          | Yes.                   |

### Running migrations

Railway's source-build mode runs `prisma migrate deploy` automatically
on every container boot via the entrypoint in `Dockerfile.railway`.
You should not need to run them by hand.

If you do need to run them manually (staging, GCE VM, troubleshooting):

```bash
# Against the test DB
yarn workspace @affine/server prisma migrate deploy

# Against production (only when Railway boot-migration is bypassed)
DATABASE_URL="postgresql://<creds>@<host>/<db>" \
  yarn workspace @affine/server prisma migrate deploy
```

**Expected output (success):**

```
Applying migration `20260520000000_add_mn_agent_memory_embedding`
Applying migration `20260520010000_add_mn_ai_budget_usage`
Applying migration `20260520020000_add_pinned_doc_id_to_chat_histories`
Applying migration `20260520030000_add_user_completed_onboarding`
Applying migration `20260520040000_add_workspace_plan`

5 migrations have been successfully applied.
```

**Failure modes:**

- Permission denied on the `pgvector` extension → grant the migration
  role `CREATE` on the schema, or run `CREATE EXTENSION IF NOT EXISTS
vector` as a superuser BEFORE applying.
- `relation already exists` → a previous deploy partially applied a
  migration. Resolve by inspecting `_prisma_migrations` and running
  `prisma migrate resolve --applied <name>`.

---

## 4. Build steps

Required because `Dockerfile.fullstack` does NOT bundle the app —
it copies pre-built `dist/` directories into the image. Skipping the
bundle step ships the previous bundle silently (CLAUDE.md §6 trap).

> Railway source-build mode handles this end-to-end via
> `Dockerfile.railway`. The steps below apply to legacy GAR/GCE flow
> and the manual `manut-deploy.yml` workflow_dispatch.

```bash
# Wipe stale .js next to .css.ts (CLAUDE.md §6 trap — but DO NOT widen
# to .d.ts, several modules ship hand-authored declarations).
rtk proxy find packages/frontend/core/src \
  packages/frontend/component/src \
  packages/frontend/i18n/src \
  blocksuite \
  -type f \( -name "*.js" -o -name "*.js.map" \) \
  -not -path "*/node_modules/*" -delete

# Bundle in this order. Server first so the rspack web worker
# resolution can pick up the freshly-emitted Rust binary references.
yarn affine bundle -p @affine/server      # ~1-3 min
yarn affine bundle -p web                 # ~3-7 min
yarn affine bundle -p admin               # only if admin changed
yarn affine bundle -p mobile              # only if mobile changed
```

**Expected outputs:**

- `packages/backend/server/dist/main.js` newer than the latest commit.
- `packages/frontend/apps/web/dist/index.html` present.
- Bundle sizes look sane (no single chunk over 50 MB — that's the
  bundle-explosion signal called out in CLAUDE.md §4).

**Pre-flight sanity check before docker buildx:**

```bash
# main.js newer than latest commit's timestamp?
ls -la packages/backend/server/dist/main.js
git log -1 --format=%ai
```

If `main.js` is older, re-bundle. Otherwise the docker image will ship
the stale code — silent regression.

---

## 5. Image push to GAR

```bash
docker buildx build --platform linux/amd64 \
  -f .docker/manut/Dockerfile.fullstack \
  -t asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.13.0 \
  --push .
```

**Pre-push smoke (catches the `UndefinedTypeError` startup crash class
documented in CLAUDE.md §6 NestJS DI traps):**

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  -e ENABLE_MANUT_MODULE=true \
  asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.13.0 \
  node ./dist/main.js
```

Watch for `Listening on http://...:3010` within 10 seconds. Any
`UndefinedTypeError`, `UnknownDependenciesException`, or `TypeError`
in that window means the build is broken — DO NOT push the tag to
prod. Roll back the bundle, fix, rebuild.

---

## 6. Railway redeploy

### Source-build mode (current production)

Railway auto-pulls `main` and rebuilds via `Dockerfile.railway`. No
manual step is needed if the GHA `Wait for CI` gate passes. The
`manut-railway-deploy.yml` workflow is **DISABLED** (renamed to
`.yml.disabled`); see CLAUDE.md §9 for the history.

**To force a redeploy:**

1. Open the Railway dashboard.
2. Select the `Manut` service.
3. Go to **Deployments**.
4. Find the commit you want to redeploy.
5. Click **Redeploy** (the three-dot menu).

> Do NOT call `serviceInstanceDeployV2` from CI — Railway returns the
> misleading "Not Authorized" trap in source-build mode (CLAUDE.md §6).

### GAR image-pull mode (rollback / legacy)

If Railway is reconfigured to pull images from GAR (e.g. for an
emergency rollback to an immutable SHA), use:

```bash
# Repoint :main to the desired SHA (Railway pulls :main fresh)
gcloud artifacts docker tags add \
  asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:main-<sha>-<runid> \
  asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:main
```

Then click **Redeploy** in the Railway dashboard — Railway resolves
`:main` fresh against GAR at deploy time.

---

## 7. Smoke test sequence

Run all six in order. Stop and roll back on the first red.

| #   | Spec                            | What it proves                                                  | Pass criterion            |
| --- | ------------------------------- | --------------------------------------------------------------- | ------------------------- |
| 1   | `manut/smoke.spec.ts`           | Server boots + migrations applied + web bundle hydrates         | All three sub-tests green |
| 2   | `manut/welcome-flow.spec.ts`    | New-user onboarding + workspace creation + Getting Started seed | Both tests green          |
| 3   | `manut/floating-chat.spec.ts`   | ⌘J flag-gated chat anchor                                       | Both tests green          |
| 4   | `manut/sidebar-tabs-v2.spec.ts` | 5-tab strip mounts behind flag, Search opens CMDK               | All three tests green     |
| 5   | `manut/storage-cap.spec.ts`     | 2 GB cap returns structured 402                                 | Both tests green          |
| 6   | `manut/ai-budget-cap.spec.ts`   | $5/mo AI cap row tracking                                       | Both tests green          |
| —   | `manut/upgrade-flow.spec.ts`    | `/upgrade` page + Stripe graceful degrade                       | Both tests green          |

Run:

```bash
yarn workspace @affine-test/affine-cloud e2e --grep "@manut"
```

> The `@manut` tag-prefix in the `test.describe` block (e.g.
> `test.describe('@manut welcome flow', ...)`) makes the entire
> suite filterable. Add new specs under this prefix to keep the
> launch sweep coherent.

Manual `/browse` confirmations the E2E doesn't yet cover:

- [ ] Open a workspace with `floating_ai_chat = true`; send a chat
      message; verify the response streams in.
- [ ] Stripe checkout end-to-end when `STRIPE_SECRET_KEY` is set
      (smoke-test card `4242 4242 4242 4242`).

---

## 8. Rollback procedure

> **One command. Memorise it.**

### Railway (source-build mode)

1. Open Railway dashboard → `Manut` service → **Deployments**.
2. Find the previous green commit.
3. Click **Redeploy** on that commit.

Rollback completes in 60-90s. Migrations are NOT rolled back
automatically — they're forward-only by design (CLAUDE.md §2.5 R0
rule: never drop an applied migration without a coordinated plan).
The Wave-2 migrations are all additive (`ADD COLUMN`, `CREATE TABLE`)
and backward-compatible with the pre-Wave-2 code.

### GCE VM (legacy)

Per CLAUDE.md §4 "Rollback path":

```bash
gcloud compute ssh affine-vm --project=affine-495114 --zone=asia-southeast1-a \
  --command='cd /srv/affine/compose && sudo cp compose.yml.pre-gogocash.bak compose.yml && sudo docker compose up -d'
```

> Backup files: `/srv/affine/compose/compose.yml.pre-<feature>.bak`.
> Each deploy creates a fresh one; never delete the previous backup.

---

## 9. Post-deploy verification

After the smoke set passes, run these in the live environment:

- [ ] `https://manut.xyz/info` returns JSON with `compatibility`.
- [ ] `https://manut.xyz/graphql` returns `serverConfig.type: "Affine"`,
      `serverConfig.initialized: true`, and the expected feature flags.
- [ ] `https://manut.xyz/graphql` GET returns 200 / 400 / 405
      (server alive).
- [ ] No `[ERROR]` lines in the Railway service logs for the last 5
      minutes.
- [ ] No `UnknownDependenciesException`, `UndefinedTypeError`, or
      `TypeError` in the boot window of the new deploy.
- [ ] React mount: load the landing page; `document.querySelector('#app').children.length > 0`.
- [ ] Migration row present: `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL` returns the five Wave-2 names.

Wait 30 minutes. Monitor:

- Mixpanel funnel: signup → workspace create → first chat.
- Railway logs for unhandled rejections.
- Sentry / error tracker for new error classes.

If 30 minutes pass with no new error class and no funnel cliff:
deploy is GREEN. Announce in #manut-prod.

---

## 10. Failure modes + recovery

| Symptom                                                                        | Likely cause                                                               | Recovery                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `UndefinedTypeError: ... explicit type for the "<field>" of "<class>"` on boot | Nullable `@Field` without `() => Type` (CLAUDE.md §6)                      | Roll back. Add explicit type to the offending `@Field`. Re-deploy.                          |
| `UnknownDependenciesException: Nest can't resolve dependencies of X (?)`       | `import type` on a DI target OR missing `@Injectable()` (CLAUDE.md §6)     | Roll back. Fix the import / decorator. Re-deploy.                                           |
| Blank page after deploy, no console errors, `#app` empty                       | Bundle-mismatch (CLAUDE.md §6 "bundle's worker filename includes version") | Wipe `dist/`, rebuild fresh, push, redeploy.                                                |
| `redirect_uri_mismatch` on Google sign-in                                      | `SERVER_URL` env var or OAuth client redirect URI drifted                  | Update either the GCP OAuth client or the `SERVER_URL` to match. No code change needed.     |
| `STORAGE_CAP` modal renders but `/upgrade` button does nothing                 | `STRIPE_SECRET_KEY` unset                                                  | Expected — verify via the friendly-error path. Populate the secret to enable real checkout. |
| Mixpanel events not landing                                                    | `MIXPANEL_TOKEN` unset                                                     | Expected silent no-op. Populate the secret and redeploy.                                    |
| `Migration failed: relation already exists`                                    | Partial migration apply                                                    | `prisma migrate resolve --applied <name>` then re-run `migrate deploy`.                     |
| `Migration failed: extension "vector" does not exist`                          | Postgres without pgvector                                                  | Run `CREATE EXTENSION IF NOT EXISTS vector` as superuser, then re-apply.                    |
| Caddy 502 on the front door                                                    | Server didn't start in time                                                | Check Railway boot logs for the first stack trace. Match against the table above.           |

---

## Appendix A — Commit + PR context

PR #121 — `feat/manut-wave2-cloud`. 25 commits, 199 files, ships:

- **Wave 2** cloud conversion: self-host stripped, hardcoded Affine
  deployment type, Free + Pro tier quota constants.
- **Wave 3** AI surface: floating chat (⌘J), welcome wizard,
  4-question onboarding.
- **Wave 4** memory MVP: pgvector + Vertex embeddings, prompt
  injection, chat mode + per-tool allowlist.
- **Wave 5** sidebar Phase 2: 5-tab strip, customize sections.
- **Wave 6** AI budget cap, quick actions, format selector.
- **M3 capstone:** ⌘P switcher, ⌘? / ⌘. overlays, audio cues, CMDK
  verbs, /manifesto, 404 personality, animated wordmark, image-gen
  via Vertex Imagen, code_run via Modal, Gmail/Calendar AI tools,
  Stripe Pro tier, Mixpanel telemetry, and this very runbook.

## Appendix B — useful one-liners

```bash
# Show the currently-deployed image tag
docker inspect $(docker ps -q --filter ancestor='asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash') --format '{{.Config.Image}}'

# Tail the Railway service logs
railway logs --service Manut --tail

# Count seeded prompts (CLAUDE.md §6c gate)
psql "$DATABASE_URL" -c "SELECT name FROM \"AiPrompt\" WHERE name IN ('Chat With AFFiNE AI', 'Auto Tag', 'Summary as title');"

# Check Wave-2 migration application status
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '2026052%' ORDER BY migration_name;"
```
