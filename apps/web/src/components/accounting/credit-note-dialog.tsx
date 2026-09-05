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
  createCreditNote,
  type CreateCreditNoteInput,
  type Invoice,
  listInvoices,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const CREDIT_NOTE_TYPES = ["receivable", "payable"] as const;
const CREDIT_NOTE_KINDS = ["credit", "debit"] as const;

// Statutory reason list (M4). "Other" reveals a free-text field.
const REASON_OPTIONS = [
  "Price reduction",
  "Goods returned",
  "Pricing error",
  "Service cancelled",
] as const;
const OTHER_REASON = "__other__";

const lineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Qty must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  taxRate: z.coerce
    .number()
    .min(0, "Tax rate must be 0 or more")
    .max(100, "Tax rate must be 100 or less"),
});

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  type: z.enum(CREDIT_NOTE_TYPES, { required_error: "Side is required" }),
  noteKind: z.enum(CREDIT_NOTE_KINDS, { required_error: "Kind is required" }),
  linkedInvoiceId: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date is required"),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(lineSchema).min(1, "At least one line is required"),
});

type FormValues = z.infer<typeof schema>;

const NONE_INVOICE = "__none__";

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

function blankDefaults(): FormValues {
  return {
    entityId: "",
    type: "receivable",
    noteKind: "credit",
    linkedInvoiceId: "",
    issueDate: todayISO(),
    reason: "",
    notes: "",
    lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
  };
}

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => void;
}

export function CreditNoteDialog({
  open,
  onOpenChange,
  entities,
  onSaved,
}: CreditNoteDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Whether the reason is a preset (from the select) or the free-text "Other".
  const [reasonMode, setReasonMode] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: blankDefaults(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const entityIdWatch = form.watch("entityId");
  const typeWatch = form.watch("type");
  const watchedLines = form.watch("lines");

  // Live totals mirror the server: subtotal = Σ(qty × price);
  // taxTotal = Σ(lineTotal × taxRate/100); grand = subtotal + taxTotal.
  const subtotal = round2(
    (watchedLines ?? []).reduce(
      (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      0,
    ),
  );
  const taxTotal = round2(
    (watchedLines ?? []).reduce((sum, l) => {
      const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      return sum + (lineTotal * (Number(l.taxRate) || 0)) / 100;
    }, 0),
  );
  const grandTotal = round2(subtotal + taxTotal);

  useEffect(() => {
    if (open) {
      form.reset(blankDefaults());
      setReasonMode("");
      setInvoices([]);
    }
  }, [open, form]);

  // Load the source documents (same entity + type) so the note can reference
  // the original invoice/bill. The link is optional.
  useEffect(() => {
    if (!open || !entityIdWatch) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    listInvoices({ entityId: entityIdWatch, type: typeWatch, limit: 100 })
      .then((res) => {
        if (!cancelled) setInvoices(res.data);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityIdWatch, typeWatch]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const input: CreateCreditNoteInput = {
        entityId: values.entityId,
        type: values.type,
        noteKind: values.noteKind,
        linkedInvoiceId: values.linkedInvoiceId?.trim() || undefined,
        issueDate: values.issueDate,
        reason: values.reason?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        lines: values.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      };
      await createCreditNote(input);
      toast.success(
        values.noteKind === "debit" ? "Debit note created" : "Credit note created",
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create credit note";
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
          <DialogTitle>New Credit / Debit Note</DialogTitle>
          <DialogDescription>
            Pick the side (AR/AP) and kind — a credit note reduces the balance, a
            debit note increases it. Issue it later to post to the ledger.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="credit-note-form"
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
                      onValueChange={(v) => {
                        field.onChange(v);
                        // Entity/type drive the source-document list; drop any
                        // stale link so we never submit an id from the old list.
                        form.setValue("linkedInvoiceId", "");
                      }}
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Side *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        // Entity/side drive the source-document list; drop any
                        // stale link so we never submit an id from the old list.
                        form.setValue("linkedInvoiceId", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="receivable">
                          Receivable (AR)
                        </SelectItem>
                        <SelectItem value="payable">Payable (AP)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noteKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="credit">
                          Credit note — reduce
                        </SelectItem>
                        <SelectItem value="debit">
                          Debit note — increase
                        </SelectItem>
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
                name="linkedInvoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Document</FormLabel>
                    <Select
                      value={field.value || NONE_INVOICE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE_INVOICE ? "" : v)
                      }
                      disabled={!entityIdWatch}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_INVOICE}>None</SelectItem>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoiceNo} — {inv.counterparty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Reason: preset list + free-text "Other". */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select
                    value={
                      reasonMode === OTHER_REASON
                        ? OTHER_REASON
                        : (field.value ?? "")
                    }
                    onValueChange={(v) => {
                      setReasonMode(v);
                      field.onChange(v === OTHER_REASON ? "" : v);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASON_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_REASON}>Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {reasonMode === OTHER_REASON ? (
                    <Input
                      placeholder="Specify the reason"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

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
                              <Input
                                placeholder="Line description"
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

            {/* ── Live totals preview ──────────────────────────── */}
            <div
              className={`
                border-border bg-surface-secondary flex flex-col gap-1.5
                rounded-lg border p-3 text-sm
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{fmt(subtotal)} THB</span>
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
                <span className="tabular-nums">{fmt(grandTotal)} THB</span>
              </div>
            </div>

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
            form="credit-note-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
