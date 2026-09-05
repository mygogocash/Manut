"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/components/accounting/accounting-utils";
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
  applyCustomerAdvance,
  type CustomerAdvance,
  type Invoice,
  listCustomerAdvances,
  listInvoices,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const OPEN_STATUSES = ["sent", "partial", "overdue"];
const outstandingOf = (i: Invoice) =>
  Math.max(0, Number(i.amount) - Number(i.amountPaid));

interface CustomerAdvancesPanelProps {
  entities: Entity[];
}

export function CustomerAdvancesPanel({ entities }: CustomerAdvancesPanelProps) {
  const [entityId, setEntityId] = useState("");
  const [advances, setAdvances] = useState<CustomerAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyTarget, setApplyTarget] = useState<CustomerAdvance | null>(null);

  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listCustomerAdvances({ entityId });
      setAdvances(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load advances",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`border-border bg-card overflow-hidden rounded-xl border`}
    >
      <div
        className={`
          border-border flex flex-col gap-3 border-b px-5 py-4
          sm:flex-row sm:items-end sm:justify-between
        `}
      >
        <div>
          <h3 className="font-serif text-lg">Customer advances</h3>
          <p className="text-muted-foreground text-xs">
            Unapplied credits from overpaid receipts. Apply a balance to an open
            invoice.
          </p>
        </div>
        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-9 w-[170px] text-xs">
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

      <div className="max-h-[45vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground bg-surface sticky top-0 text-xs">
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left">Counterparty</th>
              <th className="px-3 py-2 text-right">Original</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {advances.map((a) => (
              <tr key={a.id} className="border-border/50 border-b">
                <td className="max-w-[220px] truncate px-3 py-1.5">
                  {a.counterparty}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {a.currency} {formatCurrency(a.originalAmount)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {a.currency} {formatCurrency(a.balance)}
                </td>
                <td className="px-3 py-1.5">
                  <Badge variant={a.status === "open" ? "green" : "amber"}>
                    {a.status}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-right">
                  {a.status === "open" && Number(a.balance) > 0 ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setApplyTarget(a)}
                    >
                      Apply
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {advances.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-6 text-center text-xs"
                  colSpan={5}
                >
                  {loading ? "Loading…" : "No customer advances."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ApplyAdvanceDialog
        advance={applyTarget}
        onClose={() => setApplyTarget(null)}
        onDone={() => {
          setApplyTarget(null);
          void load();
        }}
      />
    </section>
  );
}

function ApplyAdvanceDialog({
  advance,
  onClose,
  onDone,
}: {
  advance: CustomerAdvance | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!advance) return;
    setInvoiceId("");
    setAmount("");
    listInvoices({
      entityId: advance.entityId,
      type: "receivable",
      limit: 100,
    })
      .then((res) =>
        setInvoices(
          res.data.filter(
            (i) =>
              i.counterparty === advance.counterparty &&
              OPEN_STATUSES.includes(i.status) &&
              outstandingOf(i) > 0,
          ),
        ),
      )
      .catch(() => setInvoices([]));
  }, [advance]);

  const selected = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  );

  // Cap the applied amount at both the advance balance and the invoice's
  // outstanding, so the input never over-applies.
  const maxApply = useMemo(() => {
    if (!advance) return 0;
    const bal = Number(advance.balance);
    return selected ? Math.min(bal, outstandingOf(selected)) : bal;
  }, [advance, selected]);

  async function onApply() {
    if (!advance || !invoiceId) {
      toast.error("Pick an invoice");
      return;
    }
    const amt = Number(amount);
    if (!(amt > 0)) {
      toast.error("Enter an amount");
      return;
    }
    try {
      setBusy(true);
      const res = await applyCustomerAdvance(advance.id, {
        invoiceId,
        amount: amt,
      });
      toast.success(
        `Applied ${amt.toFixed(2)}; balance ${res.data.remainingBalance.toFixed(2)}`,
      );
      onDone();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to apply advance",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={advance !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply customer advance</DialogTitle>
          <DialogDescription>
            {advance
              ? `${advance.counterparty} · balance ${advance.currency} ${formatCurrency(advance.balance)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Open invoice</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger className="text-xs">
                <SelectValue
                  placeholder={
                    invoices.length === 0
                      ? "No open invoices for this counterparty"
                      : "Select invoice"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.invoiceNo} — outstanding {formatCurrency(outstandingOf(i))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">
              Amount (max {formatCurrency(maxApply)})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={maxApply.toFixed(2)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={busy || !invoiceId}>
            {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
