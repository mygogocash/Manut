"use client";

import { Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkImportEmployees,
  type BulkImportResult,
  downloadEmployeeImportTemplate,
} from "@/services/user.service";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fired after a successful import so the parent (employees page) can
  // refetch the list + stats.
  onImported?: () => void;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDownload(format: "csv" | "xlsx") {
    try {
      setDownloading(format);
      await downloadEmployeeImportTemplate(format);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download template";
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    try {
      setSubmitting(true);
      setResult(null);
      const res = await bulkImportEmployees(file);
      setResult(res.data);
      if (res.data.successCount > 0) {
        toast.success(
          `Imported ${res.data.successCount} ${
            res.data.successCount === 1 ? "employee" : "employees"
          }`,
        );
        onImported?.();
      }
      if (res.data.failureCount > 0) {
        toast.error(
          `${res.data.failureCount} ${
            res.data.failureCount === 1 ? "row" : "rows"
          } failed — review the report below.`,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import employees";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Bulk import employees</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to create multiple employee accounts at
            once. Each row generates a temporary password and emails the new
            user their login details.
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
            Required columns: <span className="font-mono">email</span>,{" "}
            <span className="font-mono">name</span>. Optional:{" "}
            <span className="font-mono">phone</span>,{" "}
            <span className="font-mono">entityCode</span> (TH / AE / SG / PT /
            ID / VN / IN), <span className="font-mono">department</span>,{" "}
            <span className="font-mono">jobTitle</span>,{" "}
            <span className="font-mono">employeeId</span>,{" "}
            <span className="font-mono">employmentType</span>,{" "}
            <span className="font-mono">startDate</span> (YYYY-MM-DD),{" "}
            <span className="font-mono">dateOfBirth</span> (YYYY-MM-DD),{" "}
            <span className="font-mono">location</span>,{" "}
            <span className="font-mono">country</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownload("xlsx")}
              disabled={downloading === "xlsx"}
            >
              {downloading === "xlsx" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Download XLSX template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownload("csv")}
              disabled={downloading === "csv"}
            >
              {downloading === "csv" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
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
            htmlFor="bulk-import-file"
            className={`
              border-border text-muted-foreground flex cursor-pointer flex-col
              items-center justify-center gap-1 rounded-md border border-dashed
              p-6 text-center text-xs
              hover:border-foreground/30
              ${file ? "border-primary/40 bg-primary/5" : ""}
            `}
          >
            <UploadCloud className="size-6" />
            {file ? (
              <>
                <span className="text-foreground font-medium">{file.name}</span>
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
                <span>.csv, .xlsx — up to 5 MB</span>
              </>
            )}
            <input
              ref={fileInputRef}
              id="bulk-import-file"
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
              }}
            />
          </label>
        </section>

        {result ? (
          <section className="flex flex-col gap-2">
            <p
              className={`
                text-muted-foreground text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              Import report
            </p>
            <div className="flex gap-3 text-xs">
              <span className="text-foreground">
                Created:{" "}
                <span className="font-semibold">{result.successCount}</span>
              </span>
              <span className="text-destructive">
                Failed:{" "}
                <span className="font-semibold">{result.failureCount}</span>
              </span>
            </div>
            <ul
              className={`
                border-border max-h-60 divide-y overflow-y-auto rounded-md
                border
              `}
            >
              {result.results.map((row) => (
                <li
                  key={`${row.rowNumber}-${row.email}`}
                  className={`
                    flex items-start justify-between gap-3 px-3 py-1.5 text-xs
                  `}
                >
                  <span className="text-muted-foreground tabular-nums">
                    Row {row.rowNumber}
                  </span>
                  <span className="text-foreground flex-1 truncate">
                    {row.email}
                  </span>
                  {row.status === "created" ? (
                    <span className="font-medium text-emerald-600">
                      Created
                    </span>
                  ) : (
                    <span className="text-destructive max-w-[60%] text-right">
                      {row.error ?? "Failed"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!file || submitting}
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileUp className="size-3.5" />
            )}
            Import employees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
