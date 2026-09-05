---
type: Pitfall
title: Approval-step order gaps
description: Deleting an approval step left a hole in the `@unique` `order` column, so the admin chain page rendered "1, 3, 4". Nothing functional broke, which is why it survived — sequencing only ever compares steps relative to each other.
tags: [backend, workflow, ui]
status: stable
verified:
  - at: 2026-08-27
    by: kunanon-ui
stale_after: 2027-02-27
---

# Approval-step order gaps

## Rule

Compact an ordered config table's `order` on **delete**, not only on reorder,
and park before packing whenever the column is `@unique`. A reorder-only
implementation is correct right up to the first deletion.

## Why

`ExpenseApprovalStep.order` is `Int @unique` and is rendered **directly** in the
Expense Approval Chain admin page's Order column, where it is also editable.

`reorderApprovalSteps` correctly writes `1..N`. `deleteApprovalStep` did not —
it issued the DELETE and never renumbered the survivors. Remove step 2 of four
and the stored orders stay `1, 3, 4`, which is exactly what the page displayed.

### Why it survived so long

**Nothing functional broke.** The chain only ever compares steps *relative* to
each other, so a gapped sequence routes identically to a packed one. The only
symptoms were a page that looked broken and Order numbers that no longer matched
what an admin would type into the box.

That is the general lesson: an ordering column that is both `@unique` and
user-visible has two contracts, and only one of them fails loudly.

## The fix, and why it is two-phase

`deleteApprovalStep` now compacts the survivors inside the same `$transaction`
as the delete, so no reader observes the gap.

Both the delete and the reorder park every row above the real range first
(`ORDER_PARK_OFFSET + i`), then write the final `i + 1`. One pass is not enough:
`order` is `@unique` and non-deferrable, so shifting `3 → 2` while another row
still holds `2` collides mid-loop.

The arithmetic — *whether* a renumber is needed and what the targets are — lives
in a pure `planOrderCompaction` helper so it is unit-testable without a
database. The constraint dance stays in the repository.

## If you add another ordered config table

- Compact on delete, not just on reorder. A reorder-only implementation is
  correct right up to the first deletion.
- Park before packing, whenever the column is `@unique`.
- Decide whether the column is presentation or identity. If the UI shows it, a
  gap is a bug even when routing is unaffected.
- A code fix only helps future deletes. Rows already carrying a gap need a
  catch-up migration — and it must be idempotent, parking at a different offset
  from the runtime path so it cannot collide with a concurrent reorder.

Reference: `apps/api/src/modules/expenses/expense-approval-order.ts`,
`deleteApprovalStep` in `apps/api/src/modules/expenses/expenses.repository.ts`,
migration `20261228000000_compact_expense_approval_step_order`.

## Related

- [/patterns/submitter-conditional-routing.md](/patterns/submitter-conditional-routing.md) — configuring the chain these steps belong to
- [/patterns/configurable-list.md](/patterns/configurable-list.md) — the two-phase reorder this mirrors
