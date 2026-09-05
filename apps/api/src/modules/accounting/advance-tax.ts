// Tax arithmetic for customer advances and supplier prepayments.
//
// Pure + DB-free. The rules here are the ones that decide whether the company
// remits the right amount of VAT, so they are unit-tested in isolation rather
// than only through the posting paths.

import { roundMoney } from "@/modules/accounting/rounding";

/** Why the money is held. See the CustomerAdvance model comment. */
export type AdvanceKind = "advance" | "refundable";
export type AdvanceSide = "ar" | "ap";

/**
 * An advance is a payment for goods or services still to come, so the
 * obligation it creates is to DELIVER, not to pay cash. Under TAS 21 that makes
 * it non-monetary, and non-monetary items are not retranslated at the closing
 * rate — they stay at the rate on the day the money moved.
 *
 * A refundable overpayment is the opposite: the obligation is to hand cash
 * back, which is monetary and IS retranslated.
 *
 * Retranslating an advance manufactures an FX gain or loss on money that will
 * never be paid or received in cash.
 */
export function isMonetaryAdvance(kind: AdvanceKind): boolean {
  return kind === "refundable";
}

export interface AdvanceVatSplit {
  /** Ex-VAT amount, recorded as the liability / asset. */
  taxBase: number;
  /** VAT inside the gross, due at receipt for kind='advance'. */
  vat: number;
}

/**
 * Split a VAT-inclusive advance into base and tax.
 *
 * The gross is treated as tax-INCLUSIVE, which is what the money actually is:
 * the customer transferred one figure and the tax is inside it. A zero rate
 * (or a refundable overpayment, which never calls this) returns the whole
 * amount as base.
 */
export function splitAdvanceVat(
  gross: number,
  ratePercent: number,
): AdvanceVatSplit {
  if (!(ratePercent > 0)) {
    return { taxBase: roundMoney(gross), vat: 0 };
  }
  const base = roundMoney(gross / (1 + ratePercent / 100));
  // Derive the tax by subtraction so base + vat is exactly the cash received.
  // Rounding each half independently can leave the pair a satang short of the
  // money, and the journal would not balance.
  return { taxBase: base, vat: roundMoney(gross - base) };
}

export interface AdvanceApplication {
  /** Gross taken off the invoice's balance. */
  grossApplied: number;
  /** VAT released back, reversing what was declared at receipt. */
  vatRelieved: number;
  /** The liability / asset drawn down. */
  baseApplied: number;
}

/**
 * Apply an advance to a later invoice.
 *
 * This is the step the PRD's worked example gets wrong. It applied only the
 * ex-VAT base against the receivable and left the VAT declared at receipt
 * stranded — so the later invoice charged tax on a base the advance had already
 * been taxed on, and the company over-remitted.
 *
 * The correct move settles the GROSS against the receivable and relieves the
 * VAT the advance carried, proportionally to how much of it is being used. The
 * tax point stays at receipt (which is what the system's issue-on-receipt model
 * requires); the later invoice's VAT is simply reduced by the part already
 * declared. Across both documents the base is counted once and the tax is
 * remitted once.
 *
 * `available` and `requestedGross` are both GROSS figures.
 */
export function applyAdvance(opts: {
  /** Gross balance still on the advance. */
  available: number;
  /** VAT still sitting inside `available`. */
  vatAvailable: number;
  /** Gross the caller wants to use, capped at `available`. */
  requestedGross: number;
}): AdvanceApplication {
  const available = roundMoney(opts.available);
  const requested = roundMoney(Math.min(opts.requestedGross, available));
  if (requested <= 0) {
    return { grossApplied: 0, vatRelieved: 0, baseApplied: 0 };
  }
  // Proportional, so a partial draw-down releases a proportional slice of tax.
  // Using the whole remaining VAT on a partial application would relieve tax
  // that is still owed on the unused part.
  const vatRelieved =
    available > 0
      ? roundMoney((roundMoney(opts.vatAvailable) * requested) / available)
      : 0;
  return {
    grossApplied: requested,
    vatRelieved,
    baseApplied: roundMoney(requested - vatRelieved),
  };
}

/**
 * The excess on a receipt or disbursement, in this codebase's terms.
 *
 * The PRD writes this as `cash - allocated + WHT + bank fee`, which cannot be
 * copied literally here:
 *
 *  - `invoice.amount` is stored NET of withholding tax and the withheld amount
 *    clears the balance alongside the cash, so adding WHT again invents an
 *    excess that does not exist.
 *  - `cash` is already the figure BEFORE the bank fee is taken (the fee posts
 *    as its own leg), so adding the fee counts it twice.
 *
 * What is actually left over is the cash that no open document claimed.
 */
export function computeSettlementExcess(opts: {
  /** Cash on the payment, before the bank fee leg. */
  cashAmount: number;
  /** Σ of the allocations, net of WHT, in the same currency. */
  allocatedNet: number;
}): number {
  const excess = roundMoney(opts.cashAmount - opts.allocatedNet);
  return excess > 0 ? excess : 0;
}
