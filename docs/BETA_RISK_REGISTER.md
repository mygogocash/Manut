# Manut Beta Risk Register

> Purpose: one source of truth for pentest findings and beta blockers.
> Update this file during every beta hardening pass. Do not include
> secrets, live tokens, raw private user data, or exploit payloads that
> would be dangerous to copy.

## Status key

- `Open`: confirmed and not fixed.
- `Testing`: RED test exists or is being written.
- `Fixing`: implementation is in progress.
- `Verifying`: fix landed and verification is running.
- `Closed`: fix verified and evidence linked.
- `Accepted`: known risk explicitly accepted for beta.

## Findings

| ID           | Severity | Surface        | Finding                                                                                                 | Reproduction                                                                                  | Expected                                                                   | Actual                                                                                                                                                  | Test to add                                                                                                                                                                                | Owner | Status | Beta blocker                                                |
| ------------ | -------- | -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ | ----------------------------------------------------------- |
| BETA-SEC-001 | P2       | AI chat UI/API | Floating Manut AI can show blank/loading states and confusing model controls.                           | Open a database doc, open Manut AI, send summarize prompt, inspect empty answer/model footer. | AI shows one model control and a clear loading/error/result state.         | Fixed in `codex/fix-beta-blockers`: default format control labels as `Format`, and contentless transmitting assistant replies render the loading state. | `AIChatInput > given default auto format and auto model > renders one visible Auto control`; `ChatMessageAssistant > given transmitting reply has no content yet > renders loading state`. | Codex | Closed | No for code blocker; AI chat smoke remains required         |
| BETA-SEC-002 | P2       | GraphQL/API    | Recent production logs showed `Int cannot represent non 32-bit signed integer value: 9007199254740991`. | Query the affected quota/workspace path once identified from logs.                            | Unlimited values serialize through a safe scalar or bounded display value. | Fixed in `codex/fix-beta-blockers`: practical unlimited member cap is bounded to `100_000` before GraphQL serialization.                                | `quota graphql > given unlimited numeric value > serializes safely`                                                                                                                        | Codex | Closed | No for code blocker; GraphQL smoke remains required         |
| BETA-SEC-003 | P1       | Railway logs   | Analytics rollup cron stubs throw `NOT_IMPLEMENTED` on schedule, creating production error noise.       | `railway logs --service Manut --environment production --filter '@level:error' --since 30m`.  | Scheduled placeholder crons are inert until phase-3 rollups ship.          | Fixed locally: hourly/daily/weekly rollup crons now log-and-return instead of throwing.                                                                 | `Analytics rollup crons > given phase-3 rollups are not implemented > then scheduled runs do not throw`                                                                                    | Codex | Closed | No for code blocker; production redeploy/log smoke required |
| BETA-SEC-004 | P1       | CI/CD          | `Manut Beta Security Gate` fails before producing useful security evidence.                             | Latest PR run `26323476061` failed workflow lint and static scan jobs.                        | CI bootstrap succeeds so actionlint and Semgrep can report real findings.  | Fixed locally: actionlint command is shellcheck-safe; Semgrep installs with `setuptools<81` so `pkg_resources` exists under Python 3.12.                | Workflow lint via actionlint; Semgrep 1.99 high-confidence scan startup and full scan.                                                                                                     | Codex | Closed | No for code blocker; green GitHub rerun required            |

## Accepted beta risks

| ID       | Severity | Surface | Risk | Rationale | Review date | Owner |
| -------- | -------- | ------- | ---- | --------- | ----------- | ----- |
| None yet | -        | -       | -    | -         | -           | -     |

## Verification evidence

| Date       | Candidate                 | Evidence                                                                                                                                                                                                                                                                                                                                                          | Result | Notes                                                                                               |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| 2026-05-23 | `codex/fix-beta-blockers` | `yarn workspace @affine/server test src/__tests__/quota/tiers.spec.ts`; `yarn test packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/format-selector.spec.ts packages/frontend/core/src/blocksuite/ai/chat-panel/message/assistant.spec.ts`; `yarn workspace @affine/server test src/plugins/analytics/aggregator/__tests__/rollup-crons.spec.ts` | Pass   | Code-level beta blockers closed; production smoke gates still pending before inviting beta testers. |
| 2026-05-23 | `codex/fix-beta-blockers` | Downloaded `actionlint` v1.7.11 binary against `.github/workflows/manut-beta-security.yml`; Semgrep 1.99 Python 3.12 startup with `setuptools<81`; exact high-confidence Semgrep command from the workflow against backend/frontend/workflow paths.                                                                                                               | Pass   | GitHub Beta Security Gate must still rerun after this branch is pushed.                             |

Additional 2026-05-23 checks: Prettier, ESLint, oxlint, `git diff --check`,
`yarn workspace @affine/server tsc --noEmit`, production dependency audit,
actionlint, Semgrep high-confidence scan, and web/admin/mobile bundles passed.
Full `yarn test` was attempted and remains blocked by local environment
dependencies outside this change: missing `@affine/native-darwin-arm64` and
missing Playwright Firefox.
