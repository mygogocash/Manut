import { describe, expect, it } from "vitest";

import { DEFAULT_INVOICE_COMPANY } from "@/modules/accounting/invoice-shared";
import {
  buildTaxInvoiceData,
  buildTaxInvoicePdfBuffer,
} from "@/modules/accounting/tax-invoice";

describe("buildTaxInvoiceData", () => {
  it("splits recognised VAT from the collected gross", () => {
    const data = buildTaxInvoiceData(
      {
        receiptNo: "RCP202608001",
        date: new Date("2026-08-18T00:00:00.000Z"),
        invoiceNo: "INV202608001",
        counterparty: "Customer Co",
        taxId: "111",
        address: "Bangkok",
        currency: "THB",
        exchangeRate: 1,
        amount: 107,
        vatRecognised: 7,
        whtAmount: 3,
        bankFee: 0,
      },
      DEFAULT_INVOICE_COMPANY,
    );
    expect(data.net).toBe(100);
    expect(data.vat).toBe(7);
    expect(data.total).toBe(107);
    expect(data.wht).toBe(3);
  });
});

describe("buildTaxInvoicePdfBuffer", () => {
  it("renders a PDF", async () => {
    const data = buildTaxInvoiceData(
      {
        receiptNo: "RCP202608001",
        date: new Date("2026-08-18T00:00:00.000Z"),
        invoiceNo: "INV202608001",
        counterparty: "Customer Co",
        taxId: "111",
        address: "Bangkok",
        currency: "THB",
        exchangeRate: 1,
        amount: 107,
        vatRecognised: 7,
        whtAmount: 0,
        bankFee: 0,
      },
      DEFAULT_INVOICE_COMPANY,
    );
    const buf = await buildTaxInvoicePdfBuffer(data);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
