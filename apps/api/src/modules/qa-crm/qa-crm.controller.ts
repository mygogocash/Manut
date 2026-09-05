import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { qaCrmService } from "@/modules/qa-crm/qa-crm.service";
import {
  createQaProjectColumnSchema,
  createQaProjectSchema,
  createQaProjectTaskCommentSchema,
  createQaProjectTaskSchema,
  importQaProjectTasksSchema,
  manageQaProjectMembersSchema,
  manageQaProjectTaskAssigneesSchema,
  qaProjectQuerySchema,
  reorderQaProjectsSchema,
  reorderQaTasksSchema,
  updateQaProjectColumnSchema,
  updateQaProjectSchema,
  updateQaProjectTaskSchema,
} from "@/modules/qa-crm/qa-crm.validation";

const router = Router();

router.use(authenticate, requireActive);

// Permission bundles — accept the existing qa-crm:* set. QA CRM
// is greenfield with no shared-Project fallback (unlike IT CRM),
// so there's no `projects:*` chain here.
const QA_READ_PERMS = [PERMISSIONS.QA_CRM_READ, PERMISSIONS.QA_CRM_READ_ALL];

const QA_WRITE_PERMS = [PERMISSIONS.QA_CRM_UPDATE, PERMISSIONS.QA_CRM_MANAGE];

// ─── Project CRUD ────────────────────────────────────────────

router.get(
  "/",
  requirePermission(...QA_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = qaProjectQuerySchema.parse(req.query);
    const result = await qaCrmService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.QA_CRM_CREATE, PERMISSIONS.QA_CRM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createQaProjectSchema.parse(req.body);
    const data = await qaCrmService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal path before `:id` — Express matches in order.
router.put(
  "/reorder",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderQaProjectsSchema.parse(req.body);
    const data = await qaCrmService.reorder(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(...QA_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await qaCrmService.getById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(...QA_READ_PERMS, ...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateQaProjectSchema.parse(req.body);
    const data = await qaCrmService.update(
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
    ...QA_READ_PERMS,
    PERMISSIONS.QA_CRM_DELETE,
    PERMISSIONS.QA_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await qaCrmService.delete(id, req.user!.id, req.user!.permissions);
    res.json({ data: { success: true } });
  }),
);

// Reversible archive/unarchive. Gated like update (write perms); the service
// enforces owner-or-manage so a plain write-perm holder can't archive another
// team's project.
router.post(
  "/:id/archive",
  requirePermission(...QA_READ_PERMS, ...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await qaCrmService.archive(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(...QA_READ_PERMS, ...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await qaCrmService.unarchive(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

// ─── Board ──────────────────────────────────────────────────

router.get(
  "/:id/board",
  requirePermission(...QA_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await qaCrmService.getBoard(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

// ─── Tasks (QA issues) ───────────────────────────────────────

router.post(
  "/:id/tasks",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createQaProjectTaskSchema.parse(req.body);
    const data = await qaCrmService.createTask(
      id,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

// Literal `/import` before `/:taskId` so it isn't matched as a taskId.
router.post(
  "/:id/tasks/import",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = importQaProjectTasksSchema.parse(req.body);
    const data = await qaCrmService.importTasks(
      id,
      req.user!.id,
      req.user!.permissions,
      input.rows,
    );
    res.status(201).json({ data });
  }),
);

// Literal `/reorder` before `/:taskId` so it isn't matched as a taskId.
router.put(
  "/:id/tasks/reorder",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = reorderQaTasksSchema.parse(req.body);
    const data = await qaCrmService.reorderTasks(
      id,
      req.user!.id,
      req.user!.permissions,
      input.orderedIds,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = updateQaProjectTaskSchema.parse(req.body);
    const data = await qaCrmService.updateTask(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    await qaCrmService.deleteTask(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createQaProjectColumnSchema.parse(req.body);
    const data = await qaCrmService.createColumn(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    const input = updateQaProjectColumnSchema.parse(req.body);
    const data = await qaCrmService.updateColumn(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    await qaCrmService.deleteColumn(
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
  requirePermission(...QA_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await qaCrmService.listMembers(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/members",
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = manageQaProjectMembersSchema.parse(req.body);
    const data = await qaCrmService.setMembers(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = createQaProjectTaskCommentSchema.parse(req.body);
    const data = await qaCrmService.createTaskComment(
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
  requirePermission(...QA_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = manageQaProjectTaskAssigneesSchema.parse(req.body);
    const data = await qaCrmService.setTaskAssignees(
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
