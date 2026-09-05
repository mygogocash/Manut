import { roundMoney } from "@/modules/accounting/rounding";

// Statuses that are NOT in the general ledger, and so must not appear in an
// exhibit whose whole job is to reconcile to the P&L.
//
// A draft is unposted: the AR/AP journal entry is written on the draft→sent
// transition (`updateInvoiceStatus`, `isSend`), not at create. Counting drafts
// therefore reported revenue and expense the ledger does not contain, and the
// figure could move without a single journal entry being written.
//
// When a document can sit awaiting a further approval stage before it posts,
// add that status here — it is unposted for exactly the same reason.
export const UNPOSTED_EXHIBIT_STATUSES = new Set(["draft", "cancelled"]);

export interface ExhibitInvoice {
  type: string;
  status: string;
  amount: number;
  vatRate?: number;
  vatAmount?: number;
  issueDate: Date;
  capitalisedAmount?: number;
}

export interface ExhibitCapexLine {
  /** Manual "this is an asset" tick on the line. */
  capitalised: boolean;
  /** GL account the line is routed to, when one is set. */
  glAccountId?: string | null;
  /** Line net after the line AND header discount, as computeArDocument stored
   *  it. Null on rows created before the line model existed. */
  taxBase?: number | null;
  unitPrice: number;
  quantity: number;
  lineDiscount?: number | null;
}

/**
 * Is this line capital expenditure?
 *
 * The PRD classifies on the ACCOUNT the line is posted to — if it lands in an
 * asset account it is capex, whatever anyone ticked — and explicitly refuses to
 * decide from the amount. That is the right rule: the ledger is what the
 * financial statements are built from, so a line posted to an asset account is
 * capex even if the tick was forgotten, and a line posted to an expense account
 * is not capex even if the tick was set by mistake.
 *
 * The manual `capitalised` flag survives only as the fallback for lines with no
 * GL routing at all — rows predating per-line accounts, where it is the only
 * signal there is. Dropping it would silently reclassify that history.
 */
export function isCapexLine(
  line: ExhibitCapexLine,
  isAssetAccount: (accountId: string) => boolean,
): boolean {
  if (line.glAccountId) return isAssetAccount(line.glAccountId);
  return line.capitalised;
}

/**
 * Net of the capitalised lines on one document — the capex sub-line of the
 * Overview exhibit.
 *
 * `taxBase` is authoritative when present. Legacy rows without one fall back to
 * the line extension LESS the line discount, which is `netBeforeHeader` in
 * computeArDocument; the header discount cannot be recovered per line here, so
 * the fallback is the closest figure available. Omitting lineDiscount — as this
 * did before — reported a discounted asset line above what was paid for it.
 */
export function capitalisedNet(
  lines: ExhibitCapexLine[],
  isAssetAccount: (accountId: string) => boolean = () => false,
): number {
  let sum = 0;
  for (const line of lines) {
    if (!isCapexLine(line, isAssetAccount)) continue;
    const net =
      line.taxBase != null
        ? line.taxBase
        : line.unitPrice * line.quantity - (line.lineDiscount ?? 0);
    sum = roundMoney(sum + net);
  }
  return sum;
}

export function computeAccrualRevenue(
  invoices: ExhibitInvoice[],
  range: { start: Date; end: Date },
): number {
  let sum = 0;
  for (const inv of invoices) {
    if (inv.type !== "receivable") continue;
    if (UNPOSTED_EXHIBIT_STATUSES.has(inv.status)) continue;
    if (inv.issueDate < range.start || inv.issueDate > range.end) continue;
    const vat =
      inv.vatAmount ??
      roundMoney(
        inv.amount * ((inv.vatRate ?? 0) / (100 + (inv.vatRate ?? 0))),
      );
    sum = roundMoney(sum + inv.amount - vat);
  }
  return sum;
}

export function computeOperatingExpense(
  bills: ExhibitInvoice[],
  range: { start: Date; end: Date },
): {
  operatingExpense: number;
  capex: number;
  expenseInProfitAndLoss: number;
} {
  let opex = 0;
  let capex = 0;
  for (const inv of bills) {
    if (inv.type !== "payable") continue;
    if (UNPOSTED_EXHIBIT_STATUSES.has(inv.status)) continue;
    if (inv.issueDate < range.start || inv.issueDate > range.end) continue;
    const vat =
      inv.vatAmount ??
      roundMoney(
        inv.amount * ((inv.vatRate ?? 0) / (100 + (inv.vatRate ?? 0))),
      );
    const preVat = roundMoney(inv.amount - vat);
    const cap = roundMoney(inv.capitalisedAmount ?? 0);
    capex = roundMoney(capex + cap);
    opex = roundMoney(opex + preVat);
  }
  // The third line the PRD asks for, and the reason the other two exist: the
  // header total counts every approved bill, but an asset does not hit the P&L
  // when it is bought — it arrives later as depreciation. Without this line the
  // Overview figure and the income statement disagree by exactly the capex and
  // nobody can see why.
  return {
    operatingExpense: opex,
    capex,
    expenseInProfitAndLoss: roundMoney(opex - capex),
  };
}
