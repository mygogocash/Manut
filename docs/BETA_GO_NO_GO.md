# Manut Beta Go/No-Go

> Purpose: final sign-off sheet for inviting beta testers.
> Fill this out for the exact commit or Railway deployment that will be
> used by beta testers.

## Candidate

This table is intentionally still `TBD` until the exact committed branch and
Railway deployment are selected for beta testers.

| Field                 | Value               |
| --------------------- | ------------------- |
| Date                  | TBD                 |
| Commit                | TBD                 |
| Branch                | `main`              |
| Railway deployment id | TBD                 |
| Production URL        | `https://manut.xyz` |
| Rollback target       | TBD                 |
| Primary owner         | TBD                 |
| Secondary owner       | TBD                 |

## Current readiness snapshot

| Check                  | Latest evidence                                                                                                                                                                        | Status        | Next action                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| Local hardening branch | `codex/fix-beta-blockers` on base `234d74bcb`; contains uncommitted fixes for AI UI, quota serialization, analytics rollup cron errors, and beta-security workflow bootstrap failures. | In progress   | Commit, push, open PR, and rerun all PR gates.                                               |
| GitHub main CI         | `Manut CI` run `26323515938` and `Manut Build` run `26323591394` succeeded on `main` at 2026-05-23 04:31-04:35 UTC.                                                                    | Main green    | Candidate branch still needs its own CI/build evidence.                                      |
| Beta security gate     | Latest PR run `26323476061` failed workflow lint and static scan because of CI-tooling bootstrap bugs. Local actionlint and Semgrep scan pass after the workflow patch.                | Fix verifying | Push this workflow fix and require a green beta-security run on the candidate PR.            |
| Railway production     | `railway status` reports service `Manut` online in production; deployment `6ccaa65a-535a-4aa9-92e6-79333ad7593a`; `https://manut.xyz/info` returned HTTP 200.                          | Prod healthy  | Candidate branch is not deployed; redeploy before using this as beta-candidate evidence.     |
| Production logs        | Recent Railway logs showed `NOT_IMPLEMENTED: HourlyRollupCron.run` and a Railway log-rate warning. The cron throw is fixed locally with an AVA regression test.                        | Fix verifying | Redeploy, then recheck logs for no cron `NOT_IMPLEMENTED`, no GraphQL Int overflow, and 5xx. |

## Required gates

| Gate                     | Required evidence                                                       | Status        | Notes                                                                                           |
| ------------------------ | ----------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Manut CI                 | Green workflow URL                                                      | Partial       | `main` is green; beta candidate PR must still pass.                                             |
| Manut Beta Security Gate | Green workflow URL                                                      | Fix verifying | Local workflow bootstrap fixes pass actionlint and Semgrep; GitHub rerun still required.        |
| Railway health           | `/info` 200 and deployment healthy                                      | Partial       | Production deployment `6ccaa65a-535a-4aa9-92e6-79333ad7593a` is online; candidate not deployed. |
| GraphQL smoke            | Authenticated workspace query succeeds; no new 5xx/GraphQL errors       | Pending       | Check recent Railway logs.                                                                      |
| AI chat smoke            | Floating and full chat send/receive works; provider errors are friendly | Pending       | Include desktop and mobile screenshots if UI changed.                                           |
| Storage/upload smoke     | Storage usage loads; quota and upload failure states are usable         | Pending       | Covers known storage-loading concern.                                                           |
| Auth/onboarding smoke    | Signup/login, workspace creation, sign-out, invite accept               | Pending       | Use a fresh beta tester account.                                                                |
| Production logs          | No new P0/P1 error class in last 30 minutes                             | Fix verifying | Cron `NOT_IMPLEMENTED` fixed locally; redeploy and recheck Railway/Sentry evidence.             |
| Risk register            | No open P0/P1; P2 blockers explicitly waived or fixed                   | Pending       | Code blockers in `BETA_RISK_REGISTER.md` are closed; production smoke evidence still required.  |
| Rollback                 | Rollback target and owner confirmed                                     | Pending       | Owner can execute rollback within 10 minutes.                                                   |

## Decision

Launch posture: `NO-GO`

Reason:

- Candidate fixes are not committed, pushed, or deployed yet.
- Beta Security Gate needs a green GitHub rerun after the workflow fix.
- Production smoke/log evidence must be collected after redeploy.
- Rollback owner/target and beta tester smoke account remain unset.

## Pending launch readiness

1. Commit and push `codex/fix-beta-blockers`; open a PR into `main`.
2. Require green `Manut CI`, `Manut Beta Security Gate`, and `Manut Build` on
   the PR/merge candidate.
3. Deploy the merged candidate to Railway and record the deployment id,
   image/tag, rollback target, primary owner, and secondary owner.
4. Recheck Railway logs for no `HourlyRollupCron.run` `NOT_IMPLEMENTED`, no
   GraphQL `Int cannot represent non 32-bit signed integer`, no new P0/P1
   error class, and no sustained log-rate drops.
5. Run authenticated beta smoke: GraphQL workspace query, floating/full AI
   chat, storage usage/upload fallback, auth/onboarding, invite accept, and
   sign-out.
6. Fill the final Candidate table above with exact commit/deployment evidence.

## Pending product/feature follow-ups

These are not beta-security blockers unless they break the smoke paths above,
but they should stay visible for beta planning.

| Follow-up                                               | Source                               | Beta posture                                                         |
| ------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| PM/CRM/Reminders detail/edit views                      | `docs/HANDOVER.md` v1 list           | Defer; v0 list/create flows are the shipped beta scope.              |
| Kanban for tasks and deals                              | `docs/RELEASES/v1.12.0.md`           | Defer unless beta testers need board workflows.                      |
| Reminder rules and repeat schedules                     | `docs/RELEASES/v1.12.0.md`           | Defer; manual reminders remain acceptable for beta.                  |
| Drag-drop, bulk ops, CSV import/export                  | `docs/RELEASES/v1.12.0.md`           | Defer; capture tester requests as product feedback.                  |
| Real-time updates and mobile PM/CRM views               | `docs/HANDOVER.md` v1 list           | Defer; use desktop smoke for beta readiness.                         |
| StorageCapModal and AiBudgetModal parent wiring         | `docs/IMPLEMENTATION_PLAN.md`        | Product follow-up; backend envelopes exist, UI mount still pending.  |
| Chat-session memory auto-ingest and pin-toggle mutation | `docs/IMPLEMENTATION_PLAN.md`        | Product follow-up; read-time memory injection already works.         |
| Analytics phase-3 rollup implementation                 | Railway log review / analytics TODOs | Defer implementation; scheduled stubs must stay no-op until shipped. |

## Post-beta monitoring

During the first 24 hours after inviting testers:

- Check Railway errors and 5xx/4xx trends every 2 hours.
- Review AI provider failures, GraphQL errors, and storage/upload errors.
- Watch signup to first-chat funnel and workspace creation failures.
- Add every new P1/P2 issue to `BETA_RISK_REGISTER.md` within the same day.
- Pause new invites if any P0/P1 appears.
