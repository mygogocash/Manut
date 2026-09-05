/**
 * Fixed Asset import — pure per-row validation + opening-balance classification
 * (no DB). The client parses the 19-column xlsx into canonical rows and POSTs
 * them; the service loads categories + detects duplicates, then runs each row
 * through here. ALL-OR-NOTHING: the service rejects the whole file if any row
 * returns errors (mirrors importOpeningBalances), so a partial load is
 * impossible.
 *
 * Reject rules are PRD §4 "Edge Cases & Error Handling"; the opening-balance
 * split is PRD §3.A.3 (purchase date vs the cut-over).
 */

// Last audited year-end. Assets on/before this load their book value as the
// cut-over balance; assets after it are new (opening accumulated dep = 0).
export const FIXED_ASSET_CUTOVER_DATE = "2025-12-31";

const MEMO_PER_UNIT = 1;

export interface RawImportRow {
  rowNumber?: number | null;
  assetCode?: string | null;
  name?: string | null;
  nameTh?: string | null;
  quantity?: number | null;
  categoryCode?: string | null;
  location?: string | null;
  assignedUser?: string | null;
  supplier?: string | null;
  serialNo?: string | null;
  purchaseDate?: string | null; // normalized YYYY-MM-DD by the client
  startDate?: string | null;
  usefulLifeMonths?: number | null;
  purchasePrice?: number | null;
  bookValue?: number | null;
  status?: string | null;
  disposalDate?: string | null;
  sellingPrice?: number | null;
  notes?: string | null;
  linkGroup?: string | null;
}

export interface ValidatedImportRow {
  rowNumber: number;
  assetCode?: string;
  name: string;
  nameTh: string | null;
  quantity: number;
  categoryCode: string;
  location: string | null;
  assignedUser: string | null;
  supplier: string | null;
  serialNo: string | null;
  purchaseDate: string;
  startDate: string;
  usefulLifeMonths: number | null;
  purchasePrice: number;
  openingBookValue: number | null;
  openingAsOfDate: string | null;
  status: string;
  disposalDate: string | null;
  sellingPrice: number | null;
  notes: string | null;
  linkGroup: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Statuses the register accepts (mirrors FIXED_ASSET_STATUSES in the
// validation module). An unknown value is rejected rather than stored verbatim —
// a stray status silently falls outside the using/not-using bands and can never
// be submitted for disposal.
const KNOWN_STATUSES = new Set([
  "active",
  "idle",
  "pending_disposal",
  "disposed",
  "written_off",
  "transferred",
]);

// Spellings the legacy sheet uses for a canonical status. Anything not here and
// not canonical is rejected — never stored verbatim.
const STATUS_ALIASES: Record<string, string> = {
  write_off: "written_off",
  writeoff: "written_off",
  writtenoff: "written_off",
  in_use: "active",
  using: "active",
  asset_using: "active",
  in_service: "active",
  not_using: "disposed",
  asset_not_using: "disposed",
  sold: "disposed",
  pending: "pending_disposal",
  pending_approval: "pending_disposal",
  transfer: "transferred",
  unused: "idle",
};

export interface RowValidationContext {
  // Category codes that exist for the entity (lower-cased for match).
  knownCategoryCodes: Set<string>;
  /**
   * The "as at" date of the file being imported — the date its Book Value
   * column was computed at. Book Value becomes the opening anchor AT THIS DATE,
   * so re-importing an export taken on any date round-trips exactly. Defaults
   * to the cut-over for the initial statutory load (PRD §3.A.1 re-runs the
   * report as at 31-12-2025).
   */
  asOfDate?: string;
}

// `errors` empty ⇒ `value` is the load-ready row; otherwise `value` is null.
export interface RowResult {
  errors: string[];
  value: ValidatedImportRow | null;
}

/**
 * Validate + normalize a single parsed import row. Returns the load-ready row
 * or the list of reasons it fails. Does NOT check cross-row uniqueness — the
 * service dedupes asset codes across the file.
 */
export function validateFixedAssetImportRow(
  row: RawImportRow,
  ctx: RowValidationContext,
): RowResult {
  const errors: string[] = [];
  // The file's "as at" date: Book Value is the NBV on THIS date, so it becomes
  // the opening anchor at this date (not a fixed cut-over) — that keeps
  // export → unedited re-import exact for a file taken on any date.
  const asOf = ctx.asOfDate ?? FIXED_ASSET_CUTOVER_DATE;

  const name = (row.name ?? "").trim();
  if (!name) errors.push("Asset Name is required");

  const categoryCode = (row.categoryCode ?? "").trim();
  if (!categoryCode) {
    errors.push("Asset Category is required");
  } else if (!ctx.knownCategoryCodes.has(categoryCode.toLowerCase())) {
    errors.push(`Unknown Asset Category "${categoryCode}" — create it first`);
  }

  const quantity =
    row.quantity == null || !Number.isFinite(row.quantity)
      ? 1
      : Math.trunc(row.quantity);
  if (quantity < 1) errors.push("Quantity must be at least 1");

  const purchaseDate = (row.purchaseDate ?? "").trim();
  if (!ISO.test(purchaseDate)) {
    errors.push("Purchase Date is missing or not a valid date");
  }
  const startDate = (row.startDate ?? "").trim() || purchaseDate;
  if (startDate && !ISO.test(startDate)) {
    errors.push("Start Date is not a valid date");
  }
  if (
    ISO.test(purchaseDate) &&
    ISO.test(startDate) &&
    startDate < purchaseDate
  ) {
    errors.push("Start Date cannot precede the Purchase Date");
  }

  const price = row.purchasePrice;
  if (price == null || !Number.isFinite(price)) {
    errors.push("Purchase Price is required");
  } else if (price === 0) {
    errors.push(
      "Purchase Price cannot be zero — an asset can't be capitalised at nil",
    );
  }
  const memo = MEMO_PER_UNIT * quantity;
  const notes = (row.notes ?? "").trim();
  if (price != null && price < 0 && !/LINK:/i.test(notes)) {
    errors.push(
      "A negative Purchase Price is a contra line and needs a LINK: reference in Notes",
    );
  }

  // Opening-balance classification. An asset already in service on the file's
  // as-at date carries its Book Value as the anchor AT THAT DATE; one acquired
  // after it has no depreciation yet, so Book Value must equal the cost.
  let openingBookValue: number | null = null;
  let openingAsOfDate: string | null = null;
  if (ISO.test(purchaseDate) && price != null && Number.isFinite(price)) {
    const inServiceByAsOf = purchaseDate <= asOf;
    const bookValue = row.bookValue;
    if (inServiceByAsOf) {
      if (bookValue == null || !Number.isFinite(bookValue)) {
        errors.push(
          `Book Value is required for an asset already in service on ${asOf}`,
        );
      } else {
        if (price >= 0 && bookValue < memo) {
          errors.push(
            `Book Value cannot be below the memo value (${memo.toFixed(2)})`,
          );
        }
        if (price >= 0 && bookValue > price) {
          errors.push("Book Value cannot exceed the Purchase Price");
        }
        openingBookValue = bookValue;
        openingAsOfDate = asOf;
      }
    } else if (
      bookValue != null &&
      Number.isFinite(bookValue) &&
      bookValue !== price
    ) {
      // Acquired after the file's as-at date: no depreciation has run yet, so
      // opening accumulated depreciation is zero.
      errors.push(
        `For an asset acquired after ${asOf}, Book Value must equal the Purchase Price`,
      );
    }
  }

  // Normalise separators ("Write-off" / "write off" → "write_off") then reject
  // anything outside the known set, so a typo can't strand a row in a status
  // no report band or disposal path recognises.
  const rawStatus = (row.status ?? "").trim();
  const normalised =
    rawStatus === ""
      ? "active"
      : rawStatus.toLowerCase().replace(/[\s-]+/g, "_");
  const status = STATUS_ALIASES[normalised] ?? normalised;
  if (!KNOWN_STATUSES.has(status)) {
    errors.push(
      `Unknown Status "${row.status}" — expected one of ${[...KNOWN_STATUSES].join(", ")}`,
    );
  }
  const disposalDate = (row.disposalDate ?? "").trim() || null;
  if (disposalDate && !ISO.test(disposalDate)) {
    errors.push("Disposal Date is not a valid date");
  }
  const disposedStatuses = ["disposed", "written_off"];
  if (disposedStatuses.includes(status) && !disposalDate) {
    errors.push(`Status "${status}" requires a Disposal Date`);
  }
  if (status === "active" && disposalDate) {
    errors.push("An Active asset cannot have a Disposal Date");
  }
  if (
    disposalDate &&
    ISO.test(disposalDate) &&
    ISO.test(startDate) &&
    disposalDate < startDate
  ) {
    errors.push("Disposal Date cannot precede the Start Date");
  }

  if (row.usefulLifeMonths != null && row.usefulLifeMonths <= 0) {
    errors.push("Useful Life must be a positive number of months");
  }

  if (errors.length > 0) return { errors, value: null };

  // An explicit Link Group cell wins; otherwise fall back to the LINK: token
  // the legacy sheet carries in Notes.
  const explicitLink = (row.linkGroup ?? "").trim();
  const linkMatch = notes.match(/LINK:\s*([^\s,;]+)/i);
  return {
    errors: [],
    value: {
      rowNumber: row.rowNumber ?? 0,
      assetCode: (row.assetCode ?? "").trim() || undefined,
      name,
      nameTh: (row.nameTh ?? "").trim() || null,
      quantity,
      categoryCode,
      location: (row.location ?? "").trim() || null,
      assignedUser: (row.assignedUser ?? "").trim() || null,
      supplier: (row.supplier ?? "").trim() || null,
      serialNo: (row.serialNo ?? "").trim() || null,
      purchaseDate,
      startDate,
      usefulLifeMonths: row.usefulLifeMonths ?? null,
      purchasePrice: price!,
      openingBookValue,
      openingAsOfDate,
      status,
      disposalDate,
      sellingPrice:
        row.sellingPrice != null && Number.isFinite(row.sellingPrice)
          ? row.sellingPrice
          : null,
      notes: notes || null,
      linkGroup: explicitLink || (linkMatch ? linkMatch[1]! : null),
    },
  };
}
