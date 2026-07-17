import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { vendorsService } from "@/modules/vendors/vendors.service";
import {
  bulkImportSchema,
  createVendorSchema,
  updateVendorSchema,
  vendorQuerySchema,
} from "@/modules/vendors/vendors.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const query = vendorQuerySchema.parse(req.query);
    const result = await vendorsService.list(query);
    res.json(result);
  }),
);

router.post(
  "/import",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = bulkImportSchema.parse(req.body);
    const result = await vendorsService.bulkImport(input);
    res.status(201).json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = createVendorSchema.parse(req.body);
    const result = await vendorsService.create(input);
    res.status(201).json(result);
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await vendorsService.getById(id);
    res.json(result);
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateVendorSchema.parse(req.body);
    const result = await vendorsService.update(id, input);
    res.json(result);
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await vendorsService.remove(id);
    res.json(result);
  }),
);

export default router;
