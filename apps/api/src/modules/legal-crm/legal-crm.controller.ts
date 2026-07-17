import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { legalCrmService } from "@/modules/legal-crm/legal-crm.service";
import {
  createLegalProjectColumnSchema,
  createLegalProjectSchema,
  createLegalProjectTaskCommentSchema,
  createLegalProjectTaskSchema,
  importLegalProjectsSchema,
  legalProjectQuerySchema,
  manageLegalProjectMembersSchema,
  manageLegalProjectTaskAssigneesSchema,
  reorderLegalProjectsSchema,
  updateLegalProjectColumnSchema,
  updateLegalProjectSchema,
  updateLegalProjectTaskSchema,
} from "@/modules/legal-crm/legal-crm.validation";

const router = Router();

router.use(authenticate, requireActive);

// Permission bundles — accept the existing legal-crm:* set, plus broad
// projects:* fallback so admins / read-all holders work without an
// extra role grant.
const IT_READ_PERMS = [
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
];

const IT_WRITE_PERMS = [
  PERMISSIONS.LEGAL_CRM_UPDATE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
];

// ─── Project CRUD ────────────────────────────────────────────

router.get(
  "/",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = legalProjectQuerySchema.parse(req.query);
    const result = await legalCrmService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = createLegalProjectSchema.parse(req.body);
    const data = await legalCrmService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal paths before `:id` — Express matches in order.
router.post(
  "/import",
  requirePermission(
    PERMISSIONS.LEGAL_CRM_CREATE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importLegalProjectsSchema.parse(req.body);
    const data = await legalCrmService.importRows(req.user!.id, input.rows);
    res.status(201).json({ data });
  }),
);

router.put(
  "/reorder",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderLegalProjectsSchema.parse(req.body);
    const data = await legalCrmService.reorder(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await legalCrmService.getById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(...IT_READ_PERMS, ...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateLegalProjectSchema.parse(req.body);
    const data = await legalCrmService.update(
      id,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(
    ...IT_READ_PERMS,
    PERMISSIONS.LEGAL_CRM_DELETE,
    PERMISSIONS.LEGAL_CRM_MANAGE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.PROJECTS_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await legalCrmService.delete(id, req.user!.id, req.user!.permissions);
    res.json({ data: { success: true } });
  }),
);

// ─── Board ──────────────────────────────────────────────────

router.get(
  "/:id/board",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await legalCrmService.getBoard(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

// ─── Tasks ──────────────────────────────────────────────────

router.post(
  "/:id/tasks",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createLegalProjectTaskSchema.parse(req.body);
    const data = await legalCrmService.createTask(
      id,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = updateLegalProjectTaskSchema.parse(req.body);
    const data = await legalCrmService.updateTask(
      id,
      taskId,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    await legalCrmService.deleteTask(
      id,
      taskId,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── Columns ────────────────────────────────────────────────

router.post(
  "/:id/columns",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createLegalProjectColumnSchema.parse(req.body);
    const data = await legalCrmService.createColumn(
      id,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/columns/:columnId",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    const input = updateLegalProjectColumnSchema.parse(req.body);
    const data = await legalCrmService.updateColumn(
      id,
      columnId,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/columns/:columnId",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    await legalCrmService.deleteColumn(
      id,
      columnId,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

// ─── Members ────────────────────────────────────────────────

router.get(
  "/:id/members",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await legalCrmService.listMembers(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/members",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = manageLegalProjectMembersSchema.parse(req.body);
    const data = await legalCrmService.setMembers(
      id,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

// ─── Comments + Assignees ───────────────────────────────────

router.post(
  "/:id/tasks/:taskId/comments",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = createLegalProjectTaskCommentSchema.parse(req.body);
    const data = await legalCrmService.createTaskComment(
      id,
      taskId,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId/assignees",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = manageLegalProjectTaskAssigneesSchema.parse(req.body);
    const data = await legalCrmService.setTaskAssignees(
      id,
      taskId,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

export default router;
