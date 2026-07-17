"use client";

import { ChevronRight, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { PayslipBulkImportDialog } from "@/components/payroll/payslip-bulk-import-dialog";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { prepareImportRun } from "@/services/payroll.service";

interface PayrollBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

/** Default to the current period in canonical YYYY-MM. */
function thisPeriodYyyyMm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Validate the picker output stays YYYY-MM with month in [01..12]. */
function isValidYyyyMm(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/**
 * Read the first sheet of an xlsx/csv and return the (Employee Name,
 * Email) pairs — just enough for entity inference. The full row parse
 * lives in `PayslipBulkImportDialog`; we re-parse there because the
 * commit step expects every column (Salary, allowances, etc.) and
 * keeping a single source of truth for the heavy parse avoids drift.
 */
async function readIdentifiers(
  file: File,
): Promise<Array<{ name?: string; email?: string }>> {
  const buf = await file.arrayBuffer();
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
  if (matrix.length < 2) throw new Error("Sheet has no data rows");

  // Same two-row-header detection as PayslipBulkImportDialog.
  // Covers both the legacy spellings (Meal / Transportation / Telephone
  // / Wifi (India Team)) and HR's May-2026 rev where the band moved to
  // Meal Allowance / Transportation Allowance / Phone Allowance / House
  // Allowance. Without the new spellings the wrapper misreads row 2 as
  // a data row → "Could not match employee" for every record.
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
  const row1 = (matrix[0] ?? []).map((v) => String(v ?? "").trim());
  const row2 = matrix[1] ?? [];
  const usesGroupedHeader = row2.some(
    (v) => typeof v === "string" && subSet.has(v.trim()),
  );
  const dataStart = usesGroupedHeader ? 2 : 1;

  const nameCol = row1.findIndex((h) => h === "Employee Name");
  const emailCol = row1.findIndex((h) => h === "Email");
  if (nameCol === -1) {
    throw new Error("Could not find the Employee Name column");
  }

  const out: Array<{ name?: string; email?: string }> = [];
  for (let i = dataStart; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const name = String(r[nameCol] ?? "").trim();
    if (!name) continue;
    const email =
      emailCol >= 0 ? String(r[emailCol] ?? "").trim() || undefined : undefined;
    out.push({ name, email });
  }
  if (out.length === 0) throw new Error("Sheet has no data rows");
  return out;
}

/**
 * Top-level "Import payroll" wizard. One screen: pick a period (MM-YYYY)
 * and drop in the HR spreadsheet. We parse it client-side just enough to
 * pull employee names, ship those to `/payroll/runs/import-prepare` for
 * the server to infer which entity the rows belong to, then hand the
 * file off to `PayslipBulkImportDialog` for the preview/edit/commit
 * step.
 */
export function PayrollBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: PayrollBulkImportDialogProps) {
  const [period, setPeriod] = useState<string>(thisPeriodYyyyMm());
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [resolvedPeriod, setResolvedPeriod] = useState<string | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [preparedEntityId, setPreparedEntityId] = useState<string | null>(null);
  const [preparedEntityName, setPreparedEntityName] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setRunId(null);
      setResolvedPeriod(null);
      setPreparedFile(null);
      setPreparedEntityId(null);
      setPreparedEntityName(null);
      setFile(null);
      setPeriod(thisPeriodYyyyMm());
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function handleNext() {
    const apiPeriod = period.trim();
    if (!isValidYyyyMm(apiPeriod)) {
      toast.error("Pick a valid period");
      return;
    }
    if (!file) {
      toast.error("Choose a spreadsheet first");
      return;
    }

    try {
      setSubmitting(true);
      const identifiers = await readIdentifiers(file);
      const res = await prepareImportRun({
        period: apiPeriod,
        identifiers,
      });
      const {
        runId: id,
        entityId,
        entityName,
        matchedCount,
        totalRows,
        reused,
      } = res.data;
      setRunId(id);
      setResolvedPeriod(apiPeriod);
      setPreparedFile(file);
      setPreparedEntityId(entityId);
      setPreparedEntityName(entityName);
      const label = entityName ?? "the matched entity";
      toast.success(
        reused
          ? `Reusing draft run for ${label} (${matchedCount}/${totalRows} employees matched)`
          : `Created draft run for ${label} (${matchedCount}/${totalRows} employees matched)`,
      );
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to prepare payroll run";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Once the run is prepared, the inner bulk-import dialog takes over.
  if (runId) {
    return (
      <PayslipBulkImportDialog
        open={open}
        onOpenChange={onOpenChange}
        payrollRunId={runId}
        payrollRunPeriod={resolvedPeriod ?? undefined}
        initialFile={preparedFile ?? undefined}
        defaultEntityId={preparedEntityId ?? undefined}
        defaultEntityName={preparedEntityName}
        onImported={() => {
          onImported();
        }}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import payroll</DialogTitle>
          <DialogDescription>
            Pick the period and drop the HR spreadsheet here. We&apos;ll match
            the employees to figure out the entity, then take you to the preview
            step.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="bulk-period">Period</Label>
            <MonthYearPicker
              value={period}
              onChange={(v) => setPeriod(v)}
              placeholder="Select month"
              disabled={submitting}
            />
          </div>
          <div>
            <Label htmlFor="bulk-file">Spreadsheet</Label>
            <label
              htmlFor="bulk-file"
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
                id="bulk-file"
                type="file"
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={submitting || !file}
            className="min-w-32"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
