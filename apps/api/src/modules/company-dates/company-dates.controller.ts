import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { companyDatesService } from "@/modules/company-dates/company-dates.service";
import {
  createCompanyDateSchema,
  updateCompanyDateSchema,
} from "@/modules/company-dates/company-dates.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await companyDatesService.listUpcoming(page, limit);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createCompanyDateSchema.parse(req.body);
    const date = await companyDatesService.create(req.user!.id, input);
    res.status(201).json({ data: date });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await companyDatesService.getById(id);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateCompanyDateSchema.parse(req.body);
    const data = await companyDatesService.update(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await companyDatesService.delete(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
