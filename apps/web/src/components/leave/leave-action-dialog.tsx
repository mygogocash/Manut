"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { formatLeaveDateRange } from "@/components/leave/leave-duration";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  type LeaveRequest,
  rejectLeaveRequest,
} from "@/services/leave.service";

type ActionType = "approve" | "reject" | "cancel";

interface LeaveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest | null;
  action: ActionType;
  onComplete: () => void;
}

const ACTION_CONFIG: Record<
  ActionType,
  {
    title: string;
    description: string;
    buttonLabel: string;
    variant: "default" | "destructive";
  }
> = {
  approve: {
    title: "Approve Leave Request",
    description: "Are you sure you want to approve this leave request?",
    buttonLabel: "Approve",
    variant: "default",
  },
  reject: {
    title: "Reject Leave Request",
    description: "Please provide a reason for rejecting this leave request.",
    buttonLabel: "Reject",
    variant: "destructive",
  },
  cancel: {
    title: "Cancel Leave Request",
    description: "Are you sure you want to cancel this leave request?",
    buttonLabel: "Cancel Request",
    variant: "destructive",
  },
};

const actionSchema = z.object({
  reason: z.string(),
});

type RejectValues = z.infer<typeof actionSchema>;

export function LeaveActionDialog({
  open,
  onOpenChange,
  request,
  action,
  onComplete,
}: LeaveActionDialogProps) {
  const [loading, setLoading] = useState(false);

  const config = ACTION_CONFIG[action];

  const form = useForm<RejectValues>({
    resolver: zodResolver(actionSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ reason: "" });
    }
  }, [open, form]);

  async function handleConfirm(values: RejectValues) {
    if (!request) return;
    if (action === "reject" && !values.reason.trim()) {
      form.setError("reason", { message: "Please provide a reason" });
      return;
    }

    try {
      setLoading(true);
      if (action === "approve") {
        await approveLeaveRequest(request.id);
        toast.success("Leave request approved");
      } else if (action === "reject") {
        await rejectLeaveRequest(request.id, values.reason.trim());
        toast.success("Leave request rejected");
      } else {
        await cancelLeaveRequest(request.id);
        toast.success("Leave request cancelled");
      }
      onComplete();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : `Failed to ${action} request`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) {
          onOpenChange(next);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {request && (
              <span className="mb-1 block">
                {request.employee.name} &mdash; {request.leaveType.name} (
                {formatLeaveDateRange(request)})
              </span>
            )}
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleConfirm)}
            id="leave-action-form"
          >
            {action === "reject" && (
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Reason for rejection"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Close</AlertDialogCancel>
          <Button
            type="submit"
            form="leave-action-form"
            variant={config.variant}
            disabled={loading}
            className="min-w-28"
          >
            {loading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {config.buttonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
