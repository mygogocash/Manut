"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Lead, listLeads } from "@/services/crm-lead.service";
import {
  listOpportunities,
  type Opportunity,
} from "@/services/crm-opportunity.service";
import {
  createCrmTask,
  type CrmTask,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
  updateCrmTask,
} from "@/services/crm-task.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

const NONE = "__none__";

// API enforces "at least one anchor" via zod superRefine; we mirror it here
// so the rep cannot submit a task with no parent.
const formSchema = z
  .object({
    subject: z.string().min(1, "Subject is required").max(300),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
    status: z.enum(TASK_STATUSES),
    ownerId: z.string().optional(),
    leadId: z.string().optional(),
    opportunityId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.leadId && !d.opportunityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leadId"],
        message: "Pick a lead or opportunity to anchor this task.",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: CrmTask | null;
  // Optional preset (e.g. opening from a Lead / Opportunity detail).
  presetLeadId?: string;
  presetOpportunityId?: string;
  onSaved: () => void;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  presetLeadId,
  presetOpportunityId,
  onSaved,
}: TaskFormDialogProps) {
  const isEditing = !!task;
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  const [submitting, setSubmitting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      dueDate: "",
      status: "open",
      ownerId: "",
      leadId: "",
      opportunityId: "",
    },
  });

  // Load lead + opportunity options when creating. Editing keeps the
  // existing anchors locked since the API doesn't support re-anchoring.
  useEffect(() => {
    if (!open || isEditing) return;
    let cancelled = false;
    setPickerLoading(true);
    Promise.all([
      listLeads({ page: 1, limit: 100, status: "qualified" }).catch(() => ({
        data: [] as Lead[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
      listOpportunities({ page: 1, limit: 100 }).catch(() => ({
        data: [] as Opportunity[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
    ])
      .then(([leadsRes, oppsRes]) => {
        if (cancelled) return;
        setLeads(leadsRes.data);
        setOpps(oppsRes.data);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isEditing]);

  // Owner options — lean assignable projection, open to any signed-in
  // user (no `directory:read` needed). The picker degrades to just the
  // current user if the fetch fails.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUsersLoading(true);
    listAssignableUsers({ limit: 500 })
      .then((res) => {
        if (!cancelled) setUsers(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Current user first (rendered as "Me"); when editing, the task's
  // existing owner stays selectable even if missing from the directory
  // response (e.g. deactivated since assignment).
  const ownerOptions = useMemo(() => {
    const opts: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    if (currentUser) {
      opts.push({ id: currentUser.id, name: currentUser.name });
      seen.add(currentUser.id);
    }
    if (task?.owner && !seen.has(task.owner.id)) {
      opts.push({ id: task.owner.id, name: task.owner.name });
      seen.add(task.owner.id);
    }
    for (const u of users) {
      if (!seen.has(u.id)) {
        opts.push({ id: u.id, name: u.name });
        seen.add(u.id);
      }
    }
    return opts;
  }, [currentUser, task, users]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      form.reset({
        subject: task.subject,
        dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
        status: task.status as TaskStatus,
        ownerId: task.ownerId ?? "",
        leadId: task.leadId ?? "",
        opportunityId: task.opportunityId ?? "",
      });
    } else {
      form.reset({
        subject: "",
        dueDate: "",
        status: "open",
        ownerId: currentUserId ?? "",
        leadId: presetLeadId ?? "",
        opportunityId: presetOpportunityId ?? "",
      });
    }
  }, [open, task, presetLeadId, presetOpportunityId, currentUserId, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      if (isEditing && task) {
        await updateCrmTask(task.id, {
          subject: values.subject,
          dueDate: values.dueDate,
          status: values.status,
          ownerId: values.ownerId || undefined,
        });
        toast.success("Task updated");
      } else {
        await createCrmTask({
          subject: values.subject,
          dueDate: values.dueDate,
          ownerId: values.ownerId || undefined,
          leadId: values.leadId || undefined,
          opportunityId: values.opportunityId || undefined,
        });
        toast.success("Task created");
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
          <DialogTitle>{isEditing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update ${task?.subject}.`
              : "Add a follow-up task tied to a lead or opportunity. Status flips to done when you check the row off."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="crm-task-form"
          >
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Follow up on proposal"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date *</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isEditing ? (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TASK_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={usersLoading ? "Loading…" : "Me"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ownerOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.id === currentUserId ? "Me" : u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="leadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={(v) =>
                          field.onChange(v === NONE ? "" : v)
                        }
                        disabled={!!presetLeadId || pickerLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={pickerLoading ? "Loading…" : "None"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {leads.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.firstName} {l.lastName} · {l.company}
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
                  name="opportunityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={(v) =>
                          field.onChange(v === NONE ? "" : v)
                        }
                        disabled={!!presetOpportunityId || pickerLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={pickerLoading ? "Loading…" : "None"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {opps.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2">
                  <FormDescription>
                    Pick at least one anchor. Tasks can stay tied to both a lead
                    and the opportunity it converted into.
                  </FormDescription>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col gap-1 text-sm">
                {task?.lead ? <span>Lead: {task.lead.company}</span> : null}
                {task?.opportunity ? (
                  <span>Opportunity: {task.opportunity.name}</span>
                ) : null}
              </div>
            )}
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
            form="crm-task-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
