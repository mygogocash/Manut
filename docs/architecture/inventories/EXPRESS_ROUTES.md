# Express route / module inventory

> Phase 0.2 inventory (factual). Generated from `apps/api/src/modules/index.ts` and controllers.
> Machine-readable companion: [`express-routes.json`](./express-routes.json).

## Summary

| Metric | Count |
| --- | ---: |
| Mounted routers (`app.use`) | 87 |
| HTTP route handlers (method + path, deduped) | 1013 |
| GET | 372 |
| POST | 309 |
| PUT | 189 |
| PATCH | 9 |
| DELETE | 134 |

Registration entrypoint: `apps/api/src/modules/index.ts` → `registerModules(app)`.

Permissions: when `requirePermission("…")` appears in the same `router.METHOD(…)` argument list, it is recorded on the JSON row (`permissions`). Owner-scope and service-level authz are **not** fully encoded here — see module services.

Public / special mounts (no global session auth by design):

- `/api/legal-public` — token-auth signing
- `/api/helpdesk-public` — GitHub webhook HMAC
- `/api/cron` — `X-Cron-Secret`

## Mounts

| Mount | Module | Routes | Source |
| --- | --- | ---: | --- |
| `/api/cron` | `cron` | 15 | `apps/api/src/modules/cron/cron.controller.ts` |
| `/api/auth` | `auth` | 11 | `apps/api/src/modules/auth/auth.controller.ts` |
| `/api/admin/users` | `users` | 15 | `apps/api/src/modules/users/users.controller.ts` |
| `/api/roles` | `roles` | 8 | `apps/api/src/modules/roles/roles.controller.ts` |
| `/api/leave` | `leave` | 36 | `apps/api/src/modules/leave/leave.controller.ts` |
| `/api/holidays` | `holidays` | 4 | `apps/api/src/modules/holidays/holidays.controller.ts` |
| `/api/payroll` | `payroll` | 33 | `apps/api/src/modules/payroll/payroll.controller.ts` |
| `/api/accounting` | `accounting` | 24 | `apps/api/src/modules/accounting/accounting.controller.ts` |
| `/api/vendors` | `vendors` | 6 | `apps/api/src/modules/vendors/vendors.controller.ts` |
| `/api/exchange-rates` | `exchange-rates` | 5 | `apps/api/src/modules/exchange-rates/exchange-rates.controller.ts` |
| `/api/expenses` | `expenses` | 48 | `apps/api/src/modules/expenses/expenses.controller.ts` |
| `/api/wall` | `wall` | 7 | `apps/api/src/modules/wall/wall.controller.ts` |
| `/api/news` | `news` | 5 | `apps/api/src/modules/news/news.controller.ts` |
| `/api/certificates` | `certificates` | 4 | `apps/api/src/modules/certificates/certificates.controller.ts` |
| `/api/company-dates` | `company-dates` | 5 | `apps/api/src/modules/company-dates/company-dates.controller.ts` |
| `/api/dashboard` | `dashboard` | 1 | `apps/api/src/modules/dashboard/dashboard.controller.ts` |
| `/api/messages` | `messages` | 14 | `apps/api/src/modules/messages/messages.controller.ts` |
| `/api/integrations` | `integrations` | 13 | `apps/api/src/modules/integrations/integrations.controller.ts` |
| `/api/investors` | `investors` | 11 | `apps/api/src/modules/investors/investors.controller.ts` |
| `/api/investor/tasks` | `investor-tasks` | 6 | `apps/api/src/modules/investor-tasks/investor-tasks.controller.ts` |
| `/api/investor/activities` | `investor-activities` | 5 | `apps/api/src/modules/investor-activities/investor-activities.controller.ts` |
| `/api/investor/leads` | `investor-leads` | 5 | `apps/api/src/modules/investor-leads/investor-leads.controller.ts` |
| `/api/investor/accounts` | `investor-accounts` | 5 | `apps/api/src/modules/investor-accounts/investor-accounts.controller.ts` |
| `/api/investor/contacts` | `investor-contacts` | 5 | `apps/api/src/modules/investor-contacts/investor-contacts.controller.ts` |
| `/api/investor/pipeline-stages` | `investor-pipeline-stages` | 5 | `apps/api/src/modules/investor-pipeline-stages/investor-pipeline-stages.controller.ts` |
| `/api/investor/types` | `investor-types` | 5 | `apps/api/src/modules/investor-types/investor-types.controller.ts` |
| `/api/uploads` | `uploads` | 5 | `apps/api/src/modules/uploads/uploads.controller.ts` |
| `/api/admin/usage` | `admin` | 4 | `apps/api/src/modules/admin/usage/usage.controller.ts` |
| `/api/admin` | `admin` | 17 | `apps/api/src/modules/admin/admin.controller.ts` |
| `/api/partners` | `partners` | 27 | `apps/api/src/modules/partners/partners.controller.ts` |
| `/api/deals` | `deals` | 6 | `apps/api/src/modules/deals/deals.controller.ts` |
| `/api/leads` | `leads` | 8 | `apps/api/src/modules/leads/leads.controller.ts` |
| `/api/lead-sources` | `lead-sources` | 4 | `apps/api/src/modules/lead-sources/lead-sources.controller.ts` |
| `/api/lost-reasons` | `lost-reasons` | 4 | `apps/api/src/modules/lost-reasons/lost-reasons.controller.ts` |
| `/api/accounts` | `accounts` | 7 | `apps/api/src/modules/accounts/accounts.controller.ts` |
| `/api/contacts` | `contacts` | 5 | `apps/api/src/modules/contacts/contacts.controller.ts` |
| `/api/opportunities` | `opportunities` | 14 | `apps/api/src/modules/opportunities/opportunities.controller.ts` |
| `/api/crm/activities` | `crm-activities` | 5 | `apps/api/src/modules/crm-activities/crm-activities.controller.ts` |
| `/api/crm/tasks` | `crm-tasks` | 6 | `apps/api/src/modules/crm-tasks/crm-tasks.controller.ts` |
| `/api/crm/settings` | `crm-settings` | 2 | `apps/api/src/modules/crm-settings/crm-settings.controller.ts` |
| `/api/sales-revenue/opportunities` | `revenue-opportunities` | 14 | `apps/api/src/modules/revenue-opportunities/opportunities.controller.ts` |
| `/api/sales-revenue/accounts` | `revenue-accounts` | 7 | `apps/api/src/modules/revenue-accounts/accounts.controller.ts` |
| `/api/sales-revenue/contacts` | `revenue-contacts` | 5 | `apps/api/src/modules/revenue-contacts/contacts.controller.ts` |
| `/api/sales-revenue/leads` | `revenue-leads` | 8 | `apps/api/src/modules/revenue-leads/leads.controller.ts` |
| `/api/sales-revenue/lead-sources` | `revenue-lead-sources` | 4 | `apps/api/src/modules/revenue-lead-sources/lead-sources.controller.ts` |
| `/api/sales-revenue/lost-reasons` | `revenue-lost-reasons` | 4 | `apps/api/src/modules/revenue-lost-reasons/lost-reasons.controller.ts` |
| `/api/sales-revenue/activities` | `revenue-activities` | 5 | `apps/api/src/modules/revenue-activities/crm-activities.controller.ts` |
| `/api/sales-revenue/tasks` | `revenue-tasks` | 6 | `apps/api/src/modules/revenue-tasks/crm-tasks.controller.ts` |
| `/api/sales-revenue/settings` | `revenue-settings` | 2 | `apps/api/src/modules/revenue-settings/crm-settings.controller.ts` |
| `/api/projects` | `projects` | 36 | `apps/api/src/modules/projects/projects.controller.ts` |
| `/api/it-crm` | `it-crm` | 23 | `apps/api/src/modules/it-crm/it-crm.controller.ts` |
| `/api/it-operations` | `it-operations` | 1 | `apps/api/src/modules/it-operations/it-operations.controller.ts` |
| `/api/it-billing` | `it-billing` | 26 | `apps/api/src/modules/it-billing/it-billing.controller.ts` |
| `/api/it-access` | `it-access` | 17 | `apps/api/src/modules/it-access/it-access.controller.ts` |
| `/api/qa-crm` | `qa-crm` | 19 | `apps/api/src/modules/qa-crm/qa-crm.controller.ts` |
| `/api/accounting-crm` | `accounting-crm` | 18 | `apps/api/src/modules/accounting-crm/accounting-crm.controller.ts` |
| `/api/legal-crm` | `legal-crm` | 18 | `apps/api/src/modules/legal-crm/legal-crm.controller.ts` |
| `/api/product-crm` | `product-crm` | 18 | `apps/api/src/modules/product-crm/product-crm.controller.ts` |
| `/api/voucher-crm` | `voucher-crm` | 7 | `apps/api/src/modules/voucher-crm/voucher-crm.controller.ts` |
| `/api/hrms` | `hrms` | 67 | `apps/api/src/modules/hrms/index.ts (composes hrms+attendance controllers)` |
| `/api/helpdesk` | `helpdesk` | 12 | `apps/api/src/modules/helpdesk/helpdesk.controller.ts` |
| `/api/visa` | `visa` | 15 | `apps/api/src/modules/visa/visa.controller.ts` |
| `/api/visa-kb` | `visa-kb` | 6 | `apps/api/src/modules/visa-kb/visa-kb.controller.ts` |
| `/api/visa-checklist` | `visa-checklist` | 7 | `apps/api/src/modules/visa-checklist/visa-checklist.controller.ts` |
| `/api/ninety-day-notifications` | `ninety-day` | 8 | `apps/api/src/modules/ninety-day/ninety-day.controller.ts` |
| `/api/learning` | `learning` | 6 | `apps/api/src/modules/learning/learning.controller.ts` |
| `/api/office` | `office` | 27 | `apps/api/src/modules/office/office.controller.ts` |
| `/api/policies` | `policies` | 6 | `apps/api/src/modules/policies/policies.controller.ts` |
| `/api/benefits` | `benefits` | 10 | `apps/api/src/modules/benefits/benefits.controller.ts` |
| `/api/blogs` | `blogs` | 6 | `apps/api/src/modules/blogs/blogs.controller.ts` |
| `/api/docs` | `docs` | 13 | `apps/api/src/modules/docs/docs.controller.ts` |
| `/api/articles` | `articles` | 6 | `apps/api/src/modules/articles/articles.controller.ts` |
| `/api/revenue` | `revenue` | 4 | `apps/api/src/modules/revenue/revenue.controller.ts` |
| `/api/directory` | `directory` | 6 | `apps/api/src/modules/directory/directory.controller.ts` |
| `/api/dataroom` | `dataroom` | 6 | `apps/api/src/modules/dataroom/dataroom.controller.ts` |
| `/api/investor-updates` | `investor-updates` | 6 | `apps/api/src/modules/investor-updates/investor-updates.controller.ts` |
| `/api/career` | `career` | 7 | `apps/api/src/modules/career/career.controller.ts` |
| `/api/cash-advance` | `cash-advance` | 21 | `apps/api/src/modules/cash-advance/cash-advance.controller.ts` |
| `/api/applications` | `applications` | 4 | `apps/api/src/modules/applications/applications.controller.ts` |
| `/api/survey` | `survey` | 21 | `apps/api/src/modules/survey/survey.controller.ts` |
| `/api/survey-forms` | `survey-forms` | 21 | `apps/api/src/modules/survey-forms/survey-forms.controller.ts` |
| `/api/travel` | `travel` | 24 | `apps/api/src/modules/travel/travel.controller.ts` |
| `/api/performance` | `performance` | 13 | `apps/api/src/modules/performance/performance.controller.ts` |
| `/api/legal` | `legal` | 25 | `apps/api/src/modules/legal/legal.controller.ts` |
| `/api/legal-announcements` | `legal-announcements` | 9 | `apps/api/src/modules/legal-announcements/legal-announcements.controller.ts` |
| `/api/legal-public` | `legal` | 3 | `apps/api/src/modules/legal/legal.public.controller.ts` |
| `/api/helpdesk-public` | `helpdesk` | 1 | `apps/api/src/modules/helpdesk/helpdesk.public.controller.ts` |

## Full route list

See [`express-routes.json`](./express-routes.json) → `routes[]` (`method`, `fullPath`, `permissions`, `file`).

## Related

- UI route disposition: [`docs/ROUTE_DISPOSITION.json`](../../ROUTE_DISPOSITION.json)
- API ↔ UI wave scaffold: [`disposition-register.json`](./disposition-register.json) / [`DISPOSITION_REGISTER.md`](./DISPOSITION_REGISTER.md)
