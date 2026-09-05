import { describe, expect, it } from "vitest";

import { planOrderCompaction } from "@/modules/expenses/expense-approval-order";

/**
 * Regression guard for the "1, 3, 4" Order column.
 *
 * `ExpenseApprovalStep.order` is `Int @unique` and is rendered directly in the
 * admin chain page's Order column. Deleting a step did not renumber the
 * survivors, so removing step 2 of four left the stored orders as 1, 3, 4 and
 * the page showed exactly that. Sequencing was unaffected (the chain compares
 * steps relative to each other), which is why it went unnoticed.
 */
describe("planOrderCompaction", () => {
  it("packs a gap left by a deleted middle step into 1..N", () => {
    // The state from the reported screenshot: step 2 was deleted.
    const plan = planOrderCompaction([
      { id: "first", order: 1 },
      { id: "payroll-filled", order: 3 },
      { id: "final-signoff", order: 4 },
    ]);

    expect(plan).toEqual([
      { id: "first", order: 1 },
      { id: "payroll-filled", order: 2 },
      { id: "final-signoff", order: 3 },
    ]);
  });

  it("returns null when the rows are already 1..N, so no write happens", () => {
    // Deleting the LAST step leaves no gap. The caller relies on null to skip
    // both update loops entirely rather than issuing pointless writes.
    expect(
      planOrderCompaction([
        { id: "a", order: 1 },
        { id: "b", order: 2 },
      ]),
    ).toBeNull();
  });

  it("preserves relative sequence rather than input order", () => {
    const plan = planOrderCompaction([
      { id: "last", order: 9 },
      { id: "middle", order: 5 },
      { id: "first", order: 2 },
    ]);

    expect(plan?.map((p) => p.id)).toEqual(["first", "middle", "last"]);
    expect(plan?.map((p) => p.order)).toEqual([1, 2, 3]);
  });

  it("handles the chain being emptied", () => {
    expect(planOrderCompaction([])).toBeNull();
  });

  it("compacts a single surviving step that was not first", () => {
    // Deleting steps 1 and 2 of three leaves one row holding order 3.
    expect(planOrderCompaction([{ id: "only", order: 3 }])).toEqual([
      { id: "only", order: 1 },
    ]);
  });

  it("does not mutate its input", () => {
    const rows = [
      { id: "b", order: 4 },
      { id: "a", order: 1 },
    ];
    planOrderCompaction(rows);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
