# AGENTS.md — how we build on the Intranet

This is the orientation for any AI agent or new engineer picking up work in this repo. It captures **how we work** and **the patterns we've learned**, distilled from real shipped features. Read it once, then lean on:

- **`CLAUDE.md`** — the binding rules + conventions (route order, RBAC, migrations, the reusable-patterns catalogue). If AGENTS.md and CLAUDE.md ever disagree, CLAUDE.md wins.
- **`CONTEXT.md`** — the map of the codebase (modules, schema files, where things live).
- **`docs/`** — product contract (`PROJECT_OVERVIEW`, `MODULES_SPECIFICATION`, `AUTH_RBAC`, `DATABASE_SCHEMA`, `DESIGN_SYSTEM`).

---

## Working agreement (the loop that's worked)

1. **Plan before big builds.** For anything beyond a small fix, map the existing template first (the codebase almost always has one — Travel for approval chains, Sales CRM for tabbed workspaces, the configurable-stages module for editable lists). Surface the real design decisions to the user with concrete options rather than guessing.
2. **Mirror, don't invent.** Match the conventions of the nearest existing module: file layout (`controller`/`service`/`repository`/`validation`/`index` per module), naming, error types (`*Exception`, never `throw new Error`), the dnd-kit table, the shadcn dialog. New code should read like the code next to it.
3. **Branch + PR per feature.** Branch `claude/<slug>` off `main`. Conventional-commit titles (`feat(scope):`, `fix(scope):`). PR body = Summary + Test plan checklist.
4. **Verify locally before pushing — every gate:**
   - `pnpm db:generate` (if schema changed)
   - `pnpm type-check` (10/10 workspaces)
   - `pnpm lint` (api + web; warnings allowed, errors block)
   - `pnpm test` (api + web vitest)
   - `pnpm --filter @nexora/web build` (all pages)
   Run `eslint --fix` on touched files; it auto-sorts imports + fixes prettier/tailwind warnings. Restore `apps/web/tsconfig.tsbuildinfo` (`git checkout --`) before committing — it's generated.
5. **CI is the source of truth.** Push, then watch the `Validate` job in `pr-checks.yml` (type-check + lint + test + brand-drift). A green Validate ≈ merge-ready.
6. **Migrations: verify they apply.** See "Migrations" below — don't assume.
7. **Combining PRs.** When asked to combine, check file overlap first (`git diff --name-only main <branch>`). Disjoint siblings → new branch off `main`, cherry-pick each PR's commits, `Closes #a #b`. If one branch was cut from another (stacked), the child already contains the parent — just relabel the child and close the parent. No redundant PR.

---

## Deploy reality (read this)

- `main` push → `Deploy to GCP Cloud Run` (`nexora-api` / `nexora-web`), which runs **`prisma migrate deploy`** (applies only *pending* migrations against prod, which already holds the prior history) **before** the Docker build.
- `dev` push → `deploy-staging.yml` (`nexora-api-staging` / `nexora-web-staging`, separate Supabase via `STAGING_*` secrets). Staging syncs schema with **`pnpm db:push`** — it does NOT run `prisma migrate deploy`, so **data-migration SQL embedded in a migration never fires on staging**. If a change relies on a backfill/data migration, it shows up on prod (where `migrate deploy` runs) but not on staging — seed/patch staging by hand or expect the column empty there.
- **The prod deploy has been billing-blocked.** Merged-to-`main` code + CI-green does NOT mean it's live on `tbh-intranet...`. Always tell the user a feature is "live after the billing-blocked deploy runs," and that any migration applies on that deploy. Don't claim something is visible in the deployed app.
- Because the prod deploy is blocked, **CI (`pr-checks`, which gates both `main` and `dev`) is how we prove correctness** — it runs independently of the deploy.

---

## Migrations — the verification recipe

We write migrations by hand (idempotent) and **prove they apply** on a throwaway Postgres, because deploy is the only place they run for real and it's gated.

- **Idempotent always:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, and FK adds wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. Data migrations must be guarded so a re-run is a no-op (e.g. retag `WHERE type='other'`).
- **Test like deploy, not like a fresh DB.** `migrate deploy` runs only the *pending* migrations against a DB that already has prior history — so seed the prerequisite tables on a throwaway PG, then apply just the new migration file(s) **in order**, twice (the second pass proves idempotency). A full-history replay from `0000_init` fails on pre-existing Supabase-isms (`anon` role, `vector` extension) that aren't your change — don't use it to judge your migration.
  ```bash
  docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=verify -p 5440:5432 postgres:16
  # seed prerequisite tables (users, the parent table, etc.), then:
  docker exec -i pg psql -U postgres -d verify -v ON_ERROR_STOP=1 -f - < path/to/migration.sql   # pass 1
  docker exec -i pg psql -U postgres -d verify -v ON_ERROR_STOP=1 -f - < path/to/migration.sql   # pass 2 = idempotency
  ```
- Confirm the result: tables/columns present, FK `ON DELETE` actions match the schema (`SELECT confdeltype FROM pg_constraint ...`), and any data migration actually fired.

---

## Patterns playbook (cross-refs to CLAUDE.md → "Module-specific patterns to reuse")

These are battle-tested here — reach for them before designing from scratch:

- **Configurable list** (admin-editable enum): config table + `/api/<x>` CRUD/reorder + `use<X>` hook + Manage dialog. The consuming row stores the key as an open string (no FK). Gate on an existing module perm. _Built for pipeline stages, investor types, cash-advance steps._
- **Approval chain**: `*ApprovalStep` config + per-request `*ApprovalDecision` snapshot + `currentStepOrder`; conditions evaluated at submit; email each approver + a `SystemSetting`-stored recipient list on finalise; authz via `assertCanActOnStep` (permissive route + service check). _Travel → Cash Advance._
- **Bulk select-and-act**: explicit ids OR `allMatching` + filter through the same where-builder the list uses; owner-scope in SQL. _Investors._
- **Tabbed CRM workspace**: a `Tabs` shell with per-tab entities, each its own `/api/<entity>` module gated on the parent module's perms. _Sales CRM → Investor CRM (Leads/Accounts/Contacts/Tasks/Activities)._
- **Server-side roll-ups** for any total spanning more than one page. _Pipeline column Est/Act totals._
- **RBAC**: owner-sees-own / admin-sees-all via a `*:read-all` perm; scope in the service, never trust the client filter (CLAUDE.md → "RBAC scoping conventions"). Prefer reusing a module's existing perms for its sub-entities over minting new codes.
- **Soft delete + restore**: add a `deletedAt` column, filter every list/count with `excludeDeleted()` and turn the existing delete into `softDeleteUpdate()` (`apps/api/src/infrastructure/soft-delete.ts`); expose `POST /:id/restore` + `DELETE /:id/permanent`. Restore/remove must re-fetch through a `find*ByIdIncludingDeleted` repo method (the default finder hides deleted rows) and enforce owner-or-HR ownership in the service — `requirePermission` alone can't express "the owner OR HR." _Built across users / leave / travel / expenses / cash-advance / visa._
- **Email safety**: `escapeHtml()` every user-supplied value in HTML bodies; `sendEmail` is fire-and-forget (`void sendEmail(...)`); never let a notification failure roll back the action it follows.
- **Dashboard intelligence**: a flat KPI page becomes a McKinsey exhibit report by adding *transition-stamped* lifecycle columns (`statusChangedAt`/`completedAt`/`firstResponseAt`, written only on a real status change), keeping SLA thresholds as a tunable code constant, and computing every exhibit in one read-only snapshot. _Built for the IT CRM Intelligence dashboard; full recipe in CLAUDE.md._

---

## Gotchas that have bitten us (full list in CLAUDE.md → "Common pitfalls")

- Express **literal routes before `/:id`** (`/approval-steps`, `/reorder`, `/bulk-update`, `/pipeline-totals` all register first).
- **Prisma needs both relation sides** — adding `X.owner → User` requires the inverse `User.xOwned X[]` or `prisma generate` fails.
- **Tailwind purges runtime-built class strings** — use literal maps.
- **Paginated aggregates** must be server-side.
- The generated Prisma client + `tsbuildinfo` are generated artefacts — don't commit them; regenerate.
- `perl -0pi` on files with unicode double-encodes UTF-8 — use the Edit tool or Python (utf-8), never perl, for content with em-dashes/emoji.

---

## Module map — how to find your way into any module

**Universal layout** (holds for every module — learn it once, navigate all ~70):

- **API**: `apps/api/src/modules/<name>/` → `<name>.controller.ts` (routes + `requirePermission`), `<name>.service.ts` (logic), `<name>.repository.ts` (Prisma), `<name>.validation.ts` (zod + inferred `*Input` types), `<name>.service.test.ts` (vitest), `index.ts` (exports the router). Registered in `apps/api/src/modules/index.ts` (`app.use("/api/<base>", <name>Routes)`).
- **Web**: route page `apps/web/src/app/(dashboard)/<route>/page.tsx`; API calls via `apps/web/src/services/<name>.service.ts` (never `fetch` in components); dialogs/sheets in `apps/web/src/components/<name>/`.
- **Schema**: one `packages/database/prisma/schema/<domain>.prisma` per domain; migrations in `packages/database/prisma/migrations/`.
- **Perms**: codes in `apps/api/src/common/constants/permissions.ts` (`module:action`); seeded to roles in `packages/database/prisma/seed.ts`.

To extend a module: read its `service.ts` + `validation.ts`, find the nearest sibling that already does what you need, and mirror it. To build a new one: copy the structure of the closest module in the same area below.

**By area** (module → web route → schema file → dominant pattern to mirror):

| Area | API modules | Web route(s) | Schema | Pattern |
| ---- | ----------- | ------------ | ------ | ------- |
| **Sales CRM** | `leads` `accounts` `contacts` `opportunities` `crm-tasks` `crm-activities` `crm-settings` `lead-sources` `lost-reasons` | `/sales` | `sales-crm.prisma` | tabbed workspace; pipeline kanban; configurable stages |
| **Investor CRM** | `investors` `investor-{leads,accounts,contacts,tasks,activities,types,pipeline-stages}` `investor-updates` `dataroom` | `/investors` `/investor-crm` `/dataroom` `/investor-updates` | `investors.prisma` | tabbed workspace; configurable list; bulk select-and-act; server roll-ups |
| **Project / team CRMs** | `projects` `it-crm` `legal-crm` `product-crm` `qa-crm` `voucher-crm` `partners` `deals` | `/projects` `/it-crm` `/legal-crm` `/product-crm` `/qa-crm` `/voucher-crm` `/partners` `/deals` | `operations.prisma`, `legal.prisma` | shared `/projects/:id` board (native-table mirror); per-project Kanban |
| **Finance** | `cash-advance` `expenses` `accounting` `revenue` `vendors` `exchange-rates` | `/cash-advance` `/expenses` `/accounting` `/revenue` | `finance.prisma` | approval chain (cash-advance); owner-scoped lists |
| **HR / People** | `hrms` (incl. attendance phase1/2/3 + ESOP) `leave` `payroll` `travel` `visa` `benefits` `performance` `ninety-day` `holidays` `learning` `career` `applications` `office` `directory` `users` `roles` | `/hrms` `/leave` `/payroll` `/travel` `/visa` `/benefits` `/performance` `/employees` `/roles` … | `hr.prisma`, `core.prisma`, `rbac.prisma` | approval chain (travel); per-entity scoping; RBAC owner/admin; soft-delete + restore |
| **Helpdesk** | `helpdesk` | `/it-helpdesk` | `helpdesk.prisma` | scrollable kanban; GitHub webhook intake |
| **Content / Comms** | `blogs` `articles` `news` `wall` `messages` `survey` `survey-forms` `docs` `policies` `legal-announcements` | `/blog-management` `/pr-management` `/messages` `/survey` `/docs` `/policies` `/legal` | `content.prisma`, `comms.prisma` | rich-text (`sanitizeRichHtml`); signed-URL downloads |
| **ARIA (AI)** | `aria` | `/aria` | (corpus tables) | eval-gated tools; see CLAUDE.md ARIA evals |
| **Platform** | `auth` `admin` `integrations` `uploads` `dashboard` `cron` `company-dates` `validator-monitor` `telemetry` | `/admin` `/settings` `/gmail` `/drive` | `core.prisma`, `integrations.prisma`, `system.prisma` | Supabase auth; Google OAuth; SystemSetting key/value |

Anything not listed still follows the universal layout above — open the folder and mirror its neighbours.

---

## House style

- TS strict; no `any` leaking across boundaries. Validate inputs with zod in `<module>.validation.ts`; export inferred `*Input` types.
- Comments explain **why**, not what. Match the surrounding density.
- Tests: vitest, mock the repository layer, assert the service's scoping/branching (not Prisma). Add a happy path + the auth/condition edge for anything with an access rule.
- Brand: the product is **Intranet**; `@nexora/*` package names are internal and never user-visible. The brand-drift CI gate scans `apps/web/src` only.
