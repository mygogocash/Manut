# Manut Handover

Last reviewed: 2026-05-13 after the v1.12.0 cut. v1.12.0 is the first
release on the renamed stack — it ships the v0 Projects, CRM, and
Reminders frontend, expands the chat model picker with frontier models,
and unbreaks the Settings → Connections panel. v1.11.0 (the immediately
prior release) was the brand rename and post-rebrand documentation
cleanup. A handful of internal identifiers — workflow filenames were
renamed in v1.11.0, the GAR Docker image name `affine-gogocash`, and
legacy GraphQL `@ObjectType('Superflow*')` decorators are still on the
old names with a documented migration plan; see `CLAUDE.md` §9.

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
- `scripts/vm/deploy.sh`, `scripts/vm/rollback.sh`,
  `scripts/vm/compose.canary.yml` - executable VM runbook.
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

Normal path:

1. Push to `main`.
2. `superflow-ci.yml` (display name "Manut CI") validates lint/codegen/bundles.
3. `superflow-build.yml` (display name "Manut Build") builds and pushes an
   immutable GAR image tag.
4. The build workflow uploads `image-tag` and `superflow-handover`
   artifacts so the image handoff has both machine and operator context.
5. `superflow-autodeploy.yml` (display name "Manut Auto Deploy") runs
   VM-side `deploy.sh`.
6. `deploy.sh` sidecar-smokes the new image on port 3011 before swapping
   production, then runs post-swap `/info` and prompt-seed checks.

Manual deploy of an existing image:

```bash
gh workflow run superflow-deploy.yml -f tag=<image-tag>
```

Rollback:

```bash
gh workflow run superflow-rollback.yml
```

Current deploy scripts use `/srv/affine/compose/compose.yml.previous.bak`
as the rollback snapshot. Older docs still mention
`compose.yml.pre-<tag>.bak`; treat those as historical unless you verify the
live VM state.

## High-Risk Findings

1. Analytics is partially live. The GoGoCash overview path is wired to the
   backend (and the Connections panel was unbroken in v1.12.0 by fixing
   the module gate to read `globalThis.env.selfhosted` instead of the
   raw `DEPLOYMENT_TYPE` env var), but several platform pages, ingestion
   paths, rollups, and event lists are still explicitly marked as
   Round-A stubs or mock-backed. Do not hand it over as a complete
   multi-platform analytics system.

2. PM/CRM/Reminders are v0 — list and create surfaces only. Detail and
   edit views, Kanban for tasks/deals, reminder rules and repeat
   schedules, drag-drop reordering, bulk operations / CSV, real-time
   updates, and mobile views are all v1 follow-ups. Internal branches
   are tracking each; none had merged at the v1.12.0 cut. Treat the v0
   surface as the canonical create flow and continue using the
   underlying GraphQL APIs for richer interactions until the v1
   surfaces ship.

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
   - Some rollback examples still mention `compose.yml.pre-*`.

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
  `/reminders` (Due now/Upcoming/Done tabs). Gated by
  `ServerFeature.Superflow` on the sidebar. Detail/edit, Kanban, reminder
  rules, drag-drop, bulk, real-time, and mobile remain v1 follow-ups.
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
