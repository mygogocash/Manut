"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type AccountImportPreview,
  type AccountImportRow,
  type AccountImportType,
  commitAccountImport,
  previewAccountImport,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// Maps the English Category column of the standard Thai accounting
// export ("Assets" / "Liabilities" / ...) to the DB enum. Lowercased on
// lookup so the parser also handles "ASSETS" / "assets" / etc.
const CATEGORY_MAP: Record<string, AccountImportType> = {
  assets: "asset",
  asset: "asset",
  liabilities: "liability",
  liability: "liability",
  equity: "equity",
  "owner's equity": "equity",
  "shareholder's equity": "equity",
  revenue: "revenue",
  revenues: "revenue",
  income: "revenue",
  expense: "expense",
  expenses: "expense",
};

// Thai labels that may appear in the "ประเภท" column when the English
// "Category" column is blank. Belt-and-braces fallback so the importer
// still works if the English column is missing.
const THAI_CATEGORY_MAP: Record<string, AccountImportType> = {
  สินทรัพย์: "asset",
  หนี้สิน: "liability",
  ส่วนของผู้ถือหุ้น: "equity",
  รายได้: "revenue",
  ค่าใช้จ่าย: "expense",
};

interface ParseResult {
  rows: AccountImportRow[];
  skipped: Array<{ row: number; reason: string; rawCode: string }>;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // Codes may arrive as numbers (e.g. 10000) — keep them as plain
    // digit strings, not scientific notation.
    return Number.isInteger(v) ? String(v) : String(v);
  }
  return String(v).trim();
}

function pickType(english: string, thai: string): AccountImportType | null {
  const e = english.toLowerCase().trim();
  if (e && CATEGORY_MAP[e]) return CATEGORY_MAP[e]!;
  const t = thai.trim();
  if (t && THAI_CATEGORY_MAP[t]) return THAI_CATEGORY_MAP[t]!;
  return null;
}

// Finds the header row by scanning the first ~15 rows for a cell that
// reads "Code" (case-insensitive). Returns the 0-indexed row number or
// null if no header was found.
function findHeaderRow(rows: unknown[][]): number | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const r = rows[i] ?? [];
    for (let j = 0; j < r.length; j++) {
      const cell = cellToString(r[j]).toLowerCase();
      if (cell === "code") return i;
    }
  }
  return null;
}

// Returns the column indices for the canonical columns we care about
// based on the header row. Falls back to the standard Thai accounting
// export layout (Code, ชื่อบัญชี, Account Name, ประเภท, Category, …) if
// a header doesn't match.
function resolveColumns(headerRow: unknown[]): {
  code: number;
  thaiName: number;
  englishName: number;
  thaiCategory: number;
  englishCategory: number;
  englishDescription: number;
  thaiDescription: number;
} {
  let code = -1;
  let thaiName = -1;
  let englishName = -1;
  let thaiCategory = -1;
  let englishCategory = -1;
  let englishDescription = -1;
  let thaiDescription = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const cell = cellToString(headerRow[i]).toLowerCase();
    if (!cell) continue;
    if (cell === "code") code = i;
    else if (cell === "account name" || cell === "english_name") englishName = i;
    else if (cell === "ชื่อบัญชี" || cell === "thai_name") thaiName = i;
    else if (cell === "category") englishCategory = i;
    else if (cell === "ประเภท") thaiCategory = i;
    else if (
      cell === "english description" ||
      cell === "english_description" ||
      cell === "description"
    ) {
      englishDescription = i;
    } else if (
      cell === "thai description" ||
      cell === "thai_description" ||
      cell === "คำอธิบาย" ||
      cell === "คำอธิบายภาษาไทย"
    ) {
      thaiDescription = i;
    }
  }

  // Fall back to fixed positions when something is missing.
  if (code < 0) code = 0;
  if (thaiName < 0) thaiName = 1;
  if (englishName < 0) englishName = 2;
  if (thaiCategory < 0) thaiCategory = 3;
  if (englishCategory < 0) englishCategory = 4;

  return {
    code,
    thaiName,
    englishName,
    thaiCategory,
    englishCategory,
    englishDescription,
    thaiDescription,
  };
}

async function parseWorkbook(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook has no sheets");
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet) throw new Error("Could not read the first sheet");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  const headerIdx = findHeaderRow(matrix);
  if (headerIdx === null) {
    throw new Error(
      'Could not find the header row. Expected a "Code" column near the top.',
    );
  }
  const cols = resolveColumns(matrix[headerIdx] ?? []);

  const rows: AccountImportRow[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const code = cellToString(r[cols.code]);
    if (!code) continue;

    const englishName = cellToString(r[cols.englishName]);
    const thaiName = cellToString(r[cols.thaiName]);
    // Primary `name` stays English so the existing rendering and search
    // keep working; the Thai label is stored alongside on `nameTh`. When
    // the source only has Thai we fall it back into `name` to satisfy
    // the NOT-NULL column.
    const name = englishName || thaiName;
    if (!name) {
      skipped.push({
        row: i + 1,
        reason: "Missing account name",
        rawCode: code,
      });
      continue;
    }

    const englishCat = cellToString(r[cols.englishCategory]);
    const thaiCat = cellToString(r[cols.thaiCategory]);
    const type = pickType(englishCat, thaiCat);
    if (!type) {
      skipped.push({
        row: i + 1,
        reason: `Unknown category "${englishCat || thaiCat || "(blank)"}"`,
        rawCode: code,
      });
      continue;
    }

    if (seen.has(code)) {
      skipped.push({
        row: i + 1,
        reason: "Duplicate code in file",
        rawCode: code,
      });
      continue;
    }
    seen.add(code);

    const thaiOnly = thaiName && thaiName !== name ? thaiName : "";
    const englishDescription = cellToString(
      cols.englishDescription >= 0 ? r[cols.englishDescription] : "",
    );
    const thaiDescription = cellToString(
      cols.thaiDescription >= 0 ? r[cols.thaiDescription] : "",
    );

    rows.push({
      code: code.slice(0, 20),
      name: name.slice(0, 200),
      nameTh: (thaiOnly || thaiName).slice(0, 200) || undefined,
      description: (englishDescription || englishName || name).slice(0, 2000),
      descriptionTh: (thaiDescription || thaiName || name).slice(0, 2000),
      type,
    });
  }

  return { rows, skipped };
}

interface ChartOfAccountsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onImported: () => void;
}

export function ChartOfAccountsImportDialog({
  open,
  onOpenChange,
  entities,
  onImported,
}: ChartOfAccountsImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entityId, setEntityId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<AccountImportRow[]>([]);
  const [parsedSkipped, setParsedSkipped] = useState<ParseResult["skipped"]>(
    [],
  );
  const [preview, setPreview] = useState<AccountImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!entityId && entities.length === 1) {
      setEntityId(entities[0]!.id);
    }
  }, [entities, entityId]);

  function reset() {
    setFile(null);
    setRows([]);
    setParsedSkipped([]);
    setPreview(null);
    setParsing(false);
    setCommitting(false);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runPreview(
    parsed: AccountImportRow[],
    targetEntityId: string,
  ) {
    const res = await previewAccountImport({
      entityId: targetEntityId,
      rows: parsed,
    });
    setPreview(res.data);
    const s = res.data.summary;
    const parts = [`${s.inserts} to insert`];
    if (s.updates > 0) parts.push(`${s.updates} Thai name back-fill`);
    parts.push(`${s.skipped} already exist`);
    toast.success(`Parsed ${s.total} rows — ${parts.join(", ")}`);
  }

  function isXlsx(f: File): boolean {
    if (f.name.toLowerCase().endsWith(".xlsx")) return true;
    return (
      f.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  function pickFromDataTransfer(dt: DataTransfer): File | null {
    if (dt.files && dt.files.length > 0) return dt.files[0] ?? null;
    if (dt.items) {
      for (const item of dt.items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) return f;
        }
      }
    }
    return null;
  }

  async function handleFile(f: File) {
    if (!entityId) {
      toast.error("Pick an entity first");
      return;
    }
    setFile(f);
    setPreview(null);
    try {
      setParsing(true);
      const parsed = await parseWorkbook(f);
      if (parsed.rows.length === 0) {
        toast.error("No importable rows found in the workbook");
        setRows([]);
        setParsedSkipped(parsed.skipped);
        return;
      }
      setRows(parsed.rows);
      setParsedSkipped(parsed.skipped);
      await runPreview(parsed.rows, entityId);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to parse spreadsheet";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  }

  async function handleEntityChange(value: string) {
    setEntityId(value);
    if (rows.length > 0) {
      try {
        setParsing(true);
        await runPreview(rows, value);
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to refresh preview";
        toast.error(msg);
      } finally {
        setParsing(false);
      }
    }
  }

  async function handleCommit() {
    if (rows.length === 0 || !entityId) return;
    try {
      setCommitting(true);
      const res = await commitAccountImport({ entityId, rows });
      const { inserted, updated, skipped } = res.data;
      const bits: string[] = [];
      if (inserted > 0) bits.push(`${inserted} inserted`);
      if (updated > 0) bits.push(`${updated} Thai name back-filled`);
      if (skipped > 0) bits.push(`${skipped} skipped`);
      toast.success(
        bits.length > 0
          ? `Import done — ${bits.join(", ")}`
          : "Nothing to import",
      );
      onImported();
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed";
      toast.error(msg);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (committing || parsing) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[90vh] overflow-hidden
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Import Chart of Accounts</DialogTitle>
          <DialogDescription>
            Upload the standard accounting-system export. The first sheet should
            have <strong>Code</strong>, <strong>Account Name</strong>,{" "}
            <strong>ชื่อบัญชี</strong>, and <strong>Category</strong> columns —
            Thai and English names are both imported. Existing account codes are
            skipped to protect balances; only new codes get inserted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Entity</label>
            <Select value={entityId} onValueChange={handleEntityChange}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!parsing && !committing) setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
              if (!parsing && !committing) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              if (parsing || committing) return;
              const f = pickFromDataTransfer(e.dataTransfer);
              if (!f) {
                toast.error("Could not read the dropped file");
                return;
              }
              if (!isXlsx(f)) {
                toast.error("Only .xlsx files are accepted");
                return;
              }
              void handleFile(f);
            }}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
              dragOver
                ? "border-bronze bg-bronze/10"
                : "border-bronze/40 hover:bg-bronze/5",
              parsing || committing ? "pointer-events-none opacity-60" : "",
            ].join(" ")}
          >
            <UploadCloud className="text-bronze size-8" />
            <div className="text-sm font-medium">
              {file ? file.name : "Drop the .xlsx here or click to browse"}
            </div>
            <div className="text-muted-foreground text-xs">
              .xlsx — first sheet, Code + Account Name + Category columns
            </div>
            <Input
              ref={inputRef}
              id="coa-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          {parsing ? (
            <div
              className={`
                text-muted-foreground flex items-center justify-center gap-2
                py-6 text-sm
              `}
            >
              <Loader2 className="size-4 animate-spin" />
              Parsing and validating…
            </div>
          ) : null}

          {preview ? (
            <>
              <div
                className={`
                  grid grid-cols-2 gap-2
                  sm:grid-cols-6
                `}
              >
                <SummaryCard label="Total rows" value={preview.summary.total} />
                <SummaryCard
                  label="To insert"
                  value={preview.summary.inserts}
                  tone="positive"
                />
                <SummaryCard
                  label="Thai back-fill"
                  value={preview.summary.updates}
                  tone={preview.summary.updates > 0 ? "positive" : undefined}
                />
                <SummaryCard
                  label="Invalid"
                  value={preview.summary.invalid ?? 0}
                  tone={
                    (preview.summary.invalid ?? 0) > 0 ? "warning" : undefined
                  }
                />
                <SummaryCard
                  label="Already exists"
                  value={preview.summary.skipped}
                  tone={preview.summary.skipped > 0 ? "warning" : undefined}
                />
                <SummaryCard
                  label="Parser skipped"
                  value={parsedSkipped.length}
                  tone={parsedSkipped.length > 0 ? "warning" : undefined}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[600px] text-[12px]">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Code</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, idx) => (
                      <tr key={r.code} className="border-t">
                        <td className="text-muted-foreground px-2 py-1.5">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 font-medium tabular-nums">
                          {r.code}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col">
                            <span>{r.name}</span>
                            {r.nameTh ? (
                              <span
                                className="text-muted-foreground text-[11px]"
                                lang="th"
                              >
                                {r.nameTh}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 capitalize">{r.type}</td>
                        <td className="px-2 py-1.5">
                          {r.action === "skip" ? (
                            <Badge variant="amber">Skip</Badge>
                          ) : r.action === "update-th" ? (
                            <Badge variant="blue">Add Thai</Badge>
                          ) : r.action === "invalid" ? (
                            <Badge variant="red">Invalid</Badge>
                          ) : (
                            <Badge variant="green">Insert</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedSkipped.length > 0 ? (
                <div
                  className={`
                    rounded-md border border-amber-500/30 bg-amber-500/5 p-3
                    text-xs
                  `}
                >
                  <div className="mb-1 font-medium text-amber-700">
                    {parsedSkipped.length} row
                    {parsedSkipped.length === 1 ? "" : "s"} skipped during
                    parsing
                  </div>
                  <ul className="text-muted-foreground list-inside list-disc">
                    {parsedSkipped.slice(0, 8).map((s) => (
                      <li key={`${s.row}-${s.rawCode}`}>
                        Row {s.row} (code {s.rawCode || "—"}): {s.reason}
                      </li>
                    ))}
                    {parsedSkipped.length > 8 ? (
                      <li>…and {parsedSkipped.length - 8} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={committing || parsing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCommit}
            disabled={
              !preview ||
              preview.summary.inserts + preview.summary.updates === 0 ||
              committing ||
              parsing ||
              !entityId
            }
            className="min-w-32"
          >
            {committing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-4" />
            )}
            {commitButtonLabel(preview)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function commitButtonLabel(preview: AccountImportPreview | null): string {
  if (!preview) return "Import";
  const { inserts, updates } = preview.summary;
  if (inserts > 0 && updates > 0) {
    return `Import ${inserts} + back-fill ${updates}`;
  }
  if (inserts > 0) return `Import ${inserts} accounts`;
  if (updates > 0) return `Back-fill ${updates} Thai names`;
  return "Nothing to import";
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "warning";
}) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2",
        tone === "positive"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : tone === "warning"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border",
      ].join(" ")}
    >
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
