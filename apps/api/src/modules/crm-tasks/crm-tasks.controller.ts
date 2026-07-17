import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { crmTaskService } from "@/modules/crm-tasks/crm-tasks.service";
import {
  createCrmTaskSchema,
  listCrmTasksSchema,
  updateCrmTaskSchema,
} from "@/modules/crm-tasks/crm-tasks.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = listCrmTasksSchema.parse(req.query);
    const result = await crmTaskService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.CRM_CREATE),
  asyncHandler(async (req, res) => {
    const input = createCrmTaskSchema.parse(req.body);
    const data = await crmTaskService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await crmTaskService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateCrmTaskSchema.parse(req.body);
    const data = await crmTaskService.update(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/complete",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await crmTaskService.complete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CRM_DELETE),
  asyncHandler(async (req, res) => {
    await crmTaskService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
