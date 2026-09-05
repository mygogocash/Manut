import { describe, expect, it } from "vitest";

import {
  buildPp30,
  buildVatRegister,
  buildWhtSummary,
  type VatDocInput,
  type WhtPaymentInput,
} from "@/modules/accounting/tax-reports";

// Two THB sales (7% VAT + one zero-rated) and one USD sale booked @ 32.
const SALES: VatDocInput[] = [
  {
    id: "s2",
    docNo: "INV-002",
    date: "2026-08-20",
    counterparty: "Beta Co",
    taxId: "0105500000002",
    branch: "00000",
    currency: "THB",
    exchangeRate: 1,
    subtotal: 200,
    vatRate: 7,
    vatAmount: 14,
  },
  {
    id: "s1",
    docNo: "INV-001",
    date: "2026-08-05",
    counterparty: "Alpha Co",
    taxId: "0105500000001",
    branch: null,
    currency: "THB",
    exchangeRate: 1,
    subtotal: 100,
    vatRate: 0, // zero-rated / exempt
    vatAmount: 0,
  },
  {
    id: "s3",
    docNo: "INV-003",
    date: "2026-08-25",
    counterparty: "Gamma Inc",
    taxId: null,
    branch: null,
    currency: "USD",
    exchangeRate: 32,
    subtotal: 10, // → 320 base
    vatRate: 7,
    vatAmount: 0.7, // → 22.4 base
  },
];

describe("buildVatRegister", () => {
  it("sorts by date, numbers rows, converts to base, and splits rate buckets", () => {
    const reg = buildVatRegister(SALES);

    // Chronological order → INV-001, INV-002, INV-003; seq is 1-based.
    expect(reg.rows.map((r) => r.docNo)).toEqual([
      "INV-001",
      "INV-002",
      "INV-003",
    ]);
    expect(reg.rows.map((r) => r.seq)).toEqual([1, 2, 3]);

    // USD row converted at 32.
    const usd = reg.rows[2];
    expect(usd.base).toBe(320);
    expect(usd.vat).toBe(22.4);

    // Empty tax id / branch render as "".
    expect(usd.taxId).toBe("");
    expect(reg.rows[0].branch).toBe("");

    // Totals: base 100 + 200 + 320 = 620; VAT 0 + 14 + 22.4 = 36.4.
    expect(reg.totalBase).toBe(620);
    expect(reg.totalVat).toBe(36.4);

    // Standard-rated (vatRate > 0) = 200 + 320; zero-rated/exempt = 100.
    expect(reg.standardRatedBase).toBe(520);
    expect(reg.zeroRatedOrExemptBase).toBe(100);
    expect(reg.rows[0].zeroRatedOrExempt).toBe(true);
    expect(reg.rows[1].zeroRatedOrExempt).toBe(false);
  });

  it("returns zeroed totals for an empty period", () => {
    const reg = buildVatRegister([]);
    expect(reg.rows).toHaveLength(0);
    expect(reg.totalBase).toBe(0);
    expect(reg.totalVat).toBe(0);
  });
});

describe("buildPp30", () => {
  it("nets output VAT against input VAT (payable)", () => {
    const output = buildVatRegister(SALES); // outputVat 36.4
    const input = buildVatRegister([
      {
        id: "p1",
        docNo: "BILL-1",
        date: "2026-08-10",
        counterparty: "Supplier",
        taxId: "0105500000009",
        branch: null,
        currency: "THB",
        exchangeRate: 1,
        subtotal: 100,
        vatRate: 7,
        vatAmount: 7,
      },
    ]);
    const pp30 = buildPp30(output, input);

    expect(pp30.standardRatedSales).toBe(520);
    expect(pp30.zeroRatedOrExemptSales).toBe(100);
    expect(pp30.totalSales).toBe(620);
    expect(pp30.outputVat).toBe(36.4);
    expect(pp30.inputVat).toBe(7);
    expect(pp30.netVatPayable).toBe(29.4);
    expect(pp30.vatCredit).toBe(0);
  });

  it("reports an input credit when input VAT exceeds output VAT", () => {
    const output = buildVatRegister([]);
    const input = buildVatRegister([
      {
        id: "p1",
        docNo: "BILL-1",
        date: "2026-08-10",
        counterparty: "Supplier",
        taxId: null,
        branch: null,
        currency: "THB",
        exchangeRate: 1,
        subtotal: 1000,
        vatRate: 7,
        vatAmount: 70,
      },
    ]);
    const pp30 = buildPp30(output, input);
    expect(pp30.netVatPayable).toBe(-70);
    expect(pp30.vatCredit).toBe(70);
  });
});

describe("buildWhtSummary", () => {
  const PAYMENTS: WhtPaymentInput[] = [
    // Two payments to the same juristic supplier → one grouped PND.53 row.
    {
      paymentId: "pay1",
      date: "2026-08-05",
      payeeId: "v1",
      payee: "Acme Ltd",
      taxId: "0105500000010",
      payeeKind: "juristic",
      currency: "THB",
      exchangeRate: 1,
      whtAmount: 30, // 3% of 1000
      whtRate: 3,
    },
    {
      paymentId: "pay2",
      date: "2026-08-20",
      payeeId: "v1",
      payee: "Acme Ltd",
      taxId: "0105500000010",
      payeeKind: "juristic",
      currency: "THB",
      exchangeRate: 1,
      whtAmount: 15, // 3% of 500
      whtRate: 3,
    },
    // Individual freelancer → PND.3.
    {
      paymentId: "pay3",
      date: "2026-08-10",
      payeeId: "v2",
      payee: "Somchai",
      taxId: "1100700000011",
      payeeKind: "individual",
      currency: "THB",
      exchangeRate: 1,
      whtAmount: 50, // 5% of 1000
      whtRate: 5,
    },
  ];

  it("splits payees into PND.3 (individual) and PND.53 (juristic) and groups", () => {
    const { pnd3, pnd53 } = buildWhtSummary(PAYMENTS);

    expect(pnd53.form).toBe("PND.53");
    expect(pnd53.payees).toHaveLength(1);
    expect(pnd53.payees[0].count).toBe(2);
    expect(pnd53.payees[0].whtAmount).toBe(45);
    // Income base backed out of the tax: (1000 + 500).
    expect(pnd53.payees[0].base).toBe(1500);
    expect(pnd53.totalWht).toBe(45);

    expect(pnd3.form).toBe("PND.3");
    expect(pnd3.payees).toHaveLength(1);
    expect(pnd3.payees[0].payee).toBe("Somchai");
    expect(pnd3.payees[0].whtAmount).toBe(50);
    expect(pnd3.payees[0].base).toBe(1000);
  });

  it("converts a foreign-currency withholding to base", () => {
    const { pnd53 } = buildWhtSummary([
      {
        paymentId: "pay-usd",
        date: "2026-08-15",
        payeeId: "v9",
        payee: "Foreign Vendor",
        taxId: null,
        payeeKind: "juristic",
        currency: "USD",
        exchangeRate: 32,
        whtAmount: 3, // → 96 base
        whtRate: 3,
      },
    ]);
    expect(pnd53.payees[0].whtAmount).toBe(96);
    expect(pnd53.payees[0].base).toBe(3200); // 96 / 0.03
  });
});
