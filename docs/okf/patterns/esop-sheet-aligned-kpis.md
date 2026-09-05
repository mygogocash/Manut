---
type: Playbook
title: ESOP sheet-aligned KPIs
description: Compute the four ESOP pool KPI cards with `rollupGrants()` so they mirror the HR spreadsheet's definitions exactly, rather than re-deriving them ad hoc.
tags: [backend, hr, esop]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# ESOP sheet-aligned KPIs

`hrms` ESOP.

## Shape

The four pool cards mirror the HR spreadsheet exactly; compute them with
`rollupGrants()` in `esop-vesting.ts`, never re-derive ad hoc.

Definitions over `EsopGrant` rows:

- **Grand Total** = Σ all `shares`.
- **Vesting** = Σ `shares` of *scheduled* grants (`vestingMonths > 0`).
- **Vested** = Σ `shares` of *unscheduled* grants (`vestingMonths ≤ 0`, i.e.
  granted outright).
- **Total Vesting to date** = Σ `vestedSharesToDate(grant, now)` of the
  scheduled grants only.

So Vesting + Vested = Grand Total, and "to date" is a subset of Vesting.

Pool summary `GET /esop-pool` and per-employee `GET
/esop-grants/by-employee/:employeeId` (page `/hrms/esop/[employeeId]`) both
gate on `hrms:esop-manage`.

## Reference

`rollupGrants()` in `esop-vesting.ts`; `GET /esop-pool`; `GET
/esop-grants/by-employee/:employeeId`.
