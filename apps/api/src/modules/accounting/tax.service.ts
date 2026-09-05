import { Prisma } from "@nexora/database";

// Thai tax computation (VAT + WHT) over document lines. All arithmetic uses
// Prisma.Decimal (decimal.js) — never JS floats — per NFR-1. Money amounts are
// rounded to 2 dp per line (ROUND_HALF_UP), so the summed totals match what the
// UI and GL show. Rates are fractional: 0.07 = VAT 7%, 0.03 = WHT 3%.

const D = Prisma.Decimal;

function money(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface RawTaxLine {
  quantity: number | string | Prisma.Decimal;
  unitPrice: number | string | Prisma.Decimal;
  taxRate?: number | string | Prisma.Decimal;
  whtRate?: number | string | Prisma.Decimal;
}

export interface ComputedTaxLine {
  lineTotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  whtRate: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
}

// lineTotal = round(qty × unitPrice); taxAmount = round(lineTotal × taxRate);
// whtAmount = round(lineTotal × whtRate). WHT is informational at line level —
// it is withheld when the payment is recorded, not added to the invoice total.
export function computeTaxLine(line: RawTaxLine): ComputedTaxLine {
  const qty = new D(line.quantity);
  const price = new D(line.unitPrice);
  const taxRate = new D(line.taxRate ?? 0);
  const whtRate = new D(line.whtRate ?? 0);
  const lineTotal = money(qty.times(price));
  return {
    lineTotal,
    taxRate,
    taxAmount: money(lineTotal.times(taxRate)),
    whtRate,
    whtAmount: money(lineTotal.times(whtRate)),
  };
}

export interface DocumentTotals {
  lines: ComputedTaxLine[];
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  whtTotal: Prisma.Decimal;
  // grandTotal = subtotal + taxTotal. WHT is NOT subtracted here — it reduces
  // the cash settled at payment time, but the document's face value is
  // subtotal + VAT.
  grandTotal: Prisma.Decimal;
}

export function computeDocumentTotals(rawLines: RawTaxLine[]): DocumentTotals {
  let subtotal = new D(0);
  let taxTotal = new D(0);
  let whtTotal = new D(0);
  const lines = rawLines.map((raw) => {
    const c = computeTaxLine(raw);
    subtotal = subtotal.plus(c.lineTotal);
    taxTotal = taxTotal.plus(c.taxAmount);
    whtTotal = whtTotal.plus(c.whtAmount);
    return c;
  });
  return {
    lines,
    subtotal: money(subtotal),
    taxTotal: money(taxTotal),
    whtTotal: money(whtTotal),
    grandTotal: money(subtotal.plus(taxTotal)),
  };
}
