# Manut Cloud Run Runbook

**Audience:** operator moving Manut from Railway to GCP Cloud Run  
**Status:** staging-first procedure; do not run production cutover blindly  
**R-tier:** R1 for resource changes and DNS cutover

## 1. Preflight

Confirm the local and remote state:

```bash
git fetch origin
git status --short --branch
gh pr list --state open
```

Confirm GCP project:

```bash
gcloud config set project affine-495114
gcloud projects describe affine-495114 --format='value(projectNumber,projectId)'
```

Expected project number: `602860445793`.

Enable required APIs once:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  aiplatform.googleapis.com
```

## 2. Provision Base Infrastructure

Create or verify:

- Artifact Registry repo in `asia-southeast1`.
- Cloud SQL PostgreSQL instance with private IP.
- Memorystore Redis instance reachable through Direct VPC egress.
- Runtime service account `manut-cloud-run`.
- Secret Manager secrets for database URL, Vertex config, Redis password, and
  OAuth provider secrets.
- Cloud Run service `manut`.
- Cloud Run Job `manut-migrate`.

Use Terraform for the final version. Until Terraform is complete, use the
Cloud Build template as the operational source of truth.

## 3. Secret Contract

Required prod secrets:

```text
manut-database-url
manut-affine-config-json-b64
manut-affine-private-key
manut-google-oauth-client-id
manut-google-oauth-client-secret
manut-resend-api-key
```

Add other OAuth and provider secrets using the same `manut-*` prefix. Do not
paste secret values into GitHub Actions logs, issue comments, chat, or docs.
For PostgreSQL URLs, generate URL-safe passwords or percent-encode reserved
characters before writing `DATABASE_URL`; Prisma rejects malformed connection
strings before attempting a network connection.

Cloud Run reads these secrets at instance startup. After rotating a secret,
deploy a new revision.

## 4. Build And Deploy Staging

Run a staging build using the same config but different substitutions:

```bash
gcloud builds submit \
  --config=cloudbuild.manut-cloud-run.yaml \
  --substitutions=_SERVICE_NAME=manut-staging,_MIGRATION_JOB_NAME=manut-staging-migrate,_IMAGE_TAG="$(git rev-parse --short HEAD)-staging-$(date -u +%Y%m%d%H%M%S)",_DATABASE_URL_SECRET=manut-staging-database-url,_AFFINE_CONFIG_JSON_B64_SECRET=manut-staging-affine-config-json-b64,_AFFINE_PRIVATE_KEY_SECRET=manut-staging-affine-private-key,_GOOGLE_OAUTH_CLIENT_ID_SECRET=manut-staging-google-oauth-client-id,_GOOGLE_OAUTH_CLIENT_SECRET=manut-staging-google-oauth-client-secret,_RESEND_API_KEY_SECRET=manut-staging-resend-api-key,_EXTERNAL_URL=https://staging.manut.xyz,_REDIS_SERVER_HOST=10.47.0.3,_MIN_INSTANCES=0,_MAX_INSTANCES=5
```

The build must complete these steps in order:

1. Build `.docker/manut/Dockerfile.railway`.
2. Push an immutable `_IMAGE_TAG` image to Artifact Registry.
3. Create or update the migration job.
4. Execute the migration job and wait for success.
5. Deploy the Cloud Run service with `MANUT_RUN_STARTUP_MIGRATIONS=false`.

Run staging smoke. The script verifies `/info` returns JSON and GraphQL
`serverConfig.initialized` is `true`; a 200 HTML SPA fallback is not a pass:

```bash
BASE_URL=https://staging.manut.xyz scripts/gcp/smoke-test-cloud-run.sh
```

If the staging domain is not mapped yet, run the same smoke against the
generated Cloud Run URL first. Treat `serverConfig.initialized: false`, any
GraphQL `errors` payload, or any HTML response from a smoke endpoint as a
setup/data gate signal, not a successful API smoke.

Create or verify the Cloud Run domain mapping before adding DNS:

```bash
gcloud beta run domain-mappings create \
  --project=affine-495114 \
  --region=asia-southeast1 \
  --service=manut-staging \
  --domain=staging.manut.xyz

gcloud beta run domain-mappings describe staging.manut.xyz \
  --project=affine-495114 \
  --region=asia-southeast1 \
  --format='value(status.resourceRecords)'
```

Add exactly the DNS records returned by Cloud Run in Cloudflare. Do not point
`staging.manut.xyz` directly at the `run.app` hostname without the Cloud Run
domain mapping; TLS and host routing must agree on `staging.manut.xyz`.

Add `https://staging.manut.xyz/oauth/callback` to the Google OAuth client
before testing Google sign-in on staging.

Then manually verify:

- Sign in.
- Open one existing workspace.
- Open the Ask AI panel.
- Confirm model selector shows Gemini and Claude entries.
- Send one short message with Auto or Gemini.
- Send one Claude message if Vertex Anthropic quota is enabled.
- Confirm mobile Ask AI still opens and sends.

## 5. GCP-Owned CI/CD

After staging has passed one manual Cloud Build dry run, install the Cloud
Build triggers that move CI/CD ownership from GitHub Actions to GCP:

```bash
scripts/gcp/upsert-cloud-build-triggers.sh
```

This creates or updates:

| Trigger                  | Event             | Purpose                                    |
| ------------------------ | ----------------- | ------------------------------------------ |
| `manut-gcp-pr-ci`        | Pull request      | Cloud Build PR validation.                 |
| `manut-gcp-main-staging` | Push to `main`    | Build, migrate, deploy, and smoke staging. |
| `manut-gcp-prod-deploy`  | Manual + approval | Production Cloud Run deploy after cutover. |

The staging trigger smokes the generated Cloud Run URL by default because
managed TLS for `staging.manut.xyz` can lag behind DNS. After the custom domain
is `Ready=True`, update the trigger with:

```bash
GENERATED_STAGING_URL=https://staging.manut.xyz \
  scripts/gcp/upsert-cloud-build-triggers.sh
```

The production trigger intentionally leaves `_SMOKE_BASE_URL` unset before DNS
cutover. This makes `cloudbuild.manut-cloud-run.yaml` resolve the generated
Cloud Run service URL and prevents a false-positive smoke against the old
Railway-backed `manut.xyz`. After DNS cutover is complete, update the trigger
with:

```bash
PROD_SMOKE_BASE_URL=https://manut.xyz \
  scripts/gcp/upsert-cloud-build-triggers.sh
```

The recommended trigger service account is
`manut-cloud-build@affine-495114.iam.gserviceaccount.com`. To override it,
pass a different service account without pasting keys:

```bash
CLOUD_BUILD_SERVICE_ACCOUNT=another-sa@affine-495114.iam.gserviceaccount.com \
  scripts/gcp/upsert-cloud-build-triggers.sh
```

Rollback for any bad trigger is immediate:

```bash
gcloud builds triggers list --project=affine-495114 --region=global
gcloud builds triggers delete TRIGGER_ID --project=affine-495114 --region=global
```

Keep the existing GitHub Actions workflows enabled as fallback until both
`manut-gcp-pr-ci` and `manut-gcp-main-staging` have passed against real GitHub
events. Do not replace this with a production push trigger before the database
cutover and DNS rollback window are complete.

## 6. Data Migration Rehearsal

Use a rehearsal database before production cutover. This handles production
data, so keep dump files encrypted or access-controlled, avoid printing
connection strings, and delete local temporary copies after verification.

1. Confirm the linked Railway project and environment:

```bash
railway status
```

2. Confirm the Railway PostgreSQL major version and use a matching or newer
   `pg_dump` client. Do not restore a newer-major dump into an older-major
   Cloud SQL target. Current rehearsal evidence found Railway production on
   PostgreSQL 18.3, while existing `affine-pg` is PostgreSQL 16; final launch
   therefore needs a PostgreSQL 18 Cloud SQL production target.
3. Install a compatible PostgreSQL client locally or run one from a temporary
   trusted container. Do not print `DATABASE_URL`; pass it only through the
   child process environment.
4. Export Railway Postgres to an access-controlled local file or directly to a
   GCS object controlled by the launch operator. Example local shape:

```bash
mkdir -p .tmp/launch
railway run --service Postgres --environment production --no-local -- \
  pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  > .tmp/launch/railway-production.dump
```

5. Restore into a disposable rehearsal database first, not production
   `manut`. If using Cloud SQL import, upload the dump to a restricted GCS
   object and import from there. If using `pg_restore`, connect through an
   approved Cloud SQL path and do not echo credentials.
6. Run `manut-staging-migrate` or the rehearsal migration job after restore.
7. Compare row counts for critical tables.
8. Smoke login, workspace open, docs list, AI chat history, and attachments.
9. Delete local dump files and revoke any temporary object access.

Minimum row-count check:

```sql
select 'users' as table_name, count(*) from users
union all
select 'workspaces', count(*) from workspaces
union all
select 'docs', count(*) from docs
union all
select 'ai_chat_histories', count(*) from ai_chat_histories;
```

Adjust table names if upstream schema changes.

## 7. Production Cutover

Use a maintenance window.

1. Announce write pause.
2. Disable writes on Railway or stop the Railway service after confirming a
   final backup path.
3. Export Railway Postgres.
4. Restore into production Cloud SQL.
5. Run production migration job:

```bash
scripts/gcp/run-cloud-run-migration-job.sh
```

6. Deploy production Cloud Run with the approval-gated manual trigger:

```bash
gcloud builds triggers run manut-gcp-prod-deploy \
  --branch=main \
  --project=affine-495114 \
  --region=global
```

7. Approve the pending build in Cloud Build.
8. Smoke the Cloud Run URL before DNS:

```bash
BASE_URL=https://manut-idid7yszzq-as.a.run.app \
  TIMEOUT_SECONDS=120 \
  scripts/gcp/smoke-test-cloud-run.sh
```

This must pass with GraphQL `serverConfig.initialized: true` before DNS moves.

9. Lower DNS TTL if not already lowered.
10. Point `manut.xyz` to Cloud Run.
11. Update the trigger to smoke the public domain:

```bash
PROD_SMOKE_BASE_URL=https://manut.xyz \
  scripts/gcp/upsert-cloud-build-triggers.sh
```

12. Run public smoke:

```bash
BASE_URL=https://manut.xyz scripts/gcp/smoke-test-cloud-run.sh
```

13. Verify login, workspace load, Ask AI, and mobile.

## 8. Monitoring During First Hour

Watch Cloud Run:

```bash
gcloud run services describe manut --region=asia-southeast1
gcloud run services logs read manut --region=asia-southeast1 --limit=200
```

Watch for:

- HTTP 5xx.
- `GraphQLService.gql`.
- Prisma errors.
- Redis connection errors.
- Vertex 429 or 5xx.
- repeated container starts.
- request timeout messages from AI streaming.

Cloud Monitoring alerts required before real cutover:

- 5xx rate above 1 percent for 5 minutes.
- p95 latency above 3 seconds for 10 minutes.
- Cloud SQL CPU above 70 percent for 15 minutes.
- Cloud SQL connections above 70 percent of cap.
- Redis memory above 70 percent.
- Vertex 429s above baseline.
- Cloud Run instance count at max for 10 minutes.

## 9. Rollback

Rollback is DNS-first.

1. Stop Cloud Run traffic by setting max instances to 0 only if the app is
   corrupting data. Otherwise leave it running for diagnosis.
2. Point DNS back to Railway.
3. Restore Railway environment variables if changed.
4. Re-enable Railway service.
5. Confirm `https://manut.xyz/info` returns 200 from Railway.

Data warning: if Cloud Run accepted writes after cutover, rolling back to
Railway loses those writes unless they are replayed. Keep the write window
small until Cloud Run is stable.

## 10. Post-Cutover

After 24 to 48 hours of stable Cloud Run traffic:

- Remove Railway write access.
- Take final Railway backup.
- Archive Railway environment variable names, not values.
- Remove or pause Railway billing resources.
- Retire the GitHub Actions deploy workflows after the GCP triggers have a
  green history.
- Add Terraform state and require plan review before infra changes.
