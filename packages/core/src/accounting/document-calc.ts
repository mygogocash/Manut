import { BadRequestException } from "../http-exception";
import { applySatangAdjustment, roundMoney } from "./rounding";

export interface ArCalcLineInput {
  description?: string;
  qty: number;
  unitPrice: number;
  lineDiscount?: number;
  vatRate: number;
  vatReason?: string;
  capitalised?: boolean;
}

export interface ArCalcLine {
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  netBeforeHeader: number;
  headerShare: number;
  taxBase: number;
  vatRate: number;
  vatAmount: number;
  amount: number;
  capitalised: boolean;
}

export interface ArDocumentCalc {
  lines: ArCalcLine[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  rounding: number;
}

function requireVatReason(vatRate: number, vatReason?: string) {
  const standard = vatRate === 0 || vatRate === 7;
  if (!standard && !vatReason?.trim()) {
    throw new BadRequestException(
      "A VAT reason is required when the rate is not 0% or 7%",
    );
  }
}

export function computeArDocument(
  rawLines: ArCalcLineInput[],
  headerDiscount = 0,
  userTotal?: number,
): ArDocumentCalc {
  if (rawLines.length === 0) {
    throw new BadRequestException("At least one line is required");
  }
  const prepared = rawLines.map((l) => {
    requireVatReason(l.vatRate, l.vatReason);
    const ext = roundMoney(l.qty * l.unitPrice);
    const lineDiscount = roundMoney(l.lineDiscount ?? 0);
    const netBeforeHeader = roundMoney(ext - lineDiscount);
    if (netBeforeHeader < 0) {
      throw new BadRequestException("Line net cannot be negative");
    }
    return {
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineDiscount,
      netBeforeHeader,
      vatRate: l.vatRate,
      capitalised: l.capitalised === true,
    };
  });
  const netSum = roundMoney(prepared.reduce((s, l) => s + l.netBeforeHeader, 0));
  const header = roundMoney(headerDiscount);
  if (header > netSum) {
    throw new BadRequestException("Header discount exceeds line nets");
  }
  let allocated = 0;
  const withHeader = prepared.map((l, i) => {
    let headerShare = 0;
    if (header > 0 && netSum > 0) {
      if (i < prepared.length - 1) {
        headerShare = roundMoney((l.netBeforeHeader / netSum) * header);
        allocated = roundMoney(allocated + headerShare);
      } else {
        headerShare = roundMoney(header - allocated);
      }
    }
    const taxBase = roundMoney(l.netBeforeHeader - headerShare);
    const vatAmount = roundMoney(taxBase * (l.vatRate / 100));
    const amount = roundMoney(taxBase + vatAmount);
    return { ...l, headerShare, taxBase, vatAmount, amount };
  });
  const subtotal = roundMoney(withHeader.reduce((s, l) => s + l.taxBase, 0));
  const vatTotal = roundMoney(withHeader.reduce((s, l) => s + l.vatAmount, 0));
  let grandTotal = roundMoney(subtotal + vatTotal);
  let rounding = 0;
  if (userTotal !== undefined) {
    const adj = applySatangAdjustment(grandTotal, userTotal);
    grandTotal = adj.total;
    rounding = adj.rounding;
  }
  return { lines: withHeader, subtotal, vatTotal, grandTotal, rounding };
}
