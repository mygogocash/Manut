import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { BadRequestException } from "@/common/exceptions/http-exception";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { tableLayoutsService } from "@/modules/table-layouts/table-layouts.service";
import {
  tableIdSchema,
  tableLayoutSchema,
} from "@/modules/table-layouts/table-layouts.validation";

const router = Router();

router.use(authenticate, requireActive);

/**
 * The id is concatenated into a SystemSetting primary key, so it is parsed
 * through the schema on every route rather than trusted from the path — an
 * unconstrained id could address another module's row.
 */
function parseTableId(raw: string): string {
  const parsed = tableIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestException("Invalid table id");
  }
  return parsed.data;
}

/**
 * Read is open to any authenticated user who can see the marketing dashboard.
 * The layout is not secret and every viewer needs it to render the table at
 * all — gating it behind the admin permission would mean non-admins silently
 * lost the org default.
 */
router.get(
  "/:tableId",
  requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW),
  asyncHandler(async (req, res) => {
    const tableId = parseTableId(getRequiredParam(req.params, "tableId"));
    const data = await tableLayoutsService.get(tableId);
    res.json({ success: true, data });
  }),
);

// Writing the organisation-wide default is an admin act: it changes what
// every user sees by default.
router.put(
  "/:tableId",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const tableId = parseTableId(getRequiredParam(req.params, "tableId"));
    const body = tableLayoutSchema.parse(req.body);
    const data = await tableLayoutsService.set(tableId, body);
    res.json({ success: true, data });
  }),
);

router.delete(
  "/:tableId",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const tableId = parseTableId(getRequiredParam(req.params, "tableId"));
    await tableLayoutsService.clear(tableId);
    res.status(204).send();
  }),
);

export default router;
