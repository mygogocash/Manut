# Manut QA-Audit Fix Marathon — Handoff for the Next AI

**Last updated:** 2026-06-01
**Status:** ✅ **Frontend waves SHIPPED to prod `manut.xyz`.** ⏳ **Backend batch is the only remaining work.**
**Goal:** Fix every finding in [`QA_AUDIT_2026-05-31.md`](./QA_AUDIT_2026-05-31.md) (UI/UX + frontend + backend + improvements), then deploy to prod.
**User decisions (locked):** H2 social connections → **bridge both systems**; half-built features → **wire them up**; backend testing/deploy → **prod direct, review-only** (no staging _gate_, but the proven path goes through staging anyway; user accepts backend can't be unit-tested locally).

---

## ✅ DONE — 3 frontend waves, merged + DEPLOYED to prod

Merged to `main` as **PR #183** → squash commit **`0220ad1a4`**. Built by Cloud Build (`manut-gcp-main-staging`), verified on staging, promoted to prod via canary. **Prod `manut.xyz` now serves revision `manut-00015-wix`** (image `affine-gogocash:0220ad1`), 100% traffic, smoke green (`/` 200, `/graphql` 400-alive, `/api/server-config` 200), **no ERROR logs**.

| Commit      | Wave                                                            | Highlights                                                                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `910f42358` | Projects                                                        | **H1** live-prod Kanban `ReferenceError` crash (extracted `projects/helpers.ts`); **M12** due-date UTC round-trip                                                                                                                                                        |
| `454b0e747` | Wave A — KG / Analytics / Mobile (35 files)                     | **H4** KG perf (hidden-pause, settle gate, `MAX_PHYSICS_NODES` cap), **H5** reduced-motion, **M15** KG canvas a11y, **M16** strategist modal, **M18** overview copy, mobile **M1/M2/M3** (Trash/404/not-found), **M4** Ask-AI modal a11y, **M9** session reset, + polish |
| `c22192307` | Wave B — Settings / AI-chat / CRM-Reminders-Routines (31 files) | **H6** view-run-closes-modal, **M10** approval-comment refresh, **M11** budget/workQueues tabs, **M14** a11y rows, **M5** `DEFAULT_MODE` edit→read, **M6** Image→`imageGen`, format relabel, CRM mailto/tel + mixed-currency, routines ERROR→Retry, reminders hint       |
| `2fb6b6ab3` | merge                                                           | merged `origin/main` (#182 mobile) into the branch; resolved `home.tsx` + `styles.css.ts` conflicts (took ours = superset)                                                                                                                                               |

Verification per wave: TDD (RED→GREEN vitest where logic), `oxlint` 0/0, i18n keys in `en.json` + `i18n.gen.ts` regenerated, web+mobile bundle compiled successfully. Two reviewer catches fixed mid-flight (M10 claimed-but-not-wired; a non-existent `routine.errorMessage` field).

**Rollback (prod, ≤30s)** if anything regresses:

```
gcloud run services update-traffic manut --to-revisions=manut-00013-5nm=100 --region=asia-southeast1 --project=affine-495114
```

---

## ⏳ REMAINING — Backend batch (the whole job now)

All in `packages/backend/server/src/plugins/**`. NOT started. Source: [`QA_AUDIT_2026-05-31.md`](./QA_AUDIT_2026-05-31.md).

- **H3** (high, security): add workspace authz to 4 connection resolvers — `posthog-connection`, `gogocash-connection`, `facebook-oauth`, `connections/connections.resolver.ts`. Add `await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Settings.Update')` on `set*`/`disconnect*` mutations, `'Workspace.Read'` on `*Connection` queries. Mirror `mongodb-connection.resolver.ts:100-103`.
- **H2** (high, user chose _bridge_): each `*-oauth` callback (facebook/instagram/threads/tiktok/line-voom) must **also upsert a `SocialConnection` row** (via `ConnectionService.upsertConnection`) so the analytics pollers (`meta.poller.ts` reads `SocialConnection`) see connections made through the settings panel. Keep the `IntegrationConnection` path.
- **M19**: token-refresh lock fallback (`connections/connections.service.ts:224-236`) — re-check `tokenExpiresAt` after the 250 ms wait + bounded retry.
- **M20**: LINE OAuth (`analytics/connections/oauth/line.oauth.ts:215-216`) — drop the raw response body from the thrown message (it lands in user-visible `lastError`); log it instead.
- **Low**: OAuth callback `<script>` HTML-escaping (9 controllers); `test*` connection-mutation ACL + rate-limit; `runContentRecommendation` tier (`Workspace.Read`→`Workspace.Settings.Update`); PostHog `projectCount` persist (or keep the now-dropped label); aggregation-cron doc says "15-min" but ingestion is 30-min.
- **From Wave A**: surface a `verified` boolean on connection DTOs so settings cards show "Credential saved" vs "Verified" honestly (frontend badge change waits on this).
- **Routines runner (DISSENT — handle carefully):** "Run now" is a no-op (the Vertex execution runner is a stub, `manut-routine.cron.ts`). It is **money-spending + cron + critical-path** and `ENABLE_MANUT_ROUTINES=true` is LIVE in prod, so the no-op is user-visible NOW. Either (a) implement a _bounded, tested_ runner on the existing copilot/Vertex infra, or (b) keep it honest (relabel "Run now" → "Queue (preview)"). Do NOT ship an untested money path to prod.

### 🚧 Backend testing gap (READ THIS)

This env has **no test Postgres** (`DATABASE_URL` unset, nothing on `:5432`); the backend suite is `ava --serial` against a real DB (`packages/backend/server/ava.config.js`). You **cannot run backend `ava` here** as-is. Mitigate:

1. `node_modules/.bin/tsc --noEmit -p packages/backend/server/tsconfig.json` (backend type-check).
2. Adversarial code review of each authz/bridge change.
3. **The canary itself is a boot-smoke** — Cloud Run only marks a revision _Ready_ if the container starts, so a successful canary deploy proves no `@Field`/DI startup crash (the scars). Smoke the canary's GraphQL before flipping.
4. Best: spin up a local Postgres (`docker` + `yarn workspace @affine/server prisma migrate deploy`) and run `ava` — safest for authz changes. (Local `docker` was unavailable this session; the next session may have it.)

---

## 🚀 PROVEN deploy path (use this for the backend deploy — no local docker needed)

This is exactly how the frontend shipped. gcloud is authed as `fronk.kunanon@gogocash.co` on project `affine-495114` (token expires — re-auth with `gcloud auth login` if it says "Reauthentication failed").

1. **Land code on `main`** (PR → review → merge). Merging `main` auto-fires Cloud Build trigger `manut-gcp-main-staging` → builds the fullstack image + deploys to **staging** (`staging.manut.xyz`). No local docker.
2. **Watch the build via GitHub** (reliable; avoids gcloud mangling):
   `gh api repos/mygogocash/Manut/commits/<merge-sha>/check-runs --jq '.check_runs[] | select(.name|startswith("manut-gcp-main-staging")) | {status,conclusion}'`
3. **Smoke staging:** `curl -s -o /dev/null -w "%{http_code}" https://staging.manut.xyz/` (200), `/graphql` (400=alive), `/api/server-config` (200). Eyeball the changed surfaces.
4. **Get the built image** staging is running:
   `gcloud run services describe manut-staging --region=asia-southeast1 --project=affine-495114 --format='value(spec.template.spec.containers[0].image)'` → e.g. `affine-gogocash:<merge-short-sha>`.
5. **Canary to prod (no live traffic):**
   `gcloud run deploy manut --image=<that-image> --region=asia-southeast1 --project=affine-495114 --no-traffic --tag=qaNNN` → new revision at `https://qaNNN---manut-idid7yszzq-as.a.run.app`, 0% live traffic. (Image-only deploy preserves prod env/secrets.)
6. **Smoke the canary URL** (same checks). Revision reaching _Ready_ = backend booted clean.
7. **Flip traffic:** `gcloud run services update-traffic manut --to-revisions=<new-rev>=100 --region=asia-southeast1 --project=affine-495114`.
8. **Smoke prod** `manut.xyz` + check error logs: `gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=manut AND severity>=ERROR' --project=affine-495114 --limit=8 --freshness=8m`. **Rollback** = step's traffic command back to the prior revision.
9. **Tidy:** `gcloud run services update-traffic manut --remove-tags=qaNNN ...`.

---

## How to verify in THIS repo (hard-won recipe)

- **Tests:** `rtk proxy yarn vitest run <abs-path>` (vitest 4, node env; `// @vitest-environment happy-dom` for DOM; `TZ='America/Los_Angeles'` prefix for TZ tests).
- **Lint (the real pre-commit gate):** `rtk proxy yarn oxlint <files-or-dirs>` → must be "0 warnings and 0 errors".
- **DO NOT** `tsc -p`/`tsc -b` on `@affine/core` — 3400+ `TS6305 "dist not built"` noise; `tsc -b` illegally emits into `src/`. Frontend gate = **vitest + oxlint + bundle**. (Backend `tsc --noEmit -p packages/backend/server/tsconfig.json` is cleaner.)
- **Bundle = authoritative frontend gate.** Judge by **exit code + "compiled successfully" + `dist/index.html` exists** — NOT fragment greps.
- **i18n keys:** add to `en.json` (flat dotted keys, ~2688; insert additively next to siblings, do NOT full-sort — file isn't default-sorted), then `rtk proxy yarn workspace @affine/i18n build` to regen types. Accessor `t['key']()` is a `@ts-nocheck` Proxy (missing key → raw key at runtime, no crash).
- **Before `git commit`:** `rm -rf node_modules/.cache/prettier` (husky prettier crashes on stale cache: `Cannot read properties of undefined (reading 'getFileDescriptor')`). Stage by name, never `git add -A`. No `--no-verify`.

## ⚠️ Scars hit this session (don't repeat)

- **RTK output mangling:** `rtk proxy` duplicated/garbled command output (incl. `git`/`gcloud` inside `node execSync`) by 20–200× and even injected fabricated text — making verification unreliable. **Use the `Read`/`Write` tools (disk-direct) for anything you must read precisely; write command output to a file via `node fs.writeFileSync` then `Read` it.** Judge success by exit codes + specific markers, never a fragmentary read. If it keeps mangling, a fresh session helps.
- **Self-misdiagnosis:** I once "found" a `Forbidden import @affine/core/modules/workspace` bundle failure that **did not exist** (read a 145-line log at a bad offset, fabricated the error, wrongly reverted a correct file — the bundle had PASSED). Confirm bundle status from the authoritative signal only. `useService(WorkspaceService)` is a normal allowed import.
- **Env:** local `docker` unavailable (use Cloud Build, not local image build); gcloud token expires mid-session (`gcloud auth login`); local `main` carries 3 user commits on `codex/ai-chat-interceptor-retrieval-filters` (now synced to origin/main, work safe on that branch).
- Standard `CLAUDE.md` scars: vanilla-extract `style()` only in `.css.ts`; explicit `@Field(() => Type)` on nullable GraphQL fields; never `import type` a NestJS DI target + `@Injectable()` on every provider; rxjs/finnish `$` suffix; no backticks in Lit `css`/`html` literals; `gpt-5-mini` is poison on Vertex.

## Pointers

- Full prioritized findings + fix detail: [`QA_AUDIT_2026-05-31.md`](./QA_AUDIT_2026-05-31.md).
- Prior session handoff (control-plane bug-hunt, deploy/CICD context): [`HANDOFF.md`](./HANDOFF.md).
- `CLAUDE.md` §9 is **stale** (says prod = Railway; it's GCP Cloud Run) — fix via PR.
