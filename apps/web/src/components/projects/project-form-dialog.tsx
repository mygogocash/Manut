"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { type AssignableUser } from "@/services/directory.service";
import {
  AGREEMENT_OPTIONS,
  createProject,
  type CreateProjectInput,
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const projectFormSchema = z
  .object({
    name: z.string().min(1, "Project name is required").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    status: z.string().min(1, "Status is required"),
    memberIds: z.array(z.string()).optional(),
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
    // productionLive
    // boolean → productionLiveDate (when the project actually went
    // live). Dependency / Comment char limits match the BD spreadsheet
    // spec (200 / 1000).
    productionLiveDate: z.string().optional().or(z.literal("")),
    goLiveDate: z.string().optional().or(z.literal("")),
    revisedGoLiveDate: z.string().optional().or(z.literal("")),
    dependency: z.string().max(200).optional().or(z.literal("")),
    comment: z.string().max(1000).optional().or(z.literal("")),
    // Agreement signing state.
    // "" = unset; cleared to null on submit.
    agreement: z.enum(["signed", "not_signed"]).optional().or(z.literal("")),
    // Department picker for the /projects
    // Department column + filter dropdown. Empty string = unset.
    department: z.enum(PROJECT_DEPARTMENT_OPTIONS).optional().or(z.literal("")),
    // Workstream tag (free-text, surfaced
    // only when team=legal).
    workstream: z.string().max(200).optional().or(z.literal("")),
    // Long-form details. 10 000-char cap
    // matches the API + the existing `description` field elsewhere.
    details: z.string().max(10000).optional().or(z.literal("")),
    // Task Type + Assigned Team
    // dropdowns on the HR CRM form. Frontend constrains values via
    // PROJECT_STATUS / HR_TASK_TYPE / HR_ASSIGNED_TEAM whitelists.
    taskType: z.string().max(60).optional().or(z.literal("")),
    assignedTeam: z.string().max(60).optional().or(z.literal("")),
    // Owner is a People-picker. Optional on the form so
    // create-flow stays default-to-self.
    ownerId: z.string().uuid().optional().or(z.literal("")),
    // Auto-assign default for new tasks (shared-board CRMs — surfaced only
    // when the dialog is opened for general / hr).
    defaultAssigneeMode: z
      .enum(["none", "creator", "owner", "user"])
      .optional(),
    defaultAssigneeId: z.string().uuid().optional().or(z.literal("")),
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
  const [memberSearch, setMemberSearch] = useState("");

  // HR uses its own Workflow Status whitelist (Pending Documents /
  // Pending Approval / Closed / Cancelled in addition to the shared
  // Not yet started / In Progress / Completed). Other teams keep
  // the default status set (UAT / Staging Integrated / Prod.
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
    resolver: standardSchemaResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "not_yet_started",
      memberIds: [],
      customFields: [],
      productionLiveDate: "",
      goLiveDate: "",
      revisedGoLiveDate: "",
      dependency: "",
      comment: "",
      department: "",
      agreement: "",
      workstream: "",
      details: "",
      taskType: "",
      assignedTeam: "",
      ownerId: "",
      defaultAssigneeMode: "none",
      defaultAssigneeId: "",
    },
  });

  const customFieldArray = useFieldArray({
    control: form.control,
    name: "customFields",
  });

  const goLiveDateWatch = form.watch("goLiveDate");
  const revisedGoLiveDateWatch = form.watch("revisedGoLiveDate");
  const selectedMemberIds = form.watch("memberIds") ?? [];

  useEffect(() => {
    if (!open) return;
    setMemberSearch("");
    if (project) {
      form.reset({
        name: project.name,
        description: project.description ?? "",
        status: project.status,
        memberIds: project.members?.map((m) => m.user.id ?? m.userId) ?? [],
        customFields: project.customFields ?? [],
        productionLiveDate: project.productionLiveDate?.slice(0, 10) ?? "",
        goLiveDate: project.goLiveDate?.slice(0, 10) ?? "",
        revisedGoLiveDate: project.revisedGoLiveDate?.slice(0, 10) ?? "",
        dependency: project.dependency ?? "",
        comment: project.comment ?? "",
        department: (project.department as ProjectDepartment) ?? "",
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
      });
    } else {
      form.reset({
        name: "",
        description: "",
        status: "not_yet_started",
        memberIds: [],
        customFields: [],
        productionLiveDate: "",
        goLiveDate: "",
        revisedGoLiveDate: "",
        dependency: "",
        comment: "",
        department: "",
        agreement: "",
        workstream: "",
        details: "",
        taskType: "",
        assignedTeam: "",
        ownerId: "",
        defaultAssigneeMode: "none",
        defaultAssigneeId: "",
      });
    }
  }, [project, open, form]);

  const filteredUsers = useMemo(() => {
    if (!memberSearch.trim()) return users;
    const q = memberSearch.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, memberSearch]);

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
        // Edits to Task detail
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
        memberIds:
          values.memberIds && values.memberIds.length > 0
            ? values.memberIds
            : undefined,
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
        // Empty strings → null so the server
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
        department: values.department ? values.department : null,
        agreement: values.agreement ? values.agreement : null,
        workstream: values.workstream?.trim() ? values.workstream.trim() : null,
        details: values.details?.trim() ? values.details.trim() : null,
        taskType: values.taskType?.trim() ? values.taskType.trim() : null,
        assignedTeam: values.assignedTeam?.trim()
          ? values.assignedTeam.trim()
          : null,
        // Owner changes on the Edit
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
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {PROJECT_DEPARTMENT_OPTIONS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
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

              {/* Members */}
              {!isWorkstreamCrm ? (
                <FormField
                  control={form.control}
                  name="memberIds"
                  render={() => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          Members
                        </FormLabel>
                        {selectedMemberIds.length > 0 && (
                          <span
                            className={`
                              text-muted-foreground text-[10px] tabular-nums
                            `}
                          >
                            {selectedMemberIds.length} selected
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Search
                          className={`
                            text-muted-foreground pointer-events-none absolute
                            top-1/2 left-2.5 size-3.5 -translate-y-1/2
                          `}
                        />
                        <Input
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Search by name or email..."
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <div
                        className={`
                          scrollbar-thin scrollbar-track-transparent
                          scrollbar-thumb-border mt-1 max-h-[152px]
                          overflow-y-auto rounded-lg border
                          hover:scrollbar-thumb-muted-foreground/30
                        `}
                      >
                        <div className="flex flex-col py-1">
                          {filteredUsers.map((u) => (
                            <FormField
                              key={u.id}
                              control={form.control}
                              name="memberIds"
                              render={({ field }) => {
                                const checked =
                                  field.value?.includes(u.id) ?? false;
                                return (
                                  <FormItem>
                                    <FormLabel
                                      className={`
                                        flex cursor-pointer items-center gap-2.5
                                        px-3 py-2 font-normal transition-colors
                                        ${
                                          checked
                                            ? "bg-primary/5"
                                            : "hover:bg-muted/60"
                                        }
                                      `}
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(v) => {
                                            const cur = field.value ?? [];
                                            field.onChange(
                                              v
                                                ? [...cur, u.id]
                                                : cur.filter(
                                                    (id) => id !== u.id,
                                                  ),
                                            );
                                          }}
                                        />
                                      </FormControl>
                                      <Avatar className="size-6">
                                        <AvatarFallback
                                          className={`text-[9px] font-semibold`}
                                        >
                                          {getInitials(u.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div
                                        className={`
                                          flex min-w-0 flex-1 flex-col
                                        `}
                                      >
                                        <span
                                          className={`
                                            truncate text-xs leading-tight
                                            font-medium
                                          `}
                                        >
                                          {u.name}
                                        </span>
                                        <span
                                          className={`
                                            text-muted-foreground truncate
                                            text-[10px] leading-tight
                                          `}
                                        >
                                          {u.email}
                                        </span>
                                      </div>
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                          {filteredUsers.length === 0 && (
                            <p
                              className={`
                                text-muted-foreground py-6 text-center text-xs
                              `}
                            >
                              {memberSearch.trim()
                                ? "No members match your search"
                                : "No users found"}
                            </p>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {/* Admin-defined custom fields */}
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
