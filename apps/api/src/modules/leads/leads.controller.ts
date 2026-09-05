import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { leadService } from "@/modules/leads/leads.service";
import {
  bulkFieldUpdateLeadsSchema,
  bulkUpdateLeadsSchema,
  convertLeadSchema,
  createLeadSchema,
  disqualifyLeadSchema,
  listLeadsSchema,
  listStaleLeadsSchema,
  updateLeadSchema,
} from "@/modules/leads/leads.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = listLeadsSchema.parse(req.query);
    const result = await leadService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

// Literal /stale comes before /:id so Express does not capture "stale" as
// an id.
router.get(
  "/stale",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = listStaleLeadsSchema.parse(req.query);
    const result = await leadService.listStale(
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
    const input = createLeadSchema.parse(req.body);
    const data = await leadService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Bulk select-and-act. Literal path MUST precede `/:id` — Express matches in
// order and `/:id` would otherwise swallow `/bulk-business-units`.
// Owner + archive in bulk. `crm:reassign` for the owner half is enforced in the
// service, since requirePermission cannot express "only when a field is set".
router.post(
  "/bulk-update",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = bulkFieldUpdateLeadsSchema.parse(req.body);
    const data = await leadService.bulkUpdateFields(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/bulk-business-units",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = bulkUpdateLeadsSchema.parse(req.body);
    const data = await leadService.bulkUpdateBusinessUnits(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await leadService.getById(
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
    const input = updateLeadSchema.parse(req.body);
    const data = await leadService.update(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/convert",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = convertLeadSchema.parse(req.body);
    const data = await leadService.convert(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.post(
  "/:id/disqualify",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = disqualifyLeadSchema.parse(req.body);
    const data = await leadService.disqualify(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/archive",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await leadService.archive(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await leadService.unarchive(
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
    await leadService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
