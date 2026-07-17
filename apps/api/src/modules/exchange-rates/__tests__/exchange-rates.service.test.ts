import { beforeEach, describe, expect, it, vi } from "vitest";

import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";

const findFirst = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    exchangeRate: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

function rateRow(rate: number) {
  return { rate };
}

describe("ExchangeRateService.resolveRate", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns identity for same currency", async () => {
    const fx = createExchangeRateService();
    const result = await fx.resolveRate("THB", "THB");
    expect(result).toEqual({ rate: 1, source: "identity" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("resolves direct USD → THB", async () => {
    findFirst.mockImplementation(
      async (args: { where: { baseCurrency: string; currency: string } }) => {
        const { baseCurrency, currency } = args.where;
        if (baseCurrency === "USD" && currency === "THB") return rateRow(36);
        return null;
      },
    );

    const fx = createExchangeRateService();
    const result = await fx.resolveRate("USD", "THB");
    expect(result.source).toBe("direct");
    expect(result.rate).toBe(36);
  });

  it("triangulates SGD → THB via USD when only USD-base rows exist", async () => {
    findFirst.mockImplementation(
      async (args: { where: { baseCurrency: string; currency: string } }) => {
        const { baseCurrency, currency } = args.where;
        if (baseCurrency === "USD" && currency === "THB") return rateRow(36);
        if (baseCurrency === "USD" && currency === "SGD") return rateRow(1.35);
        return null;
      },
    );

    const fx = createExchangeRateService();
    const result = await fx.resolveRate("SGD", "THB");
    expect(result.source).toBe("triangulated");
    expect(result.bridge).toBe("USD");
    expect(result.rate).toBeCloseTo(36 / 1.35, 5);
  });

  it("uses the rate effective on the asOf date, not the latest", async () => {
    findFirst.mockImplementation(
      async (args: {
        where: {
          baseCurrency: string;
          currency: string;
          effectiveDate?: { lte: Date };
        };
      }) => {
        const { baseCurrency, currency, effectiveDate } = args.where;
        if (baseCurrency !== "USD" || currency !== "THB") return null;
        // A dated query (asOf set) returns the historical rate; the
        // unfiltered query returns the newer latest rate.
        return rateRow(effectiveDate ? 32 : 36);
      },
    );

    const fx = createExchangeRateService();
    const dated = await fx.resolveRate("USD", "THB", new Date("2026-06-03"));
    expect(dated.rate).toBe(32);

    const latest = await fx.resolveRate("USD", "THB");
    expect(latest.rate).toBe(36);
  });
});
