import { Prisma } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import {
  resolveAccountingFx,
  syncAccountingFxRates,
} from "@/modules/accounting/accounting-fx.service";

describe("resolveAccountingFx", () => {
  const day = new Date("2026-08-19T00:00:00.000Z");

  it("returns buying vs selling from the same row", async () => {
    const row = {
      buyingRate: new Prisma.Decimal(32.1),
      sellingRate: new Prisma.Decimal(32.4),
      effectiveDate: day,
    };
    const buying = await resolveAccountingFx("usd", day, "buying", {
      findRate: async () => row,
    });
    const selling = await resolveAccountingFx("usd", day, "selling", {
      findRate: async () => row,
    });
    expect(buying.rate.toString()).toBe("32.1");
    expect(selling.rate.toString()).toBe("32.4");
    expect(buying.rateDate).toBe("2026-08-19");
    expect(buying.source).toBe("spot");
    expect(selling.source).toBe("spot");
  });

  it("falls back to the previous stored date", async () => {
    const prev = new Date("2026-08-18T00:00:00.000Z");
    const fx = await resolveAccountingFx("USD", day, "buying", {
      findRate: async () => null,
      findPrevious: async () => ({
        buyingRate: new Prisma.Decimal(31.9),
        sellingRate: new Prisma.Decimal(32.2),
        effectiveDate: prev,
      }),
    });
    expect(fx.rateDate).toBe("2026-08-18");
    expect(fx.rate.toString()).toBe("31.9");
    expect(fx.source).toBe("previous");
  });

  it("reads expense average in memory and does not write ExchangeRate", async () => {
    const write = vi.fn();
    const fx = await resolveAccountingFx("EUR", day, "selling", {
      findRate: async () => null,
      findPrevious: async () => null,
      findExpenseAverage: async () => ({
        rate: new Prisma.Decimal(38),
        rateDate: day,
      }),
    });
    expect(fx.rate.toString()).toBe("38");
    expect(fx.source).toBe("expense-average");
    expect(write).not.toHaveBeenCalled();
  });
});

describe("syncAccountingFxRates", () => {
  it("stores distinct buying and selling when the BOT feed provides sides", async () => {
    const upsert = vi.fn();
    const result = await syncAccountingFxRates({
      listSideRates: async () => [
        {
          currency: "USD",
          effectiveDate: new Date("2026-08-19T00:00:00.000Z"),
          buyingRate: new Prisma.Decimal("32.1"),
          sellingRate: new Prisma.Decimal("32.4"),
          source: "bot",
        },
      ],
      upsert,
    });
    expect(result.upserted).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        buyingRate: new Prisma.Decimal("32.1"),
        sellingRate: new Prisma.Decimal("32.4"),
      }),
    );
  });
});
