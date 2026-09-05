"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  PROJECT_TASK_PRIORITY_DEFAULT,
  PROJECT_TASK_PRIORITY_OPTIONS,
} from "@/components/projects/task-priority";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
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
import type {
  ProjectColumn,
  ProjectMember,
  ProjectMilestone,
  Task,
} from "@/services/project.service";
import { createTask } from "@/services/project.service";

const createTaskSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().optional().or(z.literal("")),
    status: z.string().min(1),
    priority: z.string().min(1),
    ownerId: z.string().optional().or(z.literal("")),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    milestoneId: z.string().optional().or(z.literal("")),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

type CreateTaskValues = z.infer<typeof createTaskSchema>;

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  columns,
  members,
  milestones,
  defaultStatus,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columns: ProjectColumn[];
  members: ProjectMember[];
  milestones?: ProjectMilestone[];
  defaultStatus: string;
  onCreated: (task: Task) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: defaultStatus,
      priority: PROJECT_TASK_PRIORITY_DEFAULT,
      ownerId: "",
      startDate: "",
      endDate: "",
      milestoneId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        status: defaultStatus,
        priority: PROJECT_TASK_PRIORITY_DEFAULT,
        ownerId: "",
        startDate: "",
        endDate: "",
        milestoneId: "",
      });
    }
  }, [open, defaultStatus, form]);

  async function onSubmit(values: CreateTaskValues) {
    setSubmitting(true);
    try {
      const result = await createTask(projectId, {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        status: values.status,
        priority: values.priority,
        ownerId: values.ownerId || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        milestoneId: values.milestoneId || undefined,
      });
      onCreated(result.data);
      onOpenChange(false);
      toast.success("Task created");
    } catch (err) {
      // Marketing reported "Failed to create task" with no detail. Surface
      // the real server message — the most common cause is the rep not
      // being a project participant (403), which is opaque without it.
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create task";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:min-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a new task to this project.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="create-task-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Task title" />
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
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
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
                        {columns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            <div className="flex items-center gap-2">
                              <div
                                className={`
                                  size-2 rounded-full
                                  ${col.color}
                                `}
                              />
                              {col.label}
                            </div>
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_TASK_PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
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
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
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

            {milestones && milestones.length > 0 ? (
              <FormField
                control={form.control}
                name="milestoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone</FormLabel>
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
                        {milestones.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
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
            form="create-task-form"
            disabled={submitting}
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
