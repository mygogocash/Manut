import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { partnerWorkspaceService } from "@/modules/partners/partner-workspace.service";
import {
  createPartnerColumnSchema,
  createPartnerTaskCommentSchema,
  createPartnerTaskResourceSchema,
  createPartnerTaskSchema,
  managePartnerMembersSchema,
  managePartnerTaskAssigneesSchema,
  updatePartnerColumnSchema,
  updatePartnerTaskSchema,
} from "@/modules/partners/partner-workspace.validation";
import { partnerService } from "@/modules/partners/partners.service";
import {
  createContactSchema,
  createPartnerSchema,
  importPartnersSchema,
  importPartnerTasksSchema,
  partnerQuerySchema,
  reorderPartnersSchema,
  updateContactSchema,
  updatePartnerSchema,
} from "@/modules/partners/partners.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const query = partnerQuerySchema.parse(req.query);
    const result = await partnerService.list(query);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createPartnerSchema.parse(req.body);
    const data = await partnerService.create(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

// Literal paths must register before `/:id`.
router.post(
  "/import",
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const input = importPartnersSchema.parse(req.body);
    const data = await partnerService.importRows(input.rows, req.user!.id);
    res.status(201).json({ data });
  }),
);

// Flat task export / import. Literal `/tasks/*` paths MUST precede the
// `/:id` routes (Express matches in order) — see CLAUDE.md.
router.get(
  "/tasks/export",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const query = partnerQuerySchema.parse(req.query);
    const data = await partnerService.exportTasks(query);
    res.json({ data });
  }),
);

router.post(
  "/tasks/import",
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const input = importPartnerTasksSchema.parse(req.body);
    const data = await partnerService.importTasks(input.rows);
    res.status(201).json({ data });
  }),
);

// Drag-to-reorder. `partners:update` gates the action — same perm
// that already controls the form-level edits the rows expose.
router.post(
  "/reorder",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderPartnersSchema.parse(req.body);
    const result = await partnerService.reorder(input.ids);
    res.json(result);
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const data = await partnerService.getById(req.params.id as string);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updatePartnerSchema.parse(req.body);
    const data = await partnerService.update(
      req.params.id as string,
      input,
      req.user!.id,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.PARTNERS_DELETE),
  asyncHandler(async (req, res) => {
    await partnerService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

router.get(
  "/:id/contacts",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await partnerService.listContacts(id);
    res.json({ data });
  }),
);

router.post(
  "/:id/contacts",
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createContactSchema.parse(req.body);
    const data = await partnerService.createContact(id, input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/contacts/:contactId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const contactId = getRequiredParam(req.params, "contactId");
    const input = updateContactSchema.parse(req.body);
    const data = await partnerService.updateContact(id, contactId, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id/contacts/:contactId",
  requirePermission(PERMISSIONS.PARTNERS_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const contactId = getRequiredParam(req.params, "contactId");
    await partnerService.deleteContact(id, contactId);
    res.json({ data: { success: true } });
  }),
);

// ─── Partner workspace ────────────────────────────────────────
//
// Phase 2 of the Partner ↔ Project decouple (#603 shipped Phase 1).
// All these routes target the new `partner_*` tables — no fall-
// through to the legacy `projects` graph. RBAC reuses the existing
// `partners:read` / `partners:update` perms so non-admin reps don't
// need a Roles-UI update.
//
// Phase 3 (frontend) wires the Partner detail page to these
// endpoints; Phase 4 retires the legacy redirect-shim entirely.

router.get(
  "/:id/board",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await partnerWorkspaceService.getBoard(id);
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createPartnerTaskSchema.parse(req.body);
    const data = await partnerWorkspaceService.createTask(
      id,
      input,
      req.user!.id,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = updatePartnerTaskSchema.parse(req.body);
    const data = await partnerWorkspaceService.updateTask(id, taskId, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    await partnerWorkspaceService.deleteTask(id, taskId);
    res.json({ data: { success: true } });
  }),
);

router.post(
  "/:id/columns",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createPartnerColumnSchema.parse(req.body);
    const data = await partnerWorkspaceService.createColumn(id, input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/columns/:columnId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    const input = updatePartnerColumnSchema.parse(req.body);
    const data = await partnerWorkspaceService.updateColumn(
      id,
      columnId,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id/columns/:columnId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const columnId = getRequiredParam(req.params, "columnId");
    await partnerWorkspaceService.deleteColumn(id, columnId);
    res.json({ data: { success: true } });
  }),
);

router.get(
  "/:id/members",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await partnerWorkspaceService.listMembers(id);
    res.json({ data });
  }),
);

router.put(
  "/:id/members",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = managePartnerMembersSchema.parse(req.body);
    const data = await partnerWorkspaceService.setMembers(id, input);
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks/:taskId/comments",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = createPartnerTaskCommentSchema.parse(req.body);
    const data = await partnerWorkspaceService.createTaskComment(
      id,
      taskId,
      input,
      req.user!.id,
    );
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id/tasks/:taskId/assignees",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = managePartnerTaskAssigneesSchema.parse(req.body);
    const data = await partnerWorkspaceService.setTaskAssignees(
      id,
      taskId,
      input,
    );
    res.json({ data });
  }),
);

// ─── Task resources (attachments) ─────────────────────────
router.get(
  "/:id/tasks/:taskId/resources",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const data = await partnerWorkspaceService.listTaskResources(id, taskId);
    res.json({ data });
  }),
);

router.post(
  "/:id/tasks/:taskId/resources",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const input = createPartnerTaskResourceSchema.parse(req.body);
    const data = await partnerWorkspaceService.addTaskResource(
      id,
      taskId,
      input,
      req.user!.id,
    );
    res.status(201).json({ data });
  }),
);

router.delete(
  "/:id/tasks/:taskId/resources/:resourceId",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const taskId = getRequiredParam(req.params, "taskId");
    const resourceId = getRequiredParam(req.params, "resourceId");
    const data = await partnerWorkspaceService.removeTaskResource(
      id,
      taskId,
      resourceId,
    );
    res.json({ data });
  }),
);

export default router;
