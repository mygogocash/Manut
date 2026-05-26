# Manut GCP Production Launch Spec

**Status:** launch-readiness implementation contract  
**Date:** 2026-05-26  
**R-tier:** R1 for production data migration, Cloud Run deploy, and DNS cutover  
**Approval gate:** DNS cutover and any destructive database overwrite require
explicit operator approval in the launch window.

## Goal

Launch `https://manut.xyz` on the GCP Cloud Run production stack while
preserving existing Railway production workspaces and keeping Railway available
as the rollback target until Cloud Run is stable.

Success means:

- `manut.xyz` resolves to Cloud Run, not Railway.
- The Cloud Run production service returns `/info` JSON and GraphQL
  `serverConfig.initialized: true`.
- Production data from Railway Postgres has been restored into Cloud SQL
  `affine-pg` database `manut`.
- The approval-gated `manut-gcp-prod-deploy` trigger passes its generated-URL
  smoke before DNS changes.
- Post-cutover public smoke, login, workspace load, and Ask AI checks pass.
- Railway remains online but write-paused or ready for rollback during the
  first stability window.

## Scope In

- Production data migration plan from Railway Postgres to Cloud SQL.
- Cloud Run production deploy and generated-URL smoke gate.
- Cloudflare DNS cutover criteria.
- First-hour monitoring and rollback criteria.
- Script/doc changes that prevent a false-positive launch smoke.

## Scope Out

- Terraform conversion of the already-created GCP resources.
- Product feature changes.
- Rewriting OAuth clients unless a smoke test proves it is required.
- Deleting Railway resources before the post-cutover stability window.

## Current Production Facts

- Railway production is online for service `Manut` in workspace `GoGoCash`.
- `https://manut.xyz/info` currently returns `200` with Railway headers.
- GCP Cloud Run service `manut` is ready at
  `https://manut-idid7yszzq-as.a.run.app`.
- The current Cloud Run production database is initialized by Prisma
  migrations but not by Manut admin setup and not verified as a Railway data
  copy; GraphQL `serverConfig.initialized` is `false`.
- Cloud SQL instance `affine-pg` is `POSTGRES_16`, private IP `10.47.1.3`,
  database `manut`.
- Memorystore Redis `affine-redis` is ready at `10.47.0.3:6379`, auth
  disabled.
- Cloud Build triggers exist:
  - `manut-gcp-pr-ci`
  - `manut-gcp-main-staging`
  - `manut-gcp-prod-deploy` with approval required

## Data Model And Migration Contract

The data boundary is the whole Manut/AFFiNE PostgreSQL database, not selected
tables. The launch migration must preserve:

- Users and authentication identities.
- Workspaces, members, permissions, docs, blocks, and blobs metadata.
- AI chat histories and Manut feature tables.
- Prisma migration history.
- OAuth integration connection rows and encrypted token payloads.

Do not run a partial table-only import for launch. Partial imports are allowed
only for rehearsal diagnostics against disposable databases.

## Edge Cases

- **Split brain:** Railway and Cloud Run must not both accept writes against
  different production databases.
- **False-positive smoke:** SPA HTML from an API-like path must not count as a
  passing API smoke. Use `/info` JSON plus GraphQL `serverConfig`.
- **Uninitialized target:** `serverConfig.initialized: false` means the target
  database is not launch-ready.
- **Write drift:** Any writes accepted on Railway after the final dump are
  absent from Cloud SQL unless replayed.
- **Rollback data loss:** If Cloud Run accepts writes after DNS cutover, a DNS
  rollback to Railway loses those writes unless a replay plan exists.
- **Secret rotation:** Secret Manager values resolve at Cloud Run instance
  startup; deploy a new revision after secret changes.
- **OAuth redirects:** If the same public `manut.xyz` hostname is preserved,
  existing redirect URI shape should remain compatible; staging-specific
  callback URLs must still be configured separately.

## Tasks

### T1. Harden Cloud Run Smoke

**Intended behavior:** Smoke passes only when `/info` returns JSON with the
AFFiNE compatibility payload and GraphQL `serverConfig` returns JSON without
errors and with `initialized: true`.

**Affected files:**

- `scripts/gcp/smoke-test-cloud-run.sh`
- `scripts/gcp/validate-cloud-run-smoke.sh`
- `docs/GCP_CLOUD_RUN_RUNBOOK.md`

**Test names:**

- `cloud run smoke > given healthy JSON GraphQL config > then pass`
- `cloud run smoke > given HTML from an API-like path > then fail`
- `cloud run smoke > given serverConfig.initialized false > then fail`

**R-tier:** R2 script hardening; R1 when used as a production gate.

**Rollback:** revert the smoke-script commit. Do not proceed to cutover with
the weaker status-only smoke unless there is a separate manual GraphQL check.

### T2. Rehearse Data Restore

**Intended behavior:** A Railway Postgres dump restores into a disposable or
staging Cloud SQL database and passes row-count and browser smoke checks.

**Affected files:**

- `docs/GCP_CLOUD_RUN_RUNBOOK.md`
- `docs/AI_SESSION_HANDOVER.md`

**Test names:**

- `data restore rehearsal > given Railway dump > then Cloud SQL restore completes`
- `data restore rehearsal > given restored database > then critical row counts match`
- `data restore rehearsal > given restored staging > then login workspace and Ask AI smoke pass`

**R-tier:** R1 because it handles production data, even when restored to
staging.

**Rollback:** drop only the disposable rehearsal database. Do not overwrite the
current Railway production database.

### T3. Production Cutover

**Intended behavior:** A final Railway dump is restored to Cloud SQL `manut`,
the approved production trigger deploys Cloud Run, generated-url smoke passes,
then DNS moves to Cloud Run.

**Affected files:**

- Cloud Build trigger `manut-gcp-prod-deploy`
- Cloudflare DNS for `manut.xyz`
- `docs/AI_SESSION_HANDOVER.md`

**Test names:**

- `production cutover > given restored Cloud SQL database > then generated Cloud Run smoke passes`
- `production cutover > given DNS moved > then public smoke hits Cloud Run and passes`
- `production rollback > given public smoke fails > then DNS returns to Railway`

**R-tier:** R1, with R0-like handling for any destructive import option.

**Rollback:** point DNS back to Railway, keep Cloud Run running for diagnosis,
and replay or explicitly waive any writes accepted after cutover.

## Verification Strategy

Repo validation:

```bash
bash -n scripts/gcp/smoke-test-cloud-run.sh scripts/gcp/validate-cloud-run-smoke.sh
scripts/gcp/validate-cloud-run-smoke.sh
yarn prettier --check docs/GCP_PRODUCTION_LAUNCH_SPEC.md docs/GCP_CLOUD_RUN_RUNBOOK.md docs/GCP_CLOUD_RUN_MIGRATION_SPEC.md docs/AI_SESSION_HANDOVER.md
```

Live non-destructive validation:

```bash
gcloud config list --format='value(core.account,core.project,run.region)'
gcloud builds triggers list --project=affine-495114 --region=global
gcloud run services describe manut --project=affine-495114 --region=asia-southeast1
gcloud sql instances describe affine-pg --project=affine-495114
gcloud sql databases list --instance=affine-pg --project=affine-495114
gcloud redis instances describe affine-redis --project=affine-495114 --region=asia-southeast1
railway status
BASE_URL=https://staging.manut.xyz TIMEOUT_SECONDS=20 scripts/gcp/smoke-test-cloud-run.sh
```

Expected pre-data-restore production result:

```bash
BASE_URL=https://manut-idid7yszzq-as.a.run.app TIMEOUT_SECONDS=20 scripts/gcp/smoke-test-cloud-run.sh
```

This must fail while `serverConfig.initialized` is `false`. Treat a pass before
data restore as suspicious unless the operator intentionally completed setup
against the GCP production database.

## Launch Approval Points

1. Approve rehearsal data export/restore.
2. Approve final write pause on Railway.
3. Approve final production Cloud SQL restore.
4. Approve DNS cutover after generated-url smoke passes.
5. Approve Railway decommission only after the stability window.
