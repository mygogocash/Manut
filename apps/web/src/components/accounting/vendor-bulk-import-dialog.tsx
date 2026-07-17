"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  type BulkImportResult,
  bulkImportVendors,
  type VendorImportRow,
} from "@/services/vendor.service";

// Header → field key map for vendor/contact finance exports.
// Matched case-insensitively and after trimming so locale-specific
// whitespace doesn't trip it up. Add new keys here when accounting
// renames a column.
const HEADER_MAP: Record<string, keyof VendorImportRow> = {
  "contact type": "contactType",
  "contact id": "contactId",
  "business type": "businessType",
  "business location": "businessLocation",
  "business name/full name": "name",
  "business name": "name",
  "full name": "name",
  name: "name",
  "address (tha)": "addressTh",
  "address (thai)": "addressTh",
  "address th": "addressTh",
  "address (eng)": "addressEn",
  "address (english)": "addressEn",
  "address en": "addressEn",
  "address 2": "address2",
  "address 3": "address3",
  "zip code": "zipCode",
  zipcode: "zipCode",
  "tax id": "taxId",
  "branch code": "branchCode",
  branch: "branch",
  "contact name": "contactName",
  email: "email",
  mobile: "mobile",
  "credit (days)": "creditDays",
  "credit days": "creditDays",
  credit: "creditDays",
  phone: "phone",
  "fax number": "faxNumber",
  fax: "faxNumber",
};

const NUMERIC_FIELDS = new Set<keyof VendorImportRow>(["creditDays"]);

interface VendorBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityId?: string | null;
  onImported?: (result: BulkImportResult) => void;
}

export function VendorBulkImportDialog({
  open,
  onOpenChange,
  defaultEntityId,
  onImported,
}: VendorBulkImportDialogProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState<string>(defaultEntityId ?? "");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<VendorImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    listEntities()
      .then((res) => {
        setEntities(res.data);
        if (!entityId && res.data[0]) setEntityId(res.data[0].id);
      })
      .catch(() => setEntities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = useCallback(() => {
    setFile(null);
    setParsedRows(null);
    setParseErrors([]);
    setResult(null);
  }, []);

  const parseFile = useCallback(async (f: File) => {
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("Spreadsheet has no sheets");
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error("First sheet is empty");

      // The Thai accounting export ships a title row before the
      // header. Find the header row by scanning for one whose first
      // non-empty cell matches a known mapping key.
      const sheet = XLSX.utils.sheet_to_json<Array<string | number>>(ws, {
        header: 1,
        defval: "",
        raw: false,
      });
      let headerIdx = -1;
      for (let i = 0; i < Math.min(sheet.length, 10); i += 1) {
        const row = sheet[i] ?? [];
        const normalised = row.map((c) =>
          String(c ?? "")
            .trim()
            .toLowerCase(),
        );
        if (normalised.some((c) => HEADER_MAP[c])) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx < 0) {
        throw new Error(
          "Could not find a header row. First column should contain one of: Contact Type, Business Name/Full Name, etc.",
        );
      }

      const rawHeaders = (sheet[headerIdx] ?? []).map((c) =>
        String(c ?? "").trim(),
      );
      const fieldByCol: Array<keyof VendorImportRow | null> = rawHeaders.map(
        (h) => HEADER_MAP[h.toLowerCase()] ?? null,
      );

      const errors: string[] = [];
      const rows: VendorImportRow[] = [];
      for (let r = headerIdx + 1; r < sheet.length; r += 1) {
        const raw = sheet[r] ?? [];
        const row: Partial<VendorImportRow> = {};
        for (let c = 0; c < fieldByCol.length; c += 1) {
          const field = fieldByCol[c];
          if (!field) continue;
          const cell = raw[c];
          if (cell === null || cell === undefined || cell === "") continue;
          const text = String(cell).trim();
          if (!text) continue;
          if (NUMERIC_FIELDS.has(field)) {
            const n = Number(text.replace(/[,\s]/g, ""));
            if (Number.isFinite(n)) {
              (row as Record<string, unknown>)[field] = Math.floor(n);
            }
          } else {
            (row as Record<string, unknown>)[field] = text;
          }
        }
        if (!row.name) continue; // skip blank trailing rows
        rows.push(row as VendorImportRow);
      }

      if (rows.length === 0) {
        errors.push(
          'No data rows with a "Business Name / Full Name" value were found.',
        );
      }
      setParsedRows(rows);
      setParseErrors(errors);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse file";
      setParsedRows(null);
      setParseErrors([message]);
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!entityId) {
      toast.error("Pick an entity");
      return;
    }
    if (!parsedRows || parsedRows.length === 0) {
      toast.error("Pick a file first");
      return;
    }
    try {
      setSubmitting(true);
      const res = await bulkImportVendors({
        entityId,
        mode,
        rows: parsedRows,
      });
      setResult(res.data);
      toast.success(
        `Imported — ${res.data.inserted} new, ${res.data.updated} updated, ${res.data.removed} removed`,
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
  }, [entityId, mode, parsedRows, onImported]);

  return (
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
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Bulk import vendors</DialogTitle>
          <DialogDescription>
            Upload a vendor/contact accounting workbook. Columns we recognise:
            Contact Type / ID, Business Type / Location, Business Name (or Full
            Name), Address (THA / ENG / 2 / 3), Zip, Tax ID, Branch Code /
            Branch, Contact Name, Email, Mobile, Credit (Days), Phone, Fax.
            Title rows above the headers are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entity</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Pick an entity" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "append" | "replace")}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">
                    Append (upsert on Contact ID / Tax ID)
                  </SelectItem>
                  <SelectItem value="replace">
                    Replace (wipe entity vendors first)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">File</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setParsedRows(null);
                  setParseErrors([]);
                  setResult(null);
                  if (f) void parseFile(f);
                }}
                className="text-xs"
              />
              {parsing ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              ) : null}
            </div>
            {file ? (
              <p
                className={`
                  text-muted-foreground mt-1 flex items-center gap-1 text-[11px]
                `}
              >
                <FileSpreadsheet className="size-3" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          {parseErrors.length > 0 && (
            <div
              className={`
                border-destructive/40 bg-destructive/5 text-destructive
                rounded-md border p-3 text-xs
              `}
            >
              {parseErrors.map((m, i) => (
                <p key={i}>{m}</p>
              ))}
            </div>
          )}

          {parsedRows && parsedRows.length > 0 && (
            <div
              className={`
                border-border bg-surface rounded-md border p-3 text-xs
              `}
            >
              <p className="text-foreground font-medium">
                {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"}{" "}
                ready to import
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                First row: <strong>{parsedRows[0]?.name}</strong>
                {parsedRows[0]?.contactId
                  ? ` · ${parsedRows[0].contactId}`
                  : ""}
                {parsedRows[0]?.taxId ? ` · Tax ${parsedRows[0].taxId}` : ""}
              </p>
            </div>
          )}

          {result && (
            <div
              className={`
                border-success/40 bg-success/5 text-success-foreground
                rounded-md border p-3 text-xs
              `}
            >
              <p className="font-medium">Import complete</p>
              <p className="mt-1">
                {result.inserted} inserted · {result.updated} updated ·{" "}
                {result.removed} removed (of {result.total} rows).
              </p>
            </div>
          )}
        </div>

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
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              parsing ||
              !parsedRows ||
              parsedRows.length === 0 ||
              !entityId
            }
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            <Upload className="size-3.5" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
