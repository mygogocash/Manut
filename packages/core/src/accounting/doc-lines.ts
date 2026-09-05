import { roundMoney } from "./rounding";

export interface DocLineInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  glAccountId?: string;
}

export interface ComputedDocLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
  glAccountId: string | null;
  sortOrder: number;
}

export function computeDocLines(input: DocLineInput[]) {
  const lines = input.map((l, i) => {
    const quantity = l.quantity ?? 0;
    const unitPrice = l.unitPrice ?? 0;
    const taxRate = l.taxRate ?? 0;
    const lineTotal = roundMoney(quantity * unitPrice);
    return {
      description: l.description ?? "",
      quantity,
      unitPrice,
      lineTotal,
      taxRate,
      taxAmount: roundMoney(lineTotal * (taxRate / 100)),
      glAccountId: l.glAccountId ?? null,
      sortOrder: i,
    };
  });
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
  const taxTotal = roundMoney(lines.reduce((s, l) => s + l.taxAmount, 0));
  return {
    lines,
    subtotal,
    taxTotal,
    grandTotal: roundMoney(subtotal + taxTotal),
  };
}
