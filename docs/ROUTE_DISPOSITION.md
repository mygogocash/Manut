# Route disposition inventory

This inventory accounts for every route-page file in audited source snapshot `371349fd43fd7c7c7717054beec97bfb023885ca`. It is a migration control, not a claim of web parity.

## Evidence

```sh
git ls-tree -r --name-only 371349fd -- apps/web/src/app | rg '/page\.tsx$' | sort
```

- Source route-page files: **103**
- Unique source paths: **103**
- Dispositions: **79 migrate**, **8 replace**, **16 remove-as-provenance**
- Current status: **35 foundation**, **52 pending**, **16 removed**

The source command is sorted before classification. The JSON companion repeats the source command, counts, and every row, so CI can independently assert count, uniqueness, and allowed values.

## Meaning of each state

- `migrate`: retain the approved route contract in the universal app.
- `replace`: retain the approved user outcome but use a clean universal route or platform adapter instead of the source implementation.
- `remove-as-provenance`: intentionally exclude the route; it has no target route.
- `foundation`: a target Expo route file and core wiring exist, but behavioral parity is not yet claimed.
- `pending`: the approved target route is not yet present in Expo.
- `removed`: the source route was intentionally excluded.

## Inventory

|   # | Source path                                                                     | Source route                               | Disposition            | Status       | Target route                 |
| --: | ------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------- | ------------ | ---------------------------- |
|   1 | `apps/web/src/app/(dashboard)/accounting-crm/page.tsx`                          | `/accounting-crm`                          | `migrate`              | `pending`    | `/accounting-crm`            |
|   2 | `apps/web/src/app/(dashboard)/accounting/page.tsx`                              | `/accounting`                              | `migrate`              | `foundation` | `/accounting`                |
|   3 | `apps/web/src/app/(dashboard)/admin/aria-insights/page.tsx`                     | `/admin/aria-insights`                     | `remove-as-provenance` | `removed`    | —                            |
|   4 | `apps/web/src/app/(dashboard)/admin/aria-knowledge/page.tsx`                    | `/admin/aria-knowledge`                    | `remove-as-provenance` | `removed`    | —                            |
|   5 | `apps/web/src/app/(dashboard)/admin/docusign/oauth/callback/page.tsx`           | `/admin/docusign/oauth/callback`           | `remove-as-provenance` | `removed`    | —                            |
|   6 | `apps/web/src/app/(dashboard)/admin/docusign/page.tsx`                          | `/admin/docusign`                          | `remove-as-provenance` | `removed`    | —                            |
|   7 | `apps/web/src/app/(dashboard)/admin/form-config/page.tsx`                       | `/admin/form-config`                       | `migrate`              | `pending`    | `/admin/form-config`         |
|   8 | `apps/web/src/app/(dashboard)/admin/page.tsx`                                   | `/admin`                                   | `migrate`              | `pending`    | `/admin`                     |
|   9 | `apps/web/src/app/(dashboard)/applications/page.tsx`                            | `/applications`                            | `migrate`              | `foundation` | `/applications`              |
|  10 | `apps/web/src/app/(dashboard)/aria/knowledge/[id]/page.tsx`                     | `/aria/knowledge/[id]`                     | `remove-as-provenance` | `removed`    | —                            |
|  11 | `apps/web/src/app/(dashboard)/aria/page.tsx`                                    | `/aria`                                    | `remove-as-provenance` | `removed`    | —                            |
|  12 | `apps/web/src/app/(dashboard)/benefits/page.tsx`                                | `/benefits`                                | `migrate`              | `foundation` | `/benefits`                  |
|  13 | `apps/web/src/app/(dashboard)/blog-management/page.tsx`                         | `/blog-management`                         | `migrate`              | `pending`    | `/blog-management`           |
|  14 | `apps/web/src/app/(dashboard)/careers/page.tsx`                                 | `/careers`                                 | `migrate`              | `foundation` | `/careers`                   |
|  15 | `apps/web/src/app/(dashboard)/cash-advance/approval/page.tsx`                   | `/cash-advance/approval`                   | `migrate`              | `foundation` | `/cash-advance/approval`     |
|  16 | `apps/web/src/app/(dashboard)/cash-advance/page.tsx`                            | `/cash-advance`                            | `migrate`              | `foundation` | `/cash-advance`              |
|  17 | `apps/web/src/app/(dashboard)/certificates/page.tsx`                            | `/certificates`                            | `migrate`              | `pending`    | `/certificates`              |
|  18 | `apps/web/src/app/(dashboard)/dashboard/page.tsx`                               | `/dashboard`                               | `migrate`              | `foundation` | `/dashboard`                 |
|  19 | `apps/web/src/app/(dashboard)/dataroom/page.tsx`                                | `/dataroom`                                | `migrate`              | `pending`    | `/dataroom`                  |
|  20 | `apps/web/src/app/(dashboard)/deals/page.tsx`                                   | `/deals`                                   | `migrate`              | `pending`    | `/deals`                     |
|  21 | `apps/web/src/app/(dashboard)/directory/page.tsx`                               | `/directory`                               | `migrate`              | `foundation` | `/directory`                 |
|  22 | `apps/web/src/app/(dashboard)/docs/page.tsx`                                    | `/docs`                                    | `migrate`              | `pending`    | `/docs`                      |
|  23 | `apps/web/src/app/(dashboard)/drive/page.tsx`                                   | `/drive`                                   | `migrate`              | `pending`    | `/drive`                     |
|  24 | `apps/web/src/app/(dashboard)/employees/page.tsx`                               | `/employees`                               | `migrate`              | `foundation` | `/employees`                 |
|  25 | `apps/web/src/app/(dashboard)/expenses/[reportId]/page.tsx`                     | `/expenses/[reportId]`                     | `migrate`              | `pending`    | `/expenses/[reportId]`       |
|  26 | `apps/web/src/app/(dashboard)/expenses/approval/page.tsx`                       | `/expenses/approval`                       | `migrate`              | `foundation` | `/expenses/approval`         |
|  27 | `apps/web/src/app/(dashboard)/expenses/page.tsx`                                | `/expenses`                                | `migrate`              | `foundation` | `/expenses`                  |
|  28 | `apps/web/src/app/(dashboard)/gmail/page.tsx`                                   | `/gmail`                                   | `migrate`              | `pending`    | `/gmail`                     |
|  29 | `apps/web/src/app/(dashboard)/hr-crm/page.tsx`                                  | `/hr-crm`                                  | `migrate`              | `pending`    | `/hr-crm`                    |
|  30 | `apps/web/src/app/(dashboard)/hrms/esop/[employeeId]/page.tsx`                  | `/hrms/esop/[employeeId]`                  | `replace`              | `pending`    | `/hrms/grants/[employeeId]`  |
|  31 | `apps/web/src/app/(dashboard)/hrms/page.tsx`                                    | `/hrms`                                    | `migrate`              | `foundation` | `/hrms`                      |
|  32 | `apps/web/src/app/(dashboard)/investor-crm/page.tsx`                            | `/investor-crm`                            | `migrate`              | `pending`    | `/investor-crm`              |
|  33 | `apps/web/src/app/(dashboard)/investor-updates/page.tsx`                        | `/investor-updates`                        | `migrate`              | `pending`    | `/investor-updates`          |
|  34 | `apps/web/src/app/(dashboard)/investors/page.tsx`                               | `/investors`                               | `migrate`              | `pending`    | `/investors`                 |
|  35 | `apps/web/src/app/(dashboard)/it-crm/dashboard/page.tsx`                        | `/it-crm/dashboard`                        | `migrate`              | `pending`    | `/it-crm/dashboard`          |
|  36 | `apps/web/src/app/(dashboard)/it-crm/page.tsx`                                  | `/it-crm`                                  | `migrate`              | `pending`    | `/it-crm`                    |
|  37 | `apps/web/src/app/(dashboard)/it-helpdesk/page.tsx`                             | `/it-helpdesk`                             | `migrate`              | `foundation`    | `/it-helpdesk`               |
|  38 | `apps/web/src/app/(dashboard)/it-operations/access/page.tsx`                    | `/it-operations/access`                    | `migrate`              | `pending`    | `/it-operations/access`      |
|  39 | `apps/web/src/app/(dashboard)/it-operations/billing/page.tsx`                   | `/it-operations/billing`                   | `migrate`              | `pending`    | `/it-operations/billing`     |
|  40 | `apps/web/src/app/(dashboard)/it-operations/page.tsx`                           | `/it-operations`                           | `migrate`              | `pending`    | `/it-operations`             |
|  41 | `apps/web/src/app/(dashboard)/learning/page.tsx`                                | `/learning`                                | `migrate`              | `foundation` | `/learning`                  |
|  42 | `apps/web/src/app/(dashboard)/leave/approval/page.tsx`                          | `/leave/approval`                          | `migrate`              | `foundation` | `/leave/approval`            |
|  43 | `apps/web/src/app/(dashboard)/leave/holidays/page.tsx`                          | `/leave/holidays`                          | `migrate`              | `foundation` | `/leave/holidays`            |
|  44 | `apps/web/src/app/(dashboard)/leave/page.tsx`                                   | `/leave`                                   | `migrate`              | `foundation` | `/leave`                     |
|  45 | `apps/web/src/app/(dashboard)/leave/policies/page.tsx`                          | `/leave/policies`                          | `migrate`              | `foundation` | `/leave/policies`            |
|  46 | `apps/web/src/app/(dashboard)/legal-crm/page.tsx`                               | `/legal-crm`                               | `migrate`              | `pending`    | `/legal-crm`                 |
|  47 | `apps/web/src/app/(dashboard)/legal/announcements/[id]/page.tsx`                | `/legal/announcements/[id]`                | `migrate`              | `pending`    | `/legal/announcements/[id]`  |
|  48 | `apps/web/src/app/(dashboard)/legal/announcements/page.tsx`                     | `/legal/announcements`                     | `migrate`              | `pending`    | `/legal/announcements`       |
|  49 | `apps/web/src/app/(dashboard)/legal/page.tsx`                                   | `/legal`                                   | `migrate`              | `pending`    | `/legal`                     |
|  50 | `apps/web/src/app/(dashboard)/legal/shared/page.tsx`                            | `/legal/shared`                            | `migrate`              | `pending`    | `/legal/shared`              |
|  51 | `apps/web/src/app/(dashboard)/marketing-analytics/campaigns/[id]/page.tsx`      | `/marketing-analytics/campaigns/[id]`      | `remove-as-provenance` | `removed`    | —                            |
|  52 | `apps/web/src/app/(dashboard)/marketing-analytics/campaigns/page.tsx`           | `/marketing-analytics/campaigns`           | `remove-as-provenance` | `removed`    | —                            |
|  53 | `apps/web/src/app/(dashboard)/marketing-analytics/page.tsx`                     | `/marketing-analytics`                     | `remove-as-provenance` | `removed`    | —                            |
|  54 | `apps/web/src/app/(dashboard)/marketing-analytics/raw/page.tsx`                 | `/marketing-analytics/raw`                 | `remove-as-provenance` | `removed`    | —                            |
|  55 | `apps/web/src/app/(dashboard)/marketing-analytics/reports/page.tsx`             | `/marketing-analytics/reports`             | `remove-as-provenance` | `removed`    | —                            |
|  56 | `apps/web/src/app/(dashboard)/marketing-analytics/settings/page.tsx`            | `/marketing-analytics/settings`            | `remove-as-provenance` | `removed`    | —                            |
|  57 | `apps/web/src/app/(dashboard)/marketing-analytics/traffic/[partnerId]/page.tsx` | `/marketing-analytics/traffic/[partnerId]` | `remove-as-provenance` | `removed`    | —                            |
|  58 | `apps/web/src/app/(dashboard)/marketing-analytics/traffic/page.tsx`             | `/marketing-analytics/traffic`             | `remove-as-provenance` | `removed`    | —                            |
|  59 | `apps/web/src/app/(dashboard)/messages/page.tsx`                                | `/messages`                                | `migrate`              | `pending`    | `/messages`                  |
|  60 | `apps/web/src/app/(dashboard)/my-portal/page.tsx`                               | `/my-portal`                               | `migrate`              | `foundation` | `/my-portal`                 |
|  61 | `apps/web/src/app/(dashboard)/office/page.tsx`                                  | `/office`                                  | `migrate`              | `foundation` | `/office`                    |
|  62 | `apps/web/src/app/(dashboard)/partners/[partnerId]/page.tsx`                    | `/partners/[partnerId]`                    | `migrate`              | `pending`    | `/partners/[partnerId]`      |
|  63 | `apps/web/src/app/(dashboard)/partners/campaigns/page.tsx`                      | `/partners/campaigns`                      | `remove-as-provenance` | `removed`    | —                            |
|  64 | `apps/web/src/app/(dashboard)/partners/dashboard/page.tsx`                      | `/partners/dashboard`                      | `remove-as-provenance` | `removed`    | —                            |
|  65 | `apps/web/src/app/(dashboard)/partners/page.tsx`                                | `/partners`                                | `migrate`              | `pending`    | `/partners`                  |
|  66 | `apps/web/src/app/(dashboard)/payroll/approval/page.tsx`                        | `/payroll/approval`                        | `migrate`              | `pending`    | `/payroll/approval`          |
|  67 | `apps/web/src/app/(dashboard)/payroll/page.tsx`                                 | `/payroll`                                 | `migrate`              | `foundation` | `/payroll`                   |
|  68 | `apps/web/src/app/(dashboard)/performance/page.tsx`                             | `/performance`                             | `migrate`              | `foundation` | `/performance`               |
|  69 | `apps/web/src/app/(dashboard)/policies/page.tsx`                                | `/policies`                                | `migrate`              | `pending`    | `/policies`                  |
|  70 | `apps/web/src/app/(dashboard)/pr-management/page.tsx`                           | `/pr-management`                           | `migrate`              | `pending`    | `/pr-management`             |
|  71 | `apps/web/src/app/(dashboard)/product-crm/page.tsx`                             | `/product-crm`                             | `migrate`              | `pending`    | `/product-crm`               |
|  72 | `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`                    | `/projects/[projectId]`                    | `migrate`              | `foundation` | `/projects/[projectId]`      |
|  73 | `apps/web/src/app/(dashboard)/projects/dashboard/page.tsx`                      | `/projects/dashboard`                      | `migrate`              | `foundation` | `/projects/dashboard`        |
|  74 | `apps/web/src/app/(dashboard)/projects/page.tsx`                                | `/projects`                                | `migrate`              | `foundation`    | `/projects`                  |
|  75 | `apps/web/src/app/(dashboard)/qa-crm/[projectId]/page.tsx`                      | `/qa-crm/[projectId]`                      | `migrate`              | `pending`    | `/qa-crm/[projectId]`        |
|  76 | `apps/web/src/app/(dashboard)/qa-crm/page.tsx`                                  | `/qa-crm`                                  | `migrate`              | `pending`    | `/qa-crm`                    |
|  77 | `apps/web/src/app/(dashboard)/revenue/page.tsx`                                 | `/revenue`                                 | `migrate`              | `foundation` | `/revenue`                   |
|  78 | `apps/web/src/app/(dashboard)/roles/page.tsx`                                   | `/roles`                                   | `migrate`              | `foundation` | `/roles`                     |
|  79 | `apps/web/src/app/(dashboard)/sales-revenue/page.tsx`                           | `/sales-revenue`                           | `migrate`              | `pending`    | `/sales-revenue`             |
|  80 | `apps/web/src/app/(dashboard)/sales/page.tsx`                                   | `/sales`                                   | `migrate`              | `pending`    | `/sales`                     |
|  81 | `apps/web/src/app/(dashboard)/settings/page.tsx`                                | `/settings`                                | `migrate`              | `foundation` | `/settings`                  |
|  82 | `apps/web/src/app/(dashboard)/survey-forms/[id]/page.tsx`                       | `/survey-forms/[id]`                       | `migrate`              | `pending`    | `/survey-forms/[id]`         |
|  83 | `apps/web/src/app/(dashboard)/survey-forms/[id]/respond/page.tsx`               | `/survey-forms/[id]/respond`               | `migrate`              | `pending`    | `/survey-forms/[id]/respond` |
|  84 | `apps/web/src/app/(dashboard)/survey-forms/new/page.tsx`                        | `/survey-forms/new`                        | `migrate`              | `pending`    | `/survey-forms/new`          |
|  85 | `apps/web/src/app/(dashboard)/survey-forms/page.tsx`                            | `/survey-forms`                            | `migrate`              | `pending`    | `/survey-forms`              |
|  86 | `apps/web/src/app/(dashboard)/survey/[id]/page.tsx`                             | `/survey/[id]`                             | `migrate`              | `pending`    | `/survey/[id]`               |
|  87 | `apps/web/src/app/(dashboard)/survey/[id]/respond/page.tsx`                     | `/survey/[id]/respond`                     | `migrate`              | `pending`    | `/survey/[id]/respond`       |
|  88 | `apps/web/src/app/(dashboard)/survey/new/page.tsx`                              | `/survey/new`                              | `migrate`              | `pending`    | `/survey/new`                |
|  89 | `apps/web/src/app/(dashboard)/survey/page.tsx`                                  | `/survey`                                  | `migrate`              | `pending`    | `/survey`                    |
|  90 | `apps/web/src/app/(dashboard)/travel/approval/page.tsx`                         | `/travel/approval`                         | `migrate`              | `pending`    | `/travel/approval`           |
|  91 | `apps/web/src/app/(dashboard)/travel/page.tsx`                                  | `/travel`                                  | `migrate`              | `foundation` | `/travel`                    |
|  92 | `apps/web/src/app/(dashboard)/visa/checklist-templates/page.tsx`                | `/visa/checklist-templates`                | `migrate`              | `pending`    | `/visa/checklist-templates`  |
|  93 | `apps/web/src/app/(dashboard)/visa/knowledge-base/page.tsx`                     | `/visa/knowledge-base`                     | `migrate`              | `pending`    | `/visa/knowledge-base`       |
|  94 | `apps/web/src/app/(dashboard)/visa/page.tsx`                                    | `/visa`                                    | `migrate`              | `foundation` | `/visa`                      |
|  95 | `apps/web/src/app/(dashboard)/voucher-crm/page.tsx`                             | `/voucher-crm`                             | `migrate`              | `pending`    | `/voucher-crm`               |
|  96 | `apps/web/src/app/auth/callback/page.tsx`                                       | `/auth/callback`                           | `replace`              | `foundation` | `/auth/callback`             |
|  97 | `apps/web/src/app/change-password/page.tsx`                                     | `/change-password`                         | `replace`              | `foundation` | `/change-password`           |
|  98 | `apps/web/src/app/forgot-password/page.tsx`                                     | `/forgot-password`                         | `replace`              | `foundation` | `/forgot-password`           |
|  99 | `apps/web/src/app/magic-link/page.tsx`                                          | `/magic-link`                              | `replace`              | `foundation` | `/magic-link`                |
| 100 | `apps/web/src/app/page.tsx`                                                     | `/`                                        | `replace`              | `foundation` | `/`                          |
| 101 | `apps/web/src/app/reset-password/page.tsx`                                      | `/reset-password`                          | `replace`              | `foundation` | `/reset-password`            |
| 102 | `apps/web/src/app/sign-in/page.tsx`                                             | `/sign-in`                                 | `replace`              | `foundation` | `/sign-in`                   |
| 103 | `apps/web/src/app/sign/[token]/page.tsx`                                        | `/sign/[token]`                            | `migrate`              | `pending`    | `/sign/[token]`              |

Detailed rationale for each row is stored in `ROUTE_DISPOSITION.json`. The inventory must be updated whenever a target route moves from `pending` to `foundation` or reaches separately evidenced parity.
