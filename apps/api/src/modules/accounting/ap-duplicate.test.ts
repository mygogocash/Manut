import { describe, expect, it } from "vitest";

import { ConflictException } from "@/common/exceptions/http-exception";
import {
  assertUniqueVendorTaxInvoice,
  rejectDuplicateVendorTaxInvoice,
} from "@/modules/accounting/ap-duplicate";

describe("assertUniqueVendorTaxInvoice", () => {
  it("allows a first use and empty numbers", () => {
    expect(() =>
      assertUniqueVendorTaxInvoice({ vendorTaxInvoiceNo: "TAX-1" }),
    ).not.toThrow();
    expect(() =>
      assertUniqueVendorTaxInvoice({ vendorTaxInvoiceNo: "  " }),
    ).not.toThrow();
  });

  it("rejects a second bill with the same vendor tax-invoice number", () => {
    expect(() =>
      assertUniqueVendorTaxInvoice({
        vendorTaxInvoiceNo: "TAX-1",
        existingId: "inv-other",
      }),
    ).toThrow(ConflictException);
  });
});

describe("rejectDuplicateVendorTaxInvoice", () => {
  it("calls findExisting and throws when a row is returned", async () => {
    await expect(
      rejectDuplicateVendorTaxInvoice({
        vendorTaxInvoiceNo: "TAX-1",
        findExisting: async () => ({ id: "hit" }),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
