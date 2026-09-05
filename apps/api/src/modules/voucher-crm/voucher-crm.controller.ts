import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { voucherCrmService } from "@/modules/voucher-crm/voucher-crm.service";
import {
  createVoucherEntrySchema,
  importVoucherEntriesSchema,
  reorderVoucherEntriesSchema,
  updateVoucherEntrySchema,
  voucherQuerySchema,
} from "@/modules/voucher-crm/voucher-crm.validation";

const router = Router();

router.use(authenticate, requireActive);

const READ_PERMS = [
  PERMISSIONS.VOUCHER_CRM_READ,
  PERMISSIONS.VOUCHER_CRM_READ_ALL,
];
const WRITE_PERMS = [
  PERMISSIONS.VOUCHER_CRM_UPDATE,
  PERMISSIONS.VOUCHER_CRM_MANAGE,
];

router.get(
  "/",
  requirePermission(...READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = voucherQuerySchema.parse(req.query);
    const result = await voucherCrmService.list(query);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(
    PERMISSIONS.VOUCHER_CRM_CREATE,
    PERMISSIONS.VOUCHER_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const input = createVoucherEntrySchema.parse(req.body);
    const data = await voucherCrmService.create(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

// Literal paths before `:id` — Express matches in order.
router.post(
  "/import",
  requirePermission(
    PERMISSIONS.VOUCHER_CRM_CREATE,
    PERMISSIONS.VOUCHER_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const input = importVoucherEntriesSchema.parse(req.body);
    const data = await voucherCrmService.importRows(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

router.put(
  "/reorder",
  requirePermission(...WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const input = reorderVoucherEntriesSchema.parse(req.body);
    const data = await voucherCrmService.reorder(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(...READ_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await voucherCrmService.getById(id);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(...READ_PERMS, ...WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateVoucherEntrySchema.parse(req.body);
    const data = await voucherCrmService.update(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(
    ...READ_PERMS,
    PERMISSIONS.VOUCHER_CRM_DELETE,
    PERMISSIONS.VOUCHER_CRM_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await voucherCrmService.delete(id);
    res.json({ data });
  }),
);

// Reversible archive/unarchive. Gated like update (read + write perms); the
// module has no per-row owner scoping, so the permission gate is the guard.
router.post(
  "/:id/archive",
  requirePermission(...READ_PERMS, ...WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await voucherCrmService.archive(id);
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(...READ_PERMS, ...WRITE_PERMS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await voucherCrmService.unarchive(id);
    res.json({ data });
  }),
);

export default router;
