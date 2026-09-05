# QA Regression Report — Project Request & Approval Workflow

**Date:** 2026-07-30
**Branch:** `feat/ai-project-orchestrator`
**Head:** `94ef69c0`
**Scope:** Full-application regression following the AI Project Orchestrator rollback, the replacement workflow engine, the UI redesign, email-driven approvals, schema cleanup, and the RBAC update.

**Verdict: NOT READY FOR PRODUCTION.** No code defects were found — every automated gate is green — but three blocking configuration/provisioning gaps must be closed first. They are listed in §2 and are the entire reason for the verdict.

---

## 1. Passed

### 1.1 Automated gates (all green)

| Gate | Result |
|---|---|
| `pnpm type-check` | 10/10 workspaces, 0 errors |
| `pnpm lint` | 6/6 workspaces, 0 errors |
| `pnpm test` — API | 109 files, **1001 tests passed** |
| `pnpm test` — Web | 24 files, **186 tests passed** |
| Brand-drift grep | Clean (only match is the pattern definition inside `pr-checks.yml`) |
| Web production compile | `✓ Compiled successfully`, type validity checked, **94/94 static pages generated** |

Workflow-specific suites: 53 tests across `workflow.service.test.ts` (state machine, atomicity, logging), `workflow-email.service.test.ts` (idempotency, retry, token signing, HTML escaping), `workflow-authority.test.ts` (all five roles, every "Can" and every "Cannot").

### 1.2 Authentication

16/16 protected endpoints returned **401** to an anonymous caller — `/api/projects`, `/api/projects/workflow/queue`, `/api/dashboard/stats`, `/api/admin/users`, `/api/roles`, `/api/hrms/employees`, `/api/investors`, `/api/helpdesk/tickets`, `/api/uploads`, plus all seven workflow write routes (`submit`, `approve`, `reject`, `return`, `reopen`, `archive`, `complete`).

Rate limiting is active: a strict bucket on `/api/auth/login` (30 / 15 min, successful logins not counted) and a general bucket on `/api/` (2000 / 15 min).

### 1.3 Workflow engine

- All seven statuses and six actions match the approved linear chain. No cross-functional review, AI routing, scoring, or dependency logic remains in the transition path.
- Every transition runs through one private `transition()` method: legality → authority → reject-reason → **single `$transaction`** (project update + transition row + audit row) → post-commit email fan-out. Atomicity is asserted by test.
- Route ordering verified: literals (`/workflow/queue`) precede `/:id` forms, and no segment-count collisions exist.

### 1.4 Approval logs & audit

- `project_workflow_transitions` (approval + timeline log) and `project_workflow_emails` (notification log) both exist; **0 orphan rows** against `projects` in either table.
- Every permission-sensitive transition records acting user, resolved role names, capability exercised, workflow-owner flag, timestamp, and comment.

### 1.5 Emails

- Idempotency: `idempotency_key` is non-null on every row, **0 duplicates**. Claim-before-send prevents double delivery.
- Retry: 3 attempts, exponential backoff, retryable failures only.
- **HTML escaping is correct** — every caller-supplied value (requester, priority, status, comment, approver name, project name) passes through `escapeHtml()`. Subject lines are plain text and exempt per repo convention.

### 1.6 Email action-link security (design review)

The unauthenticated `/api/project-workflow/email-action` endpoint is well built:

- **No open redirect** — the redirect host comes from `PORTAL_URL` (env), the project id comes from the *signed token payload* rather than the query string, and the status is drawn from a fixed internal set.
- Signature is verified **before** any database query, so forged tokens cost only an HMAC.
- Tokens are stage-bound, which makes them naturally single-use with no token table.
- Permissions are re-resolved live and `isActive` is re-checked, so revoking a role kills outstanding links.
- Fails closed: with `WORKFLOW_EMAIL_TOKEN_SECRET` unset it redirects to `?emailAction=disabled` and does nothing. **Verified live.**
- `reject` is deliberately not reachable by link — a rejection requires a reason, forcing the user into the app.

### 1.7 Preserved Project CRM surface

Rollback did not damage existing functionality. Child data intact: 15 project tasks, 5 members, 25 board columns. Projects, search, filters, attachments, comments, reports, navigation, and all 90+ unrelated API mounts are untouched and compile clean. The dashboard's `safe()` fault-isolation wrapper is still in place.

### 1.8 Schema cleanup

All orchestrator tables are gone (`department_reviews`, `project_ai_scores`, `project_broadcasts`, `project_child_tasks`, `project_dependencies`, `project_intakes` — 0 remaining), with data preserved in three `_archive_orchestrator_*` tables per the archive-then-drop approach. Zero rows carry an invalid `workflow_status`. No orchestrator columns remain on `projects`.

---

## 2. Failed / Blocked

### 🔴 BLOCKER 1 — No role holds any workflow permission

`SELECT count(*) FROM role_permissions WHERE permission_code LIKE 'workflow:%'` returns **0**.

All twelve `workflow:*` codes exist in `PERMISSION_DEFINITIONS`, and `ROLE_PERMISSION_MATRIX` documents the intended grants — but that constant is referenced **only by its own file and the tests**. Nothing provisions it. There is no seed and no migration granting these codes (`git grep` across `packages/database/` returns nothing).

Because `CAPABILITY_PERMISSION` maps nearly every capability to a `workflow:*` code, the practical effect is that **the entire workflow is Admin-only** — Admin works solely through the `isSystem && name === "Admin"` bypass. Every other user is refused at gate 1.

### 🔴 BLOCKER 2 — The five business roles do not exist

The database holds eight roles: Admin, Manager, HR Manager, Finance Manager, Accounting Manager, Employee, External Consultant, Intern.

**None** of "Sales & Marketing", "Project Manager", "Business Head", "Product Admin", or "Development Team" exists. The approved five-role model has no counterpart in the data.

Mitigating nuance: authority is resolved from **permissions, not role names** (`isProjectManager()` inspects permission codes; role names are used only for audit text). So this is fixed by provisioning roles + grants — no code change is required.

### 🔴 BLOCKER 3 — Migration ledger absent on the target database

The `_prisma_migrations` table **does not exist**. `prisma migrate status` reports all **188 migrations as unapplied** against a database whose schema is in fact current — it was built with `db push`.

`deploy.yml` runs `prisma migrate deploy` *before* the Docker build, and a failure there aborts the deploy. Against a database in this state it would attempt to replay all 188 migrations from scratch. This must be reconciled (baseline via `migrate resolve --applied`) before any deploy that targets it.

*Verified against the database in `.env.development`. Confirm production's ledger state independently before acting — do not assume it matches.*

### 🟠 HIGH — GET-based approval can be triggered by automated link scanners

`GET /api/project-workflow/email-action` **mutates state**. Mail-security products that pre-fetch links (Microsoft Defender Safe Links, Gmail's proxy, corporate URL sandboxes) will fetch it, and the approval executes with no human involvement.

This is not hypothetical for a Microsoft-hosted mailbox. The engineering around the token is sound; the HTTP verb is the weakness. Fix with a confirmation interstitial: `GET` renders "Approve <project>?" and the button issues the `POST` that performs the transition.

### 🟡 MEDIUM — Five endpoints have no UI

`POST .../workflow/return`, `.../reopen`, `.../archive`, `GET .../workflow/emails`, `POST .../workflow/emails/retry` are live and permission-gated but unreachable from the web app. `return` and `reopen` are core PM authority from the approved matrix; the two email routes are the notification-log surface. `GET /:id/workflow` is superseded by `/detail` and is dead API surface.

### 🟡 MEDIUM — Two orchestrator tables survived the drop

`orchestrator_reviewers` and `orchestrator_notification_preferences` are still present. They are unreferenced by the Prisma schema and by all application code — dead schema the drop migration missed.

### 🟡 MEDIUM — Seven demo projects remain in the shared database

`Demo 1 — Awaiting PM Review` … `Demo 7 — Rejected`, including rows still named for removed concepts ("Cross-Functional Review", "broadcast"). Not deleted — this is a shared database and removal needs your explicit go-ahead.

### 🟡 MEDIUM — `escalate` and `reassign` are gated but inert

Both are defined in the matrix, carry permission codes, and are enforced by `can()` — but no endpoint or data operation exists behind them. Same for `MODIFY_TIMELINE` / `UPDATE_PROGRESS`, which map to the existing `revised_go_live_date` and `progress` columns without routes.

### 🟢 LOW — Environment-only build failure

`pnpm --filter @nexora/web build` exits 1 on Windows with `EPERM: operation not permitted, symlink` during `output: standalone` file tracing. **Compilation and page generation both succeed first.** Windows requires Developer Mode or elevation to create symlinks; CI and Docker build on Linux and are unaffected. Not a code defect.

### 🟢 LOW — Three capabilities have no permission gate

`UPLOAD_ATTACHMENT`, `COMMENT`, and `VIEW_HISTORY` map to `null` in `CAPABILITY_PERMISSION`, i.e. any authenticated user passes gate 1. Harmless today because none is wired to a route — attachments and comments flow through existing Project CRM endpoints with their own gates. It becomes a hole the moment someone wires them up.

### 🟢 LOW — `survey_waves` table still missing

Pre-existing drift, unrelated to this work. Already mitigated by the `safe()` wrapper in `dashboard.service.ts`.

### 🟢 Dead code — removed during this pass

`availableCapabilities()` in `workflow-authority.ts` was exported and never referenced. Deleted in `94ef69c0`. No other dead exports found in the workflow module — the remaining unreferenced exports are the service *classes* (the singleton instances are what callers import) and the `*Input` validation types, both of which follow established repo convention.

### 🟢 Dead code — repo-wide scan (informational)

A full export-vs-usage sweep across `apps/api/src`, `apps/web/src`, `packages/utils`, and `packages/types` found **696 exported symbols never imported outside their own file, across 273 files**. This is a pre-existing hygiene baseline, overwhelmingly type-only exports, and is **not** attributable to this work. No action proposed here; recorded so the number is known.

Within the projects/workflow scope, five *functions* (not types) in `apps/web/src/services/project.service.ts` have zero references anywhere: `importProjects`, `importProjectTasks`, `getProjectMembers`, `getTaskDependencies`, `getTaskResources`. Their API endpoints all still exist and work, so this is unused client wrappers rather than a broken feature.

**These are pre-existing, not caused by the rollback.** The file's most recent commit is the revert, which made them look rollback-orphaned; checking the tree *before* the revert and *before* the orchestrator feature landed shows zero references at both points. Worth deleting during a future cleanup, but unrelated to this change set.

*Scan caveat:* the heuristic counts cross-file references, so symbols used only within their declaring file surface as false positives — `PRIORITY_BADGE` and `PROJECT_TASK_PRIORITY_LABELS` were both flagged and are in fact used. Spot-check before acting on any entry.

---

## 3. Not verified

State these plainly rather than assume them:

- **No authenticated end-to-end run.** Verification of logged-in behaviour rests on the 1187 automated tests and code inspection. Signing in requires credentials I should not handle.
- **No workflow has ever executed against this database.** `projects_in_workflow = 0`, `transitions_rows = 0`, `emails_rows = 0`. All 12 projects have `workflow_status = NULL` (treated as Draft). The engine is unexercised outside tests.
- **No real email was delivered.** Escaping, idempotency, and retry are covered by unit tests; actual Resend delivery and inbox rendering are not.
- **Responsive UI not visually verified.** The pages compile and render server-side; breakpoint behaviour was not inspected in a browser at mobile/tablet/desktop widths.
- **Performance not load-tested.** No N+1 or slow-query analysis was performed. One observation from reading: `listQueue()` issues five `count()` queries plus the row fetch on every call — fine at 12 projects, worth revisiting past a few thousand.

---

## 4. Recommendations

**Before deploy**

1. Write a seed migration creating the five roles and granting the twelve `workflow:*` codes per `ROLE_PERMISSION_MATRIX`. Make it idempotent (`ON CONFLICT DO NOTHING`). This closes Blockers 1 and 2 together.
2. Add an assertion that every key in `ROLE_PERMISSION_MATRIX` corresponds to a seeded role, so the spec constant and the database cannot drift apart again.
3. Baseline the migration ledger on every target database before running `migrate deploy`.
4. Convert the email approval to a confirmation interstitial (GET renders, POST acts).
5. Set `WORKFLOW_EMAIL_TOKEN_SECRET` in each environment, or accept that one-click approval stays off (it fails closed, which is safe).

**Shortly after**

6. Build UI for `return` and `reopen` — they are PM authority in the approved matrix and currently unreachable.
7. Either implement `escalate` / `reassign` or remove their codes until they do something.
8. Drop `orchestrator_reviewers` and `orchestrator_notification_preferences`.
9. Delete the seven demo projects once you confirm.
10. Give `UPLOAD_ATTACHMENT` / `COMMENT` / `VIEW_HISTORY` real permission codes before wiring them to routes.
11. Decide the retention policy for the three `_archive_orchestrator_*` tables.
12. Optional hygiene, unrelated to this work: delete the five unused client wrappers in `project.service.ts`, and consider a `knip`/`ts-prune` step to stop the 696-symbol dead-export baseline from growing.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Severity |
|---|---|---|---|
| Workflow unusable by non-Admins (Blockers 1+2) | **Certain** | High | 🔴 Critical |
| `migrate deploy` aborts or misfires on unbaselined DB | High | High | 🔴 Critical |
| Mail scanner auto-approves via GET link | Medium¹ | High | 🟠 High |
| PM cannot return/reopen (no UI) | Certain | Medium | 🟡 Medium |
| Demo rows visible to users in Project CRM | Certain | Low | 🟡 Medium |
| Dead orchestrator tables confuse future schema work | Medium | Low | 🟢 Low |
| `listQueue()` count fan-out at scale | Low | Low | 🟢 Low |

¹ Rises to **High** if approver mailboxes are Microsoft 365 with Safe Links enabled.

**Overall: HIGH.** No defects in the code that was written; the risk is concentrated in provisioning that was never done and one HTTP-verb design choice.

---

## 6. Deployment Checklist

**Pre-deploy**

- [ ] Seed migration for the five roles + twelve `workflow:*` grants, written and reviewed
- [ ] Confirm production's `_prisma_migrations` state; baseline with `migrate resolve --applied` if absent
- [ ] Take a database backup / confirm Supabase PITR window covers the deploy
- [ ] Set `WORKFLOW_EMAIL_TOKEN_SECRET` (or confirm one-click stays disabled)
- [ ] Set `PORTAL_URL` correctly per environment — it is the email deep-link base
- [ ] Add both to `turbo.json` `globalEnv`, GitHub Secrets, and `deploy.yml` `--set-env-vars`
- [ ] Decide on the GET→POST interstitial: ship it, or accept the risk in writing
- [ ] Retarget/close PR #915 (currently a no-op: feature plus its own revert)
- [ ] Confirm the PR base is `main` or `dev` so `pr-checks.yml` actually runs

**Deploy**

- [ ] Merge to `dev` first — note that staging syncs via `db push`, so migration SQL does **not** run there; seed the role grants by hand to test them
- [ ] Verify staging: log in as each of the five roles and walk the full chain
- [ ] Confirm approval emails arrive and render
- [ ] Merge to `main`; watch the migration step (it precedes the Docker build and aborts the deploy on failure)

**Post-deploy**

- [ ] Smoke-test one project end to end through all five stages
- [ ] Confirm `project_workflow_transitions` and `audit_log` rows appear with role names
- [ ] Confirm `project_workflow_emails` shows sent rows with no duplicates
- [ ] Watch for P3009 (failed migration) and P1001 (pooler blips from US runners to the Singapore instance)

---

## 7. Rollback Plan

**Level 1 — Config only (seconds, no deploy).** Revoke the `workflow:*` grants: `DELETE FROM role_permissions WHERE permission_code LIKE 'workflow:%'`. The workflow becomes Admin-only again; all other CRM functionality is unaffected. This is the fastest kill switch and should be the first response to a behavioural problem.

**Level 2 — Disable email actions (seconds).** Unset `WORKFLOW_EMAIL_TOKEN_SECRET`. Link approval fails closed and emails fall back to a plain "Review Request" button. Use this if links misbehave — including scanner auto-approval.

**Level 3 — Revert the application (one deploy).** `git revert 94ef69c0 abc0e0d1` and any earlier workflow commits, then deploy. **Leave the migrations applied** — every one is additive and nullable (`workflow_status`, `workflow_updated_at`, `priority`, `archived_at`, plus the two log tables). Reverted code simply ignores them. Do not drop columns to roll back application code.

**Level 4 — Schema rollback (last resort, requires a maintenance window).** Only if a column must actually go:

```sql
ALTER TABLE projects DROP COLUMN IF EXISTS workflow_status;
ALTER TABLE projects DROP COLUMN IF EXISTS workflow_updated_at;
ALTER TABLE projects DROP COLUMN IF EXISTS priority;
ALTER TABLE projects DROP COLUMN IF EXISTS archived_at;
DROP TABLE IF EXISTS project_workflow_emails;
DROP TABLE IF EXISTS project_workflow_transitions;
```

This **destroys the approval and notification history** and is irreversible without a backup. Take a fresh backup immediately before running it.

**Orchestrator data recovery.** The pre-rollback orchestrator data is still available in `_archive_orchestrator_project_data`, `_archive_orchestrator_department_reviews`, and `_archive_orchestrator_task_broadcasts`. Do not drop those until you have decided they are no longer needed.

**What is *not* rolled back by any level:** project rows, tasks, members, columns, comments, attachments, users, roles, and every unrelated module. All of that predates this work and is untouched by every level above.
