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
import { marketingRecapService } from "@/modules/marketing-recap/marketing-recap.service";
import {
  recapDateSchema,
  recapNotesSchema,
  recapTargetsSchema,
} from "@/modules/marketing-recap/marketing-recap.validation";

const router = Router();

router.use(authenticate, requireActive);

/** Re-parsed on every route: the date is concatenated into a SystemSetting key. */
function parseDate(raw: string): string {
  const parsed = recapDateSchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException("Invalid date");
  return parsed.data;
}

// Literal path before the :date route — Express matches in order.
router.get(
  "/targets",
  requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await marketingRecapService.getTargets() });
  }),
);

/**
 * Targets are org-wide policy — what the business is aiming at — so setting
 * them is an admin act, unlike the daily notes below.
 */
router.put(
  "/targets",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const body = recapTargetsSchema.parse(req.body);
    const data = await marketingRecapService.setTargets(body);
    res.json({ success: true, data });
  }),
);

router.get(
  "/notes/:date",
  requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW),
  asyncHandler(async (req, res) => {
    const date = parseDate(getRequiredParam(req.params, "date"));
    const data = await marketingRecapService.getNotes(date);
    res.json({ success: true, data });
  }),
);

/**
 * Notes are the marketing team's daily write-up, not org policy, so they gate
 * on the campaign-edit permission those people already hold rather than on
 * admin:manage — which would leave the team unable to write their own recap.
 */
router.put(
  "/notes/:date",
  requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_UPDATE),
  asyncHandler(async (req, res) => {
    const date = parseDate(getRequiredParam(req.params, "date"));
    const body = recapNotesSchema.parse(req.body);
    const data = await marketingRecapService.setNotes(date, body);
    res.json({ success: true, data });
  }),
);

export default router;
