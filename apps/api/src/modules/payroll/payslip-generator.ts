/**
 * Payslip document generator — produces a downloadable Excel workbook
 * and a PDF rendition of an individual payslip. Mirrors the HR-supplied
 * "Payslips Testing.xlsx" layout cell-for-cell so finance can keep the
 * same archival format whether the document was uploaded by hand or
 * generated from the bulk-imported payroll run.
 *
 * Public API:
 *   - buildPayslipWorkbookBuffer(payslip, entityName) → Buffer
 *   - buildPayslipPdfBuffer(payslip, entityName)      → Buffer
 *   - buildBulkZip(payslips, format)                  → Buffer
 *
 * Layout (rows refer to the source template):
 *   2   "P A Y S L I P"         (title)
 *   7   {entityName}            (company header)
 *  10   Employee Details        Net Pay:       {netPay}
 *  13   Employee Name : {name}  Date of Joining : {start}
 *  15   Department    : {dept}  Designation     : {title}
 *  17   Pay Period    : {period}
 *  23   EARNINGS | AMOUNT      DEDUCTIONS | AMOUNT
 *  25   Basic Salary | {n}     SSF             | {n}
 *  26   Overtime     | {n}     Personal Tax    | {n}
 *  27   Meal         | {n}     Other Deduction | {n}
 *  28   Transport    | {n}
 *  29   Phone        | {n}
 *  30   Internet     | {n}
 *  31   Reimbursement| {n}
 *  32   Others income| {n}
 *  37   Gross Salary | {gross} Total Deductions | {totalDed}
 *  38                          NET Salary       | {net}
 *  41   Employee Signature :   Employer Signature :
 */

import type { Payslip, User } from "@nexora/database";
import { readFileSync } from "fs";
import JSZip from "jszip";
import { join } from "path";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import * as XLSX from "xlsx";

// Allowance / deduction breakdown shape persisted in the JSON columns.
// Older imports use `wifi`; newer ones use `internet`. The generator
// reads whichever has a non-zero value so historic rows render too.
interface AllowanceBreakdown {
  meal?: number;
  transportation?: number;
  telephone?: number;
  phone?: number;
  house?: number;
  internet?: number;
  wifi?: number;
  overtime?: number;
  otherIncome?: number;
  reimbursement?: number;
  flatAllowance?: number;
}

interface DeductionBreakdown {
  tax?: number;
  ssf?: number;
  otherDeduction?: number;
  flatDeduction?: number;
}

export interface PayslipExportInput {
  payslip: Payslip & {
    employee: Pick<User, "id" | "name" | "email">;
  };
  /** Display name of the entity (used as the company header on row 7). */
  entityName: string;
  /** YYYY-MM string from the parent PayrollRun — formatted for row 17. */
  period: string;
  /**
   * Company legal details rendered in the payslip footer (below the
   * signatures). Admin-managed global block (SystemSetting
   * `payslip.company`); omitted lines are skipped.
   */
  company?: {
    legalName?: string | null;
    address?: string | null;
    phone?: string | null;
  };
}

// ── Shared helpers ────────────────────────────────────────────────

function fmt(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatPeriodLabel(period: string): string {
  // PayrollRun.period is "YYYY-MM" — render "January 2026" so the
  // payslip reads as a human-friendly month label.
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Pull the per-line earnings + deductions from the persisted breakdown
 * JSON. Sub-fields are optional — missing keys render as 0 in the
 * payslip rather than blanking the row.
 */
function readBreakdown(input: PayslipExportInput) {
  const a =
    (input.payslip.allowances as AllowanceBreakdown | null | undefined) ?? {};
  const d =
    (input.payslip.deductions as DeductionBreakdown | null | undefined) ?? {};

  // Generator-side `phone` defaults to legacy `telephone` for old rows.
  const phone = fmt(a.phone ?? a.telephone);
  // Same compatibility shim for the internet/wifi rename.
  const internet = fmt(a.internet ?? a.wifi);

  return {
    earnings: {
      basicSalary: fmt(input.payslip.baseSalary as unknown as number),
      overtime: fmt(a.overtime),
      meal: fmt(a.meal),
      transportation: fmt(a.transportation),
      phone,
      house: fmt(a.house),
      internet,
      reimbursement: fmt(a.reimbursement),
      otherIncome: fmt(a.otherIncome),
    },
    deductions: {
      ssf: fmt(d.ssf),
      tax: fmt(d.tax),
      otherDeduction: fmt(d.otherDeduction ?? d.flatDeduction),
    },
  };
}

// ── Excel generator ───────────────────────────────────────────────

/**
 * HR-supplied template ("Payslips Testing.xlsx") — shipped as a binary
 * asset so the generated workbook keeps every merged range, formula,
 * styling, and the constant "Manut" company header
 * intact. The generator only mutates the per-payslip data cells.
 *
 * Cached on first read; the file is small (~75 KB) and the buffer is
 * cloned per request so concurrent mutations don't collide.
 */
let cachedTemplate: Buffer | null = null;
function loadTemplate(): Buffer {
  if (!cachedTemplate) {
    const path = join(__dirname, "templates", "payslip-template.xlsx");
    cachedTemplate = readFileSync(path);
  }
  // Return a copy — `XLSX.read` mutates the input on some code paths.
  return Buffer.from(cachedTemplate);
}

/** Overwrite a single cell, preserving the original style (`s`) when present. */
function writeCell(ws: XLSX.WorkSheet, ref: string, value: string | number) {
  const existing = ws[ref] as XLSX.CellObject | undefined;
  const next: XLSX.CellObject = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
  };
  if (existing?.s) (next as { s: unknown }).s = existing.s;
  if (existing?.z) (next as { z: unknown }).z = existing.z;
  ws[ref] = next;
}

/**
 * Excel built-in three-section number format: positive ; negative ;
 * zero. Renders blanks as a literal "-" so the payslip mirrors HR's
 * preferred convention (don't clutter rows with "THB 0.00" lines).
 */
function amountFormat(currency: string): string {
  const prefix = `"${currency} "`;
  return `${prefix}#,##0.00;${prefix}-#,##0.00;"-"`;
}

/**
 * Write a numeric amount with the zero-as-dash currency format applied
 * inline on the cell. Override `z` always (don't fall back to the
 * template's single-section format) since we want zeros suppressed.
 */
function writeAmount(
  ws: XLSX.WorkSheet,
  ref: string,
  value: number,
  currency: string,
) {
  const existing = ws[ref] as XLSX.CellObject | undefined;
  const next: XLSX.CellObject = { t: "n", v: value };
  if (existing?.s) (next as { s: unknown }).s = existing.s;
  (next as { z: string }).z = amountFormat(currency);
  ws[ref] = next;
}

export function buildPayslipWorkbookBuffer(input: PayslipExportInput): Buffer {
  const wb = XLSX.read(loadTemplate(), {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Payslip template is missing its sheet");
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error("Payslip template sheet is empty");
  }

  const { earnings, deductions } = readBreakdown(input);
  const currency = input.payslip.currency;

  // Identity rows — template ships with sample-employee placeholders.
  writeCell(ws, "E13", input.payslip.employee.name ?? "");
  writeCell(ws, "K13", input.payslip.startDateSnapshot ?? "");
  writeCell(ws, "E15", input.payslip.departmentSnapshot ?? "");
  writeCell(ws, "K15", input.payslip.positionSnapshot ?? "");
  writeCell(ws, "E17", formatPeriodLabel(input.period));

  // Earnings column — F25:F32. Template formula at F37 sums F25:G34,
  // so overwriting the values automatically updates the gross total.
  // Zero amounts render as "-" via the three-section number format.
  writeAmount(ws, "F25", earnings.basicSalary, currency);
  writeAmount(ws, "F26", earnings.overtime, currency);
  writeAmount(ws, "F27", earnings.meal, currency);
  writeAmount(ws, "F28", earnings.transportation, currency);
  writeAmount(ws, "F29", earnings.phone, currency);
  writeAmount(ws, "F30", earnings.internet, currency);
  writeAmount(ws, "F31", earnings.reimbursement, currency);
  writeAmount(ws, "F32", earnings.otherIncome, currency);

  // Deductions column — M25:M27. Template formula at M37 sums M25:N30,
  // and M38 = F37 - M37, so NET Salary follows automatically.
  writeAmount(ws, "M25", deductions.ssf, currency);
  writeAmount(ws, "M26", deductions.tax, currency);
  writeAmount(ws, "M27", deductions.otherDeduction, currency);

  // Apply the same zero-as-dash currency format to the formula-driven
  // headline cells so a 0 NET / 0 deductions row renders as "-" too.
  for (const totalRef of ["K10", "F37", "M37", "M38"]) {
    const cell = ws[totalRef] as XLSX.CellObject | undefined;
    if (cell) (cell as { z: string }).z = amountFormat(currency);
  }

  const buf = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  return Buffer.from(buf);
}

// ── PDF generator (pdf-lib) ───────────────────────────────────────

interface PdfContext {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  width: number;
  height: number;
}

function drawText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  opts: { bold?: boolean; size?: number; align?: "left" | "right" } = {},
) {
  const font = opts.bold ? ctx.bold : ctx.font;
  const size = opts.size ?? 10;
  const w = font.widthOfTextAtSize(text, size);
  const drawX = opts.align === "right" ? x - w : x;
  ctx.page.drawText(text, {
    x: drawX,
    y: ctx.height - y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawLine(
  ctx: PdfContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.page.drawLine({
    start: { x: x1, y: ctx.height - y1 },
    end: { x: x2, y: ctx.height - y2 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
}

/** Greedy word-wrap so a long address fits the page width. */
function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildPayslipPdfBuffer(
  input: PayslipExportInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait, points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfContext = {
    page,
    font,
    bold,
    width: page.getWidth(),
    height: page.getHeight(),
  };

  const { earnings, deductions } = readBreakdown(input);
  const currency = input.payslip.currency;
  const gross = fmt(input.payslip.grossPay as unknown as number);
  const net = fmt(input.payslip.netPay as unknown as number);
  const totalDed = deductions.ssf + deductions.tax + deductions.otherDeduction;

  const LEFT = 40;
  const RIGHT = ctx.width - 40;
  const MID = ctx.width / 2;

  // Title
  drawText(ctx, "P A Y S L I P", MID - 70, 60, { bold: true, size: 18 });
  // Company header — matches the constant "Manut"
  // header on the HR-supplied template. `entityName` is no longer used
  // here (the parent brand is the legal payer, not the sub-entity).
  drawText(ctx, "Manut", LEFT, 100, { bold: true, size: 13 });
  drawLine(ctx, LEFT, 110, RIGHT, 110);

  // Net Pay headline (right side)
  drawText(ctx, "Employee Details", LEFT, 135, { bold: true, size: 11 });
  drawText(ctx, "Net Pay:", MID + 40, 135, { bold: true, size: 11 });
  drawText(ctx, formatCurrency(net, currency), RIGHT, 135, {
    bold: true,
    size: 12,
    align: "right",
  });

  // Employee identity rows
  const idRows: Array<[string, string, string, string]> = [
    [
      "Employee Name:",
      input.payslip.employee.name ?? "",
      "Date of Joining:",
      input.payslip.startDateSnapshot ?? "",
    ],
    [
      "Department:",
      input.payslip.departmentSnapshot ?? "",
      "Designation:",
      input.payslip.positionSnapshot ?? "",
    ],
    ["Pay Period:", formatPeriodLabel(input.period), "", ""],
  ];
  idRows.forEach(([lLabel, lVal, rLabel, rVal], i) => {
    const y = 165 + i * 18;
    drawText(ctx, lLabel, LEFT, y, { bold: true });
    drawText(ctx, lVal, LEFT + 100, y);
    if (rLabel) {
      drawText(ctx, rLabel, MID + 20, y, { bold: true });
      drawText(ctx, rVal, MID + 130, y);
    }
  });

  // EARNINGS / DEDUCTIONS table headers
  const tableY = 240;
  drawLine(ctx, LEFT, tableY - 14, RIGHT, tableY - 14);
  drawText(ctx, "EARNINGS", LEFT, tableY, { bold: true, size: 11 });
  drawText(ctx, "AMOUNT", MID - 20, tableY, {
    bold: true,
    size: 11,
    align: "right",
  });
  drawText(ctx, "DEDUCTIONS", MID + 20, tableY, { bold: true, size: 11 });
  drawText(ctx, "AMOUNT", RIGHT, tableY, {
    bold: true,
    size: 11,
    align: "right",
  });
  drawLine(ctx, LEFT, tableY + 4, RIGHT, tableY + 4);

  // Earnings rows
  const earningsList: Array<[string, number]> = [
    ["Basic Salary", earnings.basicSalary],
    ["Overtime", earnings.overtime],
    ["Meal Allowance", earnings.meal],
    ["Transportation Allowance", earnings.transportation],
    ["Phone Allowance", earnings.phone],
    ["Internet Bills", earnings.internet],
    ["Reimbursement", earnings.reimbursement],
    ["Others income", earnings.otherIncome],
  ];
  // Mirrors the xlsx zero-as-dash convention so 0 lines don't clutter
  // the PDF either.
  const renderAmount = (n: number): string =>
    n === 0 ? "-" : n.toLocaleString();

  earningsList.forEach(([label, value], i) => {
    const y = tableY + 22 + i * 16;
    drawText(ctx, label, LEFT, y);
    drawText(ctx, renderAmount(value), MID - 20, y, { align: "right" });
  });

  // Deductions rows
  const deductionsList: Array<[string, number]> = [
    ["SSF", deductions.ssf],
    ["Personal Tax", deductions.tax],
    ["Other Deduction", deductions.otherDeduction],
  ];
  deductionsList.forEach(([label, value], i) => {
    const y = tableY + 22 + i * 16;
    drawText(ctx, label, MID + 20, y);
    drawText(ctx, renderAmount(value), RIGHT, y, { align: "right" });
  });

  // Totals
  const totalsY = tableY + 22 + 8 * 16 + 12;
  drawLine(ctx, LEFT, totalsY - 12, RIGHT, totalsY - 12);
  drawText(ctx, "Gross Salary", LEFT, totalsY, { bold: true });
  drawText(ctx, renderAmount(gross), MID - 20, totalsY, {
    bold: true,
    align: "right",
  });
  drawText(ctx, "Total Deductions", MID + 20, totalsY, { bold: true });
  drawText(ctx, renderAmount(totalDed), RIGHT, totalsY, {
    bold: true,
    align: "right",
  });
  drawText(ctx, "NET Salary", MID + 20, totalsY + 18, {
    bold: true,
    size: 12,
  });
  drawText(ctx, formatCurrency(net, currency), RIGHT, totalsY + 18, {
    bold: true,
    size: 12,
    align: "right",
  });

  // Signature row
  const sigY = totalsY + 70;
  drawText(ctx, "Employee Signature:", LEFT, sigY);
  drawLine(ctx, LEFT + 110, sigY + 2, LEFT + 260, sigY + 2);
  drawText(ctx, "Employer Signature:", MID + 20, sigY);
  drawLine(ctx, MID + 130, sigY + 2, RIGHT, sigY + 2);

  // Company legal block (footer) — registered name, address, tel.
  const company = input.company;
  if (company && (company.legalName || company.address || company.phone)) {
    // Top rule sits two blank lines below the signature row; the legal
    // block then drops two more blank lines below the rule so the company
    // name clears the line (HR request).
    let cy = sigY + 72;
    drawLine(ctx, LEFT, cy - 12, RIGHT, cy - 12);
    cy += 24;
    if (company.legalName) {
      drawText(ctx, company.legalName, LEFT, cy, { bold: true, size: 10 });
      cy += 14;
    }
    // Address + tel render as one paragraph so the phone flows directly
    // after the last address line ("…Thailand Tel: …") instead of dropping
    // to its own line. wrapText collapses the joining gap to one space.
    const body =
      company.address && company.phone
        ? `${company.address}   Tel: ${company.phone}`
        : (company.address ?? (company.phone ? `Tel: ${company.phone}` : ""));
    if (body) {
      for (const line of wrapText(ctx.font, body, 9, RIGHT - LEFT)) {
        drawText(ctx, line, LEFT, cy, { size: 9 });
        cy += 12;
      }
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

// ── Bulk zip ──────────────────────────────────────────────────────

export type ExportFormat = "xlsx" | "pdf";

/**
 * Build a zip archive containing one file per payslip in the input
 * list. File names follow `{period}-{employeeName}.{ext}` with spaces
 * preserved so HR can scan the zip listing at a glance.
 */
export async function buildBulkPayslipZip(
  payslips: PayslipExportInput[],
  format: ExportFormat,
): Promise<Buffer> {
  const zip = new JSZip();
  for (const p of payslips) {
    const safeName = (p.payslip.employee.name ?? "Unknown").replace(
      /[/\\:*?"<>|]/g,
      "_",
    );
    const filename = `${p.period}-${safeName}.${format}`;
    const buf =
      format === "xlsx"
        ? buildPayslipWorkbookBuffer(p)
        : await buildPayslipPdfBuffer(p);
    zip.file(filename, buf);
  }
  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
