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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import type { Entity } from "@/services/entity.service";
import { createPayrollRun } from "@/services/payroll.service";
import type { UserListItem } from "@/services/user.service";

const ALL_STAFF = "__all__" as const;

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format"),
  notes: z.string().max(2000).optional(),
  employeeScope: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

function getCurrentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface PayrollRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  /** Used to optionally limit the run to one full-time employee in the selected entity. */
  employees: UserListItem[];
  onSaved: () => void;
}

export function PayrollRunDialog({
  open,
  onOpenChange,
  entities,
  employees,
  onSaved,
}: PayrollRunDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      period: getCurrentPeriod(),
      notes: "",
      employeeScope: ALL_STAFF,
    },
  });

  const entityId = form.watch("entityId");

  const fullTimeInEntity = employees.filter(
    (u) =>
      u.entity?.id === entityId &&
      u.isActive &&
      u.employmentType === "full_time",
  );

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        period: getCurrentPeriod(),
        notes: "",
        employeeScope: ALL_STAFF,
      });
    }
  }, [open, form]);

  useEffect(() => {
    form.setValue("employeeScope", ALL_STAFF);
  }, [entityId, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const employeeId =
        values.employeeScope !== ALL_STAFF ? values.employeeScope : undefined;
      await createPayrollRun({
        entityId: values.entityId,
        period: values.period,
        notes: values.notes || undefined,
        ...(employeeId ? { employeeId } : {}),
      });
      toast.success("Payroll run created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create payroll run";
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
          <DialogTitle>Run Payroll</DialogTitle>
          <DialogDescription>
            Create a payroll run for the selected entity and period. You can
            include all active full-time staff or one employee.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="payroll-run-form"
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
              name="employeeScope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employees</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!entityId}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ALL_STAFF}>
                        All active full-time employees
                      </SelectItem>
                      {[...fullTimeInEntity]
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, undefined, {
                            sensitivity: "base",
                          }),
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes for this payroll run"
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
            form="payroll-run-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Run Payroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
