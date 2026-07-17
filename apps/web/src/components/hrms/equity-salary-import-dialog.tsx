"use client";

import { FileUp, Loader2, UploadCloud } from "lucide-react";
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
  type EquitySalaryImportResult,
  importEquitySalaries,
} from "@/services/equity-salary.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function EquitySalaryImportDialog({
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EquitySalaryImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) return;
    try {
      setSubmitting(true);
      setResult(null);
      const res = await importEquitySalaries(file);
      setResult(res.data);
      toast.success(
        `Imported ${res.data.importedRows} row${res.data.importedRows === 1 ? "" : "s"} for ${res.data.year}`,
      );
      if (res.data.parseErrors.length > 0) {
        toast.error(
          `${res.data.parseErrors.length} cell${res.data.parseErrors.length === 1 ? "" : "s"} had parse warnings — see report below.`,
        );
      }
      onImported?.();
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
          <DialogTitle>Import equity monthly salary</DialogTitle>
          <DialogDescription>
            Upload HR&rsquo;s &ldquo;Equity Monthly Salary&rdquo; spreadsheet.
            Re-importing the file replaces every row for the same year.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <p
            className={`
              text-muted-foreground text-[10px] font-bold tracking-widest
              uppercase
            `}
          >
            Sheet format
          </p>
          <p className="text-muted-foreground text-xs">
            Sheet name should contain{" "}
            <span className="font-mono">Monthly Salary</span> (the importer
            falls back to the first sheet otherwise). Row 1 must hold{" "}
            <span className="font-mono">Employee Name</span>,{" "}
            <span className="font-mono">Position</span>,{" "}
            <span className="font-mono">Start date</span>, then a column family
            like{" "}
            <span className="font-mono">
              Equity Allocation 2026 (Number of Share)
            </span>
            . Row 2 holds the per-month sub-headers (
            <span className="font-mono">Jan</span>,{" "}
            <span className="font-mono">Feb</span>, …,{" "}
            <span className="font-mono">Dec</span>) under the equity-allocation
            column. Each data row from row 3 down maps to one employee. The year
            is read off the row-1 family text.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <label
            htmlFor="equity-salary-import-file"
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
                <span>.xlsx — up to 10 MB</span>
              </>
            )}
            <input
              ref={fileInputRef}
              id="equity-salary-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-foreground">
                Year: <span className="font-semibold">{result.year}</span>
              </span>
              <span className="text-foreground">
                Imported rows:{" "}
                <span className="font-semibold">{result.importedRows}</span>
              </span>
              {result.parseErrors.length > 0 ? (
                <span className="text-destructive">
                  Cell warnings:{" "}
                  <span className="font-semibold">
                    {result.parseErrors.length}
                  </span>
                </span>
              ) : null}
            </div>
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
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
