import { describe, expect, it } from "vitest";

import type { InvoiceCompany } from "@/modules/accounting/invoice-shared";
import {
  buildWhtCertificateData,
  buildWhtCertificatePdfBuffer,
  type WhtCertificateSource,
} from "@/modules/accounting/wht-certificate";

const COMPANY: InvoiceCompany = {
  name: "Acme (Thailand) Co., Ltd.",
  addressLines: ["1 Sukhumvit Rd", "Bangkok 10110"],
  taxId: "0-1055-00000-00-0",
  email: "ap@acme.co.th",
  tel: "+66 2 000 0000",
  bankName: "",
  bankAccountType: "",
  bankBranch: "",
  bankAccountName: "",
  bankAccountNo: "",
  bankSwift: "",
  footerNote: "",
};

const src = (
  over: Partial<WhtCertificateSource> = {},
): WhtCertificateSource => ({
  paymentId: "pay_abc123def456",
  date: new Date("2026-08-15T00:00:00.000Z"),
  currency: "THB",
  exchangeRate: 1,
  whtAmount: 3,
  invoice: {
    counterparty: "Somchai Freelance",
    whtRate: 3,
    vendor: {
      name: "Somchai Co., Ltd.",
      taxId: "0-9999-00000-00-0",
      addressEn: "9 Silom Rd, Bangkok",
      branch: "HQ",
    },
  },
  ...over,
});

describe("buildWhtCertificateData", () => {
  it("backs the income out of the withheld tax and maps payer/payee", () => {
    const d = buildWhtCertificateData(src(), COMPANY);
    expect(d.whtBase).toBe(3);
    expect(d.incomeBase).toBe(100); // 3 / 0.03
    expect(d.whtRatePct).toBe(3);
    expect(d.payer.name).toBe("Acme (Thailand) Co., Ltd.");
    expect(d.payer.taxId).toBe("0-1055-00000-00-0");
    expect(d.payee.name).toBe("Somchai Co., Ltd.");
    expect(d.payee.taxId).toBe("0-9999-00000-00-0");
    expect(d.certNo).toBe("WHT-202608-DEF456");
  });

  it("converts a foreign-currency withholding to base", () => {
    const d = buildWhtCertificateData(
      src({ currency: "USD", exchangeRate: 32, whtAmount: 3 }),
      COMPANY,
    );
    expect(d.whtBase).toBe(96); // 3 × 32
    expect(d.incomeBase).toBe(3200); // 96 / 0.03
  });

  it("falls back to the invoice counterparty when there is no vendor", () => {
    const d = buildWhtCertificateData(
      src({
        invoice: { counterparty: "Cash Payee", whtRate: 5, vendor: null },
      }),
      COMPANY,
    );
    expect(d.payee.name).toBe("Cash Payee");
    expect(d.payee.taxId).toBe("");
  });
});

describe("buildWhtCertificatePdfBuffer", () => {
  it("renders a non-empty PDF without a font-encoding error", async () => {
    const buf = await buildWhtCertificatePdfBuffer(
      buildWhtCertificateData(src(), COMPANY),
    );
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
