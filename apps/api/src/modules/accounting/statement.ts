/**
 * Statement-of-account generator (M1). A per-counterparty statement: every
 * non-draft AR/AP document with its outstanding, a totals line, and an aging
 * summary of the open balance. Pure `buildStatement` (DB-free, unit-tested) +
 * `buildStatementPdfBuffer` (pdf-lib, mirrors invoice-generator.ts idioms).
 */
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

import {
  type AgingSideSummary,
  buildAgingSummary,
} from "@/modules/accounting/accounting.aging";
import {
  formatInvoiceDate,
  formatMoney,
  type InvoiceCompany,
} from "@/modules/accounting/invoice-shared";

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export interface StatementInvoiceInput {
  invoiceNo: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  amountPaid: number;
}

export interface StatementRow {
  invoiceNo: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  paid: number;
  outstanding: number;
}

export interface Statement {
  rows: StatementRow[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  // Aging of the OPEN balance (outstanding > 0), bucketed by due date.
  aging: AgingSideSummary;
}

// Pure roll-up: one row per document, totals, and the aging of the still-open
// balance as of `asOf`. Amounts are in the document currency (a statement is
// scoped to one counterparty; mixed-currency is out of scope for now).
export function buildStatement(
  invoices: StatementInvoiceInput[],
  asOf: Date,
): Statement {
  const rows: StatementRow[] = invoices.map((i) => ({
    invoiceNo: i.invoiceNo,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    amount: round2(i.amount),
    paid: round2(i.amountPaid),
    outstanding: round2(i.amount - i.amountPaid),
  }));
  let totalAmount = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  for (const r of rows) {
    totalAmount = round2(totalAmount + r.amount);
    totalPaid = round2(totalPaid + r.paid);
    totalOutstanding = round2(totalOutstanding + r.outstanding);
  }
  const aging = buildAgingSummary(
    rows
      .filter((r) => r.outstanding > 0)
      .map((r) => ({ dueDate: r.dueDate, outstandingBase: r.outstanding })),
    asOf,
  );
  return { rows, totalAmount, totalPaid, totalOutstanding, aging };
}

export interface StatementData {
  company: InvoiceCompany;
  entityName: string;
  counterparty: string;
  side: "receivable" | "payable";
  currency: string;
  asOf: Date;
  statement: Statement;
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 50;
const RIGHT = PAGE_W - MARGIN;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.8, 0.8, 0.83);
const SHADE = rgb(0.95, 0.95, 0.96);

// Column right edges for the document table.
const COL_DOC_X = MARGIN;
const COL_ISSUE_X = 170;
const COL_DUE_X = 250;
const COL_AMT_R = 400;
const COL_PAID_R = 480;
const COL_OUT_R = RIGHT;

// pdf-lib's Helvetica is WinAnsi-only and THROWS on characters it can't encode
// (e.g. Thai). Statements are rendered in English/Latin; replace anything
// outside printable ASCII with '?' so a Thai counterparty name never crashes
// the export (mirrors the WHT-certificate generator's stance).
const ascii = (s: string): string => s.replace(/[^\x20-\x7e]/g, "?");

export async function buildStatementPdfBuffer(
  data: StatementData,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  // `page` is reassigned on overflow; the draw helpers close over this binding
  // so they always target the current page.
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = (
    s: string,
    x: number,
    y: number,
    size = 9,
    f: PDFFont = font,
    color = INK,
  ) => page.drawText(ascii(s), { x, y, size, font: f, color });

  const rightText = (
    s: string,
    xRight: number,
    y: number,
    size = 9,
    f: PDFFont = font,
    color = INK,
  ) => text(s, xRight - f.widthOfTextAtSize(ascii(s), size), y, size, f, color);

  const rule = (y: number, x1 = MARGIN, x2 = RIGHT, color = RULE) =>
    page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.75,
      color,
    });

  const ccy = data.currency;
  let y = PAGE_H - MARGIN;

  // Header
  text(data.company.name, MARGIN, y, 13, bold);
  rightText("STATEMENT OF ACCOUNT", RIGHT, y, 13, bold);
  y -= 16;
  text(
    data.side === "receivable" ? "Receivable (AR)" : "Payable (AP)",
    RIGHT - bold.widthOfTextAtSize("Receivable (AR)", 8),
    y,
    8,
    font,
    MUTED,
  );
  text(data.entityName, MARGIN, y, 9, font, MUTED);
  y -= 22;

  // Counterparty + as-of
  text("STATEMENT FOR", MARGIN, y, 8, bold, MUTED);
  rightText(`As of ${formatInvoiceDate(data.asOf)}`, RIGHT, y, 9);
  y -= 14;
  text(data.counterparty, MARGIN, y, 11, bold);
  y -= 20;

  // Table header
  rule(y + 4);
  text("Document", COL_DOC_X, y - 8, 8, bold, MUTED);
  text("Issued", COL_ISSUE_X, y - 8, 8, bold, MUTED);
  text("Due", COL_DUE_X, y - 8, 8, bold, MUTED);
  rightText(`Amount (${ccy})`, COL_AMT_R, y - 8, 8, bold, MUTED);
  rightText("Paid", COL_PAID_R, y - 8, 8, bold, MUTED);
  rightText("Outstanding", COL_OUT_R, y - 8, 8, bold, MUTED);
  y -= 14;
  rule(y);
  y -= 14;

  // Rows (paginate if they overflow the page)
  for (const r of data.statement.rows) {
    if (y < MARGIN + 120) {
      // Overflow: continue on a fresh page. The helpers follow `page`.
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    text(r.invoiceNo, COL_DOC_X, y, 9);
    text(formatInvoiceDate(r.issueDate), COL_ISSUE_X, y, 8);
    text(formatInvoiceDate(r.dueDate), COL_DUE_X, y, 8);
    rightText(formatMoney(r.amount), COL_AMT_R, y, 9);
    rightText(formatMoney(r.paid), COL_PAID_R, y, 9);
    rightText(formatMoney(r.outstanding), COL_OUT_R, y, 9);
    y -= 14;
  }

  // Totals
  rule(y + 4);
  y -= 10;
  text("Totals", COL_DOC_X, y, 9, bold);
  rightText(formatMoney(data.statement.totalAmount), COL_AMT_R, y, 9, bold);
  rightText(formatMoney(data.statement.totalPaid), COL_PAID_R, y, 9, bold);
  rightText(
    formatMoney(data.statement.totalOutstanding),
    COL_OUT_R,
    y,
    9,
    bold,
  );
  y -= 26;

  // Aging summary of the open balance
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: RIGHT - MARGIN,
    height: 18,
    color: SHADE,
  });
  text("AGING OF OUTSTANDING", MARGIN + 6, y + 2, 8, bold, MUTED);
  rightText(
    `Total outstanding ${ccy} ${formatMoney(data.statement.totalOutstanding)}`,
    RIGHT - 6,
    y + 2,
    8,
    bold,
  );
  y -= 22;
  const b = data.statement.aging.buckets;
  const cells: Array<[string, number]> = [
    ["Not yet due", b.notYetDue],
    ["1-30", b.d1_30],
    ["31-60", b.d31_60],
    ["61-90", b.d61_90],
    ["90+", b.d90plus],
  ];
  const colW = (RIGHT - MARGIN) / cells.length;
  cells.forEach(([label, amount], i) => {
    const cx = MARGIN + i * colW;
    text(label, cx, y, 8, font, MUTED);
    text(formatMoney(amount), cx, y - 12, 9);
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
