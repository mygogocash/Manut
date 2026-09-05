import type { Prisma } from "@nexora/database";

import { BadRequestException } from "@/common/exceptions/http-exception";

// Lock / period guards for the posting and payment paths.
//
// The fiscal-period guard and the payment-reconciliation guard are live. The
// per-account statement-period lock (`isTxnInReconciledPeriod`) stays fail-open
// until bank transactions are consistently linked to a BankAccount + statement
// period — wiring it early can never block a flow that already works.

// Reject a posting dated into a closed fiscal period. Default-open: a month with
// no fiscal_periods row (or a non-"closed" row) is open, so nothing is blocked
// until an admin explicitly closes the month.
export function utcYearMonth(date: Date): { year: number; month: number } {
  const d = new Date(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function firstDayOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export async function isPostingPeriodClosed(
  tx: Prisma.TransactionClient,
  entityId: string,
  date: Date,
): Promise<boolean> {
  const { year, month } = utcYearMonth(date);
  const period = await tx.fiscalPeriod.findUnique({
    where: { entityId_year_month: { entityId, year, month } },
    select: { status: true },
  });
  return period?.status === "closed";
}

export async function assertPostingPeriodOpen(
  tx: Prisma.TransactionClient,
  entityId: string,
  date: Date,
): Promise<void> {
  const { year, month } = utcYearMonth(date);
  const closed = await isPostingPeriodClosed(tx, entityId, date);
  if (closed) {
    throw new BadRequestException(
      `Fiscal period ${year}-${String(month).padStart(2, "0")} is closed; ` +
        `postings dated into it are not allowed.`,
    );
  }
}

// Locked decision 2: reversing JE date defaults to the first day of the
// current open period (today's month if open, else the next open month).
export async function firstOpenPeriodStart(
  tx: Prisma.TransactionClient,
  entityId: string,
  fromDate: Date = new Date(),
): Promise<Date> {
  let { year, month } = utcYearMonth(fromDate);
  for (let i = 0; i < 24; i++) {
    const closed = await isPostingPeriodClosed(
      tx,
      entityId,
      firstDayOfUtcMonth(year, month),
    );
    if (!closed) return firstDayOfUtcMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  throw new BadRequestException(
    "No open fiscal period found in the next 24 months; open a period before reversing.",
  );
}

// True once a bank account's period covering `date` has been reconciled+locked.
export function isTxnInReconciledPeriod(
  _tx: Prisma.TransactionClient,
  _bankAccountId: string,
  _date: Date,
): Promise<boolean> {
  return Promise.resolve(false);
}

// True once a payment's bank movement has been reconciled, so its void must be
// blocked (reconciled cash is not silently unwound). Reads the bank transaction
// the payment wrote (`recordPayment` stamps `paymentId`).
export async function paymentReconciled(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<boolean> {
  const hit = await tx.bankTransaction.findFirst({
    where: { paymentId, reconciled: true },
    select: { id: true },
  });
  return hit !== null;
}
