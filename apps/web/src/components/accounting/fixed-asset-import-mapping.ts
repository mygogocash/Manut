/**
 * Fixed Asset import — header → field resolution.
 *
 * Split out of the import dialog so the cut-over file can be VERIFIED before it
 * is loaded: the dialog renders the mapping this returns, so finance sees which
 * sheet column bound to each field instead of discovering a mis-bind from wrong
 * numbers afterwards. The client's real Fixed Asset Report was never supplied,
 * so the matcher must fail loudly on unfamiliar wording rather than guess.
 *
 * Two failure modes this guards:
 *  1. SILENT MISS — an unmatched optional column used to read as null. Quantity
 *     defaulting to 1 changes the memo value (1.00/unit) and the per-unit cost
 *     a partial disposal removes, with nothing on screen to show it happened.
 *  2. SILENT MIS-BIND — plain first-substring-wins bound "Unit Price" to
 *     Quantity, "Category Code" to Asset Code, and "Asset Name (TH)" to Asset
 *     Name whenever the Thai column sat to the left. Exact matches now outrank
 *     substrings, each field carries exclusions, and a column can only be
 *     claimed once.
 */

export type FixedAssetImportField =
  | "assetCode"
  | "name"
  | "nameTh"
  | "quantity"
  | "categoryCode"
  | "location"
  | "assignedUser"
  | "supplier"
  | "serialNo"
  | "purchaseDate"
  | "startDate"
  | "usefulLife"
  | "purchasePrice"
  | "bookValue"
  | "status"
  | "disposalDate"
  | "sellingPrice"
  | "notes"
  | "linkGroup";

/**
 * `required` blocks the import — the row validator can't produce a correct
 * asset without it. `important` still imports but changes stored values when
 * absent (quantity → 1, useful life → the category default), so it warns.
 * `optional` columns only carry descriptive text.
 */
export type FieldTier = "required" | "important" | "optional";

interface FieldSpec {
  label: string;
  tier: FieldTier;
  /** Lower-cased; an exact hit outranks a prefix, which outranks a substring. */
  aliases: string[];
  /** Header patterns that must NOT claim this field even if an alias matches. */
  exclude?: RegExp[];
  /** When absent, what the import does instead — shown next to the warning. */
  fallback?: string;
}

/**
 * Declaration order is the claim order: a more specific field takes its column
 * first, so `nameTh` claims "Asset Name (TH)" before `name` can reach it.
 * Thai aliases are here because the statutory sheet is bilingual.
 */
const FIELD_SPECS: Record<FixedAssetImportField, FieldSpec> = {
  nameTh: {
    label: "Asset Name (TH)",
    tier: "optional",
    aliases: [
      "asset name (th)",
      "name (th)",
      "asset name th",
      "thai name",
      "thai",
      "ชื่อภาษาไทย",
      "ชื่อ (ไทย)",
    ],
  },
  name: {
    label: "Asset Name",
    tier: "required",
    aliases: [
      "asset name",
      "asset description",
      "description",
      "ชื่อทรัพย์สิน",
      "ชื่อสินทรัพย์",
      "รายการ",
    ],
    exclude: [/\(\s*th\s*\)/i, /\bth\b/i, /thai/i, /ไทย/],
  },
  assetCode: {
    label: "Asset Code",
    tier: "important",
    aliases: [
      "asset code",
      "asset no",
      "asset number",
      "asset id",
      "code",
      "รหัสทรัพย์สิน",
      "รหัสสินทรัพย์",
    ],
    // "Category Code" / "Barcode" must never be read as the asset's own code.
    exclude: [/categor/i, /barcode/i, /หมวด/],
    fallback: "a new asset number is allocated",
  },
  categoryCode: {
    label: "Asset Category",
    tier: "required",
    aliases: [
      "asset category",
      "category",
      "asset class",
      "ประเภททรัพย์สิน",
      "ประเภทสินทรัพย์",
      "ประเภท",
      "หมวด",
    ],
  },
  quantity: {
    label: "Quantity",
    tier: "important",
    aliases: ["quantity", "qty", "จำนวน", "units", "unit"],
    // "Unit Price" is a money column — binding it to Quantity silently turned
    // the memo value into thousands of baht.
    exclude: [/price/i, /cost/i, /amount/i, /ราคา/, /value/i],
    fallback: "quantity 1 (changes the 1.00/unit memo value)",
  },
  location: {
    label: "Asset Location",
    tier: "optional",
    aliases: ["location", "site", "สถานที่", "ที่ตั้ง"],
  },
  assignedUser: {
    label: "User",
    tier: "optional",
    aliases: ["user", "assigned to", "holder", "ผู้ใช้", "ผู้ครอบครอง"],
    exclude: [/useful/i],
  },
  supplier: {
    label: "Supplier",
    tier: "optional",
    aliases: ["supplier", "vendor", "ผู้ขาย", "ผู้จำหน่าย"],
  },
  serialNo: {
    label: "Serial No.",
    tier: "optional",
    aliases: ["serial", "s/n", "หมายเลขเครื่อง", "หมายเลขซีเรียล"],
  },
  purchaseDate: {
    label: "Purchase Date",
    tier: "required",
    aliases: [
      "purchase date",
      "date of purchase",
      "acquisition date",
      "invoice date",
      "วันที่ซื้อ",
      "วันที่ได้มา",
    ],
    exclude: [/start/i, /disposal/i, /เริ่ม/, /จำหน่าย/],
  },
  startDate: {
    label: "Start Date",
    tier: "important",
    aliases: [
      "start date",
      "in service",
      "depreciation start",
      "วันที่เริ่ม",
      "เริ่มคิดค่าเสื่อม",
    ],
    exclude: [/purchase/i, /disposal/i],
    fallback: "the Purchase Date",
  },
  usefulLife: {
    label: "Useful Life",
    tier: "important",
    aliases: ["useful life", "life (", "life in", "อายุการใช้งาน"],
    exclude: [/usage/i],
    fallback: "the category's default life",
  },
  purchasePrice: {
    label: "Purchase Price",
    tier: "required",
    aliases: [
      "purchase price",
      "acquisition cost",
      "original cost",
      "asset cost",
      "cost",
      "ราคาทุน",
      "ราคาซื้อ",
      "มูลค่าทรัพย์สิน",
    ],
    exclude: [/cost\s*(center|centre)/i, /book\s*value/i, /accumulat/i],
  },
  bookValue: {
    label: "Book Value",
    tier: "required",
    aliases: [
      "book value",
      "net book value",
      "nbv",
      "closing value",
      "มูลค่าคงเหลือ",
      "มูลค่าสุทธิ",
      "ราคาตามบัญชี",
    ],
  },
  status: {
    label: "Status",
    tier: "important",
    aliases: ["status", "condition", "สถานะ"],
    fallback: 'status "active"',
  },
  disposalDate: {
    label: "Disposal Date",
    tier: "optional",
    aliases: [
      "disposal date",
      "date of disposal",
      "write-off date",
      "วันที่จำหน่าย",
      "วันที่ตัดจำหน่าย",
    ],
  },
  sellingPrice: {
    label: "Selling Price",
    tier: "optional",
    aliases: ["selling price", "sale price", "proceeds", "ราคาขาย"],
  },
  notes: {
    label: "Notes",
    tier: "optional",
    aliases: ["notes", "note", "remark", "หมายเหตุ"],
  },
  linkGroup: {
    label: "Link Group",
    tier: "optional",
    aliases: ["link group", "link", "กลุ่มเชื่อมโยง"],
  },
};

export const FIELD_ORDER = Object.keys(
  FIELD_SPECS,
) as readonly FixedAssetImportField[];

export type ColumnIndexes = Record<FixedAssetImportField, number>;

export interface FieldMatch {
  field: FixedAssetImportField;
  label: string;
  tier: FieldTier;
  /** -1 when no column matched. */
  index: number;
  /** The sheet's header text for `index`, or null when unmatched. */
  header: string | null;
  fallback?: string;
  /**
   * Set when this field's best column was already claimed by a more specific
   * field — the mis-bind that used to happen silently.
   */
  takenBy?: FixedAssetImportField;
}

export interface ColumnMapping {
  columns: ColumnIndexes;
  matches: FieldMatch[];
  missingRequired: FieldMatch[];
  missingImportant: FieldMatch[];
  /** Header cells no field claimed — usually the derived export-only columns. */
  unmappedHeaders: string[];
}

const norm = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Rank one header cell against a field. Higher wins; 0 = no match. Exact beats
 * prefix beats substring, so a column literally called "Quantity" always wins
 * over one that merely contains "unit".
 */
function scoreHeader(cell: string, spec: FieldSpec): number {
  if (!cell) return 0;
  if (spec.exclude?.some((re) => re.test(cell))) return 0;
  let best = 0;
  for (const alias of spec.aliases) {
    if (cell === alias) best = Math.max(best, 3);
    else if (cell.startsWith(alias)) best = Math.max(best, 2);
    else if (cell.includes(alias)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * Resolve every field against a header row. Greedy in declaration order — the
 * more specific field claims a shared column first and the loser is reported as
 * `takenBy` rather than silently pointing at the same cell.
 */
export function resolveColumnMapping(header: unknown[]): ColumnMapping {
  const cells = header.map(norm);
  const claimedBy = new Map<number, FixedAssetImportField>();
  const columns = {} as ColumnIndexes;
  const matches: FieldMatch[] = [];

  for (const field of FIELD_ORDER) {
    const spec = FIELD_SPECS[field];
    let bestIndex = -1;
    let bestScore = 0;
    let blockedBy: FixedAssetImportField | undefined;

    for (let i = 0; i < cells.length; i++) {
      const score = scoreHeader(cells[i]!, spec);
      if (score === 0 || score <= bestScore) continue;
      const owner = claimedBy.get(i);
      if (owner) {
        // Remember the near-miss only if nothing else matches at all.
        if (bestIndex < 0) blockedBy = owner;
        continue;
      }
      bestScore = score;
      bestIndex = i;
    }

    if (bestIndex >= 0) claimedBy.set(bestIndex, field);
    columns[field] = bestIndex;
    matches.push({
      field,
      label: spec.label,
      tier: spec.tier,
      index: bestIndex,
      header: bestIndex >= 0 ? String(header[bestIndex] ?? "").trim() : null,
      fallback: spec.fallback,
      takenBy: bestIndex < 0 ? blockedBy : undefined,
    });
  }

  const unmappedHeaders = cells
    .map((c, i) => (c && !claimedBy.has(i) ? String(header[i]).trim() : null))
    .filter((h): h is string => h !== null);

  return {
    columns,
    matches,
    missingRequired: matches.filter(
      (m) => m.index < 0 && m.tier === "required",
    ),
    missingImportant: matches.filter(
      (m) => m.index < 0 && m.tier === "important",
    ),
    unmappedHeaders,
  };
}

/**
 * Locate the header row by scoring every candidate row, not by matching one
 * hardcoded cell. The old rule needed a cell equal to "asset code" exactly, so
 * a sheet labelled "Asset No." or "รหัสทรัพย์สิน" was rejected outright as
 * "no header row" with no hint why.
 */
export function findHeaderRow(matrix: unknown[][]): number {
  let bestRow = -1;
  let bestScore = 0;
  const limit = Math.min(matrix.length, 25);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    if (row.length < 4) continue;
    const mapping = resolveColumnMapping(row);
    const matched = mapping.matches.filter((m) => m.index >= 0).length;
    // A data row can incidentally match a word or two; a header row matches
    // many AND carries at least one of the identifying columns.
    const identified =
      mapping.columns.assetCode >= 0 ||
      (mapping.columns.name >= 0 && mapping.columns.purchasePrice >= 0);
    if (matched >= 5 && identified && matched > bestScore) {
      bestScore = matched;
      bestRow = i;
    }
  }
  return bestRow;
}
