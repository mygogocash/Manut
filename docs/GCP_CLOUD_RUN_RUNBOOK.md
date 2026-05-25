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
manut-redis-password
manut-google-oauth-client-secret
```

Add other OAuth and provider secrets using the same `manut-*` prefix. Do not
paste secret values into GitHub Actions logs, issue comments, chat, or docs.

Cloud Run reads these secrets at instance startup. After rotating a secret,
deploy a new revision.

## 4. Build And Deploy Staging

Run a staging build using the same config but different substitutions:

```bash
gcloud builds submit \
  --config=cloudbuild.manut-cloud-run.yaml \
  --substitutions=_SERVICE_NAME=manut-staging,_MIGRATION_JOB_NAME=manut-staging-migrate,_EXTERNAL_URL=https://staging.manut.xyz,_MIN_INSTANCES=0,_MAX_INSTANCES=5
```

The build must complete these steps in order:

1. Build `.docker/manut/Dockerfile.railway`.
2. Push an immutable `$SHORT_SHA` image to Artifact Registry.
3. Create or update the migration job.
4. Execute the migration job and wait for success.
5. Deploy the Cloud Run service with `MANUT_RUN_STARTUP_MIGRATIONS=false`.

Run staging smoke:

```bash
BASE_URL=https://staging.manut.xyz scripts/gcp/smoke-test-cloud-run.sh
```

Then manually verify:

- Sign in.
- Open one existing workspace.
- Open the Ask AI panel.
- Confirm model selector shows Gemini and Claude entries.
- Send one short message with Auto or Gemini.
- Send one Claude message if Vertex Anthropic quota is enabled.
- Confirm mobile Ask AI still opens and sends.

## 5. Data Migration Rehearsal

Use a rehearsal database before production cutover:

1. Export Railway Postgres.
2. Restore into staging Cloud SQL.
3. Run `manut-staging-migrate`.
4. Compare row counts for critical tables.
5. Smoke login, workspace open, docs list, AI chat history, and attachments.

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

## 6. Production Cutover

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

6. Deploy production Cloud Run:

```bash
gcloud builds submit --config=cloudbuild.manut-cloud-run.yaml
```

7. Smoke the Cloud Run URL before DNS.
8. Lower DNS TTL if not already lowered.
9. Point `manut.xyz` to Cloud Run.
10. Run public smoke:

```bash
BASE_URL=https://manut.xyz scripts/gcp/smoke-test-cloud-run.sh
```

11. Verify login, workspace load, Ask AI, and mobile.

## 7. Monitoring During First Hour

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

## 8. Rollback

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

## 9. Post-Cutover

After 24 to 48 hours of stable Cloud Run traffic:

- Remove Railway write access.
- Take final Railway backup.
- Archive Railway environment variable names, not values.
- Remove or pause Railway billing resources.
- Convert manual Cloud Build usage into a protected branch trigger.
- Add Terraform state and require plan review before infra changes.
