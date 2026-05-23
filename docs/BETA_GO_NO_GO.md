# Manut Beta Go/No-Go

> Purpose: final sign-off sheet for inviting beta testers.
> Fill this out for the exact commit or Railway deployment that will be
> used by beta testers.

## Candidate

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

## Required gates

| Gate                     | Required evidence                                                       | Status  | Notes                                                                     |
| ------------------------ | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| Manut CI                 | Green workflow URL                                                      | Pending | Lint, GraphQL codegen drift, web/admin/mobile bundles.                    |
| Manut Beta Security Gate | Green workflow URL                                                      | Pending | Workflow lint, secret scan, dependency audit, static scan, custom guards. |
| Railway health           | `/info` 200 and deployment healthy                                      | Pending | Include deployment id and timestamp.                                      |
| GraphQL smoke            | Authenticated workspace query succeeds; no new 5xx/GraphQL errors       | Pending | Check recent Railway logs.                                                |
| AI chat smoke            | Floating and full chat send/receive works; provider errors are friendly | Pending | Include desktop and mobile screenshots if UI changed.                     |
| Storage/upload smoke     | Storage usage loads; quota and upload failure states are usable         | Pending | Covers known storage-loading concern.                                     |
| Auth/onboarding smoke    | Signup/login, workspace creation, sign-out, invite accept               | Pending | Use a fresh beta tester account.                                          |
| Production logs          | No new P0/P1 error class in last 30 minutes                             | Pending | Railway/Sentry evidence.                                                  |
| Risk register            | No open P0/P1; P2 blockers explicitly waived or fixed                   | Pending | Link rows from `BETA_RISK_REGISTER.md`.                                   |
| Rollback                 | Rollback target and owner confirmed                                     | Pending | Owner can execute rollback within 10 minutes.                             |

## Decision

Launch posture: `NO-GO`

Reason:

- Pending beta security and smoke evidence.

## Post-beta monitoring

During the first 24 hours after inviting testers:

- Check Railway errors and 5xx/4xx trends every 2 hours.
- Review AI provider failures, GraphQL errors, and storage/upload errors.
- Watch signup to first-chat funnel and workspace creation failures.
- Add every new P1/P2 issue to `BETA_RISK_REGISTER.md` within the same day.
- Pause new invites if any P0/P1 appears.
