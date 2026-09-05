import { computeArDocument } from "./document-calc";
import { round2 } from "./invoice-calc.shared";
export { round2 } from "./invoice-calc.shared";

export function computeInvoiceCalc(input: {
  lineItems: Array<{
    quantity: number;
    unitPrice: number;
    lineDiscount?: number;
    vatRate?: number;
    vatReason?: string;
    capitalised?: boolean;
  }>;
  vatRate: number;
  taxRate: number;
  whtRate: number;
  headerDiscount?: number;
  userTotal?: number;
}) {
  const doc = computeArDocument(
    input.lineItems.map((li) => ({
      qty: li.quantity,
      unitPrice: li.unitPrice,
      lineDiscount: li.lineDiscount,
      vatRate: li.vatRate ?? input.vatRate,
      vatReason: li.vatReason,
      capitalised: li.capitalised,
    })),
    input.headerDiscount ?? 0,
    input.userTotal,
  );
  const extraTax = round2(doc.subtotal * (input.taxRate / 100));
  const whtAmount = round2(doc.subtotal * (input.whtRate / 100));
  const total = round2(doc.grandTotal + extraTax - whtAmount);
  return { doc, extraTax, whtAmount, total };
}
