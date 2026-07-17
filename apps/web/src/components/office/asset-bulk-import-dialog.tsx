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
  ASSET_STATUS_LABELS,
  type AssetImportPreview,
  type AssetImportRow,
  commitAssetImport,
  previewAssetImport,
} from "@/services/office.service";

interface AssetBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

// Status strings that appear in HR's spreadsheet → canonical app values.
// Kept in lock-step with the script in
// `packages/database/prisma/scripts/import-it-assets.ts`. Both are part
// of the same migration story; if HR ever ships a row with a new status
// the app will show the raw value and an admin can edit it from the UI.
const STATUS_MAP: Record<string, string> = {
  active: "active",
  owner: "owner",
  available: "available",
  "de-active": "retired",
  deactive: "retired",
  retired: "retired",
  ordered: "ordered",
};

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function normaliseStatus(raw: string | null): string {
  if (!raw) return "available";
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "available";
}

function excelSerialToISO(serial: number | null): string | null {
  if (serial === null || !Number.isFinite(serial)) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return excelSerialToISO(v);
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && n > 10000) return excelSerialToISO(n);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

type Sheet = unknown[][];

function sheetMatrix(wb: XLSX.WorkBook, name: string): Sheet | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });
}

function parseHardware(rows: Sheet | null): AssetImportRow[] {
  if (!rows) return [];
  const out: AssetImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const peripheralType = clean(r[0]);
    if (!peripheralType) continue;
    out.push({
      type:
        peripheralType.toLowerCase() === "monitor" ? "monitor" : "peripheral",
      name: clean(r[2]) ?? clean(r[1]) ?? peripheralType,
      manufacturer: clean(r[1]),
      model: clean(r[2]),
      subType: peripheralType,
      serialNo: clean(r[3]),
      status: normaliseStatus(clean(r[4])),
      description: clean(r[5]),
      supportLink: clean(r[6]),
      activeServiceDate: parseDate(r[7]),
      department: clean(r[8]),
      sourceSheet: "Hardware",
    });
  }
  return out;
}

function parseSoftware(rows: Sheet | null): AssetImportRow[] {
  if (!rows) return [];
  const out: AssetImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = clean(r[0]);
    if (!name) continue;
    out.push({
      type: "software",
      name,
      manufacturer: clean(r[1]),
      subType: clean(r[2]),
      version: clean(r[3]),
      status: "active",
      sourceSheet: "Software",
    });
  }
  return out;
}

function parseLaptop(rows: Sheet | null): AssetImportRow[] {
  if (!rows) return [];
  const out: AssetImportRow[] = [];
  // Header at row 0, qualifier at row 1 ("Employee (Thai)"), data from row 2.
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const typeCol = clean(r[0]);
    if (!typeCol) continue;
    out.push({
      type: "laptop",
      name: clean(r[1]) ?? "Laptop",
      operatingSystem: clean(r[2]),
      manufacturer: clean(r[3]),
      model: clean(r[4]),
      serialNo: clean(r[5]),
      subType: clean(r[6]),
      activeServiceDate: parseDate(r[7]),
      status: normaliseStatus(clean(r[8])),
      assigneeFirstName: clean(r[10]),
      assigneeLastName: clean(r[11]),
      assigneeEmail: clean(r[15]),
      department: clean(r[16]),
      notes: clean(r[17]),
      sourceSheet: "Laptop",
    });
  }
  return out;
}

function parsePeripheralWithEmployee(
  rows: Sheet | null,
  type: string,
  headerIdx: number,
  sheet: string,
): AssetImportRow[] {
  if (!rows) return [];
  const out: AssetImportRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = clean(r[0]);
    if (!name) continue;
    out.push({
      type,
      name,
      manufacturer: clean(r[0]),
      model: clean(r[1]),
      colour: clean(r[2]),
      serialNo: clean(r[3]),
      activeServiceDate: parseDate(r[4]),
      status: normaliseStatus(clean(r[5])),
      assigneeFirstName: clean(r[6]),
      assigneeLastName: clean(r[7]),
      department: clean(r[8]),
      sourceSheet: sheet,
    });
  }
  return out;
}

function parseUsb(rows: Sheet | null): AssetImportRow[] {
  if (!rows) return [];
  const out: AssetImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = clean(r[0]);
    if (!name) continue;
    out.push({
      type: "usb_accessory",
      name,
      manufacturer: clean(r[0]),
      model: clean(r[1]),
      colour: clean(r[2]),
      subType: clean(r[3]),
      serialNo: clean(r[4]),
      activeServiceDate: parseDate(r[5]),
      status: normaliseStatus(clean(r[6])),
      assigneeFirstName: clean(r[7]),
      assigneeLastName: clean(r[8]),
      department: clean(r[9]),
      sourceSheet: "Usb",
    });
  }
  return out;
}

// Builds a starter workbook that mirrors the column order the parser
// expects above. Six sheets, one sample row each, plus the same
// pass-through `Demo Sticker template` and `ACC` sheets HR uses (left
// empty so the parser still ignores them on round-trip).
function buildAssetTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const hardware: Array<Array<string | number>> = [
    [
      "Peripheral Type",
      "Manufacturer",
      "Model",
      "Serial Number",
      "Status",
      "Description",
      "Support Link",
      "Active Service Date",
      "Department",
    ],
    [
      "Monitor",
      "Dell",
      "U3223QE",
      "ABC123XYZ",
      "Active",
      "Sample row — replace before import",
      "https://example.com",
      "2025-01-15",
      "Engineering",
    ],
  ];

  const software: Array<Array<string | number>> = [
    ["Name", "Manufacturer", "Type", "Version"],
    ["Adobe Photoshop", "Adobe", "Productivity", "3.15.0"],
  ];

  const laptop: Array<Array<string | number>> = [
    [
      "Category",
      "Name",
      "Operating System",
      "Manufacturer",
      "Model",
      "Serial Number",
      "Sub-type",
      "Active Service Date",
      "Status",
      "Account",
      "Employee First Name",
      "Employee Last Name",
      "Employee Full Name",
      "Receive",
      "Return",
      "Email",
      "Department",
      "Notes",
    ],
    [
      "Employee (Thai)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Laptop",
      "MacBook Pro",
      "macOS",
      "Apple",
      'MacBook Pro 14" M3',
      "ABCD1234",
      "A2918",
      "2025-01-15",
      "Active",
      "Record",
      "Jane",
      "Doe",
      "Jane Doe",
      "",
      "",
      "jane@manut.example",
      "Management",
      "",
    ],
  ];

  const peripheralWithEmployee: Array<Array<string | number>> = [
    [
      "Name",
      "Model",
      "Colour",
      "Serial Number",
      "Active Service Date",
      "Status",
      "Employee First Name",
      "Employee Last Name",
      "Department",
    ],
    [
      "Logitech",
      "M350s",
      "Black",
      "MOUSE001",
      "2025-01-15",
      "Active",
      "Jane",
      "Doe",
      "Engineering",
    ],
  ];

  const mouse: Array<Array<string | number>> = [
    Array(9).fill(""), // banner row — parser starts from headerIdx + 1
    ...peripheralWithEmployee,
  ];

  const mobile: Array<Array<string | number>> = [
    Array(9).fill(""),
    [
      "Name",
      "Model",
      "Colour",
      "Serial Number",
      "Active Service Date",
      "Status",
      "Employee First Name",
      "Employee Last Name",
      "Department",
    ],
    [
      "Realme C75",
      "RMX3941",
      "Storm Black",
      "PHONE001",
      "2025-01-15",
      "Active",
      "Jane",
      "Doe",
      "Engineering",
    ],
  ];

  const usb: Array<Array<string | number>> = [
    [
      "Name",
      "Model",
      "Colour",
      "Type",
      "Serial Number",
      "Active Service Date",
      "Status",
      "Employee First Name",
      "Employee Last Name",
      "Department",
    ],
    [
      "Apple Dual USB-C Port 35W",
      "A2676",
      "White",
      "Power Adapter",
      "USB001",
      "2025-01-15",
      "Ordered",
      "",
      "",
      "",
    ],
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(hardware),
    "Hardware",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(software),
    "Software",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(laptop), "Laptop");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mouse), "Mouse");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mobile), "Mobile");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usb), "Usb");

  return wb;
}

async function parseWorkbook(file: File): Promise<AssetImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const rows: AssetImportRow[] = [
    ...parseHardware(sheetMatrix(wb, "Hardware")),
    ...parseSoftware(sheetMatrix(wb, "Software")),
    ...parseLaptop(sheetMatrix(wb, "Laptop")),
    ...parsePeripheralWithEmployee(
      sheetMatrix(wb, "Mouse"),
      "peripheral",
      1,
      "Mouse",
    ),
    ...parsePeripheralWithEmployee(
      sheetMatrix(wb, "Mobile"),
      "mobile",
      1,
      "Mobile",
    ),
    ...parseUsb(sheetMatrix(wb, "Usb")),
  ];
  return rows;
}

export function AssetBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: AssetBulkImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<AssetImportRow[]>([]);
  const [preview, setPreview] = useState<AssetImportPreview | null>(null);
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
      const wb = buildAssetTemplate();
      XLSX.writeFile(wb, "it-asset-import-template.xlsx");
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
      const parsed = await parseWorkbook(f);
      if (parsed.length === 0) {
        toast.error("No asset rows found in the workbook");
        setParsing(false);
        return;
      }
      setRows(parsed);
      const res = await previewAssetImport(parsed);
      setPreview(res.data);
      toast.success(
        `Parsed ${res.data.summary.total} rows — ${res.data.summary.valid} valid, ${res.data.summary.unresolvedAssignees} without an assignee`,
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
      const res = await commitAssetImport(rows);
      const { inserts, updates, skipped } = res.data;
      toast.success(
        `Imported ${inserts + updates} rows (${inserts} new, ${updates} updated${
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
          <DialogTitle>Import IT assets</DialogTitle>
          <DialogDescription>
            Upload an asset-management workbook. We&apos;ll parse the Hardware,
            Software, Laptop, Mouse, Mobile and Usb sheets, resolve assignees by
            email or name, and route each row to the office that matches the
            user&apos;s entity.
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
              Six sheets — Hardware, Software, Laptop, Mouse, Mobile, Usb — with
              one sample row each.
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
              id="asset-import-file"
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
                <SummaryCard
                  label="To insert"
                  value={preview.summary.inserts}
                />
                <SummaryCard
                  label="To update"
                  value={preview.summary.updates}
                />
                <SummaryCard
                  label="No assignee"
                  value={preview.summary.unresolvedAssignees}
                  tone={
                    preview.summary.unresolvedAssignees > 0
                      ? "warning"
                      : undefined
                  }
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-[12px]">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Sheet</th>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Serial</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="px-2 py-1.5 font-medium">Assignee</th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="text-muted-foreground px-2 py-1.5">
                          {r.row}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5">
                          {r.sourceSheet ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">{r.type}</td>
                        <td className="px-2 py-1.5">
                          {r.name}
                          {r.errors.length > 0 ? (
                            <div className="text-destructive mt-0.5 text-[11px]">
                              {r.errors.join("; ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5">
                          {r.serialNo ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {ASSET_STATUS_LABELS[r.status] ?? r.status}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.assigneeName ? (
                            r.assigneeName
                          ) : r.assigneeRaw ? (
                            <span className="text-muted-foreground">
                              {r.assigneeRaw}
                              <span className="ml-1 text-amber-600">
                                (no match)
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.action === "update" ? (
                            <Badge variant="amber">Update</Badge>
                          ) : (
                            <Badge variant="green">Insert</Badge>
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
            Import {preview ? preview.summary.valid : ""} rows
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
