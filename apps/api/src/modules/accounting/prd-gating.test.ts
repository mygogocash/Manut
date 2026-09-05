import { describe, expect, it } from "vitest";

import { assertUniqueVendorTaxInvoice } from "@/modules/accounting/ap-duplicate";
import { recognisedOutputVat } from "@/modules/accounting/collection-vat";
import { computeArDocument } from "@/modules/accounting/document-calc";
import {
  allocateDocumentNumber,
  allocateDraftNumber,
  computePeriod,
  formatDocNumber,
  MONTHLY_SEQ_MAX,
} from "@/modules/accounting/numbering.service";
import { computeAccrualRevenue } from "@/modules/accounting/prd-exhibits";
import { applySatangAdjustment } from "@/modules/accounting/rounding";
import { assertMergeOutstandingUnchanged } from "@/modules/accounting/vendor-merge";

describe("PRD gating — shipped functions", () => {
  it("formats JE202607032 from document date", () => {
    const period = computePeriod(
      "monthly",
      new Date("2026-07-31T00:00:00.000Z"),
    );
    expect(formatDocNumber("JE{YYYY}{MM}", 32, 3, period)).toBe("JE202607032");
  });

  it("exports monthly cap 999", () => {
    expect(MONTHLY_SEQ_MAX).toBe(999);
    expect(typeof allocateDocumentNumber).toBe("function");
    expect(typeof allocateDraftNumber).toBe("function");
  });

  it("throws satang |diff|>1 from shipped applySatangAdjustment", () => {
    expect(() => applySatangAdjustment(100, 102)).toThrow();
  });

  it("computes AR tax bases from shipped computeArDocument", () => {
    const doc = computeArDocument(
      [
        { qty: 1, unitPrice: 1000, lineDiscount: 100, vatRate: 7 },
        { qty: 1, unitPrice: 500, vatRate: 0 },
      ],
      50,
    );
    expect(doc.lines[0].taxBase).toBe(867.86);
    expect(doc.vatTotal).toBe(60.75);
  });

  it("recognises collection VAT proportional to the receipt", () => {
    expect(
      recognisedOutputVat({
        invoiceGross: 1070,
        invoiceVat: 70,
        collected: 642,
      }),
    ).toBe(42);
  });

  it("rejects a duplicate vendor tax-invoice number", () => {
    expect(() =>
      assertUniqueVendorTaxInvoice({
        vendorTaxInvoiceNo: "A-1",
        existingId: "other",
      }),
    ).toThrow();
  });

  it("rolls merge back when outstanding drifts", () => {
    expect(() => assertMergeOutstandingUnchanged(10, 9)).toThrow();
  });

  it("accrual revenue exhibit is pre-VAT", () => {
    expect(
      computeAccrualRevenue(
        [
          {
            type: "receivable",
            status: "sent",
            amount: 1070,
            vatRate: 7,
            issueDate: new Date("2026-08-10"),
          },
        ],
        {
          start: new Date("2026-08-01"),
          end: new Date("2026-08-31"),
        },
      ),
    ).toBe(1000);
  });
});
