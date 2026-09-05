"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { UserMultiSelect } from "@/components/shared/user-multi-select";
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
  createLeaveApprovalStep,
  type LeaveApprovalStep,
  updateLeaveApprovalStep,
} from "@/services/leave.service";
import type { UserListItem } from "@/services/user.service";

const stepSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(2000).optional(),
    approverType: z.enum(["manager", "user"]),
    approverUserId: z.string().uuid().optional().nullable(),
    skipWhenSubmitterIds: z.array(z.string().uuid()),
    onlyWhenSubmitterIds: z.array(z.string().uuid()),
    isActive: z.boolean(),
  })
  .refine(
    (v) =>
      v.approverType !== "user" ||
      (v.approverUserId && v.approverUserId.length > 0),
    {
      message: "Pick an approver",
      path: ["approverUserId"],
    },
  );

type StepFormValues = z.infer<typeof stepSchema>;

interface LeaveApprovalStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: LeaveApprovalStep | null;
  users: UserListItem[];
  onSaved: () => void;
}

export function LeaveApprovalStepDialog({
  open,
  onOpenChange,
  step,
  users,
  onSaved,
}: LeaveApprovalStepDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(step);

  const form = useForm<StepFormValues>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      name: "",
      description: "",
      approverType: "manager",
      approverUserId: null,
      skipWhenSubmitterIds: [],
      onlyWhenSubmitterIds: [],
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
            approverType: step.approverType,
            approverUserId: step.approverUserId,
            skipWhenSubmitterIds: step.skipWhenSubmitterIds ?? [],
            onlyWhenSubmitterIds: step.onlyWhenSubmitterIds ?? [],
            isActive: step.isActive,
          }
        : {
            name: "",
            description: "",
            approverType: "manager",
            approverUserId: null,
            skipWhenSubmitterIds: [],
            onlyWhenSubmitterIds: [],
            isActive: true,
          },
    );
  }, [open, step, form]);

  const approverType = form.watch("approverType");

  async function onSubmit(values: StepFormValues) {
    try {
      setSubmitting(true);
      const payload = {
        ...values,
        description: values.description?.trim() || undefined,
        approverUserId:
          values.approverType === "user" ? values.approverUserId : null,
      };
      if (step) {
        await updateLeaveApprovalStep(step.id, payload);
        toast.success(`Step "${payload.name}" updated`);
      } else {
        await createLeaveApprovalStep(payload);
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
      <DialogContent
        className={`
          flex max-h-[90vh] flex-col overflow-hidden
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit approval step" : "Add approval step"}
          </DialogTitle>
          <DialogDescription>
            Each step decides one stage of the chain. Manager steps route to the
            submitter&apos;s direct manager; user steps route to one specific
            person.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="leave-approval-step-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className={`-mr-2 flex-1 space-y-4 overflow-y-auto pr-2`}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Manager approval" {...field} />
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
              name="approverType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approver type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manager">
                        Submitter&apos;s manager
                      </SelectItem>
                      <SelectItem value="user">Specific user</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {approverType === "user" && (
              <FormField
                control={form.control}
                name="approverUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approver</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
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
            )}

            <FormField
              control={form.control}
              name="skipWhenSubmitterIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skip when submitter is</FormLabel>
                  <FormDescription>
                    Submitters who should not trigger this step. Use this when
                    an approver should not approve their own request (e.g.
                    exclude Sid from the &ldquo;Sid approval&rdquo; step).
                  </FormDescription>
                  <FormControl>
                    <UserMultiSelect
                      users={users}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick submitters to skip…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="onlyWhenSubmitterIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Only when submitter is</FormLabel>
                  <FormDescription>
                    When set, this step only fires for these submitters. Leave
                    empty to apply to everyone (the default). Useful for routing
                    one specific person&apos;s request to a different approver
                    (e.g. CEO approval only when Sid submits).
                  </FormDescription>
                  <FormControl>
                    <UserMultiSelect
                      users={users}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Empty = applies to everyone"
                    />
                  </FormControl>
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
                      new submissions.
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
            form="leave-approval-step-form"
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
