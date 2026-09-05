import { describe, expect, it } from "vitest";

import { reportTotalCurrency } from "@/components/expenses/report-total-currency";

describe("reportTotalCurrency", () => {
  it("labels an all-INR report's total THB — the reported bug", () => {
    // Reported from Expenses → Approval: a ₹1,000 claim converts to
    // ฿412.34, and the approve dialog printed "INR 412.34" because it
    // read the first line item's currency instead of the total's.
    expect(reportTotalCurrency({ totalCurrency: "THB" })).toBe("THB");
  });

  it("keeps a THB-only report on THB", () => {
    expect(reportTotalCurrency({ totalCurrency: "THB" })).toBe("THB");
  });

  it("carries whatever base currency the server reports", () => {
    // The entity base is THB today. Read it off the payload rather than
    // hard-coding, so a second base currency needs no UI change.
    expect(reportTotalCurrency({ totalCurrency: "USD" })).toBe("USD");
  });

  it("falls back to the reporting currency, never a line-item currency", () => {
    // The old call sites fell back to the first line's native code,
    // which is what mislabelled the total. There is no report whose
    // total is expressed in a line currency.
    expect(reportTotalCurrency({ totalCurrency: null })).toBe("THB");
    expect(reportTotalCurrency({ totalCurrency: undefined })).toBe("THB");
    expect(reportTotalCurrency({})).toBe("THB");
  });

  it("treats a blank totalCurrency as absent", () => {
    expect(reportTotalCurrency({ totalCurrency: "   " })).toBe("THB");
  });

  it("normalises casing and whitespace", () => {
    expect(reportTotalCurrency({ totalCurrency: " thb " })).toBe("THB");
    expect(reportTotalCurrency({ totalCurrency: "usd" })).toBe("USD");
  });
});
