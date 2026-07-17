"use client";

import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  type Payslip,
  removePayslipDocument,
  updatePayslip,
  type UpdatePayslipInput,
  uploadPayslipDocument,
} from "@/services/payroll.service";

interface KeyValueRow {
  key: string;
  value: string;
}

function recordToRows(r: Record<string, number> | null): KeyValueRow[] {
  if (!r) return [];
  return Object.entries(r).map(([k, v]) => ({ key: k, value: String(v) }));
}

/**
 * Roll {key, value}[] back into a Record<string, number>, dropping rows
 * with empty keys or non-numeric values so the import-style "blank row"
 * doesn't pollute the JSON column. Duplicate keys win last-wins.
 */
function rowsToRecord(rows: KeyValueRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    const n = Number(r.value);
    if (!Number.isFinite(n)) continue;
    out[k] = n;
  }
  return out;
}

function sumRows(rows: KeyValueRow[]): number {
  let total = 0;
  for (const r of rows) {
    const n = Number(r.value);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export interface PayslipEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  payslip: Payslip | null;
  /** Called with the updated payslip so the parent can refresh totals. */
  onSaved: (next: Payslip) => void;
}

export function PayslipEditDialog({
  open,
  onOpenChange,
  runId,
  payslip,
  onSaved,
}: PayslipEditDialogProps) {
  const [baseSalary, setBaseSalary] = useState("0");
  const [currency, setCurrency] = useState("THB");
  const [allowances, setAllowances] = useState<KeyValueRow[]>([]);
  const [deductions, setDeductions] = useState<KeyValueRow[]>([]);
  const [saving, setSaving] = useState(false);
  // Local mirror of the payslip row's documentUrl so the upload /
  // remove buttons reflect optimistic state without needing the
  // parent to re-fetch every keystroke.
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Reset every time the dialog opens for a new payslip. Use the
  // payslip id as the discriminator so reopening on a different person
  // doesn't keep stale form state from the previous row.
  useEffect(() => {
    if (!open || !payslip) return;
    setBaseSalary(String(payslip.baseSalary ?? 0));
    setCurrency(payslip.currency ?? "THB");
    setAllowances(recordToRows(payslip.allowances));
    setDeductions(recordToRows(payslip.deductions));
    setDocumentUrl(payslip.documentUrl ?? null);
  }, [open, payslip]);

  const baseNum = Number(baseSalary);
  const allowanceTotal = useMemo(() => sumRows(allowances), [allowances]);
  const deductionTotal = useMemo(() => sumRows(deductions), [deductions]);
  const gross = Number.isFinite(baseNum) ? baseNum + allowanceTotal : 0;
  const net = gross - deductionTotal;

  function updateRow(
    list: KeyValueRow[],
    setList: (rows: KeyValueRow[]) => void,
    index: number,
    patch: Partial<KeyValueRow>,
  ) {
    setList(list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(
    list: KeyValueRow[],
    setList: (rows: KeyValueRow[]) => void,
    index: number,
  ) {
    setList(list.filter((_, i) => i !== index));
  }

  function addRow(list: KeyValueRow[], setList: (rows: KeyValueRow[]) => void) {
    setList([...list, { key: "", value: "" }]);
  }

  async function handleUploadDocument(file: File) {
    if (!payslip) return;
    try {
      setUploading(true);
      const res = await uploadPayslipDocument(runId, payslip.id, file);
      setDocumentUrl(res.data.documentUrl ?? null);
      onSaved(res.data);
      toast.success("Payslip PDF attached");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to upload payslip document";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function handleRemoveDocument() {
    if (!payslip) return;
    try {
      setUploading(true);
      const res = await removePayslipDocument(runId, payslip.id);
      setDocumentUrl(null);
      onSaved(res.data);
      toast.success("Payslip PDF removed");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to remove payslip document";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!payslip) return;
    const baseN = Number(baseSalary);
    if (!Number.isFinite(baseN) || baseN < 0) {
      toast.error("Base salary must be a non-negative number");
      return;
    }
    const payload: UpdatePayslipInput = {
      baseSalary: baseN,
      currency: currency.trim() || payslip.currency,
      allowances: rowsToRecord(allowances),
      deductions: rowsToRecord(deductions),
    };
    try {
      setSaving(true);
      const res = await updatePayslip(runId, payslip.id, payload);
      toast.success("Payslip updated");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update payslip";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        className={`
          max-h-[90vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Edit payslip</DialogTitle>
          <DialogDescription>
            {payslip
              ? `${payslip.employee.name}${
                  payslip.employee.email ? ` — ${payslip.employee.email}` : ""
                }`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {payslip && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseSalary" className="text-xs">
                  Base salary
                </Label>
                <Input
                  id="baseSalary"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currency" className="text-xs">
                  Currency
                </Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
            </div>

            <KeyValueSection
              title="Allowances"
              rows={allowances}
              onChange={(rows) => setAllowances(rows)}
              onAdd={() => addRow(allowances, setAllowances)}
              onUpdate={(i, patch) =>
                updateRow(allowances, setAllowances, i, patch)
              }
              onRemove={(i) => removeRow(allowances, setAllowances, i)}
              total={allowanceTotal}
              accent="positive"
            />

            <KeyValueSection
              title="Deductions"
              rows={deductions}
              onChange={(rows) => setDeductions(rows)}
              onAdd={() => addRow(deductions, setDeductions)}
              onUpdate={(i, patch) =>
                updateRow(deductions, setDeductions, i, patch)
              }
              onRemove={(i) => removeRow(deductions, setDeductions, i)}
              total={deductionTotal}
              accent="negative"
            />

            <div
              className={`
                border-border bg-surface-secondary/40 grid grid-cols-3 gap-3
                rounded-md border p-3 text-sm
              `}
            >
              <div>
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-wider
                    uppercase
                  `}
                >
                  Gross (computed)
                </p>
                <p className="text-foreground mt-0.5 font-medium tabular-nums">
                  {gross.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-wider
                    uppercase
                  `}
                >
                  Net (computed)
                </p>
                <p className="text-foreground mt-0.5 font-medium tabular-nums">
                  {net.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-wider
                    uppercase
                  `}
                >
                  Ccy
                </p>
                <p className="text-foreground mt-0.5 font-medium uppercase">
                  {currency || "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {payslip ? (
          <div
            className={`
              border-border bg-surface-secondary/40 flex flex-col gap-2
              rounded-md border p-3 text-sm
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-2 text-xs">
                <FileText className="text-muted-foreground size-3.5" />
                Payslip PDF
              </Label>
              {documentUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`
                    text-destructive h-7 text-xs
                    hover:bg-destructive/10 hover:text-destructive
                  `}
                  onClick={handleRemoveDocument}
                  disabled={uploading}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-[11px]">
              {documentUrl
                ? "A PDF is attached. Employees can download it from /my-portal → My Payslip."
                : "Attach the rendered payslip PDF so the employee can download it from /my-portal → My Payslip."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => docInputRef.current?.click()}
                disabled={uploading || saving}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {documentUrl ? "Replace PDF" : "Upload PDF"}
              </Button>
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadDocument(file);
                }}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !payslip}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeyValueSection({
  title,
  rows,
  onAdd,
  onUpdate,
  onRemove,
  total,
  accent,
}: {
  title: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<KeyValueRow>) => void;
  onRemove: (index: number) => void;
  total: number;
  accent: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-foreground text-xs font-semibold tracking-wide">
          {title}
        </h4>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p
          className={`
            text-muted-foreground border-border/60 rounded-md border
            border-dashed py-3 text-center text-[11px]
          `}
        >
          No {title.toLowerCase()} yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={r.key}
                placeholder="Label (e.g. meal)"
                onChange={(e) => onUpdate(i, { key: e.target.value })}
                className="h-8 flex-1 text-xs"
              />
              <Input
                value={r.value}
                placeholder="0.00"
                type="number"
                inputMode="decimal"
                step="0.01"
                onChange={(e) => onUpdate(i, { value: e.target.value })}
                className="h-8 w-32 text-right text-xs tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(i)}
              >
                <Trash2 className="text-destructive size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="text-muted-foreground flex justify-end text-[11px]">
        Total:&nbsp;
        <span
          className={
            accent === "positive"
              ? "text-foreground font-medium tabular-nums"
              : "text-destructive font-medium tabular-nums"
          }
        >
          {accent === "negative" ? "−" : ""}
          {total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}
