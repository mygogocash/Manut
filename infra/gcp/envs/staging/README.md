# Manut Staging GCP Environment

Use this environment for Cloud Run migration rehearsal.

Suggested names:

- Cloud Run service: `manut-staging`
- Cloud Run migration job: `manut-staging-migrate`
- Cloud SQL instance: `manut-staging-postgres`
- Memorystore instance: `manut-staging-redis`
- Domain: `staging.manut.xyz`

Staging must pass the runbook smoke checks before creating the production
Cloud Build trigger.
