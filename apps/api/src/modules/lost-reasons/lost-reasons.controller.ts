import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { lostReasonService } from "@/modules/lost-reasons/lost-reasons.service";
import {
  createLostReasonSchema,
  listLostReasonsSchema,
  updateLostReasonSchema,
} from "@/modules/lost-reasons/lost-reasons.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = listLostReasonsSchema.parse(req.query);
    const data = await lostReasonService.list(query);
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.CRM_ADMIN),
  asyncHandler(async (req, res) => {
    const input = createLostReasonSchema.parse(req.body);
    const data = await lostReasonService.create(input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.CRM_ADMIN),
  asyncHandler(async (req, res) => {
    const input = updateLostReasonSchema.parse(req.body);
    const data = await lostReasonService.update(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CRM_ADMIN),
  asyncHandler(async (req, res) => {
    await lostReasonService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

export default router;
