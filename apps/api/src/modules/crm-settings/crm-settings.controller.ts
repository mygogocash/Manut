import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { crmSettingsService } from "@/modules/crm-settings/crm-settings.service";
import { updateCrmSettingsSchema } from "@/modules/crm-settings/crm-settings.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CRM_SETTINGS_MANAGE),
  asyncHandler(async (_req, res) => {
    const result = await crmSettingsService.getSettings();
    res.json(result);
  }),
);

router.put(
  "/",
  requirePermission(PERMISSIONS.CRM_SETTINGS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateCrmSettingsSchema.parse(req.body);
    const result = await crmSettingsService.updateSettings(input, req.user!.id);
    logger.info(`CRM notification settings updated by ${req.user!.email}`, {
      recipientCount: result.data.notifyEmails.length,
    });
    res.json(result);
  }),
);

export default router;
