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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  updateLeaveBalance,
  upsertLeaveBalance,
} from "@/services/leave.service";

const formSchema = z.object({
  entitled: z.coerce.number<number | string>().multipleOf(0.5).min(0),
  used: z.coerce.number<number | string>().multipleOf(0.5).min(0),
  carried: z.coerce.number<number | string>().multipleOf(0.5).min(0),
  carriedUsed: z.coerce.number<number | string>().multipleOf(0.5).min(0),
  carriedExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .optional()
    .or(z.literal("")),
  adjustment: z.coerce.number<number | string>().multipleOf(0.5),
  reason: z.string().max(500).optional(),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export interface LeaveBalanceEditTarget {
  /**
   * Real LeaveBalance id, or null when the row is synthesized from
   * policy default and hasn't been persisted yet. Synthesized rows
   * commit via the upsert endpoint, keyed on the composite below.
   */
  id: string | null;
  employeeId: string;
  leaveTypeId: string;
  employeeName: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  used: number;
  carried: number;
  carriedUsed: number;
  /** YYYY-MM-DD or null. */
  carriedExpiry: string | null;
  adjustment: number;
}

interface LeaveBalanceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: LeaveBalanceEditTarget | null;
  onSuccess: () => void;
}

const NUMERIC_FIELDS = [
  "entitled",
  "used",
  "carried",
  "carriedUsed",
  "adjustment",
] as const;
const NUMERIC_FIELD_LABELS: Record<(typeof NUMERIC_FIELDS)[number], string> = {
  entitled: "Entitled",
  used: "Used",
  carried: "Carried",
  carriedUsed: "Carried Used",
  adjustment: "Adjustment",
};

export function LeaveBalanceEditDialog({
  open,
  onOpenChange,
  balance,
  onSuccess,
}: LeaveBalanceEditDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      entitled: 0,
      used: 0,
      carried: 0,
      carriedUsed: 0,
      carriedExpiry: "",
      adjustment: 0,
      reason: "",
    },
  });

  useEffect(() => {
    if (open && balance) {
      form.reset({
        entitled: balance.entitled,
        used: balance.used,
        carried: balance.carried,
        carriedUsed: balance.carriedUsed,
        carriedExpiry: balance.carriedExpiry ?? "",
        adjustment: balance.adjustment,
        reason: "",
      });
    }
  }, [open, balance, form]);

  async function onSubmit(values: FormValues) {
    if (!balance) return;
    // Both validation schemas reject reason="" (`.min(1).optional()`),
    // so collapse the textarea's empty default to undefined before
    // shipping. Otherwise the request 400s with a generic
    // "Validation failed" toast.
    const reason = values.reason?.trim() || undefined;
    const carriedExpiry =
      values.carriedExpiry && values.carriedExpiry.trim() !== ""
        ? values.carriedExpiry
        : null;
    try {
      setSubmitting(true);
      if (balance.id) {
        await updateLeaveBalance(balance.id, {
          entitled: values.entitled,
          used: values.used,
          carried: values.carried,
          carriedUsed: values.carriedUsed,
          carriedExpiry,
          adjustment: values.adjustment,
          reason,
        });
      } else {
        await upsertLeaveBalance({
          employeeId: balance.employeeId,
          leaveTypeId: balance.leaveTypeId,
          year: balance.year,
          entitled: values.entitled,
          used: values.used,
          carried: values.carried,
          carriedUsed: values.carriedUsed,
          carriedExpiry,
          adjustment: values.adjustment,
          reason,
        });
      }
      toast.success(balance.id ? "Balance updated" : "Balance created");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update balance";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit leave balance</DialogTitle>
          <DialogDescription>
            {balance
              ? `${balance.employeeName} — ${balance.leaveTypeName} (${balance.year})`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div
              className={`
                grid grid-cols-1 gap-3
                sm:grid-cols-2
              `}
            >
              {NUMERIC_FIELDS.map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{NUMERIC_FIELD_LABELS[name]}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="carriedExpiry"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Carried expires on (optional)</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Pick the last day employees can use this carried balance"
                      />
                    </FormControl>
                    <FormDescription>
                      After this date the carried bucket can no longer be used
                      for new leave requests. Leave empty to allow it
                      indefinitely.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormDescription>Logged in the audit trail.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-24">
                {submitting && (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
