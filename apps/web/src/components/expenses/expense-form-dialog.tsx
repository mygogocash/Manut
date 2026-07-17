"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { trackExpenseCancelled, trackExpenseStarted } from "@/lib/events";
import type { Entity } from "@/services/entity.service";
import { createExpense } from "@/services/expense.service";
import {
  listTravelRequests,
  type TravelRequest,
} from "@/services/travel.service";

const NO_TRIP_VALUE = "__none__";

const CURRENCIES = ["AED", "USD", "EUR", "GBP"] as const;

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  travelRequestId: z.string().optional(),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.coerce
    .number<number | string>()
    .positive("Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  receiptUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

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

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      travelRequestId: "",
      description: "",
      amount: 0,
      currency: "AED",
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
        currency: "AED",
        date: "",
        receiptUrl: "",
        notes: "",
      });
    }
  }, [open, form]);

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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
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

            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
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
          <Button
            type="submit"
            form="expense-form"
            disabled={submitting}
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
