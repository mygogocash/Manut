"use client";

import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import {
  type ColumnMapping,
  findHeaderRow,
  resolveColumnMapping,
} from "@/components/accounting/fixed-asset-import-mapping";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import {
  commitFixedAssetImport,
  type FixedAssetImportResult,
  type FixedAssetImportRow,
  previewFixedAssetImport,
} from "@/services/accounting.service";

// ── Parsing helpers (tolerant to header wording; see 19-column PRD layout) ──
// Header → field resolution lives in ./fixed-asset-import-mapping so the
// mapping can be shown to the user (and unit-tested) before anything loads.

function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const trimmed = String(v).trim();
  if (trimmed === "" || trimmed === "-") return null;
  // Accounting formats carry the sign OUTSIDE the digits: "(5,000.00)" and
  // "5,000.00-" are both negative, and exports use U+2212/U+2013 dashes.
  // Stripping punctuation first turned every contra line positive.
  const negative =
    /^\(.*\)$/.test(trimmed) ||
    /-\s*$/.test(trimmed) ||
    /^[-\u2212\u2013]/.test(trimmed);
  // Strip whitespace incl. NBSP + thin/narrow spaces, then digit-group
  // separators — accounting exports embed these and a plain
  // Number(" 300,000.00 ") returns NaN (repo-wide coerceNumber convention).
  const digits = trimmed
    .replace(/[\s\u00a0\u2009\u202f]/g, "")
    .replace(/[,'_]/g, "")
    .replace(/[^\d.]/g, "");
  if (digits === "" || digits === ".") return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// Normalise a cell to YYYY-MM-DD. Accepts DD-MM-YYYY / DD/MM/YYYY / ISO /
// Date object. Returns "" when it can't be parsed (the server rejects blanks).
function normalizeDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validCalendarDate(+iso[1]!, +iso[2]!, +iso[3]!);
  // Day-first (DD-MM-YYYY / DD/MM/YYYY) is the sheet's format. A calendar
  // round-trip check rejects impossible dates instead of emitting a string
  // like "2025-31-12" that passes the regex and blows up server-side.
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (dmy) {
    const year = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return validCalendarDate(year, Number(dmy[2]), Number(dmy[1]));
  }
  return "";
}

// Build YYYY-MM-DD only when the parts are a real calendar date.
function validCalendarDate(y: number, m: number, d: number): string {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return "";
  }
  return dt.toISOString().slice(0, 10);
}

// Useful Life → months. The UNIT comes from the column header ("Useful Life
// (months)" vs "Useful Life" = years), falling back to a unit word in the cell
// itself. Reading the unit off the cell alone silently multiplied our own
// export's bare "60" (already months) by 12.
function parseUsefulLifeMonths(
  v: unknown,
  headerSaysMonths: boolean,
): number | null {
  const n = coerceNumber(v);
  if (n == null) return null;
  const cell = String(v ?? "");
  if (headerSaysMonths || /month|เดือน/i.test(cell)) return Math.round(n);
  if (/year|yr|ปี/i.test(cell)) return Math.round(n * 12);
  // No unit anywhere: a small number reads as years (the legacy sheet stores
  // 3 / 5), a large one as months.
  return n <= 12 ? Math.round(n * 12) : Math.round(n);
}

// Our export stamps "Fixed Asset Report — as at YYYY-MM-DD" above the table.
// Reading it back means Book Value is anchored at the date it was computed at,
// so an unedited export round-trips exactly. Absent → the server defaults to
// the statutory cut-over (the initial-load case, PRD §3.A.1).
function findFileAsOf(
  matrix: unknown[][],
  headerIdx: number,
): string | undefined {
  for (let i = 0; i < headerIdx; i++) {
    for (const cell of matrix[i] ?? []) {
      const m = String(cell ?? "").match(/as at\s*:?\s*(\d{4}-\d{2}-\d{2})/i);
      if (m) return m[1];
    }
  }
  return undefined;
}

interface ParseOutput {
  rows: FixedAssetImportRow[];
  skipped: number;
  mapping: ColumnMapping;
}

function parseRows(matrix: unknown[][], headerIdx: number): ParseOutput {
  const headerCells = matrix[headerIdx] ?? [];
  const mapping = resolveColumnMapping(headerCells);
  const cols = mapping.columns;
  const headerSaysMonths =
    cols.usefulLife >= 0 &&
    /month/i.test(String(headerCells[cols.usefulLife] ?? ""));
  const at = (row: unknown[], i: number) => (i >= 0 ? row[i] : null);
  const rows: FixedAssetImportRow[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const supplier = String(at(row, cols.supplier) ?? "");
    const name = String(at(row, cols.name) ?? "").trim();
    const assetCode = String(at(row, cols.assetCode) ?? "").trim();
    const priceRaw = at(row, cols.purchasePrice);
    const purchaseDate = normalizeDate(at(row, cols.purchaseDate));
    // Skip structurally, never on a supplier substring: a real vendor called
    // "Total Solutions Ltd" was being dropped silently. Category-header and
    // sub/grand-total rows are exactly the rows with NO asset code and no
    // purchase date (the generator emits them that way) — PRD §3.A.2.
    const isTotalLabel = /^(total|grand total|รวม)\b/i.test(name);
    if (
      !assetCode &&
      (!purchaseDate || isTotalLabel) &&
      (!name || isTotalLabel || coerceNumber(priceRaw) == null)
    ) {
      skipped++;
      continue;
    }
    rows.push({
      rowNumber: i + 1,
      assetCode: assetCode || null,
      name: name || null,
      quantity: coerceNumber(at(row, cols.quantity)),
      categoryCode: String(at(row, cols.categoryCode) ?? "").trim() || null,
      location: String(at(row, cols.location) ?? "").trim() || null,
      assignedUser: String(at(row, cols.assignedUser) ?? "").trim() || null,
      supplier: supplier.trim() || null,
      serialNo: String(at(row, cols.serialNo) ?? "").trim() || null,
      purchaseDate: purchaseDate || null,
      startDate: normalizeDate(at(row, cols.startDate)) || null,
      usefulLifeMonths: parseUsefulLifeMonths(
        at(row, cols.usefulLife),
        headerSaysMonths,
      ),
      purchasePrice: coerceNumber(priceRaw),
      bookValue: coerceNumber(at(row, cols.bookValue)),
      status: String(at(row, cols.status) ?? "").trim() || null,
      disposalDate: normalizeDate(at(row, cols.disposalDate)) || null,
      sellingPrice: coerceNumber(at(row, cols.sellingPrice)),
      notes: String(at(row, cols.notes) ?? "").trim() || null,
      nameTh: String(at(row, cols.nameTh) ?? "").trim() || null,
      linkGroup: String(at(row, cols.linkGroup) ?? "").trim() || null,
    });
  }
  return { rows, skipped, mapping };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  onImported: () => void;
}

export function FixedAssetImportDialog({
  open,
  onOpenChange,
  entityId,
  onImported,
}: Props) {
  const [rows, setRows] = useState<FixedAssetImportRow[]>([]);
  const [fileAsOf, setFileAsOf] = useState<string | undefined>(undefined);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<FixedAssetImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setRows([]);
    setFileAsOf(undefined);
    setSkipped(0);
    setFileName("");
    setMapping(null);
    setResult(null);
  }

  async function onFile(file: File) {
    reset();
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: false,
      });
      const headerIdx = findHeaderRow(matrix);
      if (headerIdx < 0) {
        toast.error(
          "Could not find the header row — expected columns such as Asset Code, Asset Name, Purchase Price",
        );
        return;
      }
      const asOf = findFileAsOf(matrix, headerIdx);
      setFileAsOf(asOf);
      const parsed = parseRows(matrix, headerIdx);
      setMapping(parsed.mapping);
      // A required column that never bound would otherwise surface as the same
      // error repeated on every row ("Book Value is required" ×300), which
      // reads as bad data rather than an unrecognised header.
      if (parsed.mapping.missingRequired.length > 0) {
        toast.error(
          `Unrecognised column${parsed.mapping.missingRequired.length > 1 ? "s" : ""}: ${parsed.mapping.missingRequired
            .map((m) => m.label)
            .join(", ")}`,
        );
        return;
      }
      if (parsed.rows.length === 0) {
        toast.error("No data rows found in the file");
        return;
      }
      setRows(parsed.rows);
      setSkipped(parsed.skipped);
      setBusy(true);
      const res = await previewFixedAssetImport(entityId, parsed.rows, asOf);
      setResult(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to read file",
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    try {
      setBusy(true);
      const res = await commitFixedAssetImport(entityId, rows, fileAsOf);
      setResult(res.data);
      if (res.data.ok) {
        toast.success(`Imported ${res.data.loaded ?? rows.length} asset(s)`);
        onImported();
        onOpenChange(false);
        reset();
      } else {
        toast.error("Import rejected — fix the flagged rows and re-upload");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to import");
    } finally {
      setBusy(false);
    }
  }

  const canCommit =
    !!result &&
    result.summary.errorCount === 0 &&
    result.summary.valid > 0 &&
    (mapping?.missingRequired.length ?? 0) === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next);
          if (!next) reset();
        }
      }}
    >
      <DialogContent
        className={`
          flex max-h-[90vh] flex-col overflow-hidden
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>Import fixed assets</DialogTitle>
          <DialogDescription>
            Upload the 19-column Fixed Asset Report. Category-header and Total
            rows are ignored. Import is all-or-nothing — any error rejects the
            whole file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <label
            className={`
              border-border flex cursor-pointer flex-col items-center gap-2
              rounded-lg border border-dashed p-6 text-center text-sm
              hover:bg-accent
            `}
          >
            <Upload className="text-muted-foreground size-5" />
            <span className="text-muted-foreground">
              {fileName || "Choose an .xlsx file"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>

          {mapping ? <ColumnMappingPanel mapping={mapping} /> : null}

          {result ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat label="Rows" value={result.summary.total} />
                <Stat label="New" value={result.summary.inserts} />
                <Stat label="Update" value={result.summary.updates} />
                <Stat
                  label="Errors"
                  value={result.summary.errorCount}
                  danger={result.summary.errorCount > 0}
                />
              </div>
              {skipped > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {skipped} header / total row(s) skipped.
                </p>
              ) : null}
              {result.errors.length > 0 ? (
                <div
                  className={`
                    border-destructive/40 bg-destructive/5 max-h-48 space-y-1
                    overflow-y-auto rounded-md border p-3 text-xs
                  `}
                >
                  {result.errors.slice(0, 30).map((e) => (
                    <div key={e.rowNumber}>
                      <span className="font-medium">Row {e.rowNumber}:</span>{" "}
                      {e.messages.join("; ")}
                    </div>
                  ))}
                  {result.errors.length > 30 ? (
                    <div className="text-muted-foreground">
                      …and {result.errors.length - 30} more
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-emerald-600">
                  All rows valid — ready to import.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void commit()}
            disabled={!canCommit || busy}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shows which sheet column bound to each field. The client's real Fixed Asset
 * Report was never supplied, so this is the cut-over verification step: read
 * the mapping before importing rather than reconciling wrong numbers after.
 */
function ColumnMappingPanel({ mapping }: { mapping: ColumnMapping }) {
  const matched = mapping.matches.filter((m) => m.index >= 0);
  return (
    <details className="border-border rounded-md border text-xs" open>
      <summary className="cursor-pointer px-3 py-2 font-medium">
        Column mapping — {matched.length} of {mapping.matches.length} matched
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <ul className="divide-border divide-y">
          {mapping.matches.map((m) => (
            <li key={m.field} className="flex items-baseline gap-2 py-1">
              <span className="w-32 shrink-0 font-medium">{m.label}</span>
              {m.index >= 0 ? (
                <span className="text-muted-foreground truncate">
                  ← {m.header}
                </span>
              ) : (
                <span
                  className={
                    m.tier === "required"
                      ? "text-destructive"
                      : m.tier === "important"
                        ? "text-amber-600"
                        : "text-muted-foreground"
                  }
                >
                  not found
                  {m.takenBy ? ` (column taken by ${m.takenBy})` : ""}
                  {m.fallback ? ` — imports as ${m.fallback}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
        {mapping.unmappedHeaders.length > 0 ? (
          <p className="text-muted-foreground">
            Ignored columns: {mapping.unmappedHeaders.join(", ")}
          </p>
        ) : null}
        {mapping.missingRequired.length > 0 ? (
          <p className="text-destructive">
            Rename the highlighted column(s) in the sheet to match, then
            re-upload.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="border-border rounded-md border p-2">
      <div
        className={
          danger
            ? "text-destructive text-lg font-medium tabular-nums"
            : "text-lg font-medium tabular-nums"
        }
      >
        {value}
      </div>
      <div className="text-muted-foreground text-[10px] uppercase">{label}</div>
    </div>
  );
}
