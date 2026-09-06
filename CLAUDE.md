# CLAUDE.md — Intranet work rules

This file is the contract for any AI agent (Claude Code, Cursor, etc.) working in this repo. Read it before changing code; update it when you change a rule.

---

## This repository

GitHub: [`mygogocash/Manut`](https://github.com/mygogocash/Manut). Default branch is `main`. Long-lived env branches are `preview` (staging) and `production` (prod). Product name is **Intranet**; workspace packages stay `@nexora/*`.

## Repo layout

```
apps/
  api/           Express 5 + TypeScript backend (port 3001)
  web/           Next.js 16 + React 19 (legacy UI; Cloud Run / Vercel / Playwright)
  edge/          Hono on Cloudflare Workers (Express port)
  edge-jobs/     Cloudflare Cron Triggers + Queue fan-out
  app/           Expo Router — official web client (port 8081) + iOS / Android
packages/
  database/      Prisma schema + migrations + seed (Express / Cloud Run)
  db/            Drizzle schema (edge)
  core/          Shared domain services used by the edge
  auth/          Better Auth helpers for the edge
  contracts/     Shared route / DTO contracts
  ui/            Shared utils + re-exports. NOTE: the shadcn components
                 themselves live in apps/web/src/components/ui/ (56 files);
                 this package holds only index.ts + utils.ts.
  types/         Shared TS types
  utils/         Shared helpers
docker/          Cloud Run images
docs/            PRDs + specs (human-curated)
.github/
  workflows/     deploy.yml (production), deploy-staging.yml (preview),
                 deploy-edge-staging.yml, deploy-vercel.yml, pr-checks.yml
```

Monorepo: Turborepo + pnpm 10. Workspace package names: `@nexora/api`, `@nexora/web`, `@nexora/database`, `@nexora/edge`, `@nexora/app`, `@nexora/db`, etc.

---

## Tech stack

- **Backend**: Express 5, TypeScript, Prisma 6, PostgreSQL (Supabase), Supabase Auth, Zod validation, Resend for email, Gemini for AI.
- **Edge**: Hono on Cloudflare Workers + Hono RPC (`@nexora/edge/rpc`) + Drizzle (`@nexora/db`) over Hyperdrive → Postgres. Sidecar only: D1 + Durable Objects + Queues + Workflows + R2 + optional Vectorize/Workers AI. Access/Zero Trust fails open unless `CF_ACCESS_AUD` is set. Cron/queue work lives in `apps/edge-jobs`. Do **not** put ERP tables (users, leave, CRM) on D1.
- **Frontend**: Expo 54 + Expo Router (`apps/app`) is the official web client (`pnpm dev:web`, port 8081). It talks to Express with `X-Client: expo` and Bearer JWTs. Next.js 16 (`apps/web`) remains the complete legacy UI served by Cloud Run, Vercel, and Playwright (`pnpm dev:web:next`, port 3000).
- **Infra**: GCP Cloud Run (API + Web) on `production`; staging Cloud Run + edge staging on `preview`. Artifact Registry, GitHub Actions, Workload Identity Federation. Database is Supabase Singapore (`aws-1-ap-southeast-1`).
- **Auth**: Supabase Auth issues JWT; Express middleware resolves Prisma user + roles + permissions per request. Permission codes are `module:action` (e.g. `crm:read`). Edge uses Better Auth against the same user table.

---

## Environment files

- `.env.development` (root) — local dev. Loaded by `apps/api/src/env.ts` when `NODE_ENV=development`. Also picked up by Prisma scripts via dotenv-cli cascade.
- `apps/web/.env.development` — Next.js mirror of `NEXT_PUBLIC_*` + `API_URL`. Next.js does **not** read parent-dir env files; you must mirror.
- `.env.production` (root) + `apps/web/.env.production` — production keys. **Never commit.** Cloud Run gets them via `--set-env-vars` from GitHub Secrets.
- `.env` — legacy fallback (currently holds `ANTHROPIC_API_KEY` only). Prefer `.env.development`.

All four `.env*` files are gitignored. Adding a new secret means: update root `.env.development`, mirror in `apps/web/.env.development` if web-facing, add to `turbo.json` `globalEnv`, and add to GitHub Secrets + `deploy.yml` `--set-env-vars` for prod.

---

## Daily commands

```bash
pnpm dev:api        # Express on :3001
pnpm dev:web        # Expo official web on :8081
pnpm dev:web:next   # Next.js legacy UI on :3000
pnpm dev:edge       # wrangler dev for the Hono worker
pnpm dev:app        # alias for Expo (`@nexora/app`)
pnpm db:generate    # regenerate Prisma client
pnpm db:migrate     # create + apply local migration
pnpm db:push        # push schema without migration (local / staging only)
pnpm db:seed        # run seed.ts
pnpm db:studio      # Prisma Studio
pnpm type-check     # all workspaces
pnpm lint           # all workspaces
pnpm test           # vitest, all workspaces
pnpm route-parity   # Express vs Hono coverage
```

`db:*` scripts cascade `.env.development` → `.env`. Prod variants live under `db:migrate:prod:*` and read `.env.production`.

---

## PR rules

PR Checks workflow blocks merge until all of these pass:

1. **type-check** — `tsc --noEmit` across the monorepo.
2. **lint** — `eslint` (api) + `next lint` (web). Warnings allowed; errors block.
3. **test** — `vitest run` (api + web). All suites must pass.
4. **brand-drift** — grep gate against forbidden brand strings.

Before opening a PR:

- Run all four locally (`pnpm type-check && pnpm lint && pnpm test`).
- Keep PR titles in conventional-commit form (`fix(scope): …`, `feat(scope): …`, `ci(scope): …`).
- Branch naming: `claude/<short-slug>` for AI-authored work, `feat/…`, `fix/…`, etc. otherwise.
- Use `--set-upstream` on first push.
- PR body should have a Summary section and a Test plan checklist.

---

## Coding conventions

### Backend (`apps/api`)

- Controllers go in `src/modules/<module>/<module>.controller.ts`; service logic in `<module>.service.ts`; Prisma access in `<module>.repository.ts`.
- Routes register on the `Router()` at the bottom of the controller. **Literal paths must come before `:param` routes** — Express matches in order; `/import-template` will be eaten by `/:id` if listed second.
- Validate inputs with Zod schemas in `<module>.validation.ts`; export the inferred `*Input` types.
- Use `BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException` from `src/common/exceptions/http-exception`. Never `throw new Error("…")`.
- Permission gates: `requirePermission("scope:action")`. Admin role bypasses every gate via `auth.service.resolvePermissions`. Don't replicate that bypass in route guards — the resolver handles it.
- Don't log secrets. Logger is winston (`apps/api/src/common/utils/logger.ts`); use `logger.info("msg", { … })` with object metadata.

### Frontend (`apps/app` — official local web)

- Universal stack: Expo Router, NativeWind v4, React Native Reusables (`src/components/ui`), TanStack Query (`useApiQuery`), TanStack Table v8 (`DataTable`), Expo DOM (`src/components/dom`, `'use dom'`) for web-only HTML. Do not run Reusables `init` on this repo — add primitives under `src/components/ui` and keep `components.json` for `pnpm dlx @react-native-reusables/cli add`.
- Expo Router on :8081. API calls go through `src/lib/api-client.ts` (`apiRequest` / `api`) with `X-Client: expo` and a Bearer token from `intranet.session.v1`. Never cookie `fetch`.
- Default API origin is `http://localhost:3001`. Set `EXPO_PUBLIC_APP_URL=http://localhost:8787` to target the edge Worker instead.
- Permission-gated nav lives in `src/lib/nav.ts`; the dashboard shell filters it the same way Express Admin bypasses gates.
- Converted templates: login / magic-link / reset, dashboard shell, home, leave. Other module pages may still use StyleSheet + `apiRequest` — port them to Query + Reusables when you touch them. Next.js (`apps/web`) stays the complete Cloud Run / Vercel / Playwright UI.

### Frontend (`apps/web` — legacy Next.js)

- Routes live in `src/app/(dashboard)/…`. Server components only when the data is server-fetchable; otherwise `"use client"`.
- API calls go through `src/services/<module>.service.ts` using the shared `api` helper from `@/lib/api-client`. Never `fetch` directly in components.
- Forms: react-hook-form + zodResolver + shadcn `Form` primitives. Reset the form via `useEffect(() => form.reset(…), [open, payload, form])` — and remember that `UserListItem` ≠ `UserDetail`. If a list-item lacks a field, fetch the detail before resetting (see `employee-form-dialog.tsx`).
- Auth state: `useAuth()` exposes `user`, `roles`, `permissions`, `hasPermission`, `hasRole`, `refreshUser`. Call `refreshUser()` after any role / permission change that affects the current user.
- Sidebar / route guards read from `state.permissions` only; do not gate UI on JWT claims directly.
- Brand tokens: `cream`, `bronze`, `gold` (live design system on `tbh-intranet.web.app`). Local `globals.css` may differ — when in doubt, match the live site.

### Database (`packages/database`)

- One schema file per domain in `prisma/schema/*.prisma`. Run `pnpm db:generate` after edits.
- Migrations: never edit a committed migration. New change → `pnpm db:migrate -- --name <slug>`.
- Migration scripts must be **idempotent** when reasonably possible. Use `IF NOT EXISTS` / `IF EXISTS` for `ALTER TABLE … ADD COLUMN` and `DROP …`. A migration that's safe to re-run survives partial-apply incidents.
- Don't write data migrations that depend on tables a later consolidation will drop. If a migration references a table not in the current schema, it must be retired before that consolidation lands.

---

## Deployment

- **Promote `main` → `preview` and `main` → `production` with a MERGE COMMIT, never a squash** — see [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md). Feature PRs into `main` may squash. Squashing one long-lived env branch into another discards ancestry, so the next promote re-proposes every commit since the last true merge. After a hotfix committed on `production`, back-merge `production` → `main` the same day; cherry-picking copies content but does not restore ancestry.
- `main` is the default trunk. PRs land here. A push to `main` does **not** deploy Cloud Run or Vercel.
- `preview` push → `deploy-staging.yml` (`nexora-api-staging` / `nexora-web-staging`) and `deploy-edge-staging.yml`. Separate Supabase via `STAGING_*` secrets. **Staging syncs schema with `pnpm db:push`, NOT `prisma migrate deploy`.** A *schema* change reaches staging, but **any data-migration SQL inside a migration file never runs on staging** — a column that depends on a backfill stays empty there until seeded by hand. Don't tell the user a data-migration-dependent feature is "working on staging." **"By hand" now has a mechanism**: put the statements in a `packages/database/scripts/*.mjs` script (idempotent, `--dry-run` supported) and run it through the `Database backfill (manual)` workflow (`db-backfill.yml`), which supplies `STAGING_DATABASE_URL` from secrets and defaults to a dry run. Reference: `backfill-advance-side-vendor.mjs`. `pr-checks.yml` gates PRs into `main`, `preview`, and `production`.
- `production` push → `Deploy to GCP Cloud Run` (`nexora-api` / `nexora-web`) and `deploy-vercel.yml`.
- `Apply Prisma migrations to prod DB` step runs **before** the Docker build. Failure here aborts the deploy. Watch P3009 (`failed migration`) — clear via the resolve step in `deploy.yml`, which runs `prisma migrate resolve --rolled-back` for known-stuck names with `|| true` (idempotent).
- Cron jobs hit `/api/cron/*` with header `X-Cron-Secret: ${CRON_SECRET}`. Cloud Scheduler is provisioned manually; coordinate with infra before adding new cron endpoints.
- **ARIA Cloud Scheduler entries** (provision after deploying #457 / #460 / this PR):
  - `POST /api/cron/aria-knowledge-sync` — daily 03:00 SGT. Pull-based auto-sync of operational tables into the knowledge corpus (Phase 4).
  - `POST /api/cron/aria-purge-pii` — daily 02:30 SGT. Redacts `aria_query_logs.user_message` older than `ARIA_PII_RETENTION_DAYS` (default 30, sentinel string).
  - Both use the same `X-Cron-Secret: ${CRON_SECRET}` header. Idempotent — re-runs are safe.
- **IT Operations billing reminders** — `POST /api/cron/it-billing-reminders`, daily 08:00 Asia/Bangkok. Fires renewal (30/15/7-day) + payment-due (7-day) alerts and emails the subscription owner. Idempotent + debounced per subscription via `it_subscriptions.reminders_sent`; a recorded renewal decision re-arms the ladder. Provision:
  ```bash
  gcloud scheduler jobs create http it-billing-reminders \
    --schedule="0 8 * * *" --time-zone="Asia/Bangkok" \
    --uri="https://<API_HOST>/api/cron/it-billing-reminders" \
    --http-method=POST \
    --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
    --message-body="{}"
  ```
- **CRM deadline reminders** — `POST /api/cron/crm-deadline-reminders` (legacy alias `POST /api/cron/it-crm-deadline-reminders` still works — same handler), daily 08:00 Asia/Bangkok. ONE cron serves every enabled board CRM (IT + Project + HR …; grows per rollout phase via `NOTIFY_ENABLED_MODULES` in `crm-shared/crm-modules.ts`). Emails project go-live (30/14/7/1-day + overdue) and task due-date (7/3/1-day + overdue) alerts to the project owner / task assignees plus each module's admin-editable recipient list (`SystemSetting` key `<listSlug>.reminder_recipients` — `it-crm.reminder_recipients`, `project-crm.reminder_recipients`, `hr-crm.reminder_recipients`, …). Idempotent + debounced per row via `reminders_sent`: **IT go-lives on `it_projects.reminders_sent`; Project/HR go-lives on `projects.reminders_sent`** (shared-board CRMs store projects directly in `projects`, no native mirror); **Legal/Accounting go-lives on their native `legal_projects`/`accounting_projects.reminders_sent`** (native-mirror CRMs — the lazy mirror never carries reminder state, so the cron + bell scan the native tables; their terminal set adds `done` for Accounting's kanban); task rows on `project_tasks.reminders_sent` scanned `WHERE project.team IN (enabled teams)`. Worker: `crm-shared/crm-reminders.ts` `processCrmDeadlineReminders`. **Requires the `it-crm-deadline-reminder` email template on the email service** (reused across CRMs; `crmLabel` variable names the source CRM) or emails render empty. Provision:
  ```bash
  gcloud scheduler jobs create http crm-deadline-reminders \
    --schedule="0 8 * * *" --time-zone="Asia/Bangkok" \
    --uri="https://<API_HOST>/api/cron/crm-deadline-reminders" \
    --http-method=POST \
    --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
    --message-body="{}"
  ```
- **Accounting daily status check** — `POST /api/cron/accounting-status`, daily 08:00 Asia/Bangkok. Auto-expires sent quotes past their expiry date (→ `expired`) and flags sent/partial invoices+bills past due (→ `overdue`). "Today" resolved in Asia/Bangkok (UTC+7). Idempotent + safe to re-run (WHERE is constrained to the transitionable statuses + non-null dates, so no legacy row is ever mutated). Worker: `accounting.service.ts` `runStatusChecks`. No email/template dependency (in-app status only; notification-bell surfacing lands with the Overview-v2 milestone). Provision:
  ```bash
  gcloud scheduler jobs create http accounting-status \
    --schedule="0 8 * * *" --time-zone="Asia/Bangkok" \
    --uri="https://<API_HOST>/api/cron/accounting-status" \
    --http-method=POST \
    --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
    --message-body="{}"
  ```
- **Marketing DAU/MAU drift check** — `POST /api/cron/marketing-drift-check`, daily 09:00 Asia/Bangkok (after the 08:00 reminder jobs). **Two surfaces read BNII by different paths and nothing used to compare them**: `/marketing-analytics/dau-mau` queries the API live per request and persists nothing, while the OneWave dashboard + Partner Workspaces read `ow_daily_metrics` written by `/api/cron/ow-snapshot-refresh`. A missed run, a partially-ingested chunk (the ingest writes partial rows on a failed chunk) or an upstream restatement therefore leaves the two pages disagreeing about the same day, silently. The job diffs `dau_ga` / `mau_ga` / `total_views_homepage` for the trailing **30 settled days** (today + yesterday excluded; a row still flagged `is_intraday` past settling is itself a finding) and cross-foots the dashboard's published totals against their parts. Read-only apart from one `SystemSetting` write. Workers: `marketing-analytics/drift/drift.check.ts` (pure, unit-tested) + `drift.service.ts`.
  - **Never emails on an inconclusive run.** A failed BNII query, an empty window, or a telco upstream has no data for at all is reported as inconclusive/silent rather than as drift — otherwise an upstream outage would alert every stored day as broken.
  - **Alert debounce is a fingerprint, not a timestamp.** `SystemSetting marketing-analytics.drift_last` holds a digest of *which* (telco, date, metric) drifted, deliberately excluding the magnitudes: a permanent upstream restatement must not re-alert every morning, but a new day or metric changes the digest and re-alerts. A clean run resets it.
  - Recipients: `SystemSetting marketing-analytics.drift_recipients` (`{ recipients: [] }`). **Empty list = no email**, logged as a warning — the report is still returned in the response. Reuses the shipping `it-crm-task-update-2` template via `crmTaskUpdateEmail`; a new templateId would silently `TEMPLATE_NOT_FOUND`.
  - Body accepts `{ "force": true }` (re-send an unchanged alert), `{ "dryRun": true }` (report only) and `{ "today": "YYYY-MM-DD", "days": N }` (audit a historical window). Provision:
  ```bash
  gcloud scheduler jobs create http marketing-drift-check \
    --schedule="0 9 * * *" --time-zone="Asia/Bangkok" \
    --uri="https://<API_HOST>/api/cron/marketing-drift-check" \
    --http-method=POST \
    --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
    --message-body="{}"
  ```
  - **Current state: the prod job EXISTS and is PAUSED.** Created 2026-08-17 in project `tbh-nexora`, location `asia-southeast1`, targeting the prod Cloud Run URL. It was paused while the endpoint lived only on the old `dev` line. **Resume it after the next `production` deploy that contains the endpoint** — do not re-create it:
  ```bash
  gcloud scheduler jobs resume marketing-drift-check \
    --project=tbh-nexora --location=asia-southeast1
  ```
  - **Staging has no Cloud Scheduler jobs at all** — every one of the jobs in `tbh-nexora` targets the prod service. A staging job is viable if wanted: the first live dry-run there (2026-08-17) came back completely clean — 810 comparisons over 9 telcos × 30 days × 3 metrics, zero findings, zero cross-foot findings, no silent telcos — so `ow_daily_metrics` on staging is fully populated despite `ow-snapshot-refresh` never running there (the dashboard's on-read TTL refresh keeps it current).
  - **`dryRun: true` is the safe way to inspect a run.** It computes and returns the whole report without emailing. Note the run short-circuits on "no drift" *before* reading the recipient list, so `recipients: 0` on a clean report does NOT mean the list is unset.
- **Ship-a-module-dark flag (technique).** When a module's branch must merge to `main` but the feature can't surface in prod yet, gate it with a **fail-closed env flag** instead of commit/migration surgery. Pattern: an API runtime flag (`process.env.X === "true"`) wraps the route mount in `modules/index.ts`; a web build-time `NEXT_PUBLIC_X` gates the nav filter in `sidebar.tsx` + a `notFound()` guard on the page. **Fail-closed (`=== "true"`)** — a forgotten var hides the module rather than leaking it; an env flag also hides it from Admin (permission gates don't — Admin bypasses them). `NEXT_PUBLIC_*` is inlined at `next build`, so the web flag travels `--build-arg` → `Dockerfile.web` `ARG`/`ENV`, NOT runtime `--set-env-vars`; the API flag is the reverse. **Migrations still run on prod regardless — the gate hides UI/routes, not schema.** (History: this gated the v2 Expenses overhaul via `EXPENSES_ENABLED` alongside an ungated `Expenses [v1]`. As of the expenses-consolidation PR the v2 module was **removed** and v1 **promoted to the sole `/expenses` module** — the gate is gone. There is now one Expenses module; no `expenses-v1` route/tables.)
  - **Wiring a new flag is three files, not one.** Adding it to `turbo.json` `globalEnv` and the code is NOT enough to surface anything — the Fixed Asset tab stayed invisible on staging for exactly this reason. Checklist: (1) `docker/Dockerfile.web` — `ARG` + `ENV` for the `NEXT_PUBLIC_*` half; (2) the **web build step** of `deploy-staging.yml` / `deploy.yml` — `--build-arg`; (3) the **API deploy step** `--set-env-vars` for the runtime half. Miss (1) and the `--build-arg` is silently dropped by Docker with no error.
  - **Current state of `ACCOUNTING_FIXED_ASSETS`:** staging is hardcoded **on** in `deploy-staging.yml` (both halves) so the module is available for UAT. Prod reads the repo variable `vars.ACCOUNTING_FIXED_ASSETS` in `deploy.yml` — unset ⇒ empty ⇒ fail-closed, so flipping prod is a GitHub *Variables* change plus a re-deploy, no code edit.

---

## Common pitfalls

- **Permissions cache**: `AuthProvider` reloads `/me` on mount, login, visibility-return, and the periodic timer. Adding a new role assignment without one of those triggers leaves React state stale.
- **Form-dialog reopen**: parents pass slim `*ListItem` shapes. Always re-fetch the full detail on open if your form needs detail-only fields, or you'll silently overwrite real data on save.
- **Express route order**: see backend section above. Bitten twice already.
- **System Admin role**: `isSystem && name === "Admin"` is the bypass key. Don't gate on `permissions.includes("admin:manage")` for "is admin" checks — custom roles can hold that perm.
- **Migration consolidation**: when squashing migrations into a fresh `0000_init`, also delete every later migration whose schema is now part of `0000_init`. Leftover migrations will re-attempt their CREATE / ALTER and fail.
- **Singapore region**: Supabase is `aws-1-ap-southeast-1`. GitHub Actions runners are usually US — connection works on the shared pooler (port 6543 transaction, port 5432 session/direct) but expect occasional P1001s during transient pooler reboots.
- **Paginated aggregates**: never compute a total/count/sum by reducing the rows currently loaded in the client — a kanban column or table only holds one page. Totals that must cover the whole set come from a server roll-up endpoint (see `GET /investors/pipeline-totals`). Bitten on the investor pipeline column totals (showed the one loaded card's amount, not all 199).
- **Email HTML injection**: every caller-supplied string interpolated into an email template HTML body must go through `escapeHtml()` (`apps/api/src/infrastructure/email/templates.ts`). Free-text fields (notes, reasons, bank details, names) reach approver/HR inboxes — unescaped they inject HTML. Plain-text `subject:` lines are exempt. `escapeHtml` tolerates `null`/`undefined`.
- **Tailwind static scan**: dynamic class strings must be full literals Tailwind can see in source. `border-t-${color}` or `\`bg-${x}-500\`` get purged → no style. Keep a literal `Record<key, "border-t-blue-500">` map instead (see the investor pipeline + stage colours).
- **Generated Prisma client is gitignored** (`packages/database/src/generated/`, `apps/api/src/generated/`). CI runs `pnpm db:generate` before type-check (`pr-checks.yml`), so new models resolve without committing the client. Locally, run `pnpm db:generate` after any schema edit. `apps/web/tsconfig.tsbuildinfo` is generated — `git checkout --` it before committing.
- **Notification bell is (mostly) a server read-model, not a table.** `notification-bell.tsx` renders `approval` / `urgent` / `survey` / `it-crm` (deadlines) / `news` groups built from the dashboard stats payload — each recomputed on demand server-side (e.g. `dashboard.repository.ts` `getOpenSurveyFormsForUser`; `getItCrmRemindersForUser` = self-scoped upcoming/overdue project + task deadlines). Prefer the read-model: to surface something computable from source tables, add/extend a stats query, don't insert a record. **Exception — event notifications that can't be recomputed** (a status change / comment happened): the `it-crm-update` group reads the `ItCrmNotification` store (`dashboard.repository.ts` `getItCrmNotificationsForUser`), written best-effort by `it-crm-notifications.ts` `notifyItTaskEvent` from the shared `projects.service` write paths gated `team==='it'`. Even then, **read/unread stays the localStorage per-id seen set** (`seen-ids-v2`, stable ids) — the store persists the event, the seen-set governs the badge — never a timestamp threshold (that re-showed urgent items every few hours, #bug 2026-05-26).
- **AI Orchestrator notifications = EMAIL push only; the bell stays read-model.** The Request Tracking pipeline already surfaces every transition in the bell live: reviewers see pending gates in the `approval` group (`dashboard.service.ts` `pendingActions` from `pendingProjectReviews` / `assignedDepartmentReviews` / `businessHeadQueue` / `productAdminQueue` / `developmentQueue`), submitters see approve/reject/in-dev in the `urgent` group (`rejectedProjectsForMe` + `resolvedOrchestratorNotices`). So DON'T insert bell rows for orchestrator events — the only gap was email. `orchestrator/orchestrator-notifications.ts` `notifyOrchestratorEvent` fires **best-effort AFTER `logAudit`** at each transition (in `projects.service.create` submit, `pm-review`, `department-review` generate/assign, `review-progress` unlock, `executive-approval`, `send-back`, `development-scheduling`), emailing the stage's configured reviewers (`reviewersService.allStageReviewerIds` — "Manage reviewers" setup, NO permission-holder fallback) + the submitter + an admin CC list (`orchestrator-recipients.ts`, SystemSetting `orchestrator.reminder_recipients`). Reuses the shipping `crmTaskUpdateEmail` template (`crmLabel: "AI Orchestrator"`) — a new templateId would silently `TEMPLATE_NOT_FOUND`. Per-user prefs (`OrchestratorNotificationPreference`, self-scoped) gate email AND filter the bell read-model: `dashboard.service` applies `prefAllows(pref, "bell", event)` over orchestrator-origin `pendingActions`/`urgentItems` only (never leave/travel/expense). Event taxonomy + the read-model→event mapping live in `orchestrator-events.ts`. No cron, no new env var — all inline + event-driven.

---
- **Approval-step order gaps**: an ordered config table whose `order` is `@unique` AND rendered in the UI must be compacted on **delete**, not just on reorder. `deleteApprovalStep` used to only DELETE, so removing step 2 of four left the Expense Approval Chain page showing "1, 3, 4". Routing was unaffected (the chain compares steps relative to each other), which is why it survived. Park before packing — `ORDER_PARK_OFFSET + i` then `i + 1` — because a non-deferrable `@unique` collides mid-loop; the arithmetic lives in a pure `planOrderCompaction` helper so it is testable without a database.

## RBAC scoping conventions

When a module needs "owner sees own / admin sees all" semantics, follow the pattern set by `investors` (#202) and `hrms agreements` (#204):

1. Define a `*:read-all` permission alongside `*:read`. Admin role gets it via the seed; nobody else should.
2. The list service must compare `actorPermissions.includes(*:read-all)`. If false, force the row filter to `addedBy = req.user.id` (or `employeeId = req.user.id` for HR docs). Don't trust the client filter.
3. Apply the same ownership check on `getById`, `update`, `delete` — return 403 if the actor is neither the owner nor a *:read-all holder.
4. For the admin path, **require an explicit `employeeId` filter** so a missing query param can never fall back to "every row in the table" (see `listAgreements`).

## Module-specific patterns to reuse

- **Per-entity scoping** (Leave Policies, Public Holidays): the model holds `entityId` (cuid). UI uses an Entity selector + `__all__` filter. Migrations that seed for a specific entity look the id up by `code` (`SELECT id FROM entities WHERE code = 'TH'`) — entity ids are cuid-generated by the prisma seed, not fixed.
- **Signed-URL downloads** (`hrms agreements`): the `documents` Supabase bucket is **private** (only `article` / `avatars` / `blog` / `uploads` are public). For any download in `documents`, expose a `GET /<resource>/:id/download` route that re-checks ownership, parses the stored URL via `parseStorageUrl`, and returns a 5-minute signed URL. Never link the raw `fileUrl` from the client.
- **xlsx imports** (payroll, agreements roster): incoming numeric cells often arrive as `" 300,000.00 "`. Always coerce via the `coerceNumber` helper (or equivalent) — strip whitespace incl. NBSP / thin-space, drop digit-group separators (`,` `'` `_`), then `Number(...)`. Plain `Number(v)` returns `NaN` for HR's templates.
- **Two-row header xlsx** (payroll template): when row 2 holds sub-headers (e.g. `Meal` / `Transportation` under a merged `Allowances`), build composite keys: `row1[i] || row2[i]`. Skip data rows with no Employee Name so trailing reference rows don't get treated as data.
- **Login redirect**: post-login goes to `/dashboard` for any non-employee-only account. Employee-only accounts go to `/my-portal`. Don't reintroduce a per-role `defaultRoute` lookup (#208 dropped that).
- **Branding**: the platform is **Intranet** (#210). Workspace package names stay `@nexora/*` — implementation detail of the monorepo, never user-visible. Don't rename them.
- **ARIA evals** (`apps/api/src/modules/aria/__tests__/*.eval.test.ts`): three suites guard the assistant — tool registry (schema + RBAC), knowledge lookup (keyword Q→article, 80% hit-rate floor), and auto-sync workers (deterministic slugs + tag/perm shape). They run as part of `pnpm test` so a tool definition change or scoring regression blocks PR merge. When you add a new ARIA tool, add a happy-path + a permission-denied case to `aria-tools.eval.test.ts`. When you tune retrieval thresholds, add or update cases in `aria-retrieval.eval.test.ts` rather than relaxing the hit-rate floor.
- **Configurable list (admin-editable enum)** — used by investor pipeline stages, investor types, cash-advance approval steps. When a hardcoded enum needs to become user-editable: (1) an id/key-keyed config table (`key` PK or `order @unique`, `label`, `sortOrder`, no FK from the consuming row — the row stores the key as an open string so the list stays freely editable); (2) an `/api/<x>` module with list/create/update/delete + a two-phase `reorder` (park at negative orders, then write 1..N to dodge the unique constraint); (3) gate writes on an EXISTING module perm (`investors:update`, `cash-advance:approve`) — don't mint new permission codes + a seed migration unless the access boundary genuinely differs; (4) web: a `use<X>` hook that fetches once + exposes a `label(key)` resolver (fallback: prettify the key), feeding every picker/filter/group-label; (5) a Manage dialog (add/rename/delete/reorder). Reference: `investor-pipeline-stages`, `investor-types`.
- **Approval chain** (Travel is the canonical template; Cash Advance mirrors it). A `*ApprovalStep` config table (ordered, `approverType: manager|user`, conditional fields) + a per-request `*ApprovalDecision` snapshot + `currentStepOrder` on the request. On submit, evaluate each step's conditions against the request and snapshot the matching ones as decision rows; empty chain → fall back to a single manager step (submitter's `reportingTo`). Approve marks the current decision, advances to the next pending step (emailing that approver) or finalises (emailing applicant + an admin-managed recipient list stored in `SystemSetting`). Conditions seen: amount band, payout-mode / category filter, submitter `skipWhen`/`onlyWhen`. **Authz**: open the approve/reject route to any reader and enforce in `assertCanActOnStep` (HR-with-approve, or the step's manager/assigned user) — `requirePermission` alone can't express "the current step's manager." Reference: `travel`, `cash-advance`.
- **Bulk select-and-act** (investors list). Selection is EITHER explicit `ids` OR `allMatching: true` + a `filter` ("select all N matching"), resolved through the SAME `buildInvestorWhere` the list uses so the action hits exactly the visible rows. Owner-scope is ANDed into the where for non-`read-all` callers — never validate ids one-by-one; a foreign id just matches nothing. Reference: `POST /investors/bulk-update` / `bulk-delete`.
- **Native-table / shared-board mirror** (legal & IT CRM open the shared `/projects/:id` board). The `*_native_workspace` migrations copied pre-existing `team='legal'`/`'it'` rows into `legal_*`/`it_*` with the SAME id, but rows created afterwards live only in the native table → the shared board 404s. Fix is a lazy heal in `projectRepository.findById`: on a miss, mirror the native row (+ members/columns/tasks) into `projects` on first open. Idempotent + concurrency-safe.
- **Dashboard intelligence (flow metrics + SLA)** — turning a flat KPI page into a McKinsey-style exhibit report. (1) Add **transition-stamped** lifecycle columns (`statusChangedAt`, `completedAt`, `firstResponseAt`) written in the service ONLY when the status actually changes — never on every edit — so stage-aging / cycle-time / response-time are exact, not approximated from `updatedAt`; clear paired stamps on reversal (task leaves `done` → null `completedAt`; ticket reopens → null `resolvedAt` + bump `reopenedCount`). Backfill them idempotently from `updatedAt`, guarded on the seed value. (2) Keep policy thresholds (SLA targets) as a tunable **code constant** (`helpdesk.sla.ts`), not magic numbers buried in the query, and echo them in the payload so the UI shows what each metric was measured against; percentages return `null` (not 0) on an empty denominator so the UI renders "—". (3) One read-only snapshot endpoint computes every exhibit in a single `Promise.all`; the page renders numbered "Exhibit N —" frames + KPI bands + an HTML export, mirroring the Sales CRM dashboard's serif / `var(--color-*)` styling. Reference: `it-crm.service.ts` `dashboard()`, `/it-crm/dashboard`.
- **Soft delete + restore/remove (and the IDOR trap)** — used by users, accounting, leave, travel, expenses, cash-advance, visa. (1) Add a `deletedAt DateTime?` column (`@@index([deletedAt])` on hot tables); filter every list/count with `excludeDeleted()` and turn the destructive delete into `softDeleteUpdate()` (both from `apps/api/src/infrastructure/soft-delete.ts`; `restoreUpdate()` nulls it back). (2) Expose `POST /<resource>/:id/restore` + `DELETE /<resource>/:id/permanent`. (3) **The default `findById` excludes deleted rows**, so restore/remove MUST re-fetch via a dedicated `find*ByIdIncludingDeleted` repo method — otherwise restore always 404s. (4) **Enforce owner-or-HR in the service, not at the route.** `requirePermission("<x>:create")` lets *any* employee hit restore; the service then checks `existing.employeeId === actorId || permissions.includes(<hr-perm>)` and throws `ForbiddenException` otherwise (leave→`leave:hr-read`, travel→`travel:hr-read`, expenses→`expense:hr-delete`, cash-advance→`cash-advance:approve`; users guard cross-admin edits via `assertActorMayManageAdminUser`). Skipping that service check is an IDOR — a user could restore/destroy another user's record by guessing an id. (Note: the `visa` restore/permanent path is gated only by `visa:manage` and does not carry the owner check — `visa:manage` is already HR-only, but don't copy that shape into an owner-scoped module.) Reference: `cash-advance.service.ts` / `leave.service.ts` `restore*`.
- **ESOP sheet-aligned KPIs** (`hrms` ESOP) — the four pool cards mirror the HR spreadsheet exactly; compute them with `rollupGrants()` in `esop-vesting.ts`, never re-derive ad hoc. Definitions over `EsopGrant` rows: **Grand Total** = Σ all `shares`; **Vesting** = Σ `shares` of *scheduled* grants (`vestingMonths > 0`); **Vested** = Σ `shares` of *unscheduled* grants (`vestingMonths ≤ 0`, i.e. granted outright); **Total Vesting to date** = Σ `vestedSharesToDate(grant, now)` of the scheduled grants only. So Vesting + Vested = Grand Total, and "to date" is a subset of Vesting. Pool summary `GET /esop-pool` and per-employee `GET /esop-grants/by-employee/:employeeId` (page `/hrms/esop/[employeeId]`) both gate on `hrms:esop-manage`.
- **Announce a record to the dashboard surfaces** (Survey Forms publish) — to broadcast something org-wide, write to the existing surfaces rather than inventing a feed: a Company Wall post (`type: "survey"`), a Company News item, and a Company Date (deadline), each stamped with `linkUrl` for the dashboard deep-link, plus the notification-bell read-model (see pitfall above). Each write is permission-guarded independently (`WALL_CREATE` / `NEWS_CREATE` / `ADMIN_MANAGE`) and wrapped in try/catch so one failing surface doesn't abort publish. Announcement defaults live in a single `SystemSetting` row (`survey.announcement_defaults`) with a hardcoded fallback; a manual `POST /:id/announce` re-broadcasts on demand. Reference: `survey-forms.service.ts` `announcePublishedForm`.
- **Timezone-correct daily records** (Attendance) — when a row is "one per employee per calendar day," store the employee's IANA zone *on the row* (`employeeTimezone`) and the instants in UTC (`checkInUtc`), and derive everything in zone via `attendance-timezone.util.ts` (`resolveEmployeeTimezone` → user tz → policy default → `Asia/Bangkok`; `zonedLocalToUtc` for wall-clock→UTC; `computeLateMinutesInTimezone`). Never compare a UTC instant against a shift's local `HH:mm` without the zone — late-minutes and "which day" both break across the dateline. Cron alerts resolve "today" per-employee-zone and guard re-sends idempotently. Reference: `attendance.service.ts`, `/api/cron/attendance-missed-checks` + `/attendance-manager-alerts`.
- **Multi-value tag column + admin-editable list, shared by two modules** (Sales CRM / Sales Revenue CRM business units — Onewave / Onewave Revenue / ARIA). When records need "who is taking care of this" as a **filterable, extensible** tag rather than a hardcoded enum or a nav split: (1) `businessUnits String[] @default([]) @map("business_units")` on each record table (Postgres `text[]`, DDL `ADD COLUMN IF NOT EXISTS … TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`), plus a `crm_business_units` lookup shaped exactly like `LostReason` (code/label/color/isSystem/isActive/sortOrder) and **no FK** — records hold the code as an open string. (2) Filter with `{ has: code }`, and a reserved `"__none__"` sentinel → `{ isEmpty: true }` for the Unassigned view; codes can't contain underscores, so the sentinel can never collide. (3) **One module, one list** (`/api/business-units`) — a company-level list is not a per-CRM lookup. (Historically shared with the retired ARIA Revenue CRM, which is why the gates still accept `sales-revenue:*` in an OR list.) (4) With no FK, **delete must strip the code** from every record table in one transaction (`array_remove`, table names from a module-level literal, code bound as `$1`) — otherwise chips render orphaned raw codes forever. Offer `isActive` as the keep-the-history alternative and say so in the confirm dialog. (5) Chip colour is stored as a shared **Badge variant NAME** (`blue`/`teal`/…), never a Tailwind class, so it resolves through Badge's literal `VARIANT_STYLES` map and survives the static scan. (6) Seed rows `isSystem: false` when the ask includes removing them — `isSystem` blocks delete. Reference: `apps/api/src/modules/business-units/`, `apps/web/src/hooks/use-business-units.ts`, `business-unit-chips.tsx`.
- **ARIA Revenue CRM is RETIRED; its `revenue_*` tables are PARKED, not dropped** (2026-08-26). The module's 15 deals migrated onto the Sales CRM board tagged `aria` (via the authenticated API — a Prisma data migration would never run on staging); web pages, API mounts and the reminder-cron scans are deleted; `next.config.ts` redirects `/sales-revenue` → `/sales?tab=pipeline&bu=aria`. The 11 `Revenue*` Prisma models, their tables and the `sales-revenue:*` permission seeds stay as the rollback net until a later cleanup PR drops them — so `db:generate` still emits the models, and `business-units/revenue-rollup.repository.ts` is the ONE live write path into them (the unit-delete strip must keep the parked data internally consistent or it is worthless as a rollback target). Don't add new code against `Revenue*` models; revive the module or drop the tables instead. Migrated deals carry `legacyDealId` = the old `revenue_opportunities.id` (DB-unique ⇒ re-running the migration fails loudly instead of duplicating).
- **Nav children that are filtered views of one board** (Sales CRM → one child per business unit). When a sidebar group's children differ only by a query param, not a route: give `NavChild` a `matchParams` map and match on pathname + params (`childIsActive` / `childPathname` in `sidebar.tsx`) — `bestMatchHref` stays pathname-only, so without the param check every sibling on the shared pathname lights up at once. Build the children **at render time from the config list** (`useBusinessUnits()`), so adding a unit adds a nav view with no code change, and **fail open**: an empty list or failed fetch leaves the parent a plain link rather than hiding the page. The board reads its filter through `useSearchParams()` (a mount-only read never updates — moving between sibling views does not remount) and writes it back with `history.replaceState`, which needs a `<Suspense>` boundary around the tab subtree. `ROUTE_PERMISSIONS` in `(dashboard)/layout.tsx` is derived from **top-level** items only, so query-carrying child hrefs never reach it.
- **Global config block on a generated document** (payslip company footer). When a document (PDF/XLSX) needs an org-wide, admin-editable block with no per-row variance: (1) store it as ONE `SystemSetting` row (`key: "payslip.company"`, JSON `value`) — no schema migration, no seed; `getX()` reads the row and falls back to a `DEFAULT_X` code constant when absent, so prod renders the default until an admin overrides. Type-guard every JSON field on read (`typeof v.phone === "string" ? … : DEFAULT.phone`). On upsert, write an **inline object literal** for `value` — a typed variable trips Prisma's `InputJsonValue`. (2) Gate read on an existing module perm (`PAYROLL_READ`), write on the admin perm (`PAYROLL_HR_ADMIN`); register the literal `/payslips/company` route BEFORE `/payslips/:id`. (3) Thread the block into EVERY export path (single PDF, single XLSX, bulk-zip `.map` — fetch once before the loop). (4) In the pdf-lib generator, render only when at least one field is set; greedy-`wrapText` the address to the content width; combine address + tel into one paragraph so the phone flows after the last line. Layout offsets are pure constants in `payslip-generator.ts` — tweak `cy` to re-space, no data change. pdf-lib Flate-compresses content streams, so footer text is NOT grep-able in saved bytes — verify by exporting, not byte-matching. (5) Admin edits via a Manage dialog (`payslip-company-dialog.tsx`) on the management tab. Reference: `payroll.service.ts` `getPayslipCompany()`/`setPayslipCompany()`, `payslip-generator.ts` footer block.
- **Two-tier decision flow with non-blocking questions** (Proposals). When a record needs approving by a *person* rather than a role, and a reviewer must be able to chase missing detail without stalling the record: (1) the state machine stays **positional** — `TRANSITIONS[from][action] = to`, nothing computed. Resist adding an `awaiting_information` status: both tiers can ask, so `pass` from it would have to resolve differently depending on who asked (computed routing), and it hides which tier the record is actually at. Instead a question writes a row in a child table (`proposal_information_requests`) and moves NOTHING; "waiting on 2 answers" is a filtered relation count on the list query, and the reviewer is never blocked. Questions are parallel — one row per assignee, each answerable independently. (2) **Identity is not a permission.** Answering a question maps to a `null` permission code and gates on `assignedToId === actorId`; the module's super-grant (`projects:manage`) satisfies every permission gate but must NOT satisfy identity. (3) Approvers are `SystemSetting` rows (`proposals.first_reviewer`, `proposals.final_approver`) **re-resolved on every read**, falling back to permission holders then system Admins, so a setting naming somebody who left resolves to nobody rather than a stale name. (4) Action routes carry the **read gate only** — the required code depends on current status and `requirePermission` cannot express that, so authority lives in the service (`canDecideAtStage`). (5) A standing CC rule ("the PM stays in the loop end to end") belongs in ONE helper (`withReviewerCopied()`, de-duped by lower-cased email), not per call site, with a test per event — otherwise the next notification forgets it. (6) Terminal means terminal: a declined record is re-raised, not reopened, so each decision stays attached to what was decided on. Reference: `apps/api/src/modules/proposals/`, `docs/project-crm/PROPOSALS.md`.
- **Configurable approval chain (Project CRM only) + the super-admin-only guard.** When "who approves this" must stop being code: (1) a generic `approval_chains` / `approval_chain_steps` config pair keyed by a `scope` string, plus an `approval_chain_decisions` **per-record snapshot** taken on submit — the snapshot is the whole point, because editing a chain must never move a record already in flight, and it is what every existing configurable chain here (travel, leave, expenses, cash advance) already does. Scope is an explicit union in `chain.types.ts`: ONLY `project_request` + `proposal` use this; the five HR/Finance chains keep their own `*_approval_steps` tables and their own permissions, deliberately unmigrated. (2) The chain owns the **approval segment only** (`submit → stage 1..N → approved`). `escalate` / `return` / `reopen` / `complete` stay coded transitions — none is "the next step in an order", and an escalation target is per-request data, not config. Where an approval lands when a later stage remains goes in a SEPARATE map (`CHAIN_ADVANCE_TARGET`), not `TRANSITIONS`, so `allowedActions()` keeps describing what a person may click. (3) **Authority becomes identity**: being the person the current stage names IS the authority, so the capability maps to a `null` permission code; the module super-grant (`projects:manage`) still decides any stage so a chain whose approver left can be unstuck. The "pending" queue becomes a **relation filter** (a pending decision naming me), never a status/permission derivation. (4) **"Super admin only" cannot be a permission code** — a super admin is granted EVERY code and any code can also be granted to a custom role. Use `requireSystemAdmin()` (identity check on `isSystem && name === "Admin"`) from `auth.guard.ts`; `/me` exposes `role.isSystem` so the UI can hide the control for the same reason rather than instead of it. (5) Zero stages must NEVER read as approved: `snapshot()` returns `stages: 0` and the caller falls back to its coded default; deleting/deactivating the last active stage is refused. **The stages each chain shipped with carry `isSystem` and are add-only** — renameable and re-assignable (that IS the configurability), but never deletable or deactivatable, because who performs an approval is configuration and what the approval IS is not. The marking migration identifies them by `created_at` matching their chain's exactly (the seed inserted both in one statement block), NOT by "everything that exists" — that would freeze a stage an admin had already added. A record with no snapshot falls back to the pre-chain permission codes, which is what stops the migration stranding anything in flight. Reference: `apps/api/src/modules/approval-chains/`, `docs/project-crm/CHAINS.md`.

- **Spend time series over rows that span months** (IT Billing → Monthly tab, `it-billing-monthly.ts`). Turning "what do we pay now" into "what did we pay each month, and why did it change":
  - **`date_trunc('month', …)` + `GROUP BY` cannot do this.** That buckets a row by its own date; a subscription has to be spread across EVERY month it was live, so one row feeds many buckets. Build it in memory (the `bucketKey` + `Map` shape in `marketing-reports.service.ts`), not in SQL.
  - **The `status: { not: "cancelled" }` filter is right for a run-rate and wrong for a history.** Copying it into a series makes cancelling a service erase it from spend history instead of showing the saving — the action you wanted to measure destroys its own evidence. Add a separate repository method that includes cancelled rows; leave `activeSubscriptions()` alone so the run-rate cards don't move.
  - **A read-time fallback beats a backfill.** `cancelled_at` ships as a column with NO data migration, and `endMonth()` resolves a NULL for legacy rows (`renewalDate` → `renewalDecisionAt` → `updatedAt`). That is what makes staging (`db:push`, which never runs data-migration SQL) compute the same series as prod. Prefer this shape whenever a new column's history is derivable.
  - **"Cancelled" and "stops costing money" are different columns.** A decision stamp is not an effective date — cancelling in August a service paid through December still costs money until December — so default the effective date to the renewal date and make it visible/overridable at cancellation. Separately, `lastChargedMonth` ≠ `endMonth`: a one-time purchase is never cancelled but stops charging after its month, and merging the two makes every one-time charge look permanent.
  - **`toMonthlySpend` returning 0 for `one-time` is correct for a run-rate and wrong for a ledger.** Handle one-time in the month-placement function, don't "fix" the shared helper — `vendorCostReport` and `seatMetrics` depend on its current contract.
  - **Round per row, then sum.** A group header that shows `round(sum of raw)` can differ by cents from the rows it expands to, i.e. contradict itself. Also: months are derived with **UTC** getters, because `@db.Date` arrives as UTC midnight and local getters shift the 1st into the previous month west of UTC.

- **Importing a hand-maintained purchase log** (Office assets ← Asset Inventory Tracker, `asset-inventory-mapping.ts`). Four traps, each of which produces plausible wrong data rather than an error:
  - **`new Date("20-03-2024")` is an Invalid Date and `new Date("11-09-2024")` is 9 NOVEMBER.** A DD-MM-YYYY sheet therefore yields nulls for most rows and a silently wrong month for exactly the rows where the two readings differ. Assert day-first in a tested parser (`parseDayFirstDate`); never infer per row, or the same file parses differently as its data changes. Reject 31 February instead of letting `Date` roll it into March.
  - **`Number("฿17,990.00")` is `NaN`**, so a price becomes silently absent. Strip symbol, separators, NBSP and thin space (the `coerceNumber` convention).
  - **A match key of `serialNo` alone duplicates the whole sheet on re-import** — furniture has no serial, and `assetCode` was derived from it. Match `assetCode` → `serialNo` → `(officeId, name, purchaseDate)`, and keep a per-file `seenKeys` set so two rows colliding inside ONE file both insert. `(office, name)` without a date is NOT a key: two identical chairs bought on different days are two assets.
  - **The bulk importer accepted the fixed-asset columns and dropped them.** `assetImportRowSchema` had no price/date/quantity while `createAssetSchema` had them all, so a purchase log arrived as bare names with every number gone. Store the UNIT price in `purchaseCost` with `quantity` beside it, so `quantity × purchaseCost` reproduces the sheet's own total — that identity is the only per-row proof the import is right, and rows failing it are worth reporting rather than loading quietly. Also: office resolution defaulted to the assignee's country then "the first active office", which is silently wrong for a sheet where no row has an assignee.

- **Fixed Asset Register (Accounting)** — Thailand statutory PPE ledger, flag-gated by `ACCOUNTING_FIXED_ASSETS` + `NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS`. Rules that are easy to break and hard to notice, all with regression tests:
  - **Depreciation is never stored.** It is derived from the register row on read, so figures cannot drift. A period charge is `accumulated(closing) − accumulated(opening)`, both valued through `assetStateAt` — never `rate × days`, which disagrees with the register at the memo floor, the final-period true-up and the opening anchor.
  - **One event chain.** Disposal, impairment and transfer all change carrying amount. Each snapshots the asset state before it (`*Before` columns) and `fixed-asset-state.ts` rebuilds a past date from the EARLIEST event dated after it. If a new event type ships its own lookup instead, the second one to land silently restates the first (this bug already shipped once, PR #1014).
  - **`openingBookValue` / `openingAsOfDate` are an all-or-nothing pair.** A value with no date makes the engine depreciate from `startDate` instead of the anchor.
  - **Account routing is category → entity role → throw**, and the run preflight is fail-whole (`assertFixedAssetAccountsConfigured`). Resolving lazily inside the posting loop lets an unmapped category be skipped, understating depreciation behind a successful-looking post. The five `fa_*` roles are situational — never add them to `REQUIRED_MAPPING_ROLES`.
  - **Deferred tax excludes, never defaults.** `taxUsefulLifeMonths ?? usefulLifeMonths` computes a temporary difference of exactly zero and renders a clean, plausible, entirely wrong schedule. Null tax basis ⇒ exclude the asset, name it, report coverage.
  - **A physical count writes nothing to the GL.** A shortfall returns `suggestWriteOff`; the human routes it through the existing disposal approval, which already has period locks, maker-checker and snapshots. Count expectations resolve at the session's `asOfDate`, never the live row.
  - **Category `assetClass` drives the asset-number prefix and is allocated at create time** — it never retro-renumbers, and the Add-category dialog defaults Class to PFA, so an FF category is easily saved with the wrong class. Categories are `@@unique([entityId, code])` with **no seed**: create them per entity before any import.

---
- **Submitter-conditional approval routing** (expenses, travel, cash advance, leave): to route a chain approver's OWN requests elsewhere, use the per-step `skipWhenSubmitterIds` / `onlyWhenSubmitterIds` arrays — they are filtered when the decision snapshot is built, so editing a chain never re-routes anything in flight. **There is no self-approval guard in the expenses module**, so these fields are the only thing stopping an approver signing off their own report. Three ways to get it wrong that all look like a working chain: an empty `categoryFilter` matches EVERY category (a new general chain then stacks on top of the allowance one); losing `allowance` from every active filter makes `hasAllowanceApprovalChain` false and sends allowance-only reports straight to `reimbursed` with no approval at all; and a submitter matching no step falls back silently to a single `manager` step rather than erroring.

## When in doubt

**Know which docs are authoritative and which are partial.** Audited 2026-08-26 —
the big specs describe an earlier, smaller system, so trusting them as complete
produces confident wrong answers. Full audit + remediation plan:
[`docs/DOCS_PLAN.md`](docs/DOCS_PLAN.md).

| Question | Authoritative source |
|---|---|
| Does table/column X exist? | `packages/database/prisma/schema/*.prisma`, or the generated [`docs/migration/02-data-dictionary.md`](docs/migration/02-data-dictionary.md) (274 tables) |
| Does endpoint X exist? | the module's `*.controller.ts`. `docs/API_SPECIFICATION.md` covers ~285 of 1,350 routes — **absence there means nothing** |
| Does permission X exist? | `apps/api/src/common/constants/permissions.ts` (271 codes). `docs/AUTH_RBAC.md` lists 104 |
| Does module X exist? | `apps/api/src/modules/` (99). `docs/MODULES_SPECIFICATION.md` specs ~55 |
| Which env vars exist? | `turbo.json` `globalEnv` (73). `docs/ENVIRONMENT_MANAGEMENT.md` covers 34 |
| What is actually scheduled? | `gcloud scheduler jobs list` — `docs/ops/cloud-scheduler-cron-jobs.md` records *intent* |
| Conventions, DTO shapes, error handling | `docs/API_SPECIFICATION.md` — authoritative for these |
| Product rationale, design intent | `docs/PROJECT_OVERVIEW.md`, `docs/MODULES_SPECIFICATION.md`, `docs/DATABASE_SCHEMA.md` |
| Repo-specific patterns and traps | this file, plus `docs/okf/patterns/` (22) and `docs/okf/pitfalls/` (12) |

- Search recent commits before assuming behavior — this codebase moves fast and conventions are still settling.
- Open a draft PR early; CI feedback is the fastest sanity check.
- A docs-only PR runs **zero** gates: `pr-checks.yml` path-ignores `docs/**` and `**/*.md`, and `okf-checks.yml` only watches `docs/okf/**` plus this file, `AGENTS.md`, `CONTEXT.md` and `packages/okf/**`. Verify docs changes yourself.
