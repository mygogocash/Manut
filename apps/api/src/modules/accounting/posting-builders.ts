import { Prisma } from "@nexora/database";

import type { PostingLine } from "@/modules/accounting/gl-posting.service";

// Pure builders that translate an accounting EVENT into the debit/credit lines
// of its journal entry. The account ids are resolved by the caller (via
// resolveMappedAccount + the bank account's glAccount) and passed in, so these
// functions stay DB-free and unit-testable. Every builder returns a balanced
// set of lines (Σdebit = Σcredit); the tests assert that invariant.
//
// Sign convention matches gl-posting: debit increases asset/expense balances,
// credit increases liability/revenue/equity balances.

const D = Prisma.Decimal;
type Amt = number | string | Prisma.Decimal;

// ── AR: invoice sent ────────────────────────────────────────────────────────
// Dr Accounts Receivable (gross = subtotal + output VAT)
// Cr Revenue (subtotal)
// Cr Output VAT (taxTotal)
export interface ArInvoiceAccounts {
  arControl: string;
  revenue: string;
  vatOutput: string;
  vatDeferred?: string;
  rounding?: string;
}

export function buildInvoiceSendLines(
  acc: ArInvoiceAccounts,
  doc: { subtotal: Amt; taxTotal: Amt; rounding?: Amt },
): PostingLine[] {
  const subtotal = new D(doc.subtotal);
  const tax = new D(doc.taxTotal);
  const rounding = new D(doc.rounding ?? 0);
  const gross = subtotal.plus(tax).plus(rounding);
  const vatAccount = acc.vatDeferred ?? acc.vatOutput;
  const vatMemo = acc.vatDeferred ? "Deferred Output VAT" : "Output VAT";
  return [
    { accountId: acc.arControl, debit: gross, memo: "Accounts receivable" },
    { accountId: acc.revenue, credit: subtotal, memo: "Revenue" },
    ...(tax.isZero()
      ? []
      : [{ accountId: vatAccount, credit: tax, memo: vatMemo }]),
    ...(rounding.isZero() || !acc.rounding
      ? []
      : rounding.greaterThan(0)
        ? [
            {
              accountId: acc.rounding,
              credit: rounding,
              memo: "Satang rounding",
            },
          ]
        : [
            {
              accountId: acc.rounding,
              debit: rounding.negated(),
              memo: "Satang rounding",
            },
          ]),
  ];
}

export function buildOutputVatRecognitionLines(opts: {
  deferredVatAccount: string;
  outputVatAccount: string;
  amount: Amt;
}): PostingLine[] {
  const amount = new D(opts.amount);
  if (amount.isZero()) return [];
  return [
    {
      accountId: opts.deferredVatAccount,
      debit: amount,
      memo: "Recognise output VAT on collection",
    },
    {
      accountId: opts.outputVatAccount,
      credit: amount,
      memo: "Output VAT",
    },
  ];
}

export function buildInputVatRecognitionLines(opts: {
  deferredVatAccount: string;
  inputVatAccount: string;
  amount: Amt;
}): PostingLine[] {
  const amount = new D(opts.amount);
  if (amount.isZero()) return [];
  return [
    {
      accountId: opts.inputVatAccount,
      debit: amount,
      memo: "Input VAT",
    },
    {
      accountId: opts.deferredVatAccount,
      credit: amount,
      memo: "Recognise input VAT from deferred",
    },
  ];
}

// ── AR: payment received ─────────────────────────────────────────────────────
// The customer settles cash into our bank and may withhold WHT, which they
// remit to the revenue department on our behalf — we book it as a tax
// receivable. All amounts are in the entity's BASE (reporting) currency:
//   bankBase = cash received × the settlement-date rate
//   whtBase  = WHT withheld  × the invoice (booked) rate
//   arBase   = receivable cleared (cash + WHT) × the invoice rate
// The realised FX difference balances the entry: a positive `arBase − bankBase
// − whtBase` means the receivable was booked at a higher base than the cash +
// WHT realised on settlement → a loss; a negative delta → a gain. For a
// base-currency (or same-rate) settlement the delta is zero and no FX leg is
// emitted, so THB-only entities post exactly as before.
// Dr Bank · Dr WHT Receivable · [Dr FX loss | Cr FX gain] · Cr Accounts Receivable
export interface ArReceiptAccounts {
  arControl: string;
  bank: string;
  whtReceivable: string;
  fxGain: string;
  fxLoss: string;
}

export function buildArReceiptLines(
  acc: ArReceiptAccounts,
  p: { bankBase: Amt; whtBase?: Amt; arBase: Amt },
): PostingLine[] {
  const bank = new D(p.bankBase);
  const wht = new D(p.whtBase ?? 0);
  const ar = new D(p.arBase);
  const fxDelta = ar.minus(bank).minus(wht);
  return [
    { accountId: acc.bank, debit: bank, memo: "Cash received" },
    ...(wht.isZero()
      ? []
      : [
          {
            accountId: acc.whtReceivable,
            debit: wht,
            memo: "WHT withheld by customer",
          },
        ]),
    ...(fxDelta.isZero()
      ? []
      : fxDelta.greaterThan(0)
        ? [{ accountId: acc.fxLoss, debit: fxDelta, memo: "Realised FX loss" }]
        : [
            {
              accountId: acc.fxGain,
              credit: fxDelta.negated(),
              memo: "Realised FX gain",
            },
          ]),
    {
      accountId: acc.arControl,
      credit: ar,
      memo: "Settle receivable",
    },
  ];
}

// ── AP: bill recorded ────────────────────────────────────────────────────────
// Dr Expense/Asset (subtotal) · Dr Input VAT (taxTotal) · Cr Accounts Payable (gross)
export interface ApBillAccounts {
  apControl: string;
  expense: string;
  vatInput: string;
  vatDeferred?: string;
}

export function buildBillRecordLines(
  acc: ApBillAccounts,
  doc: { subtotal: Amt; taxTotal: Amt },
): PostingLine[] {
  const subtotal = new D(doc.subtotal);
  const tax = new D(doc.taxTotal);
  const gross = subtotal.plus(tax);
  const vatAccount = acc.vatDeferred ?? acc.vatInput;
  const vatMemo = acc.vatDeferred ? "Deferred Input VAT" : "Input VAT";
  return [
    { accountId: acc.expense, debit: subtotal, memo: "Expense / asset" },
    ...(tax.isZero()
      ? []
      : [{ accountId: vatAccount, debit: tax, memo: vatMemo }]),
    { accountId: acc.apControl, credit: gross, memo: "Accounts payable" },
  ];
}

// The bill's/invoice's "category" GL account: when every line item routes to a
// single explicit account, post the whole subtotal to it (the PRD's
// Dr [expense account by category]). If lines carry no account, or mix several,
// fall back to the entity's expense_default / revenue_default mapping — keeping
// the send entry a single, rounding-safe debit rather than a per-line split.
export function singleLineAccount(
  lines: Array<{ glAccountId?: string | null }>,
): string | null {
  const ids = [
    ...new Set(
      lines.map((l) => l.glAccountId).filter((x): x is string => Boolean(x)),
    ),
  ];
  return ids.length === 1 ? ids[0]! : null;
}

// ── AP: bill paid ────────────────────────────────────────────────────────────
// We pay cash from the bank and withhold WHT we must remit to the revenue
// department (a payable). All amounts are in the entity's BASE currency:
//   bankBase = cash paid   × the settlement-date rate
//   whtBase  = WHT withheld × the bill (booked) rate
//   apBase   = payable cleared (cash + WHT) × the bill rate
// A positive `apBase − bankBase − whtBase` means we owed more base than the
// cash + WHT settled → a realised gain; a negative delta → a loss. Zero delta
// (base/same-rate) emits no FX leg.
// Dr Accounts Payable · Cr Bank · Cr WHT Payable · [Cr FX gain | Dr FX loss]
export interface ApPaymentAccounts {
  apControl: string;
  bank: string;
  whtPayable: string;
  fxGain: string;
  fxLoss: string;
}

export function buildApPaymentLines(
  acc: ApPaymentAccounts,
  p: { bankBase: Amt; whtBase?: Amt; apBase: Amt },
): PostingLine[] {
  const bank = new D(p.bankBase);
  const wht = new D(p.whtBase ?? 0);
  const ap = new D(p.apBase);
  const fxDelta = ap.minus(bank).minus(wht);
  return [
    {
      accountId: acc.apControl,
      debit: ap,
      memo: "Settle payable",
    },
    { accountId: acc.bank, credit: bank, memo: "Cash paid" },
    ...(wht.isZero()
      ? []
      : [
          {
            accountId: acc.whtPayable,
            credit: wht,
            memo: "WHT withheld from supplier",
          },
        ]),
    ...(fxDelta.isZero()
      ? []
      : fxDelta.greaterThan(0)
        ? [{ accountId: acc.fxGain, credit: fxDelta, memo: "Realised FX gain" }]
        : [
            {
              accountId: acc.fxLoss,
              debit: fxDelta.negated(),
              memo: "Realised FX loss",
            },
          ]),
  ];
}

// ── AR credit note (reverses part of a sale) ─────────────────────────────────
// Dr Revenue (subtotal) · Dr Output VAT (taxTotal) · Cr Accounts Receivable (gross)
export interface ArCreditNoteAccounts {
  arControl: string;
  revenue: string;
  vatOutput: string;
}

export function buildArCreditNoteLines(
  acc: ArCreditNoteAccounts,
  doc: { subtotal: Amt; taxTotal: Amt },
): PostingLine[] {
  const subtotal = new D(doc.subtotal);
  const tax = new D(doc.taxTotal);
  const gross = subtotal.plus(tax);
  return [
    { accountId: acc.revenue, debit: subtotal, memo: "Revenue (credit note)" },
    ...(tax.isZero()
      ? []
      : [
          { accountId: acc.vatOutput, debit: tax, memo: "Output VAT reversal" },
        ]),
    { accountId: acc.arControl, credit: gross, memo: "AR (credit note)" },
  ];
}

// ── AP debit note (reduces what we owe a supplier) ───────────────────────────
// Dr Accounts Payable (gross) · Cr Expense/Asset (subtotal) · Cr Input VAT (taxTotal)
export interface ApDebitNoteAccounts {
  apControl: string;
  expense: string;
  vatInput: string;
}

export function buildApDebitNoteLines(
  acc: ApDebitNoteAccounts,
  doc: { subtotal: Amt; taxTotal: Amt },
): PostingLine[] {
  const subtotal = new D(doc.subtotal);
  const tax = new D(doc.taxTotal);
  const gross = subtotal.plus(tax);
  return [
    { accountId: acc.apControl, debit: gross, memo: "AP (debit note)" },
    { accountId: acc.expense, credit: subtotal, memo: "Expense (debit note)" },
    ...(tax.isZero()
      ? []
      : [{ accountId: acc.vatInput, credit: tax, memo: "Input VAT reversal" }]),
  ];
}

// ── AR overpayment receipt (M3) ──────────────────────────────────────────────
// A receipt that clears the invoice AND leaves an excess captured as a customer
// advance. Base-currency, no-WHT path (the only one the service allows):
// Dr Bank (applied + excess) · Cr Accounts Receivable (applied) · Cr Customer
// Advances (excess).
export interface OverpaymentReceiptAccounts {
  bank: string;
  arControl: string;
  /** customer_advances for kind='advance', customer_overpayments_refundable
   *  for kind='refundable'. Resolved by the caller from the chosen kind. */
  excessAccount: string;
  /** Only needed when the excess carries VAT. */
  outputVat?: string;
}

/**
 * A receipt that clears the invoice AND leaves an excess.
 *
 * Where the excess is an ADVANCE for future work, output VAT falls due on it at
 * receipt (this system issues the tax invoice then), so the excess is split:
 * the ex-VAT base goes to the advance liability and the tax to output VAT. A
 * REFUNDABLE overpayment is not a sale, so it carries no tax and the whole
 * excess lands in the liability — pass `excessVat: 0`.
 */
export function buildOverpaymentReceiptLines(
  acc: OverpaymentReceiptAccounts,
  p: { applied: Amt; excess: Amt; excessVat?: Amt },
): PostingLine[] {
  const applied = new D(p.applied);
  const excess = new D(p.excess);
  const vat = new D(p.excessVat ?? 0);
  const base = excess.minus(vat);
  const lines: PostingLine[] = [
    { accountId: acc.bank, debit: applied.plus(excess), memo: "Cash received" },
  ];
  if (!applied.isZero()) {
    lines.push({
      accountId: acc.arControl,
      credit: applied,
      memo: "Settle receivable",
    });
  }
  lines.push({
    accountId: acc.excessAccount,
    credit: base,
    memo: "Customer advance (overpayment)",
  });
  if (!vat.isZero()) {
    if (!acc.outputVat) {
      throw new Error(
        "An advance carrying VAT needs an output VAT account mapped",
      );
    }
    lines.push({
      accountId: acc.outputVat,
      credit: vat,
      memo: "Output VAT on advance",
    });
  }
  return lines;
}

// ── AP overpayment disbursement ──────────────────────────────────────────────
// Dr Accounts Payable (applied) · Dr Vendor Advances (excess) · Cr Bank (full).
export interface OverpaymentPaymentAccounts {
  bank: string;
  apControl: string;
  /** vendor_advances for a prepayment, vendor_overpayments_refundable for money
   *  paid in error. */
  vendorAdvances: string;
}

export function buildOverpaymentPaymentLines(
  acc: OverpaymentPaymentAccounts,
  p: { applied: Amt; excess: Amt },
): PostingLine[] {
  const applied = new D(p.applied);
  const excess = new D(p.excess);
  const lines: PostingLine[] = [];
  if (!applied.isZero()) {
    lines.push({
      accountId: acc.apControl,
      debit: applied,
      memo: "Settle payable",
    });
  }
  lines.push({
    accountId: acc.vendorAdvances,
    debit: excess,
    memo: "Vendor advance (overpayment)",
  });
  lines.push({
    accountId: acc.bank,
    credit: applied.plus(excess),
    memo: "Cash paid",
  });
  return lines;
}

// ── Bank fee on a receipt/disbursement ───────────────────────────────────────
// Dr bank_charges · Cr Bank. Net bank movement is cash ± fee.
export function buildBankFeeLines(
  acc: { bankCharges: string; bank: string },
  fee: Amt,
): PostingLine[] {
  const amount = new D(fee);
  if (amount.isZero()) return [];
  return [
    { accountId: acc.bankCharges, debit: amount, memo: "Bank fee" },
    { accountId: acc.bank, credit: amount, memo: "Bank fee" },
  ];
}

// ── Apply a customer advance to an AR invoice (M3) ───────────────────────────
// Draw down an advance to settle a later invoice (no cash moves):
// Dr Customer Advances · Cr Accounts Receivable.
export interface AdvanceApplicationAccounts {
  customerAdvances: string;
  arControl: string;
  /** Required when the advance carried VAT. */
  outputVat?: string;
}

/**
 * Draw an advance down against a later invoice. No cash moves.
 *
 * The GROSS comes off the receivable and, where the advance carried VAT, that
 * VAT is relieved — reversing what was declared at receipt. Without the relief
 * the follow-on invoice charges tax on a base the advance was already taxed on
 * and the company over-remits; that is the defect in the PRD's worked example.
 *
 * Dr Customer Advances (base) · Dr Output VAT (relieved) · Cr AR (gross)
 */
export function buildAdvanceApplicationLines(
  acc: AdvanceApplicationAccounts,
  p: { baseApplied: Amt; vatRelieved?: Amt },
): PostingLine[] {
  const base = new D(p.baseApplied);
  const vat = new D(p.vatRelieved ?? 0);
  const lines: PostingLine[] = [
    {
      accountId: acc.customerAdvances,
      debit: base,
      memo: "Apply customer advance",
    },
  ];
  if (!vat.isZero()) {
    if (!acc.outputVat) {
      throw new Error(
        "Relieving VAT on an advance needs an output VAT account mapped",
      );
    }
    lines.push({
      accountId: acc.outputVat,
      debit: vat,
      memo: "Reverse output VAT declared on the advance",
    });
  }
  lines.push({
    accountId: acc.arControl,
    credit: base.plus(vat),
    memo: "Settle receivable",
  });
  return lines;
}

// ── Apply a supplier prepayment to a bill ───────────────────────────────────
// Dr Accounts Payable · Cr Vendor Advances. No cash moves.
//
// No VAT leg, unlike the AR side. Input tax is not recoverable when the money
// is paid — the right to it arises when the SUPPLIER issues their tax invoice,
// which is recorded separately (recordPrepaymentTaxInvoice) and has already
// moved the tax out of this asset by the time a bill draws it down.
export function buildVendorPrepaymentApplicationLines(
  acc: { vendorAdvances: string; apControl: string },
  p: { grossApplied: Amt },
): PostingLine[] {
  const amount = new D(p.grossApplied);
  return [
    { accountId: acc.apControl, debit: amount, memo: "Settle payable" },
    {
      accountId: acc.vendorAdvances,
      credit: amount,
      memo: "Apply supplier prepayment",
    },
  ];
}

// ── Supplier issues a tax invoice for a prepayment ──────────────────────────
// Dr Input VAT · Cr Vendor Advances.
//
// Paying a supplier creates no right to input tax; that arises only when their
// tax invoice arrives. The prepayment is therefore carried GROSS until then,
// and this entry moves the tax out of the asset without any cash moving.
export function buildPrepaymentTaxInvoiceLines(
  acc: { inputVat: string; vendorAdvances: string },
  vat: Amt,
): PostingLine[] {
  const amount = new D(vat);
  return [
    {
      accountId: acc.inputVat,
      debit: amount,
      memo: "Input VAT on supplier prepayment",
    },
    {
      accountId: acc.vendorAdvances,
      credit: amount,
      memo: "Reclassify prepayment to input VAT",
    },
  ];
}

// ── Refund an advance / overpayment ─────────────────────────────────────────
// Dr the liability · Cr Bank. Where the advance had VAT declared on it, a
// credit note must be issued first (the service enforces that) and the VAT is
// relieved here alongside.
export function buildAdvanceRefundLines(
  acc: { customerAdvances: string; bank: string; outputVat?: string },
  p: { baseRefunded: Amt; vatRelieved?: Amt },
): PostingLine[] {
  const base = new D(p.baseRefunded);
  const vat = new D(p.vatRelieved ?? 0);
  const lines: PostingLine[] = [
    {
      accountId: acc.customerAdvances,
      debit: base,
      memo: "Refund customer advance",
    },
  ];
  if (!vat.isZero()) {
    if (!acc.outputVat) {
      throw new Error("Refunding a taxed advance needs an output VAT account");
    }
    lines.push({
      accountId: acc.outputVat,
      debit: vat,
      memo: "Reverse output VAT on refunded advance",
    });
  }
  lines.push({
    accountId: acc.bank,
    credit: base.plus(vat),
    memo: "Cash refunded",
  });
  return lines;
}

// ── Fixed assets: monthly depreciation ──────────────────────────────────────
// Dr Depreciation expense
// Cr Accumulated depreciation (contra-asset)
//
// One pair of lines PER CATEGORY, because the two accounts are resolved per
// category. A negative charge (a contra line releasing a credit) flips the
// sides rather than posting a negative debit — a negative amount on a debit
// line is not something a GL report renders correctly, and `assertBalanced`
// would still pass, so the error would be invisible.
export interface FixedAssetDepreciationAccounts {
  depreciationExpense: string;
  accumulatedDepreciation: string;
}

export function buildFixedAssetDepreciationLines(
  acc: FixedAssetDepreciationAccounts,
  charge: Amt,
  memo?: string,
): PostingLine[] {
  const amount = new D(charge);
  if (amount.isZero()) return [];
  const label = memo ?? "Depreciation";
  if (amount.isNegative()) {
    const abs = amount.negated();
    return [
      {
        accountId: acc.accumulatedDepreciation,
        debit: abs,
        memo: `${label} (contra release)`,
      },
      {
        accountId: acc.depreciationExpense,
        credit: abs,
        memo: `${label} (contra release)`,
      },
    ];
  }
  return [
    { accountId: acc.depreciationExpense, debit: amount, memo: label },
    { accountId: acc.accumulatedDepreciation, credit: amount, memo: label },
  ];
}

// ── Fixed assets: disposal / write-off ──────────────────────────────────────
// Dr Accumulated depreciation   (the portion removed with the units disposed)
// Dr Proceeds account           (only when proceeds > 0)
// Cr Asset cost                 (the portion removed)
// Dr Loss  or  Cr Gain          (the balancing figure)
//
// gainLoss is signed the way computeDisposal returns it: positive = gain,
// negative = loss. The two are separate accounts, so the sign picks the account
// AND the side — one signed account could not be split apart later.
export interface FixedAssetDisposalAccounts {
  assetCost: string;
  accumulatedDepreciation: string;
  disposalGain: string;
  disposalLoss: string;
  /**
   * Where the sale proceeds land. Until the cash-leg policy is settled this is
   * a clearing/receivable account, NOT a bank account: writing a bank balance
   * belongs to applyBankMovement, the only permitted writer of
   * BankAccount.currentBalance.
   */
  proceedsClearing: string;
}

export function buildFixedAssetDisposalLines(
  acc: FixedAssetDisposalAccounts,
  doc: {
    costRemoved: Amt;
    accumulatedRemoved: Amt;
    proceeds: Amt;
    gainLoss: Amt;
  },
  memo?: string,
): PostingLine[] {
  const cost = new D(doc.costRemoved);
  const accum = new D(doc.accumulatedRemoved);
  const proceeds = new D(doc.proceeds);
  const gainLoss = new D(doc.gainLoss);
  const label = memo ?? "Fixed asset disposal";

  return [
    { accountId: acc.accumulatedDepreciation, debit: accum, memo: label },
    ...(proceeds.isZero()
      ? []
      : [
          {
            accountId: acc.proceedsClearing,
            debit: proceeds,
            memo: `${label} — proceeds`,
          },
        ]),
    { accountId: acc.assetCost, credit: cost, memo: `${label} — cost` },
    ...(gainLoss.isZero()
      ? []
      : gainLoss.isPositive()
        ? [
            {
              accountId: acc.disposalGain,
              credit: gainLoss,
              memo: `${label} — gain`,
            },
          ]
        : [
            {
              accountId: acc.disposalLoss,
              debit: gainLoss.negated(),
              memo: `${label} — loss`,
            },
          ]),
  ];
}
