import { afterEach, describe, expect, it, vi } from "vitest";

import { withFxConversion } from "@/modules/expenses/expense-reports.service";
import { expensesRepository } from "@/modules/expenses/expenses.repository";
import { arrayAt } from "@/test-utils/assertions";

// 1 IDR ≈ 0.0018296 THB (BOT per-1000 quote, the rate the report Total
// uses). XYZ has no rate on file.
const IDR_RATE = 0.0018296;

function mockConvert() {
  return vi
    .spyOn(expensesRepository, "convertAmount")
    .mockImplementation(async (amount, from) => {
      const cur = from.trim().toUpperCase();
      if (cur === "IDR") {
        return { converted: amount * IDR_RATE, rate: IDR_RATE };
      }
      if (cur === "XYZ") return null;
      return { converted: amount, rate: 1 };
    });
}

const DAY = new Date("2026-06-03T00:00:00.000Z");

describe("withFxConversion (per-line FX on report detail)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("leaves THB lines untouched (no conversion, no lookup)", async () => {
    const spy = mockConvert();
    const row = arrayAt(
      await withFxConversion([{ amount: "604", currency: "THB", date: DAY }]),
      0,
      "converted THB expense",
    );
    expect(row).toMatchObject({
      fxRate: null,
      fxConvertedThb: null,
      fxRateMissing: false,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("attaches rate + converted THB for a foreign line", async () => {
    mockConvert();
    const row = arrayAt(
      await withFxConversion([
        { amount: "1157400", currency: "IDR", date: DAY },
      ]),
      0,
      "converted foreign expense",
    );
    expect(row.fxRate).toBe(IDR_RATE);
    // Same rounding as convertAmount / the report Total.
    expect(row.fxConvertedThb).toBe(Math.round(1157400 * IDR_RATE * 100) / 100);
    expect(row.fxRateMissing).toBe(false);
  });

  it("flags missing-rate lines instead of inventing a number", async () => {
    mockConvert();
    const row = arrayAt(
      await withFxConversion([{ amount: "100", currency: "XYZ", date: DAY }]),
      0,
      "expense missing an FX rate",
    );
    expect(row).toMatchObject({
      fxRate: null,
      fxConvertedThb: null,
      fxRateMissing: true,
    });
  });

  it("memoises the rate lookup per currency|date", async () => {
    const spy = mockConvert();
    await withFxConversion([
      { amount: "100000", currency: "IDR", date: DAY },
      { amount: "57000", currency: "IDR", date: DAY },
      { amount: "48260", currency: "IDR", date: DAY },
    ]);
    // Three same-day IDR lines → one rate read.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("per-line converted figures reconcile to the report total", async () => {
    mockConvert();
    const rows = await withFxConversion([
      { amount: "604", currency: "THB", date: DAY },
      { amount: "1157400", currency: "IDR", date: DAY },
      { amount: "131000", currency: "IDR", date: DAY },
    ]);
    // Sum of (native THB + converted foreign), rounded like
    // convertReportToThb's final round.
    const total =
      Math.round(
        rows.reduce(
          (acc, r) =>
            acc +
            (r.currency === "THB" ? Number(r.amount) : (r.fxConvertedThb ?? 0)),
          0,
        ) * 100,
      ) / 100;
    const expected =
      Math.round(
        (604 +
          Math.round(1157400 * IDR_RATE * 100) / 100 +
          Math.round(131000 * IDR_RATE * 100) / 100) *
          100,
      ) / 100;
    expect(total).toBe(expected);
  });
});
