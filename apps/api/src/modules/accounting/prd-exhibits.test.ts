import { describe, expect, it } from "vitest";

import {
  capitalisedNet,
  computeAccrualRevenue,
  computeOperatingExpense,
  isCapexLine,
} from "@/modules/accounting/prd-exhibits";

const range = {
  start: new Date("2026-08-01T00:00:00.000Z"),
  end: new Date("2026-08-31T23:59:59.000Z"),
};

describe("prd exhibits", () => {
  it("sums pre-VAT receivable invoices and excludes cancelled", () => {
    const revenue = computeAccrualRevenue(
      [
        {
          type: "receivable",
          status: "sent",
          amount: 1070,
          vatRate: 7,
          issueDate: new Date("2026-08-10"),
        },
        {
          type: "receivable",
          status: "cancelled",
          amount: 1070,
          vatRate: 7,
          issueDate: new Date("2026-08-11"),
        },
      ],
      range,
    );
    expect(revenue).toBe(1000);
  });

  it("splits AP pre-VAT opex and a capex sub-line", () => {
    const { operatingExpense, capex } = computeOperatingExpense(
      [
        {
          type: "payable",
          status: "sent",
          amount: 1070,
          vatRate: 7,
          capitalisedAmount: 300,
          issueDate: new Date("2026-08-15"),
        },
      ],
      range,
    );
    expect(operatingExpense).toBe(1000);
    expect(capex).toBe(300);
  });

  // Drafts are not posted — the AR/AP journal entry is written on draft→sent —
  // so an exhibit that reconciles to the P&L must not count them.
  it("excludes unposted drafts from revenue", () => {
    const revenue = computeAccrualRevenue(
      [
        {
          type: "receivable",
          status: "sent",
          amount: 1070,
          vatRate: 7,
          issueDate: new Date("2026-08-10"),
        },
        {
          type: "receivable",
          status: "draft",
          amount: 5350,
          vatRate: 7,
          issueDate: new Date("2026-08-12"),
        },
      ],
      range,
    );
    expect(revenue).toBe(1000);
  });

  it("excludes unposted drafts from operating expense and capex", () => {
    const { operatingExpense, capex } = computeOperatingExpense(
      [
        {
          type: "payable",
          status: "sent",
          amount: 1070,
          vatRate: 7,
          capitalisedAmount: 300,
          issueDate: new Date("2026-08-15"),
        },
        {
          type: "payable",
          status: "draft",
          amount: 8560,
          vatRate: 7,
          capitalisedAmount: 8000,
          issueDate: new Date("2026-08-16"),
        },
      ],
      range,
    );
    expect(operatingExpense).toBe(1000);
    expect(capex).toBe(300);
  });
});

describe("capitalisedNet", () => {
  it("counts only capitalised lines", () => {
    expect(
      capitalisedNet([
        { capitalised: true, taxBase: 80000, unitPrice: 80000, quantity: 1 },
        { capitalised: false, taxBase: 5000, unitPrice: 5000, quantity: 1 },
      ]),
    ).toBe(80000);
  });

  it("prefers taxBase, which is already net of both discounts", () => {
    expect(
      capitalisedNet([
        {
          capitalised: true,
          taxBase: 72000,
          unitPrice: 80000,
          quantity: 1,
          lineDiscount: 8000,
        },
      ]),
    ).toBe(72000);
  });

  // Legacy rows predate the line model and carry no taxBase. Ignoring the line
  // discount here reported a discounted asset above what was paid for it.
  it("nets the line discount on legacy rows with no taxBase", () => {
    expect(
      capitalisedNet([
        {
          capitalised: true,
          taxBase: null,
          unitPrice: 40000,
          quantity: 2,
          lineDiscount: 8000,
        },
      ]),
    ).toBe(72000);
  });

  it("is zero when nothing is capitalised", () => {
    expect(
      capitalisedNet([
        { capitalised: false, taxBase: null, unitPrice: 100, quantity: 3 },
      ]),
    ).toBe(0);
  });
});

describe("isCapexLine", () => {
  const assets = (id: string) => id === "acc-asset";

  // The PRD classifies on the account the line posts to, not on the tick.
  it("follows the account when the line is routed", () => {
    expect(
      isCapexLine(
        {
          capitalised: false,
          glAccountId: "acc-asset",
          unitPrice: 1,
          quantity: 1,
        },
        assets,
      ),
    ).toBe(true);
    expect(
      isCapexLine(
        {
          capitalised: true,
          glAccountId: "acc-expense",
          unitPrice: 1,
          quantity: 1,
        },
        assets,
      ),
    ).toBe(false);
  });

  // Rows predating per-line GL routing have only the tick to go on; ignoring it
  // would silently reclassify that history.
  it("falls back to the tick when the line has no account", () => {
    expect(
      isCapexLine({ capitalised: true, unitPrice: 1, quantity: 1 }, assets),
    ).toBe(true);
    expect(
      isCapexLine({ capitalised: false, unitPrice: 1, quantity: 1 }, assets),
    ).toBe(false);
  });
});

describe("operating expense reconciliation line", () => {
  // The PRD's example 3: 500,000 of approved bills, 80,000 of it capitalised,
  // so 420,000 reaches the income statement and the asset arrives later as
  // depreciation.
  it("reports total, capex, and what actually hits the P&L", () => {
    const result = computeOperatingExpense(
      [
        {
          type: "payable",
          status: "sent",
          amount: 500000,
          vatRate: 0,
          capitalisedAmount: 80000,
          issueDate: new Date("2026-08-15"),
        },
      ],
      range,
    );
    expect(result.operatingExpense).toBe(500000);
    expect(result.capex).toBe(80000);
    expect(result.expenseInProfitAndLoss).toBe(420000);
  });

  it("splits one bill that carries both an expense and an asset line", () => {
    const capex = capitalisedNet(
      [
        {
          capitalised: false,
          glAccountId: "acc-expense",
          taxBase: 30000,
          unitPrice: 30000,
          quantity: 1,
        },
        {
          capitalised: false,
          glAccountId: "acc-asset",
          taxBase: 80000,
          unitPrice: 80000,
          quantity: 1,
        },
      ],
      (id) => id === "acc-asset",
    );
    expect(capex).toBe(80000);
  });
});
