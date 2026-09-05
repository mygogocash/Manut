---
type: Playbook
title: Multi-value tag column + admin-editable list, shared by two modules
description: Give records a filterable, extensible "who owns this" tag via a text[] column plus a code-keyed lookup with no FK, served by one module for both CRMs.
tags: [backend, frontend, config, database]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# Multi-value tag column + admin-editable list, shared by two modules

Sales CRM / Sales Revenue CRM business units — Onewave / Onewave Revenue /
ARIA. Use this when records need "who is taking care of this" as a
**filterable, extensible** tag rather than a hardcoded enum or a nav split.

## Steps

1. `businessUnits String[] @default([]) @map("business_units")` on each
   record table (Postgres `text[]`, DDL
   `ADD COLUMN IF NOT EXISTS … TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`),
   plus a `crm_business_units` lookup shaped exactly like `LostReason`
   (code/label/color/isSystem/isActive/sortOrder) and **no FK** — records
   hold the code as an open string.
2. Filter with `{ has: code }`, and a reserved `"__none__"` sentinel →
   `{ isEmpty: true }` for the Unassigned view. Codes cannot contain
   underscores, so the sentinel can never collide with a real code.
3. **One module for both CRMs** (`/api/business-units`) — a company-level
   list is not a per-CRM lookup. `requirePermission` takes an OR list, so
   read is `crm:read`|`sales-revenue:read` and write
   `crm:admin`|`sales-revenue:admin`. Only the record columns and `where`
   builders get mirrored into `revenue-*`.
4. With no FK, **delete must strip the code** from every record table in one
   transaction (`array_remove`, table names from a module-level literal, code
   bound as `$1`) — otherwise chips render orphaned raw codes forever. Offer
   `isActive` as the keep-the-history alternative and say so in the confirm
   dialog.
5. Chip colour is stored as a shared **Badge variant NAME** (`blue`/`teal`/…),
   never a Tailwind class, so it resolves through Badge's literal
   `VARIANT_STYLES` map and survives the static scan.
6. Seed rows `isSystem: false` when the ask includes removing them —
   `isSystem` blocks delete.

## Related

The lookup table is shaped like a
[/patterns/configurable-list.md](/patterns/configurable-list.md); the
difference is the multi-value `text[]` column and the absence of a FK.

## Reference

`apps/api/src/modules/business-units/`,
`apps/web/src/hooks/use-business-units.ts`, `business-unit-chips.tsx`.
