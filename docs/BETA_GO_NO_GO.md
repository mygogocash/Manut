# Manut Beta Go/No-Go

> Purpose: final sign-off sheet for inviting beta testers.
> Fill this out for the exact commit, image, Cloud Run revision, migration job,
> and smoke evidence that will be used by beta testers.

## Candidate

This table is intentionally still `TBD` until the exact committed branch,
Cloud Run revision, migration job, and rollback target are selected for beta
testers.

| Field                    | Value               |
| ------------------------ | ------------------- |
| Date                     | TBD                 |
| Commit                   | TBD                 |
| Branch                   | `main`              |
| Image tag or digest      | TBD                 |
| Cloud Run service        | `manut`             |
| Cloud Run revision       | TBD                 |
| Cloud Run migration job  | `manut-migrate`     |
| Production URL           | `https://manut.xyz` |
| Rollback target revision | TBD                 |
| Primary owner            | TBD                 |
| Secondary owner          | TBD                 |

## Current Cloud Run readiness snapshot

| Check                 | Required launch evidence                                                                                        | Status  | Next action                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| Candidate CI          | Green `Manut CI`, `Manut Beta Security Gate`, and bundle/build evidence on the candidate commit.                | Pending | Record workflow URLs for the exact commit above.                                                 |
| Cloud Run revision    | `gcloud run services describe manut --region asia-southeast1 --project affine-495114` shows the intended image. | Pending | Record the revision name, image tag/digest, traffic split, and service URL.                      |
| Migration job         | `manut-migrate` Cloud Run job completed with exit code 0 for the candidate image.                               | Pending | Record job execution id and log link.                                                            |
| Public smoke          | `scripts/gcp/smoke-test-cloud-run.sh` passes against `https://manut.xyz` or the generated Cloud Run URL.        | Pending | Attach smoke command, timestamp, and result.                                                     |
| Cloud Run logs        | No new P0/P1 error class, GraphQL startup crash, migration failure, or sustained 5xx in the last 30 minutes.    | Pending | Check Cloud Run service and job logs before sending invites.                                     |
| Historical beta fixes | 2026-05-23 `codex/fix-beta-blockers` closed AI UI, quota serialization, analytics cron, and workflow issues.    | Closed  | Historical source data only; do not use the old Railway deployment/log evidence as launch proof. |

## Required gates

| Gate                     | Required evidence                                                       | Status  | Notes                                                                                           |
| ------------------------ | ----------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| Manut CI                 | Green workflow URL                                                      | Pending | Candidate commit must pass.                                                                     |
| Manut Beta Security Gate | Green workflow URL                                                      | Pending | Candidate commit must pass actionlint, Semgrep, dependency, and custom security checks.         |
| Cloud Run health         | `/info` 200, revision healthy, and intended image receiving traffic     | Pending | Railway deployment ids are historical only and are not valid launch evidence.                   |
| GraphQL smoke            | Authenticated workspace query succeeds; no new 5xx/GraphQL errors       | Pending | Check Cloud Run service logs.                                                                   |
| AI chat smoke            | Floating and full chat send/receive works; provider errors are friendly | Pending | Include desktop and mobile screenshots if UI changed.                                           |
| Storage/upload smoke     | Storage usage loads; quota and upload failure states are usable         | Pending | Covers known storage-loading concern.                                                           |
| Auth/onboarding smoke    | Signup/login, workspace creation, sign-out, invite accept               | Pending | Use a fresh beta tester account.                                                                |
| Production logs          | No new P0/P1 error class in last 30 minutes                             | Pending | Recheck Cloud Run service/job logs and Sentry evidence.                                         |
| Risk register            | No open P0/P1; P2 blockers explicitly waived or fixed                   | Pending | Code blockers in `BETA_RISK_REGISTER.md` are closed; production smoke evidence still required.  |
| Rollback                 | Rollback target and owner confirmed                                     | Pending | Owner can route traffic back to the previous Cloud Run revision within 10 minutes when DB-safe. |

## Decision

Launch posture: `NO-GO`

Reason:

- Current Cloud Run revision, image, migration-job, log, and smoke evidence are
  not recorded in this sheet yet.
- Candidate CI and Beta Security Gate evidence are not recorded for the exact
  launch commit.
- Production smoke/log evidence must be collected after the candidate Cloud Run
  revision is deployed.
- Rollback owner/target and beta tester smoke account remain unset.

## Pending launch readiness

1. Select the exact candidate commit and require green `Manut CI`,
   `Manut Beta Security Gate`, and bundle/build evidence.
2. Deploy through the approved GCP Cloud Build / Cloud Run path and record the
   image tag or digest, Cloud Run revision, service URL, migration job
   execution, rollback revision, primary owner, and secondary owner.
3. Recheck Cloud Run service and job logs for no analytics-cron
   `NOT_IMPLEMENTED`, no GraphQL Int overflow, no new P0/P1 error class, and
   no sustained 5xx.
4. Run authenticated beta smoke: GraphQL workspace query, floating/full AI
   chat, storage usage/upload fallback, auth/onboarding, invite accept, and
   sign-out.
5. Fill the final Candidate table above with exact commit, revision, migration,
   smoke, and rollback evidence.

## Pending product/feature follow-ups

These are not beta-security blockers unless they break the smoke paths above,
but they should stay visible for beta planning.

| Follow-up                                               | Source                                          | Beta posture                                                         |
| ------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| PM/CRM/Reminders detail/edit views                      | `docs/HANDOVER.md` v1 list                      | Defer; v0 list/create flows are the shipped beta scope.              |
| Kanban for tasks and deals                              | `docs/RELEASES/v1.12.0.md`                      | Defer unless beta testers need board workflows.                      |
| Reminder rules and repeat schedules                     | `docs/RELEASES/v1.12.0.md`                      | Defer; manual reminders remain acceptable for beta.                  |
| Drag-drop, bulk ops, CSV import/export                  | `docs/RELEASES/v1.12.0.md`                      | Defer; capture tester requests as product feedback.                  |
| Real-time updates and mobile PM/CRM views               | `docs/HANDOVER.md` v1 list                      | Defer; use desktop smoke for beta readiness.                         |
| StorageCapModal and AiBudgetModal parent wiring         | `docs/IMPLEMENTATION_PLAN.md`                   | Product follow-up; backend envelopes exist, UI mount still pending.  |
| Chat-session memory auto-ingest and pin-toggle mutation | `docs/IMPLEMENTATION_PLAN.md`                   | Product follow-up; read-time memory injection already works.         |
| Analytics phase-3 rollup implementation                 | Historical Railway log review / analytics TODOs | Defer implementation; scheduled stubs must stay no-op until shipped. |

## Post-beta monitoring

During the first 24 hours after inviting testers:

- Check Cloud Run errors and 5xx/4xx trends every 2 hours.
- Review AI provider failures, GraphQL errors, and storage/upload errors.
- Watch signup to first-chat funnel and workspace creation failures.
- Add every new P1/P2 issue to `BETA_RISK_REGISTER.md` within the same day.
- Pause new invites if any P0/P1 appears.
