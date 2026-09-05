import { describe, expect, it } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { computeArDocument } from "@/modules/accounting/document-calc";

describe("computeArDocument", () => {
  it("applies line then header discount and VAT on the discounted base", () => {
    const doc = computeArDocument(
      [
        { qty: 1, unitPrice: 1000, lineDiscount: 100, vatRate: 7 },
        { qty: 1, unitPrice: 500, lineDiscount: 0, vatRate: 0 },
      ],
      50,
    );
    expect(doc.subtotal).toBe(1350);
    expect(doc.vatTotal).toBe(60.75);
    expect(doc.grandTotal).toBe(1410.75);
    expect(doc.lines[0].taxBase).toBe(867.86);
    expect(doc.lines[0].vatAmount).toBe(60.75);
    expect(doc.lines[1].taxBase).toBe(482.14);
    expect(doc.lines[1].vatAmount).toBe(0);
  });

  it("requires a reason for a free-form VAT rate", () => {
    expect(() =>
      computeArDocument([{ qty: 1, unitPrice: 100, vatRate: 5 }]),
    ).toThrow(BadRequestException);
    expect(
      computeArDocument([
        { qty: 1, unitPrice: 100, vatRate: 5, vatReason: "export" },
      ]).vatTotal,
    ).toBe(5);
  });

  it("blocks satang |diff| > 1 and a negative total", () => {
    expect(() =>
      computeArDocument([{ qty: 1, unitPrice: 100, vatRate: 0 }], 0, 102),
    ).toThrow(BadRequestException);
    expect(() =>
      computeArDocument([{ qty: 1, unitPrice: 10, vatRate: 0 }], 20),
    ).toThrow(BadRequestException);
  });
});
