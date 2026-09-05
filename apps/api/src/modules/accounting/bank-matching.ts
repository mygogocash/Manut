// Pure bank-statement ↔ open-document matcher (DB-free, unit-tested).
//
// The PRD's rule: a new bank line auto-matches an open bill/invoice when the
// AMOUNT is exact and the DATE is within a small window. Direction picks the
// side — money in settles a receivable (a customer paid us), money out settles
// a payable (we paid a bill). Only a SINGLE candidate auto-matches; a lump line
// covering several bills (or an ambiguous amount) is left for the user to
// allocate manually, and a line with no candidate needs a Journal Entry.

export interface MatchDoc {
  invoiceId: string;
  invoiceNo: string;
  type: string; // "receivable" | "payable"
  outstanding: number; // amount − amountPaid, base currency
  date: string; // due date, YYYY-MM-DD
  counterparty: string;
}

export interface MatchInput {
  amount: number;
  date: string; // YYYY-MM-DD
  direction: "in" | "out" | null;
}

export interface MatchResult {
  matched: MatchDoc | null;
  candidates: MatchDoc[];
}

const AMOUNT_EPSILON = 0.01;

export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// The direction → document-type the line can settle. Null direction (legacy
// imported rows) matches either side by amount alone.
export function wantedTypeFor(direction: "in" | "out" | null): string | null {
  if (direction === "in") return "receivable";
  if (direction === "out") return "payable";
  return null;
}

export function matchBankTransaction(
  txn: MatchInput,
  openDocs: MatchDoc[],
  windowDays: number,
): MatchResult {
  const wantType = wantedTypeFor(txn.direction);
  const candidates = openDocs.filter(
    (doc) =>
      (wantType === null || doc.type === wantType) &&
      Math.abs(doc.outstanding - txn.amount) < AMOUNT_EPSILON &&
      Math.abs(daysBetween(doc.date, txn.date)) <= windowDays,
  );
  return {
    matched: candidates.length === 1 ? candidates[0]! : null,
    candidates,
  };
}
