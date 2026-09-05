"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import {
  createQuote,
  type CreateQuoteInput,
  type Quote,
  updateQuote,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";
import { listVendors, type Vendor } from "@/services/vendor.service";

const NONE_VENDOR = "__none__";

const lineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Qty must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  taxRate: z.coerce.number().min(0).max(100),
});

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  vendorId: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date is required"),
  expiryDate: z.string().optional(),
  currency: z.string().min(1, "Currency is required").max(10),
  notes: z.string().max(2000).optional(),
  lines: z.array(lineSchema).min(1, "At least one line is required"),
});

type FormValues = z.infer<typeof schema>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toDefaults(quote?: Quote): FormValues {
  if (quote) {
    return {
      entityId: quote.entityId,
      vendorId: quote.vendorId ?? "",
      issueDate: quote.issueDate.slice(0, 10),
      expiryDate: quote.expiryDate ? quote.expiryDate.slice(0, 10) : "",
      currency: quote.currency,
      notes: quote.notes ?? "",
      lines: (quote.lines ?? []).length
        ? (quote.lines ?? []).map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            taxRate: Number(l.taxRate),
          }))
        : [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
    };
  }
  return {
    entityId: "",
    vendorId: "",
    issueDate: todayISO(),
    expiryDate: "",
    currency: "THB",
    notes: "",
    lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
  };
}

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => void;
  /** When present the dialog edits this quote; otherwise it creates a new one. */
  quote?: Quote;
}

export function QuoteDialog({
  open,
  onOpenChange,
  entities,
  onSaved,
  quote,
}: QuoteDialogProps) {
  const isEdit = Boolean(quote);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(quote),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const entityIdWatch = form.watch("entityId");
  const currencyWatch = form.watch("currency");
  const issueDateWatch = form.watch("issueDate");
  const watchedLines = form.watch("lines");

  const subtotal = round2(
    (watchedLines ?? []).reduce(
      (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      0,
    ),
  );
  const taxTotal = round2(
    (watchedLines ?? []).reduce((s, l) => {
      const lt = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      return s + (lt * (Number(l.taxRate) || 0)) / 100;
    }, 0),
  );
  const grandTotal = round2(subtotal + taxTotal);

  useEffect(() => {
    if (open) form.reset(toDefaults(quote));
  }, [open, quote, form]);

  useEffect(() => {
    if (!open || !entityIdWatch) {
      setVendors([]);
      return;
    }
    let cancelled = false;
    listVendors({ entityId: entityIdWatch, isActive: true, limit: 200 })
      .then((res) => {
        if (!cancelled) setVendors(res.data);
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityIdWatch]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload: CreateQuoteInput = {
        entityId: values.entityId,
        vendorId: values.vendorId?.trim() || undefined,
        issueDate: values.issueDate,
        expiryDate: values.expiryDate?.trim() || undefined,
        currency: values.currency,
        notes: values.notes?.trim() || undefined,
        lines: values.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      };
      if (quote) {
        const { entityId: _omit, ...rest } = payload;
        await updateQuote(quote.id, rest);
        toast.success("Quote updated");
      } else {
        await createQuote(payload);
        toast.success("Quote created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Failed to ${isEdit ? "update" : "create"} quote`;
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
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Quote" : "Create Quote"}</DialogTitle>
          <DialogDescription>
            Prepare a customer quotation. Send it, then convert an accepted
            quote into a draft invoice.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="quote-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
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
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      value={field.value || NONE_VENDOR}
                      onValueChange={(v) =>
                        field.onChange(v === NONE_VENDOR ? "" : v)
                      }
                      disabled={!entityIdWatch}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VENDOR}>None</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
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
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
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

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <FormControl>
                      <Input placeholder="THB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Line items ──────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Lines
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    append({
                      description: "",
                      quantity: 1,
                      unitPrice: 0,
                      taxRate: 0,
                    })
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Add Line
                </Button>
              </div>

              <div
                className={`
                  border-border divide-border divide-y rounded-lg border
                `}
              >
                <div
                  className={`
                    bg-surface-secondary text-muted-foreground grid
                    grid-cols-[1fr_70px_100px_70px_100px_32px] gap-2 px-3 py-2
                    text-[9px] font-bold tracking-widest uppercase
                  `}
                >
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span>Tax %</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>

                {fields.map((field, index) => {
                  const row = watchedLines?.[index];
                  const lineAmount = round2(
                    (Number(row?.quantity) || 0) * (Number(row?.unitPrice) || 0),
                  );
                  return (
                    <div
                      key={field.id}
                      className={`
                        grid grid-cols-[1fr_70px_100px_70px_100px_32px]
                        items-start gap-2 px-3 py-2
                      `}
                    >
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Input className="h-8 text-xs" {...f} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-8 text-xs"
                                {...f}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.unitPrice`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-8 text-xs"
                                {...f}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.taxRate`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-8 text-xs"
                                {...f}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <span
                        className={`
                          flex h-8 items-center justify-end text-xs tabular-nums
                        `}
                      >
                        {fmt(lineAmount)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {form.formState.errors.lines?.root && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.lines.root.message}
                </p>
              )}
            </div>

            <div
              className={`
                border-border bg-surface-secondary flex flex-col gap-1.5
                rounded-lg border p-3 text-sm
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {fmt(subtotal)} {currencyWatch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{fmt(taxTotal)}</span>
              </div>
              <div
                className={`
                  border-border mt-1 flex items-center justify-between border-t
                  pt-2 font-semibold
                `}
              >
                <span>Grand Total</span>
                <span className="tabular-nums">
                  {fmt(grandTotal)} {currencyWatch}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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
            form="quote-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
