"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  ESOP_STATUS_VALUES,
  ESOP_STATUSES,
  type EsopStatus,
} from "@/components/hrms/hrms-constants";
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
  createEsopGrant,
  ESOP_ALLOCATION_MODES,
  ESOP_CURRENCIES,
  ESOP_GRANT_TYPE_LABELS,
  ESOP_GRANT_TYPES,
  ESOP_VALUE_TYPES,
  type EsopGrant,
  updateEsopGrant,
} from "@/services/hrms.service";
import { listUsers, type UserListItem } from "@/services/user.service";

const VALUE_TYPE_LABELS: Record<(typeof ESOP_VALUE_TYPES)[number], string> = {
  shares: "Shares",
  currency: "Currency amount",
  percent: "% of base pay",
};

const ALLOCATION_MODE_LABELS: Record<
  (typeof ESOP_ALLOCATION_MODES)[number],
  string
> = {
  one_time: "One-time grant",
  monthly_recurring: "Monthly recurring",
};

const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a month")
  .or(z.literal(""));

// Client mirror of the server vesting math (esop-vesting.ts), used ONLY
// for the live "Total Vesting to date" preview. The saved + listed value
// is always recomputed server-side, so this never becomes a source of
// truth — it just shows the admin what the auto figure will be.
function monthsBetweenInclusive(start: Date, end: Date): number {
  const diff =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return diff <= 0 ? 0 : diff + 1;
}

function monthsElapsed(from: Date, to: Date): number {
  let m =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

function previewVestedToDate(
  shares: number,
  startStr: string,
  endStr: string,
  cliff: number,
): number | null {
  if (!shares || !startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const vm = monthsBetweenInclusive(start, end);
  if (vm <= 0) return shares;
  const elapsed = monthsElapsed(start, new Date());
  if (elapsed < cliff) return 0;
  return Math.ceil(shares * (Math.min(elapsed, vm) / vm));
}

function toEditableEsopStatus(status: string): EsopStatus {
  if (status === "vesting" || status === "vested" || status === "cancelled") {
    return status;
  }
  if (status === "exercised") return "vested";
  return "vesting";
}

const schema = z
  .object({
    employeeId: z.string().uuid("Select an employee"),
    grantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a grant date"),
    grantType: z.enum(ESOP_GRANT_TYPES),
    source: z.string().max(200).optional().or(z.literal("")),
    valueType: z.enum(ESOP_VALUE_TYPES),
    shares: z.coerce.number<number | string>().int().nonnegative(),
    currencyCode: z.enum(ESOP_CURRENCIES).optional(),
    currencyAmount: z.coerce.number<number | string>().nonnegative().optional(),
    percentOfBase: z.coerce
      .number<number | string>()
      .min(0)
      .max(100)
      .optional(),
    allocationMode: z.enum(ESOP_ALLOCATION_MODES),
    monthlyAmount: z.coerce.number<number | string>().nonnegative().optional(),
    allocationStartMonth: monthString.optional(),
    allocationEndMonth: monthString.optional(),
    // UI-only: how a one-time grant vests. "outright" = fully vested now
    // (months → 0); "schedule" = derive months from Start/End. Not sent to
    // the API directly — onSubmit translates it into dates + months.
    // No .default() here on purpose: a zod default makes the schema's input
    // type (optional) diverge from its output type (required), which breaks
    // zodResolver's Control<> generics under the pinned react-hook-form.
    // DEFAULTS + the edit-mode reset supply the value instead.
    vestingType: z.enum(["outright", "schedule"]),
    // Kept for the monthly_recurring path; the one-time schedule derives
    // its months from Start/End server-side. nonnegative so 0 is allowed.
    vestingMonths: z.coerce
      .number<number | string>()
      .int()
      .nonnegative()
      .optional()
      .nullable(),
    cliffMonths: z.coerce
      .number<number | string>()
      .int()
      .nonnegative()
      .optional()
      .nullable(),
    lockMonths: z.coerce
      .number<number | string>()
      .int()
      .nonnegative()
      .optional()
      .nullable(),
    // Optional manual "Total Vesting to date". Blank → auto-computed.
    vestedToDateOverride: z.coerce
      .number<number | string>()
      .int()
      .nonnegative()
      .optional()
      .nullable(),
    strikePrice: z.coerce.number<number | string>().nonnegative(),
    status: z.enum(ESOP_STATUS_VALUES),
    exercisedShares: z.coerce
      .number<number | string>()
      .int()
      .nonnegative()
      .optional(),
    notes: z.string().max(5000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.valueType === "shares" && v.shares <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shares"],
        message: "Shares must be greater than 0",
      });
    }
    if (v.valueType === "currency") {
      if (!v.currencyCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currencyCode"],
          message: "Pick a currency",
        });
      }
      if (!v.currencyAmount || v.currencyAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currencyAmount"],
          message: "Amount must be greater than 0",
        });
      }
    }
    if (
      v.valueType === "percent" &&
      (!v.percentOfBase || v.percentOfBase <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentOfBase"],
        message: "Percent must be greater than 0",
      });
    }
    if (v.allocationMode === "monthly_recurring") {
      if (!v.allocationStartMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationStartMonth"],
          message: "Pick a start month",
        });
      }
      if (!v.allocationEndMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationEndMonth"],
          message: "Pick an end month",
        });
      }
      if (
        v.allocationStartMonth &&
        v.allocationEndMonth &&
        v.allocationEndMonth < v.allocationStartMonth
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationEndMonth"],
          message: "End month must not be before start month",
        });
      }
    }
    if (v.allocationMode === "one_time" && v.vestingType === "schedule") {
      if (!v.allocationStartMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationStartMonth"],
          message: "Pick a start date",
        });
      }
      if (!v.allocationEndMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationEndMonth"],
          message: "Pick an end date",
        });
      }
      if (
        v.allocationStartMonth &&
        v.allocationEndMonth &&
        v.allocationEndMonth < v.allocationStartMonth
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationEndMonth"],
          message: "End date must not be before start date",
        });
      }
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface EsopGrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant?: EsopGrant | null;
  onSaved: () => void;
}

const DEFAULTS: FormValues = {
  employeeId: "",
  grantDate: "",
  grantType: "equity",
  source: "",
  valueType: "shares",
  shares: 0,
  currencyCode: undefined,
  currencyAmount: undefined,
  percentOfBase: undefined,
  allocationMode: "one_time",
  monthlyAmount: undefined,
  allocationStartMonth: "",
  allocationEndMonth: "",
  vestingType: "schedule",
  vestingMonths: 48,
  cliffMonths: 12,
  lockMonths: 0,
  vestedToDateOverride: undefined,
  strikePrice: 0,
  status: "vesting",
  exercisedShares: 0,
  notes: "",
};

export function EsopGrantDialog({
  open,
  onOpenChange,
  grant,
  onSaved,
}: EsopGrantDialogProps) {
  const isEditing = !!grant;
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: DEFAULTS,
  });

  const valueType = form.watch("valueType");
  const allocationMode = form.watch("allocationMode");
  const vestingType = form.watch("vestingType");
  const watchShares = form.watch("shares");
  const watchStart = form.watch("allocationStartMonth");
  const watchEnd = form.watch("allocationEndMonth");
  const watchCliff = form.watch("cliffMonths");

  // Live auto figure for the schedule case, shown beside the override input.
  const vestedPreview =
    allocationMode === "one_time" && vestingType === "schedule"
      ? previewVestedToDate(
          Number(watchShares) || 0,
          watchStart || "",
          watchEnd || "",
          Number(watchCliff) || 0,
        )
      : null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        setEmployeesLoading(true);
        const res = await listUsers({ limit: 200, isActive: true });
        if (!cancelled) setEmployees(res.data);
      } catch {
        if (!cancelled) toast.error("Failed to load employees");
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (grant) {
      form.reset({
        employeeId: grant.employee.id,
        grantDate: grant.grantDate.slice(0, 10),
        grantType: grant.grantType,
        source: grant.source ?? "",
        valueType: grant.valueType,
        shares: grant.shares,
        currencyCode: grant.currencyCode ?? undefined,
        currencyAmount: grant.currencyAmount ?? undefined,
        percentOfBase: grant.percentOfBase ?? undefined,
        allocationMode: grant.allocationMode,
        monthlyAmount: grant.monthlyAmount ?? undefined,
        allocationStartMonth: grant.allocationStartMonth?.slice(0, 10) ?? "",
        allocationEndMonth: grant.allocationEndMonth?.slice(0, 10) ?? "",
        vestingType:
          grant.vestingMonths && grant.vestingMonths > 0
            ? "schedule"
            : "outright",
        vestingMonths: grant.vestingMonths ?? undefined,
        cliffMonths: grant.cliffMonths ?? undefined,
        lockMonths: grant.lockMonths ?? undefined,
        vestedToDateOverride: grant.vestedToDateOverride ?? undefined,
        strikePrice: grant.strikePrice,
        status: toEditableEsopStatus(grant.status),
        exercisedShares: grant.exercisedShares,
        notes: grant.notes ?? "",
      });
    } else {
      form.reset(DEFAULTS);
    }
  }, [open, grant, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const isRecurring = values.allocationMode === "monthly_recurring";
      const isSchedule = !isRecurring && values.vestingType === "schedule";
      const isOutright = !isRecurring && values.vestingType === "outright";
      const payload = {
        employeeId: values.employeeId,
        grantDate: values.grantDate,
        grantType: values.grantType,
        valueType: values.valueType,
        shares: values.valueType === "shares" ? values.shares : 0,
        currencyCode:
          values.valueType === "currency" ? values.currencyCode : null,
        currencyAmount:
          values.valueType === "currency" ? (values.currencyAmount ?? 0) : null,
        percentOfBase:
          values.valueType === "percent" ? (values.percentOfBase ?? 0) : null,
        allocationMode: values.allocationMode,
        monthlyAmount: isRecurring ? (values.monthlyAmount ?? null) : null,
        // one-time schedule: Start/End are the vesting window. one-time
        // outright: mirror the single vest date into both so the server
        // derives 0 months. recurring: the recurring allocation window.
        allocationStartMonth: values.allocationStartMonth || null,
        allocationEndMonth: isOutright
          ? values.allocationStartMonth || null
          : values.allocationEndMonth || null,
        // Outright → 0 (lands in Vested pool). Schedule → null so the
        // server derives months from Start/End. Recurring → explicit count.
        vestingMonths: isRecurring
          ? (values.vestingMonths ?? null)
          : isOutright
            ? 0
            : null,
        cliffMonths: values.cliffMonths ?? null,
        lockMonths: values.lockMonths ?? null,
        // Manual "Total Vesting to date" only applies to a schedule; blank
        // (null) means auto-compute on the server.
        vestedToDateOverride: isSchedule
          ? (values.vestedToDateOverride ?? null)
          : null,
        strikePrice: values.strikePrice,
        source: values.source?.trim() || undefined,
        status: values.status,
        notes: values.notes?.trim() || undefined,
      };

      if (isEditing) {
        await updateEsopGrant(grant.id, {
          ...payload,
          exercisedShares: values.exercisedShares,
        });
        toast.success("ESOP grant updated");
      } else {
        await createEsopGrant(payload);
        toast.success("ESOP grant created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
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
          <DialogTitle>
            {isEditing ? "Edit ESOP grant" : "Create ESOP grant"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update grant for ${grant.employee.name}.`
              : "Issue a new ESOP grant aligned with the import format."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="esop-grant-form"
          >
            <SectionHeading>Recipient & source</SectionHeading>
            <div
              className={`
                grid gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEditing || employeesLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              employeesLoading ? "Loading…" : "Select employee"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                            {u.jobTitle ? (
                              <span
                                className={`text-muted-foreground ml-1 text-xs`}
                              >
                                · {u.jobTitle}
                              </span>
                            ) : null}
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
                name="grantType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grant type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ESOP_GRANT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ESOP_GRANT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className={`
                grid gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="grantDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grant date *</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Employment contract 2024"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Where this grant came from (contract, annual review, bonus
                      letter…).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SectionHeading>Grant value</SectionHeading>
            <FormField
              control={form.control}
              name="valueType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ESOP_VALUE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {VALUE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {valueType === "shares" && (
              <FormField
                control={form.control}
                name="shares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shares *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {valueType === "currency" && (
              <div
                className={`
                  grid gap-3
                  sm:grid-cols-[160px_1fr]
                `}
              >
                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) =>
                          field.onChange(v as (typeof ESOP_CURRENCIES)[number])
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESOP_CURRENCIES.map((c) => (
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
                <FormField
                  control={form.control}
                  name="currencyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="197000"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {valueType === "percent" && (
              <FormField
                control={form.control}
                name="percentOfBase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percent of base pay *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="10"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Used for annual review uplifts (e.g. 10% of annual base
                      pay).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <SectionHeading>Allocation schedule</SectionHeading>
            <FormField
              control={form.control}
              name="allocationMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allocation mode *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ESOP_ALLOCATION_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {ALLOCATION_MODE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose monthly recurring for recurring grants (e.g. THB
                    197,000 every month from Jun-Dec 2024).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {allocationMode === "monthly_recurring" && (
              <div
                className={`
                  grid gap-3
                  sm:grid-cols-3
                `}
              >
                <FormField
                  control={form.control}
                  name="allocationStartMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start month *</FormLabel>
                      <FormControl>
                        <FormDatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allocationEndMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End month *</FormLabel>
                      <FormControl>
                        <FormDatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthlyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Optional override"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <SectionHeading>Vesting & exercise</SectionHeading>

            {allocationMode === "one_time" && (
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="vestingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How does this vest? *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="outright">
                            Granted outright (fully vested)
                          </SelectItem>
                          <SelectItem value="schedule">
                            Vesting over a schedule
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Outright lands in the Vested pool immediately. A
                        schedule vests month by month between Start and End.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {vestingType === "outright" && (
                  <FormField
                    control={form.control}
                    name="allocationStartMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vest date</FormLabel>
                        <FormControl>
                          <FormDatePicker {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional — when these shares vested. Leave blank if it
                          isn&apos;t tracked; the grant still counts as fully
                          vested.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {vestingType === "schedule" && (
                  <>
                    <div
                      className={`
                        grid gap-3
                        sm:grid-cols-2
                      `}
                    >
                      <FormField
                        control={form.control}
                        name="allocationStartMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start *</FormLabel>
                            <FormControl>
                              <FormDatePicker {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allocationEndMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End *</FormLabel>
                            <FormControl>
                              <FormDatePicker {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div
                      className={`
                        grid gap-3
                        sm:grid-cols-2
                      `}
                    >
                      <FormField
                        control={form.control}
                        name="cliffMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliff (months)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lockMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lock (months)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="vestedToDateOverride"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Vesting to date</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              placeholder={
                                vestedPreview != null
                                  ? `Auto: ${vestedPreview.toLocaleString()}`
                                  : "Auto-calculated"
                              }
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            {vestedPreview != null
                              ? `Auto-calculates to ${vestedPreview.toLocaleString()} as of today. Leave blank to use it, or type a number to override.`
                              : "Set Start and End to auto-calculate. Leave blank to use the auto value, or type a number to override."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            )}

            {allocationMode === "monthly_recurring" && (
              <div
                className={`
                  grid gap-3
                  sm:grid-cols-3
                `}
              >
                <FormField
                  control={form.control}
                  name="vestingMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vesting (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cliffMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliff (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lockMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lock (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div
              className={`
                grid gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="strikePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strike price</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.01} min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ESOP_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditing && (
              <FormField
                control={form.control}
                name="exercisedShares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercised shares</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional notes…"
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
            form="esop-grant-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create grant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`
        text-muted-foreground -mb-2 text-[10px] font-bold tracking-wider
        uppercase
      `}
    >
      {children}
    </p>
  );
}
