// Settlement-allocation engine (M3/M6). Pure + DB-free so the FIFO split and
// the over-apply / balance rules are unit-tested and reproducible.
//
// A receipt (AR) or disbursement (AP) can settle MANY invoices at once. The
// caller either hands us explicit allocations (validated here) or a single
// "total to settle" that we FIFO-spread across the open documents oldest-first.
// Each allocation's `amount` is the NET cash applied to that invoice (invoices
// are stored net of WHT, and the AR/AP was booked at gross); the withheld tax
// is ADDITIONAL and, together with the cash, clears that gross balance. The
// cash that actually moves is Σ amount across the allocations.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const TOLERANCE = 0.01;

// An open document available to settle. `outstanding` = amount − amountPaid in
// the document's own currency; `whtRate` is a FRACTION (0.03 = 3%), default 0.
export interface OpenInvoice {
  invoiceId: string;
  outstanding: number;
  whtRate?: number;
}

export interface AllocationInput {
  invoiceId: string;
  // Net cash applied to this invoice, in source currency — the same figure
  // recordPayment takes as `amount` (invoice.amount is stored net of WHT). WHT
  // is ADDITIONAL: the receivable/payable clears by (amount + whtAmount).
  amount: number;
  whtAmount: number; // tax withheld on this settlement (source currency)
}

// FIFO-spread `totalToSettle` (net cash) across the invoices in the order given,
// oldest-first. Each invoice takes min(remaining, outstanding). The per-invoice
// `whtAmount` is a rate-based ESTIMATE the caller can adjust before submitting.
// Stops when the cash is exhausted — any leftover (total exceeds the open
// balance) is simply not allocated, so the caller can surface an over-payment.
export function allocateFifo(
  totalToSettle: number,
  invoices: OpenInvoice[],
): AllocationInput[] {
  let remaining = round2(totalToSettle);
  const out: AllocationInput[] = [];
  for (const inv of invoices) {
    if (remaining <= TOLERANCE) break;
    const outstanding = round2(inv.outstanding);
    if (outstanding <= 0) continue;
    const amount = round2(Math.min(remaining, outstanding));
    out.push({
      invoiceId: inv.invoiceId,
      amount,
      whtAmount: round2(amount * (inv.whtRate ?? 0)),
    });
    remaining = round2(remaining - amount);
  }
  return out;
}

export interface AllocationValidation {
  valid: boolean;
  totalAmount: number; // Σ net cash applied — the money that actually moves
  totalWht: number; // Σ withheld (additional; booked as a separate GL leg)
  errors: string[];
}

// Validate caller-supplied allocations against the invoices' open balances:
// positive amounts, no duplicates, no unknown invoice, and never more than a
// document's outstanding balance. Returns the rolled-up totals so the service
// can post one balanced entry and check the cash against the bank movement.
export function validateAllocations(
  allocations: AllocationInput[],
  outstandingByInvoice: Map<string, number>,
): AllocationValidation {
  const errors: string[] = [];
  const seen = new Set<string>();
  let totalAmount = 0;
  let totalWht = 0;

  if (allocations.length === 0) {
    errors.push("At least one allocation is required");
  }

  for (const a of allocations) {
    if (seen.has(a.invoiceId)) {
      errors.push(`Duplicate allocation for invoice ${a.invoiceId}`);
    }
    seen.add(a.invoiceId);

    if (a.amount <= 0) {
      errors.push(`Allocation for invoice ${a.invoiceId} must be positive`);
    }
    if (a.whtAmount < 0) {
      errors.push(`WHT for invoice ${a.invoiceId} cannot be negative`);
    }
    if (a.whtAmount > round2(a.amount) + TOLERANCE) {
      errors.push(
        `WHT for invoice ${a.invoiceId} cannot exceed the settled amount`,
      );
    }

    const outstanding = outstandingByInvoice.get(a.invoiceId);
    if (outstanding === undefined) {
      errors.push(`Unknown or ineligible invoice ${a.invoiceId}`);
    } else if (a.amount > round2(outstanding) + TOLERANCE) {
      errors.push(
        `Allocation ${a.amount} exceeds the ${round2(outstanding)} outstanding on invoice ${a.invoiceId}`,
      );
    }

    totalAmount = round2(totalAmount + a.amount);
    totalWht = round2(totalWht + a.whtAmount);
  }

  return {
    valid: errors.length === 0,
    totalAmount,
    totalWht,
    errors,
  };
}
