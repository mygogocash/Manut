// Pure financial-report builders (DB-free, unit-tested).
//
// Every statement is derived from POSTED journal-entry-line activity — never
// from ChartOfAccount.balance — so a report can always be reconstructed from
// the ledger. The service fetches the raw per-account activity; these functions
// shape it into Trial Balance, P&L, Balance Sheet and Cash Flow.
//
// Sign convention (matches the posting engine): a debit increases asset/expense
// balances, a credit increases liability/equity/revenue balances.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const TOLERANCE = 0.01;

// Per-account posted activity over a window (Σdebit / Σcredit).
export interface ActivityRow {
  accountId: string;
  code: string;
  name: string;
  type: string; // asset | liability | equity | revenue | expense
  subType?: string | null;
  debit: number;
  credit: number;
}

const sumBy = <T>(rows: T[], pick: (r: T) => number): number =>
  round2(rows.reduce((s, r) => s + pick(r), 0));

// Net income (revenue − expense) over an activity window.
export function netIncome(rows: ActivityRow[]): number {
  const revenue = sumBy(
    rows.filter((r) => r.type === "revenue"),
    (r) => r.credit - r.debit,
  );
  const expense = sumBy(
    rows.filter((r) => r.type === "expense"),
    (r) => r.debit - r.credit,
  );
  return round2(revenue - expense);
}

// The most recent fiscal-year-start (month/day) on or before `asOf`.
export function fiscalYearStartOnOrBefore(
  asOf: Date,
  startMonth: number,
  startDay: number,
): Date {
  const candidate = new Date(
    Date.UTC(asOf.getUTCFullYear(), startMonth - 1, startDay),
  );
  if (candidate.getTime() <= asOf.getTime()) return candidate;
  return new Date(
    Date.UTC(asOf.getUTCFullYear() - 1, startMonth - 1, startDay),
  );
}

// ── Trial Balance (as-of) ──────────────────────────────────────────────────
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}
export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export function buildTrialBalance(rows: ActivityRow[]): TrialBalance {
  const out = rows
    .map((r) => {
      const net = round2(r.debit - r.credit);
      return {
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        type: r.type,
        debit: net >= 0 ? net : 0,
        credit: net < 0 ? round2(-net) : 0,
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = sumBy(out, (r) => r.debit);
  const totalCredit = sumBy(out, (r) => r.credit);
  return {
    rows: out,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < TOLERANCE,
  };
}

// ── Profit & Loss (period) ─────────────────────────────────────────────────
export interface PnlAccount {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}
export interface ProfitAndLoss {
  revenue: PnlAccount[];
  expenses: PnlAccount[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export function buildProfitAndLoss(rows: ActivityRow[]): ProfitAndLoss {
  const revenue = rows
    .filter((r) => r.type === "revenue")
    .map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      amount: round2(r.credit - r.debit),
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const expenses = rows
    .filter((r) => r.type === "expense")
    .map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      amount: round2(r.debit - r.credit),
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const totalRevenue = sumBy(revenue, (r) => r.amount);
  const totalExpenses = sumBy(expenses, (r) => r.amount);
  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit: round2(totalRevenue - totalExpenses),
  };
}

// ── Balance Sheet (as-of) ──────────────────────────────────────────────────
export interface BsAccount {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}
export interface BalanceSheet {
  assets: BsAccount[];
  liabilities: BsAccount[];
  equity: BsAccount[];
  totalAssets: number;
  totalLiabilities: number;
  retainedEarnings: number;
  currentYearEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
  difference: number;
}

// Assets/Liabilities/Equity as-of, with net income rolled into equity so the
// statement balances WITHOUT any formal year-end close: nominal accounts are
// never closed here, so current + prior earnings are computed from revenue/
// expense activity. `currentYearEarnings` (revenue − expense since fiscal-year
// start) is passed in; prior-year retained earnings = net-income-to-date minus
// it. This is the review's "BS never balances" fix.
export function buildBalanceSheet(
  asOfRows: ActivityRow[],
  currentYearEarnings: number,
): BalanceSheet {
  const pick = (type: string, sign: (r: ActivityRow) => number) =>
    asOfRows
      .filter((r) => r.type === type)
      .map((r) => ({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        amount: round2(sign(r)),
      }))
      .filter((r) => r.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));

  const assets = pick("asset", (r) => r.debit - r.credit);
  const liabilities = pick("liability", (r) => r.credit - r.debit);
  const equityAccounts = pick("equity", (r) => r.credit - r.debit);

  const totalAssets = sumBy(assets, (r) => r.amount);
  const totalLiabilities = sumBy(liabilities, (r) => r.amount);
  const equityAccountsTotal = sumBy(equityAccounts, (r) => r.amount);

  const netIncomeToDate = netIncome(asOfRows);
  const retainedEarnings = round2(netIncomeToDate - currentYearEarnings);

  const equity: BsAccount[] = [
    ...equityAccounts,
    {
      accountId: "__retained_earnings__",
      code: "",
      name: "Retained earnings (prior years)",
      amount: retainedEarnings,
    },
    {
      accountId: "__current_year_earnings__",
      code: "",
      name: "Current year earnings",
      amount: currentYearEarnings,
    },
  ];
  const totalEquity = round2(
    equityAccountsTotal + retainedEarnings + currentYearEarnings,
  );
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const difference = round2(totalAssets - totalLiabilitiesAndEquity);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    retainedEarnings,
    currentYearEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanced: Math.abs(difference) < TOLERANCE,
    difference,
  };
}

// ── Tax summary (VAT output/input + WHT, period) ───────────────────────────
export interface TaxRoleAccounts {
  vatOutput?: string;
  vatInput?: string;
  whtPayable?: string;
  whtReceivable?: string;
}
export interface TaxSummary {
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
  whtPayable: number;
  whtReceivable: number;
}

// Period movements on the mapped VAT/WHT control accounts. Output VAT + WHT
// payable are liabilities (credit − debit); input VAT + WHT receivable are
// assets (debit − credit). An unmapped role contributes 0.
export function buildTaxSummary(
  rows: ActivityRow[],
  roles: TaxRoleAccounts,
): TaxSummary {
  const byId = new Map(rows.map((r) => [r.accountId, r]));
  const creditSide = (id?: string) => {
    const r = id ? byId.get(id) : undefined;
    return r ? round2(r.credit - r.debit) : 0;
  };
  const debitSide = (id?: string) => {
    const r = id ? byId.get(id) : undefined;
    return r ? round2(r.debit - r.credit) : 0;
  };
  const outputVat = creditSide(roles.vatOutput);
  const inputVat = debitSide(roles.vatInput);
  return {
    outputVat,
    inputVat,
    netVatPayable: round2(outputVat - inputVat),
    whtPayable: creditSide(roles.whtPayable),
    whtReceivable: debitSide(roles.whtReceivable),
  };
}

// ── Cash Flow (period, direct — MVP) ───────────────────────────────────────
export interface CashFlow {
  openingCash: number;
  closingCash: number;
  netChange: number;
  operating: number;
  investing: number;
  financing: number;
  reconciles: boolean;
  note: string;
}

// Net cash movement over the period = Σ(debit − credit) on the entity's cash
// accounts (the GL accounts mapped to its bank accounts). MVP presents the net
// change as operating and reconciles it to closing − opening cash; investing/
// financing classification is deferred.
export function buildCashFlow(
  periodRows: ActivityRow[],
  cashAccountIds: Set<string>,
  openingCash: number,
  closingCash: number,
): CashFlow {
  const netChange = sumBy(
    periodRows.filter((r) => cashAccountIds.has(r.accountId)),
    (r) => r.debit - r.credit,
  );
  const reconciles =
    Math.abs(round2(closingCash - openingCash) - netChange) < TOLERANCE;
  return {
    openingCash: round2(openingCash),
    closingCash: round2(closingCash),
    netChange,
    operating: netChange,
    investing: 0,
    financing: 0,
    reconciles,
    note: "MVP: net cash change is presented as operating activity; investing/financing are not yet separately classified.",
  };
}
