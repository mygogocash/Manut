# Staging Deployment Guide

This document explains how the staging environment is set up and how to use the dev branch deployment pipeline.

## Overview

The staging environment allows testing changes on the `dev` branch before merging to `main` (production). The deployment pipeline is automatically triggered on every push to the `dev` branch.

### Environments

| Environment | Trigger | Database | API URL | Web URL |
|---|---|---|---|---|
| **Staging** | Push to `dev` | staging-nexora | nexora-api-staging | nexora-web-staging |
| **Production** | Push to `main` | nexora | nexora-api | nexora-web |

## CI/CD Pipeline

### Staging Deployment (`deploy-staging.yml`)

Triggered on push to `dev` branch:

1. **PR Checks** (parallel)
   - `type-check`: TypeScript compilation
   - `lint`: ESLint + Next.js lint
   - `test`: Vitest (API + Web)

2. **Change Detection**
   - Detects if API or Web files changed
   - Skips expensive Docker builds if only docs/markdown changed

3. **API Deployment** (if API changed)
   - Sync the staging database schema with `pnpm db:push` (schema push, **not** `prisma migrate deploy` — see "Database Strategy" below)
   - Build Docker image
   - Push to Artifact Registry
   - Deploy to `nexora-api-staging` Cloud Run service

4. **Web Deployment** (if Web changed, depends on API)
   - Build Docker image with API staging URL
   - Push to Artifact Registry
   - Deploy to `nexora-web-staging` Cloud Run service

5. **Summary**
   - Reports deployment URLs
   - Shows which services were updated

## Required GitHub Secrets for Staging

To enable staging deployments, add these secrets to GitHub repository settings:

```
STAGING_DATABASE_URL          # PostgreSQL connection string (session pooler)
STAGING_DIRECT_URL            # PostgreSQL direct connection (for migrations)
STAGING_NEXT_PUBLIC_SUPABASE_URL
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY
STAGING_SUPABASE_SERVICE_ROLE_KEY
STAGING_NEXT_PUBLIC_APP_URL   # e.g., https://staging-intranet.example.com
```

### Example Secret Setup

```bash
# Add a secret to GitHub CLI
gh secret set STAGING_DATABASE_URL --body "postgresql://user:pass@host:port/db"
gh secret set STAGING_DIRECT_URL --body "postgresql://user:pass@host:5432/db"
# ... repeat for other staging secrets
```

## Cloud Run Services

### Staging Services

Created on GCP project `tbh-nexora` in region `asia-southeast1`:

- **nexora-api-staging**: API service
  - URL: `https://nexora-api-staging-*.asia-southeast1.run.app`
  - Memory: 512Mi
  - CPU: 1

- **nexora-web-staging**: Web service
  - URL: `https://nexora-web-staging-*.asia-southeast1.run.app`
  - Memory: 512Mi
  - CPU: 1

### Verify Services

```bash
gcloud run services list --project=tbh-nexora --region=asia-southeast1
```

## Workflow: Dev → Staging → Main

### Standard Flow

1. **Create feature branch** from `dev`
   ```bash
   git checkout dev
   git pull
   git checkout -b feat/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git push origin feat/my-feature
   ```

3. **Open PR to `dev`**
   - PR checks run automatically
   - Review and merge once approved

4. **Staging deployment triggers**
   - Automatically deploys to staging on push to `dev`
   - Check GitHub Actions for deployment status
   - Access staging URLs from workflow summary

5. **Test on staging**
   - Verify changes work end-to-end
   - Test database migrations if applicable

6. **Create PR from `dev` to `main`**
   - Code has been tested on staging
   - Production deployment happens on merge

### Bypass Staging (workflow_dispatch)

To manually trigger staging deployment without pushing to `dev`:

```bash
gh workflow run deploy-staging.yml --ref dev
```

## Troubleshooting

### Schema Push (`db:push`) Failures

Staging does **not** run `prisma migrate deploy` — the `Sync staging database schema`
step runs `pnpm db:push`, which diffs the Prisma schema against the staging DB and
applies the changes directly. If it fails:

1. Check the `Sync staging database schema` step in the failed run
   ```bash
   gh run list --workflow=deploy-staging.yml --limit=5
   gh run view <run-id> --log
   ```

2. `db:push` can prompt for / require data loss on a destructive change (dropped column,
   narrowed type). Resolve the schema in `packages/database/prisma/schema/*.prisma` so the
   push is non-destructive, or reset the staging DB if the data is disposable.

3. Push to `dev` to retry. Note that **data migrations (the SQL in
   `packages/database/prisma/migrations/`) are NOT applied on staging** — `db:push` only
   reconciles structure. Seed/backfill SQL that production gets via `migrate deploy` must be
   run by hand against the staging DB if you need it there.

### Service Not Deploying

If Cloud Run deployment fails:

1. Check Artifact Registry for image
   ```bash
   gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/tbh-nexora/nexora
   ```

2. Check Cloud Run service logs
   ```bash
   gcloud run services describe nexora-api-staging --region=asia-southeast1
   ```

3. Verify environment variables are set correctly

### Database Connection Issues

If the schema push fails due to database errors:

1. Verify `STAGING_DATABASE_URL` and `STAGING_DIRECT_URL` are correct (the push step
   reads `DATABASE_URL`/`DIRECT_URL` from the `STAGING_*` secrets)
2. Ensure the separate staging Supabase project exists and is accessible
3. Check Supabase project settings

## Database Strategy

### Separate staging Supabase project (current setup)

Staging runs against its **own** Supabase project, wired in via the `STAGING_DATABASE_URL` /
`STAGING_DIRECT_URL` secrets — fully isolated from production:

- Complete isolation; safe to run full test cycles
- No risk of colliding with production data

### Schema sync: `db:push`, not `migrate deploy`

This is the key difference from production:

| | Production (`deploy.yml`) | Staging (`deploy-staging.yml`) |
|---|---|---|
| Step | `prisma migrate deploy` | `pnpm db:push` |
| What runs | Applies versioned migration files in order, including their data/seed SQL | Diffs the Prisma schema against the DB and applies structural changes only |
| Migration history | Recorded in `_prisma_migrations` | Not recorded — push is stateless |
| Data migrations / backfills | Applied (they live inside migration files) | **NOT applied** — run by hand on staging if needed |

Because staging uses `db:push`, the staging DB always matches the *current* `schema/*.prisma`,
but it never replays the backfill/seed SQL embedded in migration files. If a feature depends on
a data migration (e.g. seeding default rows), that data will be present in production but absent
on staging until you run the SQL manually.

## CI/CD Configuration Files

- **Staging pipeline**: `.github/workflows/deploy-staging.yml`
- **Production pipeline**: `.github/workflows/deploy.yml`
- **PR checks**: `.github/workflows/pr-checks.yml`

## Rollback

### Rollback from Staging

To revert staging to previous version:

```bash
# Re-run previous workflow
gh run list --workflow=deploy-staging.yml --limit=10

# Trigger previous successful commit
git push origin dev --force  # Use with caution
```

### Emergency Rollback to Production

To rollback production:

```bash
# Push previous stable commit to main
git checkout <previous-commit>
git push origin main --force
```

## Monitoring

### Logs

- **GitHub Actions**: `https://github.com/<owner>/<repo>/actions`
- **Cloud Run logs**: `gcloud run services describe <service> --region=asia-southeast1`
- **Supabase logs**: Check Supabase project dashboard

### Metrics

Monitor in GCP Console:

- Cloud Run dashboard
- Artifact Registry images
- Cloud Logging for errors

## Status

The staging pipeline is live and in daily use:

1. ✅ Staging CI/CD pipeline (`deploy-staging.yml`) created
2. ✅ Staging database secrets (`STAGING_*`) configured in GitHub
3. ✅ Separate staging Supabase project configured
4. ✅ Deploying on every push to `dev`
