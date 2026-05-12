# Superflow Handover

Last reviewed: 2026-05-07 from local checkout
`8b2bd1c17 docs(cicd): roadmap - Tier 1+2 done, Tier 3 backlog, validation log`.
The worktree was clean on `main...origin/main` during this review.

This document is the tracked handover entry point for the GoGoCash
Superflow fork of AFFiNE 0.26.3. It summarizes what a successor needs
before changing, building, or deploying the project.

## Current State

- Product: GoGoCash Superflow, a fork of AFFiNE with AI agents, Vertex AI,
  self-host AI unlocks, Gmail/Drive integration, analytics work, and
  Superflow-specific deployment automation.
- Live app: `https://manut.gogocash.co`.
- Production status source: `docs/CICD_ROADMAP.md` says the latest
  validated production image was `main-393950532-25413249523`, deployed
  through the full CI -> Build -> Auto Deploy chain with `/info` HTTP 200.
  That value was not live-refreshed during this handover review.
- Branch model: Superflow work lands on `main`; upstream AFFiNE workflows
  for `canary`/`master` are not the Superflow deploy path.

## Source Of Truth

- `docs/HANDOVER.md` - start here for current ownership notes.
- `AGENTS.md` and `CLAUDE.md` - project Definition-of-Done, traps, testing,
  deploy rules, and commit conventions. They intentionally duplicate much
  of the same playbook for different agents.
- `docs/CICD.md` - deploy architecture and operator commands.
- `docs/CICD_ROADMAP.md` - current pipeline status, shipped tiers, backlog,
  and last validation notes.
- `docs/SUPERFLOW_CONTROL_PLANE.md` - Superflow-native operating model for
  agent/company-style coordination, release handover artifacts, and future
  AFFiNE-facing control-plane work.
- `docs/RELEASES/v1.10.2.md` - latest feature release narrative.
- `docs/analytics-platform.md` and `docs/analytics-approvals.md` - analytics
  product plan and external approval checklist.
- `scripts/manut-release-handover.mjs` - generates human and JSON
  control-plane handovers for CI build/release artifacts.
- `scripts/vm/deploy.sh`, `scripts/vm/rollback.sh`,
  `scripts/vm/compose.canary.yml` - executable VM runbook.
- `.github/workflows/superflow-*.yml` - CI, build, deploy, rollback,
  VM init, and release automation.

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
2. `superflow-ci.yml` validates lint/codegen/bundles.
3. `superflow-build.yml` builds and pushes an immutable GAR image tag.
4. The build workflow uploads `image-tag` and `superflow-handover`
   artifacts so the image handoff has both machine and operator context.
5. `superflow-autodeploy.yml` runs VM-side `deploy.sh`.
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
   backend, but several platform pages, ingestion paths, rollups, and event
   lists are still explicitly marked as Round-A stubs or mock-backed. Do not
   hand it over as a complete multi-platform analytics system.

2. Documentation drift remains:
   - `.github/SUPERFLOW_CI_SETUP.md` still centers `GCP_SA_KEY`, while the
     current pipeline docs describe WIF.
   - README still shows an old `v1.8.0` sample image and generic `yarn build`
     guidance that is less precise than the current bundle commands.
   - Some rollback examples still mention `compose.yml.pre-*`.

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
  `docs/CICD.md` and `docs/CICD_ROADMAP.md`.
- Gmail/Drive: v1.10.2 adds live Gmail import and Drive picker on top of the
  Google OAuth scaffold. Required env vars are `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, and optional `GOOGLE_OAUTH_REDIRECT_URI`.
- AI write tools: gated by `AIToolsConfig` flags and the chat Mode picker.
  Backend production gates should be checked before assuming all write tools
  are available in every environment.
- FOSS/self-host limits: Superflow hides the license tab and lifts self-host
  seat limits through `QuotaService.getWorkspaceQuota`.
- Analytics: GoGoCash overview and AI insight pieces exist, but multi-platform
  ingestion/rollups are not complete.

## External Systems

- GCP project: `affine-495114`.
- VM: `affine-vm`, zone `asia-southeast1-a`.
- GAR image path:
  `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash`.
- Domain: `manut.gogocash.co`.
- Optional Slack secret: `SLACK_WEBHOOK_URL`.
- Google OAuth APIs: Gmail and Drive APIs must be enabled in the GCP project.

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
  `docs/SUPERFLOW_CONTROL_PLANE.md` and verify
  `scripts/manut-release-handover.mjs --help` still documents the
  emitted fields.
- When a code review finds a real blocker, either fix it immediately or add it
  to the High-Risk Findings section with an owner and verification command.
