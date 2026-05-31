# Pending PR Consolidation Spec

## Goal

Combine the currently open Manut PRs targeting `main` into one reviewable PR while preserving the original PR branches as rollback points.

## Requirements

- Include the changes from:
  - PR #146, `codex/ai-chat-layout-stability`
  - PR #147, `codex/fix-static-asset-404`
  - PR #148, `codex/notion-document-readability`
- Base the combined branch on the current `origin/main`.
- Preserve the individual commits so each source PR remains auditable.
- Do not close or delete original branches until the combined PR exists and verifies successfully.
- Mark the superseded PRs clearly after the combined PR is created.

## Data And Contracts

- GitHub PR metadata is the source of truth for pending PR scope.
- The combined PR should target `main` and use a new branch, `codex/combined-pending-prs`.
- Existing affected product contracts remain owned by their source PRs:
  - Floating AI chat empty independent layout remains stable.
  - Missing self-host static assets return 404 instead of HTML fallback.
  - Workspace document detail pages use a readable centered layout.

## Edge Cases

- If merge conflicts appear, resolve them by preserving behavior from all source PRs and rerun the relevant focused tests.
- If a source PR is updated after consolidation starts, compare the source branch before final push.
- If the combined branch fails verification, keep the three original PRs open and abandon or repair the combined branch.
- If a superseded PR has already been merged or closed while consolidating, re-check the open PR list before closing anything.

## Tasks

### Task 1: Branch consolidation

- Intended behavior: the new branch contains the commits from PRs #146, #147, and #148 on top of `origin/main`.
- Test names: `git log --left-right --cherry-pick origin/main...HEAD`; `git diff --name-only origin/main...HEAD`.
- Affected files: git branch metadata plus the files already changed by the three source PRs.
- Risk tier: R2. Reversible by deleting the combined branch and leaving original PRs untouched.
- Rollback: `git switch codex/notion-document-readability && git branch -D codex/combined-pending-prs`.

### Task 2: Combined verification

- Intended behavior: focused checks from the source PRs still pass when the changes are composed.
- Test names:
  - `yarn vitest run packages/frontend/core/src/blocksuite/ai/components/ai-chat-content/ai-chat-content.spec.ts packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page-layout.spec.ts`
  - `yarn workspace @affine/server test src/core/selfhost/__tests__/static.spec.ts`
  - `yarn prettier --check <combined changed files>`
  - `yarn eslint --no-cache <combined changed TS/TSX files>`
  - `git diff --check`
- Affected files: all source PR files plus this spec.
- Risk tier: R2. Verification-only.
- Rollback: keep original PRs open and do not publish the combined PR until failures are fixed.

### Task 3: GitHub PR handoff

- Intended behavior: one combined PR replaces the three pending source PRs for review.
- Test names: `gh pr view <combined-pr> --json mergeStateStatus,statusCheckRollup`; `gh pr list --state open`.
- Affected files: GitHub PR state, not source code.
- Risk tier: R1 because it changes reviewer workflow by closing superseded PRs.
- Rollback: reopen superseded PRs from GitHub and close the combined PR.

## Verification Strategy

Run the focused checks from each source PR rather than a broad repo-wide suite first, because this consolidation composes already-reviewed slices. If focused checks pass, run a quick diff sanity check and rely on GitHub checks for any broader CI gates attached to the combined PR.
