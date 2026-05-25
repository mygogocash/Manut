# Manut GCP Cloud Run Migration Spec

**Status:** draft implementation contract  
**Date:** 2026-05-25  
**R-tier:** R1 for live cutover, R2 for the docs and scaffolding in this PR  
**Target project:** `affine-495114` (`602860445793`)  
**Target region:** `asia-southeast1` for app, database, Redis, and registry

## Goal

Move Manut production from Railway source-build hosting to a maintainable GCP
Cloud Run stack without changing product behavior for users.

Success means:

- `https://manut.xyz` serves from Cloud Run.
- The same Manut Docker image boots on Cloud Run.
- Prisma migrations run once per deploy through a Cloud Run Job, not inside
  every autoscaled web container.
- Cloud SQL, Memorystore, Secret Manager, Artifact Registry, Cloud Build, and
  Cloud Logging are the production control plane.
- Railway remains available as rollback during the cutover window and is
  removed only after Cloud Run has been stable.

## Scope In

- Cloud Run service template for the web app.
- Cloud Run Job template for `prisma migrate deploy`.
- Secret naming and environment contract.
- Cutover and rollback runbooks.
- Scale readiness for 1,000 users in 3 months and 10,000 users in 6 months.
- Startup migration opt-out via `MANUT_RUN_STARTUP_MIGRATIONS=false`.

## Scope Out

- Live GCP resource creation from this PR.
- DNS cutover.
- Database dump or restore.
- Rewriting Vertex AI provider configuration.
- Replacing Railway immediately after merge.
- GKE. Cloud Run is the right first platform until the app proves it needs
  Kubernetes-level control.

## Current Production Facts

- Production `manut.xyz` is currently served by Railway in GitHub source-build
  mode.
- The current Railway build uses `.docker/manut/Dockerfile.railway`.
- The runtime entrypoint bridges `PORT` to `AFFINE_SERVER_PORT`.
- Vertex config currently comes through `AFFINE_CONFIG_JSON_B64`.
- The existing entrypoint used to run `prisma migrate deploy` on container
  startup when `PORT` and `DATABASE_URL` were set. Cloud Run needs to disable
  that and run migrations as a job.

## Target Resource Model

| Resource                | Name                                                    | Notes                                                                      |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Cloud Run service       | `manut`                                                 | Public HTTP service for `manut.xyz`.                                       |
| Cloud Run Job           | `manut-migrate`                                         | Runs `./node_modules/.bin/prisma migrate deploy --schema=./schema.prisma`. |
| Artifact Registry repo  | `affine`                                                | Keeps current image path style: `affine-gogocash:<sha>`.                   |
| Cloud SQL PostgreSQL    | `manut-postgres`                                        | Private IP preferred. Use connection pooling before aggressive autoscale.  |
| Memorystore Redis       | `manut-redis`                                           | Standard tier for production.                                              |
| Secret Manager secrets  | `manut-*`                                               | Runtime secrets only, no plaintext in build logs.                          |
| Runtime service account | `manut-cloud-run@affine-495114.iam.gserviceaccount.com` | Grants only the APIs the app needs.                                        |
| Cloud Build trigger     | `manut-cloud-run-main`                                  | Uses `cloudbuild.manut-cloud-run.yaml` after staging passes.               |

## Environment Contract

Required Cloud Run service env vars:

| Variable                       | Source              | Notes                                                            |
| ------------------------------ | ------------------- | ---------------------------------------------------------------- |
| `AFFINE_SERVER_EXTERNAL_URL`   | plain env           | `https://manut.xyz` for prod.                                    |
| `AFFINE_SERVER_HTTPS`          | plain env           | `true`.                                                          |
| `AFFINE_SERVER_PORT`           | entrypoint          | Derived from `PORT`. Do not set manually.                        |
| `MANUT_RUN_STARTUP_MIGRATIONS` | plain env           | Set to `false` on Cloud Run service. Leave unset on Railway.     |
| `DATABASE_URL`                 | Secret Manager      | Cloud SQL PostgreSQL URL. Prefer private IP or Cloud SQL socket. |
| `AFFINE_CONFIG_JSON_B64`       | Secret Manager      | Short-term bridge for Vertex provider config.                    |
| `REDIS_SERVER_HOST`            | plain env or secret | Memorystore private IP.                                          |
| `REDIS_SERVER_PORT`            | plain env           | `6379` unless changed.                                           |
| `REDIS_SERVER_PASSWORD`        | Secret Manager      | Only if Redis auth is enabled.                                   |
| OAuth client secrets           | Secret Manager      | Google/LINE/Facebook/TikTok as configured.                       |

Long-term cleanup: replace `AFFINE_CONFIG_JSON_B64` with explicit provider
env vars or Secret Manager mounted JSON so Vertex config is not opaque base64.

## Tasks

### T1. Migration job split

**Intended behavior:** Cloud Run deployments run Prisma once through
`manut-migrate`, then deploy the web service with startup migrations disabled.

**Affected files:**

- `.docker/manut/entrypoint.railway.sh`
- `packages/backend/server/.env.example`
- `cloudbuild.manut-cloud-run.yaml`
- `scripts/gcp/validate-entrypoint-migration-gate.sh`

**Test names:**

- `entrypoint migration gate > given startup migration disabled > then prisma is not invoked`
- `entrypoint migration gate > given default Railway-compatible env > then prisma is invoked`

**R-tier:** R1 for production deploy behavior, R2 for the default-preserving
code change.

**Rollback:** unset `MANUT_RUN_STARTUP_MIGRATIONS=false` or revert this commit.
Railway default behavior remains unchanged because the variable is unset there.

### T2. Cloud Build deploy template

**Intended behavior:** Cloud Build can build the current Dockerfile, push to
Artifact Registry, update the migration job, run it, then deploy Cloud Run.

**Affected files:**

- `cloudbuild.manut-cloud-run.yaml`
- `docs/GCP_CLOUD_RUN_RUNBOOK.md`

**Test names:**

- `cloudbuild template > given staging substitutions > then build pushes an immutable sha image`
- `cloudbuild template > given migration job exists or not > then deploy path upserts it`

**R-tier:** R2 until a trigger is connected; R1 when used against prod.

**Rollback:** disable the Cloud Build trigger and point DNS back to Railway.

### T3. Scale readiness

**Intended behavior:** Manut has clear capacity guardrails and a measurable
path from 1,000 to 10,000 users.

**Affected files:**

- `docs/GCP_SCALE_READINESS.md`

**Test names:**

- `scale readiness > given Cloud Run max instances > then database connection budget is not exceeded`
- `scale readiness > given AI request growth > then Vertex quota and budget alerts exist before launch`

**R-tier:** R2 documentation now; R1 once autoscaling values are applied.

**Rollback:** lower Cloud Run max instances and AI rate limits.

## Edge Cases

- **Split brain:** Do not allow Railway and Cloud Run to both accept writes
  against different databases. During cutover, one database is writable.
- **Migration race:** Do not run `prisma migrate deploy` in every Cloud Run
  instance. Autoscaling can start many containers at once.
- **DB connection exhaustion:** Cloud Run max instances times app pool size can
  exceed Cloud SQL limits quickly. Set max instances conservatively and add
  pooling before raising limits.
- **WebSockets and streams:** AI streaming and websocket-like long requests are
  still subject to Cloud Run request timeouts. Clients must reconnect.
- **Vertex quota:** Gemini Dynamic Shared Quota can still return 429 under
  shared capacity pressure. Third-party MaaS models use standard quotas.
- **Secret rotation:** Secret env vars resolve at instance startup. Deploy a
  new revision after rotating a secret version.
- **DNS rollback:** Lower TTL before cutover. Keep Railway healthy until Cloud
  Run has passed at least 24 hours of production traffic.

## Verification Strategy

Local/repo validation:

- `sh -n .docker/manut/entrypoint.railway.sh`
- `bash -n scripts/gcp/*.sh`
- `scripts/gcp/validate-entrypoint-migration-gate.sh`
- `yarn prettier --check cloudbuild.manut-cloud-run.yaml docs/GCP_CLOUD_RUN_MIGRATION_SPEC.md docs/GCP_CLOUD_RUN_RUNBOOK.md docs/GCP_SCALE_READINESS.md packages/backend/server/.env.example`

Staging validation:

- Build and deploy to a staging Cloud Run service.
- Run `manut-migrate` against staging Cloud SQL.
- Run `BASE_URL=<staging-url> scripts/gcp/smoke-test-cloud-run.sh`.
- Confirm `/info`, `/api/server-config`, and `/api/version` return 200.
- Sign in, open a workspace, open Ask AI, send one Gemini request, send one
  Claude request, and verify no console error.

Production cutover validation:

- Confirm database restore row counts.
- Confirm Cloud Run revision is healthy before DNS.
- Flip DNS.
- Run HTTP smoke.
- Run AI chat smoke.
- Watch Cloud Logging for `@level:error`, `GraphQLService.gql`, Prisma, Redis,
  and Vertex 429/5xx signatures.

## Primary References

- Cloud Build deploys to Cloud Run: https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run
- Cloud Run secrets with Secret Manager: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run jobs: https://cloud.google.com/run/docs/create-jobs
- Cloud SQL from Cloud Run: https://cloud.google.com/sql/docs/postgres/connect-run
- Direct VPC egress: https://cloud.google.com/run/docs/configuring/vpc-direct-vpc
- Cloud Run max instances: https://cloud.google.com/run/docs/configuring/max-instances
- Cloud Run WebSockets: https://docs.cloud.google.com/run/docs/triggering/websockets
- Vertex AI throughput quota: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/resources/throughput-quota
