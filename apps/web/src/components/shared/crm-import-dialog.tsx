"use client";

import { Download, Loader2, UploadCloud } from "lucide-react";
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
import { ApiError } from "@/lib/api-client";
import { exportRows, parseImportFile } from "@/lib/crm-export";

/**
 * One importable field: the payload key, the header aliases accepted
 * from the uploaded file (case-insensitive), and how to coerce the
 * cell. `required` rows missing the field are dropped (header-only /
 * blank lines).
 */
export interface ImportFieldSpec {
  key: string;
  headers: string[];
  type: "string" | "number";
  required?: boolean;
}

interface Props<TRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  /** Dialog title, e.g. "Import IT projects". */
  title: string;
  /** Plural noun for messages, e.g. "projects". */
  entityLabel: string;
  fields: ImportFieldSpec[];
  /** Base filename for the downloadable template. */
  templateName: string;
  /** Sends the mapped rows to the CRM's bulk-import endpoint. */
  submit: (rows: TRow[]) => Promise<{ created: number }>;
}

function pick(row: Record<string, unknown>, headers: string[]): string {
  for (const k of Object.keys(row)) {
    if (headers.some((want) => k.trim().toLowerCase() === want.toLowerCase())) {
      const v = row[k];
      return v === null || v === undefined ? "" : String(v).trim();
    }
  }
  return "";
}

function toCount(s: string): number {
  const n = Number(s.replace(/[, ]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Reusable CRM import dialog. Each CRM supplies its field specs + a
 * submit fn; the parse / template / preview / error UX is shared.
 * Create-new-only — there's no merge logic here.
 */
export function CrmImportDialog<TRow>({
  open,
  onOpenChange,
  onImported,
  title,
  entityLabel,
  fields,
  templateName,
  submit,
}: Props<TRow>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<TRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requiredField = fields.find((f) => f.required);

  function mapRow(raw: Record<string, unknown>): TRow {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const cell = pick(raw, f.headers);
      if (f.type === "number") {
        out[f.key] = toCount(cell);
      } else {
        out[f.key] = cell || (f.required ? "" : null);
      }
    }
    return out as TRow;
  }

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const raw = await parseImportFile(file);
      const mapped = raw
        .map(mapRow)
        .filter((r) =>
          requiredField
            ? String(
                (r as Record<string, unknown>)[requiredField.key] ?? "",
              ).trim().length > 0
            : true,
        );
      if (mapped.length === 0) {
        toast.error(
          requiredField
            ? `No valid rows. Need a '${requiredField.headers[0]}' column.`
            : "No rows found.",
        );
        setRows([]);
        setFileName("");
        return;
      }
      setRows(mapped);
      setFileName(file.name);
    } catch {
      toast.error("Could not read that file. Use the exported template.");
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    exportRows<Record<string, unknown>>(
      templateName,
      fields.map((f) => ({
        header: f.headers[0]!,
        value: () => (f.type === "number" ? 0 : ""),
      })),
      [{}],
      "xlsx",
    );
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await submit(rows);
      toast.success(`Imported ${res.created} ${entityLabel}`);
      onImported();
      onOpenChange(false);
      setRows([]);
      setFileName("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to import";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const headerList = fields.map((f) => f.headers[0]).join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with columns: {headerList}. Every row is
            added as a new entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={downloadTemplate}
          >
            <Download className="size-3.5" />
            Download template
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {fileName || "Choose file (.csv / .xlsx)"}
          </Button>

          {rows.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0}
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Import {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
