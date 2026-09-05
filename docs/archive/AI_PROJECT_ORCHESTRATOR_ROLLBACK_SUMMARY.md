# AI Project Orchestrator — Rollback Summary

**Status:** ✅ Complete. Code rollback executed and verified.
**Companion:** [`AI_PROJECT_ORCHESTRATOR_ROLLBACK_ANALYSIS.md`](./AI_PROJECT_ORCHESTRATOR_ROLLBACK_ANALYSIS.md) (Phase 1 analysis)

---

## 1. Method

The orchestrator was contained in **one self-contained commit** (`807d579c`), so the rollback was executed as a **mechanical `git revert`** rather than hand-editing 18 files. This eliminated the risk of partial removal, orphaned imports, or missed references.

| Commit | Purpose |
|---|---|
| `aab2cd72` | `revert: remove AI Project Orchestrator implementation` |
| `8e1270ea` | `fix(dashboard): isolate sub-query failures…` (retained resilience fix — see §5) |

**Result:** 90 files deleted, 18 files restored to their pre-orchestrator state, 0 files left in a hybrid state.

---

## 2. Removed

| Requested removal | Status | What went |
|---|---|---|
| AI Copilot | ✅ | `intake/` services, `/projects/intake`, 8 intake components |
| AI Summary | ✅ | `pm-summary.service`, `executive-synthesis.service` |
| AI Gap Analysis | ✅ | `gap-analysis.service`, validation banners |
| AI Dependency Prediction | ✅ | `dependency-prediction.service`, `context-slicing.service` |
| AI Timeline Prediction | ✅ | `timeline-recommendation.service`, `variance-analysis.service` |
| AI Validation | ✅ | `project-validation.service`, `timeline-validation.service` |
| AI Scoring Engine | ✅ | `strategic-scoring.service`, `conflict-detection.service` |
| Cross-Functional Review Engine | ✅ | `department-review.service`, `review-progress.service`, `project_department_reviews` model |
| Child Task Generator | ✅ | `task-decomposition.service`, `task-broadcast.service` |
| Cross-CRM Synchronization | ✅ | `task-sync.service`, `project_task_broadcasts` model |
| Parent-Child Mapping | ✅ | `task-relationship.service`, generated-task tagging |
| AI Notification Engine | ✅ | 6 notification kinds removed from read-model, bell, quick-actions |
| AI Dashboard Widgets | ✅ | `/analytics` page, `modules/analytics/`, `analytics.service` (web) |

**Also removed:** Business Head / Product Admin approval chain, development scheduling queue, 28 orchestrator API endpoints, 12 frontend routes, 5 RBAC permission codes, 6 prompt blocks, 6 migrations, the demo seed script, and 13 orchestrator design documents.

---

## 3. Preserved (verified working)

| Requirement | Verification |
|---|---|
| Project CRM features | **37 routes intact** — CRUD, import/export, board dashboard, reorder, move-to-partner, members, columns, tasks, milestones, dependencies, resources, timeline |
| Authentication | Untouched — `auth.guard`, Supabase JWT, `requirePermission` |
| User management | Untouched — `users`, `roles`, directory |
| Dashboards | `dashboardService.getStats()` executes successfully ✅ |
| Reports | Untouched — marketing reports, IT/Sales CRM dashboards, payroll, survey |
| Project listing | `projectService.list()` → **5 real projects returned** ✅ |
| Comments | `project_task_comments` untouched |
| Attachments | `project_task_resources` + uploads untouched |
| Search / filters | `projectQuerySchema` restored to original (status, search, team, department, partner) |
| Unrelated APIs | Zero non-project modules modified |

**Explicitly untouched:** Technology, Marketing, Sales, Product, QA, Legal, HR, Accounting CRMs. Cross-CRM broadcasting was in-database tagging, never an external integration — so no other CRM required changes.

**Also preserved:** `ai-prompts.ts` (ARIA + receipt/invoice/visa parsing blocks), `infrastructure/ai/gemini.ts` (shared with ARIA), `GEMINI_API_KEY`.

---

## 4. Verification Gates

| Gate | Before rollback | After rollback |
|---|---|---|
| `pnpm type-check` | 10/10 | **10/10 ✅** |
| `pnpm lint` | 6/6, 0 errors | **6/6, 0 errors ✅** |
| API tests | 1035 (115 files) | **948 (106 files) ✅** |
| Web tests | 186 (24 files) | **186 (24 files) ✅** |

The API delta (−87 tests, −9 files) is exactly the orchestrator's own test suites. **No pre-existing test was lost or broken.** Type-check passing at 10/10 confirms no unused imports, broken references, or dead code remain.

**Runtime verification:** `dashboard.getStats` ✅ · `projects.list` (12 rows) ✅ · `projects.dashboard` (10 total / 7 in-progress) ✅

---

## 5. One Deliberate Retention

`dashboard.service.ts` was the only file where the orchestrator commit *replaced* existing lines rather than purely adding. That change — the `safe()` fault-isolation wrapper — is **not orchestrator functionality**. It fixes a pre-existing bug: on a database missing the `survey_waves` table (schema drift), the existing `countActiveSurveyWaves()` query threw and blanked the entire dashboard with *"Unable to load dashboard data."*

Reverting it would have knowingly re-broken your dashboard, contradicting the "preserve dashboards" requirement. It is therefore retained as a separate, clearly-labelled commit (`8e1270ea`) and can be reverted independently if you disagree.

---

## 6. Remaining Items (your decision)

### 6.1 Demo data still in the database — 7 rows
The orchestrator demo seed inserted 7 namespaced test projects that survive a code rollback and will appear in your Project CRM listing as junk:

```sql
DELETE FROM projects WHERE slug LIKE 'orch-demo-%';
```
Cascades their reviews, generated tasks and broadcast rows. **Not executed** — this is a destructive write against the shared Supabase database, so it is left for your explicit approval. Your 5 real projects are unaffected either way.

### 6.2 Database columns intentionally left in place
34 nullable columns on `projects`, 4 on `project_tasks`, plus the 2 orchestrator tables remain. They are unused and harmless now the code is gone. Dropping them requires a down-migration and permanently destroys captured workflow history — recommended only if a pristine schema is a hard requirement.

⚠️ These were applied via `prisma db execute`, so `_prisma_migrations` has no record of them. The migration files are now deleted while the columns exist — expect `prisma migrate` drift warnings until reconciled.

### 6.3 PR #915 is now a no-op
Branch `feat/ai-project-orchestrator` contains the feature commit *and* its revert, so the PR's net diff is now just the dashboard fix. **Recommend closing PR #915** and, if you want the dashboard fix, cherry-picking `8e1270ea` onto a small dedicated branch.

### 6.4 Stale role assignments
If `projects:business-head-approve`, `projects:product-admin-approve`, `projects:development-schedule`, `analytics:read` or `analytics:read-all` were assigned to any role, those assignments now reference non-existent codes. Harmless, but worth clearing in Role Management.

---

## 7. Recovery

Nothing is lost. The full implementation remains in git history at `807d579c` and can be restored with `git revert aab2cd72` at any time.
