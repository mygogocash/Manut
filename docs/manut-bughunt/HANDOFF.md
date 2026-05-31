# Manut Bug Hunt — Handoff & Execution Plan

> Generated mid-session after a multi-agent investigation (2 workflows, 14 agents,
> ~4M subagent tokens). The session context became saturated (tool outputs started
> truncating), so this doc + the raw findings JSON are the durable source of truth.
> A fresh session should read this, then execute the **Fix Plan** below with reliable I/O.

## Raw findings (durable)

- `docs/manut-bughunt/wf1-core-bugs.json` — control-plane, mongo/analytics, AI panel, module-health (4 reports, full)
- `docs/manut-bughunt/wf2-sweep.json` — workspace-logo, dark-mode, + 8 sweep groups = **37 findings** (full)
- Parse: `node -e 'const d=JSON.parse(require("fs").readFileSync("docs/manut-bughunt/wf2-sweep.json","utf8"));const g=[...d.result.targeted,...d.result.sweep];g.forEach(x=>x.findings.forEach(f=>console.log(f.severity,"|",f.title)))'`

## User decisions (locked)

1. **Migration drift** → harden code so it degrades gracefully **+ write a runbook + a startup smoke test** that asserts gated tables exist when `ENABLE_MANUT_MODULE=true`.
2. **Landing** → **work in the tree, NO commits**. Leave everything uncommitted for review.
3. **Scope** → **fix everything (all 37/38 findings)**.
4. Tone preference (for any copy): "Gen Z energy — punchy, bold, stats as receipts, no filler."

## ✅ DONE this session

### Railway removal (user asked: "delete railway config from repo")

Deleted (working tree, uncommitted):

- `railway.toml`
- `.docker/manut/Dockerfile.railway`
- `.github/workflows/manut-railway-deploy.yml.disabled`
- `docs/MIGRATE_GCP_TO_RAILWAY.md`
- `scripts/manut-dns-railway-tls.sh`
- `scripts/manut-railway-phase0-validate.sh`

Edited:

- `packages/frontend/core/src/modules/cloud/services/fetch.ts` — removed user-facing Railway DNS hint (genericized).

**KEPT (do NOT delete):** `.docker/manut/entrypoint.railway.sh` — it is the live `ENTRYPOINT` in `Dockerfile.fullstack:82,92` (the surviving GCE/GAR image). To fully de-Railway it, rename to `entrypoint.sh` AND update `Dockerfile.fullstack` COPY/ENTRYPOINT, then rebuild-test the image.

**Deferred Railway content references** (prose; need the new deploy-path decision before rewriting — NO MAGIC):
`CLAUDE.md` (§6 trap, §9 deploy), `docs/MANUT_DEPLOY_RUNBOOK.md`, `docs/BETA_GO_NO_GO.md`, `docs/MANUT_LAUNCH_CHECKLIST.md`, `docs/IMPLEMENTATION_PLAN.md`, `.github/workflows/manut-autodeploy.yml.disabled`, comments in `manut-build.yml`/`release.yml`/`Dockerfile.fullstack`. Migrations' historical comments: leave untouched.

## 🚨 CRITICAL — secret leak (rotate immediately, independent of everything else)

`docs/IMPLEMENTATION_PLAN.md:1219-1220` contains a **plaintext production Postgres password** and Resend keys:
`postgresql://postgres:<REDACTED>@<host>:<port>/railway` + `RESEND_API_KEY`.
Action: rotate the DB password + Resend key, purge from the file, and scrub git history (`git filter-repo`/BFG) since it's committed. The security sweep (wf2 group "Security/leak") has more — finding #1 overall is a CRITICAL security/PROD item; read wf2-sweep.json.

## Core bug root-causes & fixes

### Bug #1 — Control Plane Roles "Unhandled error raised" [R1 + R2]

Root: **production migration drift** — `agentRoles`→`MnAgentRegistryService.listRoles`→`prisma.mnAgentRole.findMany()` hits `mn_agent_roles`, which is absent in the deployed DB (migration `20260514120000` and the post-May-17 mn\_\* / social_analytics migrations never applied). Prisma throws raw `P2021` → not a `UserFriendlyError` → generic message. DI/decorators/registration all verified CORRECT.
Fixes:

- **R1 (ops, you):** apply pending migrations to prod (`prisma migrate deploy`); verify `SELECT to_regclass('public.mn_agent_roles')` non-null; confirm `ENABLE_MANUT_MODULE=true`.
- **R2 (code):** wrap Prisma calls + `assertWorkspaceMember` in `manut-agent-registry.service.ts`, `manut-release-runs.service.ts` (and M2/M3/M4 services) so `P2021/P2022` and membership failures map to a `UserFriendlyError` ("control plane not provisioned") instead of bare `Error`. Add `isGraphQLSchemaValidationError`→friendly mapping to the Roles `setting-panel.tsx` (mirror `agents-list.tsx`).
- **Runbook + smoke (decided):** `docs/manut-bughunt/MIGRATION_RUNBOOK.md` + extend `__tests__/manut/module-init-smoke.spec.ts` to assert gated tables exist.
  Files: `plugins/manut/manut-agent-registry.{service,resolver}.ts`, `manut-release-runs.{service,resolver}.ts`, `manut.module.ts`, `desktop/dialogs/setting/general-setting/control-plane-roles/setting-panel.tsx`.

### Bug #2 — MongoDB "Connected" but Analytics empty [R1, no prod needed for UX fix]

Root: **three disjoint sources, by design.** Settings badge reads the generic `listConnections` (mongo record present → "Connected"). Analytics overview CONNECTIONS reads the `SocialPlatform` enum list (FACEBOOK/INSTAGRAM/THREADS/TIKTOK/LINE_VOOM/GOGOCASH) — Mongo isn't a member → "No platforms connected." Overview KPIs read the `workspace-analytics` rollup, which Mongo ingestion (`plugins/mongodb-connection/ingestion.cron.ts`) never writes into → "No data yet."
Fixes (UX reconciliation, code-only):

- Disambiguate copy: Settings = "Data connections", Analytics CONNECTIONS = "Social platforms" — update `analytics-overview/index.tsx` empty-state (lines ~134-155) + settings panel headings. AND/OR surface data-connections (Mongo) in the analytics overview with an "awaiting first sync" state.
- (Larger, optional) bridge Mongo ingestion → `workspace-analytics` rollup so KPIs populate.
- Review commits `900ca9c43`/`4b3391f66` — they suppress query errors; ensure not masking a real resolver failure.
  Files: `modules/analytics/views/analytics-overview/index.tsx`, `connections-settings/index.tsx`, `services/connection.service.ts`, `entities/analytics-data.entity.ts`, `modules/connections/*`, backend `plugins/analytics/*`, `plugins/mongodb-connection/*`.

### Bug #3 — AI panel layout (docked clip + floating overlap) [R2, no prod, FULLY SPEC'D]

Root: empty-state geometry driven by `independentMode` + `onboardingOffsetY` props on Lit `AIChatContent`.

- **Docked** (`desktop/pages/workspace/detail-page/tabs/chat.tsx`, in the `if (!chatContent){...}` block ~line 458): never sets `independentMode`/`onboardingOffsetY`. So `.messages-placeholder` stays `position:absolute` centered (clipped logo + gap), and `Math.abs(undefined)*2 = NaN` → `paddingBottom:"NaNpx"`. FIX: set `content.independentMode = true;` and `content.onboardingOffsetY = 0;` (mirror floating host index.tsx:428-429 and chat/index.tsx:322-323).
- **Floating** (`components/floating-ai-chat-anchor/index.tsx:429`): `onboardingOffsetY = -100` is tuned for the tall /chat page → 200px composer pad in the short overflow:hidden window → header overlaps composer. FIX: set to `0` (or small) for the floating window.
- **Robustness** (`blocksuite/ai/components/ai-chat-content/ai-chat-content.ts:664-668`): guard `const offset = this.onboardingOffsetY ?? 0;` before `Math.abs(offset)*2`. (Lit `css` — watch stray backticks in comments per v1.9.0 scar.) Optionally change empty-state `.chat-panel-main` `justify-content:center`→`flex-start` so over-tall content scrolls instead of clipping.
  Verify: `yarn affine bundle -p web` clean; `/browse` docked + ⌘J floating empty chat.

### Bug #4 — Workspace logo shows blank after upload [R1, needs prod confirm]

Root: logo is a content-addressed **blob**; only the blob key is stored in YDoc `meta.avatar`. Display re-downloads root doc → `getWorkspaceBlob` tries local then `CloudBlobStorage.get`; on miss returns null and `workspace-avatar/index.tsx:68-70` swallows the error → colored placeholder. Likely the blob bytes never finished syncing to cloud (or cloud GET 404s), so it shows only on the uploading device.
Fixes:

- **R1 (code):** in upload path `setting/workspace-setting/preference/profile.tsx:56-60`, force-await the cloud blob upload before `workspace.setAvatar(blobId)`.
- **R2 (code):** `workspace-avatar/index.tsx:68-70` surface fetch errors via telemetry instead of silent placeholder.
- Confirm on live: DevTools Network `GET /api/workspaces/<id>/blobs/<avatarKey>` (404 ⇒ read/sync issue); is it visible on the uploading device only?
  Files: `components/workspace-avatar/index.tsx`, `setting/workspace-setting/preference/profile.tsx`, `modules/workspace/entities/workspace.ts`, `modules/workspace-engine/impls/cloud.ts`, backend `core/workspaces/controller.ts`, `core/storage/wrappers/blob.ts`.

### Bug #5 — Dark mode white "Home" nav pill (+ same-pattern sweep) [R2]

Group "Dark-mode hardcoded-color defects" has 4 findings (exact files/lines in `wf2-sweep.json`, targeted group). Root: hardcoded light color instead of `cssVarV2`/`var(--affine-*)` token on the mobile top-nav Home pill; same pattern elsewhere in Manut-added components. FIX: replace literals with theme tokens. **Read the wf2 group for exact file:line before editing.**

## Remaining 37 sweep findings (groups in wf2-sweep.json)

- T: Workspace logo (3) · Dark-mode (4)
- S: Manut module backend (3) · connections/analytics/mongo backend (5) · copilot providers/auto-router/prompts/SSE/@Field/key-leak (4) · PM/CRM/Reminders/Routines (3) · frontend wiring+theme §6b (4) · @Field UndefinedTypeError crash-class sweep (3) · security/leak (5) · migration↔schema drift (5)
  Recurring classes to expect: missing explicit `@Field(() => Type)` on nullable fields (startup crash), `gpt-5-mini` prompts (silent no-op on Vertex), Vertex `getBaseUrl` project-prefix branch, hardcoded colors, settings-tab wiring gaps.

## Fix Plan (recommended order for a fresh session)

1. **Verify tooling** (`yarn --version`, a small `tsc --noEmit` on one package) — ensure reliable I/O.
2. **@Field crash-class sweep** first (group "@Field UndefinedTypeError") — these 502 the whole server; highest blast radius. Add explicit `() => Type` to every nullable `@Field`. Add/boot a schema smoke test.
3. **Control-plane + module error hardening** (Bug #1 R2) + the **migration runbook + smoke**.
4. **Security/leak** group (5) + rotate the leaked secret.
5. **AI panel** (Bug #3) — fully spec'd above.
6. **Dark-mode** (Bug #5) + frontend wiring §6b group.
7. **Analytics/mongo UX** (Bug #2) + connections backend group.
8. **Copilot** group (gpt-5-mini, Vertex prefix, SSE) + **PM/CRM/Reminders** group.
9. **Workspace logo** (Bug #4) hardening.
10. Per CLAUDE.md §4: `yarn tsc --noEmit`, `yarn oxlint <files>`, `yarn affine bundle -p web`, relevant `ava` specs. Then hand back for review (no commits).

## Notes

- Branch is `codex/fix-resend-attachments` (unrelated to this work). Consider a fresh branch off `main` before committing (user said no commits for now).
- Project rules: TDD for backend critical paths; never `tsc -b` (use `tsc --noEmit`); `rxjs/finnish` `$` suffix on Observables; vanilla-extract `style({})` only in `.css.ts`; `gpt-5-mini` is poison on the Vertex stack.
