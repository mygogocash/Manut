/**
 * Mapping for the Asset Inventory Tracker sheet — a Thai fixed-asset purchase
 * log, distinct from the IT hardware template the rest of this dialog parses.
 *
 * Header-driven rather than fixed-index, because this sheet has a title block
 * above its header and columns get inserted over time. Pure and DOM-free so the
 * parsing rules are unit-testable: they are where a bad import silently produces
 * plausible wrong numbers rather than an error.
 *
 * Sheet shape:
 *   Asset ID | Vendor/Shop | Asset Name | Category | Purchase Date | Quantity |
 *   Unit Price (THB) | Total Value (THB) | Condition | Location / Owner |
 *   Intranet update
 */

import type { AssetImportRow } from "@/services/office.service";

/** Fields this sheet can supply, keyed to the header text that identifies them. */
export const INVENTORY_FIELDS = {
  assetCode: ["asset id", "asset code", "asset no"],
  supplier: ["vendor/shop", "vendor", "shop", "supplier"],
  name: ["asset name", "item", "description of asset"],
  category: ["category", "type"],
  purchaseDate: ["purchase date", "date purchased", "date"],
  quantity: ["quantity", "qty"],
  unitPrice: ["unit price (thb)", "unit price", "price per unit", "unit cost"],
  totalValue: ["total value (thb)", "total value", "total", "amount"],
  condition: ["condition"],
  location: ["location / owner", "location/owner", "location", "room"],
} as const;

export type InventoryField = keyof typeof INVENTORY_FIELDS;

export type InventoryColumns = Partial<Record<InventoryField, number>>;

/** Fields without which a row cannot become an asset. */
export const REQUIRED_INVENTORY_FIELDS: InventoryField[] = ["name", "category"];

// \s already covers NBSP and thin space in JS; the explicit escapes are kept
// for the reader, written as escapes so no irregular whitespace sits in source.
const MONEY_STRIPPABLE = /[\u0e3f$\u20ac\u00a3,\s\u00a0\u2009\u202f'_]/g;

function headerKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a DAY-FIRST date into `YYYY-MM-DD`.
 *
 * This sheet writes DD-MM-YYYY ("20-03-2024"), and JavaScript cannot be trusted
 * with it: `new Date("20-03-2024")` is an Invalid Date, while
 * `new Date("11-09-2024")` silently parses as 9 NOVEMBER under the US
 * month-first reading. So the one row where the two readings differ is exactly
 * the row the naive parser gets wrong, and it gets it wrong quietly. Day-first
 * is asserted here rather than inferred per row, because inferring per row would
 * make the same file parse differently as data changes.
 *
 * Also accepts an Excel serial number and an already-ISO string, since a column
 * of "dates" in a hand-maintained sheet is usually a mix of all three.
 */
export function parseDayFirstDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") return excelSerialToISO(value);

  const raw = String(value).trim();
  if (!raw) return null;

  // Already ISO — take it as-is rather than round-tripping through Date.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return validOrNull(+iso[1]!, +iso[2]!, +iso[3]!);

  // A bare serial that arrived as text.
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (n > 10_000) return excelSerialToISO(n);
  }

  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(raw);
  if (dayFirst) return validOrNull(+dayFirst[3]!, +dayFirst[2]!, +dayFirst[1]!);

  return null;
}

function validOrNull(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Round-trip through UTC to reject 31 February and friends.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Excel's 1900 serial day, in UTC so the result does not shift by timezone. */
export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  // 25569 = days between 1899-12-30 (Excel epoch, incl. its leap-year bug) and
  // the Unix epoch.
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Parse a money cell.
 *
 * Values arrive as `"฿17,990.00"` — currency symbol, digit-group separators, and
 * on occasion a non-breaking or thin space from a paste. `Number()` on any of
 * those is `NaN`, which is how a price becomes silently absent rather than
 * loudly wrong.
 */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const stripped = String(value).replace(MONEY_STRIPPABLE, "");
  if (!stripped || !/^-?\d*\.?\d+$/.test(stripped)) return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

export function parseQuantity(value: unknown): number | null {
  const n = parseMoney(value);
  if (n === null) return null;
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Map the sheet's Category to an asset type.
 *
 * Only `furniture` is a real match. "Accessories" (roller blinds) and
 * "Electronics" (AV speakers) are neither computer peripherals nor furniture, so
 * they land in `other` rather than being forced into a category that would put
 * them in the wrong filter for ever.
 */
export function mapInventoryCategory(value: unknown): AssetImportRow["type"] {
  const key = headerKey(value);
  if (key.includes("furniture")) return "furniture";
  if (key.includes("laptop")) return "laptop";
  if (key.includes("monitor")) return "monitor";
  if (key.includes("mobile") || key.includes("phone")) return "mobile";
  if (key.includes("software")) return "software";
  return "other";
}

const CONDITIONS = new Set(["new", "good", "fair", "poor"]);

export function mapCondition(value: unknown): string | null {
  const key = headerKey(value);
  return CONDITIONS.has(key) ? key : null;
}

/**
 * Locate the header row.
 *
 * This sheet carries a title block and a totals block above its header, so the
 * header is not row 1 and its position moves as that block is edited. Scored by
 * how many known headers a row contains, which is stable against both.
 */
export function findInventoryHeaderRow(matrix: unknown[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(matrix.length, 40);
  for (let i = 0; i < limit; i++) {
    const cols = resolveInventoryColumns(matrix[i] ?? []);
    const score = Object.keys(cols).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // Name + category + one more: fewer than that and it is a stray row that
  // happens to say "Total", not a header.
  return bestScore >= 3 ? best : -1;
}

export function resolveInventoryColumns(header: unknown[]): InventoryColumns {
  const out: InventoryColumns = {};
  header.forEach((cell, index) => {
    const key = headerKey(cell);
    if (!key) return;
    for (const [field, aliases] of Object.entries(INVENTORY_FIELDS)) {
      const f = field as InventoryField;
      if (out[f] !== undefined) continue;
      if ((aliases as readonly string[]).includes(key)) out[f] = index;
    }
  });
  return out;
}

export interface InventoryParseIssue {
  /** 1-based sheet row, so it matches what the user sees in Excel. */
  sheetRow: number;
  name: string | null;
  problem: string;
}

export interface InventoryParseResult {
  rows: AssetImportRow[];
  /** 1-based sheet row for each returned row, index-aligned with `rows`. */
  sheetRows: number[];
  headerRow: number;
  columns: InventoryColumns;
  /** Rows skipped as blank — the tracker keeps padding rows below the data. */
  blankRows: number;
  issues: InventoryParseIssue[];
  totals: { units: number; value: number };
}

/**
 * Parse the whole sheet.
 *
 * `unitPrice` becomes `purchaseCost` and `quantity` is carried separately, so
 * `quantity × purchaseCost` reproduces the sheet's own Total Value. Any row
 * where it does not is reported as an issue rather than quietly loaded — that
 * identity is the only per-row check that the numbers survived the import, and
 * a sheet whose own arithmetic disagrees is worth a human look before it becomes
 * the asset register.
 */
export function parseInventorySheet(
  matrix: unknown[][],
  options: { sourceSheet?: string } = {},
): InventoryParseResult {
  const headerRow = findInventoryHeaderRow(matrix);
  if (headerRow < 0) {
    return {
      rows: [],
      sheetRows: [],
      headerRow: -1,
      columns: {},
      blankRows: 0,
      issues: [],
      totals: { units: 0, value: 0 },
    };
  }

  const columns = resolveInventoryColumns(matrix[headerRow] ?? []);
  const rows: AssetImportRow[] = [];
  const sheetRows: number[] = [];
  const issues: InventoryParseIssue[] = [];
  let blankRows = 0;
  let units = 0;
  let value = 0;

  const at = (row: unknown[], field: InventoryField): unknown => {
    const index = columns[field];
    return index === undefined ? null : row[index];
  };

  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const sheetRow = i + 1;
    const name = text(at(row, "name"));

    // The tracker keeps a run of padding rows below the data, each carrying a
    // Category and a ฿0.00 total but no name. They are not errors.
    if (!name) {
      blankRows++;
      continue;
    }

    // A totals footer has a name-ish cell but no category and no unit price.
    if (/^total$/i.test(name)) {
      blankRows++;
      continue;
    }

    const quantity = parseQuantity(at(row, "quantity")) ?? 1;
    const unitPrice = parseMoney(at(row, "unitPrice"));
    const totalValue = parseMoney(at(row, "totalValue"));
    const purchaseDate = parseDayFirstDate(at(row, "purchaseDate"));

    if (at(row, "purchaseDate") && !purchaseDate) {
      issues.push({
        sheetRow,
        name,
        problem: `Unreadable purchase date ${JSON.stringify(String(at(row, "purchaseDate")))} — expected DD-MM-YYYY`,
      });
    }

    if (unitPrice !== null && totalValue !== null) {
      const expected = Math.round(unitPrice * quantity * 100) / 100;
      if (Math.abs(expected - totalValue) > 0.01) {
        issues.push({
          sheetRow,
          name,
          problem: `Quantity × unit price is ${expected.toFixed(2)} but Total Value says ${totalValue.toFixed(2)}`,
        });
      }
    }

    rows.push({
      type: mapInventoryCategory(at(row, "category")),
      name,
      supplier: text(at(row, "supplier")),
      assetCode: text(at(row, "assetCode")),
      purchaseDate,
      purchaseCost: unitPrice,
      quantity,
      condition: mapCondition(at(row, "condition")),
      locationDetail: text(at(row, "location")),
      // Deliberately NOT set. This sheet has no status column, so sending a
      // default would make it an opinion: on a re-import the API would write
      // "available" over a status somebody had set to "in-repair" by hand.
      // The API still defaults it for genuinely new rows.
      sourceSheet: options.sourceSheet ?? "Asset Inventory",
    });
    sheetRows.push(sheetRow);

    units += quantity;
    // Total Value when the sheet states it, otherwise derive it — the ROW
    // total, not the unit price, which is why quantity applies to the
    // fallback only.
    const rowTotal = totalValue ?? (unitPrice ?? 0) * quantity;
    value = Math.round((value + rowTotal) * 100) / 100;
  }

  return {
    rows,
    sheetRows,
    headerRow,
    columns,
    blankRows,
    issues,
    totals: { units, value: Math.round(value * 100) / 100 },
  };
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value)
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .trim();
  return s.length === 0 ? null : s;
}

export function missingRequiredFields(
  columns: InventoryColumns,
): InventoryField[] {
  return REQUIRED_INVENTORY_FIELDS.filter((f) => columns[f] === undefined);
}
