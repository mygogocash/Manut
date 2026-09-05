"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/components/accounting/accounting-utils";
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
  type BankAccount,
  type Invoice,
  listBankAccounts,
  listInvoices,
  recordAllocatedPayment,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const OPEN_STATUSES = ["sent", "partial", "overdue"];
type Side = "receivable" | "payable";
interface Row {
  selected: boolean;
  amount: string;
  wht: string;
}

interface SettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onDone: () => void;
}

const outstandingOf = (i: Invoice) =>
  Math.max(0, Number(i.amount) - Number(i.amountPaid));

export function SettlementDialog({
  open,
  onOpenChange,
  entities,
  onDone,
}: SettlementDialogProps) {
  const [entityId, setEntityId] = useState("");
  const [side, setSide] = useState<Side>("receivable");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && !entityId && entities[0]) setEntityId(entities[0].id);
  }, [open, entityId, entities]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const [inv, bk] = await Promise.all([
        listInvoices({ entityId, type: side, limit: 100 }),
        listBankAccounts({ entityId }),
      ]);
      const openInv = inv.data.filter(
        (i) => OPEN_STATUSES.includes(i.status) && outstandingOf(i) > 0,
      );
      setInvoices(openInv);
      setBanks(bk.data);
      setRows(
        Object.fromEntries(
          openInv.map((i) => [
            i.id,
            { selected: false, amount: outstandingOf(i).toFixed(2), wht: "0" },
          ]),
        ),
      );
      setBankAccountId((prev) => prev || bk.data[0]?.id || "");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load open documents",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, side]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const selected = useMemo(
    () => invoices.filter((i) => rows[i.id]?.selected),
    [invoices, rows],
  );
  const totalCash = useMemo(
    () => selected.reduce((s, i) => s + (Number(rows[i.id]?.amount) || 0), 0),
    [selected, rows],
  );
  const totalWht = useMemo(
    () => selected.reduce((s, i) => s + (Number(rows[i.id]?.wht) || 0), 0),
    [selected, rows],
  );

  async function onSubmit() {
    if (!bankAccountId) {
      toast.error("Select a bank account");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one document");
      return;
    }
    try {
      setSubmitting(true);
      const res = await recordAllocatedPayment({
        bankAccountId,
        date,
        allocations: selected.map((i) => ({
          invoiceId: i.id,
          amount: Number(rows[i.id]?.amount) || 0,
          whtAmount: Number(rows[i.id]?.wht) || 0,
        })),
      });
      toast.success(
        `Settled ${res.data.invoicesSettled} document(s); cash ${res.data.totalCash.toFixed(2)}`,
      );
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to record settlement",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Settle multiple documents</DialogTitle>
          <DialogDescription>
            One {side === "receivable" ? "receipt" : "payment"} clearing several{" "}
            {side === "receivable" ? "invoices" : "bills"} at once. Amount is
            the net cash applied to each; WHT is additional.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`
            grid grid-cols-2 gap-3
            md:grid-cols-4
          `}
        >
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Entity</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Type</Label>
            <Select value={side} onValueChange={(v) => setSide(v as Side)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receivable">Receipt (AR)</SelectItem>
                <SelectItem value="payable">Payment (AP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Bank account</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Bank account" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div
          className={`
            border-border max-h-[45vh] overflow-auto rounded-lg border
          `}
        >
          <table className="w-full text-sm">
            <thead
              className={`text-muted-foreground bg-surface sticky top-0 text-xs`}
            >
              <tr className="border-border border-b">
                <th className="px-2 py-2" />
                <th className="px-2 py-2 text-left">Document</th>
                <th className="px-2 py-2 text-left">Counterparty</th>
                <th className="px-2 py-2 text-right">Outstanding</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2 text-right">WHT</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const row = rows[i.id];
                return (
                  <tr key={i.id} className="border-border/50 border-b">
                    <td className="px-2 py-1.5">
                      <Checkbox
                        checked={row?.selected ?? false}
                        onCheckedChange={(c) =>
                          setRow(i.id, { selected: c === true })
                        }
                        aria-label={`Select ${i.invoiceNo}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">{i.invoiceNo}</td>
                    <td className="max-w-[160px] truncate px-2 py-1.5">
                      {i.counterparty}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(outstandingOf(i))}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={row?.amount ?? ""}
                        onChange={(e) =>
                          setRow(i.id, { amount: e.target.value })
                        }
                        disabled={!row?.selected}
                        className="h-8 w-28 text-right text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={row?.wht ?? ""}
                        onChange={(e) => setRow(i.id, { wht: e.target.value })}
                        disabled={!row?.selected}
                        className="h-8 w-24 text-right text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 ? (
                <tr>
                  <td
                    className={`
                      text-muted-foreground px-2 py-3 text-center text-xs
                    `}
                    colSpan={6}
                  >
                    {loading
                      ? "Loading…"
                      : "No open documents for this entity."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={`text-muted-foreground flex justify-end gap-6 text-sm`}>
          <span>
            Cash{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatCurrency(totalCash)}
            </span>
          </span>
          <span>
            WHT{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatCurrency(totalWht)}
            </span>
          </span>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || selected.length === 0}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : null}
            Record settlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
