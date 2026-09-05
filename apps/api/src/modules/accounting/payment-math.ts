// Pure payment-tracking math (DB-free, unit-tested).
//
// `amountPaid` tracks the CASH received/paid against an invoice's stored
// `amount` (which is already net of withholding tax — see computeInvoiceTotals).
// Withholding tax is booked as a separate GL leg at payment time and is NOT
// part of amountPaid, so an invoice is "paid" once its net cash is settled.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Half-a-cent tolerance so floating-point dust never blocks an exact settlement
// or misclassifies a fully-paid invoice as partial.
const EPSILON = 0.005;

export type SettledStatus = "partial" | "paid";

export interface PaymentValidation {
  ok: boolean;
  reason?: string;
}

// Reject non-positive amounts and any payment that would over-settle the net
// amount due. Over-payment is a data error, not a credit — the caller rejects it
// rather than silently creating a negative balance.
export function validatePaymentAmount(
  amountDue: number,
  alreadyPaid: number,
  paymentAmount: number,
): PaymentValidation {
  if (!(paymentAmount > 0)) {
    return { ok: false, reason: "Payment amount must be greater than zero." };
  }
  const outstanding = round2(amountDue - alreadyPaid);
  if (round2(paymentAmount) > round2(outstanding) + EPSILON) {
    return {
      ok: false,
      reason: `Payment ${paymentAmount.toFixed(2)} exceeds the outstanding balance ${outstanding.toFixed(2)}.`,
    };
  }
  return { ok: true };
}

// New cumulative cash paid after applying `paymentAmount`.
export function nextAmountPaid(
  alreadyPaid: number,
  paymentAmount: number,
): number {
  return round2(alreadyPaid + paymentAmount);
}

// An invoice is fully settled once cumulative cash reaches the net amount due
// (within tolerance); otherwise it is partially paid.
export function settledStatusAfter(
  amountDue: number,
  newAmountPaid: number,
): SettledStatus {
  return newAmountPaid + EPSILON >= amountDue ? "paid" : "partial";
}
