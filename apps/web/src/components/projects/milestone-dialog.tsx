"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import type {
  ProjectMember,
  ProjectMilestone,
} from "@/services/project.service";
import { createMilestone, updateMilestone } from "@/services/project.service";

const milestoneSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(300),
    description: z.string().max(5000).optional().or(z.literal("")),
    status: z.enum(["not_started", "in_progress", "done", "blocked"]),
    ownerId: z.string().optional().or(z.literal("")),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

type MilestoneValues = z.infer<typeof milestoneSchema>;

export function MilestoneDialog({
  open,
  onOpenChange,
  milestone,
  projectId,
  members,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: ProjectMilestone | null;
  projectId: string;
  members: ProjectMember[];
  onSuccess: () => void;
}) {
  const isEdit = !!milestone;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<MilestoneValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "not_started",
      ownerId: "",
      startDate: "",
      endDate: "",
    },
  });

  // Re-seed form whenever the dialog opens or the target milestone
  // changes. Mirrors the employee-form-dialog pattern from CLAUDE.md
  // (open + payload + form in the deps array).
  useEffect(() => {
    if (open) {
      form.reset({
        title: milestone?.title ?? "",
        description: milestone?.description ?? "",
        status: milestone?.status ?? "not_started",
        ownerId: milestone?.ownerId ?? "",
        startDate: milestone?.startDate ?? "",
        endDate: milestone?.endDate ?? "",
      });
    }
  }, [open, milestone, form]);

  async function onSubmit(values: MilestoneValues) {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        status: values.status,
        ownerId: values.ownerId || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
      };
      if (isEdit && milestone) {
        await updateMilestone(projectId, milestone.id, payload);
        toast.success("Milestone updated");
      } else {
        await createMilestone(projectId, payload);
        toast.success("Milestone created");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save milestone";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:min-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Milestone" : "New Milestone"}
          </DialogTitle>
          <DialogDescription>
            Group related tasks under a milestone with its own date range.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            id="milestone-form"
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Milestone title" />
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
                      {...field}
                      rows={3}
                      placeholder="Optional details..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
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
                        <SelectItem value="not_started">Not started</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user.id} value={m.user.id}>
                            {m.user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="None"
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
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="None"
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
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="milestone-form"
            disabled={submitting}
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
