# Manut Beta Go/No-Go

> Purpose: final sign-off sheet for inviting beta testers.
> Fill this out for the exact commit, image, deploy surface, migration step, and
> smoke evidence that will be used by beta testers.

## Candidate

This table now records the deployed AI beta image candidate. It still remains
`NO-GO` for beta invites until authenticated AI smoke, operator log review, and
rollback-owner selection are complete.

Current context: PR #191 (`c7334e953d1da3357086b1afb328d6977b322e51`) and PR
#192 (`c0674d559db5d530586546b91d02758ac4033e44`) are merged to `main`; PR #193
(`19531362be8c6ca2748f819448bce7821636d9e1`) refreshed the post-merge docs.
Build #145 / run `26895527260` passed, and manual deploy run `26920813335`
swapped production to `main-19531362b-26895527260`. Public smoke passed after
deploy. This sheet stays `NO-GO` until authenticated smoke, logs review, and
rollback-owner selection are finished.

| Field                     | Value                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Date                      | 2026-06-04                                                                                               |
| Commit                    | `19531362be8c6ca2748f819448bce7821636d9e1`                                                               |
| Branch                    | `main`                                                                                                   |
| Image tag or digest       | `main-19531362b-26895527260` / `sha256:ce9e7922717ea5542f872af7aa386aa56b7535eb7ccece86cf7f7c50541d2e84` |
| Production deploy surface | VM safe-deploy workflow `manut-deploy.yml` -> `/srv/affine/scripts/deploy.sh`                            |
| Production revision       | N/A for this VM compose deploy                                                                           |
| Migration step            | Deploy workflow migration phase completed before production recreate                                     |
| Production URL            | `https://manut.xyz`                                                                                      |
| Rollback target           | `main-2cb0d4223-26794170785` / `compose.yml.previous.bak`                                                |
| Primary owner             | TBD                                                                                                      |
| Secondary owner           | TBD                                                                                                      |

## Current launch readiness snapshot

| Check                 | Required launch evidence                                                                                     | Status  | Next action                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Candidate CI          | Green `Manut CI`, `Manut Beta Security Gate`, and bundle/build evidence on the candidate commit.             | Passed  | Build #145 / run `26895527260` passed for `19531362be8c6ca2748f819448bce7821636d9e1`.                                            |
| Production deploy     | Manual deploy workflow shows intended image, sidecar validation, migration, post-swap health, and exit 0.    | Passed  | Run `26920813335` deployed `main-19531362b-26895527260`; no rollback occurred.                                                   |
| Migration step        | Migration phase completed for the candidate image.                                                           | Passed  | Workflow logs reported migration completion before `affine_server` recreate.                                                     |
| Public smoke          | `scripts/gcp/smoke-test-cloud-run.sh` passes against `https://manut.xyz`.                                    | Passed  | Passed with `BASE_URL=https://manut.xyz TIMEOUT_SECONDS=120 SLEEP_SECONDS=1 scripts/gcp/smoke-test-cloud-run.sh`.                |
| Operator logs         | No new P0/P1 error class, GraphQL startup crash, migration failure, or sustained 5xx in the last 30 minutes. | Pending | Check production logs/Sentry from an authenticated operator surface; local `gcloud` was blocked by non-interactive auth refresh. |
| Historical beta fixes | 2026-05-23 `codex/fix-beta-blockers` closed AI UI, quota serialization, analytics cron, and workflow issues. | Closed  | Historical source data only; do not use the old Railway deployment/log evidence as launch proof.                                 |

## Required gates

| Gate                     | Required evidence                                                       | Status  | Notes                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Manut CI                 | Green workflow URL                                                      | Passed  | Main CI and candidate build evidence are recorded for the deployed commit.                                                       |
| Manut Beta Security Gate | Green workflow URL                                                      | Passed  | PR-level security checks passed before merge; re-run if product code changes.                                                    |
| Production health        | `/info` 200, prompt seed healthy, and intended image receiving traffic  | Passed  | Manual deploy run `26920813335` and post-deploy public smoke passed.                                                             |
| GraphQL smoke            | Authenticated workspace query succeeds; no new 5xx/GraphQL errors       | Pending | Check production logs and run an authenticated workspace query.                                                                  |
| AI chat smoke            | Floating and full chat send/receive works; provider errors are friendly | Pending | Include Save as doc, Full Agent plan/timeline, task cockpit, source chips, approval toggle path, and desktop/mobile screenshots. |
| Storage/upload smoke     | Storage usage loads; quota and upload failure states are usable         | Pending | Covers known storage-loading concern.                                                                                            |
| Auth/onboarding smoke    | Signup/login, workspace creation, sign-out, invite accept               | Pending | Use a fresh beta tester account.                                                                                                 |
| Production logs          | No new P0/P1 error class in last 30 minutes                             | Pending | Recheck production service logs and Sentry evidence.                                                                             |
| Risk register            | No open P0/P1; P2 blockers explicitly waived or fixed                   | Pending | Code blockers in `BETA_RISK_REGISTER.md` are closed; production smoke evidence still required.                                   |
| Rollback                 | Rollback target and owner confirmed                                     | Partial | Previous image is `main-2cb0d4223-26794170785`; primary and secondary owners are still TBD.                                      |

## Decision

Launch posture: `NO-GO`

Reason:

- Authenticated AI chat, GraphQL, storage/upload, auth/onboarding, and invite
  accept smoke are not recorded yet.
- Operator log/Sentry review is not recorded yet.
- Rollback owners and beta tester smoke account remain unset.

## Pending launch readiness

1. Run authenticated beta smoke: GraphQL workspace query, floating/full AI chat,
   Save as doc, Full Agent plan/timeline, task link/cockpit, source chips,
   approval toggle path, retry after failed tool, storage usage/upload fallback,
   auth/onboarding, invite accept, and sign-out.
2. Recheck production service logs and Sentry for no analytics-cron
   `NOT_IMPLEMENTED`, no GraphQL Int overflow, no new P0/P1 error class, and
   no sustained 5xx.
3. Confirm primary and secondary rollback owners for
   `main-2cb0d4223-26794170785` / `compose.yml.previous.bak`.
4. Fill the final smoke rows above with exact authenticated browser evidence.

## Pending product/feature follow-ups

These are not beta-security blockers unless they break the smoke paths above,
but they should stay visible for beta planning.

| Follow-up                                               | Source                                          | Beta posture                                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PM/CRM/Reminders detail/edit views                      | `docs/HANDOVER.md` v1 list                      | Defer; v0 list/create flows are the shipped beta scope.                                                                                                             |
| Kanban for tasks and deals                              | `docs/RELEASES/v1.12.0.md`                      | Defer unless beta testers need board workflows.                                                                                                                     |
| Reminder rules and repeat schedules                     | `docs/RELEASES/v1.12.0.md`                      | Defer; manual reminders remain acceptable for beta.                                                                                                                 |
| Drag-drop, bulk ops, CSV import/export                  | `docs/RELEASES/v1.12.0.md`                      | Defer; capture tester requests as product feedback.                                                                                                                 |
| Real-time updates and mobile PM/CRM views               | `docs/HANDOVER.md` v1 list                      | Defer; use desktop smoke for beta readiness.                                                                                                                        |
| StorageCapModal and AiBudgetModal parent wiring         | `docs/IMPLEMENTATION_PLAN.md`                   | Product follow-up; backend envelopes exist, UI mount still pending.                                                                                                 |
| Chat-session memory auto-ingest and pin-toggle mutation | `docs/IMPLEMENTATION_PLAN.md`                   | Product follow-up; read-time memory injection already works.                                                                                                        |
| Full Agent cockpit live binding and metrics review      | `docs/AI_CHATBOT_EXPERIENCE_SPEC.md`            | Product follow-up; PR #192 shipped the readout component and telemetry events, but live task/plan/approval/work-product binding and beta metric review remain next. |
| Inspectable source/citation drawer                      | `docs/AI_CHATBOT_EXPERIENCE_SPEC.md`            | Product follow-up; PR #192 source chips improve status, but snippet-level evidence inspection is still separate work.                                               |
| Analytics phase-3 rollup implementation                 | Historical Railway log review / analytics TODOs | Defer implementation; scheduled stubs must stay no-op until shipped.                                                                                                |

## Post-beta monitoring

During the first 24 hours after inviting testers:

- Check production service errors and 5xx/4xx trends every 2 hours.
- Review AI provider failures, GraphQL errors, and storage/upload errors.
- Watch signup to first-chat funnel and workspace creation failures.
- Add every new P1/P2 issue to `BETA_RISK_REGISTER.md` within the same day.
- Pause new invites if any P0/P1 appears.
