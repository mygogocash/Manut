import { describe, expect, it } from "vitest";

import {
  nextAmountPaid,
  settledStatusAfter,
  validatePaymentAmount,
} from "@/modules/accounting/payment-math";

describe("validatePaymentAmount", () => {
  it("rejects zero and negative amounts", () => {
    expect(validatePaymentAmount(100, 0, 0).ok).toBe(false);
    expect(validatePaymentAmount(100, 0, -5).ok).toBe(false);
  });

  it("accepts a full settlement of the outstanding balance", () => {
    expect(validatePaymentAmount(100, 0, 100).ok).toBe(true);
    expect(validatePaymentAmount(100, 40, 60).ok).toBe(true);
  });

  it("accepts a partial payment", () => {
    expect(validatePaymentAmount(100, 0, 30).ok).toBe(true);
  });

  it("rejects an over-payment beyond the outstanding balance", () => {
    const r = validatePaymentAmount(100, 40, 61);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("exceeds the outstanding balance");
  });

  it("tolerates half-a-cent floating dust on an exact settlement", () => {
    expect(validatePaymentAmount(100.01, 0, 100.011).ok).toBe(true);
  });
});

describe("nextAmountPaid / settledStatusAfter", () => {
  it("accumulates cash to 2dp", () => {
    expect(nextAmountPaid(33.33, 33.34)).toBe(66.67);
  });

  it("marks paid only when cumulative cash reaches the amount due", () => {
    expect(settledStatusAfter(100, 100)).toBe("paid");
    expect(settledStatusAfter(100, 99.999)).toBe("paid"); // within tolerance
    expect(settledStatusAfter(100, 60)).toBe("partial");
    expect(settledStatusAfter(100, 0)).toBe("partial");
  });

  it("two partials that complete the balance end as paid", () => {
    const afterFirst = nextAmountPaid(0, 60);
    expect(settledStatusAfter(100, afterFirst)).toBe("partial");
    const afterSecond = nextAmountPaid(afterFirst, 40);
    expect(settledStatusAfter(100, afterSecond)).toBe("paid");
  });
});
