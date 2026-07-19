# Module specification

> **Product / current-state reference.** Sole forward migration roadmap:
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](./EXPO_CLOUDFLARE_MASTER_PLAN.md).
> Module behavior changes only via explicit product decision + parity signoff
> in the master plan.

The imported intranet capabilities remain available while their screens migrate
to Expo. Business rules stay in API services and portable DTOs; UI parity is
measured route-by-route.

| Area               | Capabilities                                                | Mobile portability rule                                                                             |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Home               | Dashboard, announcements, directory, employee portal        | Responsive cards and lists                                                                          |
| People             | HRMS, attendance, leave, travel, visa, benefits, payroll    | Native forms and approval actions                                                                   |
| Performance        | Goals, self-review, manager review, HR cycles               | Employee access is explicit in route policy                                                         |
| Expenses           | Expense items, reports, approvals, cash advance, accounting | Files use `{ uri, name, mimeType, size }`, never DOM `File` in shared code                          |
| Projects           | Projects, helpdesk, operational and legal workspaces        | Desktop tables map to native list cards                                                             |
| CRM                | Sales, investors, partners, revenue and activities          | Charts and drag/drop use platform adapters                                                          |
| Content            | Documents, policies, news, blogs, messages                  | Downloads map to native share/file APIs                                                             |
| Surveys and Awards | Survey builder/responses plus recognition workflows         | User-facing naming is “Surveys” and “Awards”; legacy implementation names are not navigation labels |
| Assistant          | Internal AI-assisted workflows                              | Provider optional; no inherited account or prompt identity                                          |
| Administration     | Users, roles, permissions, settings, integrations           | Sensitive actions require API authorization                                                         |

## Expenses lifecycle

Expense items and reports support soft delete, restore, and deleted-only purge.
Active purge attempts return `409`; missing records return `404`. Totals spanning
pages are calculated server-side. Browser downloads and mobile sharing are
separate adapters over the same service result.

## Performance access

Employees with Performance permission can navigate directly to `/performance`
even if a sidebar group is hidden. Route policy is explicit and segment-aware;
the API remains authoritative for individual review and manager scope.

## Loading budget

Default tabs render immediately. Inactive panels and closed dialogs load on
demand. The web target is at most 650 KB first-load JavaScript for each migrated
Sales and HRMS shell; bundle regression checks run in CI.

## Migration acceptance for a screen

1. Service DTO and decision logic live in a shared/platform-neutral boundary.
2. Expo web matches the protected route behavior and primary workflow.
3. Browser E2E has hard assertions and no conditional skip.
4. iOS and Android exports compile and a native render test imports no web-only
   module.
5. The legacy Next route is removed only after all four checks pass.
