"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { MonthYearPicker } from "@/components/shared/month-year-picker";
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
import { ApiError } from "@/lib/api-client";
import type { Entity } from "@/services/entity.service";
import { createConsultantInvoice } from "@/services/payroll.service";
import type { UserListItem } from "@/services/user.service";

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  consultantId: z.string().min(1, "Consultant is required"),
  invoiceNo: z.string().min(1, "Invoice number is required"),
  amount: z.coerce
    .number<number | string>()
    .positive("Amount must be positive"),
  whtRate: z.coerce.number<number | string>().min(0).max(100),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format"),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function getCurrentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface ConsultantInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  consultants: UserListItem[];
  onSaved: () => void;
}

export function ConsultantInvoiceDialog({
  open,
  onOpenChange,
  entities,
  consultants,
  onSaved,
}: ConsultantInvoiceDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      consultantId: "",
      invoiceNo: "",
      amount: 0,
      whtRate: 0,
      period: getCurrentPeriod(),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        consultantId: "",
        invoiceNo: "",
        amount: 0,
        whtRate: 0,
        period: getCurrentPeriod(),
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      await createConsultantInvoice(values);
      toast.success("Consultant invoice created");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Consultant Invoice</DialogTitle>
          <DialogDescription>
            Record a consultant invoice for withholding tax processing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="consultant-invoice-form"
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
                name="consultantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultant *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select consultant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {consultants.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
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
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period *</FormLabel>
                    <FormControl>
                      <MonthYearPicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select period"
                      />
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
                name="whtRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WHT Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
            form="consultant-invoice-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Add Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
