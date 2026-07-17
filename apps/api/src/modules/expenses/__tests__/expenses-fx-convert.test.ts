import { beforeEach, describe, expect, it, vi } from "vitest";

import { expensesRepository } from "@/modules/expenses/expenses.repository";

const resolveRate = vi.fn();

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: () => ({ resolveRate }),
}));

describe("expensesRepository.convertAmount", () => {
  beforeEach(() => {
    resolveRate.mockReset();
  });

  it("returns identity without calling FX for same currency", async () => {
    const result = await expensesRepository.convertAmount(100, "thb", "THB");
    expect(result).toEqual({ converted: 100, rate: 1 });
    expect(resolveRate).not.toHaveBeenCalled();
  });

  it("converts via shared ExchangeRateService lookup", async () => {
    resolveRate.mockResolvedValue({ rate: 36, source: "direct" });
    const result = await expensesRepository.convertAmount(10, "USD", "THB");
    // 3rd arg is the optional `asOf` (undefined = latest rate here).
    expect(resolveRate).toHaveBeenCalledWith("USD", "THB", undefined);
    expect(result).toEqual({ converted: 360, rate: 36 });
  });

  it("returns null when FX path is missing", async () => {
    resolveRate.mockResolvedValue({ rate: 0, source: "missing" });
    const result = await expensesRepository.convertAmount(10, "XYZ", "THB");
    expect(result).toBeNull();
  });
});
