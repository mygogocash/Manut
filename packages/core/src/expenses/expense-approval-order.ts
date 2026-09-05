/**
 * Order compaction for the expense approval chain.
 *
 * `ExpenseApprovalStep.order` is `Int @unique` and is what the admin UI shows
 * in its Order column (and lets an admin type into). Deleting a step used to
 * leave a hole — remove step 2 of four and the page renders "1, 3, 4" — because
 * nothing renumbered the survivors. Sequencing kept working, since the chain
 * only ever compares steps relative to each other, which is exactly why the
 * bug survived: the only symptom was a page that looked broken.
 *
 * Pure on purpose. The `@unique` two-phase dance belongs to the repository;
 * deciding *whether* a renumber is needed and *what* the targets are is
 * arithmetic, and arithmetic should be unit-testable without a database.
 */

export interface OrderedRow {
  id: string;
  order: number;
}

export interface OrderAssignment {
  id: string;
  order: number;
}

/**
 * Given the surviving rows (any order), return the assignment that packs them
 * into 1..N preserving their relative sequence — or `null` when they are
 * already exactly 1..N and no write is needed.
 *
 * Returning `null` rather than a no-op list matters: the caller skips the
 * transaction's two update loops entirely on the common path, where a delete
 * removed the last step and nothing shifted.
 */
export function planOrderCompaction(
  rows: OrderedRow[],
): OrderAssignment[] | null {
  const sorted = [...rows].sort((a, b) => a.order - b.order);

  const alreadyCompact = sorted.every((row, i) => row.order === i + 1);
  if (alreadyCompact) return null;

  return sorted.map((row, i) => ({ id: row.id, order: i + 1 }));
}

/**
 * The parking offset used to dodge the `@unique(order)` constraint while
 * shifting rows down. Any value above the highest real order works; it is
 * shared with `reorderApprovalSteps` so both paths behave identically.
 */
export const ORDER_PARK_OFFSET = 10000;
