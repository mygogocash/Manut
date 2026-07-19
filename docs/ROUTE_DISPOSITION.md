# Route disposition inventory

This inventory accounts for every route-page file in audited source snapshot `371349fd43fd7c7c7717054beec97bfb023885ca`. It is a migration control, not a claim of web parity.

## P1 ledger-freeze prep (2026-07-19)

Product-safe interim notes — **pending decisions stay pending**; only the ESOP
compatibility redirect is implemented code.

| Item | Status | Notes |
| ---- | ------ | ----- |
| `/expenses-v1` registry orphan | **PENDING product approval** | Still in `packages/app-core` RBAC registry/tests; no Expo ledger row. Proposed outcome: redirect → `/expenses` (or remove from registry). Recorded in JSON `pendingRegistryDecisions` and `PENDING_COMPATIBILITY_REDIRECTS`. **No auto-redirect shipped.** |
| `/hrms/esop/[employeeId]` → `/hrms/grants/[employeeId]` | Scaffolding landed | Expo route + `resolveCompatibilityRedirect` preserve bookmarks/email links. Disposition remains `replace` / `foundation` until hosted E2E. |
| 16× `remove-as-provenance` | **PENDING P1-E2-T1 approval** | Status stays `removed` (not `removed-approved`). Proposed UX: intentional not-found without provenance disclosure. Notes updated in JSON. |
| `/ingest/*` telemetry | **PENDING** (ADR draft) | See `docs/ADR-009-ingest-telemetry-proxy.md` — retain Worker proxy vs remove; no Expo/Worker proxy in this slice. |

## Evidence

```sh
git ls-tree -r --name-only 371349fd -- apps/web/src/app | rg '/page\.tsx$' | sort
```

- Source route-page files: **103**
- Unique source paths: **103**
- Inventory rows (includes Expo-only `/files`): **104**
- Dispositions: **79 migrate**, **8 replace**, **16 remove-as-provenance**
- Current status: **88 foundation**, **0 pending**, **16 removed**

The source command is sorted before classification. The JSON companion repeats the source command, counts, and every row, so CI can independently assert count, uniqueness, and allowed values.

## Meaning of each state

- `migrate`: retain the approved route contract in the universal app.
- `replace`: retain the approved user outcome but use a clean universal route or platform adapter instead of the source implementation.
- `remove-as-provenance`: intentionally exclude the route; it has no target route.
- `foundation`: a target Expo route file and core wiring exist, but behavioral parity is not yet claimed.
- `pending`: the approved target route is not yet present in Expo.
- `removed`: the source route was intentionally excluded.

Survey routes (`/survey*`, `/survey-forms*`) stay `foundation` after draft-create,
survey respond-submit, manage-gated question replace (`PUT …/questions`), and
publish (`POST …/publish`) deepen until authenticated Expo E2E acceptance.
Announce/schedule/analytics/archive and full drag-reorder parity remain deferred.

`/projects/[projectId]` stays `foundation` after board deepen: column/priority
task create, move via `POST …/tasks/reorder`, title edit via `PUT …/tasks/:id`,
delete via `DELETE …/tasks/:id`, and members read (`GET …/members`, emails
stripped). Member write UI and pointer drag remain deferred; reuse the projects
pattern documented in `docs/CURSOR_HANDOFF.md`.

`/deals` stays `foundation` after pipeline kanban deepen: list + create,
`GET /api/deals/pipeline` summary, stage moves + notes via `PUT /api/deals/:id`
(`deals:update`/`deals:manage` gate). Hard-delete stays deferred (API has no
soft-delete).

Phase 1 leftovers (2026-07-18): `/leave` calendar + team/HR approve,
`/leave/policies` read catalog, `/settings` admin system settings (secret keys
omitted), and dashboard wall/compose strip remain `foundation`. Playwright
`employee`/`leave` projects target Expo `:8081`; hosted E2E still requires the
five `E2E_*` secrets (fail closed — no soft-skip).

`/cash-advance` stays `foundation` after finance deepen (2026-07-19): approve/
reject pending inbox plus disburse (`POST …/disburse` with proof URL) and clear
(`POST …/clear`) gated by `cash-advance:approve`. Native R2 picker and signed
disbursement-proof GET remain deferred until authenticated Expo E2E acceptance.

## Inventory

|   # | Source path                                                                     | Source route                               | Disposition            | Status       | Target route                 |
| --: | ------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------- | ------------ | ---------------------------- |
|   1 | `apps/web/src/app/(dashboard)/accounting-crm/page.tsx`                          | `/accounting-crm`                          | `migrate`              | `foundation` | `/accounting-crm`            |
|   2 | `apps/web/src/app/(dashboard)/accounting/page.tsx`                              | `/accounting`                              | `migrate`              | `foundation` | `/accounting`                |
|   3 | `apps/web/src/app/(dashboard)/admin/aria-insights/page.tsx`                     | `/admin/aria-insights`                     | `remove-as-provenance` | `removed`    | —                            |
|   4 | `apps/web/src/app/(dashboard)/admin/aria-knowledge/page.tsx`                    | `/admin/aria-knowledge`                    | `remove-as-provenance` | `removed`    | —                            |
|   5 | `apps/web/src/app/(dashboard)/admin/docusign/oauth/callback/page.tsx`           | `/admin/docusign/oauth/callback`           | `remove-as-provenance` | `removed`    | —                            |
|   6 | `apps/web/src/app/(dashboard)/admin/docusign/page.tsx`                          | `/admin/docusign`                          | `remove-as-provenance` | `removed`    | —                            |
|   7 | `apps/web/src/app/(dashboard)/admin/form-config/page.tsx`                       | `/admin/form-config`                       | `migrate`              | `foundation`    | `/admin/form-config`         |
|   8 | `apps/web/src/app/(dashboard)/admin/page.tsx`                                   | `/admin`                                   | `migrate`              | `foundation`    | `/admin`                     |
|   9 | `apps/web/src/app/(dashboard)/applications/page.tsx`                            | `/applications`                            | `migrate`              | `foundation` | `/applications`              |
|  10 | `apps/web/src/app/(dashboard)/aria/knowledge/[id]/page.tsx`                     | `/aria/knowledge/[id]`                     | `remove-as-provenance` | `removed`    | —                            |
|  11 | `apps/web/src/app/(dashboard)/aria/page.tsx`                                    | `/aria`                                    | `remove-as-provenance` | `removed`    | —                            |
|  12 | `apps/web/src/app/(dashboard)/benefits/page.tsx`                                | `/benefits`                                | `migrate`              | `foundation` | `/benefits`                  |
|  13 | `apps/web/src/app/(dashboard)/blog-management/page.tsx`                         | `/blog-management`                         | `migrate`              | `foundation` | `/blog-management`           |
|  14 | `apps/web/src/app/(dashboard)/careers/page.tsx`                                 | `/careers`                                 | `migrate`              | `foundation` | `/careers`                   |
|  15 | `apps/web/src/app/(dashboard)/cash-advance/approval/page.tsx`                   | `/cash-advance/approval`                   | `migrate`              | `foundation` | `/cash-advance/approval`     |
|  16 | `apps/web/src/app/(dashboard)/cash-advance/page.tsx`                            | `/cash-advance`                            | `migrate`              | `foundation` | `/cash-advance`              |
|  17 | `apps/web/src/app/(dashboard)/certificates/page.tsx`                            | `/certificates`                            | `migrate`              | `foundation`    | `/certificates`              |
|  18 | `apps/web/src/app/(dashboard)/dashboard/page.tsx`                               | `/dashboard`                               | `migrate`              | `foundation` | `/dashboard`                 |
|  19 | `apps/web/src/app/(dashboard)/dataroom/page.tsx`                                | `/dataroom`                                | `migrate`              | `foundation` | `/dataroom`                  |
|  20 | `apps/web/src/app/(dashboard)/deals/page.tsx`                                   | `/deals`                                   | `migrate`              | `foundation` | `/deals`                     |
|  21 | `apps/web/src/app/(dashboard)/directory/page.tsx`                               | `/directory`                               | `migrate`              | `foundation` | `/directory`                 |
|  22 | `apps/web/src/app/(dashboard)/docs/page.tsx`                                    | `/docs`                                    | `migrate`              | `foundation` | `/docs`                      |
|  23 | `apps/web/src/app/(dashboard)/drive/page.tsx`                                   | `/drive`                                   | `migrate`              | `foundation` | `/drive`                     |
|  — | `apps/app/app/(protected)/files.tsx`                                            | `/files`                                   | `migrate`              | `foundation` | `/files`                     |
|  24 | `apps/web/src/app/(dashboard)/employees/page.tsx`                               | `/employees`                               | `migrate`              | `foundation` | `/employees`                 |
|  25 | `apps/web/src/app/(dashboard)/expenses/[reportId]/page.tsx`                     | `/expenses/[reportId]`                     | `migrate`              | `foundation` | `/expenses/[reportId]`       |
|  26 | `apps/web/src/app/(dashboard)/expenses/approval/page.tsx`                       | `/expenses/approval`                       | `migrate`              | `foundation` | `/expenses/approval`         |
|  27 | `apps/web/src/app/(dashboard)/expenses/page.tsx`                                | `/expenses`                                | `migrate`              | `foundation` | `/expenses`                  |
|  28 | `apps/web/src/app/(dashboard)/gmail/page.tsx`                                   | `/gmail`                                   | `migrate`              | `foundation` | `/gmail`                     |
|  29 | `apps/web/src/app/(dashboard)/hr-crm/page.tsx`                                  | `/hr-crm`                                  | `migrate`              | `foundation` | `/hr-crm`                    |
|  30 | `apps/web/src/app/(dashboard)/hrms/esop/[employeeId]/page.tsx`                  | `/hrms/esop/[employeeId]`                  | `replace`              | `foundation` | `/hrms/grants/[employeeId]`  |
|  31 | `apps/web/src/app/(dashboard)/hrms/page.tsx`                                    | `/hrms`                                    | `migrate`              | `foundation` | `/hrms`                      |
|  32 | `apps/web/src/app/(dashboard)/investor-crm/page.tsx`                            | `/investor-crm`                            | `migrate`              | `foundation` | `/investor-crm`              |
|  33 | `apps/web/src/app/(dashboard)/investor-updates/page.tsx`                        | `/investor-updates`                        | `migrate`              | `foundation` | `/investor-updates`          |
|  34 | `apps/web/src/app/(dashboard)/investors/page.tsx`                               | `/investors`                               | `migrate`              | `foundation` | `/investors`                 |
|  35 | `apps/web/src/app/(dashboard)/it-crm/dashboard/page.tsx`                        | `/it-crm/dashboard`                        | `migrate`              | `foundation` | `/it-crm/dashboard`          |
|  36 | `apps/web/src/app/(dashboard)/it-crm/page.tsx`                                  | `/it-crm`                                  | `migrate`              | `foundation` | `/it-crm`                    |
|  37 | `apps/web/src/app/(dashboard)/it-helpdesk/page.tsx`                             | `/it-helpdesk`                             | `migrate`              | `foundation`    | `/it-helpdesk`               |
|  38 | `apps/web/src/app/(dashboard)/it-operations/access/page.tsx`                    | `/it-operations/access`                    | `migrate`              | `foundation`    | `/it-operations/access`      |
|  39 | `apps/web/src/app/(dashboard)/it-operations/billing/page.tsx`                   | `/it-operations/billing`                   | `migrate`              | `foundation`    | `/it-operations/billing`     |
|  40 | `apps/web/src/app/(dashboard)/it-operations/page.tsx`                           | `/it-operations`                           | `migrate`              | `foundation`    | `/it-operations`             |
|  41 | `apps/web/src/app/(dashboard)/learning/page.tsx`                                | `/learning`                                | `migrate`              | `foundation` | `/learning`                  |
|  42 | `apps/web/src/app/(dashboard)/leave/approval/page.tsx`                          | `/leave/approval`                          | `migrate`              | `foundation` | `/leave/approval`            |
|  43 | `apps/web/src/app/(dashboard)/leave/holidays/page.tsx`                          | `/leave/holidays`                          | `migrate`              | `foundation` | `/leave/holidays`            |
|  44 | `apps/web/src/app/(dashboard)/leave/page.tsx`                                   | `/leave`                                   | `migrate`              | `foundation` | `/leave`                     |
|  45 | `apps/web/src/app/(dashboard)/leave/policies/page.tsx`                          | `/leave/policies`                          | `migrate`              | `foundation` | `/leave/policies`            |
|  46 | `apps/web/src/app/(dashboard)/legal-crm/page.tsx`                               | `/legal-crm`                               | `migrate`              | `foundation` | `/legal-crm`                 |
|  47 | `apps/web/src/app/(dashboard)/legal/announcements/[id]/page.tsx`                | `/legal/announcements/[id]`                | `migrate`              | `foundation`    | `/legal/announcements/[id]`  |
|  48 | `apps/web/src/app/(dashboard)/legal/announcements/page.tsx`                     | `/legal/announcements`                     | `migrate`              | `foundation` | `/legal/announcements`       |
|  49 | `apps/web/src/app/(dashboard)/legal/page.tsx`                                   | `/legal`                                   | `migrate`              | `foundation`    | `/legal`                     |
|  50 | `apps/web/src/app/(dashboard)/legal/shared/page.tsx`                            | `/legal/shared`                            | `migrate`              | `foundation`    | `/legal/shared`              |
|  51 | `apps/web/src/app/(dashboard)/marketing-analytics/campaigns/[id]/page.tsx`      | `/marketing-analytics/campaigns/[id]`      | `remove-as-provenance` | `removed`    | —                            |
|  52 | `apps/web/src/app/(dashboard)/marketing-analytics/campaigns/page.tsx`           | `/marketing-analytics/campaigns`           | `remove-as-provenance` | `removed`    | —                            |
|  53 | `apps/web/src/app/(dashboard)/marketing-analytics/page.tsx`                     | `/marketing-analytics`                     | `remove-as-provenance` | `removed`    | —                            |
|  54 | `apps/web/src/app/(dashboard)/marketing-analytics/raw/page.tsx`                 | `/marketing-analytics/raw`                 | `remove-as-provenance` | `removed`    | —                            |
|  55 | `apps/web/src/app/(dashboard)/marketing-analytics/reports/page.tsx`             | `/marketing-analytics/reports`             | `remove-as-provenance` | `removed`    | —                            |
|  56 | `apps/web/src/app/(dashboard)/marketing-analytics/settings/page.tsx`            | `/marketing-analytics/settings`            | `remove-as-provenance` | `removed`    | —                            |
|  57 | `apps/web/src/app/(dashboard)/marketing-analytics/traffic/[partnerId]/page.tsx` | `/marketing-analytics/traffic/[partnerId]` | `remove-as-provenance` | `removed`    | —                            |
|  58 | `apps/web/src/app/(dashboard)/marketing-analytics/traffic/page.tsx`             | `/marketing-analytics/traffic`             | `remove-as-provenance` | `removed`    | —                            |
|  59 | `apps/web/src/app/(dashboard)/messages/page.tsx`                                | `/messages`                                | `migrate`              | `foundation` | `/messages`                  |
|  60 | `apps/web/src/app/(dashboard)/my-portal/page.tsx`                               | `/my-portal`                               | `migrate`              | `foundation` | `/my-portal`                 |
|  61 | `apps/web/src/app/(dashboard)/office/page.tsx`                                  | `/office`                                  | `migrate`              | `foundation` | `/office`                    |
|  62 | `apps/web/src/app/(dashboard)/partners/[partnerId]/page.tsx`                    | `/partners/[partnerId]`                    | `migrate`              | `foundation` | `/partners/[partnerId]`      |
|  63 | `apps/web/src/app/(dashboard)/partners/campaigns/page.tsx`                      | `/partners/campaigns`                      | `remove-as-provenance` | `removed`    | —                            |
|  64 | `apps/web/src/app/(dashboard)/partners/dashboard/page.tsx`                      | `/partners/dashboard`                      | `remove-as-provenance` | `removed`    | —                            |
|  65 | `apps/web/src/app/(dashboard)/partners/page.tsx`                                | `/partners`                                | `migrate`              | `foundation` | `/partners`                  |
|  66 | `apps/web/src/app/(dashboard)/payroll/approval/page.tsx`                        | `/payroll/approval`                        | `migrate`              | `foundation` | `/payroll/approval`          |
|  67 | `apps/web/src/app/(dashboard)/payroll/page.tsx`                                 | `/payroll`                                 | `migrate`              | `foundation` | `/payroll`                   |
|  68 | `apps/web/src/app/(dashboard)/performance/page.tsx`                             | `/performance`                             | `migrate`              | `foundation` | `/performance`               |
|  69 | `apps/web/src/app/(dashboard)/policies/page.tsx`                                | `/policies`                                | `migrate`              | `foundation`    | `/policies`                  |
|  70 | `apps/web/src/app/(dashboard)/pr-management/page.tsx`                           | `/pr-management`                           | `migrate`              | `foundation` | `/pr-management`             |
|  71 | `apps/web/src/app/(dashboard)/product-crm/page.tsx`                             | `/product-crm`                             | `migrate`              | `foundation` | `/product-crm`               |
|  72 | `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`                    | `/projects/[projectId]`                    | `migrate`              | `foundation` | `/projects/[projectId]`      |
|  73 | `apps/web/src/app/(dashboard)/projects/dashboard/page.tsx`                      | `/projects/dashboard`                      | `migrate`              | `foundation` | `/projects/dashboard`        |
|  74 | `apps/web/src/app/(dashboard)/projects/page.tsx`                                | `/projects`                                | `migrate`              | `foundation`    | `/projects`                  |
|  75 | `apps/web/src/app/(dashboard)/qa-crm/[projectId]/page.tsx`                      | `/qa-crm/[projectId]`                      | `migrate`              | `foundation` | `/qa-crm/[projectId]`        |
|  76 | `apps/web/src/app/(dashboard)/qa-crm/page.tsx`                                  | `/qa-crm`                                  | `migrate`              | `foundation` | `/qa-crm`                    |
|  77 | `apps/web/src/app/(dashboard)/revenue/page.tsx`                                 | `/revenue`                                 | `migrate`              | `foundation` | `/revenue`                   |
|  78 | `apps/web/src/app/(dashboard)/roles/page.tsx`                                   | `/roles`                                   | `migrate`              | `foundation` | `/roles`                     |
|  79 | `apps/web/src/app/(dashboard)/sales-revenue/page.tsx`                           | `/sales-revenue`                           | `migrate`              | `foundation` | `/sales-revenue`             |
|  80 | `apps/web/src/app/(dashboard)/sales/page.tsx`                                   | `/sales`                                   | `migrate`              | `foundation` | `/sales`                     |
|  81 | `apps/web/src/app/(dashboard)/settings/page.tsx`                                | `/settings`                                | `migrate`              | `foundation` | `/settings`                  |
|  82 | `apps/web/src/app/(dashboard)/survey-forms/[id]/page.tsx`                       | `/survey-forms/[id]`                       | `migrate`              | `foundation`    | `/survey-forms/[id]`         |
|  83 | `apps/web/src/app/(dashboard)/survey-forms/[id]/respond/page.tsx`               | `/survey-forms/[id]/respond`               | `migrate`              | `foundation`    | `/survey-forms/[id]/respond` |
|  84 | `apps/web/src/app/(dashboard)/survey-forms/new/page.tsx`                        | `/survey-forms/new`                        | `migrate`              | `foundation`    | `/survey-forms/new`          |
|  85 | `apps/web/src/app/(dashboard)/survey-forms/page.tsx`                            | `/survey-forms`                            | `migrate`              | `foundation`    | `/survey-forms`              |
|  86 | `apps/web/src/app/(dashboard)/survey/[id]/page.tsx`                             | `/survey/[id]`                             | `migrate`              | `foundation`    | `/survey/[id]`               |
|  87 | `apps/web/src/app/(dashboard)/survey/[id]/respond/page.tsx`                     | `/survey/[id]/respond`                     | `migrate`              | `foundation`    | `/survey/[id]/respond`       |
|  88 | `apps/web/src/app/(dashboard)/survey/new/page.tsx`                              | `/survey/new`                              | `migrate`              | `foundation`    | `/survey/new`                |
|  89 | `apps/web/src/app/(dashboard)/survey/page.tsx`                                  | `/survey`                                  | `migrate`              | `foundation`    | `/survey`                    |
|  90 | `apps/web/src/app/(dashboard)/travel/approval/page.tsx`                         | `/travel/approval`                         | `migrate`              | `foundation` | `/travel/approval`           |
|  91 | `apps/web/src/app/(dashboard)/travel/page.tsx`                                  | `/travel`                                  | `migrate`              | `foundation` | `/travel`                    |
|  92 | `apps/web/src/app/(dashboard)/visa/checklist-templates/page.tsx`                | `/visa/checklist-templates`                | `migrate`              | `foundation` | `/visa/checklist-templates`  |
|  93 | `apps/web/src/app/(dashboard)/visa/knowledge-base/page.tsx`                     | `/visa/knowledge-base`                     | `migrate`              | `foundation` | `/visa/knowledge-base`       |
|  94 | `apps/web/src/app/(dashboard)/visa/page.tsx`                                    | `/visa`                                    | `migrate`              | `foundation` | `/visa`                      |
|  95 | `apps/web/src/app/(dashboard)/voucher-crm/page.tsx`                             | `/voucher-crm`                             | `migrate`              | `foundation` | `/voucher-crm`               |
|  96 | `apps/web/src/app/auth/callback/page.tsx`                                       | `/auth/callback`                           | `replace`              | `foundation` | `/auth/callback`             |
|  97 | `apps/web/src/app/change-password/page.tsx`                                     | `/change-password`                         | `replace`              | `foundation` | `/change-password`           |
|  98 | `apps/web/src/app/forgot-password/page.tsx`                                     | `/forgot-password`                         | `replace`              | `foundation` | `/forgot-password`           |
|  99 | `apps/web/src/app/magic-link/page.tsx`                                          | `/magic-link`                              | `replace`              | `foundation` | `/magic-link`                |
| 100 | `apps/web/src/app/page.tsx`                                                     | `/`                                        | `replace`              | `foundation` | `/`                          |
| 101 | `apps/web/src/app/reset-password/page.tsx`                                      | `/reset-password`                          | `replace`              | `foundation` | `/reset-password`            |
| 102 | `apps/web/src/app/sign-in/page.tsx`                                             | `/sign-in`                                 | `replace`              | `foundation` | `/sign-in`                   |
| 103 | `apps/web/src/app/sign/[token]/page.tsx`                                        | `/sign/[token]`                            | `migrate`              | `foundation` | `/sign/[token]`              |

Detailed rationale for each row is stored in `ROUTE_DISPOSITION.json`. The inventory must be updated whenever a target route moves from `pending` to `foundation` or reaches separately evidenced parity.

Row 30 (`/hrms/esop/[employeeId]`) keeps `replace` / `foundation`; Expo now
ships a compatibility redirect file at
`apps/app/app/(protected)/hrms/esop/[employeeId].tsx`. Status does not promote
without hosted E2E evidence.
