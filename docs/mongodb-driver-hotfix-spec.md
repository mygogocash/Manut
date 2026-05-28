# MongoDB Driver Hotfix Spec

## Goal

Stop the live MongoDB ingestion settings route from crashing with
`INTERNAL_SERVER_ERROR` because the production server runtime cannot import the
MongoDB driver.

## Scope In

- `@affine/server` production dependencies.
- A focused server test that proves `mongodb` is importable from the server
  package.
- Server rebuild, fullstack image rebuild, Cloud Run deploy, and live smoke
  checks.

## Scope Out

- MongoDB ingestion feature redesign.
- Database schema changes.
- Frontend layout changes.

## Risk

R1. This changes the production server image dependency graph and deploys a new
Cloud Run revision. Rollback is to update Cloud Run back to the previous image.

## Verification

- Focused AVA test for the MongoDB driver import.
- `yarn affine bundle -p @affine/server`.
- Cloud Build image check confirms `mongodb` resolves inside the image.
- Live Cloud Run logs no longer show `MongoDB driver is not installed`.
