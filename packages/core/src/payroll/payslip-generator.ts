import type { PDFFont, PDFPage } from "pdf-lib";
import type { schema } from "@nexora/db";
import { BadRequestException } from "../http-exception";

type PayslipRow = typeof schema.payslips.$inferSelect;

type PayslipMoneyFields = {
  baseSalary: string | number;
  grossPay: string | number;
  netPay: string | number;
  grossPayBase: string | number | null;
  netPayBase: string | number | null;
};

interface PdfContext {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  width: number;
  height: number;
}

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
  payslip: Omit<PayslipRow, keyof PayslipMoneyFields> &
    PayslipMoneyFields & {
      employee: {
        id: string;
        name: string | null;
        email: string | null;
        dateOfBirth?: string | null;
      };
    };
  entityName: string;
  period: string;
  company?: {
    legalName?: string | null;
    address?: string | null;
    phone?: string | null;
  };
}

export type ExportFormat = "xlsx" | "pdf";

function fmt(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatPeriodLabel(period: string): string {
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

function readBreakdown(input: PayslipExportInput) {
  const a =
    (input.payslip.allowances as AllowanceBreakdown | null | undefined) ?? {};
  const d =
    (input.payslip.deductions as DeductionBreakdown | null | undefined) ?? {};
  const phone = fmt(a.phone ?? a.telephone);
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

export async function buildPayslipWorkbookBuffer(
  _input: PayslipExportInput,
): Promise<Uint8Array> {
  throw new BadRequestException("XLSX export not yet available on edge");
}

export async function buildPayslipPdfBuffer(
  input: PayslipExportInput,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
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

  const draw = (
    text: string,
    x: number,
    y: number,
    opts: { bold?: boolean; size?: number; align?: "left" | "right" } = {},
  ) => {
    const f = opts.bold ? bold : font;
    const size = opts.size ?? 10;
    const w = f.widthOfTextAtSize(text, size);
    const drawX = opts.align === "right" ? x - w : x;
    page.drawText(text, {
      x: drawX,
      y: ctx.height - y,
      size,
      font: f,
      color: rgb(0, 0, 0),
    });
  };

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: ctx.height - y1 },
      end: { x: x2, y: ctx.height - y2 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
  };

  draw("P A Y S L I P", MID - 70, 60, { bold: true, size: 18 });
  draw("The Binary Holdings", LEFT, 100, { bold: true, size: 13 });
  line(LEFT, 110, RIGHT, 110);

  draw("Employee Details", LEFT, 135, { bold: true, size: 11 });
  draw("Net Pay:", MID + 40, 135, { bold: true, size: 11 });
  draw(formatCurrency(net, currency), RIGHT, 135, {
    bold: true,
    size: 12,
    align: "right",
  });

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
    draw(lLabel, LEFT, y, { bold: true });
    draw(lVal, LEFT + 100, y);
    if (rLabel) {
      draw(rLabel, MID + 20, y, { bold: true });
      draw(rVal, MID + 130, y);
    }
  });

  const tableY = 240;
  line(LEFT, tableY - 14, RIGHT, tableY - 14);
  draw("EARNINGS", LEFT, tableY, { bold: true, size: 11 });
  draw("AMOUNT", MID - 20, tableY, { bold: true, size: 11, align: "right" });
  draw("DEDUCTIONS", MID + 20, tableY, { bold: true, size: 11 });
  draw("AMOUNT", RIGHT, tableY, { bold: true, size: 11, align: "right" });
  line(LEFT, tableY + 4, RIGHT, tableY + 4);

  const renderAmount = (n: number): string =>
    n === 0 ? "-" : n.toLocaleString();

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
  earningsList.forEach(([label, value], i) => {
    const y = tableY + 22 + i * 16;
    draw(label, LEFT, y);
    draw(renderAmount(value), MID - 20, y, { align: "right" });
  });

  const deductionsList: Array<[string, number]> = [
    ["SSF", deductions.ssf],
    ["Personal Tax", deductions.tax],
    ["Other Deduction", deductions.otherDeduction],
  ];
  deductionsList.forEach(([label, value], i) => {
    const y = tableY + 22 + i * 16;
    draw(label, MID + 20, y);
    draw(renderAmount(value), RIGHT, y, { align: "right" });
  });

  const totalsY = tableY + 22 + 8 * 16 + 12;
  line(LEFT, totalsY - 12, RIGHT, totalsY - 12);
  draw("Gross Salary", LEFT, totalsY, { bold: true });
  draw(renderAmount(gross), MID - 20, totalsY, { bold: true, align: "right" });
  draw("Total Deductions", MID + 20, totalsY, { bold: true });
  draw(renderAmount(totalDed), RIGHT, totalsY, { bold: true, align: "right" });
  draw("NET Salary", MID + 20, totalsY + 18, { bold: true, size: 12 });
  draw(formatCurrency(net, currency), RIGHT, totalsY + 18, {
    bold: true,
    size: 12,
    align: "right",
  });

  const sigY = totalsY + 70;
  draw("Employee Signature:", LEFT, sigY);
  line(LEFT + 110, sigY + 2, LEFT + 260, sigY + 2);
  draw("Employer Signature:", MID + 20, sigY);
  line(MID + 130, sigY + 2, RIGHT, sigY + 2);

  const company = input.company;
  if (company && (company.legalName || company.address || company.phone)) {
    let cy = sigY + 72;
    line(LEFT, cy - 12, RIGHT, cy - 12);
    cy += 24;
    if (company.legalName) {
      draw(company.legalName, LEFT, cy, { bold: true, size: 10 });
      cy += 14;
    }
    const body =
      company.address && company.phone
        ? `${company.address}   Tel: ${company.phone}`
        : (company.address ?? (company.phone ? `Tel: ${company.phone}` : ""));
    if (body) {
      for (const ln of wrapText(font, body, 9, RIGHT - LEFT)) {
        draw(ln, LEFT, cy, { size: 9 });
        cy += 12;
      }
    }
  }

  return pdf.save();
}

export async function buildBulkPayslipZip(
  payslips: PayslipExportInput[],
  format: ExportFormat,
): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const p of payslips) {
    const safeName = (p.payslip.employee.name ?? "Unknown").replace(
      /[/\\:*?"<>|]/g,
      "_",
    );
    const filename = `${p.period}-${safeName}.${format}`;
    const buf =
      format === "xlsx"
        ? await buildPayslipWorkbookBuffer(p)
        : await buildPayslipPdfBuffer(p);
    zip.file(filename, buf);
  }
  return zip.generateAsync({ type: "uint8array" });
}
