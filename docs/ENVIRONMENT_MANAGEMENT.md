# Environment Management Guide

This document explains how to manage environment variables across development, staging, and production environments.

## Overview

| Environment | Database | GitHub Secrets | Cloud Run Env Vars |
|---|---|---|---|
| **Development** (Local) | `.env.development` | N/A | N/A |
| **Staging** | `STAGING_*` secrets | Staging-specific secrets | `NODE_ENV=staging` |
| **Production** | Direct env vars | Production secrets | `NODE_ENV=production` |

## GitHub Secrets Organization

### Naming Convention

Secrets are organized by environment prefix:

```
# Production secrets (no prefix)
DATABASE_URL              → Production DB
DIRECT_URL                → Production DB direct connection
NEXT_PUBLIC_SUPABASE_URL  → Production Supabase
...

# Staging secrets (STAGING_ prefix)
STAGING_DATABASE_URL      → Staging DB
STAGING_DIRECT_URL        → Staging DB direct connection
STAGING_NEXT_PUBLIC_SUPABASE_URL
...

# Shared secrets (no prefix - used by both envs)
ANTHROPIC_API_KEY
GEMINI_API_KEY
CRON_SECRET
...
```

### Complete Secret List

#### Production-Only Secrets
```
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

#### Staging-Only Secrets
```
STAGING_DATABASE_URL
STAGING_DIRECT_URL
STAGING_NEXT_PUBLIC_SUPABASE_URL
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY
STAGING_SUPABASE_SERVICE_ROLE_KEY
STAGING_NEXT_PUBLIC_APP_URL
```

#### Shared Secrets (Both Environments)
```
ANTHROPIC_API_KEY
BOT_API_CLIENT_ID
BOT_API_BASE_URL
BOT_FX_CURRENCIES
BOT_FX_UNITS
CRON_SECRET
EMAIL_SERVICE_API_KEY
EMAIL_SERVICE_URL
FX_FALLBACK_API_KEY
FX_FALLBACK_BASE_URL
FX_FALLBACK_ENABLED
GEMINI_API_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_SHEETS_SA_KEY
INTEGRATIONS_TOKEN_KEY
LEAVE_NOTIFICATION_EXCLUDE
MARKETING_ANALYTICS_API_URL
MARKETING_ANALYTICS_BACKFILL_FROM
MARKETING_ANALYTICS_PARTNER_IDS
NEXT_PUBLIC_POSTHOG_KEY
OW_TRACTION_SHEET_ID
OW_TRACTION_SHEET_RANGE
POSTHOG_API_KEY
POSTHOG_HOST
POSTHOG_PERSONAL_API_KEY
POSTHOG_PROJECT_ID
VALIDATOR_MONITOR_GITHUB_TOKEN
WIF_PROVIDER
GCP_SERVICE_ACCOUNT
```

> `NEXT_PUBLIC_POSTHOG_KEY` is passed as a Docker **build-arg** to the web image (both
> `deploy.yml` and `deploy-staging.yml`); the matching `NEXT_PUBLIC_POSTHOG_HOST` build-arg is
> hard-coded to `/ingest` in the workflows (reverse-proxied), not read from a secret.

> **Marketing analytics API vars** (`nexora-api` only — wired in `deploy.yml`, not yet mirrored
> to `deploy-staging.yml`):
> - `MARKETING_ANALYTICS_API_URL` — base URL of the unauthenticated TBH Analytics API. When set,
>   the marketing dashboard ingest calls this API instead of the OW Google Sheet; when unset, the
>   sheet fallback (`OW_TRACTION_SHEET_ID`/`OW_TRACTION_SHEET_RANGE`) runs as before.
> - `MARKETING_ANALYTICS_PARTNER_IDS` — comma-separated `slug:uuid` pairs mapping each telco slug
>   (`gopay`, `dialog`, `ryze`, `telkomsel`, `okara`, `myim3`, `bima`, `u9`) to its partner UUID on
>   the analytics API. Real UUIDs come from the atlas telco/client seed; set the resolved values in
>   GitHub Secrets, not in source.
> - `MARKETING_ANALYTICS_BACKFILL_FROM` — earliest valid data date to backfill from, `YYYY-MM-DD`.

## Managing Secrets

### Adding New Secrets

#### 1. Via GitHub Web UI

1. Go to `Settings → Secrets and variables → Actions`
2. Click "New repository secret"
3. Add name (e.g., `STAGING_NEW_SECRET` or `NEW_SECRET`)
4. Add value
5. Click "Add secret"

#### 2. Via GitHub CLI

```bash
# Production secret
gh secret set DATABASE_URL --body "value"

# Staging secret
gh secret set STAGING_DATABASE_URL --body "value"

# Shared secret
gh secret set ANTHROPIC_API_KEY --body "value"
```

#### 3. Bulk Update Secrets

```bash
# Create a file with secrets
cat > secrets.txt << EOF
STAGING_DATABASE_URL|postgresql://user:pass@host/db
STAGING_DIRECT_URL|postgresql://user:pass@host:5432/db
STAGING_NEXT_PUBLIC_SUPABASE_URL|https://xxx.supabase.co
EOF

# Add each secret
while IFS='|' read name value; do
  gh secret set "$name" --body "$value"
done < secrets.txt
```

### Updating Existing Secrets

```bash
# Update is same as create
gh secret set SECRET_NAME --body "new_value"
```

### Listing Secrets

```bash
# List all secrets
gh secret list

# Filter by pattern
gh secret list | grep STAGING
gh secret list | grep DATABASE
```

## Workflow Configuration

### Production Deployment (deploy.yml)

Uses production secrets:

```yaml
--set-env-vars="...
|DATABASE_URL=${{ secrets.DATABASE_URL }}
|DIRECT_URL=${{ secrets.DIRECT_URL }}
|NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
|..."
```

### Staging Deployment (deploy-staging.yml)

Triggered on push to `dev`. Uses staging secrets:

```yaml
--set-env-vars="...
|DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}
|DIRECT_URL=${{ secrets.STAGING_DIRECT_URL }}
|NEXT_PUBLIC_SUPABASE_URL=${{ secrets.STAGING_NEXT_PUBLIC_SUPABASE_URL }}
|..."
```

> **Schema sync differs from prod.** Production runs `prisma migrate deploy` against the prod
> DB before the build; staging runs `pnpm db:push` against the separate staging Supabase
> project (`STAGING_DATABASE_URL`/`STAGING_DIRECT_URL`). `db:push` reconciles structure only —
> the seed/backfill SQL embedded in migration files is NOT replayed on staging. See
> `STAGING_DEPLOYMENT.md` → "Database Strategy".

Both use shared secrets:

```yaml
|ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
|GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
...
```

## Local Development (.env.development)

For local development, use `.env.development` (gitignored):

```bash
# Development database
DATABASE_URL=postgresql://user:pass@localhost:5432/nexora
DIRECT_URL=postgresql://user:pass@localhost:5432/nexora

# Development Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Shared services (use prod keys or local stubs)
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
```

Mirror to `apps/web/.env.development` for Next.js:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
API_URL=http://localhost:3001
```

## Adding New Environment Variables

### Step 1: Update CLAUDE.md

Document the new variable and where it's used:

```markdown
## New Environment Variable

- **Name**: `MY_NEW_VAR`
- **Used by**: API, Web
- **Type**: string
- **Required**: yes
- **Default**: none
- **Example**: `value`
```

### Step 2: Update Turbo Configuration

Edit `turbo.json` to include in global env list if it affects caching:

```json
{
  "globalEnv": [
    "NODE_ENV",
    "MY_NEW_VAR",
    ...
  ]
}
```

### Step 3: Add to .env Files

- `packages/database/prisma.config.ts` (if used by migrations)
- `.env.development` (local dev)
- Corresponding workflow files (as needed)

### Step 4: Create Staging Secret

```bash
gh secret set STAGING_MY_NEW_VAR --body "staging_value"
```

### Step 5: Create Production Secret

```bash
gh secret set MY_NEW_VAR --body "prod_value"
```

## Secrets Best Practices

### Do's ✅

- Use strong, unique secrets for each environment
- Rotate secrets regularly (quarterly)
- Use service accounts for third-party APIs
- Document what each secret is for
- Version control `.env.example` (without real values)

### Don'ts ❌

- Never commit actual `.env.production` to git
- Never share secrets in chat or email
- Don't reuse secrets across environments
- Don't commit secrets to git history (even in old commits)
- Don't log secrets in CI/CD output

## Rotation Schedule

### Database Credentials
- **Frequency**: Every 6 months or after staff changes
- **How**: Create new DB user, update secrets, revoke old user

### API Keys (Third-party)
- **Frequency**: Quarterly or per vendor requirements
- **How**: Generate new key, test, update secrets, revoke old

### CRON_SECRET
- **Frequency**: Annually or on security incident
- **How**: Generate new secret, update all cron endpoints

## Troubleshooting

### Secret Not Found in Workflow

```yaml
# Wrong - using undefined secret
${{ secrets.UNDEFINED_SECRET }}  # Returns empty string!

# Check what secrets are available
gh secret list | grep PATTERN
```

### Staging Using Wrong Database

Check workflow is using `STAGING_` prefixed secrets:

```bash
grep -n "secrets.STAGING_" .github/workflows/deploy-staging.yml
```

### Production Deploy Using Staging Secrets

Verify `deploy.yml` uses non-prefixed secrets:

```bash
grep -n "secrets\." .github/workflows/deploy.yml | grep -v STAGING
```

## Environment Setup (complete)

Both environments are live. The staging rollout (separate Supabase project + `STAGING_*`
secrets + `deploy-staging.yml`) is done; the steps below are kept as a reference for
re-provisioning or standing up another environment.

1. **Prepare the database** (separate Supabase project per environment)
2. **Create all `STAGING_*` secrets** in GitHub
3. **Wire the deploy workflow** (`deploy-staging.yml` for staging)
4. **Push to the trigger branch** (`dev` → staging, `main` → prod)
5. **Verify the environment works**
6. **Document the URLs** (in team wiki)

## Verification Checklist

When re-provisioning or auditing an environment, verify:

- [x] `deploy-staging.yml` workflow exists
- [x] All `STAGING_*` secrets added to GitHub
- [x] Staging Cloud Run services (`nexora-api-staging` / `nexora-web-staging`) created
- [x] Push to `dev` triggers staging deployment
- [x] Staging URLs accessible and functional
- [x] Staging schema synced via `pnpm db:push` (structure only — not migration/seed SQL)
- [x] Production secrets unchanged and working

## References

- GitHub Secrets Docs: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions
- GCP Cloud Run Env Vars: https://cloud.google.com/run/docs/configuring/environment-variables
- Project CLAUDE.md: See `Environment files` section
