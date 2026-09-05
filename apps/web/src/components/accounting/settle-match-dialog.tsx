"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
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
  type BankAccount,
  type BankMatchDoc,
  type BankMatchSuggestion,
  listBankAccounts,
  settleBankTransaction,
} from "@/services/accounting.service";

const PAYMENT_METHODS = ["cash", "bank-transfer", "cheque", "other"] as const;

interface SettleMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  transaction: BankMatchSuggestion["transaction"] | null;
  invoice: BankMatchDoc | null;
  onSettled: () => void;
}

export function SettleMatchDialog({
  open,
  onOpenChange,
  entityId,
  transaction,
  invoice,
  onSettled,
}: SettleMatchDialogProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<string>("bank-transfer");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAr = invoice?.type === "receivable";

  useEffect(() => {
    if (!open || !transaction) return;
    setBankAccountId("");
    setDate(transaction.date);
    setMethod("bank-transfer");
    setReference("");
    listBankAccounts({ entityId })
      .then((res) => setBanks(res.data))
      .catch((err) => {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to load bank accounts",
        );
      });
  }, [open, transaction, entityId]);

  const onSubmit = async () => {
    if (!transaction || !invoice) return;
    if (!bankAccountId) {
      toast.error("Select the bank account the cash moved through");
      return;
    }
    try {
      setSubmitting(true);
      const res = await settleBankTransaction(transaction.id, {
        invoiceId: invoice.invoiceId,
        bankAccountId,
        date: date || undefined,
        method,
        reference: reference.trim() || undefined,
      });
      toast.success(
        res.data.posted
          ? "Settled and posted to the ledger"
          : "Settled — complete posting setup to book it",
      );
      onSettled();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to settle bank line",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm match &amp; settle</DialogTitle>
          <DialogDescription>
            {isAr
              ? "Records a receipt against this invoice and reconciles the bank line."
              : "Pays this bill and reconciles the bank line."}
          </DialogDescription>
        </DialogHeader>

        {transaction && invoice ? (
          <div className="flex flex-col gap-4">
            {/* Bank line → invoice it settles */}
            <div
              className={`
                border-border bg-surface flex items-center gap-3 rounded-lg
                border p-3 text-xs
              `}
            >
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground">Bank line</p>
                <p className="truncate font-medium">
                  {transaction.description}
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {formatDate(transaction.date)} ·{" "}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground">
                  {isAr ? "Invoice" : "Bill"}
                </p>
                <p className="truncate font-medium">
                  {invoice.invoiceNo}{" "}
                  <Badge variant={isAr ? "blue" : "amber"}>
                    {invoice.type}
                  </Badge>
                </p>
                <p className="text-muted-foreground truncate">
                  {invoice.counterparty} · outstanding{" "}
                  <span className="tabular-nums">
                    {formatCurrency(invoice.outstanding)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                {isAr ? "Deposit to" : "Pay from"}
              </Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Cheque no. / transfer ref"
              />
            </div>

            <p className="text-muted-foreground text-[11px]">
              The full bank-line amount ({formatCurrency(transaction.amount)})
              is applied to the {isAr ? "invoice" : "bill"}. Cash moves once —
              through the sole posting path.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirm &amp; settle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
