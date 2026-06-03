# Manut Bug Hunt — Live Status (2026-05-31)

> 👉 **2026-06-03 current continuation:** `codex/fix-ux-ui-bughunt` merged via
> PR #188 at `35bc631166d5c3d82f892793283ba990f417a54d`; product-code Build #141 pushed
> `main-35bc63116-26876250444`. PR #189 then merged the handover refresh and
> Build #142 pushed latest main image `main-ac0599849-26877703841`; production
> is not deployed from that latest image.
> Continue from **[`UX_UI_BUGHUNT_2026-06-02.md`](./UX_UI_BUGHUNT_2026-06-02.md)**
> and
> **[`UX_UI_BUGHUNT_FIX_SPEC_2026-06-03.md`](./UX_UI_BUGHUNT_FIX_SPEC_2026-06-03.md)**.
> This file is retained for the 2026-05-31 control-plane/status trail and should
> not be used as the active branch status without revalidation.

> 👉 **2026-06-01 update:** a newer QA-audit fix marathon is in progress —
> see **[`QA_FIX_HANDOFF.md`](./QA_FIX_HANDOFF.md)**. 3 frontend waves are
> committed + pushed + bundle-verified on `fix/qa-audit-2026-05-31`; the backend
> batch + prod deploy remain.

## ✅✅ FINAL VERIFICATION (all green, independently re-confirmed in a clean context)

- `@affine/server` `tsc --noEmit`: **0 errors**
- `@affine/core` `tsc --noEmit`: **0 errors**
- `yarn oxlint` on all **34** changed .ts/.tsx files: **0 warnings, 0 errors** (incl. rxjs/finnish)
- `yarn affine bundle -p web`: **compiled successfully (exit 0)** — all frontend changes are bundle-clean
- SSRF: `ssrf-guard.ts` + `ssrf-utils.ts` (canonical `isPrivateIp`) clean, no dup declarations
- NOT done: runtime `/browse` smoke on the live app (needs a running server) and the two PROD/ops items below.

## Verified state of the working tree (uncommitted, on branch `codex/fix-resend-attachments`)

### ✅ Confirmed good

- **Railway removal** complete: deleted `railway.toml`, `.docker/manut/Dockerfile.railway`, `manut-railway-deploy.yml.disabled`, `docs/MIGRATE_GCP_TO_RAILWAY.md`, `scripts/manut-dns-railway-tls.sh`, `scripts/manut-railway-phase0-validate.sh`; genericized the Railway DNS hint in `cloud/services/fetch.ts`. KEPT `.docker/manut/entrypoint.railway.sh` (live ENTRYPOINT in `Dockerfile.fullstack`).
- **Backend `tsc --noEmit`: 0 errors** (after cleanup below).
- **Frontend `@affine/core tsc`: 0 errors** (checked before SSRF re-do).
- Clean fixes landed from agents A/C/D/E/F/G:
  - A: `manut-routine.dto.ts` (`@Field(() => Number)`→`Int`), `manut-control-plane-errors.ts` (new — maps Prisma P2021/P2022 to friendly error), control-plane service error mapping, reminder cron/job try-catch.
  - C: copilot — wired `assertBudgetAllowed`/`injectGoalContext` (M4 budget gate), `resolver.ts`/`session.ts` `@Field(()=>Number)`→Int/Float.
  - D: AI panel (Bug #3) — docked `chat.tsx` now sets `independentMode`/`onboardingOffsetY`; floating offset reduced; `ai-chat-content.ts` NaN-padding guard (`?? 0`). Backticks balanced (verified).
  - E: dark/light theme — mobile `home-header` Home pill token, knowledge-graph node panel, editor settings dropdown, i18n titles.
  - F: analytics/connections UX reconciliation (Bug #2) — "Data connections" vs "Social platforms" copy + connected-awaiting-sync state.
  - G: workspace logo (Bug #4) — await cloud blob upload before `setAvatar`; surface blob-fetch failures.

### 🔁 Reverted (were corrupted by a broken iterative-Edit in the SSRF agent — being redone cleanly)

- `mongodb-connection/mongodb-connection.service.ts` → reverted to HEAD
- `posthog-connection/posthog-connection.service.ts` → reverted to HEAD
- `connections/ssrf-guard.ts` (new) → deleted (had 70 duplicate declarations)
- `__tests__/manut/module-init-smoke.spec.ts` → reverted to HEAD (Agent H's extension used a non-existent `@affine-tools/utils/nestjs` import + invalid TestingModule keys)
  **Re-doing now** via workflow `wstvz8r2p` (fresh context, Write-based): clean `ssrf-guard.ts` + one guard call each in mongo/posthog services (SSRF findings #7/#19/#18).

### ⏳ In flight (workflow `wstvz8r2p`)

SSRF clean re-implementation + verification: backend tsc, core tsc, **oxlint on changed files** (earlier run hit "0 files" — not yet truly verified), **web bundle** (runtime gate for all frontend changes).

## ❗ Still requires the USER (not code)

1. **🚨 Rotate the leaked secret** — `docs/IMPLEMENTATION_PLAN.md:1219-1220` has a plaintext prod Postgres password + Resend key (it's committed → rotate + purge git history with BFG/git-filter-repo).
2. **Apply pending prod migrations** — Bugs #1 (control plane) and the data-half of #2 are PRODUCTION migration drift (`mn_agent_roles` + post-May-17 mn\_\*/social/mongo tables missing). `prisma migrate deploy` on prod; see `docs/manut-bughunt/MIGRATION_RUNBOOK.md` (Agent H wrote it). The code is now hardened to degrade gracefully instead of "Unhandled error raised", but the tables still need to exist for the feature to work.

## ⚠️ Correction log (don't repeat these)

- My ad-hoc "corruption scan" (line-repeated-≥5-times heuristic) was a **FALSE-POSITIVE generator** — it flagged 13 files, but `tsc` (ground truth) only ever had **4 errors in 2 files**. Repeated `@Field(() => String)` / `@property()` / `useEffect()` lines are NORMAL. **Trust `tsc`, not regex corruption guesses.** Net damage was self-healing (the 2 reverted services + deleted ssrf-guard are being re-done correctly by workflow `wkr2zmf08`).

## Smoke-spec fix facts (for the agent that fixes `__tests__/manut/module-init-smoke.spec.ts`)

The 3 remaining backend `tsc` errors are ALL in this ONE new test file (which is NOT in the server bundle, so it blocks nothing at runtime — only a clean `tsc`). Fix against the REAL API:

- `TestingModule` imports from **`@nestjs/testing`** (NOT `@affine-tools/utils/nestjs`).
- Real helper: `createModule(options)` from `../create-module`; `CreateModuleOptions = { imports?, providers?, controllers?, overrides?: ProviderOverride[] }` where `ProviderOverride = { provide, useValue?|useClass?|useFactory? }`.
- The Manut module gate is **env-based** (`ENABLE_MANUT_MODULE` / `isManutModuleEnabled()`), there is **no `manut` config namespace** — so `ConfigModule.override({ manut: { enabled: true } })` is wrong. Either set the env in the test bootstrap or import `ManutModule.forRoot()` per its real signature (grep it).
- This is a DB-backed test (runs `to_regclass` queries) — it needs a real Postgres. Match how other DB specs in `__tests__` gate themselves (they skip/guard when no DB). Do NOT leave it as false-green; if it can't run in CI without a DB, gate it the same way siblings do and say so.

## Cleaned up

Removed stray agent temp files (`.bug3_*.txt`, `err.txt`, `.playwright-mcp/`, `/tmp/corruption_scan.cjs`).

## Not yet done (lower-priority sweep findings)

PostHog/GoGoCash record-only collectors (#12, failed-feature — large, deferred), a few medium/low items. See `wf2-sweep.json` for the full 39-finding list and `HANDOFF.md` for the plan.
