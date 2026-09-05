"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  claimCurrencyOptions,
  defaultClaimCurrency,
} from "@/components/expenses/claim-currency";
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
import { trackExpenseCancelled, trackExpenseStarted } from "@/lib/events";
import type { Entity } from "@/services/entity.service";
import { createExpense } from "@/services/expense.service";
import {
  listTravelRequests,
  type TravelRequest,
} from "@/services/travel.service";
import { uploadFile } from "@/services/upload.service";

const NO_TRIP_VALUE = "__none__";

/** Uploads land in the same private bucket as the main Expenses module. */
const RECEIPT_ACCEPT = "image/*,application/pdf";

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  travelRequestId: z.string().optional(),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  receiptUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onCreated: () => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  entities,
  onCreated,
}: ExpenseFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [trips, setTrips] = useState<TravelRequest[]>([]);
  const submittedRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  // Once the submitter picks a currency themselves, stop following the entity.
  const currencyTouchedRef = useRef(false);

  useEffect(() => {
    if (open) {
      submittedRef.current = false;
      trackExpenseStarted();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listTravelRequests({ status: "approved", limit: 50 });
        if (!cancelled) setTrips(res.data);
      } catch {
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityId: "",
      travelRequestId: "",
      description: "",
      amount: 0,
      currency: defaultClaimCurrency(null),
      date: "",
      receiptUrl: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        description: "",
        amount: 0,
        currency: defaultClaimCurrency(null),
        date: "",
        receiptUrl: "",
        notes: "",
      });
      setReceiptName(null);
      currencyTouchedRef.current = false;
    }
  }, [open, form]);

  const entityId = form.watch("entityId");
  const entityCurrency =
    entities.find((e) => e.id === entityId)?.currency ?? null;
  const currencyOptions = useMemo(
    () => claimCurrencyOptions(entityCurrency),
    [entityCurrency],
  );

  // Follow the chosen entity until the submitter overrides it. Picking the
  // entity is usually the first thing they do, and a foreign currency left
  // sitting in the field is exactly how the old AED default went unnoticed.
  useEffect(() => {
    if (!open || currencyTouchedRef.current) return;
    form.setValue("currency", defaultClaimCurrency(entityCurrency));
  }, [open, entityCurrency, form]);

  async function handleReceiptPick(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, {
        bucket: "receipts",
        purpose: "expense-receipt",
      });
      form.setValue("receiptUrl", uploaded.url, { shouldValidate: true });
      setReceiptName(uploaded.originalName);
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt upload failed");
    } finally {
      setUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }

  function handleClearReceipt() {
    form.setValue("receiptUrl", "", { shouldValidate: true });
    setReceiptName(null);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      await createExpense({
        entityId: values.entityId,
        ...(values.travelRequestId &&
          values.travelRequestId !== NO_TRIP_VALUE && {
            travelRequestId: values.travelRequestId,
          }),
        description: values.description,
        amount: values.amount,
        currency: values.currency,
        date: values.date,
        receiptUrl: values.receiptUrl || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Expense submitted");
      submittedRef.current = true;
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to submit expense";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next && !submittedRef.current) {
          trackExpenseCancelled();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Expense</DialogTitle>
          <DialogDescription>
            Submit a new expense for reimbursement.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="expense-form"
          >
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
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {trips.length > 0 && (
              <FormField
                control={form.control}
                name="travelRequestId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to trip (optional)</FormLabel>
                    <Select
                      value={field.value || NO_TRIP_VALUE}
                      onValueChange={(v) =>
                        field.onChange(v === NO_TRIP_VALUE ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No trip" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_TRIP_VALUE}>No trip</SelectItem>
                        {trips.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.requestCode} — {t.destination} ({t.departureDate}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Client dinner, Office supplies"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid grid-cols-1 gap-3
                sm:grid-cols-2
              `}
            >
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
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        currencyTouchedRef.current = true;
                        field.onChange(v);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencyOptions.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} — {c.name}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <FormDatePicker {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/*
              A file picker, not a URL box. This field used to be a plain
              `type="url"` input, so attaching a receipt meant hosting it
              somewhere else first and pasting a link — which most submitters
              read, correctly, as "there is no way to attach anything". The
              upload path is the one the main Expenses module already uses:
              same private `receipts` bucket, same purpose tag.
            */}
            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt</FormLabel>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept={RECEIPT_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleReceiptPick(f);
                    }}
                  />
                  {field.value ? (
                    <div
                      className={`
                        border-border bg-card flex items-center justify-between
                        gap-2 rounded-md border p-2.5 text-sm
                      `}
                    >
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          text-primary inline-flex min-w-0 items-center gap-1
                          truncate
                          hover:underline
                        `}
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {receiptName ?? "Receipt"}
                        </span>
                      </a>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => receiptInputRef.current?.click()}
                          disabled={uploading || submitting}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearReceipt}
                          disabled={uploading || submitting}
                          aria-label="Remove receipt"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => receiptInputRef.current?.click()}
                      disabled={uploading || submitting}
                      className="w-full justify-start"
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 size-4" />
                      )}
                      {uploading ? "Uploading…" : "Attach receipt"}
                    </Button>
                  )}
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
                      rows={3}
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
          {/* Submitting mid-upload would file the claim without its receipt. */}
          <Button
            type="submit"
            form="expense-form"
            disabled={submitting || uploading}
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
