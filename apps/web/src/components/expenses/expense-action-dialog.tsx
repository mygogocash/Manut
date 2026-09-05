"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  approveExpense,
  type Expense,
  rejectExpense,
} from "@/services/expense.service";

type ActionType = "approve" | "reject";

interface ExpenseActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
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
    title: "Approve Expense",
    description: "Are you sure you want to approve this expense?",
    buttonLabel: "Approve",
    variant: "default",
  },
  reject: {
    title: "Reject Expense",
    description: "Please provide a reason for rejecting this expense.",
    buttonLabel: "Reject",
    variant: "destructive",
  },
};

const actionSchema = z.object({
  reason: z.string(),
});

type RejectValues = z.infer<typeof actionSchema>;

export function ExpenseActionDialog({
  open,
  onOpenChange,
  expense,
  action,
  onComplete,
}: ExpenseActionDialogProps) {
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
    if (!expense) return;
    if (action === "reject" && !values.reason.trim()) {
      form.setError("reason", { message: "Please provide a reason" });
      return;
    }

    try {
      setLoading(true);
      if (action === "approve") {
        await approveExpense(expense.id);
        toast.success("Expense approved");
      } else {
        await rejectExpense(expense.id, values.reason.trim());
        toast.success("Expense rejected");
      }
      onComplete();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : `Failed to ${action} expense`;
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
            {expense && (
              <span className="mb-1 block">
                {expense.employee.name} &mdash; {expense.description} (
                {expense.currency} {expense.amount})
              </span>
            )}
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleConfirm)}
            id="expense-action-form"
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
            form="expense-action-form"
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
