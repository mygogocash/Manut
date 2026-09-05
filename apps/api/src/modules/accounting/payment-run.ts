// Payment run (M6): pay many supplier bills in one operation. A run is a set of
// settlement lines that we GROUP BY PAYEE and settle one supplier at a time —
// each group becomes one bank payment via the (flag-gated, tested) multi-invoice
// write path. Keeping the grouping pure makes the fan-out unit-testable; the
// service does the I/O and reuses recordAllocatedPayment per group so there is
// no new money-math here.

export interface PaymentRunLine {
  invoiceId: string;
  amount: number; // net cash applied to this bill (WHT additional)
  whtAmount: number;
}

export interface PayeeGroup {
  payeeKey: string;
  lines: PaymentRunLine[];
}

// Group the lines by payee, preserving first-seen order (so the resulting
// payments come out in a stable, predictable sequence). `payeeKeyOf` maps an
// invoice id to its payee key (vendor id, or a synthetic key for un-linked
// bills) — resolved by the caller from the loaded invoices.
export function groupLinesByPayee(
  lines: PaymentRunLine[],
  payeeKeyOf: (invoiceId: string) => string,
): PayeeGroup[] {
  const groups = new Map<string, PaymentRunLine[]>();
  const order: string[] = [];
  for (const line of lines) {
    const key = payeeKeyOf(line.invoiceId);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
      order.push(key);
    }
    bucket.push(line);
  }
  return order.map((payeeKey) => ({
    payeeKey,
    lines: groups.get(payeeKey) as PaymentRunLine[],
  }));
}
