import { z } from "zod";

import {
  normalizeProjectTaskPriority,
  PROJECT_TASK_PRIORITIES,
  PROJECT_TASK_PRIORITY_DEFAULT,
} from "@/modules/projects/project-task-priority";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// Marketing feedback round #2 — admin-defined custom fields. Each
// row is a stable id + label + free-text value. We cap the array at
// 50 entries to keep the JSON column small and the UI manageable.
export const customFieldSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  value: z.string().max(2000),
});

/**
 * BD-feedback status taxonomy (May 2026). Kept as a string column on
 * the database side; this whitelist is the single source of truth for
 * "what values may a project carry?" Frontend mirrors this list.
 */
export const PROJECT_STATUS_VALUES = [
  "in_progress",
  "completed",
  "on_hold",
  "not_yet_started",
  "staging_integrated",
  "prod_integrated",
  "uat",
  // HR-team feedback (2026-05-26) — HR workflow statuses. The HR form
  // surfaces a filtered subset of this enum (the four below + the
  // shared `not_yet_started | in_progress | completed`). Adding them
  // to the global whitelist keeps the existing string column +
  // single-source-of-truth pattern intact.
  "pending_documents",
  "pending_approval",
  "closed",
  "cancelled",
  // Legal-team feedback (2026-05-26) — Legal CRM tracks tasks against
  // a simplified three-state workflow modelled after the team's
  // Google Sheet (Complete / In progress / Pending Dept. Info). The
  // first two reuse existing values; `pending_dept_info` is new.
  "pending_dept_info",
] as const;

export const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES);

/**
 * Project team scoping. Each value backs a distinct workspace in the
 * UI; the schema stays single-table so existing CRUD logic reuses
 * across teams. Add a value here AND surface a matching filter / tab
 * in the UI when introducing a new team.
 */
// Adding a team value here means: surface a matching `/x-crm` route +
// sidebar entry, define matching `x:read` / `x:read-all` permissions,
// and widen `canSeeAll` in `projects-view.tsx` so the team can see
// the workspace-wide list. The Product + IT CRMs are separate
// top-level workspaces sharing the same Project schema.
export const PROJECT_TEAM_VALUES = [
  "general",
  "it",
  "product",
  "legal",
  "accounting",
  "hr",
] as const;
export const projectTeamSchema = z.enum(PROJECT_TEAM_VALUES);

/**
 * Owning department on a Project. Mirrors the workforce taxonomy already
 * used for `User.department` (see seed `DEPARTMENTS`). Stored as free-
 * form text on the column so admins can add a one-off without a code
 * change, but the API accepts only this whitelist on writes — keeps the
 * filter dropdown options stable. `null` / unset is allowed (legacy +
 * unscoped projects).
 */
export const PROJECT_DEPARTMENT_VALUES = [
  "Management",
  "Business Team",
  "Marketing",
  "Product",
  "Project",
  "IT",
  "HR",
  "Accounting",
  "Finance",
  "Finance & Accounting",
  "Legal",
  "Digital Social",
  "Operations",
  "Other",
] as const;
export const projectDepartmentSchema = z.enum(PROJECT_DEPARTMENT_VALUES);
export type ProjectDepartment = z.infer<typeof projectDepartmentSchema>;

const projectBodySchema = z.object({
  name: z.string().min(1, "Project name is required").max(300),
  description: z.string().max(5000).optional(),
  status: projectStatusSchema.default("not_yet_started"),
  team: projectTeamSchema.default("general"),
  partnerId: z.string().optional(),
  // BD round #2 — Owner is a People-picker on the form. Optional on
  // input: on create it defaults to the caller's user id; on update
  // a manager can transfer ownership.
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  budget: z.coerce.number().nonnegative().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
  customFields: z.array(customFieldSchema).max(50).optional(),
  // BD feedback (May 2026). Round #2 retyped production_live boolean
  // → date so BD can record *when* a project went live. Char limits on
  // dependency / comment match the spreadsheet spec (200 / 1000).
  productionLiveDate: dateString.nullable().optional(),
  goLiveDate: dateString.nullable().optional(),
  revisedGoLiveDate: dateString.nullable().optional(),
  // Project-team feedback (2026-06-10) — agreement signing state shown
  // after Rev. GoLive on the Project CRM list. Whitelisted values; null
  // clears it.
  agreement: z.enum(["signed", "not_signed"]).nullable().optional(),
  dependency: z.string().max(200).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  // BD-feedback round #7 (May 2026) — Department label for the new
  // `/projects` Department column + filter dropdown. Accepted values
  // come from the shared `PROJECT_DEPARTMENT_VALUES` whitelist; null
  // clears it.
  department: projectDepartmentSchema.nullable().optional(),
  // A project can span several departments. `departments` carries the full
  // selection; the service keeps the scalar `department` above equal to the
  // first entry so the dashboard groupBy, the list filter and exports go on
  // working. Send either — sending only `department` still works.
  departments: z
    .array(projectDepartmentSchema)
    .max(PROJECT_DEPARTMENT_VALUES.length)
    .optional(),
  // Legal team (2026-05-25) — Workstream tags a Legal Task to the
  // broader programme it belongs to (e.g. "Token Launch",
  // "Partnerships", "Compliance"). Free-text for now; promote to a
  // controlled vocabulary if the legal team builds up a stable
  // taxonomy. 200-char cap matches `dependency`.
  workstream: z.string().max(200).nullable().optional(),
  // Legal team (2026-05-26) — long-form narrative for a Legal Task.
  // 10 000-char cap matches the existing `description` field elsewhere
  // in the codebase. Nullable so non-Legal projects stay valid.
  details: z.string().max(10000).nullable().optional(),
  // HR-team feedback (2026-05-26) — Task Type (Visa / HR / Admin /
  // F&A) and Assigned Team (HR / Visa / Admin / F&A) categorise HR
  // CRM rows. Free-text on the API; frontend enforces the dropdown
  // whitelist so non-HR rows that already have free-text in adjacent
  // fields don't trip validation.
  taskType: z.string().max(60).nullable().optional(),
  assignedTeam: z.string().max(60).nullable().optional(),
  // Auto-assign default for new tasks. `user` mode requires defaultAssigneeId;
  // the service validates it points at an active user before applying.
  defaultAssigneeMode: z
    .enum(["none", "creator", "owner", "user"])
    .default("none"),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
});

const projectDateOrderRefine = <
  T extends { startDate?: string; endDate?: string },
>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

export const createProjectSchema = projectBodySchema.refine(
  projectDateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateProjectSchema = projectBodySchema
  .partial()
  .refine(projectDateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  // Optional team filter — `/projects` calls with `team=general`,
  // IT Helpdesk Projects tab calls with `team=it`. Absent = caller
  // sees all teams they otherwise have access to (admin / read-all
  // case).
  team: projectTeamSchema.optional(),
  // Optional Department filter for the /projects table dropdown.
  // Server-side filter so paging stays consistent across departments.
  // Matches a project whose PRIMARY department is this value, or that lists it
  // among its departments.
  department: projectDepartmentSchema.optional(),
  // Optional Agreement filter for the Project CRM list dropdown
  // (Project-team feedback). Server-side so paging stays consistent
  // across the filtered set. Same controlled vocabulary as the body
  // field; an unknown value is rejected rather than matching nothing.
  agreement: z.enum(["signed", "not_signed"]).optional(),
  // Optional Partner filter — drives the Partner CRM detail page,
  // which lists the partner's projects via `/projects?partnerId=…`.
  partnerId: z.string().optional(),
  // Active / Archived board filter. Default view (archived falsy) excludes
  // archived projects; archived=true returns only archived ones.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

/**
 * Reorder payload: caller submits the desired sequence of project ids.
 * The service assigns sort_order = array index for every id the caller
 * has access to. Ids the caller cannot see are silently dropped (we
 * don't leak existence). Capped at 500 to keep the transaction small.
 */
export const reorderProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Within-board task reorder (Trello-style). `orderedIds` is the
// target column's task list in the order the rep dropped them. When
// `status` is supplied, every id in `orderedIds` is also moved into
// that column — that's the cross-column-with-position case (drag a
// card from "Todo" into "In Progress" at index 2). When `status` is
// omitted, the call is a pure same-column reorder. The service writes
// 0..N-1 to those ids' `sort_order` in a single transaction.
export const reorderTasksSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
  status: z.string().min(1).max(64).optional(),
});

// Bulk import — create-new-only, capped at 500 (per-row slug +
// column / member seeding). `team` is supplied by the caller so the
// import lands in the right workspace (general / hr / …).
export const importProjectsSchema = z.object({
  rows: z.array(createProjectSchema).min(1).max(500),
});

// Move a project to another CRM module. Currently only Partner CRM is a
// cross-table target (the project name maps to the partner Company, with
// an optional admin-supplied override). Other project teams move via the
// plain `team` field on update, not this route.
export const moveProjectSchema = z.object({
  target: z.literal("partner"),
  company: z.string().min(1).max(300).optional(),
});

export type MoveProjectInput = z.infer<typeof moveProjectSchema>;

const taskDateRangeRefine = <
  T extends { startDate?: string | null; endDate?: string | null },
>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

const taskBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  status: z.string().default("todo"),
  priority: z
    .enum(PROJECT_TASK_PRIORITIES)
    .default(PROJECT_TASK_PRIORITY_DEFAULT),
  ownerId: z.string().uuid().optional(),
  // Nullable so the detail sheet can CLEAR a date: `null` wipes it,
  // `undefined` (omitted) leaves it unchanged. Without nullable, the
  // X-clear sent null and zod rejected it, so the date never cleared.
  startDate: dateString.nullable().optional(),
  endDate: dateString.nullable().optional(),
  milestoneId: z.string().uuid().optional(),
  // Replaces the previous `ownerId`-only model. When provided, replaces
  // the full assignee set for the task. Empty array clears all.
  assigneeIds: z.array(z.string().uuid()).max(50).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  parentTaskId: z.string().uuid().optional(),
});

export const createTaskSchema = taskBaseSchema.refine(taskDateRangeRefine, {
  message: "End date must not be before start date",
  path: ["endDate"],
});

export const updateTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(taskDateRangeRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const createTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// Bulk task import. Each row references its project by name and an
// optional parent task by title (for subtasks). Owner isn't resolved on
// import (export emits a display name, which isn't a stable key) — tasks
// land unassigned. Capped high since one project can hold many tasks.
const importTaskRowSchema = z.object({
  project: z.string().min(1, "Project is required").max(300),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  status: z.string().max(100).optional(),
  priority: z
    .string()
    .max(50)
    .optional()
    .transform((v) => (v ? normalizeProjectTaskPriority(v) : undefined)),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  parentTitle: z.string().max(500).optional(),
});

export const importProjectTasksSchema = z.object({
  rows: z.array(importTaskRowSchema).min(1).max(2000),
});

export type ImportProjectTaskRow = z.infer<typeof importTaskRowSchema>;

// Combined import — one payload carrying projects with their nested
// tasks (the unified Project CRM export/import). Always create-new, so
// re-importing an existing project yields a duplicate (the front end's
// "create duplicate" requirement). Tasks attach to the project created
// in the same group, never to pre-existing same-name rows.
const combinedTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  status: z.string().max(100).optional(),
  priority: z
    .string()
    .max(50)
    .optional()
    .transform((v) => (v ? normalizeProjectTaskPriority(v) : undefined)),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  parentTitle: z.string().max(500).optional(),
});

const combinedProjectSchema = z.object({
  // For Legal CRM imports the "Legal Task" column maps here (may be
  // blank in the source spreadsheet — the task title lives in the
  // sibling `workstream` field instead). Allow an empty string so a
  // blank Legal-Task cell doesn't break the row; the service trims +
  // falls back to the workstream value when name is empty.
  name: z.string().max(300).default(""),
  status: projectStatusSchema.default("not_yet_started"),
  department: projectDepartmentSchema.nullable().optional(),
  dependency: z.string().max(200).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  goLiveDate: dateString.nullable().optional(),
  // Legal CRM import: the long task title from the "Workstream"
  // column of the Legal checklist xlsx.
  workstream: z.string().max(200).nullable().optional(),
  // Legal CRM import: free-text "Description" column. Maps to the
  // Legal-only `project.details` field (whitespace-preserved, multi-
  // line). The generic `description` field on Project is HTML-only
  // (Quill body) and isn't surfaced in the Legal list, so we route
  // the import to `details` instead.
  details: z.string().max(10000).nullable().optional(),
  tasks: z.array(combinedTaskSchema).max(2000).default([]),
});

export const importCombinedProjectsSchema = z.object({
  team: projectTeamSchema.default("general"),
  groups: z.array(combinedProjectSchema).min(1).max(500),
});

export type ImportCombinedProjectGroup = z.infer<typeof combinedProjectSchema>;
export type ImportCombinedProjectsInput = z.infer<
  typeof importCombinedProjectsSchema
>;

export const createColumnSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9_]+$/,
      "Key must be lowercase alphanumeric with underscores",
    ),
  label: z.string().min(1).max(100),
  color: z.string().max(50).default("bg-zinc-500"),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const updateColumnSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  color: z.string().max(50).optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const manageMembersSchema = z.object({
  memberIds: z.array(z.string().uuid()),
});

export const generateTasksSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  additionalContext: z.string().max(2000).optional(),
  // Optional reference files the AI reads to suggest tasks. Images + PDF
  // are passed to Gemini natively; office/text files are extracted to
  // text server-side. ~15MB base64 (~11MB binary) per file, max 8.
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(150),
        dataBase64: z.string().min(1).max(15_000_000),
      }),
    )
    .max(8)
    .optional(),
});

// ─── Milestones ─────────────────────────────────────────

const milestoneDateOrderRefine = <
  T extends { startDate?: string; endDate?: string },
>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

const MILESTONE_STATUSES = [
  "not_started",
  "in_progress",
  "done",
  "blocked",
] as const;

const milestoneBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional(),
  status: z.enum(MILESTONE_STATUSES).default("not_started"),
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const createMilestoneSchema = milestoneBaseSchema.refine(
  milestoneDateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateMilestoneSchema = milestoneBaseSchema
  .partial()
  .refine(milestoneDateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Multi-assign ───────────────────────────────────────

export const manageAssigneesSchema = z.object({
  // Replaces the full assignee set. Empty array clears all assignees.
  assignees: z
    .array(
      z.object({
        userId: z.string().uuid(),
        allocationPct: z.coerce.number().int().min(0).max(100).optional(),
      }),
    )
    .max(50),
});

// ─── Dependencies ───────────────────────────────────────

const DEPENDENCY_TYPES = [
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
  "start_to_finish",
] as const;

export const createDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
  type: z.enum(DEPENDENCY_TYPES).default("finish_to_start"),
});

// ─── Resources ──────────────────────────────────────────

const RESOURCE_KINDS = ["file", "link", "doc"] as const;

export const createResourceSchema = z
  .object({
    kind: z.enum(RESOURCE_KINDS),
    label: z.string().min(1).max(300),
    url: z.string().min(1).max(2000),
    docId: z.string().uuid().optional(),
  })
  .refine((d) => d.kind !== "doc" || !!d.docId, {
    message: "docId is required when kind is 'doc'",
    path: ["docId"],
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectQuery = z.infer<typeof projectQuerySchema>;
export type ReorderProjectsInput = z.infer<typeof reorderProjectsSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
export type ImportProjectsInput = z.infer<typeof importProjectsSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectTeam = z.infer<typeof projectTeamSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ManageMembersInput = z.infer<typeof manageMembersSchema>;
export type GenerateTasksInput = z.infer<typeof generateTasksSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type ManageAssigneesInput = z.infer<typeof manageAssigneesSchema>;
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
