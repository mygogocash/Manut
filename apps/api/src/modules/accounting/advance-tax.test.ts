import { describe, expect, it } from "vitest";

import {
  applyAdvance,
  computeSettlementExcess,
  isMonetaryAdvance,
  splitAdvanceVat,
} from "@/modules/accounting/advance-tax";

describe("isMonetaryAdvance", () => {
  // TAS 21: retranslating an advance invents FX on money that never moves.
  it("treats an advance as non-monetary and a refundable overpayment as monetary", () => {
    expect(isMonetaryAdvance("advance")).toBe(false);
    expect(isMonetaryAdvance("refundable")).toBe(true);
  });
});

describe("splitAdvanceVat", () => {
  it("splits the PRD's 8,809.00 advance at 7%", () => {
    expect(splitAdvanceVat(8809, 7)).toEqual({
      taxBase: 8232.71,
      vat: 576.29,
    });
  });

  // base + vat must equal the cash to the satang, or the journal will not
  // balance. Derived by subtraction for exactly this reason.
  it("keeps base + vat exactly equal to the gross", () => {
    for (const gross of [0.01, 1, 33.33, 999.99, 8809, 150000]) {
      const { taxBase, vat } = splitAdvanceVat(gross, 7);
      expect(taxBase + vat).toBeCloseTo(gross, 2);
    }
  });

  it("returns the whole amount as base at a zero rate", () => {
    expect(splitAdvanceVat(5000, 0)).toEqual({ taxBase: 5000, vat: 0 });
  });
});

describe("applyAdvance", () => {
  // The defect in the PRD's worked example: it applied only the 8,232.71 base
  // and left the 576.29 declared at receipt stranded, so the follow-on invoice
  // taxed the same base again.
  it("settles the gross and relieves the VAT declared at receipt", () => {
    expect(
      applyAdvance({
        available: 8809,
        vatAvailable: 576.29,
        requestedGross: 8809,
      }),
    ).toEqual({
      grossApplied: 8809,
      vatRelieved: 576.29,
      baseApplied: 8232.71,
    });
  });

  // Total VAT across receipt + invoice + application must equal the tax on the
  // job actually done. This is the assertion that catches a regression to the
  // PRD's arithmetic.
  it("leaves exactly one charge of VAT across the whole lifecycle", () => {
    const receiptVat = splitAdvanceVat(8809, 7).vat;
    const invoiceVat = 1400;
    const { vatRelieved } = applyAdvance({
      available: 8809,
      vatAvailable: receiptVat,
      requestedGross: 8809,
    });
    expect(receiptVat + invoiceVat - vatRelieved).toBeCloseTo(1400, 2);
  });

  it("relieves VAT proportionally on a partial draw-down", () => {
    const result = applyAdvance({
      available: 8809,
      vatAvailable: 576.29,
      requestedGross: 4404.5,
    });
    expect(result.grossApplied).toBe(4404.5);
    expect(result.vatRelieved).toBeCloseTo(288.15, 2);
    expect(result.baseApplied).toBeCloseTo(4116.35, 2);
  });

  it("never applies more than the advance holds", () => {
    expect(
      applyAdvance({
        available: 1000,
        vatAvailable: 65.42,
        requestedGross: 5000,
      }).grossApplied,
    ).toBe(1000);
  });

  it("carries no VAT for a refundable overpayment", () => {
    expect(
      applyAdvance({ available: 5800, vatAvailable: 0, requestedGross: 5800 }),
    ).toEqual({ grossApplied: 5800, vatRelieved: 0, baseApplied: 5800 });
  });

  it("is a no-op on an exhausted advance", () => {
    expect(
      applyAdvance({ available: 0, vatAvailable: 0, requestedGross: 100 }),
    ).toEqual({ grossApplied: 0, vatRelieved: 0, baseApplied: 0 });
  });
});

describe("computeSettlementExcess", () => {
  it("is the cash no open document claimed", () => {
    expect(
      computeSettlementExcess({ cashAmount: 150000, allocatedNet: 141191 }),
    ).toBe(8809);
  });

  // The PRD's formula adds WHT and the bank fee. Both are already accounted
  // for elsewhere in this codebase, so adding them would invent an excess.
  it("does not re-add withholding tax that the stored amount is already net of", () => {
    expect(
      computeSettlementExcess({ cashAmount: 97000, allocatedNet: 97000 }),
    ).toBe(0);
  });

  it("never reports a negative excess", () => {
    expect(
      computeSettlementExcess({ cashAmount: 100, allocatedNet: 500 }),
    ).toBe(0);
  });
});
