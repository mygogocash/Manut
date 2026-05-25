# Manut Production GCP Environment

Use this environment only after staging migration rehearsal passes.

Suggested names:

- Cloud Run service: `manut`
- Cloud Run migration job: `manut-migrate`
- Cloud SQL instance: `manut-postgres`
- Memorystore instance: `manut-redis`
- Domain: `manut.xyz`

Production cutover requires:

- final Railway database export
- Cloud SQL restore verification
- migration job success
- Cloud Run smoke success before DNS
- DNS rollback path back to Railway
- first-hour Cloud Logging watch
