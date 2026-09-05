import type { Prisma } from "@nexora/database";

import {
  AI_PROMPTS,
  GENERATE_TASKS_SCHEMA,
} from "@/common/constants/ai-prompts";
import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { GEMINI_MODELS, getGeminiClient } from "@/infrastructure/ai/gemini";
import { sendEmail } from "@/infrastructure/email/email.service";
import { projectTaskUnblockedEmail } from "@/infrastructure/email/templates";
import {
  type BucketName,
  createSignedUrl,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";
import {
  actorFromId,
  trackProjectCreatedServer,
  trackTaskCreatedServer,
  trackTaskStatusChangedServer,
} from "@/lib/events";
import { PORTAL_URL } from "@/lib/portal-url";
import { notifyModuleForTeam } from "@/modules/crm-shared/crm-modules";
import { notifyCrmTaskEvent } from "@/modules/crm-shared/crm-notifications";
import {
  deleteMirroredPartnerTask,
  mirrorProjectTaskToPartner,
  shouldSyncProjectToPartner,
} from "@/modules/partners/partner-workspace-sync";
import {
  normalizeProjectTaskPriority,
  PROJECT_TASK_PRIORITY_DEFAULT,
} from "@/modules/projects/project-task-priority";
import { projectRepository } from "@/modules/projects/projects.repository";
import type {
  CreateColumnInput,
  CreateDependencyInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateResourceInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  GenerateTasksInput,
  ImportCombinedProjectsInput,
  ImportProjectTaskRow,
  ManageAssigneesInput,
  ManageMembersInput,
  MoveProjectInput,
  ProjectQuery,
  ReorderProjectsInput,
  ReorderTasksInput,
  UpdateColumnInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from "@/modules/projects/projects.validation";
import { workflowService } from "@/modules/projects/workflow/workflow.service";
import {
  isApproved,
  isWorkflowTeam,
  WORKFLOW_STATUS,
} from "@/modules/projects/workflow/workflow.types";

/**
 * Keep the scalar `department` and the `departments` list in step.
 *
 * `department` stays authoritative as the PRIMARY department because the
 * dashboard groups on it and a scalar list cannot be grouped. Callers may send
 * either field:
 *   - `departments` given  -> array is the truth, `department` becomes its head
 *   - only `department`    -> the array mirrors it (or empties when cleared)
 * Sending neither leaves both untouched.
 */
/**
 * Task work is blocked until the request has been approved.
 *
 * The Kanban board and the approval chain are otherwise independent, which
 * meant a team could start building something that had not been signed off — or
 * that was later rejected. Gated on the workflow status, not the board status:
 * they answer different questions.
 *
 * `null` (a project predating the workflow) is deliberately allowed through, so
 * this cannot freeze existing boards.
 */
// Defined in workflow.types so the workflow module can use it without
// importing back into this service. Re-exported here because this is where
// callers expect to find it.
export { isWorkflowTeam };

function assertWorkStarted(project: {
  workflowStatus?: string | null;
  name?: string;
  team?: string | null;
}): void {
  // Only the workflow-owning team's boards are gated. Every other shared-board
  // CRM (HR, Legal, Accounting …) posts to the same `POST /api/projects`
  // endpoint and never had an approval step, so a stray workflow status must
  // not be able to freeze their tasks.
  if (!isWorkflowTeam(project.team)) return;
  const status = project.workflowStatus;
  if (status === null || status === undefined) return;
  // Approved (under either name) or delivered: work may proceed.
  if (isApproved(status) || status === WORKFLOW_STATUS.COMPLETED) {
    return;
  }
  throw new ForbiddenException(
    status === WORKFLOW_STATUS.REJECTED
      ? "This request was rejected — its board is read-only"
      : "This request is still awaiting approval, so its tasks cannot be changed yet",
  );
}

export function departmentWrite(input: {
  department?: string | null;
  departments?: string[];
}): { department?: string | null; departments?: string[] } {
  if (input.departments !== undefined) {
    // De-duplicate but keep the order the user picked — the first choice is
    // the primary one.
    const list = [...new Set(input.departments)];
    return { departments: list, department: list[0] ?? null };
  }
  if (input.department !== undefined) {
    return {
      department: input.department,
      departments: input.department ? [input.department] : [],
    };
  }
  return {};
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)\s*(above|previous)?/i,
  /you\s+are\s+now\s+a/i,
  /new\s+role|change\s+your\s+role|act\s+as/i,
  /system\s*prompt|reveal\s+(your|the)\s+(instructions?|prompt)/i,
  /\bdo\s+not\s+follow\b.*\brules?\b/i,
];

function sanitizeAIInput(text: string): string {
  let sanitized = text.trim().slice(0, 5000);
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[filtered]");
  }
  return sanitized;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 0;
  while (await projectRepository.findBySlug(slug)) {
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
}

function activityTrim(s: string | null | undefined, max = 500): string | null {
  if (s == null || s === "") return null;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
  { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
  {
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 2,
  },
  {
    key: "in_review",
    label: "In Review",
    color: "bg-purple-500",
    sortOrder: 3,
  },
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
];

async function requireParticipant(
  userId: string,
  projectId: string,
  userPermissions: string[] = [],
  team: string = "general",
): Promise<"owner" | "member" | "admin"> {
  if (userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL)) {
    // `projects:read-all` holders (HR / leadership) can open any
    // project even if they're not on the member list. Surfacing the
    // role as "admin" so callers that care about owner-only writes
    // still gate on the literal "owner" check.
    return "admin";
  }
  // IT-scoped projects open up to anyone with `it:read-all` (the
  // Helpdesk Kanban audience) or `it-crm:read-all` (the IT CRM
  // workspace audience). Product / Legal / HR-scoped projects mirror
  // the same pattern via their `*-crm:read-all` perm.
  if (
    team === "it" &&
    (userPermissions.includes(PERMISSIONS.IT_READ_ALL) ||
      userPermissions.includes(PERMISSIONS.IT_CRM_READ_ALL))
  ) {
    return "admin";
  }
  if (
    team === "product" &&
    userPermissions.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL)
  ) {
    return "admin";
  }
  if (
    team === "legal" &&
    userPermissions.includes(PERMISSIONS.LEGAL_CRM_READ_ALL)
  ) {
    return "admin";
  }
  if (
    team === "accounting" &&
    userPermissions.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL)
  ) {
    return "admin";
  }
  if (team === "hr" && userPermissions.includes(PERMISSIONS.HR_CRM_READ_ALL)) {
    return "admin";
  }
  const role = await projectRepository.findParticipantRole(projectId, userId);
  if (!role) {
    throw new ForbiddenException("You do not have access to this project");
  }
  return role;
}

function requireOwner(role: "owner" | "member" | null): void {
  if (role !== "owner") {
    throw new ForbiddenException("Only the project owner can do this");
  }
}

// BD-feedback round 4 — `update` and `delete` should not be
// owner-only. PMs / admins with `projects:manage` need to drive
// progress, status, dates, etc. on anyone's project; the route
// guard already gates the entry on `projects:update` /
// `projects:manage`. Members without the perm still 403 at the
// route boundary, so this just lifts the in-service owner-only
// constraint for the privileged path.
function requireOwnerOrManage(
  role: "owner" | "member" | null,
  perms: string[],
  team: string = "general",
): void {
  if (role === "owner") return;
  if (perms.includes(PERMISSIONS.PROJECTS_MANAGE)) return;
  // Team-specific manage perms unlock the same row-level edit / delete
  // privileges within their own workspace.
  if (team === "it" && perms.includes(PERMISSIONS.IT_CRM_MANAGE)) return;
  if (team === "product" && perms.includes(PERMISSIONS.PRODUCT_CRM_MANAGE)) {
    return;
  }
  if (team === "legal" && perms.includes(PERMISSIONS.LEGAL_CRM_MANAGE)) {
    return;
  }
  if (
    team === "accounting" &&
    perms.includes(PERMISSIONS.ACCOUNTING_CRM_MANAGE)
  ) {
    return;
  }
  if (team === "hr" && perms.includes(PERMISSIONS.HR_CRM_MANAGE)) {
    return;
  }
  throw new ForbiddenException(
    "Only the project owner or a project manager can do this",
  );
}

// A file uploaded to the AI task generator: images + PDF go to Gemini
// natively (inlineData); office/text files are extracted to text.
interface AiSourceFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

interface AiFileParts {
  // Gemini inlineData parts (images + PDF) read natively by the model.
  inlineParts: Array<{ inlineData: { mimeType: string; data: string } }>;
  // Text extracted from office/text documents, labelled by file name.
  textSections: string[];
}

// Extract plain text from an office or text document. Office formats use
// officeparser (loaded lazily); plain-text formats decode as UTF-8.
// Failures degrade to "" so one bad file never fails the whole request.
async function extractAiFileText(file: AiSourceFile): Promise<string> {
  const buf = Buffer.from(file.dataBase64, "base64");
  const mt = file.mimeType.toLowerCase();
  const name = file.name.toLowerCase();
  const isOffice =
    mt.includes("word") ||
    mt.includes("presentation") ||
    mt.includes("sheet") ||
    mt.includes("excel") ||
    mt.includes("powerpoint") ||
    mt.includes("officedocument") ||
    /\.(docx?|pptx?|xlsx?)$/.test(name);
  const isText =
    mt.startsWith("text/") ||
    mt.includes("json") ||
    mt.includes("csv") ||
    /\.(txt|csv|md|json)$/.test(name);
  try {
    if (isOffice) {
      const { parseOffice } = await import("officeparser");
      const ast = await parseOffice(buf);
      return ast.toText() || "";
    }
    if (isText) return buf.toString("utf-8");
  } catch (err) {
    logger.warn("AI source file extraction failed", { name: file.name, err });
  }
  return "";
}

async function buildAiFileParts(
  files: AiSourceFile[] | undefined,
): Promise<AiFileParts> {
  const inlineParts: AiFileParts["inlineParts"] = [];
  const textSections: string[] = [];
  for (const file of files ?? []) {
    const mt = file.mimeType.toLowerCase();
    if (mt.startsWith("image/") || mt === "application/pdf") {
      // Gemini reads images and PDFs directly from inline data.
      inlineParts.push({
        inlineData: { mimeType: file.mimeType, data: file.dataBase64 },
      });
      continue;
    }
    const text = await extractAiFileText(file);
    if (text.trim()) {
      textSections.push(`--- File: ${file.name} ---\n${text.slice(0, 20000)}`);
    }
  }
  return { inlineParts, textSections };
}

export class ProjectService {
  async list(userId: string, userPermissions: string[], query: ProjectQuery) {
    const { page, limit, ...filters } = query;
    // `projects:read-all` widens the scope to every project in the
    // workspace; everyone else only sees rows they own or are members
    // of. Mirrors the RBAC owner-vs-read-all pattern documented in
    // CLAUDE.md.
    const canSeeAll = userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    // IT-scoped lists open up to anyone with `it:read-all` (Helpdesk
    // team) or `it-crm:read-all` (IT CRM workspace). Product-scoped
    // lists mirror via `product-crm:read-all`. Only triggers when
    // the caller is explicitly filtering for that team — keeps the
    // general `/projects` call unaffected.
    const canSeeAllIt =
      filters.team === "it" &&
      (userPermissions.includes(PERMISSIONS.IT_READ_ALL) ||
        userPermissions.includes(PERMISSIONS.IT_CRM_READ_ALL));
    const canSeeAllProduct =
      filters.team === "product" &&
      userPermissions.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL);
    const canSeeAllLegal =
      filters.team === "legal" &&
      userPermissions.includes(PERMISSIONS.LEGAL_CRM_READ_ALL);
    const canSeeAllAccounting =
      filters.team === "accounting" &&
      userPermissions.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL);
    const canSeeAllHr =
      filters.team === "hr" &&
      userPermissions.includes(PERMISSIONS.HR_CRM_READ_ALL);
    const { data, total } = await projectRepository.findMany(
      {
        ...filters,
        accessibleByUserId:
          canSeeAll ||
          canSeeAllIt ||
          canSeeAllProduct ||
          canSeeAllLegal ||
          canSeeAllAccounting ||
          canSeeAllHr
            ? undefined
            : userId,
      },
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(userId: string, userPermissions: string[], idOrSlug: string) {
    let project = await projectRepository.findById(idOrSlug);
    if (!project) {
      project = await projectRepository.findBySlug(idOrSlug);
    }
    if (!project) {
      // A Legal / IT-CRM workstream created after the native-workspace
      // split lives only in its native table. Mirror it into `projects`
      // on first open, then re-read so the shared board can serve it.
      const mirrored =
        await projectRepository.mirrorNativeProjectIfNeeded(idOrSlug);
      if (mirrored) {
        project =
          (await projectRepository.findById(idOrSlug)) ??
          (await projectRepository.findBySlug(idOrSlug));
      }
    }
    if (!project) throw new NotFoundException("Project not found");
    await requireParticipant(userId, project.id, userPermissions, project.team);
    return project;
  }

  async create(ownerId: string, input: CreateProjectInput) {
    const slug = await uniqueSlug(generateSlug(input.name));
    const project = await projectRepository.create({
      name: input.name,
      slug,
      description: input.description,
      status: input.status,
      team: input.team,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      budget: input.budget,
      ...(input.customFields !== undefined && {
        customFields: input.customFields,
      }),
      // BD feedback (May 2026) — optional structured roll-out fields.
      ...(input.productionLiveDate !== undefined && {
        productionLiveDate: input.productionLiveDate
          ? new Date(input.productionLiveDate)
          : null,
      }),
      ...(input.goLiveDate !== undefined && {
        goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
      }),
      ...(input.revisedGoLiveDate !== undefined && {
        revisedGoLiveDate: input.revisedGoLiveDate
          ? new Date(input.revisedGoLiveDate)
          : null,
      }),
      ...(input.agreement !== undefined && { agreement: input.agreement }),
      ...(input.dependency !== undefined && { dependency: input.dependency }),
      ...(input.comment !== undefined && { comment: input.comment }),
      ...departmentWrite(input),
      ...(input.workstream !== undefined && {
        workstream: input.workstream || null,
      }),
      ...(input.details !== undefined && {
        details: input.details || null,
      }),
      ...(input.taskType !== undefined && {
        taskType: input.taskType || null,
      }),
      ...(input.assignedTeam !== undefined && {
        assignedTeam: input.assignedTeam || null,
      }),
      defaultAssigneeMode: input.defaultAssigneeMode,
      // Only retain a specific-user id in `user` mode.
      defaultAssigneeId:
        input.defaultAssigneeMode === "user"
          ? (input.defaultAssigneeId ?? null)
          : null,
      // BD round #2 — caller can target a different owner on create
      // (e.g. PM creating a project on behalf of an engineering lead).
      // Defaults to the caller when not supplied.
      owner: { connect: { id: input.ownerId ?? ownerId } },
      partner: input.partnerId
        ? { connect: { id: input.partnerId } }
        : undefined,
      columns: {
        createMany: { data: DEFAULT_COLUMNS },
      },
    });

    if (input.memberIds && input.memberIds.length > 0) {
      const allMemberIds = [...new Set([ownerId, ...input.memberIds])];
      await projectRepository.setMembers(project.id, allMemberIds);
    } else {
      await projectRepository.setMembers(project.id, [ownerId]);
    }

    try {
      const trackingActor = await actorFromId(ownerId);
      if (trackingActor) {
        trackProjectCreatedServer(trackingActor);
      }
    } catch {
      // analytics is best-effort
    }

    // Creating a project IS raising a request: submit it straight away so it
    // reaches an approver instead of sitting in a draft nobody looks at.
    // Routed through the workflow service rather than setting the column here,
    // so the transition log, audit entry and approver email all happen on the
    // one code path every other transition uses.
    //
    // Best-effort on purpose: the project has already been created and
    // committed, so a notification or logging failure must not fail the create
    // and leave the caller thinking nothing happened. It stays a draft and the
    // requester can submit it by hand.
    // Only for the workflow-owning team: the other shared-board CRMs create
    // through this same endpoint and must not acquire an approval gate.
    try {
      if (isWorkflowTeam(input.team)) {
        await workflowService.submit(project.id, ownerId, [
          PERMISSIONS.WORKFLOW_SUBMIT,
        ]);
      }
    } catch (err) {
      logger.warn("Auto-submit on project create failed; left as draft", {
        projectId: project.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Owner is always a participant — perms array is irrelevant for
    // post-create hydration, pass [] to satisfy the new signature.
    return this.getById(ownerId, [], project.id);
  }

  async importRows(ownerId: string, rows: CreateProjectInput[]) {
    // Create-new-only; reuse `create` per row for slug + columns +
    // owner membership. Sequential to keep slug generation race-free.
    let created = 0;
    for (const row of rows) {
      await this.create(ownerId, row);
      created++;
    }
    return { created };
  }

  async update(
    userId: string,
    userPermissions: string[],
    id: string,
    input: UpdateProjectInput,
  ) {
    const existing = await this.getById(userId, userPermissions, id);
    const role = await projectRepository.findParticipantRole(
      existing.id,
      userId,
    );
    // Relaxed from `requireOwner` so PMs / admins with
    // `projects:manage` can drive progress / status / dates / member
    // changes on any project. The route guard already requires
    // `projects:update` or `projects:manage`, so members without
    // either perm still 403 at the boundary.
    requireOwnerOrManage(role, userPermissions, existing.team);

    let slugUpdate = {};
    if (input.name !== undefined && input.name !== existing.name) {
      slugUpdate = { slug: await uniqueSlug(generateSlug(input.name)) };
    }

    // Normalize the auto-assign default: moving to a non-`user` mode clears
    // any stale specific-user id.
    const defaultAssigneeUpdate: {
      defaultAssigneeMode?: string;
      defaultAssigneeId?: string | null;
    } = {};
    if (input.defaultAssigneeMode !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeMode = input.defaultAssigneeMode;
      defaultAssigneeUpdate.defaultAssigneeId =
        input.defaultAssigneeMode === "user"
          ? (input.defaultAssigneeId ?? null)
          : null;
    } else if (input.defaultAssigneeId !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeId = input.defaultAssigneeId;
    }

    // Re-arm the deadline-reminder ladder when a go-live date is edited: the
    // fired rung markers ("golive-30" …) are tied to the OLD deadline, so a
    // slipped go-live must start its countdown fresh, or the cron would see the
    // new date land in an already-marked rung and stay silent. Mirrors the IT
    // CRM service (it-crm.service.ts). For native-mirror teams the edit is
    // also propagated to the native row below.
    const goLiveEdited =
      input.goLiveDate !== undefined || input.revisedGoLiveDate !== undefined;

    const updated = await projectRepository.update(existing.id, {
      ...slugUpdate,
      ...defaultAssigneeUpdate,
      ...(goLiveEdited && { remindersSent: [], lastReminderSentAt: null }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.team !== undefined && { team: input.team }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      ...(input.budget !== undefined && { budget: input.budget }),
      ...(input.progress !== undefined && { progress: input.progress }),
      ...(input.customFields !== undefined && {
        customFields: input.customFields,
      }),
      // BD feedback (May 2026)
      ...(input.productionLiveDate !== undefined && {
        productionLiveDate: input.productionLiveDate
          ? new Date(input.productionLiveDate)
          : null,
      }),
      ...(input.goLiveDate !== undefined && {
        goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
      }),
      ...(input.revisedGoLiveDate !== undefined && {
        revisedGoLiveDate: input.revisedGoLiveDate
          ? new Date(input.revisedGoLiveDate)
          : null,
      }),
      ...(input.agreement !== undefined && { agreement: input.agreement }),
      ...(input.dependency !== undefined && { dependency: input.dependency }),
      ...(input.comment !== undefined && { comment: input.comment }),
      ...departmentWrite(input),
      ...(input.workstream !== undefined && {
        workstream: input.workstream || null,
      }),
      ...(input.details !== undefined && {
        details: input.details || null,
      }),
      ...(input.taskType !== undefined && {
        taskType: input.taskType || null,
      }),
      ...(input.assignedTeam !== undefined && {
        assignedTeam: input.assignedTeam || null,
      }),
      // BD round #2 — transfer ownership. Gated by the same
      // `requireOwnerOrManage` check that protects the rest of update().
      ...(input.ownerId !== undefined && {
        owner: { connect: { id: input.ownerId } },
      }),
      ...(input.partnerId !== undefined && {
        partner: input.partnerId
          ? { connect: { id: input.partnerId } }
          : { disconnect: true },
      }),
    });

    if (input.memberIds !== undefined) {
      await projectRepository.setMembers(existing.id, input.memberIds);
    }

    // Native-mirror CRMs (it / legal / accounting / product): a go-live /
    // production date edited on the shared board must also land on the NATIVE row — the
    // CRM's own list page and the native reminder scans read that table, so
    // leaving it stale forked the data and kept the reminder ladder armed
    // against the old date. The repo helper no-ops for other teams or a
    // missing native row.
    if (goLiveEdited || input.productionLiveDate !== undefined) {
      await projectRepository.syncNativeGoLiveDates(
        existing.team,
        existing.id,
        {
          ...(input.goLiveDate !== undefined && {
            goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
          }),
          ...(input.revisedGoLiveDate !== undefined && {
            revisedGoLiveDate: input.revisedGoLiveDate
              ? new Date(input.revisedGoLiveDate)
              : null,
          }),
          ...(input.productionLiveDate !== undefined && {
            productionLiveDate: input.productionLiveDate
              ? new Date(input.productionLiveDate)
              : null,
          }),
        },
      );
    }

    return this.getById(userId, userPermissions, updated.id);
  }

  async delete(userId: string, userPermissions: string[], id: string) {
    const project = await this.getById(userId, userPermissions, id);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    // Same relaxation as `update` — admins with `projects:manage`
    // can delete any project.
    requireOwnerOrManage(role, userPermissions, project.team);

    // The cross-module delete-guard from #601 was retired in
    // Phase 4b — `Partner.primaryProjectId` no longer exists, so a
    // Project delete can no longer cascade into a Partner
    // workspace. Partner CRM owns its native tables now.
    return projectRepository.delete(project.id);
  }

  /**
   * Archive a project (Active/Archived board tabs, mirrors IT CRM). Owner-or-
   * manage, same gate as update/delete. Idempotent — a repeat archive keeps
   * the original timestamp. Orthogonal to the board `status`.
   */
  async archive(userId: string, userPermissions: string[], id: string) {
    // Resolve the row directly rather than through getById: that enforces
    // participation, which would reject a projects:manage holder before
    // requireOwnerOrManage below ever got the chance to allow them.
    const project = await projectRepository.findById(id);
    if (!project) throw new NotFoundException("Project not found");
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    return projectRepository.update(project.id, {
      archivedAt: project.archivedAt ?? new Date(),
    });
  }

  /** Restore an archived project to the active board. Owner-or-manage. */
  async unarchive(userId: string, userPermissions: string[], id: string) {
    // See archive() — participation must not gate a manage holder.
    const project = await projectRepository.findById(id);
    if (!project) throw new NotFoundException("Project not found");
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    return projectRepository.update(project.id, { archivedAt: null });
  }

  // Move a project into another CRM module. Partner is the only
  // cross-table target: the project + its board are copied into the
  // native partner_* tables and the source project is deleted. The
  // project name becomes the partner Company (admin may override).
  async moveProject(
    userId: string,
    userPermissions: string[],
    id: string,
    input: MoveProjectInput,
  ) {
    const project = await this.getById(userId, userPermissions, id);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);

    const company = (input.company ?? project.name).trim();
    if (!company) {
      throw new BadRequestException("Company name is required");
    }
    const partner = await projectRepository.moveToPartner(project.id, company);
    if (!partner) throw new NotFoundException("Project not found");
    return partner;
  }

  /**
   * Apply a new sort order across the caller's visible projects.
   * Ids the caller cannot access are silently dropped — keeps the
   * endpoint from leaking existence and avoids partial-success edge
   * cases. Sort_order is assigned strictly by submitted index, so the
   * client's drag-result array is the source of truth.
   */
  async reorder(
    userId: string,
    userPermissions: string[],
    input: ReorderProjectsInput,
  ) {
    // `projects:read-all` holders (HR / leadership) curate the global
    // list and so can reorder every id in the payload. Everyone else
    // is filtered down to ids they own or are a member of.
    const canSeeAll = userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const accessible = canSeeAll
      ? input.orderedIds
      : await projectRepository.filterAccessibleIds(userId, input.orderedIds);
    const items = accessible.map((id, idx) => ({ id, sortOrder: idx }));
    await projectRepository.applySortOrder(items);
    return { updated: items.length };
  }

  /**
   * Rollup snapshot for the Project CRM dashboard surface. Scoped by
   * `team` so each workspace (BD / IT / Product / Legal / HR) gets its
   * own view. Read-only and aggregates over the same rows the list
   * endpoint already exposes — the caller's `projects:read` (or team
   * equivalent) is enough; no extra permission gate at the service
   * layer.
   */
  async dashboard(team: string) {
    return projectRepository.dashboardSnapshot(team);
  }

  // ─── Members ──────────────────────────────────────────

  async setMembers(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: ManageMembersInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwner(role);
    return projectRepository.setMembers(project.id, input.memberIds);
  }

  async getMembers(
    userId: string,
    userPermissions: string[],
    projectId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    return projectRepository.getMembers(project.id);
  }

  // ─── Columns ──────────────────────────────────────────

  async addColumn(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: CreateColumnInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwner(role);
    return projectRepository.createColumn({
      projectId: project.id,
      key: input.key,
      label: input.label,
      color: input.color,
      sortOrder: input.sortOrder,
    });
  }

  async updateColumn(
    userId: string,
    userPermissions: string[],
    projectId: string,
    columnId: string,
    input: UpdateColumnInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwner(role);
    return projectRepository.updateColumn(columnId, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });
  }

  async deleteColumn(
    userId: string,
    userPermissions: string[],
    projectId: string,
    columnId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwner(role);
    return projectRepository.deleteColumn(columnId);
  }

  // ─── Tasks ────────────────────────────────────────────

  async addTask(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: CreateTaskInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    assertWorkStarted(project);
    if (input.parentTaskId) {
      const parent = await projectRepository.findTaskById(input.parentTaskId);
      if (!parent || parent.projectId !== project.id) {
        throw new NotFoundException("Parent task not found in this project");
      }
      // N-level nesting now allowed (was previously capped at 1 level).
      // Cycle prevention isn't needed on create — a newly-created row
      // cannot already be in its own ancestor chain.
    }
    if (input.milestoneId) {
      const ms = await projectRepository.findMilestoneById(input.milestoneId);
      if (!ms || ms.projectId !== project.id) {
        throw new NotFoundException("Milestone not found in this project");
      }
    }
    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    // CRM auto-assign default: when the creator leaves the owner + assignees
    // blank, fall back to the project's configured default (creator / owner /
    // specific user). An explicit owner or any explicit assignees always wins,
    // so it never silently overrides. Native-mirror CRMs (it / legal /
    // accounting) keep their config on their native table; the pure shared-
    // board CRMs (general / hr) keep it on the shared `projects` row.
    let ownerId = input.ownerId;
    if (!ownerId && !input.assigneeIds?.length) {
      if (project.team === "it") {
        ownerId =
          (await projectRepository.resolveItDefaultAssignee(
            project.id,
            userId,
          )) ?? undefined;
      } else if (project.team === "legal") {
        ownerId =
          (await projectRepository.resolveLegalDefaultAssignee(
            project.id,
            userId,
          )) ?? undefined;
      } else if (project.team === "accounting") {
        ownerId =
          (await projectRepository.resolveAccountingDefaultAssignee(
            project.id,
            userId,
          )) ?? undefined;
      } else if (project.team === "product") {
        ownerId =
          (await projectRepository.resolveProductDefaultAssignee(
            project.id,
            userId,
          )) ?? undefined;
      } else if (project.team === "general" || project.team === "hr") {
        ownerId =
          (await projectRepository.resolveProjectDefaultAssignee(
            project.id,
            userId,
          )) ?? undefined;
      }
    }

    const created = await projectRepository.createTask({
      projectId: project.id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      ownerId,
      startDate,
      endDate,
      milestoneId: input.milestoneId,
      sortOrder: input.sortOrder,
      parentTaskId: input.parentTaskId,
    });

    if (input.assigneeIds && input.assigneeIds.length > 0) {
      await projectRepository.setAssignees(
        created.id,
        input.assigneeIds.map((userId) => ({ userId })),
      );
    } else if (ownerId) {
      // Mirror legacy single-owner into the multi-assign table so the
      // assignees relation never lags behind.
      await projectRepository.setAssignees(created.id, [{ userId: ownerId }]);
    }

    if (input.parentTaskId) {
      await projectRepository.createActivities([
        {
          taskId: input.parentTaskId,
          actorId: userId,
          kind: "subtask_added",
          field: "subtask",
          oldValue: null,
          newValue: activityTrim(created.title, 500),
        },
      ]);
    }

    try {
      const trackingActor = await actorFromId(userId);
      if (trackingActor) {
        trackTaskCreatedServer(trackingActor, { project_id: project.id });
      }
    } catch {
      // analytics is best-effort
    }

    if (shouldSyncProjectToPartner(project)) {
      const assigneeIds = input.assigneeIds ?? (ownerId ? [ownerId] : []);
      await mirrorProjectTaskToPartner(project.partnerId, created, assigneeIds);
    }

    return created;
  }

  // ─── Task export / import ─────────────────────────────

  // Flat task dump for the Tasks export. Scopes to the same projects the
  // caller can see (reuses `list` access rules), then fetches all their
  // tasks (incl. subtasks) in one query.
  async exportTasks(
    userId: string,
    userPermissions: string[],
    query: ProjectQuery,
  ) {
    const { data: projects } = await this.list(userId, userPermissions, {
      ...query,
      page: 1,
      limit: 1000,
    });
    const tasks = await projectRepository.findTasksByProjectIds(
      projects.map((p) => p.id),
    );
    return tasks.map((t) => ({
      project: t.project?.name ?? "",
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      owner: t.owner?.name ?? "",
      startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : "",
      endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : "",
      parentTitle: t.parent?.title ?? "",
    }));
  }

  // Bulk task import. Rows reference their project by name (matched
  // case-insensitively within the caller's accessible set) and an
  // optional parent by title. Two passes per project: create top-level
  // tasks first so a subtask in the same batch can resolve its parent;
  // a subtask whose parent isn't in the batch lands as a top-level task
  // rather than being dropped.
  async importTasks(
    userId: string,
    userPermissions: string[],
    rows: ImportProjectTaskRow[],
  ) {
    const { data: projects } = await this.list(userId, userPermissions, {
      page: 1,
      limit: 1000,
    });
    const byName = new Map(
      projects.map((p) => [p.name.trim().toLowerCase(), p]),
    );

    const groups = new Map<string, ImportProjectTaskRow[]>();
    for (const row of rows) {
      const key = row.project.trim().toLowerCase();
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    let created = 0;
    let skipped = 0;
    for (const [key, group] of groups) {
      const project = byName.get(key);
      if (!project) {
        skipped += group.length;
        continue;
      }
      const titleToId = new Map<string, string>();
      const makeTask = async (row: ImportProjectTaskRow, parentId?: string) => {
        const task = await projectRepository.createTask({
          projectId: project.id,
          parentTaskId: parentId,
          title: row.title,
          description: row.description,
          status: row.status ?? "todo",
          priority: normalizeProjectTaskPriority(
            row.priority ?? PROJECT_TASK_PRIORITY_DEFAULT,
          ),
          startDate: row.startDate ? new Date(row.startDate) : undefined,
          endDate: row.endDate ? new Date(row.endDate) : undefined,
          sortOrder: 0,
        });
        titleToId.set(row.title.trim().toLowerCase(), task.id);
        created++;
      };
      for (const row of group.filter((r) => !r.parentTitle)) {
        await makeTask(row);
      }
      for (const row of group.filter((r) => r.parentTitle)) {
        const parentId = titleToId.get(row.parentTitle!.trim().toLowerCase());
        await makeTask(row, parentId);
      }
    }
    return { created, skipped };
  }

  // Combined import — projects WITH their tasks in one payload. Always
  // creates new rows (re-importing existing data yields a duplicate, per
  // the Project CRM "create duplicate" requirement). Each group's tasks
  // attach to the freshly-created project, never a pre-existing one, so
  // a duplicated project gets its own task tree.
  async importProjectsWithTasks(
    ownerId: string,
    input: ImportCombinedProjectsInput,
  ) {
    let projectsCreated = 0;
    let tasksCreated = 0;
    for (const group of input.groups) {
      // Legal CRM import allows a blank `name` (the "Legal Task"
      // column is often empty in the source xlsx). Fall back to the
      // workstream so the project still has a sortable display name
      // — matches what the Legal list shows in its second column.
      const resolvedName =
        group.name.trim() || group.workstream?.trim() || "Untitled";
      const project = await this.create(ownerId, {
        name: resolvedName,
        status: group.status,
        team: input.team,
        department: group.department ?? undefined,
        dependency: group.dependency ?? undefined,
        comment: group.comment ?? undefined,
        goLiveDate: group.goLiveDate ?? undefined,
        workstream: group.workstream ?? undefined,
        details: group.details ?? undefined,
      });
      projectsCreated++;

      const titleToId = new Map<string, string>();
      const makeTask = async (
        task: ImportCombinedProjectsInput["groups"][number]["tasks"][number],
        parentId?: string,
      ) => {
        const created = await projectRepository.createTask({
          projectId: project.id,
          parentTaskId: parentId,
          title: task.title,
          description: task.description,
          status: task.status ?? "todo",
          priority: normalizeProjectTaskPriority(
            task.priority ?? PROJECT_TASK_PRIORITY_DEFAULT,
          ),
          startDate: task.startDate ? new Date(task.startDate) : undefined,
          endDate: task.endDate ? new Date(task.endDate) : undefined,
          sortOrder: 0,
        });
        titleToId.set(task.title.trim().toLowerCase(), created.id);
        tasksCreated++;
      };
      for (const task of group.tasks.filter((t) => !t.parentTitle)) {
        await makeTask(task);
      }
      for (const task of group.tasks.filter((t) => t.parentTitle)) {
        const parentId = titleToId.get(task.parentTitle!.trim().toLowerCase());
        await makeTask(task, parentId);
      }
    }
    return {
      projectsCreated,
      tasksCreated,
      created: projectsCreated + tasksCreated,
    };
  }

  async updateTask(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    assertWorkStarted(project);
    const before = await projectRepository.findTaskWithOwner(taskId);
    if (!before || before.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }

    const data: Prisma.ProjectTaskUpdateInput = {};
    const activities: Prisma.ProjectTaskActivityCreateManyInput[] = [];

    const pushField = (
      field: string,
      oldVal: string | null,
      newVal: string | null,
    ) => {
      activities.push({
        taskId,
        actorId: userId,
        kind: "field_change",
        field,
        oldValue: oldVal,
        newValue: newVal,
      });
    };

    if (input.title !== undefined && input.title !== before.title) {
      data.title = input.title;
      pushField(
        "title",
        activityTrim(before.title, 800),
        activityTrim(input.title, 800),
      );
    }
    if (input.description !== undefined) {
      const prev = before.description ?? "";
      if (input.description !== prev) {
        data.description = input.description;
        pushField(
          "description",
          activityTrim(prev, 400),
          activityTrim(input.description ?? "", 400),
        );
      }
    }
    if (input.status !== undefined && input.status !== before.status) {
      data.status = input.status;
      pushField("status", before.status, input.status);
    }
    if (input.priority !== undefined && input.priority !== before.priority) {
      data.priority = input.priority;
      pushField("priority", before.priority, input.priority);
    }
    if (input.ownerId !== undefined) {
      const prev = before.ownerId ?? null;
      const next = input.ownerId ?? null;
      if (prev !== next) {
        data.owner = next ? { connect: { id: next } } : { disconnect: true };
        pushField("assignee", prev, next);
      }
    }
    if (input.startDate !== undefined) {
      const prev = before.startDate
        ? before.startDate.toISOString().slice(0, 10)
        : null;
      const next = input.startDate ?? null;
      if (prev !== next) {
        data.startDate = input.startDate ? new Date(input.startDate) : null;
        pushField("startDate", prev, next);
      }
    }
    if (input.endDate !== undefined) {
      const prev = before.endDate
        ? before.endDate.toISOString().slice(0, 10)
        : null;
      const next = input.endDate ?? null;
      if (prev !== next) {
        data.endDate = input.endDate ? new Date(input.endDate) : null;
        pushField("endDate", prev, next);
        // Re-arm the IT CRM deadline-reminder ladder: the fired "due-*" rung
        // markers are tied to the old date, so a moved due date must restart
        // its countdown. Harmless for non-IT tasks (their column is unused).
        data.remindersSent = [];
        data.lastReminderSentAt = null;
      }
    }
    if (input.milestoneId !== undefined) {
      const prev = before.milestoneId ?? null;
      const next = input.milestoneId ?? null;
      if (prev !== next) {
        if (next) {
          const ms = await projectRepository.findMilestoneById(next);
          if (!ms || ms.projectId !== project.id) {
            throw new NotFoundException("Milestone not found in this project");
          }
        }
        data.milestone = next
          ? { connect: { id: next } }
          : { disconnect: true };
        pushField("milestone", prev, next);
      }
    }
    if (input.sortOrder !== undefined && input.sortOrder !== before.sortOrder) {
      data.sortOrder = input.sortOrder;
    }

    // Multi-assign replacement is handled outside the field-change
    // activity log because it's a set-diff, not a scalar swap. Emit a
    // single `assignees_changed` row instead.
    let assigneeChanged = false;
    if (input.assigneeIds !== undefined) {
      const currentRows = await projectRepository.listAssignees(taskId);
      const currentIds = new Set(currentRows.map((r) => r.userId));
      const nextIds = new Set(input.assigneeIds);
      const added = [...nextIds].filter((id) => !currentIds.has(id));
      const removed = [...currentIds].filter((id) => !nextIds.has(id));
      if (added.length > 0 || removed.length > 0) {
        assigneeChanged = true;
        activities.push({
          taskId,
          actorId: userId,
          kind: "assignees_changed",
          field: "assignees",
          oldValue: activityTrim([...currentIds].join(","), 800),
          newValue: activityTrim(input.assigneeIds.join(","), 800),
        });
      }
    }

    if (
      Object.keys(data).length === 0 &&
      activities.length === 0 &&
      !assigneeChanged
    ) {
      return before;
    }

    const result =
      Object.keys(data).length > 0
        ? activities.length > 0
          ? await projectRepository.updateTaskAndLog(taskId, data, activities)
          : await projectRepository.updateTask(taskId, data)
        : before;

    // When data was empty but activities exist (e.g. assignees-only
    // change), still persist the activity rows.
    if (Object.keys(data).length === 0 && activities.length > 0) {
      await projectRepository.createActivities(activities);
    }

    if (assigneeChanged && input.assigneeIds) {
      await projectRepository.setAssignees(
        taskId,
        input.assigneeIds.map((userId) => ({ userId })),
      );
    }

    if (input.status !== undefined && input.status !== before.status) {
      try {
        const trackingActor = await actorFromId(userId);
        if (trackingActor) {
          trackTaskStatusChangedServer(trackingActor, {
            task_id: taskId,
            from_status: before.status,
            to_status: input.status,
          });
        }
      } catch {
        // analytics is best-effort
      }

      // Phase 4: when a task flips to `done`, email everyone assigned
      // to a task that was blocked by this one. Best-effort; we don't
      // surface email failures to the caller.
      if (input.status === "done" && before.status !== "done") {
        void this.notifyUnblocked(taskId, before.title);
      }

      // CRM update notifications (bell + email) — enabled board CRMs only.
      const notifyModule = notifyModuleForTeam(project.team);
      if (notifyModule) {
        const statusLabel = (input.status ?? "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        void notifyCrmTaskEvent({
          module: notifyModule,
          type: "task_status",
          projectId: project.id,
          projectName: project.name,
          taskId,
          taskTitle: before.title,
          actorId: userId,
          summary: `moved it to ${statusLabel}`,
        });
      }
    }

    // CRM reassignment notification — covers BOTH the primary-assignee
    // (ownerId) change and the multi-assign (assigneeIds) change made through
    // updateTask, not just the dedicated setTaskAssignees route. Fires after
    // the writes above, so notifyCrmTaskEvent re-reads the new assignee set.
    const ownerChanged =
      input.ownerId !== undefined && input.ownerId !== (before.ownerId ?? null);
    const reassignModule = notifyModuleForTeam(project.team);
    if (reassignModule && (ownerChanged || assigneeChanged)) {
      void notifyCrmTaskEvent({
        module: reassignModule,
        type: "task_assigned",
        projectId: project.id,
        projectName: project.name,
        taskId,
        taskTitle: before.title,
        actorId: userId,
        summary: "updated the assignees on",
      });
    }

    if (shouldSyncProjectToPartner(project)) {
      const latest =
        Object.keys(data).length > 0
          ? await projectRepository.findTaskById(taskId)
          : before;
      if (latest) {
        const assigneeIds =
          input.assigneeIds !== undefined
            ? input.assigneeIds
            : (await projectRepository.listAssignees(taskId)).map(
                (row) => row.userId,
              );
        await mirrorProjectTaskToPartner(
          project.partnerId,
          latest,
          assigneeIds,
        );
      }
    }

    return result;
  }

  private async notifyUnblocked(
    completedTaskId: string,
    completedTaskTitle: string,
  ): Promise<void> {
    try {
      const dependents =
        await projectRepository.listDependentsWithAssignees(completedTaskId);
      if (dependents.length === 0) return;

      for (const dep of dependents) {
        // Skip notifying about a dependent that's already done — no
        // unblock value if the work is already wrapped.
        if (dep.task.status === "done") continue;

        // Recipient set = every assignee email plus the legacy owner
        // (covers single-owner tasks created before Phase 2's
        // multi-assign mirror filled the table).
        const recipients = new Set<string>();
        for (const a of dep.task.assignees) {
          if (a.user.email) recipients.add(a.user.email);
        }
        if (dep.task.owner?.email) recipients.add(dep.task.owner.email);
        if (recipients.size === 0) continue;

        const projectName = dep.task.project.name;
        const emailContent = projectTaskUnblockedEmail({
          completedTaskTitle,
          projectName,
          taskTitle: dep.task.title,
          portalUrl: `${PORTAL_URL}/projects/${dep.task.project.id}`,
        });
        await sendEmail({
          to: [...recipients],
          ...emailContent,
        });
      }
    } catch (err) {
      logger.error("Failed to send unblock notification", { err });
    }
  }

  /**
   * Persist the rep's drag-result for tasks on the board. `orderedIds`
   * is the target column's task list in the order the rep dropped
   * them; when `status` is supplied every id is also moved into that
   * column in the same transaction (Trello-style cross-column drop at
   * position). Anyone with project access can reorder — the same gate
   * that lets them open the board lets them rearrange it.
   */
  async reorderTasks(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: ReorderTasksInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    assertWorkStarted(project);
    const owned = await projectRepository.findTaskIdsInProject(
      project.id,
      input.orderedIds,
    );
    if (owned.length !== input.orderedIds.length) {
      throw new NotFoundException(
        "One or more task ids don't belong to this project",
      );
    }
    const items = input.orderedIds.map((id, idx) => ({ id, sortOrder: idx }));
    await projectRepository.applyTaskSortOrder(items, input.status);
    return { updated: items.length };
  }

  async deleteTask(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    assertWorkStarted(project);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    if (task.parentTaskId) {
      await projectRepository.createActivities([
        {
          taskId: task.parentTaskId,
          actorId: userId,
          kind: "subtask_removed",
          field: "subtask",
          oldValue: activityTrim(task.title, 500),
          newValue: null,
        },
      ]);
    }
    const deleted = await projectRepository.deleteTask(taskId);
    if (shouldSyncProjectToPartner(project)) {
      await deleteMirroredPartnerTask(taskId);
    }
    return deleted;
  }

  async getTaskDetail(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const row = await projectRepository.findTaskForDetail(taskId);
    if (!row || row.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const subtasks = row.parentTaskId
      ? []
      : await projectRepository.listSubtasks(row.id);
    const threadIds = row.parentTaskId
      ? [row.id]
      : [row.id, ...subtasks.map((s) => s.id)];
    const [comments, activities] = await Promise.all([
      projectRepository.listCommentsForTasks(threadIds),
      projectRepository.listActivitiesForTasks(threadIds),
    ]);
    return { task: row, subtasks, comments, activities };
  }

  async addTaskComment(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    input: CreateTaskCommentInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const comment = await projectRepository.createComment({
      taskId,
      authorId: userId,
      body: input.body.trim(),
    });

    // CRM update notifications — enabled board CRMs only.
    const commentModule = notifyModuleForTeam(project.team);
    if (commentModule) {
      void notifyCrmTaskEvent({
        module: commentModule,
        type: "task_comment",
        projectId: project.id,
        projectName: project.name,
        taskId,
        taskTitle: task.title,
        actorId: userId,
        summary: "commented on",
      });
    }
    return comment;
  }

  // ─── AI Generate Tasks ──────────────────────────────────

  async generateTasks(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: GenerateTasksInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);

    const columns = await projectRepository.getColumns(project.id);
    const availableStatuses =
      columns.length > 0
        ? columns.map((c) => c.key)
        : ["backlog", "todo", "in_progress", "in_review", "done"];

    const systemPrompt = AI_PROMPTS.GENERATE_TASKS_SYSTEM.replace(
      "{{AVAILABLE_STATUSES}}",
      availableStatuses.map((s) => `"${s}"`).join(", "),
    );

    const sanitizedDescription = sanitizeAIInput(input.description);
    const sanitizedContext = input.additionalContext
      ? sanitizeAIInput(input.additionalContext)
      : "";

    const additionalContext = sanitizedContext
      ? `Additional Context: ${sanitizedContext}`
      : "";

    const userPrompt = AI_PROMPTS.GENERATE_TASKS_USER.replace(
      "{{PROJECT_NAME}}",
      sanitizeAIInput(project.name),
    )
      .replace("{{PROJECT_DESCRIPTION}}", sanitizedDescription)
      .replace("{{ADDITIONAL_CONTEXT}}", additionalContext);

    // Reference files (images/PDF read natively; office/text extracted).
    const { inlineParts, textSections } = await buildAiFileParts(
      input.files as AiSourceFile[] | undefined,
    );
    const finalPrompt =
      textSections.length > 0
        ? `${userPrompt}\n\nReference documents (extracted):\n${textSections.join(
            "\n\n",
          )}`
        : userPrompt;

    try {
      const gemini = getGeminiClient();

      const response = await gemini.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: [
          { role: "user", parts: [{ text: finalPrompt }, ...inlineParts] },
        ],
        config: {
          maxOutputTokens: 4096,
          temperature: 0.7,
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: GENERATE_TASKS_SCHEMA,
        },
      });

      const raw = response.text ?? "";
      const parsed = JSON.parse(raw) as {
        tasks: Array<{
          title: string;
          description: string;
          priority: string;
          status: string;
        }>;
      };

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new BadRequestException("AI returned an invalid response format");
      }

      const statusSet = new Set(availableStatuses);

      const tasks = parsed.tasks.map((t, index) => ({
        title: String(t.title).slice(0, 500),
        description: String(t.description).slice(0, 10000),
        priority: normalizeProjectTaskPriority(t.priority),
        status: statusSet.has(t.status) ? t.status : availableStatuses[0],
        sortOrder: index,
      }));

      return { tasks };
    } catch (err) {
      logger.error("AI task generation failed", err);

      const isConfigError =
        err instanceof Error && err.message.includes("API key not configured");

      if (isConfigError) {
        throw new InternalServerErrorException(
          "AI is not configured. Ask your administrator to set the GEMINI_API_KEY.",
        );
      }

      // Re-throw HTTP exceptions unchanged (e.g. the BadRequestException above).
      if (err instanceof BadRequestException) throw err;

      throw new BadRequestException(
        "Failed to generate tasks. Please try again.",
      );
    }
  }

  // ─── Milestones ─────────────────────────────────────────

  async listMilestones(
    userId: string,
    userPermissions: string[],
    projectId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    return projectRepository.listMilestones(project.id);
  }

  async addMilestone(
    userId: string,
    userPermissions: string[],
    projectId: string,
    input: CreateMilestoneInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    return projectRepository.createMilestone({
      projectId: project.id,
      title: input.title,
      description: input.description,
      status: input.status,
      ownerId: input.ownerId,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      sortOrder: input.sortOrder,
    });
  }

  async updateMilestone(
    userId: string,
    userPermissions: string[],
    projectId: string,
    milestoneId: string,
    input: UpdateMilestoneInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const existing = await projectRepository.findMilestoneById(milestoneId);
    if (!existing || existing.projectId !== project.id) {
      throw new NotFoundException("Milestone not found in this project");
    }
    return projectRepository.updateMilestone(milestoneId, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.ownerId !== undefined && {
        owner: input.ownerId
          ? { connect: { id: input.ownerId } }
          : { disconnect: true },
      }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });
  }

  async deleteMilestone(
    userId: string,
    userPermissions: string[],
    projectId: string,
    milestoneId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const existing = await projectRepository.findMilestoneById(milestoneId);
    if (!existing || existing.projectId !== project.id) {
      throw new NotFoundException("Milestone not found in this project");
    }
    return projectRepository.deleteMilestone(milestoneId);
  }

  // ─── Assignees (multi-assign) ───────────────────────────

  async setTaskAssignees(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    input: ManageAssigneesInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const before = await projectRepository.listAssignees(taskId);
    // Zod's inferred output type widens `userId` to optional because
    // of `.optional()` siblings interacting with the `.max(50)` array
    // wrapper. Map explicitly so the repo signature (userId required)
    // stays strict.
    const rows = input.assignees.map((a) => ({
      userId: a.userId,
      allocationPct: a.allocationPct,
    }));
    const result = await projectRepository.setAssignees(taskId, rows);
    const beforeIds = before
      .map((r) => r.userId)
      .sort()
      .join(",");
    const afterIds = rows
      .map((a) => a.userId)
      .sort()
      .join(",");
    if (beforeIds !== afterIds) {
      await projectRepository.createActivities([
        {
          taskId,
          actorId: userId,
          kind: "assignees_changed",
          field: "assignees",
          oldValue: activityTrim(beforeIds, 800),
          newValue: activityTrim(afterIds, 800),
        },
      ]);

      // CRM update notifications — enabled board CRMs only. Fires against the
      // NEW assignee set (notifyCrmTaskEvent re-reads assignees), so a freshly
      // assigned person is notified.
      const setAssigneesModule = notifyModuleForTeam(project.team);
      if (setAssigneesModule) {
        void notifyCrmTaskEvent({
          module: setAssigneesModule,
          type: "task_assigned",
          projectId: project.id,
          projectName: project.name,
          taskId,
          taskTitle: task.title,
          actorId: userId,
          summary: "updated the assignees on",
        });
      }
    }
    return result;
  }

  // ─── Dependencies ───────────────────────────────────────

  /**
   * Iterative DFS over (task_id → depends_on_task_id) edges. Returns
   * true if adding `taskId → dependsOnTaskId` would create a cycle.
   *
   * A cycle exists if `taskId` is already reachable from
   * `dependsOnTaskId` — i.e. the predecessor can already (transitively)
   * be blocked by the dependent we're about to add.
   */
  private dependencyWouldCycle(
    edges: Array<{ taskId: string; dependsOnTaskId: string }>,
    taskId: string,
    dependsOnTaskId: string,
  ): boolean {
    if (taskId === dependsOnTaskId) return true;
    // Build adjacency list: who does `key` depend on?
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.taskId)) adj.set(e.taskId, []);
      adj.get(e.taskId)!.push(e.dependsOnTaskId);
    }
    // DFS from `dependsOnTaskId`. If we ever reach `taskId`, that
    // means `dependsOnTaskId` is already blocked (directly or
    // transitively) by `taskId` — adding the new edge would close the
    // loop.
    const stack: string[] = [dependsOnTaskId];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node === taskId) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      const neighbours = adj.get(node);
      if (neighbours) stack.push(...neighbours);
    }
    return false;
  }

  async listTaskDependencies(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    return projectRepository.listDependencies(taskId);
  }

  async addTaskDependency(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    input: CreateDependencyInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const predecessor = await projectRepository.findTaskById(
      input.dependsOnTaskId,
    );
    if (!predecessor || predecessor.projectId !== project.id) {
      throw new NotFoundException("Predecessor task not found in this project");
    }
    if (taskId === input.dependsOnTaskId) {
      throw new BadRequestException("Task cannot depend on itself");
    }
    const edges = await projectRepository.listProjectDependencyEdges(
      project.id,
    );
    if (this.dependencyWouldCycle(edges, taskId, input.dependsOnTaskId)) {
      throw new BadRequestException(
        "Adding this dependency would create a cycle",
      );
    }
    const created = await projectRepository.createDependency({
      taskId,
      dependsOnTaskId: input.dependsOnTaskId,
      type: input.type,
    });
    await projectRepository.createActivities([
      {
        taskId,
        actorId: userId,
        kind: "dependency_added",
        field: "dependency",
        oldValue: null,
        newValue: activityTrim(predecessor.title, 500),
      },
    ]);
    return created;
  }

  async removeTaskDependency(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    dependencyId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const dep = await projectRepository.findDependencyById(dependencyId);
    if (!dep || dep.taskId !== taskId) {
      throw new NotFoundException("Dependency not found");
    }
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    await projectRepository.deleteDependency(dependencyId);
    await projectRepository.createActivities([
      {
        taskId,
        actorId: userId,
        kind: "dependency_removed",
        field: "dependency",
        oldValue: dep.dependsOnTaskId,
        newValue: null,
      },
    ]);
    return { success: true };
  }

  // ─── Resources ──────────────────────────────────────────

  async listTaskResources(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    return projectRepository.listResources(taskId);
  }

  async addTaskResource(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    input: CreateResourceInput,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const created = await projectRepository.createResource({
      taskId,
      kind: input.kind,
      label: input.label,
      url: input.url,
      docId: input.docId,
      createdBy: userId,
    });
    await projectRepository.createActivities([
      {
        taskId,
        actorId: userId,
        kind: "resource_added",
        field: "resource",
        oldValue: null,
        newValue: activityTrim(`${input.kind}:${input.label}`, 500),
      },
    ]);
    return created;
  }

  async removeTaskResource(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    resourceId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    const role = await projectRepository.findParticipantRole(
      project.id,
      userId,
    );
    requireOwnerOrManage(role, userPermissions, project.team);
    const resource = await projectRepository.findResourceById(resourceId);
    if (!resource || resource.taskId !== taskId) {
      throw new NotFoundException("Resource not found");
    }
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    await projectRepository.deleteResource(resourceId);
    await projectRepository.createActivities([
      {
        taskId,
        actorId: userId,
        kind: "resource_removed",
        field: "resource",
        oldValue: activityTrim(`${resource.kind}:${resource.label}`, 500),
        newValue: null,
      },
    ]);
    return { success: true };
  }

  // ─── Resource download (signed URL) ────────────────────

  async getResourceDownloadUrl(
    userId: string,
    userPermissions: string[],
    projectId: string,
    taskId: string,
    resourceId: string,
  ): Promise<{ url: string }> {
    const project = await this.getById(userId, userPermissions, projectId);
    const task = await projectRepository.findTaskById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException("Task not found in this project");
    }
    const resource = await projectRepository.findResourceById(resourceId);
    if (!resource || resource.taskId !== taskId) {
      throw new NotFoundException("Resource not found");
    }
    // Link / doc kinds are just plain URLs — caller can open them
    // directly. Only files need a signed-URL round-trip.
    if (resource.kind !== "file") {
      return { url: resource.url };
    }
    const parsed = parseStorageUrl(resource.url);
    if (!parsed) {
      // Best-effort: if the stored URL isn't a parseable Supabase
      // public URL, just return whatever's stored. Lets manual rows
      // (legacy import) keep working.
      return { url: resource.url };
    }
    const signed = await createSignedUrl(
      parsed.bucket as BucketName,
      parsed.path,
    );
    return { url: signed };
  }

  // ─── Timeline snapshot ──────────────────────────────────

  async getTimeline(
    userId: string,
    userPermissions: string[],
    projectId: string,
  ) {
    const project = await this.getById(userId, userPermissions, projectId);
    return projectRepository.getTimelineSnapshot(project.id);
  }
}

export const projectService = new ProjectService();
