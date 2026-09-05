import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { productCrmService } from "@/modules/product-crm/product-crm.service";
import {
  createProductProjectColumnSchema,
  createProductProjectSchema,
  createProductProjectTaskCommentSchema,
  createProductProjectTaskSchema,
  importProductProjectsSchema,
  manageProductProjectMembersSchema,
  manageProductProjectTaskAssigneesSchema,
  productProjectQuerySchema,
  reorderProductProjectsSchema,
  updateProductProjectColumnSchema,
  updateProductProjectSchema,
  updateProductProjectTaskSchema,
} from "@/modules/product-crm/product-crm.validation";

const router = Router();

router.use(authenticate, requireActive);

// Permission bundles — accept the existing product-crm:* set, plus broad
// projects:* fallback so admins / read-all holders work without an
// extra role grant.
const IT_READ_PERMS = [
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
];

const IT_WRITE_PERMS = [
  PERMISSIONS.PRODUCT_CRM_UPDATE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
];

// ─── Project CRUD ────────────────────────────────────────────

router.get(
  "/",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = productProjectQuerySchema.parse(req.query);
    const result = await productCrmService.list(
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
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = createProductProjectSchema.parse(req.body);
    const data = await productCrmService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal paths before `:id` — Express matches in order.
router.post(
  "/import",
  requirePermission(
    PERMISSIONS.PRODUCT_CRM_CREATE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.PROJECTS_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const input = importProductProjectsSchema.parse(req.body);
    const data = await productCrmService.importRows(req.user!.id, input.rows);
    res.status(201).json({ data });
  }),
);

router.put(
  "/reorder",
  requirePermission(...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderProductProjectsSchema.parse(req.body);
    const data = await productCrmService.reorder(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await productCrmService.getById(
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
    const input = updateProductProjectSchema.parse(req.body);
    const data = await productCrmService.update(
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
    PERMISSIONS.PRODUCT_CRM_DELETE,
    PERMISSIONS.PRODUCT_CRM_MANAGE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.PROJECTS_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await productCrmService.delete(id, req.user!.id, req.user!.permissions);
    res.json({ data: { success: true } });
  }),
);

// Reversible archive/unarchive. Gated like update (write perms); the service
// enforces owner-or-manage so a plain write-perm holder can't archive another
// team's project.
router.post(
  "/:id/archive",
  requirePermission(...IT_READ_PERMS, ...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await productCrmService.archive(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(...IT_READ_PERMS, ...IT_WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await productCrmService.unarchive(
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
  requirePermission(...IT_READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await productCrmService.getBoard(
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
    const input = createProductProjectTaskSchema.parse(req.body);
    const data = await productCrmService.createTask(
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
    const input = updateProductProjectTaskSchema.parse(req.body);
    const data = await productCrmService.updateTask(
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
    await productCrmService.deleteTask(
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
    const input = createProductProjectColumnSchema.parse(req.body);
    const data = await productCrmService.createColumn(
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
    const input = updateProductProjectColumnSchema.parse(req.body);
    const data = await productCrmService.updateColumn(
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
    await productCrmService.deleteColumn(
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
    const data = await productCrmService.listMembers(
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
    const input = manageProductProjectMembersSchema.parse(req.body);
    const data = await productCrmService.setMembers(
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
    const input = createProductProjectTaskCommentSchema.parse(req.body);
    const data = await productCrmService.createTaskComment(
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
    const input = manageProductProjectTaskAssigneesSchema.parse(req.body);
    const data = await productCrmService.setTaskAssignees(
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
