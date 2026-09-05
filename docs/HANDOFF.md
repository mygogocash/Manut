# Handoff — branch `claude/naughty-elion-15f079`

Last updated: 2026-05-18

Branch base: `main` @ `7759658` (PR #380 merged).
Worktree path: `.claude/worktrees/naughty-elion-15f079`.

This branch now carries **two independent changesets**. They share a
branch only because both came up in the same working session; either
can be split into its own PR if reviewers prefer.

---

## Change 1 — Sign-in 429 surfaced as "Server returned non-JSON response"

### Issue

Sign-in form on `intranet.thebinaryholdings.com/sign-in` shows
`Server returned non-JSON response (429)` after repeated attempts.

### Root cause

1. `apps/api/src/app.ts` mounted `express-rate-limit` on `/api/` with
   `max: 500 / 15min` and **no `handler`**. The library's default 429
   body is `text/plain`, so `res.json()` in
   `apps/web/src/lib/api-client.ts` (`handleResponse`) throws
   `PARSE_ERROR` and the user sees the parser's fallback string.
2. The general bucket is shared by login + every dashboard GET. A
   refresh-heavy session can trip the limit and lock the user out of
   `/auth/login` itself.

### Fix (single file: `apps/api/src/app.ts`)

- New helper `rateLimitJson(windowMs, max)` whose `handler` emits the
  project's standard JSON envelope:
  `{ error: { code: "RATE_LIMITED", message: "..." } }`.
- Raised general `/api/` cap **500 → 2000 / 15min**.
- Added a stricter limiter on `/api/auth/login`: **20 / 15min** per IP,
  mounted *before* the general limiter so brute-force protection trips
  first.

Both limiters now emit JSON, so `parseErrorBody` produces a clean
`ApiError("RATE_LIMITED", ...)` instead of `PARSE_ERROR`.

### Files changed (change 1)

| File | Change |
|------|--------|
| `apps/api/src/app.ts` | Replaced inline `rateLimit({...})` with `rateLimitJson(...)` helper. Added login-scoped limiter. |

### Verification (change 1)

1. Restart API: `pnpm dev:api` (clears in-memory limiter window).
2. Visit `/sign-in`, submit a wrong credential 21 times.
3. Expect the 21st attempt to return a friendly `Too many requests,
   please try again later` toast (parsed from JSON), not the
   `Server returned non-JSON response (429)` parse error.
4. Wait 15 min (or restart API again) — limiter resets.

---

## Change 2 — Projects list: BD-feedback columns + drag-to-reorder

### Issue

BD team feedback (May 2026) on the Projects module. New column layout
required, status taxonomy reset, and projects need to be drag-orderable
on the list page.

Source: `/Users/kunanonjarat/Downloads/Project dashboard.xlsx` ("Sheet1"
in the workbook documents the new columns + status options + UX notes).

### Column changes (list view)

Drop:

- `Progress` — was a computed bar from task completion, no DB column.
- `Due Date` — was `Project.endDate`.

Add:

- `Production Live` — boolean (Yes / No badge).
- `GoLive Date` — original go-live target (DATE).
- `Rev. GoLive` — revised go-live after slips (DATE).
- `Dependency` — free-text blocker / upstream dep.
- `Comment` — free-text status note (Text).

Plus a drag handle column at the front of every row.

### Status taxonomy reset

New whitelist (slug → label):

| Slug | Label |
|------|-------|
| `not_yet_started` | Not Yet Started |
| `in_progress` | In Progress |
| `uat` | UAT |
| `staging_integrated` | Staging Integrated |
| `prod_integrated` | Prod. Integrated |
| `on_hold` | On Hold |
| `completed` | Completed |

Old → new mapping in the migration: `planning → not_yet_started`,
`active → in_progress`, `archived → completed`. `on_hold` and
`completed` already match.

The whitelist is defined twice:

- `apps/api/src/modules/projects/projects.validation.ts` →
  `PROJECT_STATUS_VALUES` + `projectStatusSchema` (Zod enum).
- `apps/web/src/services/project.service.ts` →
  `PROJECT_STATUS_OPTIONS` (UI labels) + `projectStatusLabel()`.

**Update both lists together** when adding a status.

### Drag-to-reorder

- New `Project.sortOrder Int @default(0)` column. List `orderBy` is
  `[{ sortOrder: "asc" }, { createdAt: "desc" }]`.
- New endpoint: `PUT /api/projects/reorder` with body
  `{ orderedIds: string[] }`. Service drops ids the caller can't
  access (owner OR member) so existence is never leaked.
- Persistence runs in a single `prisma.$transaction` so partial
  reorders cannot be observed.
- **Reorder is disabled while a search/filter is active.** Otherwise
  the user's drag would persist a permutation of a *subset* of the
  global list, which is surprising. The UI shows a small note
  explaining the lock.
- Frontend: `@dnd-kit/sortable` (already in use on the project board
  in `[projectId]/page.tsx`). Optimistic update with rollback on
  persistence failure via a `useRef` snapshot.

### Form-dialog changes

`start_date` / `end_date` are dropped from the form UI (BD doesn't
track them). The DB columns remain — no destructive migration — so
other features that read them keep working. The new go-live dates
replace them semantically.

The dialog now exposes: Status, Production Live (Switch),
GoLive Date, Rev. GoLive, Dependency (Input), Comment (Textarea).
Refine: `revisedGoLiveDate >= goLiveDate` when both set.

### Files changed (change 2)

| File | Change |
|------|--------|
| `packages/database/prisma/schema/operations.prisma` | `Project` model: added `productionLive`, `goLiveDate`, `revisedGoLiveDate`, `dependency`, `comment`, `sortOrder`. Default `status` → `"not_yet_started"`. New `@@index([sortOrder])`. |
| `packages/database/prisma/migrations/20260623000000_projects_bd_feedback_fields/migration.sql` | New idempotent migration. Adds columns, backfills `sort_order` by `created_at DESC`, remaps legacy statuses (`planning` → `not_yet_started`, `active` → `in_progress`, `archived` → `completed`), changes column default. |
| `apps/api/src/modules/projects/projects.validation.ts` | Added `PROJECT_STATUS_VALUES`, `projectStatusSchema`, new BD fields on body schema, `reorderProjectsSchema`. |
| `apps/api/src/modules/projects/projects.repository.ts` | List `orderBy` now `[sortOrder asc, createdAt desc]`. Added `filterAccessibleIds()` + `applySortOrder()` (single transaction). |
| `apps/api/src/modules/projects/projects.service.ts` | `create` + `update` now thread the new fields. Added `reorder()` method that drops inaccessible ids silently. |
| `apps/api/src/modules/projects/projects.controller.ts` | New `PUT /projects/reorder` route mounted **before** `/:id` (Express literal-before-param rule from CLAUDE.md). Gated on `projects:update` OR `projects:manage`. |
| `apps/web/src/services/project.service.ts` | Added new optional fields to `Project` + `CreateProjectInput`. New `PROJECT_STATUS_OPTIONS` whitelist, `projectStatusLabel()` helper, `reorderProjects()` function. |
| `apps/web/src/app/(dashboard)/projects/page.tsx` | Full rewrite. Replaced `DataTable` with inline `<Table>` + `@dnd-kit/sortable` rows. New columns, drag handles, optimistic reorder with rollback. Uses shared `PROJECT_STATUS_OPTIONS`. |
| `apps/web/src/components/projects/project-form-dialog.tsx` | Removed `startDate`/`endDate` fields. Added `productionLive` (Switch), `goLiveDate`, `revisedGoLiveDate`, `dependency` (Input), `comment` (Textarea). Uses shared `PROJECT_STATUS_OPTIONS`. New refine: `revisedGoLiveDate >= goLiveDate`. |

### Permissions

Reorder is gated on `projects:update` (with `projects:manage` as the
admin-equivalent fallback). No new permission constant required.

### Out of scope (intentional)

- `customFields` JSON column is unchanged. BD didn't ask for changes
  there; round #2's "ad-hoc fields" remain available alongside the
  new structured columns.
- xlsx **import** of the BD dashboard sheet is not implemented. The
  list view + manual entry covers the immediate request. Easy
  follow-up if BD wants to bulk-seed.
- No data migration for legacy `customFields` blobs that may have
  carried go-live dates as ad-hoc rows — those stay readable but
  aren't auto-promoted to the structured columns.

### Verification (change 2)

```bash
pnpm db:generate
pnpm db:migrate                      # applies 20260623000000_projects_bd_feedback_fields
pnpm db:seed                         # if needed
pnpm dev:api & pnpm dev:web
```

1. Open `/projects`. Existing rows appear with the new columns. Old
   statuses (`planning`, `active`) are remapped on view.
2. Click ⋯ → Edit on any project. Confirm the dialog shows the new
   field set; save round-trips.
3. With no filter / search active, drag a row up or down. Confirm the
   order persists on refresh.
4. Set a search or status filter. Drag handles should be disabled
   (cursor not-allowed, opacity dim).
5. Throw a 500 from the API in dev (e.g. temporarily make
   `applySortOrder` `throw`); confirm the row snaps back to its
   original position and a toast appears.

CI gates (run before opening PR):

```bash
pnpm type-check && pnpm lint && pnpm test
```

Status at last run: type-check clean on both `@nexora/api` +
`@nexora/web`, lint 0 errors (autofix applied), 381 api tests + 112
web tests passing.

---

## Open work / next steps

- [ ] Decide whether to land as one PR or split:
  - PR A: rate-limit JSON (single file, can ship today).
  - PR B: projects BD feedback (schema + migration + UI; needs a
    closer review).
- [ ] Commit changes. Suggested messages:
  - `fix(api): rate-limit returns JSON envelope; dedicated /auth/login bucket`
  - `feat(projects): BD-feedback columns + drag-to-reorder list view`
- [ ] Push branch + open PR(s) per CLAUDE.md PR rules (Summary +
  Test plan sections, conventional-commit title under 70 chars).
- [ ] No follow-up tickets identified. xlsx-import is the obvious
  next ask if BD wants it — pattern is established (`coerceNumber`
  helper in payroll, two-row header handling).

---

## Notes for whoever picks this up

### Rate-limit caveats

- The limiter is in-memory only (single-instance). On Cloud Run with
  multiple instances each has its own counter — effectively N × the
  cap. Acceptable for now; revisit with a Redis-backed store if abuse
  shows up in logs.
- `app.set("trust proxy", true)` is already on (`app.ts:17`), so
  `express-rate-limit` keys on the real client IP via
  `X-Forwarded-For`.
- Auth uses Supabase + httpOnly cookies (`nexora_access_token`,
  `nexora_refresh_token`). 429 trips *before* Supabase ever sees the
  credentials — purely a middleware concern.

### Projects-reorder caveats

- `sortOrder` is a global ordering, but the API only receives ids
  visible on the caller's current page. If two users reorder pages
  concurrently the last-writer-wins (no optimistic concurrency).
  This is fine for BD usage (one or two people curating the list).
- `filterAccessibleIds()` drops ids silently — if BD wants to see
  "this row exists but you can't reorder it" feedback, switch to
  returning 403 with the ids list.
- Express route order pitfall: `PUT /projects/reorder` MUST stay
  above `PUT /projects/:id`. The CLAUDE.md repo rules call this out
  ("bitten twice already").
- DB columns `start_date`, `end_date` are still in `Project`. The
  form no longer writes them; other modules can keep reading them
  until someone explicitly retires them.

### Existing project conventions

- `CLAUDE.md` (repo root) is the contract: PR rules, coding
  conventions, RBAC patterns, module-specific gotchas.
- Canonical product docs: `docs/PROJECT_OVERVIEW.md`,
  `docs/AUTH_RBAC.md`, `docs/MODULES_SPECIFICATION.md`.
- Recent precedent for "owner sees own / admin sees all": Investors
  (#202), HRMS Agreements (#204). Reorder uses a coarser model
  (any participant can reorder their visible projects) — call out if
  BD wants stricter gating.
