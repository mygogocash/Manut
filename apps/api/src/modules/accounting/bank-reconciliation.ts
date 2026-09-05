// Bank-reconciliation summary + closing-figure check (M7). Pure + DB-free so
// the arithmetic is unit-tested and reproducible from the transaction rows.
//
// A statement is "reconciled" when every imported line has been matched to a
// book entry AND the book balance ties to the statement's closing figure. This
// module computes that comparison; the service marks individual rows and the
// posting engine consults `paymentReconciled` (accounting.locks) to block
// voiding cash that has already been reconciled.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ReconTxn {
  amount: number;
  // 'in' (money received) | 'out' (money paid) | null for legacy imported
  // rows, where `amount` is taken as already-signed.
  direction?: string | null;
  reconciled: boolean;
}

// Signed movement: an explicit direction wins (out → negative, in → positive);
// otherwise the stored amount is assumed already-signed.
function signed(t: ReconTxn): number {
  if (t.direction === "out") return -Math.abs(t.amount);
  if (t.direction === "in") return Math.abs(t.amount);
  return t.amount;
}

const sum = (ns: number[]): number => round2(ns.reduce((s, n) => s + n, 0));

export interface ReconSummary {
  transactionCount: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledAmount: number; // Σ signed movement of reconciled rows
  unreconciledAmount: number; // Σ signed movement of un-reconciled rows
  bookBalance: number; // Σ signed movement of ALL rows
  statementBalance: number | null;
  difference: number | null; // statementBalance − bookBalance (null if no stmt)
  // True only when a statement figure was supplied, the book ties to it, and
  // nothing is left un-reconciled — i.e. the account is fully reconciled.
  balanced: boolean;
}

const TOLERANCE = 0.01;

export function summarizeReconciliation(
  txns: ReconTxn[],
  statementBalance: number | null = null,
): ReconSummary {
  const reconciled = txns.filter((t) => t.reconciled);
  const unreconciled = txns.filter((t) => !t.reconciled);
  const bookBalance = sum(txns.map(signed));
  const difference =
    statementBalance === null ? null : round2(statementBalance - bookBalance);
  return {
    transactionCount: txns.length,
    reconciledCount: reconciled.length,
    unreconciledCount: unreconciled.length,
    reconciledAmount: sum(reconciled.map(signed)),
    unreconciledAmount: sum(unreconciled.map(signed)),
    bookBalance,
    statementBalance,
    difference,
    balanced:
      difference !== null &&
      Math.abs(difference) < TOLERANCE &&
      unreconciled.length === 0,
  };
}
