import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { validatorMonitorService } from "@/modules/validator-monitor/validator-monitor.service";
import {
  createNodeAlertSchema,
  updateNodeAlertSchema,
} from "@/modules/validator-monitor/validator-monitor.validation";

const router = Router();

router.use(authenticate, requireActive);

// Returns the latest cached report (or fetches if stale).
// `?refresh=1` bypasses the cache. Gated on `it:read-all` so only the
// IT team and admins see operational financial data.
router.get(
  "/",
  requirePermission(PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (req, res) => {
    const forceRefresh = req.query.refresh === "1";
    const data = await validatorMonitorService.getLatestReport({
      forceRefresh,
    });
    res.json({ data });
  }),
);

// ─── Node alert rules ─────────────────────────────────────
//
// Listing is open to anyone who can already see the report (`it:read-all`).
// Create / update / delete require the dedicated manage permission so
// non-admin IT viewers can read the rules but not change them.

router.get(
  "/alerts",
  requirePermission(PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (_req, res) => {
    const data = await validatorMonitorService.listAlerts();
    res.json({ data });
  }),
);

router.post(
  "/alerts",
  requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createNodeAlertSchema.parse(req.body);
    const data = await validatorMonitorService.createAlert(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

router.put(
  "/alerts/:id",
  requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateNodeAlertSchema.parse(req.body);
    const data = await validatorMonitorService.updateAlert(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/alerts/:id",
  requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE),
  asyncHandler(async (req, res) => {
    await validatorMonitorService.deleteAlert(req.params.id as string);
    res.status(204).end();
  }),
);

export default router;
