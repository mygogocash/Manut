import { describe, expect, it } from "vitest";

import {
  RETAINED_EARNINGS_ROLE,
  reversalWarnings,
  VAT_MAPPING_ROLES,
} from "@/modules/accounting/journal-reversal";

const JULY = new Date("2026-07-31T00:00:00.000Z");
const AUGUST = new Date("2026-08-01T00:00:00.000Z");

describe("reversalWarnings", () => {
  it("says nothing when the entry touches neither VAT nor retained earnings", () => {
    expect(
      reversalWarnings({
        touchesVat: false,
        touchesRetainedEarnings: false,
        originalDate: JULY,
        reverseDate: AUGUST,
      }),
    ).toEqual([]);
  });

  // The filed month is not amended by a reversal — the tax lands in the month
  // the reversal does. Both months are named so the reader can check the returns.
  it("names both tax months and points at the credit note", () => {
    const [warning] = reversalWarnings({
      touchesVat: true,
      touchesRetainedEarnings: false,
      originalDate: JULY,
      reverseDate: AUGUST,
    });
    expect(warning?.code).toBe("reversal_affects_tax_filing");
    expect(warning?.message).toContain("2026-07");
    expect(warning?.message).toContain("2026-08");
    expect(warning?.message).toContain("credit note");
    expect(warning?.messageTh).toContain("ใบลดหนี้");
  });

  it("flags a year-end closing entry separately", () => {
    const [warning] = reversalWarnings({
      touchesVat: false,
      touchesRetainedEarnings: true,
      originalDate: JULY,
      reverseDate: AUGUST,
    });
    expect(warning?.code).toBe("reversal_affects_retained_earnings");
    expect(warning?.message).toContain("opening balance");
  });

  it("raises both when an entry does both", () => {
    expect(
      reversalWarnings({
        touchesVat: true,
        touchesRetainedEarnings: true,
        originalDate: JULY,
        reverseDate: AUGUST,
      }).map((w) => w.code),
    ).toEqual([
      "reversal_affects_tax_filing",
      "reversal_affects_retained_earnings",
    ]);
  });

  // A reversal dated inside the same month still reports that month on both
  // sides rather than rendering an empty range.
  it("handles a same-month reversal without producing a broken range", () => {
    const [warning] = reversalWarnings({
      touchesVat: true,
      touchesRetainedEarnings: false,
      originalDate: new Date("2026-08-03T00:00:00.000Z"),
      reverseDate: AUGUST,
    });
    expect(warning?.message).toContain("2026-08 return");
  });
});

describe("role constants", () => {
  // The repository resolves account ids from these, so a typo would silently
  // stop the warning from ever firing.
  it("covers both sides of VAT, deferred included", () => {
    expect([...VAT_MAPPING_ROLES]).toEqual([
      "vat_output",
      "vat_output_deferred",
      "vat_input",
      "vat_input_deferred",
    ]);
    expect(RETAINED_EARNINGS_ROLE).toBe("retained_earnings");
  });
});
