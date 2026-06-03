# Executive Summary

Fix the current UX/UI bughunt findings from `docs/manut-bughunt/UX_UI_BUGHUNT_2026-06-02.md` with production-safe, reversible changes. The work focuses on honest settings states, mobile responsiveness, accessible controls, actionable provider errors, invite-state correctness, and AI budget/source transparency.

## Implementation Result - 2026-06-03

- Branch: `codex/fix-ux-ui-bughunt`
- Commit: `b57f4ae1f fix(manut): resolve ux bughunt regressions`
- Status: implemented, merged via PR #188, build-verified, and not deployed.
- Merge: `35bc631166d5c3d82f892793283ba990f417a54d`.
- Build: GitHub Actions `Manut Build` run `26876250444` / Build #141 passed
  and pushed image tag `main-35bc63116-26876250444`.
- Latest main image: PR #189 merged the handover refresh at
  `ac059984949b0400ef0219bcea4df398ca73f057`; GitHub Actions `Manut Build`
  run `26877703841` / Build #142 passed and pushed image tag
  `main-ac0599849-26877703841`.
- Backend coverage added:
  `packages/backend/server/src/__tests__/manut/ux-bughunt-regressions.spec.ts`.
- Frontend coverage added:
  `packages/frontend/core/src/__tests__/manut-ux-bughunt.spec.ts`.
- Verification passed:
  - `yarn workspace @affine/server test src/__tests__/manut/ux-bughunt-regressions.spec.ts --timeout=1m`
  - `yarn workspace @affine/server tsc --noEmit`
  - `yarn vitest run packages/frontend/core/src/__tests__/manut-ux-bughunt.spec.ts`
  - Scoped frontend `yarn eslint --no-cache ...`
  - `yarn prettier --check ...`
  - `git diff --check`
- Remaining validation before release: authenticated browser smoke, production
  deploy, and production deploy evidence update. Public pre-release smoke passed
  on 2026-06-03 18:24 +07.
- Follow-up AI chat state: PR #191 later merged Save as doc for generated AI
  content, and PR #192 later merged the Full Agent beta plan/timeline/task
  cockpit UI. Those changes do not remove this bughunt slice's remaining
  release gates: authenticated browser smoke, production deploy, and deploy
  evidence update are still required before claiming the live product contains
  them.

# Business Goals

- Reduce confusing or false UI states in Settings, AI chat, mobile navigation, and integrations.
- Prevent invite and integration flows from showing users incorrect status.
- Make AI chat feel more trustworthy by improving source inspection and budget accuracy.

# Technical Goals

- Preserve upstream AFFiNE architecture and existing Manut extension points.
- Prefer small localized fixes over new abstractions.
- Add focused regression tests for backend P1 bugs and component-level frontend regressions where existing harnesses support it.
- Keep changes reversible and deployable through the existing fullstack bundle flow.

# Requirements

- Fix pending invite link acceptance so it does not fall through to under-review state.
- Convert Google OAuth user-facing failures into the repo's user-friendly error model.
- Apply AI budget preflight/spend recording to `stream-object`.
- Stop exposing unwired Budget and Work Queues as false empty operational surfaces.
- Preserve settings deep-link anchor scrolling.
- Improve small-screen sidebar initial behavior.
- Avoid auto-focusing the mobile Ask AI input into the virtual keyboard.
- Fix floating AI tab invalid nested buttons and mobile hit targets.
- Make AI tool/source cards keyboard accessible.
- Restore mobile `:focus-visible` indicators and improve bottom tab semantics/target size.
- Normalize user-visible analytics connection errors.
- Update the bughunt report status after implementation.

# Non-Goals

- Do not fully wire Budget or Work Queue backend data into Settings in this pass.
- Do not redesign the whole AI chat UI or build a new citation drawer from scratch.
- Do not deploy production automatically unless explicitly requested after tests pass.
- Do not rotate secrets, change provider config, or modify production data.

# Architecture

- Backend fixes stay in existing resolvers/controllers and reuse existing error primitives.
- Frontend fixes stay in existing components and CSS modules.
- Settings honesty uses existing tab-list composition rather than adding global feature flags.
- AI source-card accessibility keeps existing stream-object/rendering contracts.

# Data Models

- No schema migrations.
- No new persisted fields.
- AI budget accounting continues using existing budget service and cost estimation methods.

# API Contracts

- `acceptInviteById` preserves the existing return type and now returns after accepting an already-pending email role.
- Google OAuth GraphQL mutations/queries continue returning existing shapes but errors serialize as user-friendly messages.
- Copilot `/chat/:sessionId/stream-object` continues emitting the same stream object shape, with budget side effects added.

# Security

- Do not expose raw provider tokens/codes/errors to clients.
- Do not relax permissions.
- Avoid adding new privileged APIs.
- Keep all changes same-origin and authenticated as before.

# Edge Cases

- Existing pending invite accepted through invite link.
- Existing accepted member hitting invite link.
- Google OAuth not configured, not connected, and refresh failed.
- Object stream aborted before completion.
- Mobile first load under sidebar thresholds.
- Keyboard-only users expanding source cards and switching mobile tabs.
- Reduced-motion users and safe-area devices.

# Testing Strategy

- Backend AVA regression tests for invite acceptance, Google OAuth error mapping, and stream-object budget accounting.
- Frontend unit/component tests for semantic controls where existing tests exist.
- TypeScript checks for touched packages.
- `git diff --check` before final.

# Rollback Plan

- Revert the bughunt fix commit to return to `main` behavior.
- No migrations or data writes are introduced, so rollback is code-only.
- If object-stream budget accounting causes unexpected blocking, revert the controller change only.

# Milestones

## Milestone 1 - Backend State Correctness

Objective: fix invite, Google OAuth error, and AI budget state bugs.

Business impact: fewer misleading status messages and more accurate quota usage.

Technical scope: backend resolver/controller tests and implementation.

Dependencies: existing AVA harness and Copilot controller test utilities.

Risks: generic GraphQL error mapping can regress if the wrong error class is used.

Success metrics: targeted backend tests pass.

Rollback strategy: revert backend files and tests.

## Milestone 2 - Frontend Honesty And Accessibility

Objective: remove false empty states and make key controls keyboard/touch accessible.

Business impact: settings and AI feel less broken and more trustworthy.

Technical scope: settings tabs, mobile CSS/components, AI source cards, floating AI tabs.

Dependencies: existing React/Lit component patterns.

Risks: visual regressions in dense controls.

Success metrics: targeted frontend tests and type checks pass.

Rollback strategy: revert frontend files and tests.

## Milestone 3 - Documentation And Verification

Objective: update bughunt report with fixed/remaining status.

Business impact: project progress remains traceable for the next deploy.

Technical scope: docs only.

Dependencies: completed implementation.

Risks: stale verification notes.

Success metrics: docs match actual changed files and test output.

Rollback strategy: revert doc update.

# Epics

## Epic 1 - Backend UX State

User value: users see correct invitation, integration, and AI quota states.

Technical requirements: explicit errors, no fallthrough state regression, object stream accounting.

Security considerations: no raw provider secrets/errors.

Edge cases: aborted streams and stale OAuth tokens.

Data flow: GraphQL/SSE controller inputs remain unchanged; service side effects become accurate.

API contracts: no shape changes.

Testing strategy: AVA unit/controller tests.

## Epic 2 - Frontend UX Honesty

User value: settings do not show unwired data as real empty data.

Technical requirements: hide or honestly label unavailable tabs and preserve anchor scroll.

Security considerations: no permission loosening.

Edge cases: direct hidden-tab deep links.

Testing strategy: component tests where existing harness supports it.

## Epic 3 - Mobile And Accessibility

User value: mobile users and keyboard users can navigate without clipped or invisible controls.

Technical requirements: initial responsive state, no forced keyboard, valid interactive markup, focus-visible styles.

Security considerations: none beyond existing auth.

Edge cases: iOS safe areas, reduced motion, nested overlays.

Testing strategy: component/static tests and type checks.

# User Stories

As a workspace member, I want accepting an invite to put me in the correct accepted state so that I can enter the workspace without waiting for review again.

Acceptance criteria: pending email invite acceptance returns after accepting and does not call the review-link path.

As an admin, I want Google integration errors to tell me what to fix so that I do not see a generic internal error.

Acceptance criteria: not configured/not connected/refresh failed errors serialize as actionable user-friendly errors.

As an AI user, I want structured AI actions to count against the same budget as chat so that quota UI stays believable.

Acceptance criteria: object streams preflight and record spend on successful completion.

As a mobile user, I want Ask AI to open without immediately hiding the composer under the keyboard so that I can choose when to type.

Acceptance criteria: opening Ask AI focuses the sheet, not the textarea, on initial touch open.

As a keyboard user, I want settings, mobile tabs, and AI sources to be focusable and operable so that I can use the app without a mouse.

Acceptance criteria: source cards and tab controls use valid interactive semantics with visible focus.

# Tasks

## Task 1 - Backend Invite And Google Errors

Objective: fix invitation fallthrough and Google user-friendly errors.

Scope: `member.ts`, `google-oauth.resolver.ts`, tests.

Dependencies: AVA backend test harness.

Risk Tier: R1.

Acceptance Criteria: focused tests fail before code and pass after code.

Tests: invite resolver/service test, Google resolver error mapping test.

Rollback: revert touched backend files.

Assigned Model: GPT-5.5 xhigh parent plus worker if delegated.

Assigned Agent: backend worker or parent.

## Task 2 - Copilot Object Stream Budget

Objective: add object-stream budget preflight and spend recording.

Scope: `controller.ts`, controller test.

Dependencies: Copilot budget service test stubs.

Risk Tier: R1.

Acceptance Criteria: object stream uses same accounting pattern as text stream.

Tests: focused controller/unit test.

Rollback: revert controller accounting block.

Assigned Model: GPT-5.5 xhigh parent plus worker if delegated.

Assigned Agent: backend worker or parent.

## Task 3 - Settings Honesty

Objective: remove false empty states and preserve anchor scroll.

Scope: workspace settings list/switch, settings modal scroll.

Dependencies: existing settings components.

Risk Tier: R2.

Acceptance Criteria: Budget/Work Queues are hidden or honest; scroll anchors are not reset.

Tests: targeted component/static tests.

Rollback: revert frontend files.

Assigned Model: GPT-5.3-Codex-Spark style execution via worker when available.

Assigned Agent: frontend worker.

## Task 4 - Mobile And Floating AI Accessibility

Objective: fix sidebar initial state, Ask AI keyboard behavior, mobile tabs, floating AI tabs.

Scope: mobile and floating AI components/CSS.

Dependencies: existing mobile components.

Risk Tier: R2.

Acceptance Criteria: valid interactive markup, focus-visible restored, target sizes improved.

Tests: focused component/static tests.

Rollback: revert frontend files.

Assigned Model: GPT-5.3-Codex-Spark style execution via worker when available.

Assigned Agent: mobile/frontend worker.

## Task 5 - AI Source Cards And Connection Error UX

Objective: make source cards accessible and normalize user-visible connection errors.

Scope: AI tool result components, analytics connection UI/service.

Dependencies: stream-object rendering contract.

Risk Tier: R2.

Acceptance Criteria: source expansion/opening is keyboard-accessible; raw errors are sanitized in UI.

Tests: targeted unit/component tests.

Rollback: revert frontend files.

Assigned Model: GPT-5.3-Codex-Spark style execution via worker when available.

Assigned Agent: AI/frontend worker.

# Acceptance Criteria

- All P1 findings in the bughunt report are either fixed or honestly downgraded with code evidence.
- P2 accessibility findings have localized semantic/focus/touch fixes.
- Docs updated with implementation status.
- Targeted tests pass.
- Type checks pass for affected packages where feasible.
- `git diff --check` passes.
