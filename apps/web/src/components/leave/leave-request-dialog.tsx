"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  HALF_DAY_PERIOD_OPTIONS,
  LEAVE_DURATION_OPTIONS,
} from "@/components/leave/leave-duration";
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
  trackLeaveRequestCancelled,
  trackLeaveRequestStarted,
} from "@/lib/events";
import {
  createLeaveRequest,
  type LeaveBalance,
  type LeaveType,
} from "@/services/leave.service";

const ALL_EMPLOYEES = "__all__" as const;

function buildSchema(mode: "self" | "hr-on-behalf") {
  const base = z
    .object({
      leaveTypeId: z.string().min(1, "Leave type is required"),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
      durationType: z.enum(["full_day", "half_day"]),
      halfDayPeriod: z.enum(["am", "pm"]).optional(),
      reason: z.string().max(1000).optional(),
      source: z.enum(["entitled", "carried"]),
      employeeId: z.string().optional(),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: "End date must not be before start date",
      path: ["endDate"],
    })
    .refine(
      (data) =>
        data.durationType !== "half_day" || data.startDate === data.endDate,
      {
        message: "Half-day leave uses a single date",
        path: ["endDate"],
      },
    )
    .refine(
      (data) =>
        data.durationType !== "half_day" ||
        data.halfDayPeriod === "am" ||
        data.halfDayPeriod === "pm",
      {
        message: "Select A.M. or P.M.",
        path: ["halfDayPeriod"],
      },
    );

  if (mode === "hr-on-behalf") {
    return base.refine(
      (data) => Boolean(data.employeeId && data.employeeId !== ALL_EMPLOYEES),
      { message: "Employee is required", path: ["employeeId"] },
    );
  }

  return base;
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export interface LeaveRequestEmployeeOption {
  id: string;
  name: string;
  email: string;
}

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTypes: LeaveType[];
  onCreated: () => void;
  /** Self-service (My Portal) vs HR creating for someone else (Leave Management). */
  mode?: "self" | "hr-on-behalf";
  employeeOptions?: LeaveRequestEmployeeOption[];
  /** Preselect leave type when opening from a per-policy Apply button. */
  defaultLeaveTypeId?: string;
  /**
   * The actor's balances for the active year. Used to show the bucket
   * picker (Entitled / Carried) when the selected leave type has a
   * non-expired carried remainder.
   */
  balances?: LeaveBalance[];
}

export function LeaveRequestDialog({
  open,
  onOpenChange,
  leaveTypes,
  onCreated,
  mode = "self",
  employeeOptions = [],
  defaultLeaveTypeId,
  balances = [],
}: LeaveRequestDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const schema = useMemo(() => buildSchema(mode), [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leaveTypeId: defaultLeaveTypeId ?? "",
      startDate: "",
      endDate: "",
      durationType: "full_day",
      halfDayPeriod: "am",
      reason: "",
      source: "entitled",
      employeeId: mode === "hr-on-behalf" ? ALL_EMPLOYEES : undefined,
    },
  });

  const startDateWatch = form.watch("startDate");
  const endDateWatch = form.watch("endDate");
  const durationTypeWatch = form.watch("durationType");
  const leaveTypeWatch = form.watch("leaveTypeId");
  const isHalfDay = durationTypeWatch === "half_day";
  const activeBalance = useMemo(
    () => balances.find((b) => b.leaveType.id === leaveTypeWatch),
    [balances, leaveTypeWatch],
  );
  const carriedAvailable =
    !!activeBalance &&
    activeBalance.carriedRemaining > 0 &&
    !activeBalance.carriedExpired;

  useEffect(() => {
    if (open) {
      submittedRef.current = false;
      trackLeaveRequestStarted();
      form.reset({
        leaveTypeId: defaultLeaveTypeId ?? "",
        startDate: "",
        endDate: "",
        durationType: "full_day",
        halfDayPeriod: "am",
        reason: "",
        source: "entitled",
        employeeId: mode === "hr-on-behalf" ? ALL_EMPLOYEES : undefined,
      });
    }
  }, [open, form, mode, defaultLeaveTypeId]);

  useEffect(() => {
    if (!isHalfDay) return;
    const start = form.getValues("startDate");
    if (start) form.setValue("endDate", start);
  }, [isHalfDay, startDateWatch, form]);

  // Swap source back to entitled if the leave type changes and the new
  // selection has no carried bucket to draw from — otherwise the API
  // 400s on submit.
  useEffect(() => {
    if (!carriedAvailable && form.getValues("source") === "carried") {
      form.setValue("source", "entitled");
    }
  }, [carriedAvailable, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const employeeId =
        mode === "hr-on-behalf" &&
        values.employeeId &&
        values.employeeId !== ALL_EMPLOYEES
          ? values.employeeId
          : undefined;

      const endDate =
        values.durationType === "half_day" ? values.startDate : values.endDate;

      await createLeaveRequest({
        leaveTypeId: values.leaveTypeId,
        startDate: values.startDate,
        endDate,
        durationType: values.durationType,
        ...(values.durationType === "half_day" && values.halfDayPeriod
          ? { halfDayPeriod: values.halfDayPeriod }
          : {}),
        reason: values.reason || undefined,
        source: values.source,
        ...(employeeId ? { employeeId } : {}),
      });
      toast.success(
        mode === "hr-on-behalf"
          ? "Leave request created for employee"
          : "Leave request submitted",
      );
      submittedRef.current = true;
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to submit request";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const activeTypes = leaveTypes.filter((t) => t.isActive);
  const sortedEmployees = useMemo(
    () =>
      [...employeeOptions].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [employeeOptions],
  );

  const title =
    mode === "hr-on-behalf" ? "Create leave for employee" : "Request Leave";
  const description =
    mode === "hr-on-behalf"
      ? "Submit a leave request on behalf of a selected employee. They must have sufficient balance."
      : "Submit a new leave request for approval.";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next && !submittedRef.current) {
          trackLeaveRequestCancelled();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="leave-request-form"
          >
            {mode === "hr-on-behalf" && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select
                      value={field.value ?? ALL_EMPLOYEES}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ALL_EMPLOYEES}>
                          Select employee…
                        </SelectItem>
                        {sortedEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                            {e.email ? ` (${e.email})` : ""}
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
              name="leaveTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
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
              name="durationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_DURATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isHalfDay ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
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
                  name="halfDayPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period *</FormLabel>
                      <Select
                        value={field.value ?? "am"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HALF_DAY_PERIOD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date *</FormLabel>
                      <FormControl>
                        <FormDatePicker
                          {...field}
                          maxDate={endDateWatch || undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date *</FormLabel>
                      <FormControl>
                        <FormDatePicker
                          {...field}
                          minDate={startDateWatch || undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {carriedAvailable && (
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Use balance from *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entitled">
                          Entitled — {activeBalance?.remaining ?? 0} day
                          {activeBalance?.remaining === 1 ? "" : "s"} left
                        </SelectItem>
                        <SelectItem value="carried">
                          Carried — {activeBalance?.carriedRemaining ?? 0} day
                          {activeBalance?.carriedRemaining === 1
                            ? ""
                            : "s"}{" "}
                          left
                          {activeBalance?.carriedExpiry &&
                            ` (expires ${activeBalance.carriedExpiry
                              .split("-")
                              .reverse()
                              .join("/")})`}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional reason for this leave request"
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
            form="leave-request-form"
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
