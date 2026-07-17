"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { createInvoice } from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const INVOICE_TYPES = ["receivable", "payable"] as const;

const schema = z
  .object({
    entityId: z.string().min(1, "Entity is required"),
    invoiceNo: z.string().min(1, "Invoice number is required"),
    type: z.enum(INVOICE_TYPES, { error: "Type is required" }),
    counterparty: z.string().min(1, "Counterparty is required"),
    amount: z.coerce
      .number<number | string>()
      .positive("Amount must be positive"),
    currency: z.string().min(1, "Currency is required").max(10),
    issueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date is required"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
    linkedJeId: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => data.dueDate >= data.issueDate, {
    message: "Due date must not be before issue date",
    path: ["dueDate"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => void;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  entities,
  onSaved,
}: InvoiceDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      invoiceNo: "",
      type: "receivable",
      counterparty: "",
      amount: 0,
      currency: "USD",
      issueDate: todayISO(),
      dueDate: todayISO(),
      linkedJeId: "",
      notes: "",
    },
  });

  const issueDateWatch = form.watch("issueDate");
  const dueDateWatch = form.watch("dueDate");

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        invoiceNo: "",
        type: "receivable",
        counterparty: "",
        amount: 0,
        currency: "USD",
        issueDate: todayISO(),
        dueDate: todayISO(),
        linkedJeId: "",
        notes: "",
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      await createInvoice({
        entityId: values.entityId,
        invoiceNo: values.invoiceNo,
        type: values.type,
        counterparty: values.counterparty,
        amount: values.amount,
        currency: values.currency,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        linkedJeId: values.linkedJeId || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Invoice created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create invoice";
      toast.error(message);
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
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Record a new receivable or payable invoice.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="invoice-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entities.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} ({e.code})
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVOICE_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
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
                    <FormLabel>Invoice No *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. INV-2026-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty *</FormLabel>
                    <FormControl>
                      <Input placeholder="Company or person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
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

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <FormControl>
                      <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        {...field}
                        maxDate={dueDateWatch || undefined}
                      />
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
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        {...field}
                        minDate={issueDateWatch || undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="linkedJeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Journal Entry ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional journal entry ID" {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

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
            type="submit"
            form="invoice-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
