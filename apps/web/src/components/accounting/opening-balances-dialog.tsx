"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormDatePicker } from "@/components/shared/form-date-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type ChartOfAccount,
  importOpeningBalances,
  listAccounts,
} from "@/services/accounting.service";

type Side = "debit" | "credit";
interface Row {
  chartOfAccountId: string;
  side: Side;
  amount: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function blankRow(): Row {
  return { chartOfAccountId: "", side: "debit", amount: "" };
}

interface OpeningBalancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  onSaved: () => void;
}

export function OpeningBalancesDialog({
  open,
  onOpenChange,
  entityId,
  onSaved,
}: OpeningBalancesDialogProps) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    setAsOfDate(todayISO());
    setRows([blankRow()]);
    listAccounts({ entityId })
      .then((res) => setAccounts(res.data.filter((a) => a.isActive)))
      .catch(() => setAccounts([]));
  }, [open, entityId]);

  const totalDebit = rows.reduce(
    (s, r) => s + (r.side === "debit" ? Number(r.amount) || 0 : 0),
    0,
  );
  const totalCredit = rows.reduce(
    (s, r) => s + (r.side === "credit" ? Number(r.amount) || 0 : 0),
    0,
  );

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function onSubmit() {
    const accountsPayload = rows
      .filter((r) => r.chartOfAccountId && Number(r.amount) > 0)
      .map((r) => ({
        chartOfAccountId: r.chartOfAccountId,
        debit: r.side === "debit" ? Number(r.amount) : undefined,
        credit: r.side === "credit" ? Number(r.amount) : undefined,
      }));

    if (accountsPayload.length === 0) {
      toast.error("Add at least one opening-balance row with an amount.");
      return;
    }

    try {
      setSubmitting(true);
      await importOpeningBalances({
        entityId,
        asOfDate,
        accounts: accountsPayload,
      });
      toast.success("Opening balances imported");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to import opening balances";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Import Opening Balances</DialogTitle>
          <DialogDescription>
            Enter the prior-year closing trial balance as one dated opening
            journal entry. Any debit/credit imbalance is posted to Opening
            Balance Equity. This can only be done once per entity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>As-of Date</Label>
            <FormDatePicker value={asOfDate} onChange={setAsOfDate} />
          </div>

          <div
            className={`
              border-border divide-border divide-y rounded-lg border
            `}
          >
            <div
              className={`
                bg-surface-secondary text-muted-foreground grid
                grid-cols-[1fr_110px_130px_32px] gap-2 px-3 py-2 text-[9px]
                font-bold tracking-widest uppercase
              `}
            >
              <span>Account</span>
              <span>Side</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {rows.map((row, index) => (
              <div
                key={index}
                className={`
                  grid grid-cols-[1fr_110px_130px_32px] items-center gap-2 px-3
                  py-2
                `}
              >
                <Select
                  value={row.chartOfAccountId}
                  onValueChange={(v) => updateRow(index, { chartOfAccountId: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={row.side}
                  onValueChange={(v) => updateRow(index, { side: v as Side })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-right text-xs"
                  value={row.amount}
                  onChange={(e) => updateRow(index, { amount: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={rows.length <= 1}
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setRows((prev) => [...prev, blankRow()])}
            >
              <Plus className="mr-1 size-3" />
              Add Row
            </Button>
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Dr <span className="tabular-nums">{fmt(totalDebit)}</span>
              </span>
              <span className="text-muted-foreground">
                Cr <span className="tabular-nums">{fmt(totalCredit)}</span>
              </span>
            </div>
          </div>
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
            onClick={onSubmit}
            disabled={submitting}
            className="min-w-28"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
