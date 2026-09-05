import { BadRequestException } from "../http-exception";
import { Decimal, D } from "./money-decimal";

export interface PostingLine {
  accountId: string;
  debit?: number | string | Decimal;
  credit?: number | string | Decimal;
  memo?: string | null;
}

export interface NormalizedLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  memo: string | null;
}

export function normalizeLines(lines: PostingLine[]): NormalizedLine[] {
  return lines
    .map((l) => ({
      accountId: l.accountId,
      debit: new D(l.debit ?? 0),
      credit: new D(l.credit ?? 0),
      memo: l.memo ?? null,
    }))
    .filter((l) => !(l.debit.isZero() && l.credit.isZero()));
}

export function computeEntryTotals(lines: NormalizedLine[]): {
  totalDebit: Decimal;
  totalCredit: Decimal;
} {
  const totalDebit = lines.reduce((s, l) => s.plus(l.debit), new D(0));
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new D(0));
  return { totalDebit, totalCredit };
}

export function assertBalanced(lines: NormalizedLine[]): {
  totalDebit: Decimal;
  totalCredit: Decimal;
} {
  if (lines.length === 0) {
    throw new BadRequestException("Journal entry has no non-zero lines");
  }
  const totals = computeEntryTotals(lines);
  if (!totals.totalDebit.equals(totals.totalCredit)) {
    throw new BadRequestException(
      `Unbalanced journal entry: debit ${totals.totalDebit.toFixed(2)} ` +
        `≠ credit ${totals.totalCredit.toFixed(2)}`,
    );
  }
  return totals;
}

export function decorateJournalTotals<
  T extends { lines: Array<{ debit: string | number; credit: string | number }> },
>(j: T): T & { totalDebit: string; totalCredit: string } {
  const zero = new D(0);
  const totalDebit = j.lines.reduce((acc, l) => acc.plus(l.debit), zero);
  const totalCredit = j.lines.reduce((acc, l) => acc.plus(l.credit), zero);
  return {
    ...j,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
  };
}
