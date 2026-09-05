# AI Project Orchestrator — Rollback Analysis Report

**Status:** Analysis only. Nothing has been removed or modified.
**Scope:** Identify every artifact introduced by the AI Project Orchestrator PRD so it can be rolled back while preserving 100% of the original Project CRM.

---

## 0. Executive Finding (read this first)

The entire AI Project Orchestrator is contained in **a single commit on a single unmerged branch**:

| Fact | Value |
|---|---|
| Branch | `feat/ai-project-orchestrator` |
| Commit | `807d579c` |
| Base | `feat/marketing-analytics-phase1` |
| Merged to `main` / `dev`? | **No** (PR #915 open) |
| Files **added** | **91** (100% orchestrator-owned) |
| Files **modified** | **18** (additive blocks inside existing files) |
| Files **deleted / rewritten** | **0** |
| New npm dependencies | **0** |
| New cron jobs / background workers | **0** |
| External systems called | **0** |

**Consequence:** three rollback strategies exist, in ascending order of risk:

| Option | Method | Risk | Effort |
|---|---|---|---|
| **A — Abandon** (recommended) | Close PR #915, delete the branch. `main`/`dev` never received the code. | **Zero** | Minutes |
| **B — Revert** | `git revert 807d579c` (if already merged) | **Very low** — commit is self-contained, nothing was deleted or rewritten | Minutes |
| **C — Surgical** | Delete the 91 files, strip additive blocks from the 18 modified files | **Moderate** — hand-editing 18 files invites human error | Hours |

Option C is only warranted for a **partial** rollback (e.g. keep Intake, drop Broadcasting). For a full rollback, A or B are strictly safer. The rest of this document supports all three.

> ⚠️ **Single most important caveat:** one hunk inside `dashboard.service.ts` is **NOT orchestrator functionality** and must be preserved — see §16.1.

---

## 1. Folder Structure Introduced

```
apps/api/src/
├── modules/
│   ├── projects/
│   │   ├── intake/                    ← NEW (Epic 1)   7 files + 1 test
│   │   └── orchestrator/              ← NEW (Epics 2-6) 21 files + 5 tests
│   └── analytics/                     ← NEW (Phase 8)   4 files + 1 test
└── infrastructure/
    ├── resilience/                    ← NEW (Phase 7)   1 file + 1 test
    └── ai/
        ├── ai-governance.ts           ← NEW (added to EXISTING folder)
        ├── ai-audit.service.ts        ← NEW (added to EXISTING folder)
        └── __tests__/                 ← NEW

apps/web/src/
├── app/(dashboard)/
│   ├── analytics/                     ← NEW  1 page
│   └── projects/
│       ├── intake/                    ← NEW
│       ├── review/  reviews/          ← NEW
│       ├── business-head/             ← NEW
│       ├── product-admin/             ← NEW
│       ├── development/               ← NEW
│       └── orchestrator/              ← NEW
├── components/projects/
│   ├── intake/                        ← NEW  8 components
│   └── orchestrator/                  ← NEW  7 components
└── services/analytics.service.ts      ← NEW

packages/database/prisma/
├── migrations/2026111[0-5]_ai_*/      ← NEW  6 migrations
└── seed-orchestrator.ts               ← NEW  demo seed

docs/AI_PROJECT_ORCHESTRATOR_*.md      ← NEW  13 documents
```

**Whole directories that are 100% orchestrator-owned and safely deletable:**
`modules/projects/intake/`, `modules/projects/orchestrator/`, `modules/analytics/`, `infrastructure/resilience/`, `components/projects/intake/`, `components/projects/orchestrator/`, and the 7 new `app/(dashboard)` route folders.

⚠️ `infrastructure/ai/` is a **pre-existing** folder — delete only the 3 new files inside it, never the folder (it holds `gemini.ts` / `anthropic.ts` used by ARIA and other modules).

---

## 2. AI-Specific Frontend Components (15 — all safely removable)

**Intake (Epic 1)** — `apps/web/src/components/projects/intake/`
| Component | Purpose |
|---|---|
| `project-intake-form.tsx` | Master intake form (debounced AI analysis) |
| `ai-assistant-card.tsx` | Live AI suggestion panel |
| `prediction-badge.tsx` | Dependency/agreement prediction chips |
| `validation-banner.tsx` | Gap-analysis blocking banner |
| `timeline-warning-banner.tsx` | Timeline contradiction warning |
| `missing-information-card.tsx` | Gap recommendations |
| `pm-selector.tsx` | Mandatory PM picker (wraps shared directory API) |
| `go-live-picker.tsx` | Requested go-live date picker |

**Orchestrator (Epics 3–6)** — `apps/web/src/components/projects/orchestrator/`
| Component | Purpose |
|---|---|
| `cross-functional-panel.tsx` | Department review dashboard (Epic 3) |
| `executive-exhibits.tsx` | Shared score/synthesis/conflict exhibits (Epic 4) |
| `executive-queue-view.tsx` | BH + PA queues (Epic 4) |
| `executive-review-view.tsx` | BH + PA decision pages (Epic 4) |
| `development-queue-view.tsx` | Development planning dashboard (Epic 5) |
| `development-scheduling-view.tsx` | Timeline confirm/override (Epic 5) |
| `orchestrator-tasks-view.tsx` | Generated tasks + progress + warnings (Epic 6) |

**Internal coupling (relevant only for partial rollback):**
`cross-functional-panel` → `pm-selector` · `executive-review-view` → `executive-exhibits` · `development-scheduling-view` → `executive-exhibits`.
Removing Epic 1 alone would break the cross-functional panel; removing Epic 4 alone would break Epic 5's page.

---

## 3. AI-Specific Backend Services (28 — all safely removable)

**Intake (Epic 1)** — `modules/projects/intake/`
`ai-intake.service` · `dependency-prediction.service` · `gap-analysis.service` · `timeline-validation.service` · `project-validation.service` · `intake.types`

**Orchestrator (Epics 2–6)** — `modules/projects/orchestrator/`

| Epic | Services |
|---|---|
| 2 — PM Review | `pm-review.service`, `pm-summary.service`, `capacity-verification.service` |
| 3 — Cross-Functional | `context-slicing.service`, `department-review.service`, `review-progress.service` |
| 4 — Executive Approval | `executive-approval.service`, `executive-synthesis.service`, `strategic-scoring.service`, `conflict-detection.service` |
| 5 — Dev Scheduling | `development-queue.service`, `development-scheduling.service`, `timeline-recommendation.service`, `variance-analysis.service` |
| 6 — Broadcasting | `task-decomposition.service`, `task-broadcast.service`, `task-relationship.service`, `task-sync.service`, `project-progress.service` |
| Shared | `orchestrator.types` |

**Analytics (Phase 8)** — `modules/analytics/`: `analytics.service`, `analytics.controller`, `analytics.validation`, `index`

**Infrastructure (Phase 7)**: `infrastructure/resilience/retry.service`, `infrastructure/ai/ai-governance`, `infrastructure/ai/ai-audit.service`

⚠️ **Shared-consumer check:** `retry.service`, `ai-governance`, and `ai-audit.service` were built as *generic* utilities. Today they are consumed **only** by orchestrator code, so they are safe to remove. Verify with a reference search before deleting, in case later work adopted them.

---

## 4. APIs Introduced (28 endpoints)

All orchestrator endpoints were **added to the existing** `/api/projects` router (no new router except analytics).

**Epic 1 — Intake**
`POST /projects/ai/analyze` · `POST /projects/validate` · `GET /projects/project-managers`

**Epic 2 — PM Review**
`GET /projects/pending-review` · `GET /projects/:id/summary` · `GET /projects/:id/capacity` · `GET /projects/:id/review-activity` · `POST /projects/:id/approve` · `POST /projects/:id/reject`

**Epic 3 — Cross-Functional**
`POST /projects/:id/reviews/generate` · `GET /projects/:id/reviews` · `GET /projects/:id/review-progress` · `GET /projects/reviews/:reviewId` · `POST /projects/reviews/:reviewId/submit` · `POST /projects/reviews/:reviewId/waive` · `POST /projects/reviews/:reviewId/assign`

**Epic 4 — Executive Approval**
`GET /projects/business-head/queue` · `GET /projects/product-admin/queue` · `GET /projects/:id/executive-summary` · `GET /projects/:id/strategic-score` · `GET /projects/:id/conflicts` · `GET /projects/:id/executive-activity` · `POST /projects/:id/business-head/approve|reject` · `POST /projects/:id/product-admin/approve|reject`

**Epic 5 — Development Scheduling**
`GET /projects/development-queue` · `GET /projects/:id/timeline-recommendation` · `GET /projects/:id/variance-analysis` · `POST /projects/:id/timeline-confirmation`

**Epic 6 — Broadcasting**
`POST /projects/:id/generate-tasks` · `GET /projects/:id/tasks` · `GET /projects/:id/progress` · `GET /projects/:id/warnings` · `POST /projects/:id/tasks/:taskId/sync`

**Phase 8 — Analytics** (new router `/api/analytics`)
`GET /analytics/dashboard|kpis|departments|ai|timeline|workflow|reports` · `POST /analytics/reports/generate`

⚠️ **Express route-order note:** several literal orchestrator paths (`/pending-review`, `/development-queue`, `/business-head/queue`, `/reviews/:reviewId`) were deliberately registered **before** the original `/:id` routes. When stripping them, remove whole blocks cleanly — leaving a partial block could shadow or expose original CRM routes incorrectly.

---

## 5. Database Schema Additions

All additions are **additive and nullable**. No original column was dropped, renamed, or retyped.

**5.1 — New tables (2), fully orchestrator-owned:**
| Table | Purpose | FK |
|---|---|---|
| `project_department_reviews` | Epic 3 per-department reviews | → `projects` (CASCADE) |
| `project_task_broadcasts` | Epic 6 broadcast/sync log | → `projects` (CASCADE), → `project_tasks` (SET NULL) |

**5.2 — New columns on the EXISTING `projects` table (34):**
`created_by`, `ai_summary`, `validation_result`, `ai_validated_at`, `prediction_version`, `orchestrator_status`, `submitted_at`, `pm_decision`, `pm_decision_at`, `pm_decision_by`, `pm_decision_comment`, `rejection_reason`, `business_head_decision`, `business_head_comment`, `business_head_decision_at`, `business_head_decision_by`, `product_admin_decision`, `product_admin_comment`, `product_admin_decision_at`, `product_admin_decision_by`, `strategic_score`, `executive_summary`, `conflict_summary`, `development_lead_id`, `ai_recommended_completion`, `ai_recommendation_at`, `ai_recommendation_confidence`, `timeline_recommendation`, `timeline_override_reason`, `timeline_confirmed_at`, `timeline_confirmed_by`, `variance_days`, `variance_risk`, `tasks_generated_at`
Plus index `projects_orchestrator_status_idx`.

**5.3 — New columns on the EXISTING `project_tasks` table (4):**
`department`, `crm`, `generated` (default `false`), `estimated_timeline`

⚠️ **`project_tasks` is an ORIGINAL Project CRM table.** Orchestrator child tasks were deliberately stored here rather than in a parallel table. Rollback implications:
- **Never drop `project_tasks` or `projects`.**
- Rows where `generated = true` are orchestrator-created **data**, not schema — see §15.4.

**5.4 — Migrations (6, safely removable files):**
`20261110000000_ai_project_orchestrator_intake` · `20261111000000_ai_orchestrator_pm_review` · `20261112000000_ai_orchestrator_cross_functional` · `20261113000000_ai_orchestrator_executive_approval` · `20261114000000_ai_orchestrator_development_scheduling` · `20261115000000_ai_orchestrator_task_broadcasting`

**Schema rollback recommendation:** *Leave the columns in place.* They are nullable and unused once the code is gone — zero functional impact, zero data-loss risk. Dropping them requires a new down-migration and permanently destroys any captured workflow history. Drop only if a clean schema is a hard requirement.

⚠️ **Migration-history risk:** these migrations were applied to the working DB via `prisma db execute`, which does **not** write `_prisma_migrations` rows. Deleting the migration folders while the columns exist in the database will cause `prisma migrate` drift warnings on the next run. Reconcile deliberately.

---

## 6. Routes (Frontend, 12 pages — all safely removable)

| Route | Epic |
|---|---|
| `/projects/intake` | 1 |
| `/projects/review` · `/projects/review/[id]` | 2 |
| `/projects/reviews/[reviewId]` | 3 |
| `/projects/business-head` · `/projects/business-head/[id]` | 4 |
| `/projects/product-admin` · `/projects/product-admin/[id]` | 4 |
| `/projects/development` · `/projects/development/[id]` | 5 |
| `/projects/orchestrator/[id]` | 6 |
| `/analytics` | 8 |

---

## 7. Navigation & Menu Entries

**Deliberately minimal — no sidebar menu items were added.** Discovery is via existing surfaces:

| Location | File | Change |
|---|---|---|
| Project CRM header buttons | `components/projects/projects-view.tsx` | +20 lines: **"AI Intake"** and **"Reviews"** buttons (rendered only when `team === "general"`) |
| Route permission guard | `app/(dashboard)/layout.tsx` | +13 lines: `/projects/intake` requires create-level perms |

⚠️ `sidebar.tsx` was **not modified** — no navigation rollback needed there.

---

## 8. Notification Logic

**No new notification service, table, or framework was created.** The orchestrator reuses the existing computed dashboard read-model → notification bell.

| File | Change |
|---|---|
| `dashboard.repository.ts` | +134 lines: 6 new read queries (`getPendingProjectReviews`, `getRejectedProjectsForRequestor`, `getAssignedDepartmentReviews`, `getBusinessHeadReviewQueue`, `getProductAdminReviewQueue`, `getDevelopmentScheduleQueue`, `getAssignedGeneratedTasks`, `getResolvedOrchestratorNotices`) |
| `dashboard.service.ts` | Fan-out entries + 6 new `PendingActionKind` values + urgent-item notices |
| `notification-bell.tsx` | +42 lines: icons for the new kinds |
| `quick-actions.tsx` | +50 lines: `KIND_META` entries |
| `services/dashboard.service.ts` (web) | +10 lines: widened `kind` union |

**New notification kinds to strip:** `project_review`, `department_review`, `business_head_review`, `product_admin_review`, `development_scheduling`, `task_assignment`.

⚠️ These are **union-type widenings**. All four files (API service + 3 web files) must be reverted together or TypeScript will fail to compile.

---

## 9. Background Jobs

**None.** Verified by search: no cron endpoints, no schedulers, no queue workers, no `setInterval`.

- Nothing to remove from `modules/cron`.
- No Cloud Scheduler entries to de-provision.
- No `CRON_SECRET` wiring.

All orchestrator work is synchronous and request-driven; the only deferred work is a best-effort post-transaction call (broadcast after approval, sync after task update).

---

## 10. AI Integrations

**No new AI provider, SDK, or API key.** Reuses the existing `getGeminiClient()` / `GEMINI_MODELS.FLASH` from `infrastructure/ai/gemini.ts` (already used by ARIA).

**7 AI call sites (all inside removable service files):** intake analysis, PM summary, context slicing, executive synthesis, timeline recommendation, task decomposition. (Strategic scoring and conflict detection are deterministic — no AI.)

**Prompt constants — `common/constants/ai-prompts.ts` (+401 lines, 0 removed):**
`INTAKE_ANALYSIS_*` · `PM_SUMMARY_*` · `CONTEXT_SLICING_*` · `EXECUTIVE_SYNTHESIS_*` · `TIMELINE_RECOMMENDATION_*` · `TASK_DECOMPOSITION_*` (+ matching `*_SCHEMA` exports).

⚠️ **Do not delete this file.** It is an original shared file also holding `ARIA_SYSTEM`, `GENERATE_TASKS_*`, `PARSE_RECEIPT_*`, `PARSE_INVOICE_*`, `PARSE_VISA_*`. Remove only the orchestrator export blocks.

⚠️ `GEMINI_API_KEY` is shared with ARIA — **do not remove the env var.**

---

## 11. Cross-CRM Synchronization

**Important correction to a common assumption: there is no external integration.** No HTTP calls, no webhooks, no message bus, no writes into `it_projects` / `legal_projects` / `qa_project_tasks` or any other CRM's native tables.

"Cross-CRM broadcasting" is implemented as **tagging inside the existing shared `project_tasks` table** (`crm` + `department` columns), with an append-only `project_task_broadcasts` log.

**Rollback consequence — significant:** rolling back the orchestrator requires **zero changes to Technology, Marketing, Sales, Product, QA, or Legal CRM modules**. None of them were touched. Verified: no orchestrator file writes to any native CRM table.

**Files:** `task-broadcast.service` (fan-out), `task-sync.service` (roll-up), `task-relationship.service` (read projection).

---

## 12. Child Task Generation

| Aspect | Implementation |
|---|---|
| Trigger | Project reaches `in_development` (post-timeline-confirmation), plus a manual idempotent endpoint |
| Storage | **Existing `project_tasks` table**, flagged `generated = true` |
| Parent link | Existing `project_tasks.project_id` (unchanged FK) |
| Dependencies | Existing `project_task_dependencies` table |
| Idempotency | `projects.tasks_generated_at` guard |
| Files | `task-decomposition.service`, `task-broadcast.service` |

⚠️ **Data-rollback consideration:** generated tasks are indistinguishable from manual tasks except by `generated = true`. If the column is dropped without first deleting those rows, orchestrator-created tasks become permanent, unattributable entries on user boards. **Delete the data before dropping the column** (see §15.4).

---

## 13. Cross-Functional Review Logic

| Concern | Implementation |
|---|---|
| Department routing | `context-slicing.service` (AI + keyword fallback) |
| Review lifecycle | `department-review.service` (generate / assign / submit / waive) |
| Progress + unlock | `review-progress.service` (advances to `ready_for_business_head`) |
| Storage | `project_department_reviews` (new table — drops cleanly) |
| UI | `cross-functional-panel.tsx`, `/projects/reviews/[reviewId]` |
| Departments | technology, marketing, business_development, legal, qa |

Fully self-contained. The only outward coupling is the status transition on `projects.orchestrator_status`, which no original CRM code reads.

---

## 14. Risk Analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Reverting the dashboard `safe()` wrapper re-breaks the dashboard** on the current DB (pre-existing `survey_waves` drift) | **HIGH** | Preserve that hunk — see §16.1 |
| R2 | Notification `kind` unions span 4 files; partial revert breaks the build | Medium | Revert all 4 together |
| R3 | Express route-order: partial removal of literal routes can shadow original `/:id` routes | Medium | Remove whole blocks; retest `GET /projects/:id` |
| R4 | Deleting migration folders while columns exist in the DB → `prisma migrate` drift | Medium | Leave columns, or write a proper down-migration |
| R5 | Dropping `project_tasks.generated` before deleting generated rows orphans AI tasks on user boards | Medium | Delete data first (§15.4) |
| R6 | Deleting shared files (`ai-prompts.ts`, `infrastructure/ai/`) instead of stripping blocks breaks ARIA/receipt/visa parsing | **HIGH** | Never delete — strip blocks only |
| R7 | `projects.service.ts` `create()` sets `createdById` — used for requestor attribution | Low | Additive; safe to strip, but confirm nothing else consumes it |
| R8 | Demo seed rows (`orch-demo-*`) persist in the shared DB after code rollback | Low | Delete by slug prefix (§15.4) |
| R9 | Removing `analytics:*` permissions leaves stale role assignments | Low | Harmless; clean up in Role Management |

---

## 15. Files That Can Be Safely Removed (91)

**15.1 — Backend (42 files)** — whole directories:
`apps/api/src/modules/projects/intake/**` (7) · `apps/api/src/modules/projects/orchestrator/**` (27) · `apps/api/src/modules/analytics/**` (5) · `apps/api/src/infrastructure/resilience/**` (2)
Plus individually: `infrastructure/ai/ai-governance.ts`, `infrastructure/ai/ai-audit.service.ts`, `infrastructure/ai/__tests__/ai-governance.test.ts`

**15.2 — Frontend (28 files)**:
`components/projects/intake/**` (8) · `components/projects/orchestrator/**` (7) · `app/(dashboard)/projects/{intake,review,reviews,business-head,product-admin,development,orchestrator}/**` (12) · `app/(dashboard)/analytics/page.tsx` · `services/analytics.service.ts`

**15.3 — Database (7 files)**:
6 migration folders + `packages/database/prisma/seed-orchestrator.ts`

**15.4 — Data cleanup (not files)**:
- `DELETE FROM projects WHERE slug LIKE 'orch-demo-%'` (cascades demo reviews/tasks/broadcasts)
- `DELETE FROM project_tasks WHERE generated = true` (**before** dropping the column)
- `DELETE FROM audit_log WHERE action LIKE 'project.pm_review%' OR action LIKE 'project.business_head%' OR action LIKE 'project.product_admin%' OR action LIKE 'project.development%' OR action LIKE 'project.tasks%' OR action LIKE 'project.review%' OR action = 'ai.invocation' OR action = 'analytics.report.generated'` — ⚠️ **audit log is designed to be immutable; deleting history may violate the retention policy. Recommend leaving it.**

**15.5 — Documentation (13 files)**: `docs/AI_PROJECT_ORCHESTRATOR_*.md` (including this report)

---

## 16. Files That Must Be Modified (18)

Ordered by risk. All orchestrator additions are contiguous, comment-marked blocks (`// AI Project Orchestrator — Phase N`), which makes identification reliable.

### 16.1 ⚠️ `apps/api/src/modules/dashboard/dashboard.service.ts` (+190 / −26) — **HIGHEST CARE**
The **only** file where existing lines were replaced. Contains **two unrelated changes**:
1. **Orchestrator additions** (remove): 6 new fan-out queries, 6 new `PendingActionKind` values, pending-action loops, urgent-item notices.
2. 🛑 **`safe()` fault-isolation wrapper (KEEP)** — wraps every dashboard sub-query so one failing subsystem cannot blank the whole dashboard. This was a **bug fix for a pre-existing database drift issue** (`survey_waves` table missing), *not* orchestrator functionality. **Reverting it will re-break the dashboard** with "Unable to load dashboard data". Retain `safe()` and its wrapping of the original (non-orchestrator) queries.

### 16.2 Backend — strip additive blocks
| File | Δ | What to remove |
|---|---|---|
| `projects.controller.ts` | +591 / −0 | 28 orchestrator routes, 12 service imports, `PROJECT_CREATE_PERMS` / `EXECUTIVE_READ_PERMS` / `DEV_SCHEDULE_READ_PERMS` bundles. **Keep** all original CRUD/task/milestone routes. |
| `projects.repository.ts` | +190 / −0 | `findRowById`, `listPendingReview`, `listByOrchestratorStatus`, `ownerWorkloadCounts`, department-review methods, broadcast methods, `listGeneratedTasks`, `countOpenDevelopmentProjects`, `listUpcomingHolidays` |
| `projects.validation.ts` | +75 / −0 | `intakeAnalyzeSchema`, `pmApprove/Reject`, `reviewSubmit/Waive/Assign`, `executiveApprove/Reject`, `timelineConfirmationSchema`; and from `projectBodySchema`: `aiSummary`, `validationResult`, `submitForReview` |
| `projects.service.ts` | +29 / −0 | `intake.types` import; `createdById`/`aiSummary`/`validationResult`/`submitForReview` block in `create()`; the `if (before.generated)` sync hook in `updateTask()` |
| `dashboard.repository.ts` | +134 / −0 | 8 orchestrator read methods |
| `common/constants/ai-prompts.ts` | +401 / −0 | 6 orchestrator prompt/schema blocks. ⚠️ **Keep the file** — ARIA + document parsing live here |
| `common/constants/permissions.ts` | +50 / −0 | 5 codes + 5 `PERMISSIONS` type keys: `projects:business-head-approve`, `projects:product-admin-approve`, `projects:development-schedule`, `analytics:read`, `analytics:read-all` |
| `modules/index.ts` | +2 / −0 | analytics import + `app.use("/api/analytics", …)` |
| `dashboard/__tests__/dashboard-pending-expense.test.ts` | +8 / −0 | 8 method names from `LIST_METHODS` |

### 16.3 Frontend — strip additive blocks
| File | Δ | What to remove |
|---|---|---|
| `services/project.service.ts` | +503 / −0 | All Phase 1–6 types + client functions. **Keep** original project/task/milestone functions |
| `components/projects/projects-view.tsx` | +20 / −0 | "AI Intake" + "Reviews" buttons, `Sparkles`/`ClipboardCheck` imports |
| `app/(dashboard)/layout.tsx` | +13 / −0 | `/projects/intake` permission guard entry |
| `components/layout/notification-bell.tsx` | +42 / −1 | 6 `APPROVAL_ICON` entries, union widening, icon imports |
| `components/dashboard/quick-actions.tsx` | +50 / −1 | 6 `KIND_META` entries, union widening, icon imports |
| `services/dashboard.service.ts` | +10 / −1 | 6 values from `DashboardPendingAction["kind"]` |

### 16.4 Database
| File | Δ | What to remove |
|---|---|---|
| `packages/database/prisma/schema/operations.prisma` | +139 / −0 | `ProjectDepartmentReview` + `ProjectTaskBroadcast` models; 34 `Project` fields + `@@index([orchestratorStatus])` + 2 back-relations; 4 `ProjectTask` fields + `broadcasts` back-relation |
| `packages/database/package.json` | +1 / −0 | `db:seed:orchestrator` script |

**After any surgical edit, run:** `pnpm db:generate && pnpm type-check && pnpm lint && pnpm test`.

---

## 17. Dependencies Between Modules

**17.1 — Original CRM → Orchestrator (the cut points).** Exactly **4** files in the original codebase reference orchestrator code. These are the only places where deletion causes compile errors:

```
projects.controller.ts   → 12 orchestrator/intake service imports   (static)
projects.service.ts      → intake.types (static) + task-sync.service (dynamic import)
modules/index.ts         → modules/analytics                        (static)
dashboard.service.ts     → deep-link string only, no import         (safe)
projects-view.tsx        → href string only, no import              (safe)
```

**17.2 — Orchestrator → Original CRM (reused, must NOT be removed):**
`prisma` client · `logAudit` (audit) · `auth.guard` (authenticate / requireActive / requirePermission) · `asyncHandler` · `http-exception` · `logger` · `infrastructure/ai/gemini` · `directory.service` · `capacity` inputs from `projects` · shared UI (`DataTable`, `Card`, `PageHeader`, `usePagination`, `useAuth`, `api-client`, recharts) · `PublicHoliday` (HR) · `project_tasks` / `project_task_dependencies`.

**17.3 — Internal orchestrator chain (matters only for partial rollback):**
```
Epic 1 (intake) → Epic 2 (pm-review) → Epic 3 (department-review)
      → Epic 4 (executive-approval) → Epic 5 (development-scheduling)
      → Epic 6 (task-broadcast → task-sync)
Phase 8 (analytics) reads the output of Epics 1–6
Phase 7 (retry / ai-governance / ai-audit) is consumed by Epics 1–6
```
Rolling back any epic requires rolling back everything **downstream** of it. Analytics can be removed independently (nothing depends on it).

---

## 18. What Must **NOT** Be Touched (Original Project CRM)

| Category | Assets |
|---|---|
| **Tables** | `projects`, `project_tasks`, `project_members`, `project_columns`, `project_milestones`, `project_task_comments`, `project_task_activities`, `project_task_assignees`, `project_task_dependencies`, `project_task_resources` |
| **Backend** | `projects.controller/service/repository/validation` (original portions), `project-task-priority.ts`, native CRM modules (`it-crm`, `legal-crm`, `product-crm`, `qa-crm`, `accounting-crm`, `hr-crm`, `partners`) |
| **Frontend** | `projects-view.tsx` (minus 2 buttons), project board/kanban/timeline/gantt, task detail sheet, milestones, import/export, `sidebar.tsx`, `/projects` + `/projects/[id]` |
| **Shared infra** | `infrastructure/ai/gemini.ts`, `anthropic.ts`, `audit.service`, `auth.guard`, `error-handler`, `logger`, `email`, `soft-delete` |
| **Constants** | `ai-prompts.ts` (ARIA + parsing blocks), `permissions.ts` (all original codes) |
| **Env** | `GEMINI_API_KEY` (shared with ARIA) |
| **Data** | All non-`orch-demo-*` projects; all `project_tasks` where `generated = false`; the entire `audit_log` (immutable by policy) |
| **Features preserved** | Project CRUD, Kanban board, tasks/subtasks, dependencies, milestones, Gantt, members, import/export, move-to-partner, per-team CRM workspaces, "+ New Project" flow |

---

## 19. Recommendation

1. **If the goal is a full rollback:** close PR #915 and delete `feat/ai-project-orchestrator`. `main` and `dev` are untouched — the original Project CRM is already intact with **zero** code changes required. Optionally clean the demo data (§15.4) and leave the additive columns (harmless).
2. **If already merged:** `git revert 807d579c`, then re-apply only the `safe()` dashboard hunk (§16.1).
3. **If a partial rollback is wanted:** use §17.3 to determine the dependency cut, then §16 for surgical edits, and re-run the full gate.

**Do not** attempt manual file deletion as a first resort while an unmerged, self-contained commit makes rollback a one-click operation.
