"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
  recordPayment,
} from "@/services/accounting.service";

const PAYMENT_METHODS = ["cash", "bank-transfer", "cheque", "other"] as const;

const schema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  date: z.string().min(1, "Date is required"),
  amount: z
    .string()
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  whtAmount: z
    .string()
    .refine((v) => v === "" || Number(v) >= 0, "WHT must be zero or more")
    .optional(),
  bankFee: z
    .string()
    .refine((v) => v === "" || Number(v) >= 0, "Bank fee must be zero or more")
    .optional(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(200).optional(),
  // Manual settlement FX rate (payment currency → THB base), shown only for a
  // foreign-currency invoice. Blank → the server resolves the rate for the day.
  exchangeRate: z
    .string()
    .refine((v) => v === "" || Number(v) > 0, "Rate must be greater than zero")
    .optional(),
  // Overpayment → customer advance (M3): AR + base-currency + no-WHT only.
  allowOverpayment: z.boolean(),
  writeOffRemainder: z.boolean(),
  writeOffReason: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

const BASE_CURRENCY = "THB";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSaved: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: PaymentDialogProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const outstanding = invoice
    ? Number(invoice.amount) - Number(invoice.amountPaid)
    : 0;
  const isAr = invoice?.type === "receivable";
  const isForeign =
    !!invoice && invoice.currency.toUpperCase() !== BASE_CURRENCY;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bankAccountId: "",
      date: new Date().toISOString().slice(0, 10),
      amount: "0",
      whtAmount: "0",
      bankFee: "0",
      method: "bank-transfer",
      reference: "",
      exchangeRate: "",
      allowOverpayment: false,
      writeOffRemainder: false,
      writeOffReason: "",
    },
  });

  useEffect(() => {
    if (!open || !invoice) return;
    form.reset({
      bankAccountId: "",
      date: new Date().toISOString().slice(0, 10),
      amount: outstanding.toFixed(2),
      whtAmount: "0",
      bankFee: "0",
      method: "bank-transfer",
      reference: "",
      exchangeRate: "",
      allowOverpayment: false,
      writeOffRemainder: false,
      writeOffReason: "",
    });
    listBankAccounts({ entityId: invoice.entity.id })
      .then((res) => setBanks(res.data))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to load bank accounts";
        toast.error(msg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  const onSubmit = async (values: FormValues) => {
    if (!invoice) return;
    try {
      setSubmitting(true);
      const res = await recordPayment(invoice.id, {
        bankAccountId: values.bankAccountId,
        date: values.date,
        amount: Number(values.amount),
        whtAmount: Number(values.whtAmount ?? 0),
        bankFee: Number(values.bankFee ?? 0),
        method: values.method,
        reference: values.reference || undefined,
        exchangeRate:
          isForeign && values.exchangeRate
            ? Number(values.exchangeRate)
            : undefined,
        allowOverpayment: values.allowOverpayment || undefined,
        writeOffRemainder: values.writeOffRemainder || undefined,
        writeOffReason: values.writeOffRemainder
          ? values.writeOffReason
          : undefined,
      });
      const advance = res.data.advanceCaptured;
      const noun = isAr ? "Receipt" : "Payment";
      toast.success(
        advance
          ? `Receipt recorded; ${formatCurrency(advance)} captured as a customer advance`
          : res.data.posted
            ? `${noun} recorded and posted to the ledger`
            : `${noun} recorded`,
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to record payment";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAr ? "Record receipt" : "Record payment"}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? `${invoice.invoiceNo} · outstanding ${formatCurrency(outstanding)} ${invoice.currency}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {invoice ? (
              <div
                className={`
                  bg-muted/40 text-muted-foreground rounded-md px-3 py-2 text-xs
                `}
              >
                Outstanding{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {formatCurrency(outstanding)} {invoice.currency}
                </span>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isAr ? "Deposit to" : "Pay from"}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whtAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WHT withheld</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bankFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank fee (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Stored on the {isAr ? "receipt" : "payment"} even if the
                    bank-charge GL posting lands later.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m} className="capitalize">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Cheque no. / transfer ref" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isForeign ? (
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Exchange rate ({invoice?.currency} → {BASE_CURRENCY})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.00000001"
                        min="0"
                        placeholder="Leave blank to use the day's rate"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      Settlement-date rate used to convert the cash to{" "}
                      {BASE_CURRENCY} and book any realised FX gain/loss. Leave
                      blank to use the recorded daily rate.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {isAr && !isForeign ? (
              <FormField
                control={form.control}
                name="allowOverpayment"
                render={({ field }) => (
                  <FormItem
                    className={`
                      border-border flex flex-row items-start gap-2 rounded-lg
                      border p-3
                    `}
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs">
                        Allow overpayment → customer advance
                      </FormLabel>
                      <p className="text-muted-foreground text-[11px]">
                        If the cash exceeds the outstanding balance, the excess
                        is captured as a customer advance you can apply later.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="writeOffRemainder"
              render={({ field }) => (
                <FormItem
                  className={`
                    border-border flex flex-row items-start gap-2 rounded-lg
                    border p-3
                  `}
                >
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-xs">
                      Write off remaining balance
                    </FormLabel>
                    <p className="text-muted-foreground text-[11px]">
                      Short payment: post the residual to the write-off account
                      and close the document. Reason required.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            {form.watch("writeOffRemainder") ? (
              <FormField
                control={form.control}
                name="writeOffReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Write-off reason</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isAr ? "Record receipt" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
