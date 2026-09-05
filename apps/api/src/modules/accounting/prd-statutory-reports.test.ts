import { describe, expect, it } from "vitest";

import {
  buildDeferredVatRecon,
  buildNumberControlReport,
} from "@/modules/accounting/prd-statutory-reports";

describe("buildNumberControlReport", () => {
  it("lists cancelled numbers and true gaps", () => {
    const report = buildNumberControlReport({
      prefix: "JE",
      yearMonth: "202608",
      padWidth: 3,
      issued: [
        { number: "JE202608001", status: "posted", cancelled: false },
        { number: "JE202608003", status: "cancelled", cancelled: true },
        { number: "JE202608004", status: "posted", cancelled: false },
        { number: "DRAFT-000009", status: "draft", cancelled: false },
      ],
    });
    expect(report.first).toBe("JE202608001");
    expect(report.last).toBe("JE202608004");
    expect(report.issuedCount).toBe(3);
    expect(report.cancelledCount).toBe(1);
    expect(report.gaps).toEqual([
      { expected: "JE202608002", reason: "gap" },
      { expected: "JE202608003", reason: "cancelled" },
    ]);
  });
});

describe("buildDeferredVatRecon", () => {
  it("reconciling issued, collected, and remaining deferred VAT", () => {
    const recon = buildDeferredVatRecon({
      issuedDeferredVat: 700,
      collectedRecognisedVat: 400,
      remainingDeferredVat: 300,
    });
    expect(recon.reconDifference).toBe(0);
  });
});
