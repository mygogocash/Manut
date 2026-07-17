"use client";

import { CheckCircle2, Download, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
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
import { ApiError } from "@/lib/api-client";
import {
  type BenefitImportPreview,
  type BenefitImportRow,
  commitBenefitImport,
  previewBenefitImport,
} from "@/services/benefit.service";
import type { Entity } from "@/services/entity.service";

interface BenefitBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  entities: Entity[];
}

const VALID_CATEGORIES = [
  "health",
  "dental",
  "vision",
  "life",
  "retirement",
  "wellness",
  "other",
] as const;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(/[,'_]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function coerceBool(v: unknown): boolean | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1", "active"].includes(s)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(s)) return false;
  return undefined;
}

const TEMPLATE_HEADERS = [
  "Name",
  "Category",
  "Provider",
  "Annual Cost",
  "Currency",
  "Entity Code",
  "Description",
  "Active",
] as const;

function buildBenefitTemplate(entities: Entity[]): XLSX.WorkBook {
  const sample: Array<Array<string | number | boolean>> = [
    [
      "Health Insurance Premium",
      "health",
      "AIA Thailand",
      120000,
      "THB",
      entities[0]?.code ?? "TH",
      "Group health insurance for all full-time staff",
      true,
    ],
    [
      "Dental Plan",
      "dental",
      "Bupa",
      24000,
      "THB",
      entities[0]?.code ?? "TH",
      "Annual dental coverage",
      true,
    ],
  ];

  const aoa: Array<Array<string | number | boolean>> = [
    [...TEMPLATE_HEADERS],
    ...sample,
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [
    { wch: 32 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 40 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Benefits");

  if (entities.length > 0) {
    const refAoa: Array<Array<string>> = [
      ["Entity Code", "Entity Name"],
      ...entities.map((e) => [e.code, e.name]),
    ];
    const refSheet = XLSX.utils.aoa_to_sheet(refAoa);
    refSheet["!cols"] = [{ wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, refSheet, "Entities (reference)");
  }

  return wb;
}

function findHeader(headers: string[], aliases: string[]): number {
  const lc = headers.map((h) => h.toLowerCase().trim());
  for (const a of aliases) {
    const idx = lc.indexOf(a);
    if (idx !== -1) return idx;
  }
  for (const a of aliases) {
    const idx = lc.findIndex((h) => h.includes(a));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseWorkbook(file: ArrayBuffer): {
  rows: BenefitImportRow[];
  warnings: string[];
} {
  const wb = XLSX.read(file, { type: "array", cellDates: false });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === "benefits") ??
    wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], warnings: ["Workbook has no sheets"] };
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { rows: [], warnings: ["First sheet is empty"] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  if (matrix.length < 2) return { rows: [], warnings: ["No data rows"] };

  const headers = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
  const idx = {
    name: findHeader(headers, ["name", "benefit name"]),
    category: findHeader(headers, ["category", "type"]),
    provider: findHeader(headers, ["provider", "vendor", "carrier"]),
    cost: findHeader(headers, ["annual cost", "cost", "premium"]),
    currency: findHeader(headers, ["currency", "ccy"]),
    entityCode: findHeader(headers, ["entity code", "entitycode"]),
    entityName: findHeader(headers, ["entity name", "entityname", "entity"]),
    entityId: findHeader(headers, ["entity id", "entityid"]),
    description: findHeader(headers, ["description", "notes"]),
    isActive: findHeader(headers, ["active", "isactive", "is active"]),
  };

  if (idx.name === -1) {
    return { rows: [], warnings: ["Name column not found"] };
  }
  if (idx.category === -1) {
    return { rows: [], warnings: ["Category column not found"] };
  }

  const out: BenefitImportRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const name = clean(r[idx.name]);
    if (!name) continue;
    const category = (clean(r[idx.category]) ?? "other").toLowerCase();
    const safeCategory = (VALID_CATEGORIES as readonly string[]).includes(
      category,
    )
      ? category
      : "other";
    out.push({
      name,
      category: safeCategory,
      provider: idx.provider !== -1 ? clean(r[idx.provider]) : null,
      cost: idx.cost !== -1 ? (coerceNumber(r[idx.cost]) ?? 0) : 0,
      currency: idx.currency !== -1 ? clean(r[idx.currency]) : null,
      entityCode: idx.entityCode !== -1 ? clean(r[idx.entityCode]) : null,
      entityName: idx.entityName !== -1 ? clean(r[idx.entityName]) : null,
      entityId: idx.entityId !== -1 ? clean(r[idx.entityId]) : null,
      description: idx.description !== -1 ? clean(r[idx.description]) : null,
      isActive: idx.isActive !== -1 ? coerceBool(r[idx.isActive]) : undefined,
    });
  }

  return { rows: out, warnings: [] };
}

export function BenefitBulkImportDialog({
  open,
  onOpenChange,
  onImported,
  entities,
}: BenefitBulkImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BenefitImportRow[]>([]);
  const [preview, setPreview] = useState<BenefitImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setFile(null);
    setRows([]);
    setPreview(null);
    setParsing(false);
    setCommitting(false);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDownloadTemplate() {
    try {
      const wb = buildBenefitTemplate(entities);
      XLSX.writeFile(wb, "benefits-import-template.xlsx");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to build template";
      toast.error(msg);
    }
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

  function isXlsx(f: File): boolean {
    if (f.name.toLowerCase().endsWith(".xlsx")) return true;
    return (
      f.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  async function handleFile(f: File) {
    setFile(f);
    setPreview(null);
    try {
      setParsing(true);
      const buf = await f.arrayBuffer();
      const { rows: parsed, warnings } = parseWorkbook(buf);
      for (const w of warnings) toast.warning(w);
      if (parsed.length === 0) {
        toast.error("No benefit rows found in the workbook");
        setParsing(false);
        return;
      }
      setRows(parsed);
      const res = await previewBenefitImport(parsed);
      setPreview(res.data);
      toast.success(
        `Parsed ${res.data.summary.total} rows — ${res.data.summary.valid} valid, ${res.data.summary.inserts} new, ${res.data.summary.updates} updates`,
      );
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

  async function handleCommit() {
    if (rows.length === 0) return;
    try {
      setCommitting(true);
      const res = await commitBenefitImport(rows);
      const { inserts, updates, skipped } = res.data;
      toast.success(
        `Imported ${inserts + updates} benefits (${inserts} new, ${updates} updated${
          skipped > 0 ? `, ${skipped} skipped` : ""
        })`,
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
          <DialogTitle>Import benefits</DialogTitle>
          <DialogDescription>
            Upload an .xlsx with the columns Name, Category, Provider, Annual
            Cost, Currency, Entity Code, Description, Active. We&apos;ll match
            existing benefits by name + entity and update them in place; unknown
            ones are inserted. Categories must be one of: health, dental,
            vision, life, retirement, wellness, other.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={parsing || committing}
            >
              <Download className="mr-2 size-4" />
              Download template
            </Button>
            <span className="text-muted-foreground text-xs">
              Two sample rows + an Entities reference sheet listing every entity
              code in the system.
            </span>
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
              .xlsx — up to 5 MB
            </div>
            <Input
              ref={inputRef}
              id="benefit-import-file"
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
                  sm:grid-cols-5
                `}
              >
                <SummaryCard label="Total" value={preview.summary.total} />
                <SummaryCard
                  label="Valid"
                  value={preview.summary.valid}
                  tone="positive"
                />
                <SummaryCard label="New" value={preview.summary.inserts} />
                <SummaryCard label="Updates" value={preview.summary.updates} />
                <SummaryCard
                  label="Errors"
                  value={preview.summary.invalid}
                  tone={preview.summary.invalid > 0 ? "warning" : undefined}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[800px] text-[12px]">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Category</th>
                      <th className="px-2 py-1.5 font-medium">Provider</th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Cost
                      </th>
                      <th className="px-2 py-1.5 font-medium">Entity</th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="text-muted-foreground px-2 py-1.5">
                          {r.row}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.name}
                          {r.errors.length > 0 ? (
                            <div className="text-destructive mt-0.5 text-[11px]">
                              {r.errors.join("; ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">{r.category}</td>
                        <td className="px-2 py-1.5">{r.provider ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {new Intl.NumberFormat("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(r.cost)}{" "}
                          <span className="text-muted-foreground">
                            {r.currency}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5">
                          {r.entityLabel ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.action === "update" ? (
                            <Badge variant="amber">Update</Badge>
                          ) : (
                            <Badge variant="green">New</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              !preview || preview.summary.valid === 0 || committing || parsing
            }
            className="min-w-32"
          >
            {committing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-4" />
            )}
            Import {preview ? preview.summary.valid : ""} benefits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
