# AI Session Handover

Last updated: 2026-05-23 12:20 +07 (beta launch-readiness hardening)

This file is the fast-resume handover for AI sessions in the Manut
AFFiNE fork (historically Superflow — the brand rename completed in
v1.11.0). Update it whenever meaningful work finishes, before long
builds or deploys, and before ending a session. The goal is simple:
another AI agent or human should be able to continue without relying
on chat memory.

## Current Workspace

- Repo: `/Users/kunanonjarat/Developer/AFFiNE-canary`
- Branch: `codex/fix-beta-blockers`
- Local HEAD: `234d74bcb`
- Upstream: `origin/main`
- Origin HEAD: refresh before PR/deploy; latest observed `main` had green
  `Manut CI` run `26323515938` and green `Manut Build` run `26323591394`.
- PR: not opened yet for `codex/fix-beta-blockers`.
- Branch state: local branch has uncommitted WIP for beta blocker fixes,
  launch-readiness docs, analytics cron log hardening, and beta-security
  workflow bootstrap fixes.
- Dirty state: expected touched files include `docs/BETA_GO_NO_GO.md`,
  `docs/BETA_RISK_REGISTER.md`, `docs/MANUT_LAUNCH_CHECKLIST.md`, this
  handover file, `.github/workflows/manut-beta-security.yml`,
  quota tier code/tests, AI chat UI tests/fixes, and analytics rollup cron
  tests/fixes.
- Production branch: `main`
- Production app: https://manut.xyz (canonical;
  `affine.gogocash.co` and `manut.gogocash.co` both 301-redirect)
- Production image lineage: `railway status` currently reports production
  service `Manut` online at deployment
  `6ccaa65a-535a-4aa9-92e6-79333ad7593a`; no deploy was performed during this
  WIP. Refresh the exact image/tag before production action.

## Current Beta Hardening Slice

- Fixed beta code blocker BETA-SEC-001: default chat format control now labels
  as `Format` instead of duplicating the model `Auto`, and contentless
  transmitting assistant replies render the loading state.
- Fixed beta code blocker BETA-SEC-002: practical unlimited member cap is
  bounded at `100_000` before GraphQL `Int` serialization.
- Fixed launch-readiness blocker BETA-SEC-003: analytics hourly/daily/weekly
  rollup cron stubs no longer throw `NOT_IMPLEMENTED` on schedule while phase
  3 rollups remain unimplemented.
- Fixed beta-security gate blocker BETA-SEC-004: actionlint command is
  shellcheck-safe, and Semgrep 1.99 bootstraps with `setuptools<81` under
  Python 3.12 so `pkg_resources` exists.
- Verified so far: targeted quota AVA, targeted AI Vitest, analytics rollup
  AVA, actionlint via downloaded v1.7.11 binary, Semgrep 1.99 startup and full
  high-confidence scan, plus earlier Prettier/ESLint/oxlint/diff-check/server
  tsc/web-admin-mobile bundles.
- Full `yarn test` was attempted earlier and is not green in this local
  environment because of missing native binding `@affine/native-darwin-arm64`
  and missing Playwright Firefox; do not present full-suite status as green.

## Pending Launch Readiness

- Commit/push the branch, open a PR into `main`, and require green `Manut CI`,
  `Manut Beta Security Gate`, and `Manut Build` on the candidate.
- Deploy the merged candidate to Railway; record exact deployment id, image/tag,
  rollback target, primary owner, and secondary owner in
  `docs/BETA_GO_NO_GO.md`.
- Recheck production logs after deploy for no analytics cron
  `NOT_IMPLEMENTED`, no GraphQL Int overflow, no new P0/P1 error class, and no
  sustained Railway log-rate drops.
- Run authenticated beta smoke for GraphQL workspace query, floating/full AI
  chat, storage usage/upload fallback, auth/onboarding, invite accept, and
  sign-out.

## Pending Product/Feature Follow-Ups

- PM/CRM/Reminders v1: detail/edit, Kanban, reminder rules/repeat schedules,
  drag-drop, bulk/CSV, real-time updates, and mobile views.
- Mount `StorageCapModal` and `AiBudgetModal` from backend quota envelopes in a
  parent UI consumer.
- Chat-session memory auto-ingest and pin-toggle mutation remain follow-up
  slices; read-time memory injection already works.
- Analytics phase-3 rollup implementation is deferred; until then the scheduled
  rollup crons must stay inert and non-erroring.

## Release lineage

- **v1.10.2** — Gmail live import + Drive picker + AI permission mode
  picker + DriveFile schema fix.
- **v1.11.0** — Brand rename Superflow → Manut. Domain switch,
  Prisma model rename, frontend module path rename, i18n key rename,
  workflow filename rename, infra path rename, frontier model
  picker, Moonshot/xAI/Alibaba providers, deploy.sh migration fix,
  doc cleanup.
- **v1.12.0** (this release) — PM, CRM, Reminders v0 frontend.
  Analytics Connections panel fix. `gpt-5-mini` removed from the
  auto-prompt runtime injection. Documentation refresh. The
  detail/edit, Kanban, reminder rules, and brain-style Knowledge
  Graph visualisation are tracked on internal branches but did not
  merge in the v1.12.0 window.

## Latest Completed Work

- Learned Paperclip's useful product pattern as a reference concept:
  company-level control plane, goals, employees/agents, adapters, task tree,
  and durable handover evidence.
- Built the Superflow-owned version instead of depending on Paperclip:
  `docs/SUPERFLOW_CONTROL_PLANE.md`.
- Added `scripts/manut-release-handover.mjs`, a no-dependency generator
  that emits `superflow-handover.md` and `superflow-handover.json`.
- Wired `superflow-build.yml` and `superflow-release.yml` to upload a
  `superflow-handover` artifact after image push.
- Updated `docs/HANDOVER.md`, `docs/CICD.md`, and `package.json`.
- Committed and pushed PR branch:
  `5f7587dc8 feat: add Superflow control-plane handover`.
- Added this tracked session handover file and a 30-minute heartbeat
  reminder to keep it refreshed during active work.
- PR #13 merged into `main` as merge commit `8767c95e5`.
- Local checkout fast-forwarded to `origin/main`.
- Superflow CI run `25558581821` completed successfully for merge commit
  `8767c95e5`.
- Superflow Build run `25558739931` completed successfully.
- Build produced image tag `main-8767c95e5-25558739931` with digest
  `sha256:05d660d1258d60da67c4d4d9d17a07c479e3d04978ef2482c764113226eeb444`.
- Verified the new `superflow-handover` artifact by downloading
  `superflow-handover.md` and `superflow-handover.json` from run
  `25558739931`; JSON includes the expected image tag, digest, role board,
  task tree, verification gates, and rollback pointer.
- Superflow Auto Deploy run `25559360466` failed before sidecar validation:
  VM disk filled while extracting the new image layer under
  `/var/lib/containerd/.../main.js.map` (`no space left on device`).
- Production was not swapped; live `/info` stayed HTTP 200 on previous tag
  `main-2d4288b13-25502136233`.
- Started remediation branch `codex/vm-disk-prepull-cleanup` with a
  `deploy.sh` pre-pull cleanup that prunes stopped containers, unused images,
  and Docker build cache while preserving volumes.
- Committed remediation as
  `e51657c89 fix: prune unused docker data before VM image pull` and pushed
  `origin/codex/vm-disk-prepull-cleanup`.
- Installed the patched VM scripts with `superflow-vm-init.yml` run
  `25559581702`; run completed successfully.
- Reran `superflow-deploy.yml` manually for image tag
  `main-8767c95e5-25558739931`; run `25559646582` completed successfully.
- Pre-pull cleanup on the VM reclaimed `6.269GB`; root disk moved from
  `100%` used (`224MB` free) to `18%` used (`24GB` free).
- Sidecar smoke passed on `http://localhost:3011/info`, production swapped to
  `main-8767c95e5-25558739931`, post-swap `/info` passed, and the prompt-seed
  gate passed `3/3`.
- External production probe after deploy returned HTTP 200 for
  `https://manut.xyz/info`.
- Browser smoke loaded `https://manut.xyz/sign-in`; React mounted on
  `#app` with children present and no `console.error` entries.
- PR #14 merged into `main` as merge commit `2b30bc0d6`, preserving the VM
  pre-pull disk cleanup in GitHub for future deploys.
- PR #15 merged Dependabot npm/yarn updates, then security hardening commits
  `054b804b7` and `09289bcf1` landed on `main`.
- PR #16 merged `fast-xml-builder` to `1.2.0`; CI, build, and auto-deploy all
  completed successfully.
- Latest production deploy swapped from `main-09289bcf1-25563768233` to
  `main-788a0e0b0-25585897582`; post-swap `/info` and prompt-seed checks
  passed.
- Local uncommitted WIP touches `schema.prisma`, `app.module.ts`, About
  settings UI, `manut-landing/AGENTS.md`, and new backend
  `plugins/superflow`, `__tests__/superflow`, and
  `20260509120000_superflow_pm_crm_reminders` migration paths. This handover
  file is also modified by heartbeat refreshes.
- Created local work branch `codex/superflow-backlog-pm-crm` to protect the
  dirty Superflow PM/CRM/reminders WIP before continuing.
- Spawned parallel sub-agents for frontend About/settings review, backend
  schema/resolver review, handover-inbox discovery, and a backend Superflow
  read-slice implementation.
- Frontend About/settings cleanup now points Superflow links at GoGoCash /
  Superflow destinations, handles `mailto:` support links without the popup
  URL service, changes visible About labels to Superflow, and fixes the
  community grid to adapt to five links.
- Backend Superflow GraphQL read slice now exposes read-only workspace-scoped
  queries for projects, tasks, CRM accounts/contacts/deal stages/deals/
  activities, reminders/rules/runs, and notification deliveries. All queries
  are guarded by `Workspace.Read`, and nullable GraphQL fields use explicit
  types.
- Added `graphql-read-slice.spec.ts` beside the existing Prisma delegate smoke
  test to guard query registration/workspace scoping and nullable GraphQL
  decorator style.
- Handover-inbox discovery confirmed Phase 2 should import
  `superflow-handover.json` into an AFFiNE doc through `DocWriter`, not a
  parallel storage model. The recommended first slice is a backend validator,
  markdown renderer, `importSuperflowHandover` mutation, and a small workspace
  integrations panel.
- Expanded the Superflow backend from read-only scaffold into a staged PM/CRM/
  reminders slice: project/task resolvers, CRM account/contact/deal/activity
  resolvers, reminder resolver, reminder cron/job pipeline, reminder email
  template, job queue config, mail sender support, Prisma migration, and AVA
  coverage are now staged.
- Added the Phase 2 Handover Inbox backend: `SuperflowHandoverService`,
  `importSuperflowHandover` GraphQL mutation, explicit input/result DTOs,
  `DocWriter.createDoc` / `updateDoc` / `updateDocMeta` wiring, and module
  registration through the existing `ENABLE_SUPERFLOW_MODULE` gate.
- Added the Phase 2 Handover Inbox frontend: a cloud-gated workspace
  integration card, paste/upload JSON panel, parsed release preview, local
  GraphQL operation object, and Create Doc action.
- Added first-pass frontend workspace pages/routes for Superflow Projects, CRM,
  and Reminders.
- Cleared three server typecheck blockers while reviewing the staged work:
  removed a user-only quota field from workspace quota override, tightened the
  agents GraphQL mapper null type, and made the optional Google KMS dynamic
  import typecheck without a stale `@ts-expect-error`.
- Addressed the latest backend review blockers in the unstaged WIP:
  reminder cron now atomically claims due reminders before queueing, stale or
  mismatched reminder-delivery jobs are ignored, queued email handoff is stored
  as `SfNotificationDeliveryStatus.QUEUED` instead of `SENT`, and owner/
  assignee user IDs are checked against workspace membership before PM/CRM
  writes.
- Tightened Resend mail transport behavior: no implicit `noreply@localhost`
  fallback when Resend is selected, and attachment-bearing mail now fails
  explicitly instead of silently dropping unsupported options.
- Kept the Handover Inbox mutation available when the gated PM/CRM/reminder
  module is disabled, because handover import writes normal AFFiNE docs and
  does not require the Superflow migration.
- Tightened the Handover Inbox frontend preview to require schema version 1,
  required sections, and bounded arrays; the import success state now includes
  an Open Doc action.
- Added handover contract coverage that runs
  `scripts/manut-release-handover.mjs` and feeds the generated JSON into
  the backend parser, reducing fixture drift.
- Staged all review fixes into one coherent WIP snapshot. No unstaged source
  diff remains.
- Rebuilt the backend server bundle locally with the staged Superflow changes;
  `packages/backend/server/dist/main.js` is now fresh for a later image build
  path that copies prebuilt artifacts.
- A final focused sub-agent review was attempted for reminder lifecycle,
  handover gating, and the import panel, but it failed before producing output
  because the account hit the Codex usage limit.
- Cleared `5,280` generated source `.js` / `.js.map` files from frontend
  source directories before bundling, using the project-required cleanup
  command. No tracked diff was introduced by the cleanup.
- Rebuilt the web bundle locally with the staged Superflow frontend changes;
  `packages/frontend/apps/web/dist` is fresh for later image builds that copy
  prebuilt artifacts.
- Ran a limited local static browser smoke against the rebuilt web dist with
  `https://dev.affineassets.com` asset requests routed back to local files.
  React mounted on `#app` with 4 children; remaining console errors were from
  expected missing backend endpoints on the static server (`/graphql` 501 and
  `/api/auth/session` 404).
- Final staged sanity pass found no whitespace errors, no generated dist/source
  map junk staged, no new nullable GraphQL `@Field({ nullable: true })`
  pattern, and no `gpt-5-mini` additions.
- First commit attempt exposed two mechanical import-order issues in
  `app.module.ts` and `mails/index.tsx`; fixed with targeted `oxlint --fix`.
- Committed the Superflow PM/CRM/reminders + Handover Inbox WIP as
  `de7b49388 feat(superflow): add PM CRM reminders and handover inbox`.
- **2026-05-13 — Manut brand rename complete.** Production answered
  on `https://manut.gogocash.co`; the old `affine.gogocash.co` host
  301-redirected. (Both hostnames later 301-redirected to `manut.xyz`
  after the 2026-05-17 canonical switch.) The GitHub repository was renamed
  `mygogocash/Superflow` → `mygogocash/Manut` (the old URL redirects).
  Prisma `Sf*` models were renamed to `Mn*` and the DB migration ran
  in production (PR #26). Backend
  `packages/backend/server/src/plugins/superflow/` is now `plugins/manut/`
  (PR #29). Frontend `modules/superflow-*` is now `modules/manut-*`
  and i18n keys moved from `com.superflow.*` to `com.manut.*` (PR #30).
  Documentation was brought into line in v1.11.0. A handful of
  internal identifiers — the GAR Docker image name `affine-gogocash`,
  and legacy `@ObjectType('Superflow*')` GraphQL decorators — were
  deliberately left at their old names with a tracked migration plan;
  see `CLAUDE.md` §9. Workflow filenames were renamed from
  `superflow-*.yml` to `manut-*.yml` as part of v1.11.0's
  consolidation.
- **2026-05-13 — v1.12.0 frontend rollout shipped.** The PM, CRM, and
  Reminders v0 workspace pages landed on `main` via PR #23, gated on
  `ServerFeature.Superflow`. The backend feature registrar
  (`SuperflowFeatureRegistrar` in `plugins/manut/manut.module.ts`)
  toggles the flag based on `ENABLE_MANUT_MODULE=true` (legacy
  `ENABLE_SUPERFLOW_MODULE` fallback). PR #25 fixed the
  `useSuperflowEnabled` hook's ServerFeature shape access. The chat
  picker's `optionalModels` now exposes 10 frontier models; Moonshot,
  xAI, and Alibaba provider implementations are wired but off until
  provider config is populated on the VM.
- **2026-05-13 — Analytics Connections panel unbroken on production.**
  PR #33 fixed the `isAnalyticsModuleEnabled()` gate predicate to read
  `globalThis.env.selfhosted` (matching `/info`) instead of the raw
  `DEPLOYMENT_TYPE` env var. Settings → Connections now renders
  normally on `manut.xyz`; previously it surfaced "Unhandled
  error raised" because the resolver was missing from the GraphQL
  schema. A schema-version-skew fallback also lands so the panel
  shows a friendly notice if the field is genuinely missing.
- **2026-05-13 — `gpt-5-mini` removed from the auto prompt runtime
  injection.** Commit `cbb55eef1` cleans up the in-memory auto prompt
  injected by `PromptService` at boot. This was the runtime-only
  sibling of the same trap documented in `CLAUDE.md` §5c.
- **In flight (not merged at v1.12.0 cut).** Internal branches are
  tracking detail/edit views for PM/CRM, Kanban for tasks and deals,
  reminder rules editor + repeat schedules, and the brain-style
  Knowledge Graph (multi-lobe layout, curved Bezier edges, synaptic
  pulses on AI doc-reads via a doc-read event bus + SSE stream). The
  Knowledge Graph branch (`feat/superflow-pm-crm-reminders-ui`) has
  the implementation but did not merge in time for v1.12.0.
- **2026-05-22 — Notion-readable page detail layout.** Created
  `codex/notion-readable-page-layout` from `origin/main` at `65abecbdc`.
  Page detail icon/title/content remain on the same centered document column,
  and inline page properties now render as a left-to-right Notion-like strip
  with property label above value. The patch is scoped to the shared property
  row data attributes plus the page-detail property-table styles.
- **2026-05-23 — Mobile home Notion-style UI pass.** The mobile home route now
  uses a Notion-like workspace pill header with round notification/settings
  actions, horizontal recents tuned for mobile cards, left-to-right navigation
  rows with the chevron before the icon/title, and a floating bottom dock for
  Search, Ask AI, and New Doc. Scope is mobile-only:
  `mobile/pages/workspace/home.tsx`, new `home.css.ts`, mobile home header,
  recent-doc card/list styles, and mobile navigation row/header styles.
- **2026-05-23 — Settings/calendar + 500 hardening WIP.** Prior uncommitted
  fixes on this branch suppress non-actionable calendar account load toasts,
  add tests for that behavior, scope current-user GraphQL store queries to the
  exact operation documents, and wrap the desktop root app sidebar in a
  fallback error boundary so a bad sidebar read does not take down the app.
- **2026-05-23 — Bottom-right AI chat view modes.** The floating AI chat
  launcher now keeps the same `AIChatContent` session mounted while switching
  between `Floating`, `Sidebar`, and `Full screen` shell modes. The mode menu
  lives in the chat panel header and the CSS shell changes by `data-mode`
  without remounting the chat body.
- **2026-05-23 — Page detail emoji alignment.** The page-mode emoji icon row
  now uses the same centered editor column width and side padding as the title,
  so the emoji sits at the left edge above the page title instead of drifting
  right.
- **2026-05-23 — Modal popup brand styling.** Shared `Modal`,
  `ConfirmModal`, and `PromptModal` surfaces now use stronger Manut glass,
  violet-tinted overlay/edge treatment, brand ink colors, and tighter
  Notion-like action spacing. The custom AI Strategist modal and analytics
  account picker pattern were updated to the same Manut surface/primary token
  language so popup-adjacent UI does not fall back to legacy gray styling.
- **2026-05-23 — Journals page-load fix.** Added a shared workbench route
  classifier so reserved routes such as `/journals`, `/analytics`, and nested
  workspace pages win before the dynamic `/:pageId` document fallback during
  direct workspace loads. Desktop and mobile workspace shells now use the
  helper, preventing `/workspace/:workspaceId/journals` from being treated as a
  document/share fallback and surfacing the full-page 500 route error.

## Verification Already Run

- `node --check scripts/manut-release-handover.mjs`
- `node scripts/manut-release-handover.mjs --help`
- Generator smoke with Markdown and JSON output under `/tmp/superflow-handover-test`
- JSON parse check for generated handover
- `yarn prettier --check docs/SUPERFLOW_CONTROL_PLANE.md docs/HANDOVER.md docs/CICD.md package.json scripts/manut-release-handover.mjs .github/workflows/superflow-build.yml .github/workflows/superflow-release.yml`
- Ruby YAML parse for `.github/workflows/superflow-build.yml` and
  `.github/workflows/superflow-release.yml`
- `yarn oxlint -c .oxlintrc.json --disable-nested-config --deny-warnings scripts/manut-release-handover.mjs`
- Pre-commit hook passed during commit: prettier, eslint on staged JS/MJS,
  and repo oxlint hook.
- `bash -n scripts/vm/deploy.sh`
- `git diff --check`
- `yarn prettier --check docs/AI_SESSION_HANDOVER.md`
- `superflow-vm-init.yml` run `25559581702` succeeded.
- `superflow-deploy.yml` run `25559646582` succeeded with
  `deploy.sh exit code: 0`.
- `curl -fsS -D - https://manut.xyz/info` returned HTTP 200 after
  deploy.
- Playwright production smoke: sign-in page rendered, `#app` had 3 children,
  React keys were present, and browser console had 0 errors.
- Superflow CI run `25585821594` for PR #16 succeeded.
- CodeQL run `25585821199` for PR #16 succeeded.
- Superflow Build run `25585897582` succeeded and pushed
  `main-788a0e0b0-25585897582`.
- Superflow Auto Deploy run `25586178501` succeeded; deploy script exit code
  was `0`, with `PRODUCTION HEALTHY` and `PROMPT-SEED OK — 3/3`.
- Latest Dependabot Updates run `25589669434` on head `788a0e0b0` succeeded.
- Latest heartbeat probe: `curl -fsS -D - https://manut.xyz/info`
  returned HTTP 200 on `2026-05-09 10:14:23 +07`.
- `DATABASE_URL='postgresql://user:pass@localhost:5432/affine' yarn workspace @affine/server prisma format`
  passed.
- `DATABASE_URL='postgresql://user:pass@localhost:5432/affine' yarn workspace @affine/server prisma validate`
  passed.
- `DATABASE_URL='postgresql://user:pass@localhost:5432/affine' yarn workspace @affine/server prisma generate`
  passed and regenerated Prisma Client with `SfNotificationDeliveryStatus.QUEUED`.
- `yarn prettier --check` passed for touched Superflow backend files, About
  settings files, and `packages/frontend/i18n/src/resources/en.json`.
- `yarn workspace @affine/server ava 'src/__tests__/superflow/*.spec.ts'`
  passed before the review fixes: `14 tests passed`.
- `yarn workspace @affine/server ava 'src/__tests__/superflow/*.spec.ts'`
  passed after the review fixes: `18 tests passed`.
- `yarn workspace @affine/server tsc --noEmit --pretty false` passed.
- `yarn eslint --no-cache` passed for touched backend/frontend TS/TSX files.
- `yarn tsc -b packages/frontend/core/tsconfig.json --pretty false` was
  attempted for the handover panel but stopped after the repo emitted thousands
  of existing project-reference `TS6305` errors from missing/stale Blocksuite
  `dist/*.d.ts` outputs. Generated untracked declaration files from that failed
  check were cleaned up.
- `yarn prettier --check` passed for touched TS/TSX/JSON/MD files. Note:
  `schema.prisma` is formatted with Prisma, not this Prettier command.
- `git diff --check` and `git diff --cached --check` passed.
- `git diff --cached --check` passed again after staging review fixes.
- `git diff --cached --name-only --diff-filter=ACM | rg '\.(ts|tsx|json|md)$' | xargs yarn prettier --check`
  passed for staged TS/TSX/JSON/MD files.
- `yarn affine bundle -p @affine/server` passed; rspack compiled
  `packages/backend/server/src/index.ts` successfully in 731ms.
- Required stale source cleanup removed `5,280` generated `.js` / `.js.map`
  files from `packages/frontend/core/src`, `packages/frontend/component/src`,
  `packages/frontend/i18n/src`, and `blocksuite`; follow-up count was `0`, and
  `git status` showed no tracked changes from the cleanup.
- `yarn affine bundle -p web` passed. Rspack compiled the web entry and all
  workers successfully with the usual asset-size / entrypoint-size warnings.
- Local static smoke: Python served
  `packages/frontend/apps/web/dist` on `127.0.0.1:4173`; Playwright routed
  `dev.affineassets.com` assets to local files, loaded the app, confirmed title
  `All docs · AFFiNE`, `#app` child count `4`, and React keys present. Console
  errors were limited to expected frontend-only static-server misses:
  `/graphql` POST `501` and `/api/auth/session` `404`.
- Final pre-commit checks passed: `git diff --cached --check`, generated
  artifact staging check, nullable GraphQL decorator grep, and `gpt-5-mini`
  staged-diff grep.
- Targeted `yarn oxlint -c .oxlintrc.json --disable-nested-config --fix
packages/backend/server/src/app.module.ts
packages/backend/server/src/mails/index.tsx` fixed import order.
- Commit hook passed on retry: `lint-staged` prettier/eslint tasks and
  repo-wide `yarn lint:ox` finished with 0 warnings and 0 errors.
- Post-commit state check at `2026-05-10 15:01:17 +07`: branch
  `codex/superflow-backlog-pm-crm`, local HEAD `de7b49388`, origin/main
  `788a0e0b0`, `1 1` ahead/behind.
- 2026-05-22 23:12 layout pass: `yarn prettier --check` passed for
  `property.tsx`, block-suite editor `styles.css.ts`, and
  `detail-page.css.ts`.
- 2026-05-22 23:12 layout pass: `git diff --check` passed.
- 2026-05-22 23:12 layout pass:
  `yarn eslint --no-cache packages/frontend/component/src/ui/property/property.tsx packages/frontend/core/src/blocksuite/block-suite-editor/styles.css.ts packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.css.ts`
  passed.
- 2026-05-22 23:12 layout pass: stale generated `.js` / `.js.map` source
  count was `0` before bundling.
- 2026-05-22 23:12 layout pass: `yarn affine bundle -p web` passed; rspack
  compiled web and workers successfully with the existing asset-size /
  entrypoint-size warnings.
- 2026-05-22 23:12 layout pass: Browser rendered a localhost fixture using
  the compiled CSS selectors from the web bundle. Desktop and 390px mobile
  screenshots showed the icon, title, property strip, divider, and content
  aligned in a single readable Notion-style column.
- 2026-05-22 23:12 layout pass: full local app visual QA was blocked because
  the web dev server proxied `/graphql` to a missing backend, and
  `@affine/server` could not boot without local Redis and `DATABASE_URL`.
- 2026-05-23 00:09 calendar/settings + 500 hardening:
  `yarn vitest packages/frontend/core/src/modules/cloud/stores/__tests__/current-user-query-scope.spec.ts packages/frontend/core/src/desktop/dialogs/setting/account-setting/integrations-panel.spec.tsx --run`
  passed (`11` tests).
- 2026-05-23 00:09 calendar/settings + 500 hardening:
  `yarn eslint --no-cache` passed for the touched app-container,
  integrations-panel, integrations-panel spec, cloud store files, and
  current-user query-scope spec.
- 2026-05-23 00:09 calendar/settings + 500 hardening:
  `yarn prettier --check` passed for the same touched files; `git diff --check`
  passed; stale generated `.js` / `.js.map` source count was `0`.
- 2026-05-23 00:09 calendar/settings + 500 hardening:
  `yarn affine bundle -p web` passed with existing asset-size warnings; live
  authenticated smoke on `https://manut.xyz/workspace/gogocash/all` rendered
  All docs instead of the reported 500 page.
- 2026-05-23 00:09 mobile Notion-style UI pass:
  `yarn prettier --check` passed for the touched mobile home/header/navigation/
  card style files.
- 2026-05-23 00:09 mobile Notion-style UI pass:
  `yarn eslint --no-cache` passed for the touched mobile home/header/
  navigation/card style files.
- 2026-05-23 00:09 mobile Notion-style UI pass: `git diff --check` passed.
- 2026-05-23 00:09 mobile Notion-style UI pass: `yarn affine bundle -p mobile`
  passed; rspack compiled mobile and workers successfully with existing
  asset-size / entrypoint-size warnings.
- 2026-05-23 00:16 AI chat view modes:
  `yarn prettier --check packages/frontend/core/src/components/floating-ai-chat-anchor/index.tsx packages/frontend/core/src/components/floating-ai-chat-anchor/styles.css.ts`
  passed.
- 2026-05-23 00:16 AI chat view modes:
  `yarn eslint --no-cache packages/frontend/core/src/components/floating-ai-chat-anchor/index.tsx packages/frontend/core/src/components/floating-ai-chat-anchor/styles.css.ts`
  passed.
- 2026-05-23 00:16 AI chat view modes: `git diff --check` passed.
- 2026-05-23 00:16 AI chat view modes: `yarn affine bundle -p web` passed;
  rspack compiled web and workers successfully with existing asset-size /
  entrypoint-size warnings.
- 2026-05-23 06:18 heartbeat refresh: branch still
  `codex/fix-calendar-accounts-toast` at `fe992de2e`, no PR is open for this
  branch, and dirty WIP remains unchanged from the 05:48 refresh.
- 2026-05-23 06:54 page-detail emoji alignment:
  `yarn prettier --check packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.css.ts`
  passed.
- 2026-05-23 06:54 page-detail emoji alignment:
  `yarn eslint --no-cache packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.css.ts`
  passed.
- 2026-05-23 06:54 page-detail emoji alignment:
  `git diff --check packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.css.ts`
  passed; stale generated `.js` / `.js.map` source count was `0`.
- 2026-05-23 06:54 page-detail emoji alignment: `yarn affine bundle -p web`
  passed; rspack compiled web and workers successfully with existing
  asset-size / entrypoint-size warnings.
- 2026-05-23 06:54 page-detail emoji alignment: Playwright layout fixture
  confirmed the emoji left edge and title text left edge both resolve to
  `441px` at a 1280px viewport (`aligned: true`).
- 2026-05-23 07:11 modal brand styling:
  `yarn prettier --check packages/frontend/component/src/ui/modal/styles.css.ts packages/frontend/component/src/ui/modal/confirm-modal.css.ts packages/frontend/component/src/ui/modal/prompt-modal.css.ts packages/frontend/core/src/modules/analytics/views/ai-strategist/index.css.ts packages/frontend/core/src/modules/analytics/views/connections-settings/account-picker-modal.css.ts`
  passed after one Prettier write on `confirm-modal.css.ts`.
- 2026-05-23 07:11 modal brand styling:
  `yarn eslint --no-cache packages/frontend/component/src/ui/modal/styles.css.ts packages/frontend/component/src/ui/modal/confirm-modal.css.ts packages/frontend/component/src/ui/modal/prompt-modal.css.ts packages/frontend/core/src/modules/analytics/views/ai-strategist/index.css.ts packages/frontend/core/src/modules/analytics/views/connections-settings/account-picker-modal.css.ts`
  passed.
- 2026-05-23 07:11 modal brand styling:
  `git diff --check -- packages/frontend/component/src/ui/modal/styles.css.ts packages/frontend/component/src/ui/modal/confirm-modal.css.ts packages/frontend/component/src/ui/modal/prompt-modal.css.ts packages/frontend/core/src/modules/analytics/views/ai-strategist/index.css.ts packages/frontend/core/src/modules/analytics/views/connections-settings/account-picker-modal.css.ts`
  passed; stale generated `.js` / `.js.map` source count was `0`.
- 2026-05-23 07:11 modal brand styling: `yarn affine bundle -p web` passed;
  rspack compiled web and workers successfully with existing asset-size /
  entrypoint-size warnings.
- 2026-05-23 07:11 modal brand styling: Playwright fixture rendered the
  delete-confirm popup with Manut tokens; measured centered modal
  `456px x 168px`, title color `rgb(36, 35, 41)`, description color
  `rgb(95, 93, 102)`, 8px button radius, and violet-tinted glass background.
- 2026-05-23 07:24 journals page-load fix: first TDD run failed because
  `route-classification.ts` did not exist yet; after implementation,
  `yarn vitest packages/frontend/core/src/modules/workbench/__tests__/route-classification.spec.ts --run`
  passed (`3` tests).
- 2026-05-23 07:24 journals page-load fix:
  `yarn prettier --check packages/frontend/core/src/modules/workbench/route-classification.ts packages/frontend/core/src/modules/workbench/__tests__/route-classification.spec.ts packages/frontend/core/src/desktop/pages/workspace/index.tsx packages/frontend/core/src/mobile/pages/workspace/index.tsx`
  passed.
- 2026-05-23 07:24 journals page-load fix:
  `yarn eslint --no-cache packages/frontend/core/src/modules/workbench/route-classification.ts packages/frontend/core/src/modules/workbench/__tests__/route-classification.spec.ts packages/frontend/core/src/desktop/pages/workspace/index.tsx packages/frontend/core/src/mobile/pages/workspace/index.tsx`
  passed.
- 2026-05-23 07:24 journals page-load fix:
  `git diff --check -- packages/frontend/core/src/modules/workbench/route-classification.ts packages/frontend/core/src/modules/workbench/__tests__/route-classification.spec.ts packages/frontend/core/src/desktop/pages/workspace/index.tsx packages/frontend/core/src/mobile/pages/workspace/index.tsx`
  passed; stale generated `.js` / `.js.map` source count was `0`.
- 2026-05-23 07:24 journals page-load fix: `yarn affine bundle -p web` and
  `yarn affine bundle -p mobile` both passed; rspack compiled successfully
  with existing asset-size / entrypoint-size warnings.
- 2026-05-23 07:24 journals page-load fix: Playwright live smoke on
  `https://manut.xyz/workspace/gogocash/journals` showed no route error
  (`#app` child count `3`). The user's Chrome tab also recovered after reload
  and displayed the Journals empty state.

## Open Threads

- PM/CRM/Reminders v0 frontend is on `main` and gated on
  `ServerFeature.Superflow`. Detail/edit views, Kanban for tasks/deals,
  reminder rules editor, drag-drop, bulk operations / CSV, real-time
  updates, and mobile views remain as v1 follow-ups — internal branches
  exist; none merged at v1.12.0.
- CRM cross-workspace integrity is guarded in resolver code but not
  enforced by composite foreign keys. Keep service-level checks before
  exposing richer mutation surfaces.
- Reminder handoff records intent via `MnNotificationDelivery.QUEUED`
  but there is no provider-level delivery receipt path that promotes
  `QUEUED` to `SENT`/`COMPLETED`. Downstream confirmation requires
  reading the mail provider's logs.
- Brain-style Knowledge Graph (lobes, curved dendrite edges, synaptic
  pulses on AI doc-reads via a `DocReadEventBus` + SSE stream at
  `/api/workspace/:workspaceId/doc-read-stream`) lives on
  `feat/superflow-pm-crm-reminders-ui` but did not merge for v1.12.0.
  The branch has Phase 1 (layout) and Phase 2 (pulses) commits. Next
  step is a review pass and a merge decision before v1.13.0.
- Moonshot, xAI, and Alibaba providers are wired but the chat picker
  doesn't render them until provider config (`apiKey`, `baseUrl`) is
  populated on the VM. Document the rollout step before exposing them
  in product.
- Keep `docs/MANUT_CONTROL_PLANE.md` and this file in sync whenever the
  handover JSON contract changes.
- Current QA risk: mobile Notion-style home, AI chat view modes,
  page-detail emoji alignment, modal brand styling, and the journals route fix
  are bundle/lint verified. Emoji/modal checks used Playwright fixtures, and
  the journals live smoke confirms the current production tab is no longer
  stuck on the 500 page, but the combined WIP still needs browser-shot review
  against an authenticated local/prod-like preview that includes the local
  bundle.
- Next concrete step: visually review mobile home, bottom-right AI chat modes,
  page-detail emoji placement, delete/prompt/account-picker modals, and
  `/workspace/gogocash/journals` in an authenticated local/prod-like preview,
  then stage source changes only (exclude generated declaration artifacts and
  unrelated local files).

## Frequent Update Protocol

Active reminder:

- Automation: `refresh-superflow-ai-session-handover`
- Cadence: every 30 minutes while active
- Purpose: refresh this file with current branch, PR, verification, blockers,
  and next-step state so work can resume without chat memory.

When continuing work, update this file with:

1. Current timestamp and timezone.
2. Current branch, HEAD SHA, PR, and dirty/clean state.
3. Completed changes since the previous update.
4. Verification commands and results.
5. Blockers, risks, and the next concrete step.

Suggested cadence: every 30 minutes during active work, before any deploy, and
immediately after a commit, push, PR, merge, or production smoke test.

## Resume Commands

```bash
cd /Users/kunanonjarat/Developer/AFFiNE-canary
git status --short --branch
git log -5 --oneline
git log -5 --oneline origin/main
gh pr view 13 --json state,mergeStateStatus,statusCheckRollup,url
gh pr view 14 --json state,mergeStateStatus,statusCheckRollup,url
gh pr view 15 --json state,mergedAt,mergeCommit,url
gh pr view 16 --json state,mergedAt,mergeCommit,url
gh run view 25558581821 --json status,conclusion,jobs,url
gh run view 25558739931 --json status,conclusion,jobs,url
gh run view 25559360466 --json status,conclusion,jobs,url
gh run view 25559581702 --json status,conclusion,jobs,url
gh run view 25559646582 --json status,conclusion,jobs,url
gh run view 25585897582 --json status,conclusion,jobs,url
gh run view 25586178501 --json status,conclusion,jobs,url
gh run list --branch main --limit 10 --json databaseId,workflowName,status,conclusion,headSha,url
curl -fsS https://manut.xyz/info
sed -n '1,240p' docs/AI_SESSION_HANDOVER.md
```
