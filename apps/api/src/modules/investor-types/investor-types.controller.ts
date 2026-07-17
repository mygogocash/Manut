import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorTypeService } from "@/modules/investor-types/investor-types.service";
import {
  createInvestorTypeSchema,
  reorderInvestorTypesSchema,
  updateInvestorTypeSchema,
} from "@/modules/investor-types/investor-types.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (_req, res) => {
    const data = await investorTypeService.list();
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorTypeSchema.parse(req.body);
    const data = await investorTypeService.create(input);
    res.status(201).json({ data });
  }),
);

// Literal path before the :key param route so Express matches it first.
router.put(
  "/reorder",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderInvestorTypesSchema.parse(req.body);
    const data = await investorTypeService.reorder(input);
    res.json({ data });
  }),
);

router.put(
  "/:key",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateInvestorTypeSchema.parse(req.body);
    const data = await investorTypeService.update(
      req.params.key as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:key",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await investorTypeService.delete(req.params.key as string);
    res.json({ data });
  }),
);

export default router;
