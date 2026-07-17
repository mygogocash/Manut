"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  ATTENDANCE_WORK_MODE_LABELS,
  ATTENDANCE_WORK_MODES,
} from "@/services/attendance.service";
import {
  ATTENDANCE_CORRECTION_TYPES,
  createAttendanceCorrection,
} from "@/services/attendance-phase2.service";

const schema = z.object({
  attendanceDate: z.string().min(1, "Date is required"),
  correctionType: z.enum(ATTENDANCE_CORRECTION_TYPES),
  reason: z.string().min(1, "Reason is required").max(500),
  comments: z.string().max(2000).optional(),
  proposedCheckIn: z.string().optional(),
  proposedCheckOut: z.string().optional(),
  proposedWorkMode: z.enum(ATTENDANCE_WORK_MODES).optional(),
});

type FormValues = z.infer<typeof schema>;

export function AttendanceCorrectionDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      attendanceDate: defaultDate ?? new Date().toISOString().slice(0, 10),
      correctionType: "full_day",
      reason: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        attendanceDate: defaultDate ?? new Date().toISOString().slice(0, 10),
        correctionType: "full_day",
        reason: "",
        comments: "",
      });
    }
  }, [open, defaultDate, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      await createAttendanceCorrection({
        attendanceDate: values.attendanceDate,
        correctionType: values.correctionType,
        reason: values.reason,
        comments: values.comments,
        proposedCheckIn: values.proposedCheckIn
          ? new Date(values.proposedCheckIn).toISOString()
          : undefined,
        proposedCheckOut: values.proposedCheckOut
          ? new Date(values.proposedCheckOut).toISOString()
          : undefined,
        proposedWorkMode: values.proposedWorkMode,
      });
      toast.success("Correction request submitted");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit correction",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const correctionType = form.watch("correctionType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Attendance Correction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="attendanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="correctionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correction Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ATTENDANCE_CORRECTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(correctionType === "check_in" ||
              correctionType === "full_day") && (
              <FormField
                control={form.control}
                name="proposedCheckIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposed Check-In</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(correctionType === "check_out" ||
              correctionType === "full_day") && (
              <FormField
                control={form.control}
                name="proposedCheckOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposed Check-Out</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {correctionType === "work_mode" && (
              <FormField
                control={form.control}
                name="proposedWorkMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ATTENDANCE_WORK_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {ATTENDANCE_WORK_MODE_LABELS[m]}
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Why is this correction needed?"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
