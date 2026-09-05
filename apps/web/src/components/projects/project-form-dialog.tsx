"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
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
import { type AssignableUser } from "@/services/directory.service";
import {
  AGREEMENT_OPTIONS,
  createProject,
  type CreateProjectInput,
  createTask,
  generateTasksWithAI,
  HR_ASSIGNED_TEAM_OPTIONS,
  HR_TASK_TYPE_OPTIONS,
  HR_WORKFLOW_STATUS_VALUES,
  type Project,
  PROJECT_DEPARTMENT_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  type ProjectDepartment,
  type ProjectDetail,
  updateProject,
} from "@/services/project.service";

export const projectFormSchema = z
  .object({
    name: z.string().min(1, "Project name is required").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    status: z.string().min(1, "Status is required"),
    customFields: z
      .array(
        z.object({
          id: z.string().min(1).max(60),
          label: z.string().min(1, "Label is required").max(80),
          value: z.string().max(2000),
        }),
      )
      .max(50, "At most 50 custom fields per project")
      .optional(),
    // BD round #1 (May 2026), retyped in round #2: productionLive
    // boolean → productionLiveDate (when the project actually went
    // live). Dependency / Comment char limits match the BD spreadsheet
    // spec (200 / 1000).
    productionLiveDate: z.string().optional().or(z.literal("")),
    goLiveDate: z.string().optional().or(z.literal("")),
    // Restored 2026-08-14 alongside the Rev. GoLive list column. The
    // column is only useful if the date is settable here, and the
    // field/API/schema never went away, only the two UI surfaces.
    revisedGoLiveDate: z.string().optional().or(z.literal("")),
    dependency: z.string().max(200).optional().or(z.literal("")),
    comment: z.string().max(1000).optional().or(z.literal("")),
    // Project-team feedback (2026-06-10), Agreement signing state.
    // "" = unset; cleared to null on submit.
    agreement: z.enum(["signed", "not_signed"]).optional().or(z.literal("")),
    // BD round #7 (May 2026), Department picker for the /projects
    // Department column + filter dropdown. Empty string = unset.
    departments: z.array(z.enum(PROJECT_DEPARTMENT_OPTIONS)),
    // Legal team (2026-05-25), Workstream tag (free-text, surfaced
    // only when team=legal).
    workstream: z.string().max(200).optional().or(z.literal("")),
    // Legal team (2026-05-26), long-form details. 10 000-char cap
    // matches the API + the existing `description` field elsewhere.
    details: z.string().max(10000).optional().or(z.literal("")),
    // HR-team feedback (2026-05-26), Task Type + Assigned Team
    // dropdowns on the HR CRM form. Frontend constrains values via
    // PROJECT_STATUS / HR_TASK_TYPE / HR_ASSIGNED_TEAM whitelists.
    taskType: z.string().max(60).optional().or(z.literal("")),
    assignedTeam: z.string().max(60).optional().or(z.literal("")),
    // BD round #2, Owner is a People-picker. Optional on the form so
    // create-flow stays default-to-self.
    ownerId: z.string().uuid().optional().or(z.literal("")),
    // Auto-assign default for new tasks (shared-board CRMs, surfaced only
    // when the dialog is opened for general / hr).
    defaultAssigneeMode: z
      .enum(["none", "creator", "owner", "user"])
      .optional(),
    defaultAssigneeId: z.string().uuid().optional().or(z.literal("")),
    aiGenerateTasks: z.boolean().optional(),
    aiDescription: z.string().max(5000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // Rev. GoLive only makes sense as a slip from the original.
      const { goLiveDate, revisedGoLiveDate } = data;
      if (!goLiveDate?.trim() || !revisedGoLiveDate?.trim()) return true;
      return revisedGoLiveDate >= goLiveDate;
    },
    {
      message: "Revised go-live cannot be earlier than the original go-live",
      path: ["revisedGoLiveDate"],
    },
  );

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/**
 * The project's departments, restricted to values the picker can offer.
 *
 * `projects.department` is free text at the database level, so rows exist with
 * labels outside the whitelist (Engineering, Compliance, Trading …). Loading
 * one of those into the form used to make it unsubmittable: zod rejected the
 * value, and because it was not in the dropdown the user could not untick it
 * either. Filtering here keeps the form usable; the stale label is dropped on
 * the next save, which is the same convergence the API whitelist enforces.
 */
function knownDepartments(project: {
  department?: string | null;
  departments?: string[] | null;
}): ProjectDepartment[] {
  const raw = project.departments?.length
    ? project.departments
    : project.department
      ? [project.department]
      : [];
  const allowed = new Set<string>(PROJECT_DEPARTMENT_OPTIONS);
  return raw.filter((d): d is ProjectDepartment => allowed.has(d));
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  users,
  team = "general",
  defaultPartnerId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  users: AssignableUser[];
  /**
   * Owning team for new projects created via this dialog. Lets the IT
   * Helpdesk / IT CRM / Product CRM / Legal CRM / HR CRM workspaces
   * spawn a team-scoped project while the BD dashboard stays on the
   * general workspace.
   */
  team?: "general" | "it" | "product" | "legal" | "accounting" | "hr";
  /**
   * When the dialog is opened from the Partner CRM detail page, the
   * caller passes the partner id here so the new project is bound to
   * that partner without re-prompting. Ignored on edit (the existing
   * partner link is preserved on the server).
   */
  defaultPartnerId?: string;
  onSuccess: (saved: ProjectDetail) => void;
}) {
  const isEdit = !!project;
  const isLegal = team === "legal";
  const isAccounting = team === "accounting";
  const isWorkstreamCrm = isLegal || isAccounting;
  const isHr = team === "hr";
  // Auto-assign default is wired for the pure shared-board CRMs today
  // (general + hr). Product/Legal/Accounting get it in a later phase.
  const showAutoAssign = team === "general" || team === "hr";
  const [submitting, setSubmitting] = useState(false);

  // HR uses its own Workflow Status whitelist (Pending Documents /
  // Pending Approval / Closed / Cancelled in addition to the shared
  // Not yet started / In Progress / Completed). Other teams keep
  // the BD-style status set (UAT / Staging Integrated / Prod.
  // Integrated / On Hold).
  const statusOptionsForTeam = useMemo(() => {
    if (isHr) {
      return PROJECT_STATUS_OPTIONS.filter((s) =>
        HR_WORKFLOW_STATUS_VALUES.includes(
          s.value as (typeof HR_WORKFLOW_STATUS_VALUES)[number],
        ),
      );
    }
    const HR_ONLY = new Set([
      "pending_documents",
      "pending_approval",
      "closed",
      "cancelled",
    ]);
    return PROJECT_STATUS_OPTIONS.filter((s) => !HR_ONLY.has(s.value));
  }, [isHr]);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "not_yet_started",
      customFields: [],
      productionLiveDate: "",
      goLiveDate: "",
      revisedGoLiveDate: "",
      dependency: "",
      comment: "",
      departments: [],
      agreement: "",
      workstream: "",
      details: "",
      taskType: "",
      assignedTeam: "",
      ownerId: "",
      defaultAssigneeMode: "none",
      defaultAssigneeId: "",
      aiGenerateTasks: false,
      aiDescription: "",
    },
  });

  const customFieldArray = useFieldArray({
    control: form.control,
    name: "customFields",
  });

  const aiEnabled = form.watch("aiGenerateTasks");
  // The two go-live pickers bound each other: neither calendar offers a
  // day that would invert the pair, so the refine above is a backstop
  // rather than the primary guard.
  const goLiveDateWatch = form.watch("goLiveDate");
  const revisedGoLiveDateWatch = form.watch("revisedGoLiveDate");
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef<HTMLDivElement | null>(null);

  // An in-flow panel gets none of a portalled popover's dismiss behaviour for
  // free, so wire it up explicitly. Without this the only way out was clicking
  // the trigger again, and the panel pushes the form down far enough that the
  // trigger can scroll out of reach.
  useEffect(() => {
    if (!deptOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!deptRef.current?.contains(e.target as Node)) setDeptOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Stop the dialog itself closing on the same keypress.
        e.stopPropagation();
        setDeptOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [deptOpen]);

  useEffect(() => {
    if (!open) return;
    setDeptOpen(false);
    if (project) {
      form.reset({
        name: project.name,
        description: project.description ?? "",
        status: project.status,
        customFields: project.customFields ?? [],
        productionLiveDate: project.productionLiveDate?.slice(0, 10) ?? "",
        goLiveDate: project.goLiveDate?.slice(0, 10) ?? "",
        revisedGoLiveDate: project.revisedGoLiveDate?.slice(0, 10) ?? "",
        dependency: project.dependency ?? "",
        comment: project.comment ?? "",
        departments: knownDepartments(project),
        agreement: project.agreement ?? "",
        workstream: project.workstream ?? "",
        details: project.details ?? "",
        taskType: project.taskType ?? "",
        assignedTeam: project.assignedTeam ?? "",
        ownerId:
          typeof project.owner === "object" && project.owner !== null
            ? project.owner.id
            : "",
        defaultAssigneeMode: project.defaultAssigneeMode ?? "none",
        defaultAssigneeId: project.defaultAssigneeId ?? "",
        aiGenerateTasks: false,
        aiDescription: "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        status: "not_yet_started",
        customFields: [],
        productionLiveDate: "",
        goLiveDate: "",
        revisedGoLiveDate: "",
        dependency: "",
        comment: "",
        departments: [],
        agreement: "",
        workstream: "",
        details: "",
        taskType: "",
        assignedTeam: "",
        ownerId: "",
        defaultAssigneeMode: "none",
        defaultAssigneeId: "",
        aiGenerateTasks: false,
        aiDescription: "",
      });
    }
  }, [project, open, form]);

  async function onSubmit(values: ProjectFormValues) {
    if (
      showAutoAssign &&
      values.defaultAssigneeMode === "user" &&
      !values.defaultAssigneeId?.trim()
    ) {
      toast.error("Pick a default assignee, or choose a different mode");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateProjectInput = {
        name: values.name.trim(),
        // HR / Tanny feedback (2026-05-26): edits to Task detail
        // (description) didn't persist on Legal CRM when the user
        // cleared the field. `||` short-circuited the empty string to
        // `undefined`, which the server treats as "not touched";
        // switch to `??` so an empty string still reaches the server
        // and the field can actually be cleared.
        description: values.description?.trim() ?? undefined,
        status: values.status || undefined,
        // Only send team on create — switching an existing project
        // between workspaces should be a deliberate admin action, not
        // a side-effect of opening the edit dialog.
        ...(!isEdit && { team }),
        // Partner binding is also create-only; the edit form has no
        // partner picker yet, so we don't want to accidentally clear
        // the link on an unrelated update.
        ...(!isEdit && defaultPartnerId && { partnerId: defaultPartnerId }),
        customFields:
          values.customFields && values.customFields.length > 0
            ? values.customFields
                .map((f) => ({
                  id: f.id,
                  label: f.label.trim(),
                  value: f.value.trim(),
                }))
                .filter((f) => f.label.length > 0)
            : [],
        // BD feedback (May 2026). Empty strings → null so the server
        // can distinguish "user cleared this field" from "not touched".
        productionLiveDate: values.productionLiveDate?.trim()
          ? values.productionLiveDate
          : null,
        goLiveDate: values.goLiveDate?.trim() ? values.goLiveDate : null,
        revisedGoLiveDate: values.revisedGoLiveDate?.trim()
          ? values.revisedGoLiveDate
          : null,
        dependency: values.dependency?.trim() ? values.dependency.trim() : null,
        comment: values.comment?.trim() ? values.comment.trim() : null,
        // Empty selection clears the Department label on the server.
        departments: values.departments,
        agreement: values.agreement ? values.agreement : null,
        workstream: values.workstream?.trim() ? values.workstream.trim() : null,
        details: values.details?.trim() ? values.details.trim() : null,
        taskType: values.taskType?.trim() ? values.taskType.trim() : null,
        assignedTeam: values.assignedTeam?.trim()
          ? values.assignedTeam.trim()
          : null,
        // HR / Tanny feedback (2026-05-26): Owner change on the Edit
        // dialog wasn't persisting across Product / Legal / HR CRM.
        // The previous spread (`values.ownerId?.trim() && { ownerId }`)
        // dropped the key when the picker was cleared — that's fine on
        // create (defaults to caller) but on update it meant the
        // backend never saw the new selection if the field briefly
        // de-bounced to "". Always send `ownerId` on edit; on create,
        // keep the previous semantics so the new project still falls
        // back to the caller as owner.
        ...(isEdit
          ? values.ownerId?.trim()
            ? { ownerId: values.ownerId.trim() }
            : {}
          : values.ownerId?.trim() && { ownerId: values.ownerId.trim() }),
        // Auto-assign default — only for the wired shared-board CRMs.
        ...(showAutoAssign && {
          defaultAssigneeMode: values.defaultAssigneeMode ?? "none",
          defaultAssigneeId:
            values.defaultAssigneeMode === "user"
              ? values.defaultAssigneeId?.trim() || null
              : null,
        }),
      };

      let savedProject: ProjectDetail;

      if (isEdit) {
        const res = await updateProject(project!.id, payload);
        savedProject = res.data;
        toast.success("Project updated");
      } else {
        const res = await createProject(payload);
        savedProject = res.data;
        toast.success("Project created");
      }

      if (!isEdit && values.aiGenerateTasks && values.aiDescription?.trim()) {
        try {
          toast.info("Generating tasks with AI...");
          const aiResult = await generateTasksWithAI(savedProject.id, {
            description: values.aiDescription.trim(),
          });

          let count = 0;
          for (const task of aiResult.data.tasks) {
            await createTask(savedProject.id, {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
            });
            count++;
          }
          toast.success(`AI generated ${count} tasks`);
        } catch (aiErr) {
          const msg =
            aiErr instanceof ApiError
              ? aiErr.message
              : "Failed to generate AI tasks";
          toast.error(msg);
        }
      }

      onOpenChange(false);
      onSuccess(savedProject);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save project";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0
          sm:max-w-lg
        `}
      >
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle>{isEdit ? "Edit Project" : "New Project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update project details."
              : "Create a new project to organize work."}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border
            min-h-0 flex-1 overflow-y-auto px-5 pb-2
            hover:scrollbar-thumb-muted-foreground/30
          `}
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, (errors) => {
                // Silent-failure guard: if Zod rejects any field, surface
                // the first one as a toast so the user isn't left guessing
                // why the dialog stayed open.
                const firstField = Object.keys(errors)[0];
                const firstMsg =
                  firstField &&
                  (errors as Record<string, { message?: string }>)[firstField]
                    ?.message;
                toast.error(
                  firstMsg
                    ? `Please fix: ${firstField} — ${firstMsg}`
                    : "Form has invalid fields",
                );
              })}
              className="flex flex-col gap-4"
              id="project-form"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isWorkstreamCrm
                        ? isAccounting
                          ? "Accounting Task *"
                          : "Legal Task *"
                        : "Name *"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={
                          isWorkstreamCrm
                            ? isAccounting
                              ? "e.g. Invoice, Reconciliation"
                              : "e.g. Corporate, Agreement"
                            : "Project name"
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task detail</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Notes, scope, or context for this task…"
                          rows={3}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="workstream"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workstream</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Token Launch, Partnerships, Compliance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Counterparty notes, deal mechanics, drive links..."
                          rows={5}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {!isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Brief description..."
                          rows={3}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isHr ? "Workflow Status" : "Status"}
                      </FormLabel>
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
                          {statusOptionsForTeam.map((s) => (
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
                <FormField
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => {
                    // HR reported the base-ui Combobox was hard to
                    // scroll / click inside a Radix Dialog (mouse
                    // events were absorbed by the dialog's modal
                    // pointer-events guard). Switching to the same
                    // Radix Select that IT CRM uses gives a uniform
                    // UX across CRM forms and is a known-good
                    // pattern inside Radix Dialog. Owner with no
                    // value defaults to "self" on the server side.
                    return (
                      <FormItem>
                        <FormLabel>Owner</FormLabel>
                        <Select
                          value={field.value || "__self__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__self__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 w-full text-xs">
                              <SelectValue placeholder="Default to self" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__self__">— Self —</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {showAutoAssign ? (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="defaultAssigneeMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auto-assign new tasks to</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No default</SelectItem>
                            <SelectItem value="creator">
                              Whoever creates it
                            </SelectItem>
                            <SelectItem value="owner">Project owner</SelectItem>
                            <SelectItem value="user">
                              A specific person…
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("defaultAssigneeMode") === "user" ? (
                    <FormField
                      control={form.control}
                      name="defaultAssigneeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default assignee</FormLabel>
                          <Select
                            value={field.value || "__none__"}
                            onValueChange={(v) =>
                              field.onChange(v === "__none__" ? "" : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 w-full text-xs">
                                <SelectValue placeholder="Pick a person" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {users.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>
              ) : null}

              {isHr ? (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="taskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Type</FormLabel>
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select task type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {HR_TASK_TYPE_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                    name="assignedTeam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned Team</FormLabel>
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {HR_ASSIGNED_TEAM_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <div
                className={
                  isWorkstreamCrm || isHr
                    ? "grid grid-cols-1 gap-3"
                    : "grid grid-cols-3 gap-3"
                }
              >
                <FormField
                  control={form.control}
                  name="goLiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isWorkstreamCrm || isHr ? "Due Date" : "GoLive Date"}
                      </FormLabel>
                      <FormControl>
                        <FormDatePicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={
                            isWorkstreamCrm || isHr ? "Pick a date" : "Target"
                          }
                          maxDate={revisedGoLiveDateWatch?.trim() || undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isWorkstreamCrm && !isHr ? (
                  <FormField
                    control={form.control}
                    name="revisedGoLiveDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rev. GoLive</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Slipped"
                            minDate={goLiveDateWatch?.trim() || undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
                {!isWorkstreamCrm && !isHr ? (
                  <FormField
                    control={form.control}
                    name="productionLiveDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Live</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Actual"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>

              {!isWorkstreamCrm && !isHr ? (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="dependency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dependency</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Upstream blocker, vendor, team..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departments</FormLabel>
                        {/*
                          Deliberately NOT a portalled Popover. The dialog uses
                          react-remove-scroll, which blocks wheel/trackpad
                          events over anything portalled outside it, the list
                          could then only be moved by dragging its scrollbar.
                          Rendering the panel inside the dialog's own subtree
                          makes normal scrolling work. It stays in flow rather
                          than absolutely positioned because DialogContent is
                          `overflow-y-auto` and would clip an overlay.
                        */}
                        <div ref={deptRef}>
                          <button
                            type="button"
                            aria-expanded={deptOpen}
                            onClick={() => setDeptOpen((o) => !o)}
                            className={`
                              border-input bg-background flex h-9 w-full
                              items-center justify-between rounded-md border
                              px-3 text-sm
                              ${
                                field.value.length
                                  ? ""
                                  : `text-muted-foreground`
                              }
                            `}
                          >
                            <span className="truncate">
                              {field.value.length === 0
                                ? "Select departments"
                                : field.value.length === 1
                                  ? field.value[0]
                                  : `${field.value[0]} +${field.value.length - 1} more`}
                            </span>
                            <ChevronsUpDown
                              className={`ml-2 size-3.5 shrink-0 opacity-50`}
                            />
                          </button>
                          {deptOpen ? (
                            <div
                              className={`
                                bg-popover mt-1 max-h-56 overflow-y-auto
                                rounded-md border p-1
                              `}
                            >
                              {PROJECT_DEPARTMENT_OPTIONS.map((d) => {
                                const checked = field.value.includes(d);
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() =>
                                      // Order is preserved, so the first pick
                                      // stays primary until it is unticked.
                                      field.onChange(
                                        checked
                                          ? field.value.filter((v) => v !== d)
                                          : [...field.value, d],
                                      )
                                    }
                                    className={`
                                      hover:bg-accent
                                      flex w-full items-center gap-2 rounded-sm
                                      px-2 py-1.5 text-left text-sm
                                    `}
                                  >
                                    <Check
                                      className={`
                                        size-3.5 shrink-0
                                        ${checked ? "opacity-100" : "opacity-0"}
                                      `}
                                    />
                                    {d}
                                  </button>
                                );
                              })}
                              <div
                                className={`
                                  mt-1 flex items-center justify-between
                                  border-t px-2 pt-1.5
                                `}
                              >
                                <span className="text-muted-foreground text-xs">
                                  {field.value.length === 0
                                    ? "None selected"
                                    : `${field.value.length} selected, ${field.value[0]} is primary`}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setDeptOpen(false)}
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agreement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agreement</FormLabel>
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select agreement" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {AGREEMENT_OPTIONS.map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {!isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comment</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Status note for the team..."
                          rows={3}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {/* Custom fields — Marketing feedback round #2 */}
              {!isWorkstreamCrm ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px] font-medium">
                      Custom fields
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        customFieldArray.append({
                          id:
                            typeof crypto !== "undefined" &&
                            "randomUUID" in crypto
                              ? crypto.randomUUID()
                              : `cf-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                          label: "",
                          value: "",
                        })
                      }
                      disabled={(customFieldArray.fields.length ?? 0) >= 50}
                    >
                      <Plus className="size-3.5" />
                      Add field
                    </Button>
                  </div>
                  {customFieldArray.fields.length === 0 ? (
                    <p
                      className={`
                        text-muted-foreground rounded-md border border-dashed
                        p-3 text-center text-[11px]
                      `}
                    >
                      Add ad-hoc fields like Campaign tag, Channel, KPI —
                      anything the team needs to track on this project.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {customFieldArray.fields.map((field, idx) => (
                        <div
                          key={field.id}
                          className={`
                            grid grid-cols-1 gap-2
                            sm:grid-cols-[160px_1fr_auto]
                          `}
                        >
                          <FormField
                            control={form.control}
                            name={`customFields.${idx}.label`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...f}
                                    placeholder="Label (e.g. Channel)"
                                    className="h-8 text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`customFields.${idx}.value`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...f}
                                    placeholder="Value"
                                    className="h-8 text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Remove field"
                            onClick={() => customFieldArray.remove(idx)}
                          >
                            <Trash2 className="text-destructive size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* AI Generate Tasks */}
              {!isWorkstreamCrm && !isEdit && (
                <div
                  className={`
                    overflow-hidden rounded-lg border transition-colors
                    ${
                      aiEnabled
                        ? `
                          border-violet-300 bg-violet-50/60
                          dark:border-violet-700 dark:bg-violet-950/40
                        `
                        : "border-border bg-muted/30"
                    }
                  `}
                >
                  <div className="flex items-center justify-between px-3.5 py-3">
                    <Label
                      htmlFor="ai-toggle"
                      className={`
                        flex cursor-pointer items-center gap-2 text-[13px]
                        font-medium
                      `}
                    >
                      <div
                        className={`
                          flex size-6 items-center justify-center rounded-md
                          transition-colors
                          ${
                            aiEnabled
                              ? `
                                bg-violet-100
                                dark:bg-violet-900/50
                              `
                              : "bg-muted"
                          }
                        `}
                      >
                        <Sparkles
                          className={`
                            size-3.5 transition-colors
                            ${
                              aiEnabled
                                ? `
                                  text-violet-600
                                  dark:text-violet-400
                                `
                                : "text-muted-foreground"
                            }
                          `}
                        />
                      </div>
                      Generate tasks with AI
                    </Label>
                    <FormField
                      control={form.control}
                      name="aiGenerateTasks"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch
                              id="ai-toggle"
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {aiEnabled && (
                    <div
                      className={`
                        border-t border-violet-200 px-3.5 pt-3 pb-3.5
                        dark:border-violet-700/50
                      `}
                    >
                      <FormField
                        control={form.control}
                        name="aiDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              Describe what the project should accomplish
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="E.g: Build a landing page with React, Tailwind. Includes hero section, pricing, contact form..."
                                rows={3}
                                className={`
                                  resize-none border-violet-200 bg-white text-xs
                                  placeholder:text-violet-300
                                  focus-visible:ring-violet-400
                                  dark:border-violet-700 dark:bg-violet-950/60
                                  dark:placeholder:text-violet-600
                                `}
                              />
                            </FormControl>
                            <p
                              className={`
                                text-muted-foreground text-[10px]
                                leading-relaxed
                              `}
                            >
                              AI will auto-generate tasks after the project is
                              created.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </form>
          </Form>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Update Project" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
