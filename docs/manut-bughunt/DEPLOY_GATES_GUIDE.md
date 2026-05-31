# Manut Deploy Gates — Smoke + Migrations Guide

> Practical guide for the two remaining GCP gates after the build regression fix (#179).
> Grounded in the ACTUAL repo config, not generic GCP advice. Verified against
> `cloudbuild.manut-cloud-run.yaml`, `scripts/gcp/smoke-test-cloud-run.sh`, and
> `docs/manut-bughunt/MIGRATION_RUNBOOK.md` on `main`, 2026-05-31.

## TL;DR — the key realization

**The Cloud Build pipeline already runs migrations AND sets `ENABLE_MANUT_MODULE=true` for you.**
`cloudbuild.manut-cloud-run.yaml` has 5 ordered steps:

1. `build image` → 2. `push image` → 3. `upsert migration job` → 4. **`run migrations`** (runs `prisma migrate deploy` as the `manut-migrate` Cloud Run job) → 5. `deploy service` (sets `ENABLE_MANUT_MODULE=true` in `--set-env-vars`) → 6. `smoke service` (asserts the `Manut` feature is live).

So if a **full pipeline run goes green end-to-end, both of your gates are already satisfied.** The manual steps below are for (a) when you don't want to re-run the whole pipeline, (b) verifying state, and (c) debugging a red smoke.

Fixed facts (from the config):

- Project: `affine-495114` · Region: `asia-southeast1` · Cloud Run service: `manut` · Migration job: `manut-migrate`
- DB URL is the Secret Manager secret `manut-database-url` (NOT a plaintext value)
- Flag read by backend: `ENABLE_MANUT_MODULE` (legacy alias `ENABLE_SUPERFLOW_MODULE` still honored)

---

## Gate 1 — GCP smoke step (`_REQUIRED_SERVER_FEATURES: Manut,Copilot`)

### What it actually checks

`scripts/gcp/smoke-test-cloud-run.sh` resolves the live `manut` Cloud Run URL, then:

1. `GET /info` returns JSON with `compatibility`.
2. `POST /graphql` `query { serverConfig { version type initialized features } }` returns 200, no `errors`, `initialized: true`, and **`features` contains `"Manut"` and `"Copilot"`**.

The `Manut` feature appears in `serverConfig.features` **only when the module is loaded** — i.e. `ENABLE_MANUT_MODULE=true` AND the module boots without a DI crash. (CLAUDE.md §6 scar: a bad flip → DI crash → 502.)

### ⚠️ Important: smoke ≠ DB-drift check

The smoke only verifies the **feature is advertised**, which needs the flag + a clean module init. It does **NOT** query the `mn_*` tables, so it can pass even if the DB is drifted — but real control-plane queries would then 502 (that's Gate 2's job). Don't treat a green smoke as "DB is migrated."

### If smoke is RED — diagnose in this order

```bash
export CLOUDSDK_CORE_PROJECT=affine-495114
REGION=asia-southeast1 ; SVC=manut

# 1. Is the flag actually set on the running service?
gcloud run services describe "$SVC" --region="$REGION" \
  --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | grep -i manut

# 2. What does the live service report? (the exact thing smoke checks)
URL="$(gcloud run services describe "$SVC" --region="$REGION" --format='value(status.url)')"
curl -s -X POST "$URL/graphql" -H 'content-type: application/json' \
  --data '{"query":"query{serverConfig{initialized features}}"}' | python3 -m json.tool

# 3. If features is missing "Manut" but the flag IS set → the module failed to boot.
#    Pull the service logs and look for UnknownDependenciesException / UndefinedTypeError / Cannot read properties of undefined.
gcloud run services logs read "$SVC" --region="$REGION" --limit=100 | grep -iE 'error|exception|manut|nest' | tail -40
```

Interpretation:

- **Flag NOT set** → set it (manual fix below), or just re-run the pipeline (it sets it).
- **Flag set but `Manut` not in `features`** → the module crashed at init. This is the CLAUDE.md §6 DI / `@Field` class — check the logs for the exact class/field, fix in code, redeploy. (Our #176/#178 work already hardened these; a fresh occurrence means a new offender.)
- **`initialized: false`** → server booted but onboarding/admin not set up — separate concern.

### Manual fix — set the flag without re-running the whole build

```bash
gcloud run services update manut \
  --project=affine-495114 --region=asia-southeast1 \
  --update-env-vars=ENABLE_MANUT_MODULE=true,ENABLE_MANUT_ROUTINES=true
```

`--update-env-vars` merges (won't wipe the other env vars); `--set-env-vars` REPLACES the whole set — don't use `--set-env-vars` here or you'll drop Redis/URL config. This creates a new revision; wait for it to go healthy, then re-run the smoke:

```bash
BASE_URL="$(gcloud run services describe manut --region=asia-southeast1 --format='value(status.url)')" \
  REQUIRED_SERVER_FEATURES=Manut,Copilot \
  scripts/gcp/smoke-test-cloud-run.sh
```

> Per MIGRATION_RUNBOOK §7: do NOT flip the flag on prod **before** the DB is migrated (Gate 2). Flag-on + drifted-DB = control-plane queries 502 even though smoke passes.

---

## Gate 2 — `prisma migrate deploy` (the `mn_*` / social-analytics tables)

Full detail: `docs/manut-bughunt/MIGRATION_RUNBOOK.md`. Condensed operational path:

### The pipeline already does this (step 4 "run migrations")

A green Cloud Build run executes the `manut-migrate` Cloud Run job, which runs
`prisma migrate deploy --schema=./schema.prisma` against `manut-database-url`. Server startup migrations are OFF (`MANUT_RUN_STARTUP_MIGRATIONS=false`) by design — migrations are a discrete job step, not a boot side-effect.

### Run / re-run migrations manually (without a full build)

```bash
gcloud run jobs execute manut-migrate \
  --project=affine-495114 --region=asia-southeast1 --wait
```

`--wait` blocks until it finishes; check the exit and the job logs if it errors.

### Pre-flight (do these first — from RUNBOOK §2)

1. **Backup** (the embedding migration does a `DROP COLUMN`; harmless on fresh prod, back up anyway):
   `pg_dump --format=custom --no-owner --file=manut_predeploy_$(date +%Y%m%d%H%M).dump "$DATABASE_URL"`
2. **Confirm `vector` extension is installable** (needed by `20260520000000`):
   `SELECT * FROM pg_available_extensions WHERE name='vector';  -- expect 1 row`
3. **Check for a wedged ledger (P3009):**
   `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL;  -- expect 0 rows`
   If non-zero, resolve per RUNBOOK §3.1 (`prisma migrate resolve --applied <name>`) before re-running.

### Verify migrations landed (RUNBOOK §5)

```sql
-- ledger advanced to the last migration in the batch:
SELECT 1 FROM _prisma_migrations WHERE migration_name='20260520050000_add_mongo_ingestion_tables';  -- 1 row

-- gated tables exist (spot-check; full list = GATED_TABLES in the smoke spec):
SELECT to_regclass('public.mn_agent_roles'), to_regclass('public.social_analytics_posts'),
       to_regclass('public.mongo_ingestion_state');  -- none null

-- workspace columns:
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='workspaces' AND column_name IN ('plan','slug');  -- 2 rows
```

Or just run the boot guard spec against a migrated DB:
`yarn workspace @affine/server ava src/__tests__/manut/module-init-smoke.spec.ts`

### The one sensitive migration — `20260520000000_add_mn_agent_memory_embedding`

Idempotent and guarded (verified), but two **environmental** risks (RUNBOOK §4):

- needs the `vector` extension available + `CREATE` privilege for the deploy role;
- builds an `ivfflat` index with `lists=100` on an empty table → degenerate/untrained index. Harmless functionally, but once `mn_agent_memories` has real rows, `REINDEX INDEX "mn_agent_memories_embedding_idx";` to retrain.

### Hard "do NOT" (RUNBOOK §7)

- ❌ Never edit an applied file under `migrations/` or edit `schema.prisma` to "match" (CLAUDE.md R0). Forward-only.
- ❌ Never `prisma migrate reset` / `db push` / `migrate dev` against prod.
- ❌ Don't flip `ENABLE_MANUT_MODULE` before migrations verify.

---

## Correct ordering (both gates together)

1. **Migrate first** (Gate 2): run/verify `manut-migrate`, confirm tables present.
2. **Then ensure flag on** (Gate 1): the deploy step sets it; if you set manually, do it after step 1.
3. **Then smoke** passes because the feature is live AND the DB backs it.

A single green Cloud Build run does 1→2→3 in the right order automatically. The manual commands above are the fallback when you're fixing one gate in isolation.

## Rollback

- Service: `gcloud run services update-traffic manut --region=asia-southeast1 --to-revisions=<PREVIOUS_REVISION>=100` (instant revert to a known-good revision).
- DB: forward-only; restore the pre-flight `pg_dump`, or (on fresh prod) just turn `ENABLE_MANUT_MODULE` back off — the additive tables are inert when the module is gated off (RUNBOOK §8).
