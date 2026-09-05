---
type: Playbook
title: Importing a hand-maintained purchase log
description: Loading a human-maintained fixed-asset spreadsheet into assets — day-first dates, baht money strings, a match key that does not duplicate the sheet, and the importer that accepted numeric columns and dropped them.
tags: [backend, frontend, import, database]
status: stable
verified:
  - at: 2026-08-28
    by: kunanon-ui
stale_after: 2027-02-28
---

# Importing a hand-maintained purchase log

Use this when loading a spreadsheet a human maintains — a fixed-asset log, a
purchase register — as opposed to a template your own system emitted. Every trap
below produces plausible wrong data rather than an error, which is what makes
them expensive. Reference: `apps/web/src/components/office/asset-inventory-mapping.ts`
and the Office asset importer.

## Steps

### 1. Never let `Date` parse a day-first date

`new Date("20-03-2024")` is an **Invalid Date**, and `new Date("11-09-2024")` is
**9 November** under the US month-first reading. A DD-MM-YYYY sheet therefore
yields `null` for most rows and a silently wrong month for exactly the rows where
the two readings differ — the ones you cannot spot by eye.

Assert the format in a tested parser (`parseDayFirstDate`) rather than inferring
it per row: inference makes the same file parse differently as its data changes.
Reject impossible dates explicitly, because `Date.UTC(2024, 1, 31)` rolls
31 February into 2 March instead of failing. Accept Excel serials and ISO strings
too — a hand-maintained date column is usually a mix of all three.

### 2. Money arrives as a string that `Number()` turns into NaN

`Number("฿17,990.00")` is `NaN`, so a price becomes silently absent rather than
loudly wrong. Strip the currency symbol, digit-group separators, and NBSP / thin
space (pastes carry them) — the `coerceNumber` convention. Write those whitespace
characters as ` `-style escapes, or `no-irregular-whitespace` fails lint.

### 3. A match key of "serial number" duplicates the whole sheet

Furniture has no serial number, and if `assetCode` is *derived* from the serial it
has no code either — so a serial-only match key means every re-import inserts a
second copy of every row. Match in descending order of how much the key promises:

1. an explicit `assetCode` (a register identity a human assigned),
2. `serialNo` (the manufacturer's),
3. `(officeId, name, purchaseDate)` — a heuristic, hence last.

`(office, name)` without a date is **not** a key: two identical chairs bought on
different days are two assets, and collapsing them overwrites the first. Keep a
per-file `seenKeys` set as well, so two rows colliding inside ONE file both
insert rather than the second updating what the first just created.

### 4. Check that the bulk path actually persists what the schema accepts

The Office importer's `assetImportRowSchema` had no price, date or quantity
while `createAssetSchema` had them all, so a purchase log passed validation and arrived
as bare names with every number discarded. Grep the commit path for each field
before trusting it.

Store the **unit** price with `quantity` beside it, so `quantity × unitPrice`
reproduces the sheet's own total. That identity is the only per-row proof the
import is correct — report rows that fail it rather than loading them quietly.

### 5. State the parent, do not infer it

Office resolution defaulted to the assignee's entity country and then "the first
active office". Correct for an IT hand-out sheet; silently wrong for a purchase
log where no row has an assignee. Take the target explicitly, find-by-name before
create so committing twice makes one office, and never create from the **preview**
path — an abandoned dialog must leave nothing behind.

## Related

- [xlsx imports](/patterns/xlsx-imports.md) — the `coerceNumber` and grouped-header rules this builds on.
- [Paginated aggregates](/pitfalls/paginated-aggregates.md) — why a preview total must not come from one page.

## Why

A template your system emitted can be trusted about shape. A sheet a person
maintains cannot: columns move, the header is not row 1, padding rows accumulate
below the data, and its own totals go stale. Header-driven mapping plus a
cross-foot check is what turns "it imported" into "it imported correctly".

## Reference

`apps/web/src/components/office/asset-inventory-mapping.ts`,
`apps/api/src/modules/office/office.service.ts` (`naturalAssetKey`,
`resolveImportOffice`, `commitAssetImport`), CLAUDE.md's "Importing a
hand-maintained purchase log" pattern entry.
