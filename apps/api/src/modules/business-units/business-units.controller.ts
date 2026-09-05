import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { businessUnitService } from "@/modules/business-units/business-units.service";
import {
  createBusinessUnitSchema,
  listBusinessUnitsSchema,
  reorderBusinessUnitsSchema,
  updateBusinessUnitSchema,
} from "@/modules/business-units/business-units.validation";

/**
 * One list, both CRMs. Business units are company-level (Onewave / ARIA),
 * not a per-CRM lookup, so `/sales` and `/sales-revenue` read and manage the
 * same rows rather than duplicating a whole `revenue-business-units` module
 * the way revenue-lost-reasons duplicates lost-reasons.
 *
 * requirePermission takes an OR list (see exchange-rates.controller.ts), so
 * either CRM's reader can see the list and either CRM's admin can edit it.
 */
const router = Router();

router.use(authenticate, requireActive);

const READ_PERMS = [PERMISSIONS.CRM_READ, PERMISSIONS.SALES_REVENUE_READ];
const ADMIN_PERMS = [PERMISSIONS.CRM_ADMIN, PERMISSIONS.SALES_REVENUE_ADMIN];

router.get(
  "/",
  requirePermission(...READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = listBusinessUnitsSchema.parse(req.query);
    const data = await businessUnitService.list(query);
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(...ADMIN_PERMS),
  asyncHandler(async (req, res) => {
    const input = createBusinessUnitSchema.parse(req.body);
    const data = await businessUnitService.create(input);
    res.status(201).json({ data });
  }),
);

// Literal path before `/:id` — Express matches in order (CLAUDE.md).
router.put(
  "/reorder",
  requirePermission(...ADMIN_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderBusinessUnitsSchema.parse(req.body);
    const data = await businessUnitService.reorder(input);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(...ADMIN_PERMS),
  asyncHandler(async (req, res) => {
    const input = updateBusinessUnitSchema.parse(req.body);
    const data = await businessUnitService.update(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(...ADMIN_PERMS),
  asyncHandler(async (req, res) => {
    await businessUnitService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

export default router;
