import { describe, expect, it } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import {
  applySatangAdjustment,
  roundMoney,
} from "@/modules/accounting/rounding";

describe("roundMoney", () => {
  it("rounds half-up to 2 dp", () => {
    expect(roundMoney(1.225)).toBe(1.23);
    expect(roundMoney(10)).toBe(10);
  });
});

describe("applySatangAdjustment", () => {
  it("allows a ±1.00 difference and returns it as rounding", () => {
    expect(applySatangAdjustment(100.5, 101.5)).toEqual({
      total: 101.5,
      rounding: 1,
    });
    expect(applySatangAdjustment(100.5, 99.5)).toEqual({
      total: 99.5,
      rounding: -1,
    });
  });

  it("throws when |diff| > 1", () => {
    expect(() => applySatangAdjustment(100, 101.01)).toThrow(
      BadRequestException,
    );
  });
});
