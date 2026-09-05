import { type Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  firstOpenPeriodStart,
  isPostingPeriodClosed,
} from "@/modules/accounting/accounting.locks";

function makeTx(closed: Set<string>) {
  const tx = {
    fiscalPeriod: {
      findUnique: async ({
        where: {
          entityId_year_month: { year, month },
        },
      }: {
        where: {
          entityId_year_month: {
            entityId: string;
            year: number;
            month: number;
          };
        };
      }) =>
        closed.has(`${year}-${String(month).padStart(2, "0")}`)
          ? { status: "closed" }
          : null,
    },
  } as unknown as Prisma.TransactionClient;
  return tx;
}

describe("firstOpenPeriodStart", () => {
  it("returns the first day of today when the month is open", async () => {
    const tx = makeTx(new Set());
    const from = new Date("2026-08-19T12:00:00.000Z");
    await expect(firstOpenPeriodStart(tx, "ent-1", from)).resolves.toEqual(
      new Date("2026-08-01T00:00:00.000Z"),
    );
  });

  it("walks to the next open month when the current month is closed", async () => {
    const tx = makeTx(new Set(["2026-07", "2026-08"]));
    const from = new Date("2026-07-31T00:00:00.000Z");
    await expect(firstOpenPeriodStart(tx, "ent-1", from)).resolves.toEqual(
      new Date("2026-09-01T00:00:00.000Z"),
    );
  });
});

describe("isPostingPeriodClosed", () => {
  it("is open when no fiscal_periods row exists", async () => {
    const tx = makeTx(new Set());
    await expect(
      isPostingPeriodClosed(tx, "ent-1", new Date("2026-08-01")),
    ).resolves.toBe(false);
  });

  it("is closed when the month row is closed", async () => {
    const tx = makeTx(new Set(["2026-07"]));
    await expect(
      isPostingPeriodClosed(tx, "ent-1", new Date("2026-07-15T00:00:00.000Z")),
    ).resolves.toBe(true);
  });
});
