import { describe, expect, it } from "vitest";

import {
  type ActivityRow,
  buildBalanceSheet,
  buildCashFlow,
  buildProfitAndLoss,
  buildTaxSummary,
  buildTrialBalance,
  fiscalYearStartOnOrBefore,
  netIncome,
} from "@/modules/accounting/reports";

// A small but complete, balanced ledger: an invoice sent with 7% VAT and 3%
// WHT, then received. Posted lines net to:
//   Send:    Dr AR 107 · Cr Revenue 100 · Cr VAT 7
//   Receipt: Dr Bank 104 · Dr WHT-recv 3 · Cr AR 107
const LEDGER: ActivityRow[] = [
  {
    accountId: "ar",
    code: "1130",
    name: "Accounts Receivable",
    type: "asset",
    debit: 107,
    credit: 107,
  },
  {
    accountId: "bank",
    code: "1010",
    name: "Bank",
    type: "asset",
    debit: 104,
    credit: 0,
  },
  {
    accountId: "wht",
    code: "1180",
    name: "WHT Receivable",
    type: "asset",
    debit: 3,
    credit: 0,
  },
  {
    accountId: "vat",
    code: "2130",
    name: "Output VAT",
    type: "liability",
    debit: 0,
    credit: 7,
  },
  {
    accountId: "rev",
    code: "4000",
    name: "Sales Revenue",
    type: "revenue",
    debit: 0,
    credit: 100,
  },
];

describe("buildTrialBalance", () => {
  it("ties — total debits equal total credits", () => {
    const tb = buildTrialBalance(LEDGER);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.balanced).toBe(true);
  });

  it("drops zero-net accounts (fully-cleared AR) and sorts by code", () => {
    const tb = buildTrialBalance(LEDGER);
    expect(tb.rows.find((r) => r.accountId === "ar")).toBeUndefined();
    expect(tb.rows.map((r) => r.code)).toEqual([
      "1010",
      "1180",
      "2130",
      "4000",
    ]);
  });
});

describe("buildProfitAndLoss", () => {
  it("nets revenue minus expenses", () => {
    const pnl = buildProfitAndLoss(LEDGER);
    expect(pnl.totalRevenue).toBe(100);
    expect(pnl.totalExpenses).toBe(0);
    expect(pnl.netProfit).toBe(100);
  });
});

describe("netIncome", () => {
  it("is revenue minus expense over the window", () => {
    expect(netIncome(LEDGER)).toBe(100);
    const withExpense: ActivityRow[] = [
      ...LEDGER,
      {
        accountId: "exp",
        code: "5000",
        name: "COGS",
        type: "expense",
        debit: 40,
        credit: 0,
      },
    ];
    expect(netIncome(withExpense)).toBe(60);
  });
});

describe("buildBalanceSheet", () => {
  it("balances (Assets = Liabilities + Equity) with earnings rolled in, no formal close", () => {
    const bs = buildBalanceSheet(LEDGER, 100); // all earnings are current-year
    expect(bs.totalAssets).toBe(107); // AR 0 + Bank 104 + WHT 3
    expect(bs.totalLiabilities).toBe(7);
    expect(bs.currentYearEarnings).toBe(100);
    expect(bs.retainedEarnings).toBe(0);
    expect(bs.totalEquity).toBe(100);
    expect(bs.totalLiabilitiesAndEquity).toBe(107);
    expect(bs.balanced).toBe(true);
    expect(bs.difference).toBe(0);
  });

  it("splits prior-year retained earnings from current-year earnings and still balances", () => {
    // Net income to date is 100; say only 30 is current-year → 70 retained.
    const bs = buildBalanceSheet(LEDGER, 30);
    expect(bs.currentYearEarnings).toBe(30);
    expect(bs.retainedEarnings).toBe(70);
    expect(bs.totalEquity).toBe(100);
    expect(bs.balanced).toBe(true);
  });

  it("balances even when a retained_earnings equity account was never seeded", () => {
    // No equity-type rows at all — earnings come purely from nominal accounts.
    const bs = buildBalanceSheet(LEDGER, 100);
    expect(bs.equity.some((e) => e.name.includes("Current year"))).toBe(true);
    expect(bs.balanced).toBe(true);
  });
});

describe("buildCashFlow", () => {
  it("reconciles net cash change to closing minus opening", () => {
    const cf = buildCashFlow(LEDGER, new Set(["bank"]), 0, 104);
    expect(cf.netChange).toBe(104);
    expect(cf.operating).toBe(104);
    expect(cf.reconciles).toBe(true);
  });

  it("flags a non-reconciling period", () => {
    const cf = buildCashFlow(LEDGER, new Set(["bank"]), 0, 200);
    expect(cf.reconciles).toBe(false);
  });
});

describe("buildTaxSummary", () => {
  // Output VAT 7 (liability, credit), input VAT 4 (asset, debit), WHT payable 3.
  const taxRows: ActivityRow[] = [
    {
      accountId: "vout",
      code: "2130",
      name: "Output VAT",
      type: "liability",
      debit: 0,
      credit: 7,
    },
    {
      accountId: "vin",
      code: "1170",
      name: "Input VAT",
      type: "asset",
      debit: 4,
      credit: 0,
    },
    {
      accountId: "whtp",
      code: "2140",
      name: "WHT Payable",
      type: "liability",
      debit: 0,
      credit: 3,
    },
  ];

  it("nets output minus input VAT and reports WHT", () => {
    const s = buildTaxSummary(taxRows, {
      vatOutput: "vout",
      vatInput: "vin",
      whtPayable: "whtp",
      whtReceivable: "whtr",
    });
    expect(s.outputVat).toBe(7);
    expect(s.inputVat).toBe(4);
    expect(s.netVatPayable).toBe(3);
    expect(s.whtPayable).toBe(3);
    expect(s.whtReceivable).toBe(0); // unmapped/absent → 0
  });

  it("treats an unmapped role as zero", () => {
    const s = buildTaxSummary(taxRows, {});
    expect(s.outputVat).toBe(0);
    expect(s.netVatPayable).toBe(0);
  });
});

describe("fiscalYearStartOnOrBefore", () => {
  it("returns this year's start when asOf is after it", () => {
    const d = fiscalYearStartOnOrBefore(new Date("2026-07-15T00:00:00Z"), 1, 1);
    expect(d.toISOString().slice(0, 10)).toBe("2026-01-01");
  });

  it("rolls back a year when asOf is before this year's start (April FY)", () => {
    const d = fiscalYearStartOnOrBefore(new Date("2026-02-15T00:00:00Z"), 4, 1);
    expect(d.toISOString().slice(0, 10)).toBe("2025-04-01");
  });
});
