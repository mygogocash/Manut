import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorContactService } from "@/modules/investor-contacts/investor-contacts.service";
import {
  createInvestorContactSchema,
  listInvestorContactsSchema,
  updateInvestorContactSchema,
} from "@/modules/investor-contacts/investor-contacts.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const query = listInvestorContactsSchema.parse(req.query);
    const result = await investorContactService.list(
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
    const input = createInvestorContactSchema.parse(req.body);
    const data = await investorContactService.create(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const data = await investorContactService.getById(
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
    const input = updateInvestorContactSchema.parse(req.body);
    const data = await investorContactService.update(
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
    await investorContactService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
