# Manut Handover

Last reviewed: 2026-06-01 during the QA-audit completion branch. Since the
v1.12.0 cut, this branch has closed several v1 follow-ups: PM/CRM/Reminders
CSV export, reminder rule materialization, 30-second live refresh fallback,
mobile layout fallbacks, Knowledge Graph reduced-motion/accessibility
contracts, and the Analytics live insight SSE stream. v1.12.0 remains the
latest documented release cut in `docs/RELEASES/` until this branch is merged
and released.

This document is the tracked handover entry point for the GoGoCash Manut
fork of AFFiNE 0.26.3. It summarizes what a successor needs before
changing, building, or deploying the project.

## Current State

- Product: GoGoCash Manut, a fork of AFFiNE with AI agents, Vertex AI,
  self-host AI unlocks, Gmail/Drive integration, analytics work,
  v0 Projects/CRM/Reminders modules, and Manut-specific deployment
  automation.
- Live app: `https://manut.xyz`. The legacy `https://affine.gogocash.co`
  and `https://manut.gogocash.co` hosts both 301-redirect to the canonical
  domain.
- Repository: `https://github.com/mygogocash/Manut` (renamed from
  `mygogocash/Superflow`; GitHub redirects the old URL).
- Production status source: `docs/CICD_ROADMAP.md` records the latest
  validated production image and deploy chain; refresh it before
  trusting numbers from a stale handover.
- Branch model: Manut work lands on `main`; upstream AFFiNE workflows
  for `canary`/`master` are not the Manut deploy path.
- Feature gate: the Projects/CRM/Reminders frontend nav and the
  PM/CRM/Reminders backend resolvers are both gated on
  `ServerFeature.Superflow`, which the backend enables when
  `ENABLE_MANUT_MODULE=true` (legacy `ENABLE_SUPERFLOW_MODULE` is also
  honored).

## Source Of Truth

- `docs/HANDOVER.md` - start here for current ownership notes.
- `AGENTS.md` and `CLAUDE.md` - project Definition-of-Done, traps, testing,
  deploy rules, and commit conventions. They intentionally duplicate much
  of the same playbook for different agents.
- `docs/CICD.md` - deploy architecture and operator commands.
- `docs/CICD_ROADMAP.md` - current pipeline status, shipped tiers, backlog,
  and last validation notes.
- `docs/GCP_CLOUD_RUN_RUNBOOK.md` and `docs/MANUT_DEPLOY_RUNBOOK.md` -
  current Cloud Run deploy, migration, smoke, and rollback operator paths.
- `docs/MANUT_LAUNCH_CHECKLIST.md` - launch-window gates, now refreshed to
  treat Cloud Run revision/log evidence as the active production source.
- `docs/MANUT_CONTROL_PLANE.md` - Manut-native operating model for
  agent/company-style coordination, release handover artifacts, and future
  AFFiNE-facing control-plane work.
- `docs/RELEASES/v1.12.0.md` - latest release narrative (PM/CRM/Reminders
  v0 frontend + frontier model picker + analytics Connections fix).
  `docs/RELEASES/v1.11.0.md` is the brand-rename release.
  `docs/RELEASES/v1.10.2.md` is the Gmail/Drive integration release.
- `docs/analytics-platform.md` and `docs/analytics-approvals.md` - analytics
  product plan and external approval checklist.
- `scripts/manut-release-handover.mjs` - generates human and JSON
  control-plane handovers for CI build/release artifacts. Still emits
  filenames `superflow-handover.{md,json}` until the workflow-filename
  migration in `CLAUDE.md` §9.
- `scripts/gcp/*.sh` and `cloudbuild.manut-cloud-run.yaml` - executable GCP
  Cloud Run deploy, smoke, trigger, and migration-job helpers.
- `scripts/vm/deploy.sh`, `scripts/vm/rollback.sh`,
  `scripts/vm/compose.canary.yml` - legacy VM runbook. Keep for rollback
  archaeology only unless `docs/CICD_ROADMAP.md` says the VM path is active.
- `.github/workflows/superflow-*.yml` - CI, build, deploy, rollback,
  VM init, and release automation. Workflow filenames retain the old
  prefix; the display names ("Manut CI", "Manut Build", etc.) were
  updated during the rebrand.

## Code Layout After Rebrand

The brand rename touched concrete code paths. When grepping the codebase:

- Backend plugin: `packages/backend/server/src/plugins/manut/` (was
  `plugins/superflow/`). The historical
  `packages/backend/server/src/__tests__/manut/` test directory matches.
- Frontend modules: `packages/frontend/core/src/modules/manut-*` (was
  `modules/superflow-*`).
- i18n keys: `com.manut.*` (was `com.superflow.*`).
- Prisma models: `Mn*` (was `Sf*`). The DB migration ran in production in
  PR #26 — do not roll back the schema without coordinating.

Avoid using `DEPLOY_STATUS.md` as the main handover artifact. It is
root-local, ignored by `.gitignore`, and contains older timeline entries
that now conflict with `docs/CICD_ROADMAP.md`.

## Daily Quickstart

```bash
git status --short --branch
corepack enable
yarn install --immutable
yarn oxlint --deny-warnings
```

For deployable artifacts, build from repo root:

```bash
yarn affine bundle -p @affine/server
yarn affine bundle -p web
yarn affine bundle -p admin
yarn affine bundle -p mobile
```

Before bundling, preserve the known stale-source guard: delete generated
`*.js` and `*.js.map` under `packages/**/src` and `blocksuite/**/src`, but
do not delete `*.d.ts` files. See `AGENTS.md` / `CLAUDE.md` for the exact
incident notes.

## Deployment Path

Normal production path:

1. Push the approved commit to `main`.
2. Cloud Build trigger `manut-gcp-pr-ci` / required CI validates the commit.
3. Cloud Build trigger `manut-gcp-main-staging` keeps staging current.
4. The launch operator manually runs and approves `manut-gcp-prod-deploy`.
5. `cloudbuild.manut-cloud-run.yaml` builds the image, pushes to Artifact
   Registry, creates or updates `manut-migrate`, executes the migration job,
   deploys Cloud Run service `manut`, and smokes the generated Cloud Run URL.
6. After DNS cutover, `scripts/gcp/smoke-test-cloud-run.sh` must pass against
   `https://manut.xyz`.

Manual production deploy trigger:

```bash
gcloud builds triggers run manut-gcp-prod-deploy \
  --branch=main \
  --project=affine-495114 \
  --region=global
```

Manual public smoke:

```bash
BASE_URL=https://manut.xyz TIMEOUT_SECONDS=120 \
  scripts/gcp/smoke-test-cloud-run.sh
```

Rollback is Cloud Run revision-first when the database remains compatible:

```bash
gcloud run services update-traffic manut \
  --project=affine-495114 \
  --region=asia-southeast1 \
  --to-revisions=<previous-revision>=100
```

Use the DNS/Railway rollback path from
`docs/GCP_CLOUD_RUN_RUNBOOK.md#9-rollback` only when the launch operator has
kept Railway online and write-safe for the stability window.

## High-Risk Findings

1. Analytics is partially live. The GoGoCash overview path, connections,
   token refresh cron, ingestion-anomaly wiring, Meta account picker, live
   insight SSE stream, and v1 LINE Messaging API channel-mode connection/webhook
   path are now wired. `listMetrics` now reads `social_metrics` with ACL/range
   validation. Hourly/daily/weekly metric rollups are wired with idempotent
   upserts. Platform pages now render KPI/trend data from real metric rows and
   newest normalized `social_events` rows via `listEvents`. The legal pages
   required by Meta review now exist at `/legal/privacy`, `/legal/terms`, and
   `/legal/data-deletion-instructions`. External approval dashboard setup,
   submission artifacts, and LINE VOOM availability confirmation remain
   incomplete; the product UI now labels LINE as Official Account and keeps
   VOOM post analytics gated until access is confirmed. Do not hand it over as a complete
   multi-platform analytics system.

2. PM/CRM/Reminders are past the v0 list/create state on this QA branch:
   reminder rules materialize scheduled reminders, loaded PM/CRM/Reminders
   data can export CSV, detail/Kanban surfaces exist, 30-second refresh
   fallback is wired, and mobile layout fallbacks were added. Remaining known
   follow-ups are non-EMAIL reminder channels, CSV import/bulk mutation flows,
   provider delivery receipts, and replacing refresh polling with true
   subscriptions where needed.

3. CRM cross-workspace integrity is guarded in resolver code but not
   enforced by composite foreign keys. Keep service-level checks before
   exposing richer mutation surfaces; v0 only writes through paths that
   already validate, so this is currently latent.

4. Reminder handoff is honest about queueing but there is still no
   provider-level delivery receipt path that moves `QUEUED` deliveries
   to `SENT`/`COMPLETED`. The `MnNotificationDelivery` table records
   intent; downstream confirmation comes from the mail provider's
   logs, not the app.

5. Documentation drift remains:
   - `.github/MANUT_CI_SETUP.md` (renamed from `SUPERFLOW_CI_SETUP.md`
     in v1.11.0) still centers `GCP_SA_KEY`, while the current
     pipeline docs describe WIF. Refresh during the next pipeline
     audit pass.
   - Some beta-era docs still mention Railway deploy ids or Railway log checks.
     `docs/MANUT_DEPLOY_RUNBOOK.md` and
     `docs/MANUT_LAUNCH_CHECKLIST.md` are refreshed; archive or refresh the
     remaining beta docs before using them as launch evidence.

## Closed During 2026-05-13 Review (v1.12.0)

- PM, CRM, and Reminders v0 frontend rollout shipped (PR #23).
  Three new sidebar entries (`/projects`, `/crm`, `/reminders`) are
  gated on `ServerFeature.Superflow`. Local GraphQL operation objects
  live under `packages/frontend/core/src/modules/manut-{pm,crm,reminders}/`
  and bypass the codegen union via a documented `as unknown as` cast at
  the operation boundary.
- `ServerFeature.Superflow` wiring landed: `SuperflowFeatureRegistrar`
  in `plugins/manut/manut.module.ts` toggles the feature based on
  `ENABLE_MANUT_MODULE` (with legacy `ENABLE_SUPERFLOW_MODULE`
  fallback). Non-Manut installs see no nav additions.
- Frontier model picker expanded from 4 to 10 models on
  `optionalModels`. Added: Gemini 3.1 Flash Lite Preview, Claude Sonnet
  4, Claude Opus 4, Llama 4 Scout, Llama 4 Maverick. Default model is
  unchanged.
- Moonshot, xAI, and Alibaba provider implementations landed (each is
  its own folder under `plugins/copilot/providers/`). They are off by
  default — enabling them requires provider config on the VM.
- Analytics Connections panel unbroken on production. The module gate
  predicate now reads `globalThis.env.selfhosted` and matches what
  `/info` reports. A schema-version-skew fallback renders a friendly
  notice instead of the generic red error.
- `gpt-5-mini` removed from the auto-prompt `optionalModels` array
  (`prompts/service.ts`). Same poison documented in `CLAUDE.md` §5c;
  this is the runtime-injection sibling that escapes the static
  prompts.ts catalogue.
- Workflow paths renamed from `superflow-*.yml` to `manut-*.yml`
  (part of the v1.11.0 consolidation; reflected here because the
  rename is now stable across docs).

## Closed During 2026-05-13 Review (v1.11.0)

- Manut brand rename completed: user-facing copy in PR #24, web/electron
  icons in PR #27, Prisma `Sf*` → `Mn*` models in PR #26 (DB migration ran
  in production), backend `plugins/superflow/` → `plugins/manut/` in
  PR #29, frontend `modules/superflow-*` → `manut-*` plus i18n
  `com.superflow.*` → `com.manut.*` in PR #30.
- Production now answers on `manut.xyz`; the legacy
  `affine.gogocash.co` and `manut.gogocash.co` hosts both 301-redirect
  to it.
- Documentation updated to match (in v1.11.0).

## Closed During 2026-05-07 Review

- `.docker/gogocash/Dockerfile.full-build` now bundles `@affine/server`
  inside the container and copies that fresh `dist/` into the runtime stage.
- Remaining static `model: 'gpt-5-mini'` prompt pins and the matching
  scenario defaults were moved to `gemini-2.5-flash`.
- Google OAuth nullable GraphQL fields now use explicit
  `@Field(() => String, { nullable: true })` annotations.
- The analytics platform allowlist is typed as `Set<SocialPlatform>`.

## Feature Status

- CI/CD: Tier 1 and Tier 2 are documented as done. Sidecar smoke, immutable
  tags, build/deploy split, registry cache, Slack notifications, supersession,
  prompt-seed verification, and chaos validation are documented in
  `docs/CICD.md` and `docs/CICD_ROADMAP.md`. Workflow filenames renamed to
  `manut-*.yml` in v1.11.0.
- PM/CRM/Reminders: v0 frontend shipped in v1.12.0 — list and create flows
  for `/projects`, `/crm` (Accounts/Contacts/Deals/Activities tabs), and
  `/reminders` (Due now/Upcoming/Done/Rules tabs). Gated by
  `ServerFeature.Superflow` on the sidebar. Detail/edit, PM/CRM Kanban,
  CRM deal drag/drop, task drag/drop, and reminder rule CRUD are present.
  Reminder DATETIME rules now materialize scheduled reminders through the
  minute cron with `MnReminderRun` dedupe. CRM tabs can export loaded
  Accounts, Contacts, Deals, and Activities to CSV. PM exports loaded project
  lists and project-detail task lists to CSV. Reminders exports active reminder
  tabs and reminder rules to CSV. Loaded PM/CRM/Reminders data queries now
  refresh every 30 seconds through SWR as the v1 realtime fallback. The three
  surfaces also have 640px responsive layout fallbacks for stacked toolbars,
  scroll-safe tabs, dense rows, forms, cards, and Kanban columns. Remaining v1
  follow-up is future non-EMAIL reminder channels; full subscriptions remain
  optional.
- Knowledge Graph: the lobe/pulse graph and node-detail panel branches are
  already merged into the current line through PR #183 / `454b0e747`. Current
  graph code includes reduced-motion handling, hidden-tab pause/resume,
  idle/rest-loop gating, the `MAX_PHYSICS_NODES` cap, canvas `role="img"` /
  `aria-label`, and a visually-hidden keyboard/screen-reader list that opens
  the same detail panel as canvas selection.
- Chat model picker: 10 frontier models on `optionalModels` (Gemini 2.5/3.1
  family, Claude Sonnet 4/4.5/Opus 4, Llama 4 Scout/Maverick). Default is
  `gemini-2.5-flash`. Moonshot Kimi, xAI Grok, and Alibaba Qwen provider
  implementations exist (v1.12.0) but require provider config on the VM
  before they render in the picker.
- Gmail/Drive: v1.10.2 adds live Gmail import and Drive picker on top of the
  Google OAuth scaffold. Required env vars are `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, and optional `GOOGLE_OAUTH_REDIRECT_URI`.
- AI write tools: gated by `AIToolsConfig` flags and the chat Mode picker.
  Backend production gates should be checked before assuming all write tools
  are available in every environment.
- AI workspace grounding: `docHybridSearch` / `doc_hybrid_search` is the
  preferred Read-mode search tool. It fuses keyword + semantic retrieval with
  citation-ready source metadata, while the older keyword/semantic tools remain
  available as lower-level fallbacks.
- AI grounding verification: object-stream chat saves run a shadow-only
  verifier over workspace search results and final footnote definitions. It
  logs missing/unsupported citation warnings but does not block or rewrite
  answers yet.
- AI memory: chat-turn memory injection is wired through
  `ChatRequestInterceptorService`. It retrieves relevant user/workspace
  memories by default, honors `toolsConfig.memory=false`, and falls back to the
  original prompt if memory retrieval fails.
- AI prompt cache discipline: `planPromptCache` is planner-only. It marks only
  stable Anthropic/Anthropic Vertex system-prefixes as eligible and refuses
  dynamic private context such as memories, retrieved docs, or workspace-source
  tool results. Provider requests intentionally omit cache metadata until the
  native request contract supports it.
- FOSS/self-host limits: Manut hides the license tab and lifts self-host
  seat limits through `QuotaService.getWorkspaceQuota`.
- Analytics: GoGoCash overview and AI insight pieces exist, but
  multi-platform ingestion/rollups are not complete. Settings → Connections
  panel unbroken in v1.12.0 — was previously surfacing "Unhandled error
  raised" because the module gate misread the env default.

## External Systems

- GCP project: `affine-495114`.
- VM: `affine-vm`, zone `asia-southeast1-a`.
- GAR image path:
  `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash`.
  (Image-name rename is tracked in `CLAUDE.md` §9 as its own R1 operation.)
- Domain: `manut.xyz` (with 301 redirects from `affine.gogocash.co` and
  `manut.gogocash.co`).
- Optional Slack secret: `SLACK_WEBHOOK_URL`.
- Google OAuth APIs: Gmail and Drive APIs must be enabled in the GCP project.
- Google sign-in redirect URI (must match GCP **Authorized redirect URIs** on
  client `affine-google-oauth-client-id`): `https://manut.xyz/oauth/callback`.
  Integrations use `https://manut.xyz/oauth/google/callback` on the same client.

Secret rotation, IAM changes, database destructive work, and production
deploys are R1/R0-style work. Stop and get explicit coordination before doing
anything irreversible.

## Pre-Release Checklist

```bash
git status --short --branch
yarn oxlint --deny-warnings
yarn workspace @affine/graphql build
git diff --exit-code -- packages/common/graphql/src/schema.ts packages/common/graphql/src/graphql/index.ts
rg -n "model: 'gpt-5-mini'|@Field\\(\\{ nullable: true \\}\\)" packages/backend/server/src
yarn affine bundle -p @affine/server
yarn affine bundle -p web
yarn affine bundle -p admin
yarn affine bundle -p mobile
```

Then build `linux/amd64`, smoke the image/container, and deploy through the
GitHub workflows rather than hand-editing the VM whenever possible.

## Maintenance Rules

- Keep this file tracked under `docs/`; do not move handover state back to
  ignored root Markdown files.
- When deploy status changes, update `docs/CICD_ROADMAP.md` and this file
  together.
- When a release ships, add a `docs/RELEASES/vX.Y.Z.md` entry and note the
  operational traps in `AGENTS.md` / `CLAUDE.md`.
- When the control-plane contract changes, update
  `docs/MANUT_CONTROL_PLANE.md` and verify
  `scripts/manut-release-handover.mjs --help` still documents the
  emitted fields.
- When a code review finds a real blocker, either fix it immediately or add it
  to the High-Risk Findings section with an owner and verification command.
