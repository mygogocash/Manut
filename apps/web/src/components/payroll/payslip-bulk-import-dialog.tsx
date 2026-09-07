"use client";

import { Download, FileUp, Loader2, UploadCloud, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { downloadPayslipImportTemplate } from "@/components/payroll/payroll-import-template";
import { formatCurrency } from "@/components/payroll/payroll-utils";
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
import { ApiError } from "@/lib/api-client";
import {
  commitPayslipImport,
  type PayslipImportPreview,
  type PayslipImportResult,
  previewPayslipImport,
} from "@/services/payroll.service";
import { createUser } from "@/services/user.service";

/**
 * Coerce a spreadsheet cell into a number. Mirrors the HR-template quirks
 * the importer handles server-side: leading/trailing whitespace (incl.
 * NBSP / thin-space), digit-group separators (`,` `'` `_`), and stray
 * currency glyphs all get stripped before parseFloat. Empty / non-numeric
 * cells return 0 so they sum cleanly.
 */
function coerceCellNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const cleaned = v
    .replace(/[\s\u00A0\u2009,'_]/g, "")
    .replace(/[^\d.\-+eE]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const NUMERIC_KEYS = [
  "Basic Salary",
  "Salary (fiat)",
  "Overtime",
  "Meal Allowance",
  "Meal",
  "Transportation Allowance",
  "Transportation",
  "Phone Allowance",
  "Telephone",
  "House Allowance",
  "Internet Bills",
  "Wifi (India Team)",
  "Other income",
  "Other Income",
  "Reimbursement",
  "Tax",
  "SSF",
  "Other Deduction",
  "Total Payout INR",
  "Total Payout USD",
  "Total Payout THB",
] as const;

// The blank import template (headers, sample row, Total Payout formulas)
// lives in `payroll-import-template.ts` so this dialog and the Payslip
// Management toolbar share one definition and can't drift. `parseFile`
// below still ingests whatever HR uploads — including old-spelling sheets
// (Meal / Transportation / Telephone / Wifi) — via header aliasing.

/** Flatten the two-row header into one row of composite keys. */
function flattenHeaders(row1: unknown[], row2: unknown[]): string[] {
  const len = Math.max(row1.length, row2.length);
  const headers: string[] = [];
  for (let i = 0; i < len; i++) {
    const a = String(row1[i] ?? "").trim();
    const b = String(row2[i] ?? "").trim();
    headers.push(b || a);
  }
  return headers;
}

interface PayslipBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRunId: string | null;
  payrollRunPeriod?: string;
  /**
   * When the wrapper dialog already collected the file (because it had
   * to parse identifiers for entity inference), pass it here so we can
   * skip the upload click and jump straight to the preview.
   */
  initialFile?: File;
  /**
   * Inferred entity (returned by `/payroll/runs/import-prepare`). Used
   * as the default for the quick-create-employee flow so HR can absorb
   * "Could not match employee" rows without leaving the importer.
   */
  defaultEntityId?: string;
  defaultEntityName?: string | null;
  onImported?: (result: PayslipImportResult) => void;
}

export function PayslipBulkImportDialog({
  open,
  onOpenChange,
  payrollRunId,
  payrollRunPeriod,
  initialFile,
  defaultEntityId,
  defaultEntityName,
  onImported,
}: PayslipBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PayslipImportPreview | null>(null);
  const [committed, setCommitted] = useState<PayslipImportResult | null>(null);
  // Editable in-memory copy of the parsed rows. Once the user lands on
  // the preview, every subsequent re-validate / commit ships these
  // (mutated by inline edits) instead of re-reading the original file.
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [autoPreviewTriggered, setAutoPreviewTriggered] = useState(false);
  // Quick-create-employee modal state. Opened from a "Could not match
  // employee" row so HR can mint a placeholder user without leaving the
  // importer; the row is re-validated against the new user on save.
  const [quickCreate, setQuickCreate] = useState<{
    rowIndex: number;
    name: string;
    email: string;
    salary: string;
    currency: string;
  } | null>(null);
  const [quickCreating, setQuickCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setCommitted(null);
    setRows([]);
    setParsing(false);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateCell(idx: number, key: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      const current = { ...(next[idx] ?? {}) };
      current[key] = value;
      next[idx] = current;

      // Currency edits propagate to every other row sharing the same
      // employee identifier so HR fixing one side of a duplicate-row
      // pair automatically unblocks the "Mixed currency across
      // duplicate rows" error. Identifier preference: Employee ID >
      // Email > Employee Name (case-insensitive, trimmed) — mirrors
      // the matcher the API uses.
      if (key === "Currency") {
        const editedId = String(current["Employee ID"] ?? "")
          .trim()
          .toLowerCase();
        const editedEmail = String(current["Email"] ?? "")
          .trim()
          .toLowerCase();
        const editedName = String(current["Employee Name"] ?? "")
          .trim()
          .toLowerCase();

        for (let j = 0; j < next.length; j++) {
          if (j === idx) continue;
          const sibling = next[j] ?? {};
          const sibId = String(sibling["Employee ID"] ?? "")
            .trim()
            .toLowerCase();
          const sibEmail = String(sibling["Email"] ?? "")
            .trim()
            .toLowerCase();
          const sibName = String(sibling["Employee Name"] ?? "")
            .trim()
            .toLowerCase();

          const sameById = editedId && sibId && editedId === sibId;
          const sameByEmail =
            editedEmail && sibEmail && editedEmail === sibEmail;
          const sameByName = editedName && sibName && editedName === sibName;

          if (sameById || sameByEmail || sameByName) {
            next[j] = { ...sibling, Currency: value };
          }
        }
      }

      return next;
    });
  }

  function openQuickCreate(rowIndex: number) {
    const row = rows[rowIndex] ?? {};
    setQuickCreate({
      rowIndex,
      name: String(row["Employee Name"] ?? "").trim(),
      email: String(row["Email"] ?? "").trim(),
      salary: String(row["Salary (fiat)"] ?? "").trim(),
      currency: String(row["Currency"] ?? "").trim() || "THB",
    });
  }

  async function handleQuickCreate() {
    if (!quickCreate) return;
    const name = quickCreate.name.trim();
    const typedEmail = quickCreate.email.trim().toLowerCase();
    if (name.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (typedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    // Email is optional — Supabase Auth still needs *something* unique,
    // so mint a placeholder when HR leaves it blank. The user stays
    // dormant; HR can replace the address later if the hire becomes
    // permanent.
    const email =
      typedEmail ||
      `payroll-${crypto.randomUUID().slice(0, 12)}@placeholder.local`;
    const salaryNum = Number(
      quickCreate.salary.replace(/[\s,'_]/g, "").replace(/[^\d.\-+eE]/g, ""),
    );
    try {
      setQuickCreating(true);
      // Auto-generated password — HR sends a reset on first login. The
      // Supabase admin endpoint requires *something*, and we don't want
      // HR juggling a temp password in chat.
      const password = `Tbh-${crypto.randomUUID().slice(0, 12)}-Tmp!`;
      await createUser({
        email,
        name,
        password,
        // BD-feedback — payroll quick-create mints a dormant employee so
        // the run can include this name without polluting the employee
        // directory. Marked `contract` + `isActive=false`; the welcome
        // email is suppressed because the address is usually a
        // placeholder.
        employmentType: "contract",
        isActive: false,
        skipWelcomeEmail: true,
        ...(defaultEntityId && { entityId: defaultEntityId }),
        ...(Number.isFinite(salaryNum) &&
          salaryNum > 0 && { salary: salaryNum }),
        ...(quickCreate.currency && { currency: quickCreate.currency }),
      });
      toast.success(
        `Added ${name} for this payroll run only. They stay hidden from the active employee directory.`,
      );
      // Patch the spreadsheet row so the next preview hits the new user
      // on the email path (most reliable) even if HR misspelled the
      // name slightly. Skip when the address was auto-generated — we
      // don't want a placeholder string surfacing in HR's sheet; the
      // name-token matcher takes over on the next preview.
      if (typedEmail) {
        updateCell(quickCreate.rowIndex, "Email", email);
      }
      setQuickCreate(null);
      await handleRevalidate();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create employee";
      toast.error(message);
    } finally {
      setQuickCreating(false);
    }
  }

  // Read file → xlsx workbook → first sheet → array of objects keyed by
  // a composite of the two header rows. Both .xlsx and .csv go through
  // the same code path — SheetJS handles CSV natively.
  async function parseFile(f: File): Promise<Array<Record<string, unknown>>> {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("Spreadsheet has no sheets");
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("First sheet is empty");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (matrix.length < 2) {
      throw new Error("Sheet has no data rows");
    }
    const row1 = matrix[0] ?? [];
    // If the second row contains any of the known sub-headers, treat it
    // as part of the header. Otherwise fall back to a flat header.
    // Recognises both legacy (Meal / Transportation / Telephone / Wifi)
    // and May-2026 (Meal Allowance / Transportation Allowance / Phone
    // Allowance / House Allowance) sub-header spellings.
    const subSet = new Set([
      "Meal",
      "Meal Allowance",
      "Transportation",
      "Transportation Allowance",
      "Telephone",
      "Phone Allowance",
      "House Allowance",
      "Wifi (India Team)",
    ]);
    const row2 = matrix[1] ?? [];
    const usesGroupedHeader = row2.some(
      (v) => typeof v === "string" && subSet.has(v.trim()),
    );
    const headers = usesGroupedHeader
      ? flattenHeaders(row1, row2)
      : row1.map((v) => String(v ?? "").trim());
    const dataStart = usesGroupedHeader ? 2 : 1;

    const out: Array<Record<string, unknown>> = [];
    for (let i = dataStart; i < matrix.length; i++) {
      const r = matrix[i] ?? [];
      const obj: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        if (!key) continue;
        obj[key] = r[c] ?? "";
      }
      // Skip rows without an Employee Name — HR templates typically
      // include trailing reference rows ("Currency / THB / INR / USD").
      const name = String(obj["Employee Name"] ?? "").trim();
      if (!name) continue;
      out.push(obj);
    }
    if (out.length === 0) {
      throw new Error("Sheet has no data rows");
    }
    return out;
  }

  async function handlePreview() {
    if (!file || !payrollRunId) return;
    try {
      setParsing(true);
      setPreview(null);
      setCommitted(null);
      const parsed = await parseFile(file);
      setRows(parsed);
      const res = await previewPayslipImport(payrollRunId, parsed);
      setPreview(res.data);
      if (res.data.errorCount > 0) {
        toast.error(
          `${res.data.errorCount} ${
            res.data.errorCount === 1 ? "row" : "rows"
          } have errors — fix the highlighted fields and re-validate`,
        );
      } else {
        toast.success(
          `Ready to import ${res.data.validCount} ${
            res.data.validCount === 1 ? "row" : "rows"
          }`,
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to parse file";
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  // If the wrapper dialog already collected a file (for entity
  // inference), preview as soon as we know the runId — saves HR a
  // pointless second click on "Preview rows".
  useEffect(() => {
    if (
      open &&
      initialFile &&
      payrollRunId &&
      !preview &&
      !autoPreviewTriggered
    ) {
      setAutoPreviewTriggered(true);
      void handlePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile, payrollRunId]);

  async function handleRevalidate() {
    if (!payrollRunId || rows.length === 0) return;
    try {
      setParsing(true);
      const res = await previewPayslipImport(payrollRunId, rows);
      setPreview(res.data);
      if (res.data.errorCount === 0) {
        toast.success(
          `Ready to import ${res.data.validCount} ${
            res.data.validCount === 1 ? "row" : "rows"
          }`,
        );
      } else {
        toast.error(
          `${res.data.errorCount} ${
            res.data.errorCount === 1 ? "row" : "rows"
          } still have errors`,
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to re-validate";
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!preview || !payrollRunId || rows.length === 0) return;
    if (preview.errorCount > 0) {
      toast.error("Fix the errors first");
      return;
    }
    try {
      setSubmitting(true);
      const res = await commitPayslipImport(payrollRunId, rows);
      setCommitted(res.data);
      toast.success(
        `Imported ${res.data.imported} ${
          res.data.imported === 1 ? "payslip" : "payslips"
        }`,
      );
      onImported?.(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to import";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (submitting || parsing) return;
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent
          className={`
            max-h-[92vh] overflow-y-auto
            sm:max-w-[min(96vw,1400px)]
          `}
        >
          <DialogHeader>
            <DialogTitle>Bulk import payslips</DialogTitle>
            <DialogDescription>
              {payrollRunPeriod
                ? `Importing payslips for period ${payrollRunPeriod}. `
                : ""}
              Upload an XLSX or CSV file with payslip rows. Preview validates
              rows; commit writes them to the run.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Step 1 — download template
            </p>
            <p className="text-muted-foreground text-xs">
              Match an employee by{" "}
              <span className="font-mono">Employee Name</span>,{" "}
              <span className="font-mono">Email</span>, or{" "}
              <span className="font-mono">employeeId</span>. Required:{" "}
              <span className="font-mono">Salary (fiat)</span>. Optional
              <span className="font-mono"> Currency</span> (defaults to THB).
              Optional allowances: <span className="font-mono">Meal</span>,{" "}
              <span className="font-mono">Transportation</span>,{" "}
              <span className="font-mono">Telephone</span>,{" "}
              <span className="font-mono">Wifi (India Team)</span>,{" "}
              <span className="font-mono">Other income</span>,{" "}
              <span className="font-mono">Reimbursement</span>. Optional
              deductions: <span className="font-mono">Tax</span>,{" "}
              <span className="font-mono">SSF</span>,{" "}
              <span className="font-mono">Other Deduction</span>. The{" "}
              <span className="font-mono">Total Payout INR / USD / THB</span>{" "}
              columns are live formulas on the downloaded XLSX — only the one
              matching the row&apos;s Currency lights up.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadPayslipImportTemplate("xlsx")}
              >
                <Download className="size-3.5" />
                Download XLSX template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadPayslipImportTemplate("csv")}
              >
                <Download className="size-3.5" />
                Download CSV template
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Step 2 — upload file
            </p>
            <label
              htmlFor="payslip-import-file"
              className={`
                border-border text-muted-foreground flex cursor-pointer flex-col
                items-center justify-center gap-1 rounded-md border
                border-dashed p-6 text-center text-xs
                hover:border-foreground/30
                ${file ? "border-primary/40 bg-primary/5" : ""}
              `}
            >
              <UploadCloud className="size-6" />
              {file ? (
                <>
                  <span className="text-foreground font-medium">
                    {file.name}
                  </span>
                  <span>
                    {(file.size / 1024).toFixed(1)} KB — click to choose a
                    different file
                  </span>
                </>
              ) : (
                <>
                  <span className="text-foreground font-medium">
                    Click to choose a file
                  </span>
                  <span>.xlsx, .csv — up to 5 MB</span>
                </>
              )}
              <input
                ref={fileInputRef}
                id="payslip-import-file"
                type="file"
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  setPreview(null);
                  setCommitted(null);
                  setRows([]);
                }}
              />
            </label>
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handlePreview()}
                disabled={!file || !payrollRunId || parsing || submitting}
              >
                {parsing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileUp className="size-3.5" />
                )}
                Preview rows
              </Button>
            </div>
          </section>

          {preview ? (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Preview report
                </p>
                {rows.length > 0 ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => void handleRevalidate()}
                    disabled={parsing || submitting}
                  >
                    {parsing ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <FileUp className="size-3" />
                    )}
                    Re-validate
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-foreground">
                  Total rows:{" "}
                  <span className="font-semibold">{preview.totalRows}</span>
                </span>
                <span className="text-emerald-600">
                  Valid:{" "}
                  <span className="font-semibold">{preview.validCount}</span>
                </span>
                <span className="text-destructive">
                  Errors:{" "}
                  <span className="font-semibold">{preview.errorCount}</span>
                </span>
                {(preview.warningCount ?? 0) > 0 && (
                  <span className="text-amber-600">
                    Merged:{" "}
                    <span className="font-semibold">
                      {preview.warningCount}
                    </span>
                  </span>
                )}
              </div>
              {rows.length > 0 ? (
                <div
                  className={`
                    border-border max-h-[60vh] overflow-auto rounded-md border
                  `}
                >
                  <table className="w-max min-w-full text-xs">
                    <thead
                      className={`
                        bg-muted/40 text-muted-foreground sticky top-0 z-10
                        [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left
                        [&_th]:font-medium [&_th]:whitespace-nowrap
                      `}
                    >
                      <tr>
                        <th className="w-10" rowSpan={2}>
                          #
                        </th>
                        <th rowSpan={2}>Employee Name</th>
                        <th rowSpan={2}>Email</th>
                        <th rowSpan={2}>Position</th>
                        <th rowSpan={2}>Department</th>
                        <th rowSpan={2}>Start Date</th>
                        <th className="text-right" rowSpan={2}>
                          Salary (fiat)
                        </th>
                        <th rowSpan={2}>Ccy</th>
                        <th className="border-l text-center" colSpan={4}>
                          Allowances
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Other Income
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Reimbursement
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Tax
                        </th>
                        <th className="text-right" rowSpan={2}>
                          SSF
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Other Deduction
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Total Payout INR
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Total Payout USD
                        </th>
                        <th className="text-right" rowSpan={2}>
                          Total Payout THB
                        </th>
                        <th rowSpan={2}>Errors</th>
                      </tr>
                      <tr>
                        <th className="border-l text-right">Meal</th>
                        <th className="text-right">Transportation</th>
                        <th className="text-right">Telephone</th>
                        <th className="text-right">Wifi (India Team)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r, i) => {
                        const rowErrors = preview.errors.filter(
                          (e) => e.row === i + 1,
                        );
                        const rowWarnings = (preview.warnings ?? []).filter(
                          (w) => w.row === i + 1,
                        );
                        const isInvalid = rowErrors.length > 0;
                        const isWarning = !isInvalid && rowWarnings.length > 0;
                        return (
                          <tr
                            key={i}
                            className={
                              isInvalid
                                ? "bg-destructive/5"
                                : isWarning
                                  ? "bg-amber-500/5"
                                  : undefined
                            }
                          >
                            <td
                              className={`
                                text-muted-foreground px-2 tabular-nums
                              `}
                            >
                              {i + 1}
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                className="h-7 min-w-40 text-xs"
                                value={String(r["Employee Name"] ?? "")}
                                onChange={(e) =>
                                  updateCell(i, "Employee Name", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                className="h-7 min-w-40 text-xs"
                                value={String(r["Email"] ?? "")}
                                onChange={(e) =>
                                  updateCell(i, "Email", e.target.value)
                                }
                                placeholder="optional"
                              />
                            </td>
                            <td
                              className={`
                                text-muted-foreground px-2 py-1
                                whitespace-nowrap
                              `}
                            >
                              {String(r["Position"] ?? "")}
                            </td>
                            <td
                              className={`
                                text-muted-foreground px-2 py-1
                                whitespace-nowrap
                              `}
                            >
                              {String(r["Department"] ?? "")}
                            </td>
                            <td
                              className={`
                                text-muted-foreground px-2 py-1
                                whitespace-nowrap
                              `}
                            >
                              {String(r["Start Date"] ?? "")}
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                className={`
                                  h-7 min-w-24 text-right text-xs tabular-nums
                                `}
                                value={String(r["Salary (fiat)"] ?? "")}
                                onChange={(e) =>
                                  updateCell(i, "Salary (fiat)", e.target.value)
                                }
                                inputMode="decimal"
                              />
                            </td>
                            <td className="px-1 py-1">
                              {/*
                                Editable Currency cell. HR can fix a row
                                that errored on "Duplicate row … uses a
                                different currency" without re-uploading
                                the spreadsheet — flip the ISO code,
                                Re-validate, and the duplicate-merge
                                path on the API will accept it.
                              */}
                              <Input
                                className={`
                                  h-7 w-16 text-center text-xs tracking-wide
                                  uppercase
                                `}
                                value={String(r["Currency"] ?? "")}
                                onChange={(e) =>
                                  updateCell(
                                    i,
                                    "Currency",
                                    e.target.value.toUpperCase(),
                                  )
                                }
                                maxLength={8}
                                placeholder="THB"
                              />
                            </td>
                            {NUMERIC_KEYS.slice(1).map((key) => (
                              <td
                                key={key}
                                className={`
                                  px-2 py-1 text-right whitespace-nowrap
                                  tabular-nums
                                  ${
                                    key === "Total Payout THB"
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                  }
                                `}
                              >
                                {r[key] !== undefined &&
                                String(r[key]).trim() !== ""
                                  ? formatCurrency(coerceCellNumber(r[key]))
                                  : ""}
                              </td>
                            ))}
                            <td
                              className={`
                                text-destructive min-w-48 px-2 py-1 text-[11px]
                              `}
                            >
                              <div className="flex flex-col gap-1">
                                <span>
                                  {rowErrors.map((e) => e.message).join("; ") ||
                                    ""}
                                </span>
                                {rowWarnings.length > 0 && (
                                  <span className="text-amber-600">
                                    {rowWarnings
                                      .map((w) => w.message)
                                      .join("; ")}
                                  </span>
                                )}
                                {rowErrors.some((e) =>
                                  e.message.startsWith(
                                    "Could not match employee",
                                  ),
                                ) && (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    className="self-start"
                                    onClick={() => openQuickCreate(i)}
                                  >
                                    <UserPlus className="mr-1 size-3" />
                                    Add as new employee
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot
                      className={`
                        bg-muted/40 text-foreground sticky bottom-0
                        [&_td]:px-2 [&_td]:py-1.5
                      `}
                    >
                      <tr>
                        <td
                          className={`
                            text-muted-foreground text-right text-[11px]
                            font-medium tracking-widest uppercase
                          `}
                          colSpan={19}
                        >
                          Total Net (THB)
                        </td>
                        <td
                          className={`
                            text-right text-xs font-semibold tabular-nums
                          `}
                        >
                          {formatCurrency(
                            rows.reduce(
                              (sum, r) =>
                                sum + coerceCellNumber(r["Total Payout THB"]),
                              0,
                            ),
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}
              {preview.errorCount > 0 ? (
                <p className="text-muted-foreground text-[11px]">
                  Edit the cells above and click Re-validate. Other fields (e.g.
                  allowances, deductions) still need a fresh upload to change.
                </p>
              ) : null}
            </section>
          ) : null}

          {committed ? (
            <p className="text-xs text-emerald-600">
              Imported {committed.imported} payslip
              {committed.imported === 1 ? "" : "s"}. Totals — gross{" "}
              {committed.totalGross.toLocaleString()}, net{" "}
              {committed.totalNet.toLocaleString()}, tax{" "}
              {committed.totalTax.toLocaleString()}.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || parsing}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void handleCommit()}
              disabled={
                !payrollRunId ||
                !preview ||
                preview.errorCount > 0 ||
                submitting ||
                parsing ||
                !!committed
              }
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileUp className="size-3.5" />
              )}
              Import {preview ? `${preview.validCount} rows` : "rows"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!quickCreate}
        onOpenChange={(next) => {
          if (!next && !quickCreating) setQuickCreate(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new employee (this run only)</DialogTitle>
            <DialogDescription>
              The importer couldn&apos;t match this row to an existing user.
              We&apos;ll create a dormant placeholder
              {defaultEntityName ? ` under ${defaultEntityName}` : ""} so the
              payslip can reference them. They stay hidden from the active
              employee directory — HR can activate the account later if the hire
              becomes permanent.
            </DialogDescription>
          </DialogHeader>

          {quickCreate && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qc-name">Full name</Label>
                <Input
                  id="qc-name"
                  value={quickCreate.name}
                  onChange={(e) =>
                    setQuickCreate({ ...quickCreate, name: e.target.value })
                  }
                  maxLength={200}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qc-email">
                  Work email{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="qc-email"
                  type="email"
                  value={quickCreate.email}
                  onChange={(e) =>
                    setQuickCreate({ ...quickCreate, email: e.target.value })
                  }
                  placeholder="name@manut.xyz"
                />
                <p className="text-muted-foreground text-xs">
                  Leave blank if you don&apos;t have one yet — we&apos;ll attach
                  a placeholder so the payslip can reference them.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qc-salary">Salary (from xlsx)</Label>
                  <Input
                    id="qc-salary"
                    value={quickCreate.salary}
                    onChange={(e) =>
                      setQuickCreate({
                        ...quickCreate,
                        salary: e.target.value,
                      })
                    }
                    inputMode="decimal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qc-currency">Currency</Label>
                  <Input
                    id="qc-currency"
                    value={quickCreate.currency}
                    onChange={(e) =>
                      setQuickCreate({
                        ...quickCreate,
                        currency: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickCreate(null)}
              disabled={quickCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleQuickCreate()}
              disabled={quickCreating}
              className="min-w-28"
            >
              {quickCreating ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <UserPlus className="mr-1 size-3.5" />
              )}
              Create employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
