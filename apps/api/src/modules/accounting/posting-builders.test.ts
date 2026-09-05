import { describe, expect, it } from "vitest";

import {
  assertBalanced,
  computeEntryTotals,
  normalizeLines,
  type PostingLine,
} from "@/modules/accounting/gl-posting.service";
import {
  buildAdvanceApplicationLines,
  buildApDebitNoteLines,
  buildApPaymentLines,
  buildArCreditNoteLines,
  buildArReceiptLines,
  buildBillRecordLines,
  buildInvoiceSendLines,
  buildOverpaymentReceiptLines,
  singleLineAccount,
} from "@/modules/accounting/posting-builders";

// Every builder must produce a balanced entry. This helper normalizes +
// asserts and returns the totals for further assertions.
function balanceOf(lines: PostingLine[]) {
  const norm = normalizeLines(lines);
  assertBalanced(norm); // throws if unbalanced
  return computeEntryTotals(norm);
}

const AR = { arControl: "ar", revenue: "rev", vatOutput: "vout" };
const ARR = {
  arControl: "ar",
  bank: "bank",
  whtReceivable: "whtr",
  fxGain: "fxg",
  fxLoss: "fxl",
};
const AP = { apControl: "ap", expense: "exp", vatInput: "vin" };
const APP = {
  apControl: "ap",
  bank: "bank",
  whtPayable: "whtp",
  fxGain: "fxg",
  fxLoss: "fxl",
};

describe("posting-builders — AR invoice sent", () => {
  it("balances with VAT (Dr AR gross, Cr Revenue, Cr Output VAT)", () => {
    const lines = buildInvoiceSendLines(AR, { subtotal: 1000, taxTotal: 70 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1070.00");
    expect(totalCredit.toFixed(2)).toBe("1070.00");
    // AR debit = gross
    expect(lines.find((l) => l.accountId === "ar")?.debit?.toString()).toBe(
      "1070",
    );
  });

  it("omits the VAT line when tax is zero and still balances", () => {
    const lines = buildInvoiceSendLines(AR, { subtotal: 500, taxTotal: 0 });
    expect(lines.find((l) => l.accountId === "vout")).toBeUndefined();
    const { totalDebit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("500.00");
  });
});

describe("posting-builders — AR receipt", () => {
  it("balances with WHT (Dr Bank + WHT-recv, Cr AR), no FX at par", () => {
    const lines = buildArReceiptLines(ARR, {
      bankBase: 970,
      whtBase: 30,
      arBase: 1000,
    });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1000.00");
    expect(totalCredit.toFixed(2)).toBe("1000.00");
    // AR settled = cash + wht; no FX leg when arBase == bank + wht
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "1000",
    );
    expect(lines.find((l) => l.accountId === "fxg")).toBeUndefined();
    expect(lines.find((l) => l.accountId === "fxl")).toBeUndefined();
  });

  it("balances a plain full receipt (no WHT)", () => {
    const lines = buildArReceiptLines(ARR, { bankBase: 1070, arBase: 1070 });
    expect(lines.find((l) => l.accountId === "whtr")).toBeUndefined();
    const { totalDebit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1070.00");
  });

  it("books a realised FX GAIN when more base is received than the AR was booked at", () => {
    // AR booked at 1000 base; cash received worth 1050 base → 50 gain.
    const lines = buildArReceiptLines(ARR, { bankBase: 1050, arBase: 1000 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1050.00");
    expect(totalCredit.toFixed(2)).toBe("1050.00");
    expect(lines.find((l) => l.accountId === "fxg")?.credit?.toString()).toBe(
      "50",
    );
    expect(lines.find((l) => l.accountId === "fxl")).toBeUndefined();
  });

  it("books a realised FX LOSS when less base is received than booked", () => {
    // AR booked at 1000 base; cash received worth 950 base → 50 loss.
    const lines = buildArReceiptLines(ARR, { bankBase: 950, arBase: 1000 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1000.00");
    expect(totalCredit.toFixed(2)).toBe("1000.00");
    expect(lines.find((l) => l.accountId === "fxl")?.debit?.toString()).toBe(
      "50",
    );
    expect(lines.find((l) => l.accountId === "fxg")).toBeUndefined();
  });
});

describe("posting-builders — AP bill recorded", () => {
  it("balances with input VAT (Dr Expense + Input VAT, Cr AP)", () => {
    const lines = buildBillRecordLines(AP, { subtotal: 2000, taxTotal: 140 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("2140.00");
    expect(totalCredit.toFixed(2)).toBe("2140.00");
    expect(lines.find((l) => l.accountId === "ap")?.credit?.toString()).toBe(
      "2140",
    );
  });
});

describe("posting-builders — AP payment", () => {
  it("balances with WHT (Dr AP, Cr Bank + WHT-payable), no FX at par", () => {
    const lines = buildApPaymentLines(APP, {
      bankBase: 1940,
      whtBase: 60,
      apBase: 2000,
    });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("2000.00");
    expect(totalCredit.toFixed(2)).toBe("2000.00");
    // payable cleared = cash + wht
    expect(lines.find((l) => l.accountId === "ap")?.debit?.toString()).toBe(
      "2000",
    );
    expect(lines.find((l) => l.accountId === "fxg")).toBeUndefined();
    expect(lines.find((l) => l.accountId === "fxl")).toBeUndefined();
  });

  it("balances a plain payment (no WHT)", () => {
    const lines = buildApPaymentLines(APP, { bankBase: 500, apBase: 500 });
    expect(lines.find((l) => l.accountId === "whtp")).toBeUndefined();
    const { totalCredit } = balanceOf(lines);
    expect(totalCredit.toFixed(2)).toBe("500.00");
  });

  it("books a realised FX GAIN when the payable settles for less base than booked", () => {
    // AP booked at 2000 base; paid cash worth 1900 base → 100 gain.
    const lines = buildApPaymentLines(APP, { bankBase: 1900, apBase: 2000 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("2000.00");
    expect(totalCredit.toFixed(2)).toBe("2000.00");
    expect(lines.find((l) => l.accountId === "fxg")?.credit?.toString()).toBe(
      "100",
    );
    expect(lines.find((l) => l.accountId === "fxl")).toBeUndefined();
  });

  it("books a realised FX LOSS when the payable costs more base than booked", () => {
    // AP booked at 2000 base; paid cash worth 2100 base → 100 loss.
    const lines = buildApPaymentLines(APP, { bankBase: 2100, apBase: 2000 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("2100.00");
    expect(totalCredit.toFixed(2)).toBe("2100.00");
    expect(lines.find((l) => l.accountId === "fxl")?.debit?.toString()).toBe(
      "100",
    );
    expect(lines.find((l) => l.accountId === "fxg")).toBeUndefined();
  });
});

describe("posting-builders — AR credit note", () => {
  it("reverses a sale and balances (Dr Revenue + Output VAT, Cr AR gross)", () => {
    const lines = buildArCreditNoteLines(AR, { subtotal: 1000, taxTotal: 70 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1070.00");
    expect(totalCredit.toFixed(2)).toBe("1070.00");
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "1070",
    );
  });

  it("omits VAT when zero and still balances", () => {
    const lines = buildArCreditNoteLines(AR, { subtotal: 400, taxTotal: 0 });
    expect(lines.find((l) => l.accountId === "vout")).toBeUndefined();
    expect(balanceOf(lines).totalDebit.toFixed(2)).toBe("400.00");
  });
});

describe("posting-builders — AP debit note", () => {
  it("reduces a payable and balances (Dr AP gross, Cr Expense + Input VAT)", () => {
    const lines = buildApDebitNoteLines(AP, { subtotal: 2000, taxTotal: 140 });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("2140.00");
    expect(totalCredit.toFixed(2)).toBe("2140.00");
    expect(lines.find((l) => l.accountId === "ap")?.debit?.toString()).toBe(
      "2140",
    );
  });
});

// M4 — statutory adjustment matrix. resolveCreditNoteLines picks a builder from
// (side, kind): a CREDIT note reduces the AR/AP balance; a DEBIT note increases
// it (and so posts like the original invoice/bill). These assert the SIGN each
// combination lands on the control account, guarding that selection.
describe("posting-builders — debit/credit note matrix (M4)", () => {
  const doc = { subtotal: 1000, taxTotal: 70 };

  it("AR debit note increases the receivable (AR on the DEBIT side)", () => {
    // Statutory ใบเพิ่มหนี้ — reuses the invoice-send builder.
    const lines = buildInvoiceSendLines(AR, doc);
    expect(lines.find((l) => l.accountId === "ar")?.debit?.toString()).toBe(
      "1070",
    );
    expect(lines.find((l) => l.accountId === "ar")?.credit).toBeUndefined();
  });

  it("AR credit note decreases the receivable (AR on the CREDIT side)", () => {
    const lines = buildArCreditNoteLines(AR, doc);
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "1070",
    );
    expect(lines.find((l) => l.accountId === "ar")?.debit).toBeUndefined();
  });

  it("AP debit note increases the payable (AP on the CREDIT side)", () => {
    // Supplier raises the bill — reuses the bill-record builder.
    const lines = buildBillRecordLines(AP, doc);
    expect(lines.find((l) => l.accountId === "ap")?.credit?.toString()).toBe(
      "1070",
    );
    expect(lines.find((l) => l.accountId === "ap")?.debit).toBeUndefined();
  });

  it("AP credit note decreases the payable (AP on the DEBIT side)", () => {
    const lines = buildApDebitNoteLines(AP, doc);
    expect(lines.find((l) => l.accountId === "ap")?.debit?.toString()).toBe(
      "1070",
    );
    expect(lines.find((l) => l.accountId === "ap")?.credit).toBeUndefined();
  });
});

describe("posting-builders — overpayment receipt (M3)", () => {
  const acc = {
    bank: "bank",
    arControl: "ar",
    excessAccount: "adv",
    outputVat: "vat",
  };

  it("Dr Bank(full) / Cr AR(applied) / Cr Advances(excess), balanced", () => {
    const lines = buildOverpaymentReceiptLines(acc, {
      applied: 800,
      excess: 200,
    });
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("1000.00");
    expect(totalCredit.toFixed(2)).toBe("1000.00");
    expect(lines.find((l) => l.accountId === "bank")?.debit?.toString()).toBe(
      "1000",
    );
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "800",
    );
    expect(lines.find((l) => l.accountId === "adv")?.credit?.toString()).toBe(
      "200",
    );
  });

  it("all-excess (applied 0) omits the AR leg and still balances", () => {
    const lines = buildOverpaymentReceiptLines(acc, {
      applied: 0,
      excess: 500,
    });
    expect(lines.find((l) => l.accountId === "ar")).toBeUndefined();
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("500.00");
    expect(totalCredit.toFixed(2)).toBe("500.00");
  });
});

describe("posting-builders — apply customer advance (M3)", () => {
  it("Dr Customer Advances / Cr AR, balanced", () => {
    const lines = buildAdvanceApplicationLines(
      { customerAdvances: "adv", arControl: "ar" },
      { baseApplied: 300 },
    );
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("300.00");
    expect(totalCredit.toFixed(2)).toBe("300.00");
    expect(lines.find((l) => l.accountId === "adv")?.debit?.toString()).toBe(
      "300",
    );
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "300",
    );
  });

  // The correction to the PRD's worked example: the receivable is cleared by
  // the GROSS, and the VAT declared when the advance was received is released.
  it("relieves the advance VAT and settles the gross against AR", () => {
    const lines = buildAdvanceApplicationLines(
      { customerAdvances: "adv", arControl: "ar", outputVat: "vat" },
      { baseApplied: 8232.71, vatRelieved: 576.29 },
    );
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("8809.00");
    expect(totalCredit.toFixed(2)).toBe("8809.00");
    expect(lines.find((l) => l.accountId === "vat")?.debit?.toString()).toBe(
      "576.29",
    );
    expect(lines.find((l) => l.accountId === "ar")?.credit?.toString()).toBe(
      "8809",
    );
  });

  it("refuses to relieve VAT with no output VAT account mapped", () => {
    expect(() =>
      buildAdvanceApplicationLines(
        { customerAdvances: "adv", arControl: "ar" },
        { baseApplied: 100, vatRelieved: 7 },
      ),
    ).toThrow(/output VAT account/);
  });
});

describe("posting-builders — advance receipt carrying VAT", () => {
  it("splits the excess into base and output VAT", () => {
    const lines = buildOverpaymentReceiptLines(
      {
        bank: "bank",
        arControl: "ar",
        excessAccount: "adv",
        outputVat: "vat",
      },
      { applied: 141191, excess: 8809, excessVat: 576.29 },
    );
    const { totalDebit, totalCredit } = balanceOf(lines);
    expect(totalDebit.toFixed(2)).toBe("150000.00");
    expect(totalCredit.toFixed(2)).toBe("150000.00");
    expect(lines.find((l) => l.accountId === "adv")?.credit?.toString()).toBe(
      "8232.71",
    );
    expect(lines.find((l) => l.accountId === "vat")?.credit?.toString()).toBe(
      "576.29",
    );
  });

  it("books a refundable excess whole, with no VAT leg", () => {
    const lines = buildOverpaymentReceiptLines(
      { bank: "bank", arControl: "ar", excessAccount: "refund" },
      { applied: 141191, excess: 8809, excessVat: 0 },
    );
    expect(
      lines.find((l) => l.accountId === "refund")?.credit?.toString(),
    ).toBe("8809");
    expect(lines.some((l) => l.memo?.includes("Output VAT"))).toBe(false);
  });
});

describe("singleLineAccount (category routing)", () => {
  it("returns the account when every line routes to the same one", () => {
    expect(
      singleLineAccount([{ glAccountId: "acc-1" }, { glAccountId: "acc-1" }]),
    ).toBe("acc-1");
  });

  it("falls back (null) when no line carries an account", () => {
    expect(
      singleLineAccount([{ glAccountId: null }, { glAccountId: undefined }]),
    ).toBeNull();
    expect(singleLineAccount([{}])).toBeNull();
  });

  it("falls back (null) when lines mix multiple accounts", () => {
    expect(
      singleLineAccount([{ glAccountId: "acc-1" }, { glAccountId: "acc-2" }]),
    ).toBeNull();
  });

  it("ignores empty accounts among a single real one", () => {
    expect(
      singleLineAccount([{ glAccountId: "acc-1" }, { glAccountId: null }]),
    ).toBe("acc-1");
  });
});
