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

| ID           | Severity | Surface        | Finding                                                                                                 | Reproduction                                                                                  | Expected                                                                   | Actual                             | Test to add                                                                                                                    | Owner | Status | Beta blocker                                  |
| ------------ | -------- | -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ | --------------------------------------------- |
| BETA-SEC-001 | P2       | AI chat UI/API | Floating Manut AI can show blank/loading states and confusing model controls.                           | Open a database doc, open Manut AI, send summarize prompt, inspect empty answer/model footer. | AI shows one model control and a clear loading/error/result state.         | Pending fix from AI UI workstream. | `AIChatInput > given default auto format and auto model > renders one visible Auto control` plus provider error fallback test. | Codex | Open   | Yes until AI chat smoke passes                |
| BETA-SEC-002 | P2       | GraphQL/API    | Recent production logs showed `Int cannot represent non 32-bit signed integer value: 9007199254740991`. | Query the affected quota/workspace path once identified from logs.                            | Unlimited values serialize through a safe scalar or bounded display value. | Pending exact repro.               | `quota graphql > given unlimited numeric value > serializes safely`                                                            | Codex | Open   | Yes until repro is closed or proven unrelated |

## Accepted beta risks

| ID       | Severity | Surface | Risk | Rationale | Review date | Owner |
| -------- | -------- | ------- | ---- | --------- | ----------- | ----- |
| None yet | -        | -       | -    | -         | -           | -     |

## Verification evidence

| Date | Candidate | Evidence                                                                | Result | Notes                              |
| ---- | --------- | ----------------------------------------------------------------------- | ------ | ---------------------------------- |
| TBD  | TBD       | `Manut CI`, `Manut Beta Security Gate`, Railway smoke, production smoke | TBD    | Fill before inviting beta testers. |
