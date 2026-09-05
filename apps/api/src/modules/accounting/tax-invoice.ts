/**
 * Tax invoice / receipt issued on AR collection (PRD 4). Drawn in Latin
 * (pdf-lib Helvetica cannot encode Thai), matching the WHT certificate path.
 */
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

import {
  formatMoney,
  type InvoiceCompany,
} from "@/modules/accounting/invoice-shared";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TaxInvoiceSource {
  receiptNo: string;
  date: Date;
  invoiceNo: string;
  counterparty: string;
  taxId: string;
  address: string;
  currency: string;
  exchangeRate: number;
  amount: number;
  vatRecognised: number;
  whtAmount: number;
  bankFee: number;
}

export interface TaxInvoiceData {
  receiptNo: string;
  date: Date;
  invoiceNo: string;
  seller: { name: string; taxId: string; address: string };
  buyer: { name: string; taxId: string; address: string };
  net: number;
  vat: number;
  wht: number;
  bankFee: number;
  total: number;
  currency: string;
  exchangeRate: number;
}

export function buildTaxInvoiceData(
  src: TaxInvoiceSource,
  company: InvoiceCompany,
): TaxInvoiceData {
  const rate = src.exchangeRate || 1;
  const gross = round2(src.amount * rate);
  const vat = round2(src.vatRecognised * rate);
  const net = round2(gross - vat);
  return {
    receiptNo: src.receiptNo,
    date: src.date,
    invoiceNo: src.invoiceNo,
    seller: {
      name: company.name,
      taxId: company.taxId,
      address: company.addressLines.join(", "),
    },
    buyer: {
      name: src.counterparty,
      taxId: src.taxId,
      address: src.address,
    },
    net,
    vat,
    wht: round2(src.whtAmount * rate),
    bankFee: round2(src.bankFee * rate),
    total: gross,
    currency: src.currency,
    exchangeRate: rate,
  };
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const RIGHT = PAGE_W - MARGIN;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.8, 0.8, 0.83);

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function buildTaxInvoicePdfBuffer(
  data: TaxInvoiceData,
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

  let y = PAGE_H - MARGIN;
  text("TAX INVOICE / RECEIPT", MARGIN, y, 16, bold);
  y -= 18;
  text(`No. ${data.receiptNo}`, MARGIN, y, 11, bold);
  text(formatDate(data.date), RIGHT - 140, y, 10);
  y -= 28;
  text("Seller", MARGIN, y, 8, bold, MUTED);
  text("Buyer", 320, y, 8, bold, MUTED);
  y -= 14;
  text(data.seller.name, MARGIN, y, 10, bold);
  text(data.buyer.name, 320, y, 10, bold);
  y -= 12;
  text(`Tax ID ${data.seller.taxId || "-"}`, MARGIN, y, 8, font, MUTED);
  text(`Tax ID ${data.buyer.taxId || "-"}`, 320, y, 8, font, MUTED);
  y -= 24;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: RIGHT, y },
    thickness: 0.5,
    color: RULE,
  });
  y -= 18;
  text(`Against invoice ${data.invoiceNo}`, MARGIN, y, 9);
  y -= 16;
  const money = (n: number) => formatMoney(n);
  const row = (label: string, value: string, boldRow = false) => {
    text(label, MARGIN, y, 10, boldRow ? bold : font);
    text(value, RIGHT - 90, y, 10, boldRow ? bold : font);
    y -= 16;
  };
  row("Net (pre-VAT)", money(data.net));
  row("VAT recognised", money(data.vat));
  if (data.wht > 0) row("WHT withheld", money(data.wht));
  if (data.bankFee > 0) row("Bank fee", money(data.bankFee));
  row("Total collected", money(data.total), true);
  y -= 8;
  text(
    data.exchangeRate === 1
      ? `Currency ${data.currency}`
      : `Currency ${data.currency} at ${data.exchangeRate}`,
    MARGIN,
    y,
    8,
    font,
    MUTED,
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
