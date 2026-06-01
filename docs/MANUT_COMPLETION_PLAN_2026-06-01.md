# Manut Completion Plan — 2026-06-01

This is the execution tracker for the post-QA completion plan. It consolidates
the currently actionable items from the handoff, QA audit, AI-chat spec, launch
docs, and roadmap docs.

## Execution Order

1. Production safety and backend gates.
2. Backend QA batch.
3. AI chat quality upgrade.
4. PM/CRM/Reminders v1 and Knowledge Graph follow-ups.
5. Analytics/social integration completion.
6. UX, rename, documentation, and operations backlog.

## Lane 1 — Production Safety

- Rotate leaked committed secrets and purge history with an agreed operator
  window.
- Apply and verify pending production migrations for Manut, social analytics,
  MongoDB, and control-plane tables.
- Re-run Cloud Run smoke for `Manut,Copilot`.
- Confirm the rollback target before every production traffic flip.
- Update stale Railway references in operator docs to the current GCP Cloud Run
  deployment path.

## Lane 2 — Backend QA Batch

### PR 1 — Connection Resolver Authorization — Done

- Add `Workspace.Settings.Update` checks to connection write mutations.
- Add `Workspace.Read` checks to connection read queries.
- Cover PostHog, GoGoCash, Facebook OAuth, and generic connections.
- Verify with focused no-database resolver tests and backend typecheck.

### PR 2 — Social Connection Bridge — Done

- Upsert `SocialConnection` from the social OAuth callback path while retaining
  the existing `IntegrationConnection` rows.
- Add a verified/health signal so settings cards distinguish saved credentials
  from verified credentials.

### PR 3 — Token and OAuth Hardening — Done

- Re-check token freshness after refresh-lock waits.
- Remove raw LINE provider response bodies from user-visible errors.
- Escape OAuth callback script payloads.
- Add ACL/rate-limit checks for stateless connection-test mutations.
- Gate paid recommendation generation on settings-update permission.

### PR 4 — Routines Honesty — Done

- Either implement a bounded, tested Vertex-backed routine runner, or relabel
  the live "Run now" CTA as a preview queue action.

## Lane 3 — AI Chat Upgrade

- Add prompt-eval fixtures and a repeatable runner. — Done
- Tighten Read/Edit/Agent prompt addenda. — Done
- Improve Auto model routing with eval coverage. — Done
- Render tool/source status chips in the assistant transcript. — Done
- Add hybrid keyword + semantic retrieval with citation metadata. — Done
- Add shadow response verification for workspace-grounded answers. — Done
- Harden memory preferences and provider cache behavior after evals exist. —
  Done

## Lane 4 — Product Feature Completion

- PM/CRM/Reminders v1: detail/edit, Kanban, reminder rules, drag-drop,
  bulk/CSV, real-time updates, and mobile views.
  - Gap audit: project detail/edit, task create/edit/delete, PM Kanban,
    CRM detail/edit, CRM deal Kanban, reminder rule UI, and reminder rule
    resolvers are already present.
  - Reminder rule materialization is now done: the minute cron creates a
    scheduled reminder once per matching DATETIME rule/minute using
    `MnReminderRun` dedupe.
  - CRM CSV export is now done for Accounts, Contacts, Deals, and Activities
    from the loaded tab data, with stable headers and CSV escaping.
  - PM CSV export is now done for loaded project lists and project-detail task
    lists, reusing the same CSV escaping and spreadsheet formula guard.
  - Reminders CSV export is now done for active reminder tabs and the rule
    list, also using shared CSV escaping and spreadsheet formula neutralization.
  - Realtime fallback refresh is now done: PM, CRM, and Reminders data queries
    opt into a shared 30-second SWR refresh interval so concurrent edits become
    visible without manual reloads while full subscriptions remain optional.
  - Mobile-specific PM/CRM/Reminders layouts are now done: narrow viewport
    styles stack dense toolbars, tabs, task rows, CRM rows, reminder cards, and
    form grids without requiring horizontal page overflow.
  - Remaining: future non-EMAIL reminder channels.
- Knowledge Graph: reviewed the lobe/pulse branches. Both
  `feat/knowledge-graph-brain-and-pulses` and
  `feat/knowledge-graph-node-detail-panel` are already ancestors of this branch
  through PR #183 / `454b0e747`; no additional merge is needed for the next
  release. Reduced-motion, hidden-tab pause, rest-gate, physics cap, and canvas
  accessibility contracts are covered.

## Lane 5 — Analytics and Social Integrations

- Confirm Meta, TikTok, and LINE ownership/approval state.
- Finish platform approval checklist and legal/compliance pages.
  - Legal/compliance pages are now implemented for `/legal/privacy`,
    `/legal/terms`, and `/legal/data-deletion-instructions`.
  - Remaining approval work is external setup/review: configure Meta/TikTok/LINE
    app dashboards, submit review artifacts, and confirm LINE VOOM API access.
- Meta account picker after OAuth. — Done
- Token refresh cron and anomaly-detector ingestion wiring. — Done
- `insightCreated` equivalent socket event. — Done via authenticated SSE at
  `/api/workspace/:workspaceId/analytics/insights-stream`.
- Platform recent-event deep dives. — Done via `listEvents`, with
  Workspace.Read enforcement, range validation, bounded results, and frontend
  rendering from normalized `social_events` payloads.
- Remove or revise LINE VOOM claims if partner/API access is unavailable. —
  Done for user-facing copy: labels now use LINE Official Account wording and
  VOOM post analytics are described as hidden until LINE confirms API access.
- Fix LINE channel-mode ingestion mismatch. — Done for the v1 channel path:
  connection completion validates LINE Login, stores configured Messaging API
  channel credentials, and webhook ingestion resolves by webhook `destination`
  before falling back to source identity.

## Lane 6 — UX, Rename, Docs, and Ops

- Add loading states, honest error panels, first-run onboarding, and better
  integrations copy.
- Sweep remaining AFFiNE/Superflow user-facing rename drift.
- Refresh or archive stale beta/Railway launch docs.
- Add Cloud Monitoring alerts, load-test staging, Terraform for manual GCP
  resources, status page wiring, and long-tail CI/CD Tier 3 work.

## Current Slice

Active slice: **Lane 5 — Analytics and Social Integrations / approval/legal
readiness and remaining platform-specific polish**.

Exit criteria:

- Choose the smallest next production-safe vertical slice.
- Add or update focused tests before changing behavior.
- Backend/frontend typecheck passes or any pre-existing environment blocker is
  recorded.
- Changed TypeScript files pass eslint, oxlint, and Prettier.
- No unrelated files are staged.

Completed in this branch:

- Lane 2 / PR 1 — Connection Resolver Authorization.
- Lane 2 / PR 2 — Social Connection Bridge for Facebook, Instagram, Threads,
  TikTok, and LINE VOOM callback paths, plus settings-card health labels.
- Lane 2 / PR 3 — Token and OAuth Hardening: stale-token refresh-lock guard,
  LINE provider error redaction, inline OAuth callback payload escaping,
  stateless connection-test ACL/throttle checks, and content-recommendation
  settings-update gate.
- Lane 2 / PR 4 — Routines Honesty: relabeled routine execution as a preview
  queue action and clarified worker output so users are not told Vertex/AI work
  ran.
- Lane 3 — AI Chat Eval Foundation: added deterministic prompt-eval fixtures,
  a focused AVA spec, and `yarn workspace @affine/server manut:eval-ai-chat`
  so chat prompt/model/citation/routing invariants are checked before prompt
  tuning.
- Lane 3 — Prompt Addenda: backend now injects short Read/Edit/Agent
  `<mode_guidelines>` based on the same `toolsConfig` write flags the frontend
  Mode picker sends, and eval coverage checks all three addenda.
- Lane 3 — Auto Routing: `modelId=auto` now combines scenario classification
  with the existing high-signal auto-router so long-context chat goes to
  Gemini Pro, code-heavy chat goes to Claude Sonnet, image-attached text chat
  stays on Gemini Flash, and complex text uses the Pro scenario default.
- Lane 3 — Tool/Source Status Chips: assistant transcript now summarizes tool
  use, checked sources, write actions, and tool failures from merged
  `StreamObject` chunks; the previous write chip now recognizes camelCase tool
  names and completed `tool-result` chunks.
- Lane 3 — Hybrid Retrieval: added `docHybridSearch` / `doc_hybrid_search`
  to combine keyword and semantic workspace results with reciprocal-rank
  fusion, citation-ready result metadata, prompt-eval coverage, Read-mode
  tool defaults, assistant source chips, and a dedicated tool-result card.
- Lane 3 — Shadow Grounding Verification: object-stream chat saves now run a
  non-blocking verifier over workspace-source tool results and final citation
  footnotes, logging warnings for missing inline citations, missing reference
  lists, invalid reference JSON, or citations unsupported by retrieved sources.
- Lane 3 — Memory and Cache Hardening: the chat request interceptor now
  injects relevant user/workspace memories by default, honors
  `toolsConfig.memory=false` as an opt-out, falls back to the original prompt
  on memory failures, and includes a prompt-cache planner that only marks
  stable Anthropic prefixes as cacheable while refusing dynamic private
  context.
- Lane 4 — Reminder Rule Materialization: the reminder cron now evaluates
  enabled DATETIME reminder rules, creates one scheduled reminder per matching
  rule/minute with `MnReminderRun` dedupe, marks successful runs, and leaves the
  UI channel picker aligned with the backend-supported `EMAIL` enum.
- Lane 4 — Realtime Refresh Fallback: PM, CRM, and Reminders frontend queries
  now share a 30-second SWR refresh interval so loaded workspace data catches up
  automatically after external edits or another tab changes the same records.
- Lane 4 — Mobile Layout Fallbacks: PM, CRM, Reminders, project detail, and the
  shared Kanban board now include 640px responsive rules for stacked actions,
  one-column dense rows/forms, scroll-safe tab strips, and narrower page
  padding.
- Lane 4 — Knowledge Graph Decision: the lobe/pulse and node-detail branches
  were already merged through the QA-audit frontend wave, and a regression
  contract now locks the canvas a11y, reduced-motion, hidden-tab pause,
  rest-gate, and physics-cap safeguards.
- Lane 5 — Live Insight Stream: added a workspace-scoped Analytics insight
  event bus, authenticated SSE endpoint, frontend EventSource subscriber, and
  publisher hooks for content recommendations, trend detection, and anomaly
  detection so AI Strategist pages can update without manual refresh.
- Lane 5 — LINE Channel Mode Correction: LINE connection completion now
  validates the LINE Login code but persists the configured Messaging API
  channel token/id as the workspace connection, and LINE webhook ingestion uses
  the webhook `destination` channel id before falling back to legacy source ids.
- Lane 5 — Metrics Listing: `listMetrics` now enforces Workspace.Read, validates
  the requested time window, queries `social_metrics` by workspace/platform/
  bucket/range, returns rows in chart-safe order, and caps the response at 5000
  rows.
- Lane 5 — Metric Rollups: added `MetricRollupService` and wired the scheduled
  crons. Hourly rollups backfill metrics from `social_events`, daily rollups
  aggregate HOUR rows into DAY rows, and weekly rollups aggregate DAY rows into
  WEEK rows with idempotent upserts.
- Lane 5 — Platform Metric Deep Dives: platform pages now call `listMetrics`
  for the selected platform, render latest metric rows as KPI cards, and build
  trend charts from real `social_metrics` rows instead of relying on the
  mock-backed legacy analytics entity.
- Lane 5 — Platform Recent Events: platform pages now call `listEvents` for
  the selected platform, render newest normalized `social_events` rows, and
  keep raw webhook payloads out of the GraphQL/UI surface.
- Lane 5 — Legal Approval Pages: landing/static routes now serve
  `/legal/privacy`, `/legal/terms`, and `/legal/data-deletion-instructions`;
  the privacy page explicitly names Facebook, Instagram, Threads, TikTok, and
  LINE integration data handling.
- Lane 5 — LINE Copy Honesty: frontend labels and connection-card copy now use
  LINE Official Account wording; VOOM post analytics are explicitly marked as
  gated on confirmed API access instead of promised in the product UI.

Known verification blocker:

- `node_modules/.bin/tsc --noEmit -p packages/frontend/core/tsconfig.json`
  currently reports pre-existing Blocksuite project-reference/decorator errors
  in chat-panel files. Focused Vitest, eslint/oxlint, and
  `yarn affine bundle -p web` passed for the current analytics frontend
  slices.
