import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorLeadService } from "@/modules/investor-leads/investor-leads.service";
import {
  createInvestorLeadSchema,
  listInvestorLeadsSchema,
  updateInvestorLeadSchema,
} from "@/modules/investor-leads/investor-leads.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const query = listInvestorLeadsSchema.parse(req.query);
    const result = await investorLeadService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorLeadSchema.parse(req.body);
    const data = await investorLeadService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const data = await investorLeadService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateInvestorLeadSchema.parse(req.body);
    const data = await investorLeadService.update(
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
  requirePermission(PERMISSIONS.INVESTORS_DELETE),
  asyncHandler(async (req, res) => {
    await investorLeadService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
