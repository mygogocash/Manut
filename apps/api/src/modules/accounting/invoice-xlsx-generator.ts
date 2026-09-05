/**
 * Invoice Excel (.xlsx) generator (SheetJS). One worksheet mirroring the
 * invoice template: company letterhead, BILL TO + meta, a line-item table with
 * real numeric cells, Subtotal / VAT / custom tax / WHT / TOTAL DUE, and the
 * bank block. Numbers stay numeric so finance can pivot / sum in Excel.
 *
 * Public API: buildInvoiceXlsxBuffer(doc, company, totals) → Buffer
 */
import * as XLSX from "xlsx";

import {
  formatInvoiceDate,
  type InvoiceCompany,
  type InvoiceDoc,
  type InvoiceTotals,
} from "@/modules/accounting/invoice-shared";

type Cell = string | number | null;

export function buildInvoiceXlsxBuffer(
  doc: InvoiceDoc,
  company: InvoiceCompany,
  totals: InvoiceTotals,
): Buffer {
  const cur = doc.currency;
  const rows: Cell[][] = [];

  // ── Letterhead ─────────────────────────────────────────────────────────
  rows.push([company.name, null, null, "INVOICE"]);
  for (const line of company.addressLines) rows.push([line]);
  if (company.taxId) rows.push([`Tax ID: ${company.taxId}`]);
  const contact = [
    company.email ? `Email: ${company.email}` : "",
    company.tel ? `Tel: ${company.tel}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  if (contact) rows.push([contact]);
  rows.push([null, null, null, `No. ${doc.invoiceNo}`]);
  rows.push([]);

  // ── BILL TO + meta (two columns) ─────────────────────────────────────────
  const billLines = [
    doc.counterparty,
    ...doc.billToAddress.split("\n").filter(Boolean),
  ];
  const meta: Array<[string, string]> = [
    ["Issue Date:", formatInvoiceDate(doc.issueDate)],
    ["Due Date:", formatInvoiceDate(doc.dueDate)],
    ...(doc.paymentTerms
      ? ([["Payment Terms:", doc.paymentTerms]] as [string, string][])
      : []),
    ["Currency:", cur],
    ...(doc.reference
      ? ([["Reference:", doc.reference]] as [string, string][])
      : []),
  ];
  rows.push(["BILL TO"]);
  const bodyRows = Math.max(billLines.length, meta.length);
  for (let i = 0; i < bodyRows; i++) {
    const bill = billLines[i] ?? "";
    const m = meta[i];
    rows.push([bill, null, m ? m[0] : null, m ? m[1] : null]);
  }
  rows.push([]);

  // ── Line-item table ──────────────────────────────────────────────────────
  rows.push(["Description", "Qty", `Unit Price (${cur})`, `Amount (${cur})`]);
  for (const li of doc.lineItems) {
    rows.push([li.description, li.quantity, li.unitPrice, li.amount]);
  }
  rows.push([]);

  // ── Notes (optional) ──────────────────────────────────────────────────────
  if (doc.notes) {
    rows.push(["Note"]);
    for (const line of doc.notes.split("\n").filter(Boolean)) rows.push([line]);
    rows.push([]);
  }

  // ── Totals (label in col C, value in col D — numeric) ────────────────────
  rows.push([null, null, "Subtotal", totals.subtotal]);
  rows.push([null, null, `VAT (${doc.vatRate}%)`, totals.vatAmount]);
  if (doc.taxLabel || doc.taxRate) {
    rows.push([
      null,
      null,
      `${doc.taxLabel || "Tax"} (${doc.taxRate}%)`,
      totals.taxAmount,
    ]);
  }
  rows.push([null, null, `WHT (${doc.whtRate}%)`, -totals.whtAmount]);
  rows.push([null, null, `TOTAL DUE (${cur})`, totals.total]);
  rows.push([]);

  // ── Payment details ───────────────────────────────────────────────────────
  if (company.bankName || company.bankAccountNo) {
    rows.push(["Payment Details"]);
    const bank: Array<[string, string]> = [
      ["Bank:", company.bankName],
      ["Account Type:", company.bankAccountType],
      ["Branch:", company.bankBranch],
      ["Account Name:", company.bankAccountName],
      ["Account No.:", company.bankAccountNo],
      ["SWIFT:", company.bankSwift],
    ];
    for (const [label, value] of bank) if (value) rows.push([label, value]);
  }
  if (company.footerNote) {
    rows.push([]);
    rows.push([company.footerNote]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 52 }, { wch: 10 }, { wch: 20 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out;
}
