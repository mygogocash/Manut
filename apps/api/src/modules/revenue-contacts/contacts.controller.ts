import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { contactService } from "@/modules/revenue-contacts/contacts.service";
import {
  createContactSchema,
  listContactsSchema,
  updateContactSchema,
} from "@/modules/revenue-contacts/contacts.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = listContactsSchema.parse(req.query);
    const result = await contactService.list(
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
    const input = createContactSchema.parse(req.body);
    const data = await contactService.create(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const data = await contactService.getById(
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
    const input = updateContactSchema.parse(req.body);
    const data = await contactService.update(
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
    await contactService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
