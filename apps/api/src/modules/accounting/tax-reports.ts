// Thai Revenue-Department tax-filing report builders (M9). Pure + DB-free so
// every register is unit-tested and reproducible from the source documents.
//
// Unlike the ledger-based VAT/WHT summary (`reports.ts` buildTaxSummary, which
// reads movements on the mapped control accounts and is therefore empty until
// GL posting is switched on), these registers are built DIRECTLY from the AR/AP
// documents and supplier payments — so they work in production while GL posting
// stays gated.
//
// All amounts are presented in the entity BASE currency (THB): a foreign
// document's source subtotal/VAT is multiplied by its captured document-date
// exchange rate before it enters the register, so a filing period totals in one
// currency exactly as the RD forms require.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const sum = (ns: number[]): number => round2(ns.reduce((s, n) => s + n, 0));

// ── VAT registers (output = ภาษีขาย / sales, input = ภาษีซื้อ / purchases) ────

// One AR/AP tax document, in its SOURCE currency, as it enters a register.
export interface VatDocInput {
  id: string;
  docNo: string;
  date: string; // issue date, YYYY-MM-DD
  counterparty: string;
  taxId: string | null;
  branch: string | null;
  currency: string;
  // Document-date rate, source currency → base currency (1 for base-currency
  // docs). Every value below is converted to base by multiplying by this.
  exchangeRate: number;
  subtotal: number; // net value of goods/services, source currency
  vatRate: number; // percentage, e.g. 7
  vatAmount: number; // VAT, source currency
}

export interface VatRegisterRow {
  seq: number;
  docNo: string;
  date: string;
  counterparty: string;
  taxId: string;
  branch: string;
  currency: string;
  exchangeRate: number;
  base: number; // net value in BASE currency
  vat: number; // VAT in BASE currency
  vatRate: number;
  // vatRate === 0 → the sale/purchase is zero-rated or exempt (the RD forms
  // separate these from standard-rated; the data model can't yet distinguish
  // zero-rated from exempt, so they share this bucket).
  zeroRatedOrExempt: boolean;
}

export interface VatRegister {
  rows: VatRegisterRow[];
  totalBase: number;
  totalVat: number;
  standardRatedBase: number; // Σ base where vatRate > 0
  zeroRatedOrExemptBase: number; // Σ base where vatRate === 0
}

// Convert each document to base, sort chronologically (then by doc number for a
// stable order), number the rows, and total. An empty `taxId`/`branch` renders
// as "—"-friendly empty strings for the caller.
export function buildVatRegister(docs: VatDocInput[]): VatRegister {
  const sorted = [...docs].sort((a, b) =>
    a.date === b.date
      ? a.docNo.localeCompare(b.docNo)
      : a.date.localeCompare(b.date),
  );
  const rows: VatRegisterRow[] = sorted.map((d, i) => {
    const rate = d.exchangeRate || 1;
    return {
      seq: i + 1,
      docNo: d.docNo,
      date: d.date,
      counterparty: d.counterparty,
      taxId: d.taxId ?? "",
      branch: d.branch ?? "",
      currency: d.currency,
      exchangeRate: rate,
      base: round2(d.subtotal * rate),
      vat: round2(d.vatAmount * rate),
      vatRate: d.vatRate,
      zeroRatedOrExempt: d.vatRate === 0,
    };
  });
  return {
    rows,
    totalBase: sum(rows.map((r) => r.base)),
    totalVat: sum(rows.map((r) => r.vat)),
    standardRatedBase: sum(
      rows.filter((r) => !r.zeroRatedOrExempt).map((r) => r.base),
    ),
    zeroRatedOrExemptBase: sum(
      rows.filter((r) => r.zeroRatedOrExempt).map((r) => r.base),
    ),
  };
}

// ── PP.30 (ภ.พ.30) — the monthly VAT return summary ──────────────────────────

export interface Pp30Summary {
  standardRatedSales: number;
  zeroRatedOrExemptSales: number;
  totalSales: number;
  outputVat: number;
  totalPurchases: number;
  inputVat: number;
  // outputVat − inputVat. Positive → VAT payable to the RD; negative → an input
  // credit carried to the next period (surfaced separately as `vatCredit`).
  netVatPayable: number;
  vatCredit: number;
}

export function buildPp30(
  output: VatRegister,
  input: VatRegister,
): Pp30Summary {
  const net = round2(output.totalVat - input.totalVat);
  return {
    standardRatedSales: output.standardRatedBase,
    zeroRatedOrExemptSales: output.zeroRatedOrExemptBase,
    totalSales: output.totalBase,
    outputVat: output.totalVat,
    totalPurchases: input.totalBase,
    inputVat: input.totalVat,
    netVatPayable: net,
    vatCredit: net < 0 ? round2(-net) : 0,
  };
}

// ── Withholding-tax returns (PND.3 = individuals, PND.53 = juristic persons) ──

export type PayeeKind = "individual" | "juristic";

// One supplier payment that withheld tax, in its SOURCE currency.
export interface WhtPaymentInput {
  paymentId: string;
  date: string;
  payeeId: string; // vendor id, or a synthetic key for un-linked rows
  payee: string;
  taxId: string | null;
  payeeKind: PayeeKind; // classified from the vendor by the caller
  currency: string;
  exchangeRate: number; // settlement-date rate, source → base (1 for base)
  whtAmount: number; // tax withheld, source currency
  whtRate: number; // percentage, e.g. 3 — used to back out the income base
}

export interface WhtPayeeGroup {
  payeeId: string;
  payee: string;
  taxId: string;
  base: number; // gross income the tax was withheld on, BASE currency
  whtAmount: number; // tax withheld, BASE currency
  count: number; // number of payments in the group
}

export interface WhtReturn {
  form: "PND.3" | "PND.53";
  payees: WhtPayeeGroup[];
  totalBase: number;
  totalWht: number;
}

export interface WhtSummary {
  pnd3: WhtReturn; // individuals
  pnd53: WhtReturn; // juristic persons
}

// Income base backed out of the withheld tax: base = wht ÷ (rate). Exact
// because wht = base × rate at withholding time. Returns 0 when the rate is
// unknown (can't divide) so the tax total — the figure the return files on —
// stays correct regardless.
function incomeBase(whtBase: number, whtRate: number): number {
  return whtRate > 0 ? round2(whtBase / (whtRate / 100)) : 0;
}

function buildReturn(
  form: "PND.3" | "PND.53",
  payments: WhtPaymentInput[],
): WhtReturn {
  const groups = new Map<string, WhtPayeeGroup>();
  for (const p of payments) {
    const rate = p.exchangeRate || 1;
    const whtBase = round2(p.whtAmount * rate);
    const g = groups.get(p.payeeId) ?? {
      payeeId: p.payeeId,
      payee: p.payee,
      taxId: p.taxId ?? "",
      base: 0,
      whtAmount: 0,
      count: 0,
    };
    g.base = round2(g.base + incomeBase(whtBase, p.whtRate));
    g.whtAmount = round2(g.whtAmount + whtBase);
    g.count += 1;
    groups.set(p.payeeId, g);
  }
  const payees = [...groups.values()].sort((a, b) =>
    a.payee.localeCompare(b.payee),
  );
  return {
    form,
    payees,
    totalBase: sum(payees.map((p) => p.base)),
    totalWht: sum(payees.map((p) => p.whtAmount)),
  };
}

export function buildWhtSummary(payments: WhtPaymentInput[]): WhtSummary {
  return {
    pnd3: buildReturn(
      "PND.3",
      payments.filter((p) => p.payeeKind === "individual"),
    ),
    pnd53: buildReturn(
      "PND.53",
      payments.filter((p) => p.payeeKind === "juristic"),
    ),
  };
}
