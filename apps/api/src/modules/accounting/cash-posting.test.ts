import { type Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  postMoneyEvent,
  signedBankDelta,
} from "@/modules/accounting/cash-posting.service";

describe("signedBankDelta", () => {
  it("increments on money in, decrements on money out", () => {
    expect(signedBankDelta(100, "in").toString()).toBe("100");
    expect(signedBankDelta(100, "out").toString()).toBe("-100");
  });

  it("uses magnitude regardless of the input sign", () => {
    expect(signedBankDelta(-100, "in").toString()).toBe("100");
    expect(signedBankDelta("100", "out").toString()).toBe("-100");
  });
});

// A minimal in-memory Prisma transaction client that records the writes
// postMoneyEvent performs, so the wiring (one JE + one bank txn per movement,
// correct sign) can be asserted without a database.
function makeFakeTx() {
  const calls = {
    je: [] as Prisma.JournalEntryCreateInput[],
    coaUpdates: [] as { increment: Prisma.Decimal }[],
    bankUpdates: [] as { increment: Prisma.Decimal }[],
    bankTx: [] as Record<string, unknown>[],
    bankTxUpdates: [] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }[],
  };
  const tx = {
    documentSequence: {
      // Fake tx: findFirst/findUnique miss, upsert returns a one-shot JE- row.
      // The allocator now monthly-resets statutory types; this stub still
      // returns the untokenised prefix so the cash-posting wiring assertions
      // stay on the JE number the bank txn copies.
      findFirst: async () => null,
      findUnique: async () => null,
      upsert: async () => ({ prefix: "JE-", nextNumber: 2, padWidth: 6 }),
    },
    journalEntry: {
      create: async ({ data }: { data: Prisma.JournalEntryCreateInput }) => {
        calls.je.push(data);
        return { id: "je-1", entryNo: (data as { entryNo: string }).entryNo };
      },
    },
    chartOfAccount: {
      update: async ({
        data,
      }: {
        data: { balance: { increment: Prisma.Decimal } };
      }) => {
        calls.coaUpdates.push(data.balance);
      },
    },
    bankAccount: {
      update: async ({
        data,
      }: {
        data: { currentBalance: { increment: Prisma.Decimal } };
      }) => {
        calls.bankUpdates.push(data.currentBalance);
      },
    },
    bankTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.bankTx.push(data);
      },
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        calls.bankTxUpdates.push({ where, data });
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

describe("postMoneyEvent", () => {
  const posting = {
    entityId: "ent-1",
    date: new Date("2026-07-01"),
    sourceType: "test",
    sourceRef: "T-1",
    createdBy: "user-1",
    lines: [
      { accountId: "bank-gl", debit: 100 },
      { accountId: "ar-control", credit: 100 },
    ],
  };

  it("posts exactly one balanced journal entry", async () => {
    const { tx, calls } = makeFakeTx();
    const entry = await postMoneyEvent(tx, { posting });
    expect(calls.je).toHaveLength(1);
    expect(entry.entryNo).toBe("JE-000001");
  });

  it("writes one bank transaction per movement and moves the balance the right way", async () => {
    const { tx, calls } = makeFakeTx();
    await postMoneyEvent(tx, {
      posting,
      bankMovements: [
        {
          entityId: "ent-1",
          bankAccountId: "bank-1",
          amount: 100,
          direction: "in",
          date: new Date("2026-07-01"),
          description: "Cash received",
          source: "payment",
          paymentId: "pay-1",
        },
      ],
    });
    expect(calls.bankTx).toHaveLength(1);
    expect(calls.bankTx[0].direction).toBe("in");
    expect(calls.bankTx[0].paymentId).toBe("pay-1");
    expect(calls.bankTx[0].jeRef).toBe("JE-000001"); // defaulted from the entry
    expect(calls.bankUpdates[0].increment.toString()).toBe("100");
  });

  it("moves cash out (negative delta) for an outbound movement", async () => {
    const { tx, calls } = makeFakeTx();
    await postMoneyEvent(tx, {
      posting,
      bankMovements: [
        {
          entityId: "ent-1",
          bankAccountId: "bank-1",
          amount: 100,
          direction: "out",
          date: new Date("2026-07-01"),
          description: "Cash paid",
          source: "payment",
        },
      ],
    });
    expect(calls.bankUpdates[0].increment.toString()).toBe("-100");
  });

  it("adopts an imported bank line (updates it, no new row) but still moves the balance", async () => {
    const { tx, calls } = makeFakeTx();
    await postMoneyEvent(tx, {
      posting,
      bankMovements: [
        {
          entityId: "ent-1",
          bankAccountId: "bank-1",
          amount: 100,
          direction: "out",
          date: new Date("2026-07-01"),
          description: "Bill payment",
          source: "payment",
          paymentId: "pay-9",
          bankTransactionId: "imported-tx-1",
        },
      ],
    });
    // No duplicate register row — the imported line is reused, so the recon
    // summary (which sums every row) can't double-count this cash line.
    expect(calls.bankTx).toHaveLength(0);
    expect(calls.bankTxUpdates).toHaveLength(1);
    expect(calls.bankTxUpdates[0].where).toEqual({ id: "imported-tx-1" });
    expect(calls.bankTxUpdates[0].data).toMatchObject({
      status: "matched",
      paymentId: "pay-9",
      direction: "out",
      bankAccountId: "bank-1",
      jeRef: "JE-000001",
    });
    // The payment is the cash event, so the balance still moves.
    expect(calls.bankUpdates[0].increment.toString()).toBe("-100");
  });
});
