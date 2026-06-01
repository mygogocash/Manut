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

### PR 3 — Token and OAuth Hardening

- Re-check token freshness after refresh-lock waits.
- Remove raw LINE provider response bodies from user-visible errors.
- Escape OAuth callback script payloads.
- Add ACL/rate-limit checks for stateless connection-test mutations.
- Gate paid recommendation generation on settings-update permission.

### PR 4 — Routines Honesty

- Either implement a bounded, tested Vertex-backed routine runner, or relabel
  the live "Run now" CTA as a preview queue action.

## Lane 3 — AI Chat Upgrade

- Add prompt-eval fixtures and a repeatable runner.
- Tighten Read/Edit/Agent prompt addenda.
- Improve Auto model routing with eval coverage.
- Render tool/source status chips in the assistant transcript.
- Add hybrid keyword + semantic retrieval with citation metadata.
- Add shadow response verification for workspace-grounded answers.
- Harden memory preferences and provider cache behavior after evals exist.

## Lane 4 — Product Feature Completion

- PM/CRM/Reminders v1: detail/edit, Kanban, reminder rules, drag-drop,
  bulk/CSV, real-time updates, and mobile views.
- Knowledge Graph: review the existing lobe/pulse branch, add reduced-motion
  and accessibility coverage, then decide whether to merge for the next release.

## Lane 5 — Analytics and Social Integrations

- Confirm Meta, TikTok, and LINE ownership/approval state.
- Finish platform approval checklist and legal/compliance pages.
- Add Meta account picker after OAuth.
- Add token refresh cron and anomaly-detector ingestion wiring.
- Add `insightCreated` subscription or equivalent socket event.
- Remove or revise LINE VOOM claims if partner/API access is unavailable.

## Lane 6 — UX, Rename, Docs, and Ops

- Add loading states, honest error panels, first-run onboarding, and better
  integrations copy.
- Sweep remaining AFFiNE/Superflow user-facing rename drift.
- Refresh or archive stale beta/Railway launch docs.
- Add Cloud Monitoring alerts, load-test staging, Terraform for manual GCP
  resources, status page wiring, and long-tail CI/CD Tier 3 work.

## Current Slice

Active slice: **Lane 2 / PR 3 — Token and OAuth Hardening**.

Exit criteria:

- Focused OAuth/token hardening tests pass.
- Backend typecheck passes or any pre-existing environment blocker is recorded.
- No unrelated files are staged.

Completed in this branch:

- Lane 2 / PR 1 — Connection Resolver Authorization.
- Lane 2 / PR 2 — Social Connection Bridge for Facebook, Instagram, Threads,
  TikTok, and LINE VOOM callback paths, plus settings-card health labels.
