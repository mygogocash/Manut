"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createPayrollApprovalStep,
  type PayrollApprovalStep,
  updatePayrollApprovalStep,
} from "@/services/payroll-approval.service";
import type { UserListItem } from "@/services/user.service";

const stepSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(2000).optional(),
  approverUserId: z.string().uuid("Pick an approver"),
  isActive: z.boolean(),
});

type StepFormValues = z.infer<typeof stepSchema>;

interface PayrollApprovalStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: PayrollApprovalStep | null;
  users: UserListItem[];
  onSaved: () => void;
}

export function PayrollApprovalStepDialog({
  open,
  onOpenChange,
  step,
  users,
  onSaved,
}: PayrollApprovalStepDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(step);

  const form = useForm<StepFormValues>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      name: "",
      description: "",
      approverUserId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      step
        ? {
            name: step.name,
            description: step.description ?? "",
            approverUserId: step.approverUserId,
            isActive: step.isActive,
          }
        : {
            name: "",
            description: "",
            approverUserId: "",
            isActive: true,
          },
    );
  }, [open, step, form]);

  async function onSubmit(values: StepFormValues) {
    try {
      setSubmitting(true);
      const payload = {
        ...values,
        description: values.description?.trim() || undefined,
      };
      if (step) {
        await updatePayrollApprovalStep(step.id, payload);
        toast.success(`Step "${payload.name}" updated`);
      } else {
        await createPayrollApprovalStep(payload);
        toast.success(`Step "${payload.name}" created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save step";
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
          <DialogTitle>
            {editing ? "Edit approval step" : "Add approval step"}
          </DialogTitle>
          <DialogDescription>
            Each step represents one approver on the payroll chain. Stages run
            in the order shown on the chain editor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="payroll-approval-step-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="CFO sign-off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="What this approver checks for."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="approverUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approver</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} — {u.email}
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
              name="isActive"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex items-center justify-between rounded-md border p-4
                  `}
                >
                  <div>
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive steps stay in the chain config but are skipped on
                      new payroll runs.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="payroll-approval-step-form"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
