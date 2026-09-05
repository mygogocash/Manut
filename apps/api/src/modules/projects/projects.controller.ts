import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { projectService } from "@/modules/projects/projects.service";
import {
  createColumnSchema,
  createDependencySchema,
  createMilestoneSchema,
  createProjectSchema,
  createResourceSchema,
  createTaskCommentSchema,
  createTaskSchema,
  generateTasksSchema,
  importCombinedProjectsSchema,
  importProjectsSchema,
  importProjectTasksSchema,
  manageAssigneesSchema,
  manageMembersSchema,
  moveProjectSchema,
  projectQuerySchema,
  reorderProjectsSchema,
  reorderTasksSchema,
  updateColumnSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  updateTaskSchema,
} from "@/modules/projects/projects.validation";
import { workflowService } from "@/modules/projects/workflow/workflow.service";
import {
  workflowActionSchema,
  workflowArchiveSchema,
  workflowEscalateSchema,
  workflowQuerySchema,
  workflowRejectSchema,
} from "@/modules/projects/workflow/workflow.validation";
import { workflowEmailService } from "@/modules/projects/workflow/workflow-email.service";

const router = Router();

router.use(authenticate, requireActive);

// Centralised perm bundles so every sub-route on `/projects/:id/*`
// accepts the broad `projects:*` codes AND every team-CRM equivalent.
// Tanatcha (HR, 2026-05-25) reported that opening Edit Project from
// /hr-crm let her change fields but the Owner / Members / column /
// task / milestone routes 403'd because they only accepted
// `projects:*`. Same pattern applies to IT / Product / Legal team
// members. Mirrors the fix #583 landed on the top-level CRUD routes
// — extended here to every sub-resource.
const PROJECT_READ_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
];

// Update / manage / delete-child rights. The service layer's
// `requireOwnerOrManage` still gates row-level edits per project
// (only the owner or someone with the matching team-CRM `:manage`
// perm passes), so this bundle is intentionally permissive — the
// route boundary only checks "is this caller allowed into this
// workspace at all?".
const PROJECT_WRITE_PERMS = [
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_UPDATE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_UPDATE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_UPDATE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_UPDATE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_UPDATE,
  PERMISSIONS.HR_CRM_MANAGE,
];

// ─── Project approval workflow ──────────────────────────
// Linear chain: Draft -> Pending PM -> Pending Business Head -> Pending
// Product Admin -> Pending Development -> Completed (any pending -> Rejected).
// The route guard only checks "may this caller see the project at all"; the
// stage-specific permission depends on the project's CURRENT state and is
// enforced inside the workflow service (same pattern as travel / cash-advance
// approval chains). These literal paths are registered BEFORE `/:id` so they
// are never swallowed by the id route (see CLAUDE.md route-order pitfall).

// One-click approval from an email. Deliberately UNAUTHENTICATED at the route
// level — the signed token IS the credential — so it is mounted on its own
// router below (outside the `authenticate` guard) rather than here.

// Delivery log for a request's emails.
router.get(
  "/:id/workflow/emails",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    // The delivery log carries recipient addresses, so it is scoped exactly
    // like the request it belongs to.
    await workflowService.assertCanViewRequest(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    const data = await workflowEmailService.listForProject(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// Re-attempt this request's failed emails.
router.post(
  "/:id/workflow/emails/retry",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await workflowService.assertCanViewRequest(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    const data = await workflowEmailService.retryFailed(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// Request queue for the five views. Literal path, declared before `/:id`.
router.get(
  "/workflow/queue",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const { view } = workflowQuerySchema.parse(req.query);
    const data = await workflowService.listQueue(
      req.user!.id,
      req.user!.permissions,
      view,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id/workflow",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await workflowService.getState(
      req.params.id as string,
      req.user!.permissions,
      req.user!.id,
    );
    res.json({ data });
  }),
);

// Everything the request detail page needs in one round trip.
router.get(
  "/:id/workflow/detail",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await workflowService.getRequestDetail(
      req.params.id as string,
      req.user!.permissions,
      req.user!.id,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/workflow/submit",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowActionSchema.parse(req.body);
    const data = await workflowService.submit(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/workflow/approve",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowActionSchema.parse(req.body);
    const data = await workflowService.approve(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/workflow/complete",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowActionSchema.parse(req.body);
    const data = await workflowService.complete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

// Project Manager: return a request to the requester for changes.
router.post(
  "/:id/workflow/return",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowRejectSchema.parse(req.body);
    const data = await workflowService.returnToRequester(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.reason,
      req,
    );
    res.json({ data });
  }),
);

// Project Manager: escalate to a named approver.
router.post(
  "/:id/workflow/escalate",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowEscalateSchema.parse(req.body);
    const data = await workflowService.escalate(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.escalateToId,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

// Project Manager: reopen a rejected request.
router.post(
  "/:id/workflow/reopen",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowActionSchema.parse(req.body);
    const data = await workflowService.reopen(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

// Project Manager: archive / unarchive. Archived projects are read-only.
router.post(
  "/:id/workflow/archive",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowArchiveSchema.parse(req.body);
    const data = await workflowService.setArchived(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.archived,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/workflow/reject",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const input = workflowRejectSchema.parse(req.body);
    const data = await workflowService.reject(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.reason,
      req,
    );
    res.json({ data });
  }),
);

// ─── Projects CRUD ──────────────────────────────────────

router.get(
  "/",
  // Read gate accepts the broad `projects:read*` AND every team-CRM
  // read perm. Without this, a user who holds only `hr-crm:read`
  // (no `projects:read`) lands on `/hr-crm`, the page issues
  // `GET /projects?team=hr`, and the route 403s before the
  // service-layer `accessibleByUserId` scoping ever runs. Tanny
  // (HR, 2026-05-25) hit exactly that — empty page + permission-
  // denied toast.
  requirePermission(
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_READ_ALL,
    PERMISSIONS.IT_CRM_READ,
    PERMISSIONS.IT_CRM_READ_ALL,
    PERMISSIONS.PRODUCT_CRM_READ,
    PERMISSIONS.PRODUCT_CRM_READ_ALL,
    PERMISSIONS.LEGAL_CRM_READ,
    PERMISSIONS.LEGAL_CRM_READ_ALL,
    PERMISSIONS.ACCOUNTING_CRM_READ,
    PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
    PERMISSIONS.HR_CRM_READ,
    PERMISSIONS.HR_CRM_READ_ALL,
  ),
  asyncHandler(async (req, res) => {
    const query = projectQuerySchema.parse(req.query);
    const result = await projectService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  // Team-scoped CRM perms (`it-crm:create`, `product-crm:create`) act
  // as create gates for non-admin team leads. The actual team value
  // on the row still comes from the request body — service-level
  // checks ensure a caller can't spawn a project in a workspace
  // they can't see.
  requirePermission(
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.IT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.HR_CRM_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const data = await projectService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal paths MUST come before `/:id` (see CLAUDE.md "Express
// route order" pitfall).
router.post(
  "/import",
  requirePermission(
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.IT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.HR_CRM_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importProjectsSchema.parse(req.body);
    const data = await projectService.importRows(req.user!.id, input.rows);
    res.status(201).json({ data });
  }),
);

// Flat task export / import. Literal `/tasks/*` paths MUST precede the
// `/:id` routes (Express matches in order) — see CLAUDE.md.
router.get(
  "/tasks/export",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = projectQuerySchema.parse(req.query);
    const data = await projectService.exportTasks(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.post(
  "/tasks/import",
  requirePermission(
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.IT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.HR_CRM_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importProjectTasksSchema.parse(req.body);
    const data = await projectService.importTasks(
      req.user!.id,
      req.user!.permissions,
      input.rows,
    );
    res.status(201).json({ data });
  }),
);

// Combined import — projects + their tasks in one payload (the unified
// Project CRM import). Create-new-only, so re-importing yields a copy.
router.post(
  "/import-combined",
  requirePermission(
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.IT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.HR_CRM_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importCombinedProjectsSchema.parse(req.body);
    const data = await projectService.importProjectsWithTasks(
      req.user!.id,
      input,
    );
    res.status(201).json({ data });
  }),
);

// Project CRM dashboard rollup — literal path MUST come before
// `/:id`, otherwise Express matches "dashboard" as a project id (see
// CLAUDE.md "Express route order" pitfall). Read-only aggregate over
// the same rows `GET /` exposes, scoped to `?team=<key>` (default
// `general` to match the BD workspace at /projects).
router.get(
  "/dashboard",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const teamParam =
      typeof req.query.team === "string" && req.query.team
        ? req.query.team
        : "general";
    const data = await projectService.dashboard(teamParam);
    res.json({ data });
  }),
);

// Bulk reorder — literal path MUST come before `/:id`, otherwise
// Express matches "reorder" as a project id (see CLAUDE.md "Express
// route order" pitfall).
router.put(
  "/reorder",
  requirePermission(
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.IT_CRM_UPDATE,
    PERMISSIONS.IT_CRM_MANAGE,
    PERMISSIONS.PRODUCT_CRM_UPDATE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.LEGAL_CRM_UPDATE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.HR_CRM_UPDATE,
    PERMISSIONS.HR_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const input = reorderProjectsSchema.parse(req.body);
    const data = await projectService.reorder(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  // Same rationale as `GET /` — accept every team-CRM read perm so
  // a user scoped to a single workspace can open a project detail
  // page without holding the broad `projects:read`. Service-level
  // ownership check still gates which rows they can see.
  requirePermission(
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_READ_ALL,
    PERMISSIONS.IT_CRM_READ,
    PERMISSIONS.IT_CRM_READ_ALL,
    PERMISSIONS.PRODUCT_CRM_READ,
    PERMISSIONS.PRODUCT_CRM_READ_ALL,
    PERMISSIONS.LEGAL_CRM_READ,
    PERMISSIONS.LEGAL_CRM_READ_ALL,
    PERMISSIONS.ACCOUNTING_CRM_READ,
    PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
    PERMISSIONS.HR_CRM_READ,
    PERMISSIONS.HR_CRM_READ_ALL,
  ),
  asyncHandler(async (req, res) => {
    const data = await projectService.getById(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// Owner-edit bypass: BD-feedback project owners (Employee role) need
// to drive their own projects without holding `projects:update`. The
// service-layer `requireOwnerOrManage` already enforces "owner OR
// projects:manage" — so this route just needs to let any project
// reader through and lean on the service for the real gate. Non-owners
// without `projects:update` / `projects:manage` still 403 in the
// service.
router.put(
  "/:id",
  requirePermission(
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_READ_ALL,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.IT_CRM_READ,
    PERMISSIONS.IT_CRM_READ_ALL,
    PERMISSIONS.IT_CRM_UPDATE,
    PERMISSIONS.IT_CRM_MANAGE,
    PERMISSIONS.PRODUCT_CRM_READ,
    PERMISSIONS.PRODUCT_CRM_READ_ALL,
    PERMISSIONS.PRODUCT_CRM_UPDATE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.LEGAL_CRM_READ,
    PERMISSIONS.LEGAL_CRM_READ_ALL,
    PERMISSIONS.LEGAL_CRM_UPDATE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.ACCOUNTING_CRM_READ,
    PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
    PERMISSIONS.ACCOUNTING_CRM_UPDATE,
    PERMISSIONS.ACCOUNTING_CRM_MANAGE,
    PERMISSIONS.HR_CRM_READ,
    PERMISSIONS.HR_CRM_READ_ALL,
    PERMISSIONS.HR_CRM_UPDATE,
    PERMISSIONS.HR_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const input = updateProjectSchema.parse(req.body);
    const data = await projectService.update(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  // Same owner-bypass rationale as PUT — service enforces
  // owner-or-manage; the route just needs to admit project readers.
  requirePermission(
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_READ_ALL,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.IT_CRM_READ,
    PERMISSIONS.IT_CRM_READ_ALL,
    PERMISSIONS.IT_CRM_DELETE,
    PERMISSIONS.IT_CRM_MANAGE,
    PERMISSIONS.PRODUCT_CRM_READ,
    PERMISSIONS.PRODUCT_CRM_READ_ALL,
    PERMISSIONS.PRODUCT_CRM_DELETE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.LEGAL_CRM_READ,
    PERMISSIONS.LEGAL_CRM_READ_ALL,
    PERMISSIONS.LEGAL_CRM_DELETE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.ACCOUNTING_CRM_READ,
    PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
    PERMISSIONS.ACCOUNTING_CRM_DELETE,
    PERMISSIONS.ACCOUNTING_CRM_MANAGE,
    PERMISSIONS.HR_CRM_READ,
    PERMISSIONS.HR_CRM_READ_ALL,
    PERMISSIONS.HR_CRM_DELETE,
    PERMISSIONS.HR_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    await projectService.delete(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data: { success: true } });
  }),
);

// Archive / restore — owner-or-manage (service-enforced). Same reader-admitting
// route bundle as DELETE /:id so any board reader reaches it and the service
// gates the row-level owner/manage check.
const PROJECT_ARCHIVE_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.PROJECTS_DELETE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.IT_CRM_DELETE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_DELETE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_DELETE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_DELETE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_DELETE,
  PERMISSIONS.HR_CRM_MANAGE,
] as const;

router.post(
  "/:id/archive",
  requirePermission(...PROJECT_ARCHIVE_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.archive(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(...PROJECT_ARCHIVE_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.unarchive(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// Move a project to another CRM module (currently → Partner CRM). Needs
// project write access AND partner-create rights; Admin bypasses both.
router.post(
  "/:id/move",
  requirePermission(...PROJECT_WRITE_PERMS),
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const input = moveProjectSchema.parse(req.body);
    const data = await projectService.moveProject(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

// ─── Members ────────────────────────────────────────────

router.get(
  "/:id/members",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.getMembers(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/members",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = manageMembersSchema.parse(req.body);
    const data = await projectService.setMembers(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// ─── Columns ────────────────────────────────────────────

router.post(
  "/:id/columns",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createColumnSchema.parse(req.body);
    const data = await projectService.addColumn(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/columns/:columnId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = updateColumnSchema.parse(req.body);
    const data = await projectService.updateColumn(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.columnId as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/columns/:columnId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await projectService.deleteColumn(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.columnId as string,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── AI Generate Tasks ──────────────────────────────────

router.post(
  "/:id/ai/generate-tasks",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = generateTasksSchema.parse(req.body);
    const data = await projectService.generateTasks(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// ─── Tasks ──────────────────────────────────────────────

router.post(
  "/:id/tasks",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createTaskSchema.parse(req.body);
    const data = await projectService.addTask(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

// Literal /reorder must register before the /:taskId routes — Express
// matches in order and would otherwise parse "reorder" as a taskId
// (CLAUDE.md route-order pitfall).
router.post(
  "/:id/tasks/reorder",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderTasksSchema.parse(req.body);
    const data = await projectService.reorderTasks(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id/tasks/:taskId/detail",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.getTaskDetail(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks/:taskId/comments",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createTaskCommentSchema.parse(req.body);
    const data = await projectService.addTaskComment(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = updateTaskSchema.parse(req.body);
    const data = await projectService.updateTask(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await projectService.deleteTask(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── Timeline (Gantt) ───────────────────────────────────

router.get(
  "/:id/timeline",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.getTimeline(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// ─── Milestones ─────────────────────────────────────────

router.get(
  "/:id/milestones",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.listMilestones(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/milestones",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createMilestoneSchema.parse(req.body);
    const data = await projectService.addMilestone(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/milestones/:milestoneId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = updateMilestoneSchema.parse(req.body);
    const data = await projectService.updateMilestone(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.milestoneId as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/milestones/:milestoneId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await projectService.deleteMilestone(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.milestoneId as string,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── Task assignees (multi-assign) ──────────────────────

router.put(
  "/:id/tasks/:taskId/assignees",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = manageAssigneesSchema.parse(req.body);
    const data = await projectService.setTaskAssignees(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      input,
    );
    res.json({ data });
  }),
);

// ─── Task dependencies ──────────────────────────────────

router.get(
  "/:id/tasks/:taskId/dependencies",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.listTaskDependencies(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks/:taskId/dependencies",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createDependencySchema.parse(req.body);
    const data = await projectService.addTaskDependency(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId/dependencies/:dependencyId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await projectService.removeTaskDependency(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      req.params.dependencyId as string,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── Task resources ─────────────────────────────────────

router.get(
  "/:id/tasks/:taskId/resources",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.listTaskResources(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks/:taskId/resources",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = createResourceSchema.parse(req.body);
    const data = await projectService.addTaskResource(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId/resources/:resourceId",
  requirePermission(...PROJECT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    await projectService.removeTaskResource(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      req.params.resourceId as string,
    );
    res.json({ data: { success: true } });
  }),
);

// Signed-URL download for file resources. Literal `/download` comes
// AFTER `/:resourceId` siblings but is a distinct verb, so Express'
// order rules are satisfied (DELETE :resourceId vs GET …/download).
router.get(
  "/:id/tasks/:taskId/resources/:resourceId/download",
  requirePermission(...PROJECT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const data = await projectService.getResourceDownloadUrl(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      req.params.taskId as string,
      req.params.resourceId as string,
    );
    res.json({ data });
  }),
);

export default router;
