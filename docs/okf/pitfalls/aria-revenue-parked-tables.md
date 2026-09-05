---
type: Pitfall
title: ARIA Revenue parked tables
description: The retired ARIA Revenue CRM's revenue_* tables still exist as the migration's rollback net — don't code against them, and don't let the unit-delete strip stop maintaining them.
tags: [backend, database, crm]
status: stable
verified:
  - at: 2026-08-26
    by: kunanon-ui
stale_after: 2027-02-26
---

# ARIA Revenue parked tables

## Rule

The ARIA Revenue CRM was retired on 2026-08-26. Its 15 deals migrated onto the
Sales CRM board tagged `aria`; its web pages, API mounts and reminder-cron
scans were deleted. The 11 `Revenue*` Prisma models, their `revenue_*` tables
and the `sales-revenue:*` permission seeds were deliberately KEPT as the data
rollback net until a later cleanup PR drops them.

Two obligations follow:

1. **Don't add new code against `Revenue*` models.** Revive the module or drop
   the tables instead — parked means frozen.
2. **Don't remove `business-units/revenue-rollup.repository.ts`.** It is the
   ONE live write path into the parked tables: `businessUnitService.delete`
   strips a deleted unit's code from every `business_units` column, revenue
   tables included, and each stripped deal must be re-derived afterwards.
   Parked data that a unit-delete leaves internally inconsistent is worthless
   as a rollback target.

## Why

The migration ran through the authenticated API, not a Prisma data migration —
staging syncs schema with `db push`, so data SQL inside a migration never
executes there and could not have been rehearsed. Keeping the source tables
untouched is what makes the move reversible.

## How to recognise the edges

- `db:generate` still emits the `Revenue*` models even though no module mounts
  them — that is expected, not dead-code to clean up.
- Old bookmarks work: `next.config.ts` redirects `/sales-revenue/:path*` to
  `/sales?tab=pipeline&bu=aria`, where the data now lives.
- Migrated deals carry `legacyDealId` = the old `revenue_opportunities.id`.
  The column is DB-unique, so re-running the migration fails loudly on the
  constraint instead of duplicating deals — and the value is the join key back
  to the parked row if a dispute ever needs the original.
- Deleting the `aria` row in Manage business units would `array_remove` the
  tag from every migrated deal and delete their child rows. The row is
  deliberately not `isSystem`, so nothing blocks that — treat it as the one
  catalog row an admin must not delete casually.

## Reference

`apps/api/src/modules/business-units/revenue-rollup.repository.ts`,
`packages/database/prisma/schema/sales-revenue-crm.prisma`, CLAUDE.md's
"ARIA Revenue CRM is RETIRED" pitfall entry.
