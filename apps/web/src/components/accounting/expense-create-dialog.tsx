"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ALL_FILTER } from "@/components/accounting/accounting-utils";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type ChartOfAccount,
  createInvoice,
  listAccounts,
  updateInvoiceStatus,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// The Expense workspace records an AP bill as a single-line payable invoice and
// immediately posts the accrual (Dr [category expense account] / Cr Accounts
// Payable) by flipping it draft→sent — the PRD wants the entry booked on
// record, not left as a draft. VAT/WHT are out of scope here, so the document
// carries zero tax; a bill needing tax is created from the full Invoice dialog.
const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  invoiceNo: z.string().min(1, "Bill number is required").max(60),
  issueDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  counterparty: z.string().min(1, "Payee is required").max(200),
  // Optional — a blank category posts against the entity's expense_default.
  categoryAccountId: z.string(),
  amount: z
    .string()
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

// Sentinel for the "no category" Select option — an empty string can't be a
// SelectItem value, so we map this to `undefined` (fallback to expense_default).
const NO_CATEGORY = "__none__";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Editable default bill number: EXP-YYYYMMDD-HHMMSS in the browser's local
// clock. Unique enough for a manual create; the user can overwrite it, and the
// server still rejects a duplicate per entity with a clear conflict error.
function suggestBillNo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `EXP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

interface ExpenseCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  /** Pre-select this entity (the tab's current filter), if set. */
  defaultEntityId?: string;
  onSaved: () => void;
}

export function ExpenseCreateDialog({
  open,
  onOpenChange,
  entities,
  defaultEntityId,
  onSaved,
}: ExpenseCreateDialogProps) {
  const [categories, setCategories] = useState<ChartOfAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityId: "",
      invoiceNo: "",
      issueDate: todayIso(),
      dueDate: todayIso(),
      counterparty: "",
      categoryAccountId: NO_CATEGORY,
      amount: "",
      reference: "",
      notes: "",
    },
  });

  const entityId = form.watch("entityId");

  // Reset on open. Prefer the tab's active entity, else the first available.
  useEffect(() => {
    if (!open) return;
    const initialEntity =
      defaultEntityId && defaultEntityId !== ALL_FILTER
        ? defaultEntityId
        : (entities[0]?.id ?? "");
    form.reset({
      entityId: initialEntity,
      invoiceNo: suggestBillNo(),
      issueDate: todayIso(),
      dueDate: todayIso(),
      counterparty: "",
      categoryAccountId: NO_CATEGORY,
      amount: "",
      reference: "",
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEntityId]);

  // Load the entity's expense accounts for the category picker. Re-runs when the
  // entity changes; the category resets so a stale account can't leak across.
  useEffect(() => {
    if (!open || !entityId) {
      setCategories([]);
      return;
    }
    listAccounts({
      entityId,
      type: "expense",
      sortBy: "code",
      sortOrder: "asc",
    })
      .then((res) => setCategories(res.data.filter((a) => a.isActive)))
      .catch((err) => {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to load categories",
        );
        setCategories([]);
      });
  }, [open, entityId]);

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);
      const categoryAccountId =
        values.categoryAccountId && values.categoryAccountId !== NO_CATEGORY
          ? values.categoryAccountId
          : undefined;
      // 1) Record the bill as a single-line payable invoice (tax-free).
      const created = await createInvoice({
        entityId: values.entityId,
        invoiceNo: values.invoiceNo.trim(),
        type: "payable",
        counterparty: values.counterparty.trim(),
        currency: "THB",
        vatRate: 0,
        taxRate: 0,
        whtRate: 0,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        reference: values.reference?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        lineItems: [
          {
            description: values.notes?.trim() || values.counterparty.trim(),
            quantity: 1,
            unitPrice: Number(values.amount),
            glAccountId: categoryAccountId,
          },
        ],
      });
      // 2) Post the accrual by flipping draft→sent. When posting isn't ready
      // (flag off / incomplete mapping) this still succeeds as a plain status
      // flip — the bill is recorded, just not yet on the ledger.
      const sent = await updateInvoiceStatus(created.data.id, "sent");
      toast.success(
        sent.data.linkedJeId
          ? "Expense recorded and posted to the ledger"
          : "Expense recorded — complete posting setup to book the accrual",
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to record expense";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New expense</DialogTitle>
          <DialogDescription>
            Records a payable bill and posts the accrual (Dr category / Cr
            Accounts Payable). Pay it later from the list.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entities.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill number</FormLabel>
                    <FormControl>
                      <Input placeholder="EXP-…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="counterparty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payee</FormLabel>
                  <FormControl>
                    <Input placeholder="Supplier / payee name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="categoryAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Expense account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>
                          No category (default)
                        </SelectItem>
                        {categories.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (THB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                    <Input
                      placeholder="Vendor invoice no. / PO ref"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                Record expense
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
