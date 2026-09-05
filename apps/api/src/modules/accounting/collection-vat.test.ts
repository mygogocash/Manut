import { describe, expect, it } from "vitest";

import { recognisedOutputVat } from "@/modules/accounting/collection-vat";

describe("recognisedOutputVat", () => {
  it("recognises 60% of invoice VAT on a 60% collection", () => {
    // Gross 1070 (1000 + 7% VAT 70); collect 642 → 60%.
    expect(
      recognisedOutputVat({
        invoiceGross: 1070,
        invoiceVat: 70,
        collected: 642,
      }),
    ).toBe(42);
  });

  it("does not double-recognise on a later remainder collection", () => {
    const first = recognisedOutputVat({
      invoiceGross: 1070,
      invoiceVat: 70,
      collected: 642,
    });
    const rest = recognisedOutputVat({
      invoiceGross: 1070,
      invoiceVat: 70,
      collected: 1070,
      previouslyRecognised: first,
    });
    expect(first + rest).toBe(70);
  });
});
