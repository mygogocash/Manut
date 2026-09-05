"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { JOURNAL_IMPORT_STATUSES } from "@/components/accounting/accounting-utils";
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
  commitJournalImport,
  type JournalImportEntry,
  type JournalImportLanguage,
  type JournalImportPreview,
  type JournalImportStatus,
  previewJournalImport,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// GL exports come in English or Thai. Header tokens we look for in row 5
// (0-indexed) — first hit wins per column.
const HEADER_TOKENS = {
  accountCode: ["account code", "รหัสบัญชี"],
  date: ["date", "วันที่"],
  voucher: ["journal voucher", "สมุดรายวัน"],
  docNo: ["document no.", "document no", "เลขที่เอกสาร"],
  accountName: ["account name", "ชื่อบัญชี"],
  description: ["description/item description", "รายละเอียด/คำอธิบายรายการ"],
  debit: ["debit", "เดบิต"],
  credit: ["credit", "เครดิต"],
} as const;

interface ColumnMap {
  accountCode: number;
  date: number;
  voucher: number;
  docNo: number;
  accountName: number;
  description: number;
  debit: number;
  credit: number;
}

interface ParsedRow {
  reference: string;
  date: string;
  description: string;
  voucher: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface ParseResult {
  entries: JournalImportEntry[];
  totalRows: number;
  uniqueVouchers: number;
  skipped: Array<{ row: number; reason: string }>;
  detectedLanguage: "en" | "th" | "mixed";
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// "  41,324.28  " / "  -    " / " " / "(41,324.28)" / null → number.
// GL formats credit as " 41,324.28 " and the per-line Amount uses
// parentheses for negatives. The Debit/Credit columns themselves are
// always non-negative; treat any negative value as 0 to be safe.
function parseAmount(v: unknown): number {
  if (v === null || v === undefined) return 0;
  // Strip ASCII whitespace, NBSP (U+00A0), narrow-NBSP (U+202F), commas,
  // single-quote digit-group separators - common in GL exports.
  const s = String(v)
    .replace(/[\s,'\u00A0\u202F]/g, "")
    .trim();
  if (!s || s === "-") return 0;
  const neg = s.startsWith("(") && s.endsWith(")");
  const inner = neg ? s.slice(1, -1) : s;
  const n = Number(inner);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, neg ? -n : n);
}

// "05/01/2026" → "2026-01-05". Returns null when unparseable.
function parseDDMMYYYY(v: unknown): string | null {
  const s = cellToString(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1]!.padStart(2, "0");
  const mm = m[2]!.padStart(2, "0");
  const yyyy = m[3]!;
  return `${yyyy}-${mm}-${dd}`;
}

function findHeaderRow(rows: unknown[][]): number | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const r = rows[i] ?? [];
    for (const cell of r) {
      const c = cellToString(cell).toLowerCase();
      if (HEADER_TOKENS.accountCode.some((t) => c === t.toLowerCase())) {
        return i;
      }
    }
  }
  return null;
}

function resolveColumns(headerRow: unknown[]): ColumnMap | null {
  const cols: ColumnMap = {
    accountCode: -1,
    date: -1,
    voucher: -1,
    docNo: -1,
    accountName: -1,
    description: -1,
    debit: -1,
    credit: -1,
  };

  for (let i = 0; i < headerRow.length; i++) {
    const cell = cellToString(headerRow[i]).toLowerCase();
    if (!cell) continue;
    (Object.keys(HEADER_TOKENS) as Array<keyof typeof HEADER_TOKENS>).forEach(
      (key) => {
        if (cols[key] < 0) {
          const tokens = HEADER_TOKENS[key];
          if (tokens.some((t) => cell === t.toLowerCase())) {
            cols[key] = i;
          }
        }
      },
    );
  }

  // Required columns: account code, date, doc no, debit, credit.
  // Description/voucher/account name are nice-to-have. Fall back to fixed
  // positions when something is missing — matches the canonical GL layout.
  if (cols.accountCode < 0) cols.accountCode = 0;
  if (cols.date < 0) cols.date = 1;
  if (cols.voucher < 0) cols.voucher = 2;
  if (cols.docNo < 0) cols.docNo = 3;
  if (cols.accountName < 0) cols.accountName = 4;
  if (cols.description < 0) cols.description = 7;
  if (cols.debit < 0) cols.debit = 8;
  if (cols.credit < 0) cols.credit = 9;

  return cols;
}

function detectLanguage(headerRow: unknown[]): "en" | "th" | "mixed" {
  const text = headerRow.map((c) => cellToString(c)).join(" ");
  const hasThai = /[฀-๿]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);
  if (hasThai && hasEnglish) return "mixed";
  if (hasThai) return "th";
  return "en";
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
    raw: false,
  });

  const headerIdx = findHeaderRow(matrix);
  if (headerIdx === null) {
    throw new Error(
      "Could not find header row. Expected an 'Account Code' or 'รหัสบัญชี' column near the top.",
    );
  }
  const headerRow = matrix[headerIdx] ?? [];
  const cols = resolveColumns(headerRow);
  if (!cols) throw new Error("Could not map columns");
  const language = detectLanguage(headerRow);

  const parsedRows: ParsedRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const code = cellToString(r[cols.accountCode]);
    if (!code) continue;
    const docNo = cellToString(r[cols.docNo]);
    const dateStr = cellToString(r[cols.date]);
    // Opening balance / balance summary rows have an account code but no
    // date and no doc number. Quietly skip — they're not journal lines.
    if (!docNo && !dateStr) continue;
    if (!docNo) {
      skipped.push({ row: i + 1, reason: "Missing document number" });
      continue;
    }
    const date = parseDDMMYYYY(dateStr);
    if (!date) {
      skipped.push({
        row: i + 1,
        reason: `Unparseable date "${dateStr}"`,
      });
      continue;
    }

    const debit = parseAmount(r[cols.debit]);
    const credit = parseAmount(r[cols.credit]);
    if (debit <= 0 && credit <= 0) {
      skipped.push({
        row: i + 1,
        reason: "Both debit and credit are zero",
      });
      continue;
    }

    parsedRows.push({
      reference: docNo,
      date,
      description: cellToString(r[cols.description]),
      voucher: cellToString(r[cols.voucher]),
      accountCode: code,
      accountName: cellToString(r[cols.accountName]),
      debit,
      credit,
    });
  }

  // Group by reference (Document No).
  const byRef = new Map<string, ParsedRow[]>();
  for (const row of parsedRows) {
    const arr = byRef.get(row.reference) ?? [];
    arr.push(row);
    byRef.set(row.reference, arr);
  }

  const entries: JournalImportEntry[] = [];
  for (const [reference, rows] of byRef) {
    const first = rows[0]!;
    const description = first.description || first.voucher || undefined;
    entries.push({
      reference,
      date: first.date,
      description: description?.slice(0, 500),
      lines: rows.map((r) => ({
        accountCode: r.accountCode,
        debit: r.debit,
        credit: r.credit,
      })),
    });
  }

  return {
    entries,
    totalRows: parsedRows.length,
    uniqueVouchers: byRef.size,
    skipped,
    detectedLanguage: language,
  };
}

interface JournalEntriesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onImported: () => void;
}

export function JournalEntriesImportDialog({
  open,
  onOpenChange,
  entities,
  onImported,
}: JournalEntriesImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entityId, setEntityId] = useState<string>("");
  const [status, setStatus] = useState<JournalImportStatus>("posted");
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<JournalImportEntry[]>([]);
  const [parsedSkipped, setParsedSkipped] = useState<ParseResult["skipped"]>(
    [],
  );
  const [detectedLanguage, setDetectedLanguage] = useState<
    ParseResult["detectedLanguage"] | null
  >(null);
  // Language to attribute the upload to — the server fills `description`
  // for "en" and `descriptionTh` for "th". Defaults to whatever the
  // workbook header looks like; HR can still override (e.g. when the
  // GL file uses English headers but Thai descriptions).
  const [language, setLanguage] = useState<JournalImportLanguage>("en");
  const [preview, setPreview] = useState<JournalImportPreview | null>(null);
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
    setEntries([]);
    setParsedSkipped([]);
    setDetectedLanguage(null);
    setLanguage("en");
    setPreview(null);
    setParsing(false);
    setCommitting(false);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runPreview(
    payload: JournalImportEntry[],
    targetEntityId: string,
    targetStatus: JournalImportStatus,
    targetLanguage: JournalImportLanguage,
  ) {
    const res = await previewJournalImport({
      entityId: targetEntityId,
      status: targetStatus,
      language: targetLanguage,
      entries: payload,
    });
    setPreview(res.data);
    const s = res.data.summary;
    const bits = [`${s.inserts} to insert`];
    if (s.updates > 0) bits.push(`${s.updates} to update`);
    if (s.skipDuplicates > 0) bits.push(`${s.skipDuplicates} duplicate`);
    if (s.skipUnbalanced > 0) bits.push(`${s.skipUnbalanced} unbalanced`);
    if (s.skipMissing > 0) bits.push(`${s.skipMissing} missing account`);
    toast.success(`Parsed ${s.total} entries — ${bits.join(", ")}`);
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
      if (parsed.entries.length === 0) {
        toast.error("No importable entries found in the workbook");
        setEntries([]);
        setParsedSkipped(parsed.skipped);
        setDetectedLanguage(parsed.detectedLanguage);
        return;
      }
      setEntries(parsed.entries);
      setParsedSkipped(parsed.skipped);
      setDetectedLanguage(parsed.detectedLanguage);
      // Seed the language selector from the workbook so HR doesn't have
      // to override it on the happy path — "mixed" headers (both
      // English and Thai tokens) fall back to English.
      const seed: JournalImportLanguage =
        parsed.detectedLanguage === "th" ? "th" : "en";
      setLanguage(seed);
      await runPreview(parsed.entries, entityId, status, seed);
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
    if (entries.length > 0) {
      try {
        setParsing(true);
        await runPreview(entries, value, status, language);
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to refresh preview";
        toast.error(msg);
      } finally {
        setParsing(false);
      }
    }
  }

  async function handleStatusChange(value: string) {
    const next = value as JournalImportStatus;
    setStatus(next);
    if (entries.length > 0 && entityId) {
      try {
        setParsing(true);
        await runPreview(entries, entityId, next, language);
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to refresh preview";
        toast.error(msg);
      } finally {
        setParsing(false);
      }
    }
  }

  async function handleLanguageChange(value: string) {
    const next = value as JournalImportLanguage;
    setLanguage(next);
    if (entries.length > 0 && entityId) {
      try {
        setParsing(true);
        await runPreview(entries, entityId, status, next);
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
    if (entries.length === 0 || !entityId) return;
    try {
      setCommitting(true);
      const res = await commitJournalImport({
        entityId,
        status,
        language,
        entries,
      });
      const { inserted, updated, skipped } = res.data;
      const bits: string[] = [];
      if (inserted > 0) bits.push(`${inserted} imported`);
      if (updated > 0) bits.push(`${updated} updated`);
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
          sm:max-w-5xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Import Journal Entries</DialogTitle>
          <DialogDescription>
            Upload the General Ledger xlsx exported from the accounting system.
            Both Thai and English headers are supported. Rows are grouped by{" "}
            <strong>Document No.</strong> / <strong>เลขที่เอกสาร</strong> into
            journal entries; account codes must already exist in the chart of
            accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[68vh] flex-col gap-4 overflow-y-auto">
          <div
            className={`
              grid grid-cols-1 gap-3
              sm:grid-cols-3
            `}
          >
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

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Language</label>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="th">Thai (ภาษาไทย)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[11px]">
                Fills the matching <strong>Description</strong> column.
                Re-import the same GL in the other language to populate both —
                entries are matched by Document No.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Import as status</label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOURNAL_IMPORT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[11px]">
                Historical GL data is usually imported as{" "}
                <strong>posted</strong>. Account balances are not mutated by
                this importer — the source-of-truth comes from the Chart of
                Accounts import.
              </p>
            </div>
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
              {file ? file.name : "Drop the GL .xlsx here or click to browse"}
            </div>
            <div className="text-muted-foreground text-xs">
              .xlsx — supports both English and Thai column headers
            </div>
            <Input
              ref={inputRef}
              id="journal-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          {detectedLanguage && file ? (
            <div className="text-muted-foreground text-xs">
              Detected language:{" "}
              <strong>{detectedLanguage.toUpperCase()}</strong> — parsed{" "}
              {entries.length} voucher{entries.length === 1 ? "" : "s"} from{" "}
              {file.name}
            </div>
          ) : null}

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
                <SummaryCard
                  label="Total vouchers"
                  value={preview.summary.total}
                />
                <SummaryCard
                  label="To insert"
                  value={preview.summary.inserts}
                  tone="positive"
                />
                <SummaryCard
                  label="To update"
                  value={preview.summary.updates}
                  tone={preview.summary.updates > 0 ? "positive" : undefined}
                />
                <SummaryCard
                  label="Already exists"
                  value={preview.summary.skipDuplicates}
                  tone={
                    preview.summary.skipDuplicates > 0 ? "warning" : undefined
                  }
                />
                <SummaryCard
                  label="Unbalanced"
                  value={preview.summary.skipUnbalanced}
                  tone={
                    preview.summary.skipUnbalanced > 0 ? "danger" : undefined
                  }
                />
                <SummaryCard
                  label="Missing account"
                  value={preview.summary.skipMissing}
                  tone={preview.summary.skipMissing > 0 ? "danger" : undefined}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[720px] text-[12px]">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Reference</th>
                      <th className="px-2 py-1.5 font-medium">Date</th>
                      <th className="px-2 py-1.5 font-medium">Description</th>
                      <th className={`px-2 py-1.5 text-right font-medium`}>
                        Lines
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Debit
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Credit
                      </th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 200).map((r, idx) => (
                      <tr key={r.reference} className="border-t align-top">
                        <td className="text-muted-foreground px-2 py-1.5">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 font-medium tabular-nums">
                          {r.reference}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{r.date}</td>
                        <td className="px-2 py-1.5">
                          <div
                            className="max-w-[280px] truncate"
                            title={r.description}
                            lang="th"
                          >
                            {r.description || "—"}
                          </div>
                          {r.missingCodes.length > 0 ? (
                            <div className="mt-0.5 text-[11px] text-red-600">
                              Missing: {r.missingCodes.join(", ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.lineCount}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.totalDebit.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.totalCredit.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.action === "insert" ? (
                            <Badge variant="green">Insert</Badge>
                          ) : r.action === "update" ? (
                            <Badge variant="green">
                              Update {language.toUpperCase()}
                            </Badge>
                          ) : r.action === "skip-duplicate" ? (
                            <Badge variant="amber">Exists</Badge>
                          ) : r.action === "skip-unbalanced" ? (
                            <Badge variant="red">Unbalanced</Badge>
                          ) : (
                            <Badge variant="red">No account</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 200 ? (
                  <div
                    className={`
                      text-muted-foreground bg-muted/30 border-t px-3 py-2
                      text-[11px]
                    `}
                  >
                    Showing first 200 of {preview.rows.length} vouchers. All
                    will be imported.
                  </div>
                ) : null}
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
                    {parsedSkipped.slice(0, 8).map((s, i) => (
                      <li key={`${s.row}-${i}`}>
                        Row {s.row}: {s.reason}
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

function commitButtonLabel(preview: JournalImportPreview | null): string {
  if (!preview) return "Import";
  const ins = preview.summary.inserts;
  const upd = preview.summary.updates;
  if (ins + upd === 0) return "Nothing to import";
  if (ins > 0 && upd > 0) return `Import ${ins} + update ${upd}`;
  if (upd > 0) return `Update ${upd} entr${upd === 1 ? "y" : "ies"}`;
  return `Import ${ins} entr${ins === 1 ? "y" : "ies"}`;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "warning" | "danger";
}) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2",
        tone === "positive"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : tone === "warning"
            ? "border-amber-500/30 bg-amber-500/5"
            : tone === "danger"
              ? "border-red-500/30 bg-red-500/5"
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
