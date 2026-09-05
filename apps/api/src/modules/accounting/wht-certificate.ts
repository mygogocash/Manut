/**
 * Withholding-tax certificate (Form 50 Bis / หนังสือรับรองการหักภาษี ณ ที่จ่าย)
 * for a supplier payment on which WE withheld tax (M6). Two parts:
 *   - buildWhtCertificateData: pure assembly (source → base currency) so the
 *     numbers are unit-tested and reproducible from the payment.
 *   - buildWhtCertificatePdfBuffer: a single-page pdf-lib render.
 *
 * NOTE: pdf-lib's StandardFonts.Helvetica cannot encode Thai glyphs, so all
 * DRAWN text is English/Latin. The Thai form name lives only in comments.
 */
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

import {
  formatMoney,
  type InvoiceCompany,
} from "@/modules/accounting/invoice-shared";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// The payment as the assembler needs it — a plain shape (not a Prisma type) so
// the function stays pure and testable.
export interface WhtCertificateSource {
  paymentId: string;
  date: Date;
  currency: string | null;
  exchangeRate: number; // source → base (1 for base currency)
  whtAmount: number; // withheld, source currency
  invoice: {
    counterparty: string;
    whtRate: number; // percentage, e.g. 3
    vendor: {
      name?: string | null;
      taxId?: string | null;
      addressEn?: string | null;
      branch?: string | null;
    } | null;
  };
}

export interface WhtCertificateData {
  certNo: string;
  date: Date;
  payer: { name: string; taxId: string; address: string };
  payee: { name: string; taxId: string; address: string };
  // All money in the entity base currency (THB).
  incomeType: string;
  incomeBase: number; // assessable income the tax was withheld on
  whtBase: number; // tax withheld
  whtRatePct: number;
}

// A stable, deterministic certificate number derived from the payment (no
// counter, so re-downloads give the same number). A true RD-sequential number
// would need a persisted field — a follow-up.
function certNoFor(paymentId: string, date: Date): string {
  const ym = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const tail = paymentId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();
  return `WHT-${ym}-${tail}`;
}

export function buildWhtCertificateData(
  src: WhtCertificateSource,
  company: InvoiceCompany,
): WhtCertificateData {
  const rate = src.exchangeRate || 1;
  const whtBase = round2(src.whtAmount * rate);
  const whtRatePct = src.invoice.whtRate;
  // Income = tax ÷ rate (exact: tax = income × rate at withholding). 0 when the
  // rate is unknown, so the tax figure the certificate reports stays correct.
  const incomeBase = whtRatePct > 0 ? round2(whtBase / (whtRatePct / 100)) : 0;
  const vendor = src.invoice.vendor;
  return {
    certNo: certNoFor(src.paymentId, src.date),
    date: src.date,
    payer: {
      name: company.name,
      taxId: company.taxId,
      address: company.addressLines.join(", "),
    },
    payee: {
      name: vendor?.name || src.invoice.counterparty,
      taxId: vendor?.taxId || "",
      address: vendor?.addressEn || "",
    },
    incomeType: "Services / professional fees (Section 40)",
    incomeBase,
    whtBase,
    whtRatePct,
  };
}

// ── PDF render ───────────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 50;
const RIGHT = PAGE_W - MARGIN;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.8, 0.8, 0.83);
const SHADE = rgb(0.95, 0.95, 0.96);

function formatCertDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function buildWhtCertificatePdfBuffer(
  data: WhtCertificateData,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = (
    s: string,
    x: number,
    y: number,
    size = 9,
    f: PDFFont = font,
    color = INK,
  ) => page.drawText(s, { x, y, size, font: f, color });
  const rightText = (
    s: string,
    xRight: number,
    y: number,
    size = 9,
    f: PDFFont = font,
    color = INK,
  ) => text(s, xRight - f.widthOfTextAtSize(s, size), y, size, f, color);
  const rule = (y: number, x1 = MARGIN, x2 = RIGHT, color = RULE) =>
    page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.75,
      color,
    });

  let y = PAGE_H - MARGIN;

  // Title.
  text("Withholding Tax Certificate", MARGIN, y, 15, bold);
  y -= 16;
  text(
    "Form 50 Bis  ·  Certificate of tax withheld at source",
    MARGIN,
    y,
    9,
    font,
    MUTED,
  );
  rightText(`No. ${data.certNo}`, RIGHT, PAGE_H - MARGIN, 10, bold);
  rightText(
    `Date: ${formatCertDate(data.date)}`,
    RIGHT,
    PAGE_H - MARGIN - 15,
    9,
    font,
    MUTED,
  );
  y -= 10;
  rule(y);
  y -= 20;

  // Party blocks (payer left, payee right).
  const drawParty = (
    heading: string,
    p: { name: string; taxId: string; address: string },
    x: number,
    top: number,
  ) => {
    let yy = top;
    text(heading, x, yy, 8, bold, MUTED);
    yy -= 13;
    text(p.name, x, yy, 10, bold);
    yy -= 12;
    if (p.taxId) {
      text(`Tax ID: ${p.taxId}`, x, yy, 8, font, MUTED);
      yy -= 11;
    }
    for (const line of wrapText(p.address, 230, 8, font)) {
      if (!line) continue;
      text(line, x, yy, 8, font, MUTED);
      yy -= 10;
    }
    return yy;
  };
  const leftEnd = drawParty("PAYER (withholding agent)", data.payer, MARGIN, y);
  const rightEnd = drawParty("PAYEE (income recipient)", data.payee, 320, y);
  y = Math.min(leftEnd, rightEnd) - 16;

  // Income / WHT table.
  const rowH = 16;
  page.drawRectangle({
    x: MARGIN,
    y: y - rowH + 4,
    width: RIGHT - MARGIN,
    height: rowH,
    color: SHADE,
  });
  text("Type of income", MARGIN + 4, y, 8, bold);
  rightText("Amount paid (THB)", 440, y, 8, bold);
  rightText("Tax withheld (THB)", RIGHT, y, 8, bold);
  y -= rowH + 4;

  text(data.incomeType, MARGIN + 4, y, 9);
  rightText(formatMoney(data.incomeBase), 440, y, 9);
  rightText(formatMoney(data.whtBase), RIGHT, y, 9);
  y -= 14;
  text(`Rate withheld: ${data.whtRatePct}%`, MARGIN + 4, y, 8, font, MUTED);
  y -= 12;
  rule(y + 6);
  y -= 6;
  text("Total tax withheld (THB)", MARGIN + 4, y, 10, bold);
  rightText(formatMoney(data.whtBase), RIGHT, y, 10, bold);
  y -= 30;

  // Declaration + signature line.
  for (const line of wrapText(
    "I hereby certify that the above particulars are correct and that the tax stated has been withheld and will be remitted to the Revenue Department.",
    RIGHT - MARGIN,
    8,
    font,
  )) {
    text(line, MARGIN, y, 8, font, MUTED);
    y -= 11;
  }
  y -= 40;
  rule(y, RIGHT - 200, RIGHT);
  rightText("Authorised signature", RIGHT, y - 12, 8, font, MUTED);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

// Greedy word-wrap to a pixel width.
function wrapText(
  s: string,
  width: number,
  size: number,
  f: PDFFont,
): string[] {
  const out: string[] = [];
  for (const paragraph of s.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(trial, size) > width && line) {
        out.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    out.push(line);
  }
  return out;
}
