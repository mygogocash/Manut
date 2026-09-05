/**
 * Fixed Asset Report .xlsx generator (SheetJS) — the existing 19-column layout.
 * Rows are grouped by category with a category-header row and a per-category
 * "Total" row, then a grand-total row. Category-header + Total rows carry NO
 * asset code and put "Total" in the Supplier column, so the importer's skip
 * rules ignore them and an exported file re-imports cleanly. Numbers stay
 * numeric so finance can sum / pivot in Excel.
 *
 * NOTE: the column HEADERS follow the PRD's 19-column spec. When the client's
 * real Fixed Asset Report file is available, confirm the header text / block
 * matches byte-for-byte (the importer matches headers tolerantly, so minor
 * label differences still parse).
 */

import * as XLSX from "xlsx";

export interface FixedAssetExportRow {
  assetCode: string;
  name: string;
  nameTh: string;
  quantity: number;
  categoryCode: string;
  location: string;
  user: string;
  supplier: string;
  serialNo: string;
  purchaseDate: string;
  startDate: string;
  usefulLifeMonths: number;
  usagePeriodDays: number;
  purchasePrice: number;
  bookValue: number;
  status: string;
  disposalDate: string;
  sellingPrice: number | null;
  profitLoss: number | null;
  notes: string;
  linkGroup: string;
}

const HEADERS = [
  "Asset Code",
  "Asset Name",
  "Asset Name (TH)",
  "Quantity/Unit",
  "Asset Category",
  "Asset Location",
  "User",
  "Supplier",
  "Serial No.",
  "Purchase Date",
  "Start Date",
  "Useful Life (months)",
  "Usage Period (days)",
  "Purchase Price",
  "Book Value",
  "Status",
  "Disposal Date",
  "Selling Price (Excluding VAT)",
  "Profit/Loss",
  "Notes",
  "Link Group",
];

type Cell = string | number | null;

function dataRow(r: FixedAssetExportRow): Cell[] {
  return [
    r.assetCode,
    r.name,
    r.nameTh,
    r.quantity,
    r.categoryCode,
    r.location,
    r.user,
    r.supplier,
    r.serialNo,
    r.purchaseDate,
    r.startDate,
    r.usefulLifeMonths,
    r.usagePeriodDays,
    r.purchasePrice,
    r.bookValue,
    r.status,
    r.disposalDate,
    r.sellingPrice,
    r.profitLoss,
    r.notes,
    r.linkGroup,
  ];
}

// A subtotal / total row: no asset code, "Total" in the Supplier column (col 7)
// so the importer skips it; cost / book-value columns carry the sums.
function totalRow(label: string, cost: number, bookValue: number): Cell[] {
  const row: Cell[] = new Array(HEADERS.length).fill(null);
  row[1] = label;
  row[7] = "Total";
  row[13] = round2(cost);
  row[14] = round2(bookValue);
  return row;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildFixedAssetRegisterXlsx(
  rows: FixedAssetExportRow[],
  asOf: string,
): Buffer {
  const aoa: Cell[][] = [];
  aoa.push([`Fixed Asset Report — as at ${asOf}`]);
  aoa.push([]);
  aoa.push(HEADERS);

  // Group by category (stable, sorted) with a header + Total per group.
  const byCat = new Map<string, FixedAssetExportRow[]>();
  for (const r of rows) {
    const list = byCat.get(r.categoryCode) ?? [];
    list.push(r);
    byCat.set(r.categoryCode, list);
  }
  let grandCost = 0;
  let grandBook = 0;
  for (const categoryCode of [...byCat.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const group = byCat.get(categoryCode)!;
    const header: Cell[] = new Array(HEADERS.length).fill(null);
    header[4] = categoryCode; // category-header row (no asset code)
    aoa.push(header);
    let cost = 0;
    let book = 0;
    for (const r of group) {
      aoa.push(dataRow(r));
      cost += r.purchasePrice;
      book += r.bookValue;
    }
    aoa.push(totalRow(`Total ${categoryCode}`, cost, book));
    grandCost += cost;
    grandBook += book;
  }
  aoa.push([]);
  aoa.push(totalRow("Grand Total", grandCost, grandBook));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fixed Assets");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
