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
- Read-only production verification on 2026-06-01:
  - Cloud Run service `manut` is Ready on revision `manut-00015-wix`, image
    `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:0220ad1`.
  - Migration jobs `manut-migrate`, `manut-staging-migrate`, and
    `manut-pg18-migrate-20260527001726` report Ready; latest production
    execution `manut-migrate-8zhq8` completed successfully on
    2026-05-27T11:55:24Z.
  - Required production Secret Manager names are present for database URL,
    config JSON, private key, Google OAuth client id/secret, and Resend API key
    without exposing secret values.
  - `BASE_URL=https://manut.xyz TIMEOUT_SECONDS=120
scripts/gcp/smoke-test-cloud-run.sh` passed, `/info` reports
    `Manut 0.26.3 Server`, GraphQL `serverConfig.initialized=true`, and
    `serverConfig.features` includes `Manut` and `Copilot`.
  - Cloud Run domain mapping for `manut.xyz` is Ready; no Cloud Run
    `severity>=ERROR` entries were returned for service `manut` since
    2026-06-01T00:00:00Z.
  - This verifies the production revision deployed as of 2026-06-02 only.
    Later follow-up images are not automatically deployed; launch still
    requires an explicit deploy, migration-job run when applicable, and
    post-deploy smoke before claiming production contains those changes.
- Production deployment verification on 2026-06-02:
  - PR #185 merged to `main` as `9da65ae8f2c1a4cf539cf2b24b865d7bce5e4d7b`.
  - Main CI run `26790920840` and CodeQL run `26790920444` completed
    successfully for the merge commit.
  - Manut Build run `26791041596` completed successfully and pushed
    `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:main-9da65ae8f-26791041596`
    with digest `sha256:9c80dd364657d0cef7558bcf3c5638103efb09837f23425c28130a92c7bf7e3f`.
  - First deploy run `26791480886` failed before production swap because
    Prisma blocked on a historical failed migration row for
    `20260518230000_add_mn_m12_m13_m15_m17_research_milestones`.
    The row was verified to contain only the old duplicate-column failure,
    then marked `rolled_back` with Prisma migrate resolve.
  - Second deploy run `26791699640` applied the idempotent migration and
    swapped production to the new image, but the prompt-seed psql wrapper
    returned `rc=124` after already emitting count `3`; manual DB verification
    confirmed all three canonical prompts existed.
  - `scripts/vm/deploy.sh` was hardened and installed on the VM so a complete
    numeric prompt count matching the expected total is accepted even if the
    wrapper exits non-zero.
  - Final deploy run `26791969196` completed successfully:
    sidecar `/info` validated, migrations completed, production `/info`
    became healthy on `main-9da65ae8f-26791041596`, prompt seed reported
    `PROMPT-SEED OK — 3/3`, and `deploy.sh` exited `0`.
  - Public smoke passed after deploy: `https://manut.xyz/info` returned
    `Manut 0.26.3 Server`; GraphQL `serverConfig.initialized=true` and
    `features=["Comment","Manut","Copilot","OAuth","LocalWorkspace","CopilotEmbedding"]`.
  - VM evidence confirmed `affine_server` is running image
    `main-9da65ae8f-26791041596`, and the migration table contains the old
    rolled-back row plus a new finished row for
    `20260518230000_add_mn_m12_m13_m15_m17_research_milestones`.
- Update stale Railway references in operator docs to the current GCP Cloud Run
  deployment path. — Done for the production deploy runbook and launch
  readiness checklist; Railway is now documented only as source-data or
  rollback context where applicable.
- Fix backend startup gates surfaced by focused invite/email verification. —
  Done for the current DI blockers: `ConnectionsModule` imports
  `PermissionModule`, and `ChatRequestInterceptorService` uses a runtime
  `PromptService` import so Nest can resolve constructor metadata.

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
- Add Save as doc for generated AI drafts. — Done via PR #191
- Add Full Agent beta plan-act-report UX and compact task cockpit readout. —
  Done via PR #192
- Review beta completion metrics after live use. — Pending; PR #192 records the
  first non-sensitive telemetry events but no dashboard or beta analysis is
  complete yet.
- Bind the compact task cockpit to live Manut task/plan/approval/work-product
  data in the chat shell. — Pending follow-up
- Build the inspectable citation/source drawer with snippets and doc-open
  actions. — Pending follow-up

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
  - Remaining: future non-EMAIL reminder channels. Current audit confirms this
    should stay deferred until provider selection, credentials, consent,
    unsubscribe/compliance, status callbacks, retry/rate-limit, and cost-control
    work is approved; adding enum values alone would expose a broken delivery
    contract.
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
  - Admin/operator UI and hardcoded core web copy are now refreshed for Manut
    branding in setup, sidebar/about labels, custom-key disclaimers, first-run
    seed text, cloud sync labels, and diagnostic error copy.
  - Remaining rename-drift candidate is payment catalog labels that may be tied
    to provider state and should move only with Stripe/provider confirmation.
- Refresh or archive stale beta/Railway launch docs.
  - Production deploy runbook and launch readiness checklist are refreshed for
    Cloud Run, Cloud Build, Cloud SQL, Secret Manager, and Cloud Monitoring.
  - Beta go/no-go, risk register, pentest plan, and launch comms template are
    refreshed for Cloud Run revision/image/migration-job/log/smoke evidence.
    Remaining beta-era docs can be archived or refreshed as they become active
    launch inputs.
- Add Cloud Monitoring alerts, load-test staging, Terraform for manual GCP
  resources, status page wiring, and long-tail CI/CD Tier 3 work.
  - Status page runbook is now drafted in
    [STATUS_PAGE_RUNBOOK.md](./STATUS_PAGE_RUNBOOK.md), with provider/API-token
    fields intentionally left as TBD until the launch operator selects the
    approved provider and secret path.

## Current Slice

Active slice: **Post-PR #191/#192 AI Chat Full Agent beta docs refresh**, plus
launch-gate tracking for post-merge main CI/build, authenticated AI smoke, and
production deploy evidence.

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
- Lane 3 — Model Catalogue Safety: the chat picker now exposes only stable
  Vertex-backed entries; Gemini 3.1 previews and Claude 4.6/4.7
  default-version IDs remain provider-side only until authenticated
  production send/stream smoke confirms them.
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
- Lane 3 — Save Generated AI Drafts: PR #191 adds a Save as doc action for
  generated AI content so users can persist independent/floating chat drafts.
- Lane 3 — Full Agent Beta UX Foundation: PR #192 adds plan cards, richer tool
  timeline rows, source/action chips, awaiting-approval and failed states,
  completion actions, productivity empty-state prompts, prompt evals for
  planning/Thai/source-grounded/task-completion cases, and non-sensitive
  completion telemetry.
- Lane 3 — Compact Task Cockpit Readout: PR #192 adds the presentational Manut
  task cockpit surface for bound task, current plan, execution status,
  approvals, produced work, execution-lock state, and verify-done evidence. It
  reuses existing Manut DTOs and does not create a new autonomous runtime or
  database table.
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
- Lane 5 — Platform Route and Mobile Hardening: platform pages now normalize
  enum keys, snake-case slugs, and kebab-case slugs such as `line-voom` to the
  same platform key, render product-facing platform labels, and keep chart grids
  within narrow mobile viewports.
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
- Lane 6 — Cloud Run Operator Docs: the production deploy runbook and launch
  readiness checklist now use Cloud Build, Cloud Run, Cloud SQL, Secret
  Manager, Cloud Monitoring, and Cloud Run log smoke as the active production
  path; Railway remains only as explicitly historical source-data or rollback
  context.
- Lane 6 — Beta Launch Docs: beta go/no-go, risk register, pentest plan, and
  launch comms template now require Cloud Run revision/image/migration-job/log/
  smoke evidence and no longer treat Railway deployment ids as current launch
  proof.
- Lane 6 — Staging Load-Test Template: added a dry-run-first repo script for
  low-impact staging checks, with explicit `BASE_URL` for real runs, local curl
  stop conditions, optional `autocannon`/`k6` command expectations, and a
  production-domain refusal guard.
- Lane 6 — Monitoring Templates: added repo-only Terraform scaffolds for Cloud
  Run, Cloud SQL, Redis, and Vertex/provider error alerts under `infra/gcp/`,
  with alerts disabled by default until notification channels, Terraform state,
  resource ids, and the provider error metric are operator-approved.
- Lane 6 — Rename Drift Cleanup: admin/operator UI labels and hardcoded core
  web copy now use Manut/Manut Cloud where visible to users or operators, while
  internal ids, package names, and upstream URLs remain unchanged.
- Lane 6 — AI/MCP Branding Cleanup: canonical seeded chat prompts, frontend
  chat prompt callers, prompt seed gates, MCP server metadata, MCP config notes,
  sync-required tool errors, slash-menu AI grouping, and Connections panel copy
  now use Manut-facing names. Internal protocol keys such as
  `affine_workspace_*`, package names, and upstream URLs remain unchanged.
- Lane 6 — Native and Contributor Entry Branding: mobile package/readme copy,
  Electron tray/dialog/metainfo copy, issue templates, CI setup docs, and
  contributor reference docs now use Manut-facing names. Compatibility-bound
  package names, app ids, file extensions, deeplink schemes, and upstream
  attribution URLs remain unchanged.
- Lane 1 — Backend Startup DI Gates: focused invitation resend e2e initially
  failed before executing tests on missing `AccessController` and
  `PromptService` DI metadata. `ConnectionsModule` now imports
  `PermissionModule`, and `ChatRequestInterceptorService` imports
  `PromptService` at runtime.
- Lane 1 — Invitation Resend UI Guard: pending-invite resend actions now use a
  synchronous in-flight guard and disabled menu state so duplicate activations
  cannot enqueue duplicate resend requests while the first request is pending.
- Lane 1 — Production Read-Only Smoke: GCP read-only verification confirms the
  currently deployed production revision is healthy on Cloud Run, has the
  expected secret references, has a successful latest migration execution, and
  passes public `/info` + GraphQL `serverConfig` smoke for `Manut,Copilot`.
  This is production evidence for image `0220ad1`, not a deploy of this
  follow-up branch.
- PR #185 Production Deploy: production is now running
  `main-9da65ae8f-26791041596` from merge commit `9da65ae8`, with final deploy
  workflow `26791969196` green, public `/info` healthy, GraphQL
  `serverConfig` initialized with `Manut` and `Copilot`, prompt seed `3/3`, and
  the previously failed Prisma migration repaired via a rolled-back historical
  row plus a new finished application row.
- PR #191 AI Save as Doc: merged to `main` at
  `c7334e953d1da3357086b1afb328d6977b322e51` with green PR-level Manut CI,
  CodeQL, Beta Security Gate, and `manut-gcp-pr-ci`.
- PR #192 Full Agent Beta: merged to `main` at
  `c0674d559db5d530586546b91d02758ac4033e44` with green PR-level Manut CI,
  CodeQL, Beta Security Gate, `manut-gcp-pr-ci`, focused frontend/backend
  tests, and `yarn affine bundle -p web` before merge. Main CI run
  `26893957469` and CodeQL run `26893953860` are green for this commit; Build
  #144 / run `26894183272` was still in progress at 2026-06-03 22:16 +07. No
  production deploy or authenticated smoke had been run for the PR #191/#192
  code state.

Known verification blocker:

- `yarn workspace @affine/server e2e src/__tests__/e2e/workspace/member.spec.ts --match='workspace invitation resend*'`
  now passes the fixed DI boot blockers but cannot complete in this local
  environment because Redis is not listening on `127.0.0.1:6379` and
  `DATABASE_URL` is unset.
- `node_modules/.bin/tsc --noEmit -p packages/frontend/core/tsconfig.json`
  currently reports pre-existing Blocksuite project-reference/decorator errors
  in chat-panel files. Focused Vitest, eslint/oxlint, and
  `yarn affine bundle -p web` passed for the current analytics frontend
  slices.
- Authenticated AI smoke for the PR #191/#192 main state is still pending:
  floating chat, full chat, Save as doc, Full Agent mode, task link/cockpit,
  source chips, approval toggle path, and retry after failed tool.
