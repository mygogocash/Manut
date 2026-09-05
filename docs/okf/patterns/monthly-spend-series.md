---
type: Playbook
title: Monthly spend series over rows that span months
description: Turning a run-rate snapshot into a per-month time series when one row contributes cost to many months — why SQL date_trunc cannot do it, why the "active only" filter destroys the history, and how a read-time fallback beats a backfill.
tags: [backend, database, reporting, frontend]
status: stable
verified:
  - at: 2026-08-28
    by: kunanon-ui
stale_after: 2027-02-28
---

# Monthly spend series over rows that span months

When a surface has to answer "what did we pay each month, and why did it
change" — as opposed to "what do we pay now" — six things are load-bearing.
Reference implementation: `it-billing-monthly.ts` and the IT Billing Monthly
tab.

## Steps

### 1. `date_trunc('month', …)` + `GROUP BY` cannot express this

`date_trunc` buckets a row by its OWN date. A subscription instead has to be
spread across EVERY month it was live, so one row feeds many buckets. Build the
series in memory — the `bucketKey` + `Map` accumulator shape in
`marketing-reports.service.ts` — not in SQL. (`it-crm.service.ts` is the repo's
one legitimate `date_trunc` roll-up; it counts rows by their own date, which is
a different question.)

### 2. The "exclude cancelled" filter is right for a run-rate and fatal for a history

`status: { not: "cancelled" }` sits in four `it-billing.repository.ts` methods
and is correct for every one of them. Copied into a time series it makes
cancelling a service ERASE it from spend history instead of showing the saving —
the action being measured destroys its own evidence. Add a separate repository
method that includes cancelled rows (`subscriptionsForMonthlySeries`) and leave
`activeSubscriptions()` alone so the existing run-rate cards do not move.

### 3. A read-time fallback beats a backfill

`cancelled_at` shipped as a column with NO data migration. `endMonth()` resolves
a NULL for legacy rows: `renewalDate` (the paid-through date the money followed)
then `renewalDecisionAt` then `updatedAt`. That is what makes staging compute
the same series as prod — staging syncs with `pnpm db:push`, which applies schema
but never runs data-migration SQL, so a backfill would land on prod and silently
skip staging. Prefer this shape whenever a new column's history is derivable
from columns that already exist.

### 4. "Cancelled" and "stops costing money" are different columns

A decision stamp is not an effective date. Cancelling in August a service paid
through December still costs money until December, so `renewalDecisionAt` and
`cancelled_at` are different numbers and only the second belongs in a spend
trend. Default the effective date to the renewal date and make it visible and
overridable at the moment of cancellation — a default that silently moves a
month of spend must not be invisible. A renew CLEARS it, or a revived
subscription's cost never returns.

Separately, `lastChargedMonth` is not `endMonth`. A one-time purchase is never
cancelled but stops charging after its single month. Merging the two functions
makes every one-time charge look permanent; keeping them apart is also what
lets the UI label a one-time completion differently from a cancellation, so it
never credits a saving nobody made.

### 5. Don't "fix" the shared monthly-equivalent helper

`toMonthlySpend` returns 0 for `one-time`, which is correct for its own contract
("recurring monthly cost") and is depended on by `vendorCostReport` and
`seatMetrics`. Place the one-time charge inside the month-placement function
instead.

### 6. Round per row, then sum; derive months in UTC

A month group header that shows `round(sum of raw)` can differ by cents from the
rows it expands to — i.e. contradict its own contents. Round each row, then sum
those. And derive months with `getUTCFullYear`/`getUTCMonth`: `@db.Date` arrives
as UTC midnight, so local getters shift a row dated the 1st into the previous
month for any server west of UTC, which is a whole month of spend misattributed
and visible only in some deployments.

## Related

- [Paginated aggregates](/pitfalls/paginated-aggregates.md) — a month subtotal must not come from one loaded page.
- [Configurable list](/patterns/configurable-list.md) — the sibling shape when the thing to vary is a lookup, not a series.

## Why

A run-rate snapshot and a time series answer different questions from the same
table, and the filter that makes one correct makes the other lie. Keeping them
as separate repository methods rather than parameterising one is what stops a
later edit from "simplifying" the history back into a run-rate.

## How to recognise the edges

- The series is always ONE currency and returns `currenciesPresent` alongside
  it. Amounts in different currencies are never summed — the result would not be
  money in any currency.
- `deltaVsPrevious` is `null` on the first point, never 0. Rendering 0 claims
  spend was flat when the truth is that it is unknown.
- The window is capped (`MAX_WINDOW_MONTHS`), because each point carries its own
  movement arrays and an unbounded `from` builds a huge payload.
- Month detail is returned WHOLE, not paginated: the month subtotal has to equal
  the sum of the rows behind it, and a total derived from one loaded page would
  not (see the paginated-aggregates pitfall).
- Month keys are `"YYYY-MM"`, zero-padded, so lexicographic order equals
  chronological order — that property is what lets every window check use a
  plain `<` / `>` instead of parsing back to dates.
- The engine takes no clock: `today` is a parameter, so the whole thing is pure
  and testable without mocks.
- `shared/data-table.tsx` cannot render grouped rows. Follow
  `hrms/payslip-management-tab.tsx` — hand-rolled table, `Set<string>`
  expansion, group header as a clickable `<tr>` with `colSpan`.

## Reference

`apps/api/src/modules/it-billing/it-billing-monthly.ts`,
`apps/api/src/modules/it-billing/it-billing.repository.ts`,
`apps/web/src/components/it/it-billing-monthly-tab.tsx`, CLAUDE.md's
"Spend time series over rows that span months" pattern entry.
