// Pure roll-up for the Expense workspace's header: a period's total AP spend and
// its breakdown by "category" (the bill's category GL account). DB-free +
// unit-tested. A bill with no category account lands in an "Uncategorized"
// bucket keyed by null.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface BillForSummary {
  // Base-currency net (subtotal) of the bill.
  amount: number;
  categoryAccountId: string | null;
  categoryLabel: string | null; // "code — name", or null when uncategorized
}

export interface CategoryBucket {
  accountId: string | null;
  label: string;
  total: number;
}

export interface ExpenseSummary {
  total: number;
  byCategory: CategoryBucket[];
}

export function summarizeExpenses(bills: BillForSummary[]): ExpenseSummary {
  const buckets = new Map<string, CategoryBucket>();
  for (const bill of bills) {
    const key = bill.categoryAccountId ?? "__uncategorized__";
    const existing = buckets.get(key);
    if (existing) {
      existing.total = round2(existing.total + bill.amount);
    } else {
      buckets.set(key, {
        accountId: bill.categoryAccountId,
        label: bill.categoryLabel ?? "Uncategorized",
        total: round2(bill.amount),
      });
    }
  }
  const byCategory = [...buckets.values()].sort((a, b) => b.total - a.total);
  return {
    total: round2(byCategory.reduce((s, b) => s + b.total, 0)),
    byCategory,
  };
}
