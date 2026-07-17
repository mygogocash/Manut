"use client";

import { Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkImportEsopGrants,
  downloadEsopImportTemplate,
  type EsopBulkImportResult,
} from "@/services/hrms.service";

interface EsopBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function EsopBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: EsopBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Replace-on-import is the idempotent default — re-running the same
  // spreadsheet should yield the same set of grants, not stacked
  // duplicates. HR can opt back into additive mode for the rare case
  // where two spreadsheets need to layer.
  const [replace, setReplace] = useState(true);
  const [result, setResult] = useState<EsopBulkImportResult | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setSubmitting(false);
    setReplace(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDownload(format: "csv" | "xlsx") {
    try {
      setDownloading(format);
      await downloadEsopImportTemplate(format);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download template",
      );
    } finally {
      setDownloading(null);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    try {
      setSubmitting(true);
      setResult(null);
      const res = await bulkImportEsopGrants(file, { replace });
      setResult(res.data);
      if (res.data.totalGrants > 0) {
        toast.success(
          `Imported ${res.data.totalGrants} grants across ${res.data.importedRows} employees`,
        );
        onImported?.();
      }
      if (res.data.skippedRows > 0 || res.data.failedRows > 0) {
        toast.error(
          `${res.data.skippedRows} skipped, ${res.data.failedRows} failed — review the report below.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
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
          <DialogTitle>Bulk import ESOP grants</DialogTitle>
          <DialogDescription>
            Upload an equity-grant spreadsheet. Each non-empty grant value
            (per-person header extras plus every Equity Type row) becomes its
            own grant record so admins can see every category per person.
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
            Sheet name: <span className="font-mono">Equity Summary</span>. Long
            format — one row per equity type per person. Header row (row 4):{" "}
            <span className="font-mono">Name of Staff</span>,{" "}
            <span className="font-mono">Equity Type</span>,{" "}
            <span className="font-mono">Equity in USD</span>,{" "}
            <span className="font-mono">Equity in THB</span>,{" "}
            <span className="font-mono">No. of Shares</span>,{" "}
            <span className="font-mono">Lock Period</span>,{" "}
            <span className="font-mono">Vesting Period</span>,{" "}
            <span className="font-mono">Increasing Period</span>,{" "}
            <span className="font-mono">Source / Notes</span>. Recognised{" "}
            <span className="font-mono">Equity Type</span> values:{" "}
            <span className="font-mono">Equity from Contract</span>,{" "}
            <span className="font-mono">Sign-up Equity</span>,{" "}
            <span className="font-mono">Executive Equity</span>,{" "}
            <span className="font-mono">Annual Review Equity</span>,{" "}
            <span className="font-mono">Retention Equity</span>.
          </p>
          <p className="text-muted-foreground text-xs">
            Each person starts with a header row like{" "}
            <span className="font-mono">
              Name &mdash; Position | Token Grant (Contract): THB 280,000 |
              Performance Bonus: 50,000 Tokens
            </span>{" "}
            — both extras are imported as separate grants. Grant rows: fill any
            one of <span className="font-mono">Equity in USD</span>,{" "}
            <span className="font-mono">Equity in THB</span> (accepts{" "}
            <span className="font-mono">280000</span>,{" "}
            <span className="font-mono">280000/month</span>, or{" "}
            <span className="font-mono">THB 280,000</span>), or{" "}
            <span className="font-mono">No. of Shares</span>. Priority is Shares
            &gt; USD &gt; THB. Use <span className="font-mono">N/A</span> or{" "}
            <span className="font-mono">Separately</span> to skip. Default
            strike price is <span className="font-mono">USD 100 / share</span>.
            Legacy{" "}
            <span className="font-mono">Tokens and Equity Structure</span> (wide
            format) uploads still work.
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
            htmlFor="esop-import-file"
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
                <span>.csv, .xlsx — up to 10 MB</span>
              </>
            )}
            <input
              ref={fileInputRef}
              id="esop-import-file"
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
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={replace}
              onCheckedChange={(v) => setReplace(v === true)}
            />
            <span className="text-foreground">
              Replace prior imported grants for each matched employee
            </span>
          </label>
          <p className="text-muted-foreground text-[11px]">
            On by default — re-running the same spreadsheet produces the same
            set of grants. Uncheck only if you want to append to existing
            imports (manually-created grants are never touched).
          </p>
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
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-foreground">
                Imported rows:{" "}
                <span className="font-semibold">{result.importedRows}</span>
              </span>
              <span className="text-foreground">
                Grants created:{" "}
                <span className="font-semibold">{result.totalGrants}</span>
              </span>
              <span className="text-muted-foreground">
                Skipped:{" "}
                <span className="font-semibold">{result.skippedRows}</span>
              </span>
              <span className="text-destructive">
                Failed:{" "}
                <span className="font-semibold">{result.failedRows}</span>
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
                  key={`${row.rowNumber}-${row.employeeName}`}
                  className={`
                    flex items-start justify-between gap-3 px-3 py-1.5 text-xs
                  `}
                >
                  <span className="text-muted-foreground tabular-nums">
                    Row {row.rowNumber}
                  </span>
                  <span className="text-foreground flex-1 truncate">
                    {row.employeeName}
                  </span>
                  {row.status === "imported" ? (
                    <span className="font-medium text-emerald-600">
                      +{row.grantsCreated} grant
                      {row.grantsCreated === 1 ? "" : "s"}
                    </span>
                  ) : row.status === "skipped" ? (
                    <span
                      className={`text-muted-foreground max-w-[60%] text-right`}
                    >
                      Skipped — {row.error ?? "no detail"}
                    </span>
                  ) : (
                    <span className="text-destructive max-w-[60%] text-right">
                      {row.error ?? "Failed"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {result.parseErrors.length > 0 ? (
              <ul
                className={`
                  border-destructive/40 bg-destructive/5 max-h-40
                  overflow-y-auto rounded-md border p-2 text-[11px]
                `}
              >
                {result.parseErrors.map((pe) => (
                  <li key={pe.rowNumber} className="text-destructive py-0.5">
                    Row {pe.rowNumber}: {pe.errors.join("; ")}
                  </li>
                ))}
              </ul>
            ) : null}
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
            Import grants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
