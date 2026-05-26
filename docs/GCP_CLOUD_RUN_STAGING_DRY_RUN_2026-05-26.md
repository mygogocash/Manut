# Manut Cloud Run Staging Dry Run - 2026-05-26

## Scope

This dry run deployed Manut to GCP Cloud Run staging in project
`affine-495114` without changing production DNS or Railway production traffic.

## GCP Resources

- Project: `affine-495114` (`602860445793`)
- Region: `asia-southeast1`
- Artifact Registry repo: `affine`
- Cloud SQL instance: `affine-pg`
- Staging database: `manut_staging`
- Redis instance: `affine-redis` (`10.47.0.3:6379`, auth disabled)
- Runtime service account:
  `manut-cloud-run@affine-495114.iam.gserviceaccount.com`
- Cloud Run service: `manut-staging`
- Cloud Run migration job: `manut-staging-migrate`

## Template Fixes Found During Dry Run

- Escaped shell-local variables in `cloudbuild.manut-cloud-run.yaml` so Cloud
  Build does not treat `$IMAGE` or `${COMMON_FLAGS[@]}` as substitutions.
- Added `_IMAGE_TAG` because `$SHORT_SHA` is empty for local
  `gcloud builds submit` source uploads.
- Set `entrypoint: gcloud` on Cloud SDK steps that execute migrations and
  deploy the service.
- Added missing runtime secrets for `AFFINE_PRIVATE_KEY`,
  `GOOGLE_OAUTH_CLIENT_ID`, and `RESEND_API_KEY`.
- Removed forced `REDIS_SERVER_PASSWORD` because the staging Memorystore
  instance has auth disabled.
- Updated the smoke script to fall back to Ruby when `curl` is unavailable.
- Rotated the staging database password to a URL-safe value after Prisma
  rejected the first generated URL.

## Verification

Full Cloud Build template run:

- Build ID: `2d5dab56-e0b9-46cc-9f23-f1e67026aba8`
- Image:
  `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:2eb7f63c3-staging-20260526012921`
- Status: `SUCCESS`

Migration job:

- Execution: `manut-staging-migrate-9tcvb`
- Status: completed successfully in `13.77s`
- Succeeded tasks: `1`

Cloud Run service:

- URL: `https://manut-staging-idid7yszzq-as.a.run.app`
- Latest ready revision: `manut-staging-00002-8x5`
- Traffic: `100%` to latest revision
- Ready condition: `True`

HTTP smoke:

```text
/info 200
/api/server-config 200
/api/version 200
```

Log scan:

- No Cloud Run service errors after the successful template deployment.
- No Cloud Run migration-job errors after the successful template deployment.

## Follow-Ups Before Production Cutover

- Map and verify `staging.manut.xyz`; the service currently works on the
  generated Cloud Run URL while `AFFINE_SERVER_EXTERNAL_URL` is set to
  `https://staging.manut.xyz`.
- Add the staging redirect URI to the Google OAuth client before browser login
  testing on the staging domain.
- Clean up the Prisma OpenSSL warning in the Docker image so the production
  image does not rely on Prisma's OpenSSL fallback.
- Add Terraform for the resources created manually during this dry run.
- Add Cloud Monitoring alerts before any production DNS cutover.
- Rehearse data import from Railway Postgres into a fresh Cloud SQL database
  before production cutover.
