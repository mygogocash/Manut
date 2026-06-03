# Manut UX/UI Bughunt - 2026-06-02

Scope: current `main` at `2cb0d4223`, with read-only code audit, prior QA handoff review, and public production smoke. No product code was modified.

Public smoke:

- `https://manut.xyz/info` returns Manut 0.26.3 selfhosted allinone.
- `/graphql` `serverConfig` returns initialized `true` and features `Comment`, `Manut`, `Copilot`, `OAuth`, `LocalWorkspace`, `CopilotEmbedding`.

Limitations:

- Authenticated app flows were audited from code and prior QA handoff, not browser-reproduced in this session.
- Findings below should be converted into focused failing tests before implementation.

## Fix Status - 2026-06-03

Implementation branch: `codex/fix-ux-ui-bughunt`.

Implementation commit:
`b57f4ae1f fix(manut): resolve ux bughunt regressions`.

Merge/build status:

- PR #188 merged to `main` at
  `35bc631166d5c3d82f892793283ba990f417a54d`.
- Build #141 / run `26876250444` passed and pushed image tag
  `main-35bc63116-26876250444`.
- PR #189 merged the handover refresh at
  `ac059984949b0400ef0219bcea4df398ca73f057`; Build #142 / run
  `26877703841` passed and pushed latest main image tag
  `main-ac0599849-26877703841`.
- Production has not been deployed from the latest main image. Public smoke
  passed on 2026-06-03 18:24 +07; authenticated smoke remains blocked pending a
  smoke account, verification code, or signed-in browser session.

Fixed:

- P1 invite acceptance fallthrough now returns immediately after accepting a pending email role.
- P1 Google OAuth typed errors now rethrow `BadRequest` user-friendly errors instead of plain `Error`.
- P1 Copilot object-stream actions now preflight AI budget and record realised spend on completed streams.
- P1 Budget and Work Queues are removed from the visible settings sidebar and direct deep links render honest unavailable copy.
- P1 initial narrow-screen sidebar observation now immediately applies hide/float behavior.
- P1 mobile Ask AI opens with focus on the dialog sheet, not the textarea.
- P1 floating AI tabs now use sibling select/close controls with larger close targets.
- P2 settings anchor scrolling, settings sidebar keyboard activation, integration-card keyboard activation, AI source-card controls, mobile focus-visible outlines, bottom mobile app-tab semantics, self-hosted billing redirect, and analytics connection error copy are fixed.

Verification run:

- `yarn workspace @affine/server test src/__tests__/manut/ux-bughunt-regressions.spec.ts --timeout=1m`
- `yarn workspace @affine/server tsc --noEmit`
- `yarn vitest run packages/frontend/core/src/__tests__/manut-ux-bughunt.spec.ts`
- `yarn eslint --no-cache <touched frontend files>`

Known remaining verification gap:

- Full frontend project-reference typecheck is still blocked by the repo's existing prebuild state (`TS6305` missing `blocksuite/**/dist/*.d.ts` outputs), as reported by both frontend subagents. Targeted lint and contract tests passed.

Next continuation checklist:

1. Run authenticated browser smoke for invite acceptance, Google integration
   friendly errors, AI object-stream actions, AI source cards, mobile Ask AI,
   floating AI tabs, hidden Budget/Work Queue settings deep links, and analytics
   connection error copy.
2. Deploy only after smoke passes, then update `docs/CICD_ROADMAP.md` with the
   real production revision, image digest, public smoke evidence, and rollback
   target.

## Highest Priority Findings

### P1 - Budget and Work Queues settings are visible but not wired

Evidence:

- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/index.tsx:71` renders `BudgetDashboard` with only `workspaceId`.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/index.tsx:74` renders `WorkQueuesPanel` with only `workspaceId`.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/budget/budget-dashboard.tsx:30` expects optional fetchers and line 63 returns early when no fetcher exists.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/budget/budget-dashboard.tsx:117` then shows "No spend recorded".
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/work-queues/work-queues-panel.tsx:52` expects optional `projectId` and fetchers.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/work-queues/work-queues-panel.tsx:401` shows "Select a project" with no project selector.

UX impact: users see operational settings that look empty rather than unavailable or not connected.

Fix direction: hide these tabs until wired, or inject real query/mutation fetchers plus a project selector and loading/error states.

### P1 - Initial small-screen sidebar state can be wrong

Evidence:

- `packages/frontend/core/src/components/hooks/use-responsive-siedebar.ts:47` stores the first observed width and returns without applying small-screen logic.
- `packages/frontend/core/src/modules/app-sidebar/entities/app-sidebar.ts:20` defaults the sidebar to open.

UX impact: first load on narrow screens can keep the desktop sidebar inline until a resize event, squeezing or obscuring content.

Fix direction: apply hide/float rules on the first observed width, then keep existing threshold-crossing behavior for later resizes.

### P1 - Mobile Ask AI auto-focuses into a locked full-height sheet

Evidence:

- `packages/frontend/core/src/mobile/pages/workspace/home.tsx:220` focuses the chat input after opening.
- `packages/frontend/core/src/mobile/pages/workspace/home.tsx:201` locks body scroll.
- `packages/frontend/core/src/mobile/pages/workspace/home.css.ts:134` makes the sheet nearly full viewport height.

UX impact: phone keyboards can cover the composer or messages immediately after opening Ask AI.

Fix direction: avoid auto-focus on touch opens, add visual-viewport or virtual-keyboard handling, and reserve safe-area/keyboard padding.

### P1 - Floating AI tabs use invalid nested buttons and tiny close targets

Evidence:

- `packages/frontend/core/src/components/floating-ai-chat-anchor/chat-tabs.tsx:86` renders each tab as a `button`.
- `packages/frontend/core/src/components/floating-ai-chat-anchor/chat-tabs.tsx:111` nests another `button` inside it for close.
- `packages/frontend/core/src/components/floating-ai-chat-anchor/chat-tabs.css.ts:124` sets the close target to 14px by 14px.

UX impact: invalid interactive markup causes inconsistent keyboard/screen-reader behavior, and the close affordance is too small on touch devices.

Fix direction: split tab select and close into sibling controls with at least 44px mobile hit targets or hit-slop.

### P1 - Google integration "friendly" errors still become internal errors

Evidence:

- `packages/backend/server/src/plugins/google-oauth/google-oauth.resolver.ts:113` maps typed OAuth errors to plain `Error`.
- `packages/backend/server/src/base/nestjs/exception.ts:42` maps arbitrary errors through the generic user-friendly conversion path.

UX impact: users can still see "internal error" when the correct message should be "connect/reconnect/configure Google".

Fix direction: emit `UserFriendlyError` variants or explicitly map Google OAuth typed errors before GraphQL/SSE error serialization.

### P1 - Accepting an invite link can undo an accepted pending email invite

Evidence:

- `packages/backend/server/src/core/workspaces/resolvers/member.ts:575` accepts a pending email role.
- The method then falls through to `acceptInvitationByLink` at `packages/backend/server/src/core/workspaces/resolvers/member.ts:583`.
- `packages/backend/server/src/core/workspaces/resolvers/member.ts:660` sets the member to `UnderReview`.

UX impact: a user can accept an invite and then appear as waiting for review.

Fix direction: return immediately after `acceptInvitationByEmail(role)`.

### P1 - Copilot object-stream actions bypass AI budget accounting

Evidence:

- Text stream preflights budget at `packages/backend/server/src/plugins/copilot/controller.ts:398` and records spend at line 461.
- Object stream begins at `packages/backend/server/src/plugins/copilot/controller.ts:496` without equivalent budget gate or spend recording.

UX impact: structured AI actions can consume budget while quota UI remains inaccurate.

Fix direction: share budget preflight/finalize accounting across text, object, and image stream endpoints.

## Accessibility And Interaction Findings

### P2 - Settings scroll anchors are canceled by top-scroll reset

Evidence:

- `packages/frontend/core/src/desktop/dialogs/setting/index.tsx:186` scrolls an anchor into view.
- `packages/frontend/core/src/desktop/dialogs/setting/index.tsx:197` immediately scrolls the wrapper to top.

Fix direction: only reset to top when no anchor exists or no target was found.

### P2 - Settings sidebar and integration cards are mouse-first

Evidence:

- `packages/frontend/core/src/desktop/dialogs/setting/setting-sidebar/index.tsx:127` renders setting items as clickable `div`s.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/card.tsx:71` renders non-link integration cards as clickable `div`s.

Fix direction: use real buttons/links or add role, tab index, Enter/Space behavior, focus styles, and selected-state ARIA.

### P2 - AI source cards are not keyboard-friendly

Evidence:

- `packages/frontend/core/src/blocksuite/ai/components/ai-tools/tool-result-card.ts:260` uses a clickable `div` header for expansion.
- `packages/frontend/core/src/blocksuite/ai/components/ai-tools/tool-result-card.ts:272` renders result rows as anchors even when no `href` exists.
- `packages/frontend/core/src/blocksuite/ai/components/ai-tools/doc-hybrid-search-result.ts:87` uses `onClick` to open docs instead of an accessible link/button contract.

UX impact: users can see "Checked sources" chips but cannot reliably inspect sources from keyboard or assistive tech.

Fix direction: make expansion a button with `aria-expanded`, and render source rows as real links/buttons with keyboard handlers and focus states.

### P2 - Mobile focus indicators are globally suppressed

Evidence:

- `packages/frontend/core/src/mobile/styles/mobile.css.ts:36` removes focus outlines from links.
- `packages/frontend/core/src/mobile/styles/mobile.css.ts:39` removes focus outlines from buttons.

Fix direction: only suppress mouse-focus via `:focus:not(:focus-visible)`, then add shared `:focus-visible` styles for mobile controls.

### P2 - Bottom mobile app tabs are small and semantically fragile

Evidence:

- `packages/frontend/core/src/mobile/components/app-tabs/styles.css.ts:50` creates 36px tab targets.
- `packages/frontend/core/src/mobile/components/app-tabs/tab-item.tsx:30` uses clickable `li role="tab"` without full roving-focus keyboard behavior.

Fix direction: render real button/link tab controls, increase target size to at least 44px, and implement `aria-selected` plus keyboard navigation.

### P2 - Floating AI fullscreen mode needs safe-area and modal semantics

Evidence:

- `packages/frontend/core/src/components/floating-ai-chat-anchor/styles.css.ts:145` pins the panel to viewport edges under 768px.

Fix direction: add `aria-modal`, scroll lock, and `env(safe-area-inset-*)` padding for header/body/footer.

## Product UX Improvements

### P2 - AI answers need a stronger inspectable citations surface

Evidence:

- `packages/frontend/core/src/blocksuite/ai/chat-panel/message/assistant-status.ts:93` only summarizes sources as "Checked N sources".
- `packages/frontend/core/src/blocksuite/ai/chat-panel/message/assistant.ts:470` renders status chips but does not turn citations into a clear source drawer/list.

Opportunity: make workspace-grounded AI feel closer to Claude/ChatGPT by showing an explicit "Sources" area with doc title, snippet, and open action, plus inline footnote rendering.

### P2 - Raw provider/poller errors leak into user-visible connection health

Evidence:

- `packages/backend/server/src/plugins/analytics/connections/connection.resolver.ts:190` returns `lastError`.
- `packages/frontend/core/src/modules/analytics/views/connections-settings/index.tsx:317` renders the returned error.

Opportunity: expose normalized statuses such as "Token expired", "Rate limited", "Provider unreachable", and pair them with reconnect/help actions while keeping raw payloads in logs.

### P3 - Self-hosted Plans/Billing redirects to a hidden License tab

Evidence:

- `packages/frontend/core/src/desktop/dialogs/setting/index.tsx:176` redirects self-hosted plans/billing to `workspace:license`.
- `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/index.tsx:101` hides the License sidebar tab.

Fix direction: redirect to a visible self-hosted/FOSS info panel or keep License visible only as the target of that redirect.

## Recommended Fix Order

1. Fix the P1 backend state bugs: invite accept fallthrough, Google user-friendly errors, object-stream budget accounting.
2. Hide or wire Budget and Work Queues so Settings does not lie to users.
3. Fix mobile first-load and Ask AI keyboard behavior.
4. Fix floating AI tabs invalid markup and mobile safe-area behavior.
5. Improve AI source/citation inspectability.
6. Sweep accessibility issues: settings navigation, source cards, mobile focus-visible, and app tabs.

## Suggested Test Coverage

- Unit: invite accept should return after accepting a pending role.
- Unit/integration: Google OAuth typed errors serialize as actionable user-facing GraphQL errors.
- Unit: object-stream endpoint calls budget preflight and records spend on completion.
- Component: Budget/Work Queue tabs are hidden or show "not connected" unless fetchers are wired.
- Component: mobile Ask AI does not auto-focus on touch open and keeps composer visible with keyboard.
- Component/a11y: floating AI tabs have no nested interactive elements and close target meets touch size.
- Component/a11y: tool-result source cards expose button/link semantics and keyboard expansion/opening.
