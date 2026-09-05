import { Prisma } from "@nexora/database";

import {
  postBalancedEntry,
  type PostedEntry,
  type PostingRequest,
} from "@/modules/accounting/gl-posting.service";

// Cash-integrity primitive.
//
// postMoneyEvent is the ONE path that both posts a journal entry AND moves
// cash, and applyBankMovement is the ONLY writer of BankAccount.currentBalance.
// Because a single money event books its GL entry, moves the bank account's
// running balance, and writes exactly one BankTransaction inside the caller's
// transaction, the three representations of cash — the GL cash account, the
// BankAccount.currentBalance, and the BankTransaction register — can never
// drift apart. No other code may bump currentBalance directly.

const D = Prisma.Decimal;

export interface BankMovement {
  entityId: string;
  bankAccountId: string;
  // Magnitude only; sign comes from `direction`.
  amount: Prisma.Decimal | number | string;
  direction: "in" | "out";
  date: Date;
  description: string;
  // Provenance stored on the BankTransaction row ('payment' | 'manual' | …).
  source: string;
  paymentId?: string | null;
  jeRef?: string | null;
  // Bank reconciliation: when this movement settles an already-imported
  // statement line, its id goes here. applyBankMovement then ADOPTS that row
  // (stamps it matched + linked) instead of writing a second register row —
  // the imported line already represents this real-world cash line, so a fresh
  // create would double-count it in the reconciliation summary. The balance is
  // still incremented (an imported line never moved currentBalance).
  bankTransactionId?: string | null;
}

// Signed change to currentBalance for a movement: money 'in' increases the
// balance, 'out' decreases it. Pure so the sign rule is unit-testable.
export function signedBankDelta(
  amount: Prisma.Decimal | number | string,
  direction: "in" | "out",
): Prisma.Decimal {
  const magnitude = new D(amount).abs();
  return direction === "in" ? magnitude : magnitude.negated();
}

// Move one bank account's currentBalance and write the matching, back-linked
// BankTransaction. MUST run inside the caller's transaction.
export async function applyBankMovement(
  tx: Prisma.TransactionClient,
  m: BankMovement,
): Promise<void> {
  await tx.bankAccount.update({
    where: { id: m.bankAccountId },
    data: {
      currentBalance: { increment: signedBankDelta(m.amount, m.direction) },
    },
  });
  if (m.bankTransactionId) {
    // Adopt an imported statement line as this movement's register row. Keep
    // its bank-truth fields (amount/date/description/balance) untouched; only
    // stamp the link + the account/direction the settlement moved through.
    await tx.bankTransaction.update({
      where: { id: m.bankTransactionId },
      data: {
        bankAccountId: m.bankAccountId,
        direction: m.direction,
        status: "matched",
        source: m.source,
        paymentId: m.paymentId ?? null,
        jeRef: m.jeRef ?? null,
      },
    });
    return;
  }
  await tx.bankTransaction.create({
    data: {
      entityId: m.entityId,
      bankAccountId: m.bankAccountId,
      date: m.date,
      description: m.description,
      amount: new D(m.amount).abs(),
      direction: m.direction,
      status: "matched",
      reconciled: false,
      source: m.source,
      paymentId: m.paymentId ?? null,
      jeRef: m.jeRef ?? null,
    },
  });
}

// Post a balanced journal entry and apply any bank movements it caused, atomically.
export async function postMoneyEvent(
  tx: Prisma.TransactionClient,
  args: { posting: PostingRequest; bankMovements?: BankMovement[] },
): Promise<PostedEntry> {
  const entry = await postBalancedEntry(tx, args.posting);
  for (const movement of args.bankMovements ?? []) {
    await applyBankMovement(tx, {
      ...movement,
      jeRef: movement.jeRef ?? entry.entryNo,
    });
  }
  return entry;
}
