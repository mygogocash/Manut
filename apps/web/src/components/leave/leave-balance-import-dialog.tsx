"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  type BulkImportBalanceRow,
  type BulkImportPreviewRow,
  commitBulkImportBalances,
  getAllLeaveTypes,
  type LeaveType,
  previewBulkImportBalances,
} from "@/services/leave.service";
import { listUsers, type UserListItem } from "@/services/user.service";

interface LeaveBalanceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

function normaliseName(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function coerceCellNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = v.toString().replace(/\s/g, "").replace(/[,'_]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface ParsedLeaveCell {
  entitled: number | null;
  used: number | null;
}

interface ParsedRow {
  name: string;
  // Keyed by leave-type code (uppercase). Only populated for codes
  // that carried a positive allotted or availed value.
  cells: Record<string, ParsedLeaveCell>;
}

interface ParsedRoster {
  rows: ParsedRow[];
  detectedCodes: string[];
  warnings: string[];
}

function buildLeaveCell(
  entitled: number | null,
  used: number | null,
): ParsedLeaveCell | null {
  // Only emit a cell when at least one of allotted / availed carries a
  // positive value. Bare zeros mean "the importer has nothing to write" —
  // turning that into a write would wipe the production policy.
  const hasEntitled = entitled !== null && entitled > 0;
  const hasUsed = used !== null && used > 0;
  if (!hasEntitled && !hasUsed) return null;
  return {
    entitled: hasEntitled ? entitled : null,
    used: used ?? 0,
  };
}

// Discover `<CODE> Allotted` and `<CODE> Availed` column pairs from the
// header row. The HR sheet uses a few spelling variants we need to
// tolerate: "S.L Alloted", "SL Allotted", "Earned Leave" (the EL
// allotted column has a special name), "EL Availed". We accept any code
// that appears with one of the entitled or used keywords.
const ENTITLED_KEYWORDS = ["alloted", "allotted", "earned leave"];
const USED_KEYWORDS = ["availed", "used", "taken"];

function normaliseCode(raw: string): string {
  return raw
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .toUpperCase()
    .trim();
}

function detectColumnCode(
  header: string,
  knownCodes: string[],
): { code: string; kind: "entitled" | "used" } | null {
  const h = header.toLowerCase().trim();
  if (!h) return null;

  // Special-case "Earned Leave" → EL allotted (HR sheet uses this label).
  if (h === "earned leave") return { code: "EL", kind: "entitled" };

  const isUsed = USED_KEYWORDS.some((k) => h.includes(k));
  const isEntitled = !isUsed && ENTITLED_KEYWORDS.some((k) => h.includes(k));
  if (!isUsed && !isEntitled) return null;

  // Pull the leading token (before "allotted" / "availed") and try to
  // match it against a known leave-type code first; fall back to a
  // heuristic that strips dots / hyphens and uppercases.
  const tokens = h
    .replace(/[.\-_]/g, " ")
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 0 &&
        !ENTITLED_KEYWORDS.includes(t) &&
        !USED_KEYWORDS.includes(t),
    );
  if (tokens.length === 0) return null;
  const first = tokens[0]!;
  const norm = normaliseCode(first);

  // Prefer an exact match against an active leave-type code.
  const known = knownCodes.find((c) => c.toUpperCase() === norm);
  return {
    code: known ?? norm,
    kind: isUsed ? "used" : "entitled",
  };
}

function parseRosterSheet(
  sheet: XLSX.WorkSheet,
  knownCodes: string[],
): ParsedRoster {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  const warnings: string[] = [];

  // Header is the first row that contains "name" plus at least one
  // `<X> allotted` / `<X> availed` column. Skip the optional banner row.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const cells = (rows[i] ?? []).map((c) =>
      (c ?? "").toString().toLowerCase(),
    );
    const hasName = cells.some(
      (c) => c === "name" || c.includes("employee name"),
    );
    const hasLeaveCol = cells.some(
      (c) =>
        ENTITLED_KEYWORDS.some((k) => c.includes(k)) ||
        USED_KEYWORDS.some((k) => c.includes(k)),
    );
    if (hasName && hasLeaveCol) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      rows: [],
      detectedCodes: [],
      warnings: ["Could not locate header row"],
    };
  }

  const headers = (rows[headerIdx] ?? []).map((c) => (c ?? "").toString());

  const nameIdx = headers.findIndex((h) =>
    /(employee name|^name$)/i.test(h.trim()),
  );
  if (nameIdx === -1) {
    return { rows: [], detectedCodes: [], warnings: ["Name column not found"] };
  }

  // Map: code → { entitledIdx, usedIdx }.
  const codeColumns = new Map<string, { entitled: number; used: number }>();
  for (let c = 0; c < headers.length; c++) {
    const detected = detectColumnCode(headers[c] ?? "", knownCodes);
    if (!detected) continue;
    const slot = codeColumns.get(detected.code) ?? {
      entitled: -1,
      used: -1,
    };
    if (detected.kind === "entitled" && slot.entitled === -1) slot.entitled = c;
    if (detected.kind === "used" && slot.used === -1) slot.used = c;
    codeColumns.set(detected.code, slot);
  }

  if (codeColumns.size === 0) {
    return {
      rows: [],
      detectedCodes: [],
      warnings: ["No leave-type columns detected"],
    };
  }

  const detectedCodes = [...codeColumns.keys()].sort();

  const out: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = (row[nameIdx] ?? "").toString().trim();
    if (!name) continue;

    const cells: Record<string, ParsedLeaveCell> = {};
    for (const [code, idx] of codeColumns.entries()) {
      const ent =
        idx.entitled === -1 ? null : coerceCellNumber(row[idx.entitled]);
      const used = idx.used === -1 ? null : coerceCellNumber(row[idx.used]);
      const cell = buildLeaveCell(ent, used);
      if (cell) cells[code] = cell;
    }
    out.push({ name, cells });
  }

  if (out.length === 0) warnings.push("No data rows detected");
  return { rows: out, detectedCodes, warnings };
}

/**
 * Resolve the policy days-per-year for a given (entityId, code). Falls
 * back to the global (entityId === null) policy if the entity-scoped
 * one is missing — same precedence the importer uses on commit.
 */
function policyDays(
  types: LeaveType[],
  entityId: string | null,
  code: string,
): number {
  const scoped = types.find((t) => t.entityId === entityId && t.code === code);
  if (scoped) return scoped.daysPerYear;
  const global = types.find((t) => t.entityId === null && t.code === code);
  return global?.daysPerYear ?? 0;
}

/**
 * Build the roster template. For every distinct leave-type code in the
 * active catalogue we emit a `<CODE> Allotted` + `<CODE> Availed`
 * column. The allotted column is pre-filled from the employee's
 * entity-scoped policy days (with a global fallback); availed is
 * blank so HR fills in actual usage.
 */
function buildRosterTemplate(
  year: number,
  employees: Array<{ name: string; entityId: string | null }>,
  leaveTypes: LeaveType[],
): XLSX.WorkBook {
  const codes = [...new Set(leaveTypes.map((t) => t.code))].sort();
  const banner = [`Roster Summary — ${year}`];
  const header: string[] = ["Employee Name"];
  for (const code of codes) {
    header.push(`${code} Allotted`, `${code} Availed`);
  }

  const sampleRows: Array<Array<string | number>> =
    employees.length > 0
      ? employees.map((e) => {
          const cells: Array<string | number> = [e.name];
          for (const code of codes) {
            cells.push(policyDays(leaveTypes, e.entityId, code), 0);
          }
          return cells;
        })
      : Array.from({ length: 5 }, () => Array(header.length).fill(""));

  const aoa: Array<Array<string | number>> = [
    banner,
    [],
    header,
    ...sampleRows,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [
    { wch: 32 },
    ...codes.flatMap(() => [{ wch: 14 }, { wch: 12 }]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Summary");
  return wb;
}

// Editable preview row — mirrors `BulkImportPreviewRow` plus mutable
// number fields the admin can tweak before commit.
interface EditableRow {
  key: string;
  preview: BulkImportPreviewRow;
  entitled: string;
  used: string;
  carried: string;
  adjustment: string;
}

function previewToEditable(p: BulkImportPreviewRow): EditableRow {
  return {
    key: `${p.row}-${p.employeeEmail}-${p.leaveTypeCode}`,
    preview: p,
    entitled: p.entitled === null ? "" : String(p.entitled),
    used: String(p.used ?? 0),
    carried: String(p.carried ?? 0),
    adjustment: String(p.adjustment ?? 0),
  };
}

function editableToImportRow(e: EditableRow): BulkImportBalanceRow | null {
  // Drop rows the admin chose to skip (cleared all numeric inputs).
  const entitled = e.entitled.trim() === "" ? undefined : Number(e.entitled);
  const used = e.used.trim() === "" ? 0 : Number(e.used);
  const carried = e.carried.trim() === "" ? 0 : Number(e.carried);
  const adjustment = e.adjustment.trim() === "" ? 0 : Number(e.adjustment);
  if (entitled !== undefined && !Number.isFinite(entitled)) return null;
  if (
    !Number.isFinite(used) ||
    !Number.isFinite(carried) ||
    !Number.isFinite(adjustment)
  ) {
    return null;
  }
  return {
    employeeEmail: e.preview.employeeEmail,
    leaveTypeCode: e.preview.leaveTypeCode,
    year: e.preview.year,
    ...(entitled !== undefined && { entitled }),
    used,
    carried,
    adjustment,
  };
}

export function LeaveBalanceImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: LeaveBalanceImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRoster | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [previewMeta, setPreviewMeta] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setParsed(null);
    setEditableRows([]);
    setPreviewMeta(null);
    setSkipped(new Set());
    setYear(new Date().getFullYear());
  }, [open]);

  // Load users for name matching, plus the active leave-type catalogue
  // so the template can pre-fill every allotted column from policy
  // defaults (per-entity, with a global fallback).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        setUsersLoading(true);
        const [userRes, typeRes] = await Promise.all([
          listUsers({ limit: 500, isActive: true }),
          getAllLeaveTypes(),
        ]);
        if (!cancelled) {
          setUsers(userRes.data);
          setLeaveTypes(typeRes.data.filter((t) => t.isActive));
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load employees and leave policies");
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const userByName = useMemo(() => {
    const map = new Map<string, UserListItem>();
    for (const u of users) {
      map.set(normaliseName(u.name), u);
    }
    return map;
  }, [users]);

  const knownCodes = useMemo(
    () => [...new Set(leaveTypes.map((t) => t.code))],
    [leaveTypes],
  );

  function handleDownloadTemplate() {
    try {
      const employees = users
        .filter((u) => u.name?.trim())
        .map((u) => ({
          name: u.name.trim(),
          entityId: u.entity?.id ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const wb = buildRosterTemplate(year, employees, leaveTypes);
      XLSX.writeFile(wb, `leave-balance-roster-${year}.xlsx`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to build template";
      toast.error(msg);
    }
  }

  async function handleFile(f: File) {
    setFile(f);
    setEditableRows([]);
    setPreviewMeta(null);
    setSkipped(new Set());
    try {
      const isCsv =
        f.name.toLowerCase().endsWith(".csv") ||
        f.type === "text/csv" ||
        f.type === "application/csv";
      const wb = isCsv
        ? XLSX.read(await f.text(), { type: "string", raw: false })
        : XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === "summary") ??
        wb.SheetNames[0];
      if (!sheetName) {
        toast.error("File has no sheets");
        return;
      }
      const sheet = wb.Sheets[sheetName];
      if (!sheet) {
        toast.error("Could not open the sheet");
        return;
      }
      const result = parseRosterSheet(sheet, knownCodes);
      setParsed(result);
      for (const w of result.warnings) toast.warning(w);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      toast.error(msg);
    }
  }

  // Build the import rows from the parsed sheet. Skip rows whose name
  // doesn't match an employee — they show up in the preview as
  // "Employee not found" so the admin can fix the spreadsheet.
  const importRows = useMemo<BulkImportBalanceRow[]>(() => {
    if (!parsed) return [];
    const out: BulkImportBalanceRow[] = [];
    for (const r of parsed.rows) {
      const u = userByName.get(normaliseName(r.name));
      const email = u?.email ?? r.name; // unmatched flagged downstream
      for (const [code, cell] of Object.entries(r.cells)) {
        out.push({
          employeeEmail: email,
          leaveTypeCode: code,
          year,
          ...(cell.entitled !== null && { entitled: cell.entitled }),
          used: cell.used ?? 0,
        });
      }
    }
    return out;
  }, [parsed, userByName, year]);

  async function runPreview(rows: BulkImportBalanceRow[]) {
    if (rows.length === 0) {
      toast.error("Nothing to import — pick a file first");
      return;
    }
    try {
      setPreviewing(true);
      const res = await previewBulkImportBalances(rows);
      setEditableRows(res.data.map(previewToEditable));
      setPreviewMeta(res.meta);
      setSkipped(new Set());
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Preview failed";
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  }

  async function handlePreview() {
    await runPreview(importRows);
  }

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setEditableRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function toggleSkip(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRevalidate() {
    const candidate = editableRows
      .filter((r) => !skipped.has(r.key))
      .map(editableToImportRow)
      .filter((r): r is BulkImportBalanceRow => r !== null);
    await runPreview(candidate);
  }

  async function handleCommit() {
    const candidate = editableRows
      .filter((r) => !skipped.has(r.key) && r.preview.errors.length === 0)
      .map(editableToImportRow)
      .filter((r): r is BulkImportBalanceRow => r !== null);
    if (candidate.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    try {
      setCommitting(true);
      const res = await commitBulkImportBalances(candidate);
      toast.success(
        `Imported balances — ${res.data.created} created, ${res.data.updated} updated, ${res.data.skipped} skipped`,
      );
      onCompleted();
      onOpenChange(false);
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

  const busy = previewing || committing;
  const unmatched = parsed
    ? parsed.rows.filter((r) => !userByName.has(normaliseName(r.name)))
    : [];

  const detectedCodesLabel =
    parsed && parsed.detectedCodes.length > 0
      ? parsed.detectedCodes.join(", ")
      : "";

  const validToCommit = editableRows.filter(
    (r) => !skipped.has(r.key) && r.preview.errors.length === 0,
  ).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-5xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Import leave balances from roster</DialogTitle>
          <DialogDescription>
            Upload the Roster Summary sheet (.xlsx) or a CSV export of the same
            columns. The importer detects every{" "}
            <code>&lt;CODE&gt; Allotted</code> /{" "}
            <code>&lt;CODE&gt; Availed</code> pair in the header — every active
            leave-type code is supported. Names are matched against active
            employees; unmatched rows are flagged. Need a starting point?
            Download the template — it ships with the expected headers, every
            active employee, and every leave type&apos;s allotted column
            pre-filled from each employee&apos;s policy days. Adjust availed
            columns to record taken leave, or leave a leave type&apos;s columns
            blank (or zero) to skip it. Numbers are still editable in the
            preview below before you commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            className={`
              flex flex-col gap-2
              sm:flex-row sm:items-end
            `}
          >
            <div className="flex-1">
              <Label htmlFor="roster-file">Roster file (.xlsx, .csv)</Label>
              <Input
                id="roster-file"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>
            <div className="w-32">
              <Label htmlFor="roster-year">Year</Label>
              <Input
                id="roster-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || year)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={busy || usersLoading}
            >
              {usersLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download template
            </Button>
            <span className="text-muted-foreground text-xs">
              {users.length > 0
                ? `Pre-filled with ${users.length} active employee${users.length === 1 ? "" : "s"} and ${knownCodes.length} leave type${knownCodes.length === 1 ? "" : "s"}`
                : "Includes 5 blank rows"}
            </span>
          </div>

          {file && (
            <div className="text-muted-foreground text-xs">
              Selected: {file.name}
              {parsed
                ? ` — ${parsed.rows.length} employee row(s), ${parsed.detectedCodes.length} leave code(s) detected${detectedCodesLabel ? ` (${detectedCodesLabel})` : ""}`
                : ""}
              {usersLoading ? " · loading employees…" : ""}
            </div>
          )}

          {unmatched.length > 0 && (
            <div
              className={`
                rounded-md border border-amber-300 bg-amber-50 p-3 text-xs
                text-amber-900
              `}
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {unmatched.length} name
                {unmatched.length === 1 ? " did" : "s did"} not match an active
                employee:
              </p>
              <p className="mt-1">
                {unmatched
                  .slice(0, 20)
                  .map((r) => r.name)
                  .join(", ")}
                {unmatched.length > 20 && "…"}
              </p>
            </div>
          )}

          {parsed && editableRows.length === 0 && (
            <Button
              type="button"
              onClick={handlePreview}
              disabled={busy || importRows.length === 0}
              className="self-start"
            >
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Preview {importRows.length} row
              {importRows.length === 1 ? "" : "s"}
            </Button>
          )}

          {previewMeta && (
            <div className="flex items-center gap-3 text-xs">
              <Badge>{previewMeta.total} total</Badge>
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {previewMeta.valid} valid
              </Badge>
              {previewMeta.invalid > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {previewMeta.invalid} with errors
                </Badge>
              )}
              {skipped.size > 0 && (
                <Badge variant="outline">{skipped.size} skipped</Badge>
              )}
              {editableRows.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRevalidate}
                  disabled={busy}
                  className="ml-auto"
                >
                  {previewing ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Re-validate edits
                </Button>
              )}
            </div>
          )}

          {editableRows.length > 0 && (
            <div
              className={`
                bg-card max-h-[50vh] overflow-y-auto rounded-md border
              `}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead className="w-24 text-right">Entitled</TableHead>
                    <TableHead className="w-20 text-right">Used</TableHead>
                    <TableHead className="w-20 text-right">Carried</TableHead>
                    <TableHead className="w-20 text-right">Adj.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Skip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editableRows.map((r) => {
                    const isSkipped = skipped.has(r.key);
                    const hasErrors = r.preview.errors.length > 0;
                    return (
                      <TableRow
                        key={r.key}
                        className={
                          isSkipped
                            ? "opacity-40"
                            : hasErrors
                              ? "bg-destructive/5"
                              : ""
                        }
                      >
                        <TableCell>
                          <div className="font-medium">
                            {r.preview.employeeName ?? r.preview.employeeEmail}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {r.preview.employeeEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.preview.leaveTypeName ?? r.preview.leaveTypeCode}
                          <div className="text-muted-foreground text-xs">
                            {r.preview.leaveTypeCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={r.entitled}
                            onChange={(e) =>
                              updateRow(r.key, { entitled: e.target.value })
                            }
                            disabled={busy || isSkipped}
                            inputMode="decimal"
                            className="h-8 text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={r.used}
                            onChange={(e) =>
                              updateRow(r.key, { used: e.target.value })
                            }
                            disabled={busy || isSkipped}
                            inputMode="decimal"
                            className="h-8 text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={r.carried}
                            onChange={(e) =>
                              updateRow(r.key, { carried: e.target.value })
                            }
                            disabled={busy || isSkipped}
                            inputMode="decimal"
                            className="h-8 text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={r.adjustment}
                            onChange={(e) =>
                              updateRow(r.key, { adjustment: e.target.value })
                            }
                            disabled={busy || isSkipped}
                            inputMode="decimal"
                            className="h-8 text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {hasErrors ? (
                            <span className="text-destructive">
                              {r.preview.errors.join("; ")}
                            </span>
                          ) : isSkipped ? (
                            <span className="text-muted-foreground">
                              Skipped
                            </span>
                          ) : (
                            <span className="text-emerald-600">Ready</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSkipped}
                            onChange={() => toggleSkip(r.key)}
                            disabled={busy}
                            aria-label={`Skip row ${r.key}`}
                            className="size-4"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          {editableRows.length > 0 && (
            <Button
              type="button"
              onClick={handleCommit}
              disabled={busy || validToCommit === 0}
              className="min-w-32"
            >
              {committing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {validToCommit} balance
              {validToCommit === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
