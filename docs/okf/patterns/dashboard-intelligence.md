---
type: Playbook
title: Dashboard intelligence (flow metrics + SLA)
description: Turn a flat KPI page into an exhibit-style report using transition-stamped lifecycle columns, tunable SLA constants, and a single snapshot endpoint.
tags: [backend, dashboard, metrics]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Dashboard intelligence (flow metrics + SLA)

Turning a flat KPI page into a McKinsey-style exhibit report.

## Steps

1. Add **transition-stamped** lifecycle columns (`statusChangedAt`,
   `completedAt`, `firstResponseAt`) written in the service ONLY when the
   status actually changes — never on every edit — so stage-aging /
   cycle-time / response-time are exact, not approximated from `updatedAt`;
   clear paired stamps on reversal (task leaves `done` → null
   `completedAt`; ticket reopens → null `resolvedAt` + bump
   `reopenedCount`). Backfill them idempotently from `updatedAt`, guarded on
   the seed value.
2. Keep policy thresholds (SLA targets) as a tunable **code constant**
   (`helpdesk.sla.ts`), not magic numbers buried in the query, and echo them
   in the payload so the UI shows what each metric was measured against;
   percentages return `null` (not 0) on an empty denominator so the UI
   renders "—".
3. One read-only snapshot endpoint computes every exhibit in a single
   `Promise.all`; the page renders numbered "Exhibit N —" frames + KPI bands
   + an HTML export, mirroring the Sales CRM dashboard's serif /
   `var(--color-*)` styling.

## Reference

`it-crm.service.ts` `dashboard()`, `/it-crm/dashboard`.
