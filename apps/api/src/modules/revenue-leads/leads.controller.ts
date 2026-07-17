import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { leadService } from "@/modules/revenue-leads/leads.service";
import {
  convertLeadSchema,
  createLeadSchema,
  disqualifyLeadSchema,
  listLeadsSchema,
  listStaleLeadsSchema,
  updateLeadSchema,
} from "@/modules/revenue-leads/leads.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
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
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
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
  requirePermission(PERMISSIONS.SALES_REVENUE_CREATE),
  asyncHandler(async (req, res) => {
    const input = createLeadSchema.parse(req.body);
    const data = await leadService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
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
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
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
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
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
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
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

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_DELETE),
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
