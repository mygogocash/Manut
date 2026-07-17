import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { accountingCrmService } from "@/modules/accounting-crm/accounting-crm.service";
import {
  accountingProjectQuerySchema,
  createAccountingProjectColumnSchema,
  createAccountingProjectSchema,
  createAccountingProjectTaskCommentSchema,
  createAccountingProjectTaskSchema,
  importAccountingProjectsSchema,
  manageAccountingProjectMembersSchema,
  manageAccountingProjectTaskAssigneesSchema,
  reorderAccountingProjectsSchema,
  updateAccountingProjectColumnSchema,
  updateAccountingProjectSchema,
  updateAccountingProjectTaskSchema,
} from "@/modules/accounting-crm/accounting-crm.validation";

const router = Router();

router.use(authenticate, requireActive);

// Permission bundles — accept the existing accounting-crm:* set, plus broad
// projects:* fallback so admins / read-all holders work without an
// extra role grant.
const IT_READ_PERMS = [
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
];

const IT_WRITE_PERMS = [
  PERMISSIONS.ACCOUNTING_CRM_UPDATE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
];

// ─── Project CRUD ────────────────────────────────────────────

router.get(
  "/",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = accountingProjectQuerySchema.parse(req.query);
    const result = await accountingCrmService.list(
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
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = createAccountingProjectSchema.parse(req.body);
    const data = await accountingCrmService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal paths before `:id` — Express matches in order.
router.post(
  "/import",
  requirePermission(
    PERMISSIONS.ACCOUNTING_CRM_CREATE,
    PERMISSIONS.ACCOUNTING_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importAccountingProjectsSchema.parse(req.body);
    const data = await accountingCrmService.importRows(
      req.user!.id,
      input.rows,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/reorder",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderAccountingProjectsSchema.parse(req.body);
    const data = await accountingCrmService.reorder(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingCrmService.getById(
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
    const input = updateAccountingProjectSchema.parse(req.body);
    const data = await accountingCrmService.update(
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
    PERMISSIONS.ACCOUNTING_CRM_DELETE,
    PERMISSIONS.ACCOUNTING_CRM_MANAGE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.PROJECTS_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await accountingCrmService.delete(id, req.user!.id, req.user!.permissions);
    res.json({ data: { success: true } });
  }),
);

// ─── Board ──────────────────────────────────────────────────

router.get(
  "/:id/board",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingCrmService.getBoard(
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
    const input = createAccountingProjectTaskSchema.parse(req.body);
    const data = await accountingCrmService.createTask(
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
    const input = updateAccountingProjectTaskSchema.parse(req.body);
    const data = await accountingCrmService.updateTask(
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
    await accountingCrmService.deleteTask(
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
    const input = createAccountingProjectColumnSchema.parse(req.body);
    const data = await accountingCrmService.createColumn(
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
    const input = updateAccountingProjectColumnSchema.parse(req.body);
    const data = await accountingCrmService.updateColumn(
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
    await accountingCrmService.deleteColumn(
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
    const data = await accountingCrmService.listMembers(
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
    const input = manageAccountingProjectMembersSchema.parse(req.body);
    const data = await accountingCrmService.setMembers(
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
    const input = createAccountingProjectTaskCommentSchema.parse(req.body);
    const data = await accountingCrmService.createTaskComment(
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
    const input = manageAccountingProjectTaskAssigneesSchema.parse(req.body);
    const data = await accountingCrmService.setTaskAssignees(
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
